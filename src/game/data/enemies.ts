import type { EnemyData } from './types';

// ============================================================
// تعریف دشمنان — Vertical Slice: ۶ دشمن + ۱ Boss
// Tierها ضریب دارند: HP×(1+0.65×(tier-1)) سرعت و پاداش هم
// ============================================================

export const ENEMIES: Record<string, EnemyData> = {
  shadow: {
    id: 'shadow',
    nameKey: 'enemyShadow',
    hp: 55,
    speed: 4.2,
    armor: 0,
    reward: 8,
    crystalReward: 1,
    coreDamage: 5,
    scale: 0.8,
    color: 0x1f1b2e,
    accent: 0xa855f7,
  },
  warrior: {
    id: 'warrior',
    nameKey: 'enemyWarrior',
    hp: 130,
    speed: 2.6,
    armor: 3,
    reward: 12,
    coreDamage: 6,
    scale: 1.0,
    color: 0x3b3648,
    accent: 0xef4444,
  },
  golem: {
    id: 'golem',
    nameKey: 'enemyGolem',
    hp: 550,
    speed: 1.4,
    armor: 10,
    reward: 28,
    coreDamage: 15,
    scale: 1.35,
    color: 0x57534e,
    accent: 0xf59e0b,
    resist: { fire: 0.7, ice: 1.1 },
  },
  spider: {
    id: 'spider',
    nameKey: 'enemySpider',
    hp: 75,
    speed: 3.8,
    armor: 2,
    reward: 11,
    coreDamage: 5,
    dodgeChance: 0.22,
    scale: 0.95,
    color: 0x292524,
    accent: 0x22d3ee,
  },
  warlock: {
    id: 'warlock',
    nameKey: 'enemyWarlock',
    hp: 160,
    speed: 2.2,
    armor: 2,
    reward: 20,
    crystalReward: 3,
    coreDamage: 6,
    scale: 1.0,
    color: 0x312e81,
    accent: 0x8b5cf6,
    shieldGiver: { radius: 7, amount: 45, interval: 6 },
    resist: { shadow: 0.5, physical: 1.15 },
  },
  flyer: {
    id: 'flyer',
    nameKey: 'enemyFlyer',
    hp: 90,
    speed: 3.4,
    armor: 1,
    reward: 10,
    coreDamage: 5,
    flying: true,
    scale: 0.9,
    color: 0x1e1b2e,
    accent: 0xc084fc,
  },
  golemKing: {
    id: 'golemKing',
    nameKey: 'enemyGolemKing',
    hp: 4200,
    speed: 1.1,
    armor: 14,
    reward: 150,
    crystalReward: 20,
    coreDamage: 45,
    boss: true,
    scale: 2.2,
    color: 0x44403c,
    accent: 0xf59e0b,
    resist: { fire: 0.75, ice: 0.9 },
  },
};

/** محاسبه آمار دشمن بر اساس Tier (T1..T5) */
export function tiered(data: EnemyData, tier: number) {
  const ti = tier - 1;
  return {
    hp: Math.round(data.hp * (1 + 0.65 * ti)),
    speed: data.speed * (1 + 0.06 * ti),
    armor: Math.round(data.armor * (1 + 0.35 * ti)),
    reward: Math.round(data.reward * (1 + 0.3 * ti)),
    scale: data.scale * (1 + 0.08 * ti),
  };
}
