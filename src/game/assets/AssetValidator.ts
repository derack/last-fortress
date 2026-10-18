import * as THREE from 'three';
import type { CharacterAssetEntry } from './AssetManifest';
import { assetManager } from './AssetManager';
import { normalizeModel } from './ModelNormalizer';
import { ASSET_SPECS } from './AssetSpecifications';
import { characterFactory } from './CharacterFactory';

// ============================================================
// AssetValidator — اعتبارسنجی Development Mode (بخش ۲۶)
// ------------------------------------------------------------
// برای هر Asset بررسی می‌کند:
//   ✓ فایل GLB موجود و Load می‌شود
//   ✓ Material وجود دارد
//   ✓ Skeleton (SkinnedMesh) وجود دارد
//   ✓ انیمیشن‌های مورد انتظار موجودند
//   ✓ Bounding Box معتبر
//   ✓ Scale (ارتفاع نرمال‌شده ≈ هدف)
//   ✓ Orientation (rotationOffset اعمال شده)
//   ✓ نقاط VFX موجودند
// خروجی: گزارش ساخت‌یافته برای Asset Validation Panel
// ============================================================

export interface ValidationCheck {
  id: string;
  label: string;
  pass: boolean;
  /** warn = نیم‌موفق (مثل انیمیشن ناقص) */
  level: 'pass' | 'warn' | 'fail';
  detail?: string;
}

export interface AssetValidationReport {
  entryId: string;
  file: string;
  status: 'ready' | 'missing' | 'error' | 'loading';
  ok: boolean;
  checks: ValidationCheck[];
  /** تعداد مثلث مدل (تخمینی) */
  tris?: number;
  /** Clip names available at runtime (GLB-authored or generated rigid-part clips). */
  actualAnimations?: string[];
  animationSource?: 'glb' | 'runtime-procedural' | 'none';
  /** نقاط VFX مدل واقعی */
  modelVfx?: string[];
  syntheticVfx?: string[];
}

function trisCount(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry) {
      const pos = o.geometry.getAttribute('position');
      if (pos) tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
    }
  });
  return Math.round(tris);
}

function hasSkeleton(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) found = true;
  });
  return found;
}

function hasMaterial(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material) found = true;
  });
  return found;
}

export async function validateAsset(entry: CharacterAssetEntry): Promise<AssetValidationReport> {
  const checks: ValidationCheck[] = [];
  const rec = await assetManager.load(entry);

  const base: AssetValidationReport = {
    entryId: entry.id,
    file: entry.file,
    status: rec.status === 'ready' ? 'ready' : rec.status === 'pending' ? 'loading' : rec.status,
    ok: false,
    checks,
    animationSource: rec.animationSource,
  };

  // ---- فایل ----
  checks.push({
    id: 'file',
    label: 'فایل GLB موجود و قابل بارگذاری',
    pass: rec.status === 'ready',
    level: rec.status === 'ready' ? 'pass' : 'fail',
    detail: rec.status === 'ready' ? entry.file : rec.status === 'missing' ? 'فایل یافت نشد — Placeholder موقت فعال است' : rec.error,
  });

  if (rec.status !== 'ready' || !rec.source) {
    return { ...base, ok: false };
  }

  const source = rec.source;

  // ---- Material ----
  const mats = hasMaterial(source);
  checks.push({
    id: 'materials',
    label: 'Material (PBR) وجود دارد',
    pass: mats,
    level: mats ? 'pass' : 'fail',
    detail: mats ? undefined : 'هیچ Mesh متریال‌دار پیدا نشد',
  });

  // ---- Skeleton ----
  const skel = hasSkeleton(source);
  checks.push({
    id: 'skeleton',
    label: 'Skeleton / SkinnedMesh',
    pass: skel,
    level: skel ? 'pass' : 'warn',
    detail: skel ? 'Rig موجود است' : 'SkinnedMesh یافت نشد — مدل استاتیک است (انیمیشن اسکلتی کار نمی‌کند)',
  });

  // ---- Bounding Box ----
  source.updateWorldMatrix(true, true);
  const bbox = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const bboxOk = Number.isFinite(size.y) && size.y > 0.01;
  checks.push({
    id: 'bounds',
    label: 'Bounding Box معتبر',
    pass: bboxOk,
    level: bboxOk ? 'pass' : 'fail',
    detail: bboxOk ? `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}` : 'ابعاد صفر یا NaN',
  });

  // ---- نرمال‌سازی و Scale ----
  let modelVfx: string[] = [];
  let syntheticVfx: string[] = [];
  let actualAnimations: string[] = rec.animations.map((c) => c.name);

  if (bboxOk) {
    const probe = source.clone(true);
    const norm = normalizeModel(probe, entry, 1);
    const target = entry.targetHeight;
    const h = norm.height;
    const scaleOk = Math.abs(h - target) / target < 0.25;
    checks.push({
      id: 'scale',
      label: 'Scale نرمال‌شده',
      pass: scaleOk,
      level: scaleOk ? 'pass' : 'warn',
      detail: `ارتفاع مدل: ${h.toFixed(2)} → هدف: ${target.toFixed(2)} واحد (ضریب ${norm.appliedScale.toFixed(2)}×)`,
    });

    checks.push({
      id: 'orientation',
      label: 'جهت Forward (+Z)',
      pass: true,
      level: entry.rotationOffsetDeg === 0 ? 'pass' : 'warn',
      detail: entry.rotationOffsetDeg === 0 ? 'استاندارد +Z — بدون چرخش' : `چرخش جبرانی ${entry.rotationOffsetDeg}° اعمال شد`,
    });

    for (const [k, src] of Object.entries(norm.vfxSource)) {
      if (src === 'model') modelVfx.push(k);
      else syntheticVfx.push(k);
    }
  }

  const tris = trisCount(source);

  // ---- انیمیشن‌ها ----
  const spec = ASSET_SPECS[entry.specId];
  const expectedAnims = entry.animations;
  const foundAnims = rec.animations.map((c) => c.name);
  const missingAnims = expectedAnims.filter((e) => {
    const ne = e.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !foundAnims.some((f) => {
      const nf = f.toLowerCase().replace(/[^a-z0-9]/g, '');
      return nf === ne || nf.includes(ne) || ne.includes(nf);
    });
  });

  if (expectedAnims.length === 0) {
    checks.push({
      id: 'animations',
      label: 'انیمیشن',
      pass: true,
      level: 'pass',
      detail: 'برج — انیمیشن لازم ندارد',
    });
  } else if (foundAnims.length === 0) {
    checks.push({
      id: 'animations',
      label: 'انیمیشن‌های مورد انتظار',
      pass: false,
      level: 'fail',
      detail: `هیچ انیمیشنی نیست — لازم: ${expectedAnims.join(', ')}`,
    });
  } else if (rec.animationSource === 'runtime-procedural') {
    checks.push({
      id: 'animations',
      label: 'انیمیشن‌های runtime (بدون rig اسکلتی)',
      pass: false,
      level: 'warn',
      detail: `کلیپ‌های rigid-part در زمان اجرا ساخته می‌شوند؛ ${foundAnims.length} کلیپ موجود است. این مورد جایگزین rig و انیمیشن authored نیست.${missingAnims.length ? ` کمبود نام: ${missingAnims.join(', ')}` : ''}`,
    });
  } else {
    checks.push({
      id: 'animations',
      label: 'انیمیشن‌های مورد انتظار',
      pass: missingAnims.length === 0,
      level: missingAnims.length === 0 ? 'pass' : 'warn',
      detail: `${foundAnims.length} یافت شد${missingAnims.length ? ` — کمبود: ${missingAnims.join(', ')}` : ''}`,
    });
  }

  // ---- نقاط VFX ----
  const expectedPoints = entry.vfxPoints;
  const pointsOk = modelVfx.length > 0 || expectedPoints.length === 0;
  checks.push({
    id: 'vfx',
    label: 'نقاط VFX',
    pass: pointsOk,
    level: modelVfx.length >= expectedPoints.length ? 'pass' : pointsOk ? 'warn' : 'fail',
    detail:
      modelVfx.length || syntheticVfx.length
        ? `${modelVfx.length} از مدل، ${syntheticVfx.length} سینتتیک (جبران‌شده)`
        : 'هیچ نقطه‌ای یافت نشد',
  });

  // ---- بودجه موبایل ----
  if (spec) {
    const budgetOk = tris <= spec.polyBudgetTris * 1.5;
    checks.push({
      id: 'budget',
      label: 'بودجه مثلث موبایل',
      pass: budgetOk,
      level: budgetOk ? 'pass' : 'warn',
      detail: `${tris.toLocaleString('en-US')} / ${spec.polyBudgetTris.toLocaleString('en-US')} مثلث`,
    });
  }

  const hardFail = checks.some((c) => c.level === 'fail');
  return { ...base, ok: !hardFail, tris, actualAnimations, modelVfx, syntheticVfx };
}
