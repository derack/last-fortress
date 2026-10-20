import type { SaveData, TowerData } from './types';

// ============================================================
// تعریف برج‌ها — کاملاً Data-Driven
// هر برج ۵ سطح دارد؛ در سطح ۵ Transformation رخ می‌دهد
// ------------------------------------------------------------
// باز شدن تدریجی: هر برج پس از رسیدن به آستانه ستاره‌های کمپین آزاد می‌شود
// آستانه‌ها با فاصله‌ی بیشتر تنظیم شده‌اند تا انتخاب برج‌ها مرحله‌به‌مرحله باز شود
// ============================================================

export const TOWERS: Record<string, TowerData> = {
  sentinel: {
    id: 'sentinel',
    nameKey: 'towerSentinel',
    descKey: 'towerSentinelDesc',
    abilityNameKey: 'towerSentinelAbility',
    abilityDescKey: 'towerSentinelAbilityDesc',
    abilityCooldown: 22,
    cost: 100,
    damageType: 'physical',
    canHitAir: true,
    projectile: 'bullet',
    color: 0xffb020,
    unlockStars: 0, // نگهبان — از ابتدا باز
    levels: [
      { damage: 14, range: 9, fireRate: 2.2, upgradeCost: 75 },
      { damage: 20, range: 10, fireRate: 2.5, upgradeCost: 110 },
      { damage: 28, range: 11, fireRate: 2.9, upgradeCost: 155 },
      { damage: 40, range: 12, fireRate: 3.3, upgradeCost: 220 },
      { damage: 60, range: 13.5, fireRate: 3.8, upgradeCost: 0 },
    ],
  },
  lightning: {
    id: 'lightning',
    nameKey: 'towerLightning',
    descKey: 'towerLightningDesc',
    abilityNameKey: 'towerLightningAbility',
    abilityDescKey: 'towerLightningAbilityDesc',
    abilityCooldown: 25,
    cost: 150,
    damageType: 'energy',
    canHitAir: true,
    projectile: 'none', // زنجیره لحظه‌ای
    chainCount: 2,
    color: 0x8b5cf6,
    unlockStars: 30,
    levels: [
      { damage: 26, range: 10, fireRate: 0.9, upgradeCost: 115 },
      { damage: 36, range: 10.5, fireRate: 1.0, upgradeCost: 160 },
      { damage: 50, range: 11.5, fireRate: 1.1, upgradeCost: 225 },
      { damage: 70, range: 12.5, fireRate: 1.2, upgradeCost: 310 },
      { damage: 100, range: 14, fireRate: 1.35, upgradeCost: 0 },
    ],
  },
  fire: {
    id: 'fire',
    nameKey: 'towerFire',
    descKey: 'towerFireDesc',
    abilityNameKey: 'towerFireAbility',
    abilityDescKey: 'towerFireAbilityDesc',
    abilityCooldown: 30,
    cost: 130,
    damageType: 'fire',
    canHitAir: false,
    projectile: 'fireball',
    splashRadius: 2.8,
    burnDps: 6,
    color: 0xf97316,
    unlockStars: 18,
    levels: [
      { damage: 30, range: 8.5, fireRate: 0.8, upgradeCost: 100 },
      { damage: 42, range: 9, fireRate: 0.85, upgradeCost: 145 },
      { damage: 58, range: 10, fireRate: 0.9, upgradeCost: 200 },
      { damage: 80, range: 11, fireRate: 1.0, upgradeCost: 280 },
      { damage: 115, range: 12, fireRate: 1.1, upgradeCost: 0 },
    ],
  },
  ice: {
    id: 'ice',
    nameKey: 'towerIce',
    descKey: 'towerIceDesc',
    abilityNameKey: 'towerIceAbility',
    abilityDescKey: 'towerIceAbilityDesc',
    abilityCooldown: 32,
    cost: 90,
    damageType: 'ice',
    canHitAir: true,
    projectile: 'frost',
    slowFactor: 0.55,
    slowDuration: 2.0,
    color: 0x22d3ee,
    unlockStars: 9,
    levels: [
      { damage: 8, range: 8, fireRate: 1.4, upgradeCost: 70 },
      { damage: 12, range: 8.5, fireRate: 1.5, upgradeCost: 100 },
      { damage: 17, range: 9.5, fireRate: 1.6, upgradeCost: 140 },
      { damage: 24, range: 10.5, fireRate: 1.8, upgradeCost: 195 },
      { damage: 34, range: 12, fireRate: 2.0, upgradeCost: 0 },
    ],
  },
  cannon: {
    id: 'cannon',
    nameKey: 'towerCannon',
    descKey: 'towerCannonDesc',
    abilityNameKey: 'towerCannonAbility',
    abilityDescKey: 'towerCannonAbilityDesc',
    abilityCooldown: 28,
    cost: 160,
    damageType: 'physical',
    canHitAir: false,
    projectile: 'cannonball',
    splashRadius: 3.4,
    towerHeight: 2.6,
    color: 0xf59e0b,
    unlockStars: 45,
    levels: [
      { damage: 46, range: 7.5, fireRate: 0.5, upgradeCost: 130 },
      { damage: 64, range: 8, fireRate: 0.55, upgradeCost: 185 },
      { damage: 88, range: 8.5, fireRate: 0.6, upgradeCost: 260 },
      { damage: 122, range: 9, fireRate: 0.66, upgradeCost: 360 },
      { damage: 175, range: 10, fireRate: 0.72, upgradeCost: 0 },
    ],
  },
  poison: {
    id: 'poison',
    nameKey: 'towerPoison',
    descKey: 'towerPoisonDesc',
    abilityNameKey: 'towerPoisonAbility',
    abilityDescKey: 'towerPoisonAbilityDesc',
    abilityCooldown: 26,
    cost: 120,
    damageType: 'shadow',
    canHitAir: false,
    projectile: 'venom',
    poisonDps: 14,
    poisonDuration: 4,
    armorShred: 2,
    towerHeight: 2.5,
    color: 0x84cc16,
    unlockStars: 62,
    levels: [
      { damage: 10, range: 8.5, fireRate: 1.1, upgradeCost: 95 },
      { damage: 14, range: 9, fireRate: 1.2, upgradeCost: 135 },
      { damage: 20, range: 10, fireRate: 1.3, upgradeCost: 190 },
      { damage: 28, range: 11, fireRate: 1.4, upgradeCost: 265 },
      { damage: 40, range: 12, fireRate: 1.55, upgradeCost: 0 },
    ],
  },
  ballista: {
    id: 'ballista',
    nameKey: 'towerBallista',
    descKey: 'towerBallistaDesc',
    abilityNameKey: 'towerBallistaAbility',
    abilityDescKey: 'towerBallistaAbilityDesc',
    abilityCooldown: 30,
    cost: 180,
    damageType: 'physical',
    canHitAir: true,
    projectile: 'bolt',
    pierceArmor: true,
    towerHeight: 3.0,
    color: 0xd97706,
    unlockStars: 105,
    levels: [
      { damage: 70, range: 14, fireRate: 0.45, upgradeCost: 145 },
      { damage: 98, range: 15, fireRate: 0.5, upgradeCost: 205 },
      { damage: 135, range: 16, fireRate: 0.55, upgradeCost: 290 },
      { damage: 185, range: 17.5, fireRate: 0.62, upgradeCost: 400 },
      { damage: 265, range: 19, fireRate: 0.7, upgradeCost: 0 },
    ],
  },
  arcane: {
    id: 'arcane',
    nameKey: 'towerArcane',
    descKey: 'towerArcaneDesc',
    abilityNameKey: 'towerArcaneAbility',
    abilityDescKey: 'towerArcaneAbilityDesc',
    abilityCooldown: 24,
    cost: 140,
    damageType: 'magic',
    canHitAir: true,
    projectile: 'prism',
    towerHeight: 3.2,
    color: 0x38bdf8,
    unlockStars: 82,
    levels: [
      { damage: 34, range: 9.5, fireRate: 1.0, upgradeCost: 110 },
      { damage: 48, range: 10, fireRate: 1.1, upgradeCost: 155 },
      { damage: 66, range: 11, fireRate: 1.2, upgradeCost: 220 },
      { damage: 92, range: 12, fireRate: 1.3, upgradeCost: 305 },
      { damage: 132, range: 13, fireRate: 1.45, upgradeCost: 0 },
    ],
  },
  temple: {
    id: 'temple',
    nameKey: 'towerTemple',
    descKey: 'towerTempleDesc',
    abilityNameKey: 'towerTempleAbility',
    abilityDescKey: 'towerTempleAbilityDesc',
    abilityCooldown: 36,
    cost: 170,
    damageType: 'energy',
    canHitAir: true,
    projectile: 'hex',
    buffRadius: 7,
    buffRatePct: 0.25,
    towerHeight: 3.0,
    color: 0xfbbf24,
    unlockStars: 132,
    levels: [
      { damage: 18, range: 9, fireRate: 1.2, upgradeCost: 130 },
      { damage: 26, range: 9.5, fireRate: 1.3, upgradeCost: 185 },
      { damage: 36, range: 10.5, fireRate: 1.4, upgradeCost: 260 },
      { damage: 50, range: 11.5, fireRate: 1.5, upgradeCost: 360 },
      { damage: 72, range: 13, fireRate: 1.65, upgradeCost: 0 },
    ],
  },
  void: {
    id: 'void',
    nameKey: 'towerVoid',
    descKey: 'towerVoidDesc',
    abilityNameKey: 'towerVoidAbility',
    abilityDescKey: 'towerVoidAbilityDesc',
    abilityCooldown: 34,
    cost: 200,
    damageType: 'shadow',
    canHitAir: true,
    projectile: 'hex',
    executeThreshold: 0.35,
    executeMultiplier: 2.2,
    towerHeight: 3.4,
    color: 0x8b5cf6,
    unlockStars: 165,
    levels: [
      { damage: 40, range: 9, fireRate: 0.9, upgradeCost: 155 },
      { damage: 56, range: 9.5, fireRate: 0.95, upgradeCost: 220 },
      { damage: 78, range: 10.5, fireRate: 1.0, upgradeCost: 310 },
      { damage: 108, range: 11.5, fireRate: 1.1, upgradeCost: 430 },
      { damage: 155, range: 13, fireRate: 1.2, upgradeCost: 0 },
    ],
  },
};

export const TOWER_BUILD_ORDER = [
  'sentinel', 'ice', 'fire', 'lightning', 'cannon', 'poison', 'arcane', 'ballista', 'temple', 'void',
];

/** ضریب فاصله زنجیره صاعقه و افت آسیب هر پرش */
export const CHAIN_JUMP_RADIUS = 8;
export const CHAIN_FALLOFF = 0.72;

// ============================================================
// باز شدن تدریجی برج‌ها — بر اساس مجموع ستاره‌های کمپین
// ============================================================

/** مجموع ستاره‌های به‌دست‌آمده در کل کمپین */
export function totalStars(save: SaveData): number {
  return Object.values(save.levels).reduce((sum, r) => sum + (r.stars ?? 0), 0);
}

/** آیا برج برای این ذخیره باز است؟ */
export function isTowerUnlocked(save: SaveData | null, towerId: string): boolean {
  const tw = TOWERS[towerId];
  if (!tw) return false;
  if (!save) return (tw.unlockStars ?? 0) === 0;
  return totalStars(save) >= (tw.unlockStars ?? 0);
}

/** ستاره‌های باقی‌مانده تا آزادسازی برج (۰ = باز) */
export function starsUntilTower(save: SaveData | null, towerId: string): number {
  const tw = TOWERS[towerId];
  if (!tw) return 0;
  const need = tw.unlockStars ?? 0;
  if (!save) return need;
  return Math.max(0, need - totalStars(save));
}
