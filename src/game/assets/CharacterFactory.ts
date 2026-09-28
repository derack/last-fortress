import * as THREE from 'three';
import type { EnemyData } from '../data/types';
import { findAssetEntry, type CharacterAssetEntry } from './AssetManifest';
import { assetManager } from './AssetManager';
import { normalizeModel } from './ModelNormalizer';
import { CharacterAnimationController } from './CharacterAnimationController';
import { ProceduralAnimationController } from './ProceduralAnimationController';
import { createFallbackHero, createFallbackEnemy, createTowerFallback, disposeFallback } from './FallbackFactory';

// ============================================================
// CharacterFactory — لایه اتصال Rendering به Gameplay
// ------------------------------------------------------------
// الگو: «Handle پایدار + Swap-in ناهمزمان»
//   ۱) بلافاصله یک Handle با Placeholder شفاف برمی‌گردد
//      (سازنده‌های Entity همگام و Gameplay دست‌نخورده می‌ماند)
//   ۲) به‌موازات GLB درخواست می‌شود؛ آماده شد محتوای root
//      درجا با مدل واقعی + AnimationMixer جایگزین می‌شود.
//   ۳) Object Pool فقط برای Handleهای GLB (منابع مشترک،
//      reuse ارزان). Placeholderها disposable هستند و Pool
//      نمی‌شوند تا هیچ حافظه‌ای نشت نکند.
//
// Gameplay چیزی از این تغییرات نمی‌بیند: root همان THREE.Group
// قدیمی است (position/rotation/userData.selectable/shieldAura).
// ============================================================

export type HandleSource = 'glb' | 'fallback';

/**
 * کنترلر انیمیشن — دو پیاده‌سازی با API یکسان:
 *   • CharacterAnimationController — کلیپ‌های اسکلتی GLB (AnimationMixer)
 *   • ProceduralAnimationController — حرکت بدنه‌صلب برای GLBهای بدون اسکلت
 * Gameplay با هر دو یکسان کار می‌کند (playLocomotion/playOneShot/playDeath/update).
 */
export type AnyAnimationController = CharacterAnimationController | ProceduralAnimationController;

/** کلیدهای userData سازنده برج که باید به ریشه Handle منتقل شوند */
const TOWER_UDATA_KEYS = ['turret', 'spinCrystal', 'spinRing', 'ember'] as const;

/** انتقال userData سازنده برج از گروه داخلی به ریشه (Gameplay به این کلیدها تکیه دارد) */
function propagateTowerUdata(from: THREE.Object3D, to: THREE.Object3D) {
  for (const k of TOWER_UDATA_KEYS) {
    if (from.userData[k] !== undefined) to.userData[k] = from.userData[k];
  }
}

/** جستجوی گره برج داخل مدل GLB با نام فازی و انتقال به ریشه */
function propagateTowerUdataFromGlb(model: THREE.Object3D, root: THREE.Object3D) {
  for (const k of TOWER_UDATA_KEYS) {
    const nk = k.toLowerCase();
    model.traverse((o) => {
      const n = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === nk && root.userData[k] === undefined) root.userData[k] = o;
    });
  }
}

export interface VFXPointAccessor {
  /** گره نقطه VFX — یا null */
  (name: string): THREE.Object3D | null;
}

export class CharacterHandle {
  /** ریشه بیرونی — Gameplay فقط با این کار می‌کند (حرکت/چرخش/انتخاب) */
  readonly root: THREE.Group;
  readonly assetId: string;
  source: HandleSource = 'fallback';
  /** آیا مدل واقعی GLB سوار شده؟ */
  ready = false;
  animation: AnyAnimationController | null = null;
  /** انیمیشن پروسیجرال Placeholder (animParts قدیمی) — با GLB باطل می‌شود */
  proceduralAnimParts: { node: THREE.Object3D; kind: string }[] = [];

  private vfxPoints = new Map<string, THREE.Object3D>();
  private swapCbs = new Set<() => void>();
  /** گره‌های LOD مدل واقعی — برای سوییچ فاصله‌ای (بخش ۱۶) */
  private lodNodes: { node: THREE.Object3D; level: 1 | 2 }[] = [];
  /** گره‌های مدل پایه (خارج از سلسله‌مراتب LOD) */
  private lodBase: THREE.Object3D[] = [];
  disposed = false;
  private pooled = false;
  /** کلید Pool (assetId|tier) — هنگام acquire تنظیم می‌شود */
  _poolKey: string | null = null;

  constructor(assetId: string, root: THREE.Group) {
    this.assetId = assetId;
    this.root = root;
  }

  get hasAnimations(): boolean {
    return this.animation?.hasAnimations ?? false;
  }

  /** گره نقطه VFX — weapon / muzzle / mouth / staff / head / chest / hit (تطبیق فازی با پسوند Point) */
  vfx(name: string): THREE.Object3D | null {
    const k = name.toLowerCase();
    return this.vfxPoints.get(k) ?? this.vfxPoints.get(`${k}point`) ?? null;
  }

  /** موقعیت جهانی نقطه VFX — اگر نبود null */
  vfxWorld(name: string, out: THREE.Vector3): THREE.Vector3 | null {
    const o = this.vfx(name);
    if (!o) return null;
    return o.getWorldPosition(out);
  }

  /** ثبت callback — بعد از سوار شدن GLB صدا می‌خورد */
  onSwap(cb: () => void): () => void {
    this.swapCbs.add(cb);
    if (this.ready) cb();
    return () => this.swapCbs.delete(cb);
  }

  /**
   * بروزرسانی LOD بر اساس فاصله دوربین (بخش ۱۶) — هر فریم از حلقه Gameplay صدا می‌خورد.
   * ساختار مورد انتظار GLB: مدل پایه + نسخه‌های جایگزین کامل *LOD1/*LOD2
   *   d < ۲۲ → مدل کامل | ۲۲..۳۸ → LOD1 | d ≥ ۳۸ → LOD2
   * برای Placeholderها بدون گره LOD هیچ‌کاری نمی‌کند (هزینه صفر).
   */
  updateLod(camPos: THREE.Vector3) {
    if (this.lodNodes.length === 0) return;
    const d = camPos.distanceTo(this.root.position);
    const base = d < 22;
    const mid = d >= 22 && d < 38;
    for (const n of this.lodBase) n.visible = base;
    for (const { node, level } of this.lodNodes) {
      node.visible = level === 1 ? mid : d >= 38;
    }
  }

  /** تنظیم نقاط VFX اولیه (Placeholder) */
  _setInitialVfx(points: Record<string, THREE.Object3D>, animParts: { node: THREE.Object3D; kind: string }[]) {
    for (const [k, o] of Object.entries(points)) this.vfxPoints.set(k, o);
    this.proceduralAnimParts = animParts;
  }

  /** سوار کردن مدل واقعی — محتوای root جایگزین می‌شود، خود root ثابت می‌ماند */
  _swapIn(entry: CharacterAssetEntry, model: THREE.Group, clips: THREE.AnimationClip[], heightScale: number, keepNodes: THREE.Object3D[] = []) {
    if (this.disposed || this.ready) return;

    // ۱) تخلیه Placeholder از root + آزادسازی منابع اختصاصی‌اش
    const oldChildren = [...this.root.children];
    this.root.clear();
    for (const c of oldChildren) {
      if (keepNodes.includes(c)) continue;
      if (c.userData?.isGlbClone) continue;
      disposeFallback(c);
    }

    // ۲) نرمال‌سازی و سوار کردن
    const norm = normalizeModel(model, entry, heightScale);
    this.root.add(norm.inner);
    for (const node of keepNodes) this.root.add(node);

    // ۳) فراداده
    this.root.userData.characterSource = 'glb';
    this.root.userData.assetId = entry.id;
    this.root.userData.placeholder = false;
    this.root.userData.targetHeight = entry.targetHeight * heightScale;
    this.root.userData.selectable = true;
    this.root.traverse((o) => {
      o.userData.selectable = true;
    });
    if (entry.category === 'towers') propagateTowerUdataFromGlb(model, this.root);

    // ۴) انیمیشن و VFX واقعی
    //    GLB انیمیشن‌دار → میکسر اسکلتی | GLB استاتیک → حرکت پروسیجرال بدنه‌صلب
    this.animation = clips.length > 0
      ? new CharacterAnimationController(this.root, clips)
      : new ProceduralAnimationController(norm.inner, norm.height);
    this.proceduralAnimParts = [];
    this.vfxPoints.clear();
    for (const [k, o] of Object.entries(norm.vfx)) this.vfxPoints.set(k, o);
    // گره‌های LOD مدل واقعی — تفکیک مدل پایه از نسخه‌های LOD
    this.lodNodes = norm.lodNodes;
    if (this.lodNodes.length > 0) {
      const isAncestorOfLod = (n: THREE.Object3D) =>
        this.lodNodes.some(({ node }) => {
          let p: THREE.Object3D | null = node;
          while (p) {
            if (p === n) return true;
            p = p.parent;
          }
          return false;
        });
      this.lodBase = norm.inner.children.filter((c) => !isAncestorOfLod(c));
    } else {
      this.lodBase = [];
    }

    this.source = 'glb';
    this.ready = true;
    // گره سپر بعد از تعویض مدل هم باید وجود داشته باشد (Gameplay به نامش تکیه دارد)
    ensureShieldAura(this.root);
    for (const cb of this.swapCbs) cb();
  }

  /** علامت‌گذاری برای Pool — release بعدی نابودش نمی‌کند */
  _markPooled() {
    this.pooled = true;
  }

  /** نابودی کامل — فقط برای Handleهای غیر Pool‌شده و Placeholderها */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.animation?.dispose();
    this.animation = null;
    if (!this.pooled && !this.ready) {
      // Placeholder — منابع پروسیجرال اختصاصی دارد
      for (const c of [...this.root.children]) disposeFallback(c);
    }
    // برای GLB clones: هندسه/متریال مشترک با Cache است — هرگز dispose نمی‌شود
    this.root.clear();
    this.vfxPoints.clear();
    this.swapCbs.clear();
  }
}

// ============================================================
// Object Pool — استفاده مجدد Handleهای GLB (بخش ۱۳)
// ============================================================

const POOL_CAP = 24; // بیشینه نگهداری هر کلید

export class CharacterFactory {
  private pool = new Map<string, CharacterHandle[]>();
  private tmpVec = new THREE.Vector3();

  // ------------------------- قهرمان -------------------------

  createHeroHandle(heroId = 'arman'): CharacterHandle {
    const entry = findAssetEntry(heroId) ?? findAssetEntry('arman')!;
    const fb = createFallbackHero(entry.id);

    const root = new THREE.Group();
    root.name = `hero_${entry.id}`;
    root.add(fb.group);
    root.userData.characterSource = 'procedural-placeholder';
    root.userData.selectable = true;

    const handle = new CharacterHandle(entry.id, root);
    // نقطه سلاح Placeholder — در فضای ریشه (تفنگ انتهای لوله در z≈1.3)
    const weapon = new THREE.Object3D();
    weapon.name = 'synthetic_weaponpoint';
    weapon.position.copy(fb.weaponPointLocal ?? new THREE.Vector3(0.42, 1.05, 1.0));
    root.add(weapon);
    handle._setInitialVfx(
      {
        weaponpoint: weapon,
        muzzlepoint: weapon,
        chestpoint: dummyAt(root, 'synthetic_chestpoint', 0, 1.15, 0),
        headpoint: dummyAt(root, 'synthetic_headpoint', 0, 1.62, 0),
        hitpoint: dummyAt(root, 'synthetic_hitpoint', 0, 1.0, 0),
      },
      fb.animParts
    );

    void this.requestSwap(handle, entry, 1);
    return handle;
  }

  // ------------------------- دشمن / Boss -------------------------

  /** گرفتن Handle دشمن — ابتدا از Pool (فقط GLB) */
  acquireEnemyHandle(data: EnemyData, tier: number): CharacterHandle {
    const entry = findAssetEntry(data.id) ?? findAssetEntry('shadow')!;
    const key = `${entry.id}|${tier}`;

    // ۱) Pool — فقط Handleهای GLB آماده
    const bucket = this.pool.get(key);
    if (bucket && bucket.length > 0) {
      const handle = bucket.pop()!;
      handle.root.visible = true;
      handle.animation?.reset();
      // سپر جادوگر — اگر گره نداشت بساز
      ensureShieldAura(handle.root);
      return handle;
    }

    // ۲) ساخت جدید — Placeholder شفاف بلافاصله
    const fb = createFallbackEnemy(data, tier);
    const root = new THREE.Group();
    root.name = `enemy_${entry.id}_t${tier}`;
    root.add(fb.group);
    root.userData.characterSource = 'procedural-placeholder';
    root.userData.selectable = true;

    const handle = new CharacterHandle(entry.id, root);
    handle._setInitialVfx(
      {
        chestpoint: dummyAt(root, 'synthetic_chestpoint', 0, 1.1, 0.2),
        headpoint: dummyAt(root, 'synthetic_headpoint', 0, 1.5, 0),
        hitpoint: dummyAt(root, 'synthetic_hitpoint', 0, 1.0, 0),
      },
      fb.animParts
    );
    ensureShieldAura(root);

    // ضریب ارتفاع = scale داده × ضریب Tier (همان فرمول tiered)
    const heightScale = data.scale * (1 + 0.08 * (tier - 1));
    handle._poolKey = key;
    void this.requestSwap(handle, entry, heightScale);
    return handle;
  }

  /** پس دادن Handle به Pool یا نابودی */
  releaseEnemyHandle(handle: CharacterHandle) {
    if (handle.root.parent) handle.root.parent.remove(handle.root);
    if (handle.disposed) return;

    if (handle.ready && handle.source === 'glb') {
      // ریست کامل برای reuse
      handle.root.rotation.set(0, 0, 0);
      handle.root.position.set(0, 0, 0);
      handle.root.visible = false;
      const aura = handle.root.getObjectByName('shieldAura');
      if (aura) (aura as THREE.Mesh).visible = false;
      handle.animation?.stopAll();

      const key = handle._poolKey ?? handle.assetId;
      const bucket = this.pool.get(key) ?? [];
      if (bucket.length < POOL_CAP) {
        handle._markPooled();
        bucket.push(handle);
        this.pool.set(key, bucket);
      } else {
        handle.dispose();
      }
    } else {
      // Placeholder — نابودی کامل
      handle.dispose();
    }
  }

  /** خالی کردن Pool — هنگام dispose بازی */
  clearPools() {
    for (const bucket of this.pool.values()) {
      for (const h of bucket) {
        h._markPooled();
        h.dispose();
      }
    }
    this.pool.clear();
  }

  poolStats(): { key: string; size: number }[] {
    return [...this.pool.entries()].map(([key, b]) => ({ key, size: b.length }));
  }

  // ------------------------- برج (GLB اختیاری) -------------------------

  createTowerHandle(towerId: string, level: number): CharacterHandle {
    const entry = findAssetEntry(towerId) ?? findAssetEntry('sentinel')!;
    const fb = createTowerFallback(towerId, level);

    const root = new THREE.Group();
    root.name = `tower_${entry.id}_l${level}`;
    root.add(fb.group);
    root.userData.characterSource = 'procedural';
    root.userData.selectable = true;
    propagateTowerUdata(fb.group, root);

    const handle = new CharacterHandle(entry.id, root);
    // نقاط پایه — ارتفاع واقعی برج پروسیجرال حفظ می‌شود
    const towerTop = entry.targetHeight * 0.78;
    const muzzle = dummyAt(root, 'synthetic_muzzlepoint', 0, towerTop, 1.1);
    handle._setInitialVfx(
      {
        muzzlepoint: muzzle,
        chestpoint: dummyAt(root, 'synthetic_chestpoint', 0, towerTop * 0.7, 0),
      },
      []
    );

    void this.requestSwap(handle, entry, 1);
    return handle;
  }

  // ------------------------- Swap-in ناهمزمان -------------------------

  private async requestSwap(handle: CharacterHandle, entry: CharacterAssetEntry, heightScale: number) {
    const rec = await assetManager.load(entry);
    if (rec.status !== 'ready') return; // Placeholder می‌ماند — گزارش در Console ثبت شده
    const inst = assetManager.instantiate(entry);
    if (!inst) return;
    if (handle.disposed) {
      // کلون بلااستفاده — فقط از صحنه خارج (منابع مشترک است)
      inst.scene.clear();
      return;
    }
    handle._swapIn(entry, inst.scene, inst.animations, heightScale);
  }

  /** موقعیت جهانی سلاح برای شلیک — Fallback: موقعیت محاسبه‌شده قدیمی */
  weaponTip(handle: CharacterHandle, fallback: THREE.Vector3): THREE.Vector3 {
    return handle.vfxWorld('weapon', this.tmpVec) ?? handle.vfxWorld('muzzle', this.tmpVec) ?? fallback;
  }
}

function dummyAt(parent: THREE.Object3D, name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/** سپر جادوگر — گره shieldAura همیشه باید وجود داشته باشد (Gameplay به نامش تکیه دارد) */
function ensureShieldAura(root: THREE.Group) {
  if (root.getObjectByName('shieldAura')) return;
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  shield.position.y = 1;
  shield.visible = false;
  shield.name = 'shieldAura';
  root.add(shield);
}

/** Singleton سراسری */
export const characterFactory = new CharacterFactory();
