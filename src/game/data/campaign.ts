import type { LevelData, ChapterDef, WaveData, SpawnGroup, Vec2, AchievementDef, PlayerStats, SaveData } from './types';

// ============================================================
// کمپین ۱۰۰ مرحله‌ای — ۱۰ فصل × ۱۰ مرحله
// ------------------------------------------------------------
// هر فصل هویت خودش را دارد (محیط/زمان روز/Boss/ترکیب دشمنان)
// هر مرحله ترکیب ورود و خروج دشمنان متفاوت (ژنراتور قطعی با seed)
// فصل ۲ به بعد — مراحل سخت (۷ به بعد) با ۲ تا ۳ مسیر حمله
// همه مسیرها دقیقاً به هسته آذر ختم می‌شوند
// ============================================================

// ---------------------------- فصل‌ها ----------------------------

export const CHAPTERS: ChapterDef[] = [
  { id: 1, nameKey: 'chapter1', descKey: 'chapter1Desc', env: 'plains', timeOfDay: 'day', tagKey: 'chapter1Tag', bossId: 'golemKing' },
  { id: 2, nameKey: 'chapter2', descKey: 'chapter2Desc', env: 'forest', timeOfDay: 'night', tagKey: 'chapter2Tag', bossId: 'fireGiant' },
  { id: 3, nameKey: 'chapter3', descKey: 'chapter3Desc', env: 'tundra', timeOfDay: 'day', tagKey: 'chapter3Tag', bossId: 'iceGiant' },
  { id: 4, nameKey: 'chapter4', descKey: 'chapter4Desc', env: 'volcano', timeOfDay: 'night', tagKey: 'chapter4Tag', bossId: 'blackDragon' },
  { id: 5, nameKey: 'chapter5', descKey: 'chapter5Desc', env: 'wastes', timeOfDay: 'day', tagKey: 'chapter5Tag', bossId: 'annihilator' },
  { id: 6, nameKey: 'chapter6', descKey: 'chapter6Desc', env: 'forest', timeOfDay: 'day', tagKey: 'chapter6Tag', bossId: 'golemKing' },
  { id: 7, nameKey: 'chapter7', descKey: 'chapter7Desc', env: 'tundra', timeOfDay: 'night', tagKey: 'chapter7Tag', bossId: 'fireGiant' },
  { id: 8, nameKey: 'chapter8', descKey: 'chapter8Desc', env: 'volcano', timeOfDay: 'day', tagKey: 'chapter8Tag', bossId: 'annihilator' },
  { id: 9, nameKey: 'chapter9', descKey: 'chapter9Desc', env: 'wastes', timeOfDay: 'night', tagKey: 'chapter9Tag', bossId: 'blackDragon' },
  { id: 10, nameKey: 'chapter10', descKey: 'chapter10Desc', env: 'citadel', timeOfDay: 'night', tagKey: 'chapter10Tag', bossId: 'darkLord' },
];

/** ترکیب دشمنان هر فصل — ورود و خروج متفاوت در هر مرحله با seed */
const CHAPTER_POOLS: Record<number, string[]> = {
  1: ['shadow', 'warrior', 'spider', 'golem', 'flyer', 'warlock'],
  2: ['shadowSoldier', 'spider', 'hunter', 'spirit', 'warrior', 'summoner', 'shadow'],
  3: ['crystalMonster', 'warrior', 'hunter', 'aetherTank', 'flyer', 'warlock', 'golem'],
  4: ['smallDragon', 'destroyer', 'hunter', 'golem', 'warMachine', 'warlock'],
  5: ['warMachine', 'destroyer', 'aetherTank', 'summoner', 'hunter', 'flyer'],
  6: ['shadowSoldier', 'spirit', 'summoner', 'spider', 'warlock', 'golem'],
  7: ['crystalMonster', 'aetherTank', 'golem', 'warrior', 'hunter', 'spirit', 'warlock'],
  8: ['smallDragon', 'destroyer', 'golem', 'warMachine', 'flyer', 'hunter'],
  9: ['warMachine', 'destroyer', 'summoner', 'aetherTank', 'shadowSoldier', 'flyer'],
  10: ['shadowSoldier', 'destroyer', 'summoner', 'aetherTank', 'smallDragon', 'spirit', 'hunter', 'warMachine'],
};

// ---------------------------- قالب‌های مسیر ----------------------------
// تک‌مسیر — ۱۰ قالب (همه در محدوده ±۳۲)

const SINGLES: Vec2[][] = [
  [{ x: -32, z: 28 }, { x: -32, z: 4 }, { x: -8, z: 4 }, { x: -8, z: -20 }, { x: 18, z: -20 }, { x: 18, z: 2 }],
  [{ x: -30, z: -24 }, { x: -10, z: -24 }, { x: -10, z: -6 }, { x: 8, z: -6 }, { x: 8, z: 12 }, { x: 24, z: 12 }, { x: 24, z: -2 }],
  [{ x: -28, z: 28 }, { x: -28, z: 10 }, { x: -12, z: 10 }, { x: -12, z: -8 }, { x: 4, z: -8 }, { x: 4, z: 10 }, { x: 20, z: 10 }, { x: 20, z: -8 }, { x: 28, z: -8 }],
  [{ x: -28, z: 26 }, { x: 26, z: 26 }, { x: 26, z: 8 }, { x: -28, z: 8 }, { x: -28, z: -10 }, { x: 0, z: -10 }, { x: 0, z: -24 }, { x: 24, z: -24 }],
  [{ x: -26, z: -28 }, { x: -26, z: -10 }, { x: -8, z: -10 }, { x: -8, z: 8 }, { x: 10, z: 8 }, { x: 10, z: -10 }, { x: 26, z: -10 }, { x: 26, z: 8 }],
  [{ x: -30, z: 0 }, { x: -18, z: 0 }, { x: -18, z: 16 }, { x: -4, z: 16 }, { x: -4, z: -16 }, { x: 10, z: -16 }, { x: 10, z: 8 }, { x: 22, z: 8 }, { x: 22, z: -12 }],
  [{ x: 30, z: 28 }, { x: 30, z: 8 }, { x: 12, z: 8 }, { x: 12, z: -12 }, { x: -8, z: -12 }, { x: -8, z: 6 }, { x: -24, z: 6 }, { x: -24, z: -14 }],
  [{ x: -32, z: -16 }, { x: -16, z: -16 }, { x: -16, z: 14 }, { x: 0, z: 14 }, { x: 0, z: -8 }, { x: 16, z: -8 }, { x: 16, z: 20 }, { x: 28, z: 20 }, { x: 28, z: 0 }],
  [{ x: 0, z: 30 }, { x: 0, z: 16 }, { x: -20, z: 16 }, { x: -20, z: -4 }, { x: 0, z: -4 }, { x: 0, z: -12 }, { x: 20, z: -12 }, { x: 20, z: 4 }, { x: 30, z: 4 }],
  [{ x: -30, z: 22 }, { x: -6, z: 22 }, { x: -6, z: 6 }, { x: 14, z: 6 }, { x: 14, z: -10 }, { x: 28, z: -10 }, { x: 28, z: -22 }, { x: 8, z: -22 }, { x: 8, z: -26 }],
];

// دومسیره — ۶ قالب (دو دروازه جدا، پایان مشترک روی هسته)

const DOUBLES: Vec2[][][] = [
  [ // هسته (20,2)
    [{ x: -30, z: 26 }, { x: -30, z: 6 }, { x: -12, z: 6 }, { x: -12, z: -14 }, { x: 6, z: -14 }, { x: 6, z: 2 }, { x: 20, z: 2 }],
    [{ x: 28, z: 28 }, { x: 28, z: 12 }, { x: 12, z: 12 }, { x: 12, z: -2 }, { x: 20, z: -2 }, { x: 20, z: 2 }],
  ],
  [ // هسته (22,-6)
    [{ x: -28, z: -26 }, { x: -28, z: -8 }, { x: -10, z: -8 }, { x: -10, z: 10 }, { x: 8, z: 10 }, { x: 8, z: -6 }, { x: 22, z: -6 }],
    [{ x: -2, z: 28 }, { x: -2, z: 14 }, { x: 14, z: 14 }, { x: 14, z: -6 }, { x: 22, z: -6 }],
  ],
  [ // هسته (-18,-4)
    [{ x: 30, z: -24 }, { x: 30, z: -6 }, { x: 14, z: -6 }, { x: 14, z: 12 }, { x: -2, z: 12 }, { x: -2, z: -4 }, { x: -18, z: -4 }],
    [{ x: -28, z: 26 }, { x: -28, z: 10 }, { x: -14, z: 10 }, { x: -14, z: -4 }, { x: -18, z: -4 }],
  ],
  [ // هسته (24,10)
    [{ x: -30, z: -2 }, { x: -18, z: -2 }, { x: -18, z: 14 }, { x: -2, z: 14 }, { x: -2, z: -8 }, { x: 12, z: -8 }, { x: 12, z: 10 }, { x: 24, z: 10 }],
    [{ x: 26, z: -28 }, { x: 26, z: -2 }, { x: 24, z: -2 }, { x: 24, z: 10 }],
  ],
  [ // هسته (26,-18)
    [{ x: -26, z: 28 }, { x: -26, z: 12 }, { x: -8, z: 12 }, { x: -8, z: -4 }, { x: 10, z: -4 }, { x: 10, z: -18 }, { x: 26, z: -18 }],
    [{ x: 28, z: 26 }, { x: 28, z: 8 }, { x: 16, z: 8 }, { x: 16, z: -18 }, { x: 26, z: -18 }],
  ],
  [ // هسته (14,26)
    [{ x: 0, z: -30 }, { x: 0, z: -16 }, { x: -16, z: -16 }, { x: -16, z: 2 }, { x: -2, z: 2 }, { x: -2, z: 16 }, { x: 14, z: 16 }, { x: 14, z: 26 }],
    [{ x: 30, z: -12 }, { x: 30, z: 8 }, { x: 22, z: 8 }, { x: 22, z: 26 }, { x: 14, z: 26 }],
  ],
];

// سه‌مسیره — ۴ قالب (سه دروازه، محاصره کامل هسته)

const TRIPLES: Vec2[][][] = [
  [ // هسته (0,0)
    [{ x: -30, z: 30 }, { x: -30, z: 10 }, { x: -14, z: 10 }, { x: -14, z: -6 }, { x: 0, z: -6 }, { x: 0, z: 0 }],
    [{ x: 30, z: 30 }, { x: 30, z: 10 }, { x: 14, z: 10 }, { x: 14, z: -6 }, { x: 0, z: -6 }, { x: 0, z: 0 }],
    [{ x: 0, z: -32 }, { x: 0, z: -18 }, { x: 0, z: -6 }, { x: 0, z: 0 }],
  ],
  [ // هسته (22,0)
    [{ x: -30, z: -26 }, { x: -30, z: -8 }, { x: -12, z: -8 }, { x: -12, z: 8 }, { x: 4, z: 8 }, { x: 4, z: -8 }, { x: 22, z: -8 }, { x: 22, z: 0 }],
    [{ x: -2, z: -30 }, { x: -2, z: -18 }, { x: 12, z: -18 }, { x: 12, z: -8 }, { x: 22, z: -8 }, { x: 22, z: 0 }],
    [{ x: -30, z: 28 }, { x: -30, z: 12 }, { x: -16, z: 12 }, { x: -16, z: 2 }, { x: 4, z: 2 }, { x: 4, z: -8 }, { x: 22, z: -8 }, { x: 22, z: 0 }],
  ],
  [ // هسته (-20,-20)
    [{ x: 28, z: 28 }, { x: 28, z: 12 }, { x: 12, z: 12 }, { x: 12, z: -4 }, { x: -4, z: -4 }, { x: -4, z: -20 }, { x: -20, z: -20 }],
    [{ x: 30, z: -28 }, { x: 30, z: -16 }, { x: 16, z: -16 }, { x: 16, z: -20 }, { x: -4, z: -20 }, { x: -20, z: -20 }],
    [{ x: -30, z: 30 }, { x: -30, z: 6 }, { x: -16, z: 6 }, { x: -16, z: -20 }, { x: -20, z: -20 }],
  ],
  [ // هسته (0,-24)
    [{ x: -30, z: 28 }, { x: -30, z: 10 }, { x: -14, z: 10 }, { x: -14, z: -8 }, { x: 0, z: -8 }, { x: 0, z: -24 }],
    [{ x: 30, z: 28 }, { x: 30, z: 10 }, { x: 14, z: 10 }, { x: 14, z: -8 }, { x: 0, z: -8 }, { x: 0, z: -24 }],
    [{ x: 28, z: -30 }, { x: 12, z: -30 }, { x: 12, z: -24 }, { x: 0, z: -24 }],
  ],
];

// ---------------------------- ابزار قطعی ----------------------------

/** PRNG قطعی — هر مرحله ترکیب ثابت و تکرارپذیر خودش را دارد */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** تعداد مسیر حمله — فصل ۱ تک‌مسیر؛ فصل ۲ به بعد مراحل سخت چندمسیره */
export function pathCountFor(chapter: number, stage: number): number {
  if (chapter <= 1) return 1;
  if (stage <= 6) return 1;
  if (stage <= 8) return 2; // مراحل ۷-۸
  if (stage === 9) return chapter >= 4 ? 3 : 2;
  return chapter >= 5 ? 3 : 2; // مرحله ۱۰ — Boss
}

/** انتخاب قالب مسیر — قطعی و متفاوت بین مراحل مجاور */
function pickPaths(chapter: number, stage: number, count: number): Vec2[][] {
  if (count === 1) {
    const idx = (chapter * 7 + stage * 3) % SINGLES.length;
    return [SINGLES[idx]];
  }
  if (count === 2) {
    const idx = (chapter * 5 + stage * 2) % DOUBLES.length;
    return DOUBLES[idx];
  }
  const idx = (chapter + stage) % TRIPLES.length;
  return TRIPLES[idx];
}

// ---------------------------- طبقه‌بندی دشمنان برای ترکیب موج ----------------------------

const SWARM = ['shadow', 'spider', 'shadowSoldier'];
const TANK = ['golem', 'crystalMonster', 'aetherTank', 'warMachine'];
const AIR = ['flyer', 'smallDragon'];
const CASTER = ['warlock'];
const UTILITY = ['spirit', 'summoner'];
const HEAVY = ['destroyer', 'hunter'];

function roleOf(enemyId: string): 'swarm' | 'tank' | 'air' | 'caster' | 'utility' | 'heavy' | 'melee' {
  if (SWARM.includes(enemyId)) return 'swarm';
  if (TANK.includes(enemyId)) return 'tank';
  if (AIR.includes(enemyId)) return 'air';
  if (CASTER.includes(enemyId)) return 'caster';
  if (UTILITY.includes(enemyId)) return 'utility';
  if (HEAVY.includes(enemyId)) return 'heavy';
  return 'melee';
}

/** پایه تعداد هر نقش — قبل از مقیاس سختی */
const ROLE_BASE: Record<string, { count: number; interval: number }> = {
  swarm: { count: 9, interval: 1.0 },
  melee: { count: 6, interval: 1.5 },
  tank: { count: 3, interval: 4.5 },
  air: { count: 7, interval: 1.4 },
  caster: { count: 2, interval: 6.5 },
  utility: { count: 2, interval: 6.0 },
  heavy: { count: 3, interval: 5.0 },
};

// ---------------------------- ژنراتور موج‌های هر مرحله ----------------------------

function buildWaves(chapter: ChapterDef, stage: number, pathCount: number): WaveData[] {
  const D = (chapter.id - 1) * 10 + stage; // شاخص سختی ۱..۱۰۰
  const rng = mulberry32(chapter.id * 7919 + stage * 104729);
  const pool = CHAPTER_POOLS[chapter.id];
  const tier = Math.min(3, 1 + Math.floor(D / 22));
  const intensity = 0.8 + D * 0.006; // ۰٫۸ تا ۱٫۴
  const waves: WaveData[] = [];

  for (let w = 0; w < 10; w++) {
    // ----- موج Boss -----
    if (w === 9) {
      const bossTier = Math.min(3, 1 + Math.floor(D / 40));
      const groups: SpawnGroup[] = [
        { enemy: chapter.bossId, count: 1, interval: 1, delay: 2, tier: bossTier, path: 0 },
      ];
      // محافظ‌های Boss — پخش روی همه مسیرها در مراحل چندمسیره
      const escorts = pool.filter((e) => roleOf(e) !== 'utility');
      const e1 = escorts[Math.floor(rng() * escorts.length)];
      const e2 = escorts[Math.floor(rng() * escorts.length)];
      const eCount = Math.round(6 + D * 0.06);
      groups.push({ enemy: e1, count: eCount, interval: Math.max(1.4, 3.2 - D * 0.012), delay: 12, tier });
      if (D > 35) {
        groups.push({ enemy: e2, count: Math.max(3, Math.round(eCount * 0.6)), interval: Math.max(1.8, 3.6 - D * 0.012), delay: 20, tier });
      }
      waves.push({
        coinBonus: Math.round(230 + D * 2.3),
        crystalBonus: 12 + chapter.id,
        groups: distributeGroups(groups, pathCount, rng),
        boss: true,
      });
      continue;
    }

    // ----- موج‌های عادی -----
    const wavePower = intensity * (0.75 + w * 0.06);
    const nGroups = w < 2 ? 1 : w < 5 ? 2 : D > 40 ? 3 : 2;
    const picked: string[] = [];
    const poolShuffled = [...pool].sort(() => rng() - 0.5);
    // تنوع: هوایی از موج ۴ به بعد، شفادهنده/احضارکننده از موج ۵ به بعد
    for (const e of poolShuffled) {
      if (picked.length >= nGroups) break;
      const role = roleOf(e);
      if (role === 'air' && w < 3) continue;
      if (role === 'utility' && w < 4) continue;
      if (picked.includes(e)) continue;
      picked.push(e);
    }
    // اگر نقش هوایی موج اول بود جایگزین زمینی
    while (picked.length < nGroups) {
      const fallback = poolShuffled.find((e) => !picked.includes(e) && roleOf(e) !== 'air');
      if (!fallback) break;
      picked.push(fallback);
    }

    const groups: SpawnGroup[] = [];
    picked.forEach((enemyId, gi) => {
      const role = roleOf(enemyId);
      const base = ROLE_BASE[role];
      const count = Math.max(1, Math.round(base.count * wavePower * (0.85 + rng() * 0.3)));
      const interval = Math.max(0.5, base.interval - D * 0.004 + (rng() - 0.5) * 0.3);
      const gTier = Math.min(3, tier + (w >= 6 && rng() < 0.3 ? 1 : 0));
      groups.push({
        enemy: enemyId,
        count,
        interval: Math.round(interval * 10) / 10,
        delay: gi * (3 + rng() * 3),
        tier: gTier,
      });
    });

    waves.push({
      coinBonus: Math.round(52 + D * 0.9 + w * 6),
      groups: distributeGroups(groups, pathCount, rng),
    });
  }
  return waves;
}

/** پخش گروه‌ها روی مسیرها — در مراحل چندمسیره فشار متوازن می‌آید */
function distributeGroups(groups: SpawnGroup[], pathCount: number, rng: () => number): SpawnGroup[] {
  if (pathCount <= 1) return groups;
  const out: SpawnGroup[] = [];
  for (const g of groups) {
    // هر گروه به‌جز شفادهنده/احضارکننده — بین همه مسیرها تقسیم می‌شود تا هر مسیر فعال بماند
    if (g.count >= pathCount * 2 && roleOf(g.enemy) !== 'utility') {
      const per = Math.floor(g.count / pathCount);
      let rem = g.count % pathCount;
      for (let p = 0; p < pathCount; p++) {
        const c = per + (rem-- > 0 ? 1 : 0);
        if (c <= 0) continue;
        out.push({ ...g, count: c, path: p, delay: g.delay + p * (0.8 + rng() * 0.6) });
      }
    } else {
      // گروه خیلی کوچک — یک مسیر چرخشی
      out.push({ ...g, path: Math.floor(rng() * pathCount) });
    }
  }
  return out;
}

// ---------------------------- ساخت مرحله ----------------------------

export function stageId(chapter: number, stage: number): string {
  return `c${chapter}s${stage}`;
}

export function buildStage(chapter: ChapterDef, stage: number): LevelData {
  const D = (chapter.id - 1) * 10 + stage;
  const pathCount = pathCountFor(chapter.id, stage);
  return {
    id: stageId(chapter.id, stage),
    chapter: chapter.id,
    stage,
    nameKey: chapter.nameKey,
    descKey: chapter.descKey,
    coreHp: Math.round(100 + (chapter.id - 1) * 6 + (stage - 1) * 2),
    startCoins: Math.round(220 + chapter.id * 14 + stage * 6),
    startCrystals: Math.round(28 + chapter.id * 2 + (stage - 1) * 0.5),
    timeOfDay: chapter.timeOfDay,
    env: chapter.env,
    star2HealthPct: 70,
    star3ChallengeKey: 'starChallenge',
    paths: pickPaths(chapter.id, stage, pathCount),
    waves: buildWaves(chapter, stage, pathCount),
  };
}

/** هر ۱۰۰ مرحله — یک بار در load ساخته می‌شود (داده خالص، هزینه نزدیک صفر) */
function buildAllStages(): Record<string, LevelData> {
  const levels: Record<string, LevelData> = {};
  for (const ch of CHAPTERS) {
    for (let s = 1; s <= 10; s++) {
      levels[stageId(ch.id, s)] = buildStage(ch, s);
    }
  }
  return levels;
}

export const STAGES: Record<string, LevelData> = buildAllStages();

// ---------------------------- قفل و پیشرفت ----------------------------

/** مرحله آزاد است؟ — زنجیره‌ای: مرحله قبلی یا Boss فصل قبل */
export function isStageUnlocked(chapter: number, stage: number, completed: Set<string>): boolean {
  if (chapter === 1 && stage === 1) return true;
  if (stage > 1) return completed.has(stageId(chapter, stage - 1));
  return completed.has(stageId(chapter - 1, 10));
}

export function completedStageIds(save: SaveData): Set<string> {
  return new Set(Object.entries(save.levels).filter(([, r]) => r.completed).map(([id]) => id));
}

export function isChapterUnlocked(chapterId: number, completed: Set<string>): boolean {
  return isStageUnlocked(chapterId, 1, completed);
}

/** نخستین مرحله آزاد و بازی‌نشده — «ادامه» از منو و دکمه مرحله بعد */
export function firstPlayableStageId(save: SaveData): string {
  const completed = completedStageIds(save);
  for (const ch of CHAPTERS) {
    for (let s = 1; s <= 10; s++) {
      if (!completed.has(stageId(ch.id, s)) && isStageUnlocked(ch.id, s, completed)) {
        return stageId(ch.id, s);
      }
    }
  }
  return stageId(10, 10);
}

/** مرحله بعدی در زنجیره — null یعنی پایان کمپین */
export function nextStageId(chapter: number, stage: number): string | null {
  if (stage < 10) return stageId(chapter, stage + 1);
  if (chapter < 10) return stageId(chapter + 1, 1);
  return null;
}

/** مجموع ستاره‌های یک فصل */
export function chapterStars(chapterId: number, save: SaveData): number {
  let sum = 0;
  for (let s = 1; s <= 10; s++) {
    sum += save.levels[stageId(chapterId, s)]?.stars ?? 0;
  }
  return sum;
}

/** مجموع ستاره‌های کل کمپین (۳۰ = عالی، ۳۰۰ = کامل) */
export function totalCampaignStars(save: SaveData): number {
  let sum = 0;
  for (const ch of CHAPTERS) sum += chapterStars(ch.id, save);
  return sum;
}

/** تعداد مراحل تکمیل‌شده از ۱۰۰ */
export function completedStageCount(save: SaveData): number {
  return completedStageIds(save).size;
}

// ============================================================
// دستاوردها — Data-Driven (۳۰ دستاورد)
// ============================================================

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_fortress', nameKey: 'achFirstFortress', descKey: 'achFirstFortressDesc', crystalReward: 10, check: (s) => s.victories >= 1 },
  { id: 'commander', nameKey: 'achCommander', descKey: 'achCommanderDesc', crystalReward: 20, check: (s) => s.victories >= 3 },
  { id: 'legend', nameKey: 'achLegend', descKey: 'achLegendDesc', crystalReward: 100, check: (s) => s.victories >= 10 },
  { id: 'mage', nameKey: 'achMage', descKey: 'achMageDesc', crystalReward: 10, check: (s) => s.magicCasts >= 10 },
  { id: 'archmage', nameKey: 'achArchmage', descKey: 'achArchmageDesc', crystalReward: 30, check: (s) => s.magicCasts >= 50 },
  { id: 'slayer', nameKey: 'achSlayer', descKey: 'achSlayerDesc', crystalReward: 10, check: (s) => s.kills >= 50 },
  { id: 'exterminator', nameKey: 'achExterminator', descKey: 'achExterminatorDesc', crystalReward: 40, check: (s) => s.kills >= 500 },
  { id: 'wave_breaker', nameKey: 'achWaveBreaker', descKey: 'achWaveBreakerDesc', crystalReward: 15, check: (s) => s.wavesSurvived >= 25 },
  { id: 'veteran', nameKey: 'achVeteran', descKey: 'achVeteranDesc', crystalReward: 60, check: (s) => s.wavesSurvived >= 100 },
  { id: 'giant_slayer', nameKey: 'achGiantSlayer', descKey: 'achGiantSlayerDesc', crystalReward: 25, check: (s) => s.bossKills >= 1 },
  { id: 'titan_bane', nameKey: 'achTitanBane', descKey: 'achTitanBaneDesc', crystalReward: 50, check: (s) => s.bossKills >= 3 },
  { id: 'architect', nameKey: 'achArchitect', descKey: 'achArchitectDesc', crystalReward: 10, check: (s) => s.towersBuilt >= 20 },
  { id: 'master_builder', nameKey: 'achMasterBuilder', descKey: 'achMasterBuilderDesc', crystalReward: 20, check: (s) => s.upgrades >= 50 },
  { id: 'star_seeker', nameKey: 'achStarSeeker', descKey: 'achStarSeekerDesc', crystalReward: 15, check: (s) => s.totalStars >= 5 },
  { id: 'star_lord', nameKey: 'achStarLord', descKey: 'achStarLordDesc', crystalReward: 50, check: (s) => s.totalStars >= 15 },
  { id: 'untouchable', nameKey: 'achUntouchable', descKey: 'achUntouchableDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'perfect_defense', nameKey: 'achPerfectDefense', descKey: 'achPerfectDefenseDesc', crystalReward: 25, check: () => false }, // رویدادی
  { id: 'last_stand', nameKey: 'achLastStand', descKey: 'achLastStandDesc', crystalReward: 40, check: () => false }, // رویدادی
  { id: 'blitz', nameKey: 'achBlitz', descKey: 'achBlitzDesc', crystalReward: 15, check: () => false }, // رویدادی
  { id: 'tower_master', nameKey: 'achTowerMaster', descKey: 'achTowerMasterDesc', crystalReward: 20, check: () => false }, // رویدادی
  { id: 'maxed', nameKey: 'achMaxed', descKey: 'achMaxedDesc', crystalReward: 20, check: () => false }, // رویدادی
  { id: 'dragon_fear', nameKey: 'achDragonFear', descKey: 'achDragonFearDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'economy', nameKey: 'achEconomy', descKey: 'achEconomyDesc', crystalReward: 20, check: () => false }, // رویدادی
  { id: 'magic_rain', nameKey: 'achMagicRain', descKey: 'achMagicRainDesc', crystalReward: 15, check: () => false }, // رویدادی
  { id: 'rich', nameKey: 'achRich', descKey: 'achRichDesc', crystalReward: 15, check: (_s: PlayerStats) => false }, // رویدادی (در نبرد بررسی می‌شود)
  { id: 'crystal_hoarder', nameKey: 'achCrystalHoarder', descKey: 'achCrystalHoarderDesc', crystalReward: 15, check: () => false }, // رویدادی
  { id: 'storm_caller', nameKey: 'achStormCaller', descKey: 'achStormCallerDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'inferno', nameKey: 'achInferno', descKey: 'achInfernoDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'guardian_angel', nameKey: 'achGuardianAngel', descKey: 'achGuardianAngelDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'hero_max', nameKey: 'achNewAchievement', descKey: 'achUntouchableDesc', crystalReward: 50, check: () => false }, // جایگاه نگهدارنده
];

// سازگاری — بقیه پروژه از STAGES استفاده می‌کنند
export const LEVELS = STAGES;
