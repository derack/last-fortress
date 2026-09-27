import * as THREE from 'three';
import type { CharacterAssetEntry } from './AssetManifest';

// ============================================================
// ModelNormalizer — نرمال‌سازی Scale و جهت + استخراج نقاط VFX
// ------------------------------------------------------------
// GLBهای مختلف Scale و جهت متفاوت دارند. هر مدل با این سیستم
// با ارتفاع استاندارد و جهت +Z وارد World می‌شود (بخش ۱۸ و ۱۹).
//
// ساختار خروجی:
//   inner (Group — مقیاس نرمال + rotationOffset)
//     └── model clone (GLB)
//   + نقاط VFX: weaponPoint / muzzlePoint / mouthPoint / staffPoint
//               headPoint / chestPoint / hitPoint
//   نقاط موجود در مدل با نام پیدا می‌شوند؛ نبود → نقطه سینتتیک
//   بر اساس Bounding Box ساخته می‌شود تا VFX همیشه کار کند.
// ============================================================

export interface NormalizedModel {
  /** گروه نرمال‌شده — داخل ریشه Handle قرار می‌گیرد */
  inner: THREE.Group;
  /** ارتفاع نهایی به World Unit */
  height: number;
  /** نقاط VFX پیدا‌شده یا سینتتیک */
  vfx: Record<string, THREE.Object3D>;
  /** کدام نقاط از مدل بودند و کدام سینتتیک */
  vfxSource: Record<string, 'model' | 'synthetic'>;
  /** مقیاس اعمال‌شده */
  appliedScale: number;
}

const NAME_ALIASES: Record<string, string[]> = {
  weaponpoint: ['weaponpoint', 'weapon', 'righthand', 'handr', 'swordtip'],
  muzzlepoint: ['muzzlepoint', 'muzzle', 'barreltip', 'guntip'],
  mouthpoint: ['mouthpoint', 'mouth', 'jaw', 'firepoint'],
  staffpoint: ['staffpoint', 'staff', 'stafftip', 'orbofstaff'],
  headpoint: ['headpoint', 'head'],
  chestpoint: ['chestpoint', 'chest', 'core', 'spine02'],
  hitpoint: ['hitpoint', 'hit', 'center'],
};

function norm(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** جستجوی گره VFX داخل مدل بر اساس نام (بدون حساسیت به حالت) */
function findModelPoint(root: THREE.Object3D, point: string): THREE.Object3D | null {
  const aliases = NAME_ALIASES[point.toLowerCase()] ?? [point.toLowerCase()];
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    const nn = norm(o.name);
    if (!nn) return;
    for (const a of aliases) {
      if (nn === a || nn.includes(a)) {
        found = o;
        return;
      }
    }
  });
  return found;
}

/**
 * نرمال‌سازی مدل کاراکتر.
 * @param model کلون GLB
 * @param entry ورودی مانیفست
 * @param heightScale ضریب ارتفاع (scale داده gameplay × ضریب Tier)
 */
export function normalizeModel(model: THREE.Group, entry: CharacterAssetEntry, heightScale = 1): NormalizedModel {
  const inner = new THREE.Group();
  inner.name = 'normalizedModel';

  // --- Bounding Box معتبر ---
  model.updateWorldMatrix(true, true);
  const bbox = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  const valid =
    Number.isFinite(size.y) && size.y > 0.0001 &&
    Number.isFinite(size.x) && size.x > 0 &&
    Number.isFinite(size.z) && size.z > 0;

  let appliedScale = 1;
  let height = entry.targetHeight * heightScale;

  if (valid) {
    const targetH = entry.targetHeight * heightScale;
    appliedScale = targetH / size.y;
    // پاها روی زمین: جابجایی عمودی در فضای محلی مدل
    model.position.y -= bbox.min.y;
    // مرکز‌سازی افقی — pivotهای خارج از مرکز اصلاح می‌شود
    model.position.x -= center.x;
    model.position.z -= center.z;
    inner.scale.setScalar(appliedScale);
    height = size.y * appliedScale;
  } else {
    console.error(`[ModelNormalizer] Bounding Box نامعتبر برای ${entry.id} — بدون نرمال‌سازی رندر می‌شود`);
  }

  // --- جهت Forward (بخش ۱۹) ---
  if (entry.rotationOffsetDeg !== 0) {
    inner.rotation.y = THREE.MathUtils.degToRad(entry.rotationOffsetDeg);
  }

  inner.add(model);

  // --- نقاط VFX (بخش ۲۰) ---
  const vfx: Record<string, THREE.Object3D> = {};
  const vfxSource: Record<string, 'model' | 'synthetic'> = {};

  for (const point of entry.vfxPoints) {
    const key = point.toLowerCase();
    const found = findModelPoint(model, point);
    if (found) {
      vfx[key] = found;
      vfxSource[key] = 'model';
      continue;
    }
    // نقطه سینتتیک بر اساس نسبت ارتفاع — VFX همیشه از محل منطقی خارج می‌شود
    const p = new THREE.Object3D();
    p.name = `synthetic_${key}`;
    const h = valid ? size.y * appliedScale : entry.targetHeight * heightScale;
    switch (key) {
      case 'headpoint':
        p.position.set(0, h * 0.88, 0);
        break;
      case 'chestpoint':
        p.position.set(0, h * 0.58, h * 0.12);
        break;
      case 'hitpoint':
        p.position.set(0, h * 0.5, 0);
        break;
      case 'mouthpoint':
        p.position.set(0, h * 0.78, h * 0.22);
        break;
      case 'weaponpoint':
      case 'muzzlepoint':
      case 'staffpoint':
        p.position.set(h * 0.12, h * 0.6, h * 0.3);
        break;
      default:
        p.position.set(0, h * 0.5, 0);
    }
    inner.add(p);
    vfx[key] = p;
    vfxSource[key] = 'synthetic';
  }

  return { inner, height, vfx, vfxSource, appliedScale };
}

/** اطلاعات VFX برای دیباگ/گالری */
export function describeVfx(n: NormalizedModel): string[] {
  return Object.entries(n.vfx).map(([k, o]) => {
    const src = n.vfxSource[k] === 'model' ? 'مدل' : 'سینتتیک';
    const pos = o.getWorldPosition(new THREE.Vector3());
    return `${k} (${src}) — ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
  });
}
