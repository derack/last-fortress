import type { LevelData } from './types';

// ============================================================
// مرحله ۱ — دشت‌های سبز (Vertical Slice) — ۱۰ موج + Boss
// مسیر از دروازه تاریکی در جنوب‌غرب تا هسته آذر
// ============================================================

export const LEVEL_1: LevelData = {
  id: 'l1',
  region: 1,
  nameKey: 'region1',
  descKey: 'storyIntro3',
  coreHp: 100,
  startCoins: 240,
  startCrystals: 30,
  timeOfDay: 'day',
  env: 'plains',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -32, z: 28 },
    { x: -32, z: 4 },
    { x: -8, z: 4 },
    { x: -8, z: -20 },
    { x: 18, z: -20 },
    { x: 18, z: 2 },
  ],
  waves: [
    {
      coinBonus: 60,
      groups: [{ enemy: 'shadow', count: 5, interval: 1.4, delay: 0, tier: 1 }],
    },
    {
      coinBonus: 65,
      groups: [
        { enemy: 'shadow', count: 6, interval: 1.1, delay: 0, tier: 1 },
        { enemy: 'warrior', count: 3, interval: 2.4, delay: 5, tier: 1 },
      ],
    },
    {
      coinBonus: 70,
      groups: [
        { enemy: 'spider', count: 5, interval: 1.3, delay: 0, tier: 1 },
        { enemy: 'warrior', count: 4, interval: 2.0, delay: 4, tier: 1 },
      ],
    },
    {
      coinBonus: 80,
      groups: [
        { enemy: 'golem', count: 2, interval: 6, delay: 2, tier: 1 },
        { enemy: 'warrior', count: 5, interval: 1.8, delay: 6, tier: 1 },
      ],
    },
    {
      coinBonus: 85,
      groups: [
        { enemy: 'flyer', count: 6, interval: 1.6, delay: 0, tier: 1 },
        { enemy: 'shadow', count: 6, interval: 1.0, delay: 3, tier: 2 },
      ],
    },
    {
      coinBonus: 90,
      groups: [
        { enemy: 'warlock', count: 2, interval: 7, delay: 0, tier: 1 },
        { enemy: 'golem', count: 2, interval: 6, delay: 3, tier: 2 },
        { enemy: 'warrior', count: 6, interval: 1.6, delay: 6, tier: 2 },
      ],
    },
    {
      coinBonus: 95,
      groups: [
        { enemy: 'spider', count: 9, interval: 0.9, delay: 0, tier: 2 },
        { enemy: 'flyer', count: 6, interval: 1.5, delay: 4, tier: 2 },
      ],
    },
    {
      coinBonus: 100,
      groups: [
        { enemy: 'golem', count: 4, interval: 5, delay: 0, tier: 2 },
        { enemy: 'warlock', count: 2, interval: 8, delay: 4, tier: 1 },
        { enemy: 'shadow', count: 8, interval: 0.8, delay: 8, tier: 2 },
      ],
    },
    {
      coinBonus: 110,
      groups: [
        { enemy: 'warrior', count: 10, interval: 1.2, delay: 0, tier: 2 },
        { enemy: 'spider', count: 7, interval: 1.0, delay: 5, tier: 2 },
        { enemy: 'flyer', count: 7, interval: 1.4, delay: 9, tier: 2 },
      ],
    },
    {
      boss: true,
      coinBonus: 250,
      crystalBonus: 15,
      groups: [
        { enemy: 'golemKing', count: 1, interval: 1, delay: 2, tier: 1 },
        { enemy: 'warrior', count: 6, interval: 3.5, delay: 10, tier: 2 },
      ],
    },
  ],
};

// مناطق و مراحل در levels.ts — LEVEL_1 به‌عنوان منطقه ۱ آنجا ثبت شده است
// دستاوردها — تعریف رسمی در campaign.ts است (نسخهٔ تکراری این فایل حذف شد)
