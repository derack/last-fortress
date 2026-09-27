import * as THREE from 'three';
import { buildHeroMesh, buildEnemyMesh, buildTowerMesh } from '../scene/models';
import type { EnemyData } from '../data/types';

// ============================================================
// FallbackFactory — Placeholder موقت شفاف (بخش ۱۴ مانیفست پروژه)
// ------------------------------------------------------------
// ⚠️ صداقت کامل: این‌ها Asset واقعی نیستند. سازنده‌های پروسیجرال
// فعلی بازی به‌عنوان «Placeholder موقت در انتظار فایل GLB» استفاده
// می‌شوند. در userData هر کدام صریحاً برچسب placeholder خورده و
// در Character Gallery با وضعیت «منتظر GLB» نمایش داده می‌شود.
// به محض قرار گرفتن فایل GLB واقعی، CharacterFactory این
// Placeholder را با مدل واقعی جایگزین می‌کند (swap-in).
// ============================================================

export interface FallbackCharacter {
  group: THREE.Group;
  animParts: { node: THREE.Object3D; kind: string }[];
  /** نقطه سلاح — برای Hero پروسیجرال (rifleTip) */
  weaponPointLocal?: THREE.Vector3;
}

export function createFallbackHero(): FallbackCharacter {
  const g = buildHeroMesh();
  g.userData.placeholder = true;
  g.userData.placeholderReason = 'awaiting arman.glb';
  g.userData.characterSource = 'procedural-placeholder';
  return {
    group: g,
    animParts: (g.userData.animParts as { node: THREE.Object3D; kind: string }[]) ?? [],
    weaponPointLocal: (g.userData.rifleTip as THREE.Vector3 | undefined) ?? new THREE.Vector3(0.42, 1.05, 1.0),
  };
}

export function createFallbackEnemy(data: EnemyData, tier: number): FallbackCharacter {
  const g = buildEnemyMesh(data, tier);
  g.userData.placeholder = true;
  g.userData.placeholderReason = `awaiting ${data.id}.glb`;
  g.userData.characterSource = 'procedural-placeholder';
  return {
    group: g,
    animParts: (g.userData.animParts as { node: THREE.Object3D; kind: string }[]) ?? [],
  };
}

/**
 * برج — Placeholder نیست؛ ساختار فعلی برج‌ها می‌ماند (بخش ۲ فقط
 * Hero/Enemy/Boss را محدود می‌کند). اگر GLB برج موجود باشد Factory
 * جایگزین می‌کند وگرنه همین مدل پروسیجرال نمایش داده می‌شود.
 */
export function createTowerFallback(towerId: string, level: number): FallbackCharacter {
  const g = buildTowerMesh(towerId, level);
  g.userData.characterSource = 'procedural';
  return {
    group: g,
    animParts: [],
  };
}

/** آزادسازی کامل منابع یک Placeholder (هندسه/متریال اختصاصی خودش است) */
export function disposeFallback(fallbackRoot: THREE.Object3D) {
  fallbackRoot.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
    }
  });
}
