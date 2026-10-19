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
  /** GLB-authored clips vs runtime rigid-part fallback — never label generated clips as mocap. */
  animations: THREE.AnimationClip[];
  animationSource?: 'glb' | 'runtime-procedural' | 'none';
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
type SurfaceMaps = { color: THREE.CanvasTexture; bump: THREE.CanvasTexture; normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
const sharedSurfaceMaps = new Map<'stone' | 'metal', SurfaceMaps>();

function getSharedSurfaceMaps(profile: 'stone' | 'metal' = 'stone'): SurfaceMaps | null {
  const cached = sharedSurfaceMaps.get(profile);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const size = 128;
  const waveAt = (x: number, y: number) => {
    const u = x / size, v = y / size;
    if (profile === 'metal') {
      // Fine directional brushing with low amplitude, unlike the broad stone grain.
      return Math.sin(v * Math.PI * 64 + Math.sin(u * Math.PI * 6) * 0.2) * 0.35
        + Math.sin(v * Math.PI * 24 + u * Math.PI * 3) * 0.3
        + Math.cos(u * Math.PI * 8) * 0.12;
    }
    return Math.sin(u * Math.PI * 8 + Math.sin(v * Math.PI * 4) * 0.7)
      + Math.cos(v * Math.PI * 6 + Math.sin(u * Math.PI * 2) * 0.45)
      + 0.45 * Math.sin((u + v) * Math.PI * 12);
  };
  const makeCanvas = (kind: 'color' | 'bump' | 'normal' | 'roughness') => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Broad, periodic mineral/forged-surface variation. No colored speckles.
        const wave = waveAt(x, y);
        const i = (y * size + x) * 4;
        if (kind === 'normal') {
          const dx = (waveAt((x + 1) % size, y) - waveAt((x + size - 1) % size, y)) * 0.5;
          const dy = (waveAt(x, (y + 1) % size) - waveAt(x, (y + size - 1) % size)) * 0.5;
          const normalStrength = profile === 'metal' ? 0.16 : 0.34;
          const nx = -dx * normalStrength, ny = -dy * normalStrength, nz = 1;
          const length = Math.hypot(nx, ny, nz);
          image.data[i] = Math.round((nx / length * 0.5 + 0.5) * 255);
          image.data[i + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
          image.data[i + 2] = Math.round((nz / length * 0.5 + 0.5) * 255);
        } else {
          const value = kind === 'bump' ? 128 + wave * (profile === 'metal' ? 4 : 10) : 238 + wave * (profile === 'metal' ? 4.5 : 3.8);
          image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.max(0, Math.min(255, value));
        }
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  const colorCanvas = makeCanvas('color');
  const bumpCanvas = makeCanvas('bump');
  const normalCanvas = makeCanvas('normal');
  const roughnessCanvas = makeCanvas('roughness');
  if (!colorCanvas || !bumpCanvas || !normalCanvas || !roughnessCanvas) return null;
  const color = new THREE.CanvasTexture(colorCanvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.colorSpace = THREE.NoColorSpace;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 4;
  const normal = new THREE.CanvasTexture(normalCanvas);
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = 4;
  const roughness = new THREE.CanvasTexture(roughnessCanvas);
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.anisotropy = 4;
  const maps = { color, bump, normal, roughness };
  sharedSurfaceMaps.set(profile, maps);
  return maps;
}

function ensureProceduralUV(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute('uv')) return;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position) return;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = normal?.getX(i) ?? 0, ny = normal?.getY(i) ?? 0, nz = normal?.getZ(i) ?? 0;
    let u: number, v: number;
    if (Math.abs(ny) > 0.72) { u = x + 0.5; v = z + 0.5; }
    else if (Math.abs(nz) >= Math.abs(nx)) { u = x + 0.5; v = y + 0.5; }
    else { u = z + 0.5; v = y + 0.5; }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * Lightweight runtime clips for static first-pass GLBs. These animate rigid
 * parts rather than a skeletal rig; authored rigging/mocap remains a later art task.
 */
function createStaticCharacterClips(scene: THREE.Group, category: CharacterAssetEntry['category']): THREE.AnimationClip[] {
  if (category !== 'enemies' && category !== 'bosses') return [];
  const names = new Set<string>();
  scene.traverse((o) => { if (o.name) names.add(o.name); });
  const times = [0, 0.25, 0.5, 0.75, 1];
  const q = (axis: THREE.Vector3, angle: number) => new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const track = (nodeName: string, angles: number[], axis = new THREE.Vector3(1, 0, 0)) => {
    if (!names.has(nodeName)) return null;
    return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, angles.flatMap((angle) => q(axis, angle).toArray()));
  };
  const clip = (name: string, specs: { node: string; angles: number[]; axis?: THREE.Vector3 }[]) => {
    const tracks = specs.map((s) => track(s.node, s.angles, s.axis)).filter((t): t is THREE.QuaternionKeyframeTrack => t !== null);
    return new THREE.AnimationClip(name, 1, tracks);
  };
  const x = new THREE.Vector3(1, 0, 0), y = new THREE.Vector3(0, 1, 0), z = new THREE.Vector3(0, 0, 1);
  const locomotion: { node: string; angles: number[]; axis?: THREE.Vector3 }[] = [
    { node: 'leftLeg', angles: [0, 0.32, 0, -0.32, 0] }, { node: 'rightLeg', angles: [0, -0.32, 0, 0.32, 0] },
    { node: 'arm-1', angles: [0, -0.38, 0, 0.38, 0] }, { node: 'arm1', angles: [0, 0.38, 0, -0.38, 0] },
    { node: 'leftArm', angles: [0, -0.3, 0, 0.3, 0] }, { node: 'rightArm', angles: [0, 0.3, 0, -0.3, 0] },
    { node: 'wing-1', angles: [0, -0.42, 0, 0.42, 0], axis: z }, { node: 'wing1', angles: [0, 0.42, 0, -0.42, 0], axis: z },
    { node: 'tail', angles: [0, 0.18, 0, -0.18, 0], axis: y }, { node: 'head', angles: [0, 0.035, 0, -0.035, 0], axis: y },
  ];
  for (const name of names) {
    if (/^leg\d+[-_]?\d+$/i.test(name)) locomotion.push({ node: name, angles: [0, 0.28, 0, -0.28, 0], axis: z });
    if (/^(?:shard|spine|backshard|dorsalspine)\d+$/i.test(name)) locomotion.push({ node: name, angles: [0, 0.14, 0, -0.14, 0], axis: y });
    if (/^tendril-?\d+$/i.test(name)) locomotion.push({ node: name, angles: [0, 0.18, 0, -0.18, 0], axis: z });
  }
  const idle = clip('Idle', [
    { node: 'head', angles: [0, 0.025, 0, -0.025, 0], axis: y },
    { node: 'core', angles: [0, 0.025, 0, -0.025, 0], axis: y },
  ]);
  const walk = clip('Walk', locomotion);
  const attack = [
    { node: 'arm1', angles: [0, -0.75, 0.2, 0.1, 0] }, { node: 'rightArm', angles: [0, -0.75, 0.2, 0.1, 0] },
    { node: 'arm-1', angles: [0, 0.28, -0.12, 0, 0] }, { node: 'head', angles: [0, -0.08, 0.12, 0, 0] },
    { node: 'blade', angles: [0, -0.62, 0.18, 0, 0], axis: z },
    { node: 'bow', angles: [0, -0.28, 0.1, 0, 0], axis: z },
    { node: 'staff', angles: [0, -0.32, 0.12, 0, 0], axis: z },
    { node: 'gun', angles: [0, -0.16, 0.06, 0, 0], axis: x },
    { node: 'cannon', angles: [0, -0.12, 0.04, 0, 0], axis: x },
    { node: 'staffOrb', angles: [0, 0.45, 0.9, 1.35, 1.8], axis: y },
    { node: 'tail', angles: [0, -0.28, 0.18, 0, 0], axis: y },
  ];
  const hit = clip('Hit', [
    { node: 'ModelRoot', angles: [0, -0.18, 0.06, 0, 0], axis: z },
    { node: 'head', angles: [0, 0.12, -0.06, 0, 0] },
  ]);
  const death = clip('Death', [{ node: 'ModelRoot', angles: [0, 0.4, 1.2, 1.2, 1.2], axis: z }]);
  if (category === 'enemies') return [idle, walk, clip('Attack', attack), hit, death];
  return [
    idle, walk, clip('Attack1', attack),
    clip('Attack2', [{ node: 'arm1', angles: [0, -1.05, 0.3, -0.12, 0] }, { node: 'rightArm', angles: [0, -1.05, 0.3, -0.12, 0] }, { node: 'blade', angles: [0, -0.9, 0.25, -0.1, 0], axis: z }, { node: 'staff', angles: [0, -0.5, 0.18, 0, 0], axis: z }, { node: 'head', angles: [0, -0.12, 0.16, 0, 0] }, { node: 'tail', angles: [0, -0.4, 0.22, 0, 0], axis: y }]),
    clip('SpecialAttack', [{ node: 'ModelRoot', angles: [0, -0.12, 0.2, -0.05, 0], axis: x }, { node: 'core', angles: [0, 0.35, -0.2, 0.1, 0], axis: y }]),
    clip('Roar', [{ node: 'head', angles: [0, -0.2, 0.28, -0.12, 0] }, { node: 'ModelRoot', angles: [0, -0.08, 0.12, -0.04, 0], axis: x }]),
    hit, clip('PhaseChange', [{ node: 'ModelRoot', angles: [0, 0.25, -0.2, 0.1, 0], axis: y }, { node: 'core', angles: [0, 0.5, -0.4, 0.2, 0], axis: y }]), death,
  ];
}

function markSharedAssetResources(scene: THREE.Object3D) {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.userData.sharedAssetResource = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.userData.sharedAssetResource = true;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.userData.sharedAssetResource = true;
      }
    }
  });
}

function optimizeStaticAsset(scene: THREE.Group, category: CharacterAssetEntry['category']) {
  if (category === 'heroes') {
    markSharedAssetResources(scene);
    return; // preserve existing authored hero hierarchy/rigs
  }
  let hasSkin = false;
  scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true; });
  if (hasSkin) {
    markSharedAssetResources(scene);
    return;
  }

  scene.updateMatrixWorld(true);
  const tower = category === 'towers';
  const characterRoot = scene.getObjectByName('ModelRoot') ?? scene;
  const keepTowerNodes = new Set(['spincrystal', 'spinring', 'ember']);
  const keepWeapon = /weapon|blade|bow|staff|gun|cannon/i;
  const keepAnimatedPart = /^(?:head|torso|body|leftleg|rightleg|leftarm|rightarm|arm-1|arm1|wing-1|wing1|tail|abdomen|carapace|core|shoulder-1|shoulder1|leg\d+[-_]?\d+|legjoint\d+[-_]?\d+|tendril-?1)$/i;
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
    // Heavy actors and towers cast the scene's dynamic shadows; common wave enemies
    // receive shadows but avoid multiplying shadow-map cost during dense waves.
    mesh.castShadow = category === 'bosses' || category === 'towers';
    mesh.receiveShadow = true;
    ensureProceduralUV(mesh.geometry);
    if (maps) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.isMeshStandardMaterial) continue;
        // Emissive cores stay clean; stone and forged metal receive distinct
        // seamless surface families instead of one generic texture for everything.
        const emissiveStrength = standard.emissive.r + standard.emissive.g + standard.emissive.b;
        if (emissiveStrength <= 0.08) {
          const maps = getSharedSurfaceMaps(standard.metalness > 0.4 ? 'metal' : 'stone');
          if (maps) {
            if (!standard.map) standard.map = maps.color;
            if (!standard.normalMap) {
              standard.normalMap = maps.normal;
              standard.normalScale.set(category === 'bosses' ? 0.22 : 0.14, category === 'bosses' ? 0.22 : 0.14);
            }
            if (!standard.roughnessMap) standard.roughnessMap = maps.roughness;
            if (!standard.bumpMap) {
              standard.bumpMap = maps.bump;
              standard.bumpScale = category === 'bosses' ? 0.022 : 0.012;
            }
          }
        }
        // Give materials physically distinct response instead of making every surface
        // equally dull: metals retain reflections, stone stays matte, emissive cores glow.
        if (emissiveStrength > 0.08) {
          standard.roughness = Math.min(standard.roughness, 0.3);
          standard.metalness = Math.min(standard.metalness, 0.12);
        } else if (standard.metalness > 0.4) {
          standard.metalness = Math.max(standard.metalness, 0.68);
          standard.roughness = Math.min(standard.roughness, 0.42);
        } else {
          standard.metalness = Math.min(standard.metalness, 0.08);
          standard.roughness = Math.max(standard.roughness, 0.82);
        }
        standard.needsUpdate = true;
      }
    }
    const name = mesh.name.toLowerCase();
    if (tower ? keepTowerNodes.has(name) : (keepWeapon.test(name) || keepAnimatedPart.test(name))) return;
    if (Array.isArray(mesh.material)) return; // retain unusual multi-material meshes safely

    const parent = tower ? findTowerPivot(mesh) : characterRoot;
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
  // GLB resources are cached and cloned across battles; scene teardown must not
  // dispose their shared GPU buffers, materials or texture maps.
  markSharedAssetResources(scene);
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
        const runtimeClips = (gltf.animations ?? []).length > 0 ? gltf.animations : createStaticCharacterClips(scene, entry.category);
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
          animations: runtimeClips,
          animationSource: (gltf.animations ?? []).length > 0 ? 'glb' : runtimeClips.length > 0 ? 'runtime-procedural' : 'none',
          loadedAt: performance.now(),
        };
        this.setStatus(entry.id, rec);
        console.info(`[AssetManager] GLB بارگذاری شد: ${entry.id} (${entry.file}) — ${rec.animations.length} کلیپ (GLB/پروسیجرال)`);
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
