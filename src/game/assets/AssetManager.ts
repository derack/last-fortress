import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterAssetEntry } from './AssetManifest';

// ============================================================
// AssetManager — سیستم مرکزی مدیریت Assetهای سه‌بعدی
// ------------------------------------------------------------
// مسئولیت‌ها:
//   loadGLB / preload / cache / clone / dispose
//   loading progress / error handling / fallback / آماده‌سازی انیمیشن
//
// قوانین:
//   • هر Asset فقط یک‌بار از دیسک Load می‌شود (Cache مرکزی)
//   • هر Instance با SkeletonUtils.clone ساخته می‌شود (اشتراک هندسه/متریال)
//   • هرگز Crash نمی‌کند — خطا ثبت و وضعیت missing/error برمی‌گردد
//   • نتیجه منفی (فایل نبودن) هم Cache می‌شود تا 404 تکراری نداشته باشیم
// ============================================================

export type AssetStatus = 'pending' | 'loading' | 'ready' | 'missing' | 'error';

export interface AssetCacheRecord {
  status: AssetStatus;
  /** صحنه اصلی GLB — منبع کلون‌ها (هرگز مستقیم به صحنه بازی اضافه نمی‌شود) */
  source?: THREE.Group;
  /** انیمیشن‌های داخل GLB */
  animations: THREE.AnimationClip[];
  error?: string;
  loadedAt?: number;
}

export interface PreloadProgress {
  loaded: number;
  total: number;
  currentId: string;
  status: AssetStatus;
}

export interface PreloadReport {
  total: number;
  ready: number;
  missing: number;
  error: number;
}

/**
 * Merge static GLB body pieces by material at load time. Our authored first-pass
 * models use many small hard-surface pieces; without batching each part becomes
 * a draw call for every enemy in a wave. Keep weapons separate for procedural
 * prop-swing, and keep tower pivots/VFX meshes separate for gameplay animation.
 */
function optimizeStaticAsset(scene: THREE.Group, category: CharacterAssetEntry['category']) {
  if (category === 'heroes') return; // preserve existing authored hero hierarchy/rigs
  let hasSkin = false;
  scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true; });
  if (hasSkin) return;

  scene.updateMatrixWorld(true);
  const tower = category === 'towers';
  const keepTowerNodes = new Set(['spincrystal', 'spinring', 'ember']);
  const keepWeapon = /weapon|blade|bow|staff|gun|cannon/i;
  const groups = new Map<string, { parent: THREE.Object3D; material: THREE.Material; geometries: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
  const findTowerPivot = (mesh: THREE.Object3D): THREE.Object3D => {
    let p = mesh.parent;
    while (p && p !== scene) {
      if (p.name.toLowerCase() === 'turret') return p;
      p = p.parent;
    }
    return scene;
  };

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;
    const name = mesh.name.toLowerCase();
    if (tower ? keepTowerNodes.has(name) : keepWeapon.test(name)) return;
    if (Array.isArray(mesh.material)) return; // retain unusual multi-material meshes safely

    const parent = tower ? findTowerPivot(mesh) : scene;
    const key = parent.uuid + '|' + mesh.material.uuid;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { parent, material: mesh.material, geometries: [], sources: [] };
      groups.set(key, bucket);
    }
    const geometry = mesh.geometry.clone();
    const relative = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(mesh.matrixWorld);
    geometry.applyMatrix4(relative);
    bucket.geometries.push(geometry);
    bucket.sources.push(mesh);
  });

  for (const bucket of groups.values()) {
    if (bucket.geometries.length < 2) {
      for (const geometry of bucket.geometries) geometry.dispose();
      continue;
    }
    const merged = mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) geometry.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.name = tower ? 'BatchedTowerStaticGeometry' : 'BatchedCharacterStaticGeometry';
    mesh.castShadow = bucket.sources.some((source) => source.castShadow);
    mesh.receiveShadow = bucket.sources.some((source) => source.receiveShadow);
    mesh.frustumCulled = true;
    bucket.parent.add(mesh);
    for (const source of bucket.sources) source.removeFromParent();
  }
  scene.updateMatrixWorld(true);
}

class AssetManagerImpl {
  private loader = new GLTFLoader();
  private cache = new Map<string, AssetCacheRecord>();
  private inflight = new Map<string, Promise<AssetCacheRecord>>();
  private listeners = new Set<(id: string, status: AssetStatus) => void>();

  constructor() {
    // بهینه‌سازی موبایل: بدون DRACO/KTX2 — GLB استاندارد سبک
  }

  /** وضعیت فعلی یک Asset */
  status(id: string): AssetStatus {
    return this.cache.get(id)?.status ?? 'pending';
  }

  /** رکورد Cache — برای گالری و Validator */
  record(id: string): AssetCacheRecord | undefined {
    return this.cache.get(id);
  }

  /** فرآیند‌های در جریان — برای گالری */
  loadingIds(): string[] {
    return [...this.inflight.keys()];
  }

  /** اشتراک در تغییر وضعیت (برای UI) */
  onStatus(cb: (id: string, status: AssetStatus) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setStatus(id: string, rec: AssetCacheRecord) {
    this.cache.set(id, rec);
    for (const cb of this.listeners) cb(id, rec.status);
  }

  /**
   * Load یک GLB — هرگز Exception پرتاب نمی‌کند.
   * فایل نبودن → status 'missing' (Console Warn یک‌بار)
   * خراب بودن → status 'error' (Console Error با جزئیات)
   */
  async load(entry: CharacterAssetEntry): Promise<AssetCacheRecord> {
    const cached = this.cache.get(entry.id);
    if (cached && cached.status !== 'pending') return cached;

    const running = this.inflight.get(entry.id);
    if (running) return running;

    this.setStatus(entry.id, { status: 'loading', animations: [] });

    const promise = this.loader
      .loadAsync(entry.file)
      .then((gltf) => {
        const scene = gltf.scene;
        optimizeStaticAsset(scene, entry.category);
        scene.visible = true;
        // فراداده استاندارد روی ریشه Asset
        scene.userData.assetId = entry.id;
        scene.userData.characterType = entry.category;
        scene.userData.version = 1;
        scene.userData.animationNames = (gltf.animations ?? []).map((c) => c.name);
        scene.userData.forwardAxis = '+Z';
        scene.userData.scale = entry.targetHeight;

        const rec: AssetCacheRecord = {
          status: 'ready',
          source: scene,
          animations: gltf.animations ?? [],
          loadedAt: performance.now(),
        };
        this.setStatus(entry.id, rec);
        console.info(`[AssetManager] GLB بارگذاری شد: ${entry.id} (${entry.file}) — ${rec.animations.length} انیمیشن`);
        return rec;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const is404 = /404|not found|LoadingFailed|fetch/i.test(msg);
        const status: AssetStatus = is404 ? 'missing' : 'error';
        if (status === 'missing') {
          console.warn(`[AssetManager] فایل GLB یافت نشد: ${entry.file} — از Placeholder موقت استفاده می‌شود`);
        } else {
          console.error(`[AssetManager] خطا در بارگذاری ${entry.file}:`, msg);
        }
        const rec: AssetCacheRecord = { status, animations: [], error: msg };
        this.setStatus(entry.id, rec);
        return rec;
      })
      .finally(() => {
        this.inflight.delete(entry.id);
      });

    this.inflight.set(entry.id, promise);
    return promise;
  }

  /**
   * Preload گروهی با Progress — برای Splash Screen
   * موازی با سقف هم‌زمانی تا موبایل سنگین نشود.
   */
  async preload(entries: CharacterAssetEntry[], onProgress?: (p: PreloadProgress) => void, concurrency = 6): Promise<PreloadReport> {
    const report: PreloadReport = { total: entries.length, ready: 0, missing: 0, error: 0 };
    let done = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < entries.length) {
        const entry = entries[cursor++];
        const rec = await this.load(entry);
        done++;
        if (rec.status === 'ready') report.ready++;
        else if (rec.status === 'missing') report.missing++;
        else if (rec.status === 'error') report.error++;
        onProgress?.({ loaded: done, total: entries.length, currentId: entry.id, status: rec.status });
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, entries.length) }, worker);
    await Promise.all(workers);
    return report;
  }

  /**
   * ساخت Instance جدید از Asset — Load Once → Cache → Clone
   * برای مدل‌های دارای Skeleton از SkeletonUtils.clone استفاده می‌شود
   * (هندسه/متریال/بافت بین همه Instanceها مشترک می‌ماند).
   * اگر Asset آماده نبود null برمی‌گرداند (Fallback سمت CharacterFactory).
   */
  instantiate(entry: CharacterAssetEntry): { scene: THREE.Group; animations: THREE.AnimationClip[] } | null {
    const rec = this.cache.get(entry.id);
    if (!rec || rec.status !== 'ready' || !rec.source) return null;
    const inst = skeletonClone(rec.source) as THREE.Group;
    inst.userData.assetId = entry.id;
    inst.userData.characterType = entry.category;
    inst.userData.version = rec.source.userData.version;
    inst.userData.animationNames = rec.animations.map((c) => c.name);
    inst.userData.forwardAxis = '+Z';
    inst.userData.isGlbClone = true; // علامت: منابع مشترک — هنگام Remove نه Geometry نه Material باید Dispose شود
    return { scene: inst, animations: rec.animations };
  }

  /** آزادسازی حافظه Cache (فقط در reload کامل بازی لازم است) */
  disposeAll() {
    for (const [, rec] of this.cache) {
      if (rec.source) {
        rec.source.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const m = o.material;
            if (Array.isArray(m)) m.forEach((mm) => this.disposeMaterial(mm));
            else if (m) this.disposeMaterial(m);
          }
        });
      }
    }
    this.cache.clear();
    this.inflight.clear();
    console.info('[AssetManager] Cache کامل آزاد شد');
  }

  private disposeMaterial(m: THREE.Material) {
    const anyM = m as unknown as { map?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture; metalnessMap?: THREE.Texture; emissiveMap?: THREE.Texture; aoMap?: THREE.Texture };
    anyM.map?.dispose();
    anyM.normalMap?.dispose();
    anyM.roughnessMap?.dispose();
    anyM.metalnessMap?.dispose();
    anyM.emissiveMap?.dispose();
    anyM.aoMap?.dispose();
    m.dispose();
  }
}

/** Singleton سراسری — بین نبردها زنده می‌ماند تا Assetها فقط یک‌بار Load شوند */
export const assetManager = new AssetManagerImpl();
