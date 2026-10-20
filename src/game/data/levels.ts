import type { LevelData, WaveData, SpawnGroup } from './types';
import { LEVEL_1 } from './level1';

/** تعریف منطقه در کمپین قدیمی ۶ منطقه‌ای — فقط همین فایل */
interface RegionDef {
  id: number;
  levelId: string;
  nameKey: string;
  env: string;
  tagKey: string;
}

// ============================================================
// کمپین ۶ منطقه‌ای — هر منطقه: مسیر، تم محیطی، موج‌ها و Boss خودش
// ------------------------------------------------------------
// R1 دشت‌های سبز   (plains  روز)   — Boss: پادشاه غول سنگی
// R2 جنگل سایه     (forest شب)   — Boss: غول آتش
// R3 یخچال‌های اثری (tundra روز)  — Boss: غول یخ
// R4 ژرفای آتشفشان (volcano شب)  — Boss: اژدهای سیاه
// R5 ویرانه‌های ماشین (wastes روز) — Boss: محوکننده
// R6 دژ ارباب تاریکی (citadel شب) — Boss: ارباب تاریکی (پایانی)
// مسیرها: شروع = دروازه تاریکی، پایان = هسته آذر (در محدوده ±۳۲)
// ============================================================

const g = (enemy: string, count: number, interval: number, delay: number, tier: number): SpawnGroup => ({
  enemy, count, interval, delay, tier,
});

const wave = (coinBonus: number, groups: SpawnGroup[], extra?: Partial<WaveData>): WaveData => ({
  coinBonus, groups, ...extra,
});

// ---------------------------- منطقه ۲ — جنگل سایه ----------------------------

const LEVEL_2: LevelData = {
  id: 'l2',
  region: 2,
  nameKey: 'region2',
  descKey: 'region2Desc',
  coreHp: 110,
  startCoins: 300,
  startCrystals: 35,
  timeOfDay: 'night',
  env: 'forest',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -30, z: -24 }, { x: -10, z: -24 }, { x: -10, z: -6 }, { x: 8, z: -6 },
    { x: 8, z: 12 }, { x: 24, z: 12 }, { x: 24, z: -2 },
  ],
  waves: [
    wave(70, [g('shadowSoldier', 6, 1.3, 0, 1), g('shadow', 4, 1.0, 4, 1)]),
    wave(75, [g('spider', 6, 1.2, 0, 2), g('shadowSoldier', 5, 1.4, 4, 1)]),
    wave(80, [g('hunter', 4, 1.8, 0, 1), g('warrior', 5, 1.7, 4, 2)]),
    wave(85, [g('spirit', 2, 6, 0, 1), g('shadowSoldier', 8, 1.1, 3, 2)]),
    wave(90, [g('flyer', 7, 1.4, 0, 2), g('hunter', 5, 1.5, 5, 2)]),
    wave(95, [g('summoner', 1, 1, 0, 1), g('shadow', 10, 0.8, 4, 2), g('warrior', 5, 1.8, 8, 2)]),
    wave(100, [g('spider', 10, 0.9, 0, 2), g('crystalMonster', 2, 5, 4, 1)]),
    wave(105, [g('warMachine', 2, 7, 0, 1), g('shadowSoldier', 10, 1.0, 5, 2)]),
    wave(115, [g('hunter', 7, 1.2, 0, 2), g('spirit', 3, 5, 4, 2), g('flyer', 6, 1.4, 8, 2)]),
    wave(280, [g('fireGiant', 1, 1, 2, 1), g('shadowSoldier', 8, 3.0, 12, 2), g('smallDragon', 3, 4, 20, 1)], { boss: true, crystalBonus: 18 }),
  ],
};

// ---------------------------- منطقه ۳ — یخچال‌های اثری ----------------------------

const LEVEL_3: LevelData = {
  id: 'l3',
  region: 3,
  nameKey: 'region3',
  descKey: 'region3Desc',
  coreHp: 120,
  startCoins: 360,
  startCrystals: 40,
  timeOfDay: 'day',
  env: 'tundra',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -28, z: 28 }, { x: -28, z: 10 }, { x: -12, z: 10 }, { x: -12, z: -8 },
    { x: 4, z: -8 }, { x: 4, z: 10 }, { x: 20, z: 10 }, { x: 20, z: -8 }, { x: 28, z: -8 },
  ],
  waves: [
    wave(80, [g('warrior', 8, 1.4, 0, 2), g('shadowSoldier', 5, 1.3, 5, 2)]),
    wave(85, [g('crystalMonster', 3, 4.5, 0, 1), g('flyer', 6, 1.4, 4, 2)]),
    wave(90, [g('hunter', 6, 1.4, 0, 2), g('spirit', 2, 6, 5, 2)]),
    wave(95, [g('aetherTank', 1, 1, 0, 1), g('warrior', 8, 1.5, 5, 2)]),
    wave(100, [g('smallDragon', 4, 3, 0, 1), g('crystalMonster', 4, 4, 5, 2)]),
    wave(105, [g('warlock', 2, 7, 0, 2), g('shadowSoldier', 10, 0.9, 4, 2)]),
    wave(110, [g('warMachine', 3, 6, 0, 2), g('hunter', 6, 1.3, 5, 2)]),
    wave(115, [g('summoner', 2, 8, 0, 2), g('shadow', 12, 0.7, 5, 2)]),
    wave(125, [g('aetherTank', 2, 8, 0, 2), g('flyer', 8, 1.2, 4, 2), g('spirit', 2, 6, 10, 2)]),
    wave(300, [g('iceGiant', 1, 1, 2, 1), g('crystalMonster', 6, 4, 12, 2), g('warrior', 8, 2.6, 20, 3)], { boss: true, crystalBonus: 20 }),
  ],
};

// ---------------------------- منطقه ۴ — ژرفای آتشفشان ----------------------------

const LEVEL_4: LevelData = {
  id: 'l4',
  region: 4,
  nameKey: 'region4',
  descKey: 'region4Desc',
  coreHp: 130,
  startCoins: 420,
  startCrystals: 45,
  timeOfDay: 'night',
  env: 'volcano',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -28, z: 26 }, { x: 26, z: 26 }, { x: 26, z: 8 }, { x: -28, z: 8 },
    { x: -28, z: -10 }, { x: 0, z: -10 }, { x: 0, z: -24 }, { x: 24, z: -24 },
  ],
  waves: [
    wave(90, [g('smallDragon', 5, 2.6, 0, 1), g('hunter', 6, 1.3, 5, 2)]),
    wave(95, [g('destroyer', 2, 8, 0, 1), g('shadowSoldier', 10, 1.0, 4, 2)]),
    wave(100, [g('smallDragon', 6, 2.2, 0, 2), g('warMachine', 2, 6, 5, 2)]),
    wave(105, [g('hunter', 8, 1.1, 0, 2), g('spirit', 3, 5, 5, 2)]),
    wave(110, [g('destroyer', 3, 7, 0, 2), g('flyer', 8, 1.2, 5, 2)]),
    wave(115, [g('golem', 5, 4.5, 0, 3), g('smallDragon', 4, 2.6, 6, 2)]),
    wave(120, [g('warMachine', 4, 5.5, 0, 2), g('warlock', 2, 7, 5, 2)]),
    wave(130, [g('summoner', 2, 8, 0, 2), g('shadowSoldier', 12, 0.8, 5, 3)]),
    wave(140, [g('aetherTank', 2, 8, 0, 2), g('destroyer', 3, 7, 4, 2), g('smallDragon', 5, 2.2, 10, 2)]),
    wave(330, [g('blackDragon', 1, 1, 2, 1), g('smallDragon', 6, 3, 14, 2), g('hunter', 8, 2.2, 22, 3)], { boss: true, crystalBonus: 24 }),
  ],
};

// ---------------------------- منطقه ۵ — ویرانه‌های ماشین ----------------------------

const LEVEL_5: LevelData = {
  id: 'l5',
  region: 5,
  nameKey: 'region5',
  descKey: 'region5Desc',
  coreHp: 140,
  startCoins: 480,
  startCrystals: 50,
  timeOfDay: 'day',
  env: 'wastes',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -26, z: -28 }, { x: -26, z: -10 }, { x: -8, z: -10 }, { x: -8, z: 8 },
    { x: 10, z: 8 }, { x: 10, z: -10 }, { x: 26, z: -10 }, { x: 26, z: 8 },
  ],
  waves: [
    wave(95, [g('warMachine', 4, 4.5, 0, 2), g('warrior', 8, 1.4, 5, 3)]),
    wave(100, [g('aetherTank', 2, 7, 0, 2), g('hunter', 7, 1.2, 4, 2)]),
    wave(105, [g('destroyer', 4, 6, 0, 2), g('flyer', 8, 1.2, 5, 3)]),
    wave(110, [g('crystalMonster', 6, 3.5, 0, 2), g('warMachine', 3, 6, 5, 2)]),
    wave(115, [g('summoner', 3, 7, 0, 2), g('shadowSoldier', 14, 0.8, 5, 3)]),
    wave(120, [g('aetherTank', 3, 7, 0, 2), g('smallDragon', 5, 2.4, 5, 2)]),
    wave(130, [g('destroyer', 5, 5.5, 0, 3), g('spirit', 3, 5, 6, 3)]),
    wave(140, [g('warMachine', 6, 4, 0, 3), g('warlock', 3, 6, 5, 3)]),
    wave(150, [g('golem', 6, 4, 0, 3), g('aetherTank', 2, 8, 5, 3), g('flyer', 10, 1.0, 10, 3)]),
    wave(360, [g('annihilator', 1, 1, 2, 1), g('warMachine', 4, 4.5, 12, 3), g('destroyer', 3, 6, 22, 2)], { boss: true, crystalBonus: 26 }),
  ],
};

// ---------------------------- منطقه ۶ — دژ ارباب تاریکی ----------------------------

const LEVEL_6: LevelData = {
  id: 'l6',
  region: 6,
  nameKey: 'region6',
  descKey: 'region6Desc',
  coreHp: 150,
  startCoins: 550,
  startCrystals: 60,
  timeOfDay: 'night',
  env: 'citadel',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -30, z: 0 }, { x: -18, z: 0 }, { x: -18, z: 16 }, { x: -4, z: 16 },
    { x: -4, z: -16 }, { x: 10, z: -16 }, { x: 10, z: 8 }, { x: 22, z: 8 }, { x: 22, z: -12 },
  ],
  waves: [
    wave(100, [g('shadowSoldier', 14, 0.8, 0, 3), g('hunter', 6, 1.3, 5, 3)]),
    wave(105, [g('destroyer', 4, 6, 0, 3), g('smallDragon', 5, 2.4, 5, 2)]),
    wave(110, [g('summoner', 3, 7, 0, 3), g('shadow', 16, 0.6, 4, 3)]),
    wave(115, [g('aetherTank', 3, 7, 0, 3), g('spirit', 4, 4.5, 5, 3)]),
    wave(125, [g('warMachine', 6, 4, 0, 3), g('crystalMonster', 6, 3.5, 5, 3)]),
    wave(130, [g('fireGiant', 1, 1, 0, 1), g('smallDragon', 6, 2.2, 6, 2)]),
    wave(135, [g('iceGiant', 1, 1, 0, 1), g('destroyer', 4, 6, 8, 3)]),
    wave(145, [g('annihilator', 1, 1, 0, 1), g('shadowSoldier', 12, 1.0, 10, 3)]),
    wave(160, [g('golemKing', 1, 1, 0, 2), g('summoner', 2, 8, 8, 3), g('flyer', 10, 1.0, 14, 3)]),
    wave(500, [
      g('darkLord', 1, 1, 3, 1),
      g('shadowSoldier', 10, 2.0, 14, 3),
      g('smallDragon', 5, 3.0, 26, 3),
      g('destroyer', 3, 6, 34, 3),
    ], { boss: true, crystalBonus: 50 }),
  ],
};

// ---------------------------- ثبت و فراداده ----------------------------

export const LEVELS: Record<string, LevelData> = {
  l1: LEVEL_1,
  l2: LEVEL_2,
  l3: LEVEL_3,
  l4: LEVEL_4,
  l5: LEVEL_5,
  l6: LEVEL_6,
};

/** مناطق کمپین — به‌ترتیب باز شدن */
export const REGIONS: RegionDef[] = [
  { id: 1, levelId: 'l1', nameKey: 'region1', env: 'plains', tagKey: 'region1Tag' },
  { id: 2, levelId: 'l2', nameKey: 'region2', env: 'forest', tagKey: 'region2Tag' },
  { id: 3, levelId: 'l3', nameKey: 'region3', env: 'tundra', tagKey: 'region3Tag' },
  { id: 4, levelId: 'l4', nameKey: 'region4', env: 'volcano', tagKey: 'region4Tag' },
  { id: 5, levelId: 'l5', nameKey: 'region5', env: 'wastes', tagKey: 'region5Tag' },
  { id: 6, levelId: 'l6', nameKey: 'region6', env: 'citadel', tagKey: 'region6Tag' },
];

/** منطقه باز است؟ — منطقه ۱ همیشه؛ بعدی با اتمام قبلی */
export function isRegionUnlocked(regionId: number, completedLevelIds: Set<string>): boolean {
  if (regionId <= 1) return true;
  const prev = REGIONS.find((r) => r.id === regionId - 1);
  if (!prev) return false;
  return completedLevelIds.has(prev.levelId);
}

/** مجموع ستاره‌های یک منطقه */
export function regionStars(levelId: string, levels: Record<string, { stars: number }>): number {
  return levels[levelId]?.stars ?? 0;
}
