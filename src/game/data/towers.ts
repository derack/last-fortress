import type { TowerData } from './types';

// ============================================================
// تعریف برج‌ها — کاملاً Data-Driven
// هر برج ۵ سطح دارد؛ در سطح ۵ Transformation رخ می‌دهد
// ============================================================

export const TOWERS: Record<string, TowerData> = {
  sentinel: {
    id: 'sentinel',
    nameKey: 'towerSentinel',
    descKey: 'towerSentinelDesc',
    abilityNameKey: 'towerSentinelAbility',
    abilityDescKey: 'towerFireAbility',
    abilityCooldown: 22,
    cost: 100,
    damageType: 'physical',
    canHitAir: true,
    projectile: 'bullet',
    color: 0xffb020,
    levels: [
      { damage: 14, range: 9, fireRate: 2.2, upgradeCost: 100 },
      { damage: 20, range: 10, fireRate: 2.5, upgradeCost: 85 },
      { damage: 28, range: 11, fireRate: 2.9, upgradeCost: 130 },
      { damage: 40, range: 12, fireRate: 3.3, upgradeCost: 190 },
      { damage: 60, range: 13.5, fireRate: 3.8, upgradeCost: 0 },
    ],
  },
  lightning: {
    id: 'lightning',
    nameKey: 'towerLightning',
    descKey: 'towerLightningDesc',
    abilityNameKey: 'towerLightningAbility',
    abilityDescKey: 'towerFireAbility',
    abilityCooldown: 25,
    cost: 150,
    damageType: 'energy',
    canHitAir: true,
    projectile: 'none', // زنجیره لحظه‌ای
    chainCount: 2,
    color: 0x8b5cf6,
    levels: [
      { damage: 26, range: 10, fireRate: 0.9, upgradeCost: 150 },
      { damage: 36, range: 10.5, fireRate: 1.0, upgradeCost: 120 },
      { damage: 50, range: 11.5, fireRate: 1.1, upgradeCost: 170 },
      { damage: 70, range: 12.5, fireRate: 1.2, upgradeCost: 240 },
      { damage: 100, range: 14, fireRate: 1.35, upgradeCost: 0 },
    ],
  },
  fire: {
    id: 'fire',
    nameKey: 'towerFire',
    descKey: 'towerFireDesc',
    abilityNameKey: 'towerFireAbility',
    abilityDescKey: 'towerFireAbility',
    abilityCooldown: 30,
    cost: 130,
    damageType: 'fire',
    canHitAir: false,
    projectile: 'fireball',
    splashRadius: 2.8,
    burnDps: 6,
    color: 0xf97316,
    levels: [
      { damage: 30, range: 8.5, fireRate: 0.8, upgradeCost: 130 },
      { damage: 42, range: 9, fireRate: 0.85, upgradeCost: 105 },
      { damage: 58, range: 10, fireRate: 0.9, upgradeCost: 160 },
      { damage: 80, range: 11, fireRate: 1.0, upgradeCost: 220 },
      { damage: 115, range: 12, fireRate: 1.1, upgradeCost: 0 },
    ],
  },
  ice: {
    id: 'ice',
    nameKey: 'towerIce',
    descKey: 'towerIceDesc',
    abilityNameKey: 'towerIceAbility',
    abilityDescKey: 'towerFireAbility',
    abilityCooldown: 32,
    cost: 90,
    damageType: 'ice',
    canHitAir: true,
    projectile: 'frost',
    slowFactor: 0.55,
    slowDuration: 2.0,
    color: 0x22d3ee,
    levels: [
      { damage: 8, range: 8, fireRate: 1.4, upgradeCost: 90 },
      { damage: 12, range: 8.5, fireRate: 1.5, upgradeCost: 75 },
      { damage: 17, range: 9.5, fireRate: 1.6, upgradeCost: 110 },
      { damage: 24, range: 10.5, fireRate: 1.8, upgradeCost: 150 },
      { damage: 34, range: 12, fireRate: 2.0, upgradeCost: 0 },
    ],
  },
};

export const TOWER_BUILD_ORDER = ['sentinel', 'ice', 'fire', 'lightning'];

/** ضریب فاصله زنجیره صاعقه و افت آسیب هر پرش */
export const CHAIN_JUMP_RADIUS = 8;
export const CHAIN_FALLOFF = 0.72;
