import type { LevelData, ChapterDef, WaveData, SpawnGroup, Vec2, AchievementDef, PlayerStats, SaveData } from './types';
import { ENEMIES, tiered } from './enemies';

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
  { id: 9, nameKey: 'chapter9', descKey: 'chapter9Desc', env: 'wastes', timeOfDay: 'night', tagKey: 'chapter9Tag', bossId: 'abyssBehemoth' },
  { id: 10, nameKey: 'chapter10', descKey: 'chapter10Desc', env: 'citadel', timeOfDay: 'night', tagKey: 'chapter10Tag', bossId: 'darkLord' },
];

/** ترکیب دشمنان هر فصل — ورود و خروج متفاوت در هر مرحله با seed
 * بخش ۲۱ — میانگین HP مؤثر استخرها به‌هم نزدیک شده تا منحنی سختی فصل‌ها صعودی بماند:
 * فصل ۱: golem→hunter (تانک ۵۵۰HP برای شروع بازی سنگین بود — شکارچی سریع تنوع می‌دهد)
 * فصل ۵: aetherTank→golem (فصل ۵ بدون جبران بسیار سخت‌تر از فصل ۴ بود)
 * فصل ۶: spider→warrior (فصل ۶ بسیار نرم‌تر از فصل ۵ بود — واریر میانه می‌افزاید) */
const CHAPTER_POOLS: Record<number, string[]> = {
  1: ['shadow', 'warrior', 'spider', 'hunter', 'flyer', 'warlock', 'plagueHound'],
  2: ['shadowSoldier', 'spider', 'hunter', 'spirit', 'warrior', 'summoner', 'shadow', 'boneReaver'],
  3: ['crystalMonster', 'warrior', 'hunter', 'aetherTank', 'flyer', 'warlock', 'golem', 'frostWraith'],
  4: ['smallDragon', 'destroyer', 'hunter', 'golem', 'warMachine', 'warlock', 'emberDrake'],
  5: ['warMachine', 'destroyer', 'golem', 'summoner', 'hunter', 'flyer', 'siegeCrawler'],
  6: ['shadowSoldier', 'spirit', 'summoner', 'warrior', 'warlock', 'golem', 'hexPriest'],
  7: ['crystalMonster', 'aetherTank', 'golem', 'warrior', 'hunter', 'spirit', 'warlock', 'frostWraith'],
  8: ['smallDragon', 'destroyer', 'golem', 'warMachine', 'flyer', 'hunter', 'emberDrake'],
  9: ['warMachine', 'destroyer', 'summoner', 'aetherTank', 'shadowSoldier', 'flyer', 'voidArcher', 'ironBrute'],
  10: ['shadowSoldier', 'destroyer', 'summoner', 'aetherTank', 'smallDragon', 'spirit', 'hunter', 'warMachine', 'voidArcher'],
};

/** ضریب جبران استخر هر فصل — فصل‌های سنگین دشمن کمتر، نرم‌ها بیشتر
 * لنگر = میانگین استخر فصل ۱ (مرحله ۱ باید آسان بماند) */
const POOL_COMP: Record<number, number> = (() => {
  const poolAvg = (pool: string[]) =>
    pool.reduce((a, e) => a + ENEMIES[e].hp * (1 + ENEMIES[e].armor * 0.7 * 0.03), 0) / pool.length;
  const REF = poolAvg(CHAPTER_POOLS[1]); // لنگر — فصل ۱
  const out: Record<number, number> = {};
  for (const [id, pool] of Object.entries(CHAPTER_POOLS)) {
    out[Number(id)] = Math.pow(REF / poolAvg(pool), 0.65);
  }
  return out;
})();

// بخش ۲۱ — منحنی هدف فشار موج: رشد نمایی کمپین (برج‌های بازیکن هم قوی می‌شوند)
// + tier پیوسته + intensity + جبران استخر — نتیجه: منحنی صعودی بدون پرتگاه
const WAVE_BASE = 2900;
// v2.1 — منحنی سخت‌تر به درخواست کاربر («به مرور سخت‌تر»): رشد فشار ×۹٫۶ در ۱۰۰ مرحله
const CAMPAIGN_GROWTH = 1.0235;
const growAt = (D: number) => Math.pow(CAMPAIGN_GROWTH, D);

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

/** بخش ۲۱ — HP مؤثر با زره flat (ضربه نماینده ۴۵) — برای نرمال‌سازی موج */
function unitEff(enemyId: string, tier: number): number {
  const d = ENEMIES[enemyId];
  if (!d) return 0;
  const hp = tiered(d, tier).hp;
  return hp * (45 / Math.max(8, 45 - d.armor * 0.7));
}

function waveEffHp(groups: SpawnGroup[]): number {
  let sum = 0;
  for (const g of groups) sum += g.count * unitEff(g.enemy, g.tier);
  return sum;
}

/** بخش ۲۱ — نرمال‌سازی صحیح موج به منحنی هدف
 * هر گام: تک‌حرکتی که eff را بیشترین نزدیکی به هدف می‌برد (همگرایی یکنوا، بدون نوسان)
 * escortMin: کف تعداد محافظ‌ها در موج Boss (بخش ۲۱ — Boss Combination) */
function normalizeWave(groups: SpawnGroup[], target: number, skipBoss = false, escortMin = 0) {
  const LO = target * 0.9, HI = target * 1.1;
  for (let guard = 0; guard < 240; guard++) {
    const eff = waveEffHp(groups);
    if (eff > HI) {
      let best = -1, bestErr = Math.abs(eff - target);
      groups.forEach((g, i) => {
        if (g.count <= 1) return;
        if (skipBoss && ENEMIES[g.enemy]?.boss) return;
        if (escortMin > 0 && g.count <= escortMin) return;
        const err = Math.abs(eff - unitEff(g.enemy, g.tier) - target);
        if (err < bestErr) { bestErr = err; best = i; }
      });
      if (best < 0) break;
      groups[best].count--;
    } else if (eff < LO) {
      let best = -1, bestErr = Math.abs(eff - target);
      groups.forEach((g, i) => {
        if (skipBoss && ENEMIES[g.enemy]?.boss) return;
        if (g.count >= 40) return; // بخش ۲۱ — ضد یکنواختی، گروه‌های بزرگ‌تر پر نمی‌شوند
        const err = Math.abs(eff + unitEff(g.enemy, g.tier) - target);
        if (err < bestErr) { bestErr = err; best = i; }
      });
      if (best < 0) break;
      groups[best].count++;
    } else break;
  }
}

function buildWaves(chapter: ChapterDef, stage: number, pathCount: number): WaveData[] {
  const D = (chapter.id - 1) * 10 + stage; // شاخص سختی ۱..۱۰۰
  const rng = mulberry32(chapter.id * 7919 + stage * 104729);
  const pool = CHAPTER_POOLS[chapter.id];
  const comp = POOL_COMP[chapter.id];
  // بخش ۲۱ — tier پیوسته: HP نرم رشد می‌کند (بدون پرتگاه ×۱٫۶۵ در مرز فصل)
  // v2.1 — شیب tier مثل قبل می‌ماند (عبور از مرز صحیح tier = پرش پاداش/زره → افت R)
  // سختی اضافه از CAMPAIGN_GROWTH و intensity می‌آید
  const tFrac = Math.round((1 + D * 0.0265) * 100) / 100;
  const tierMult = 1 + 0.65 * (tFrac - 1);
  const intensity = 0.85 + D * 0.0085; // ۰٫۸۵ تا ۱٫۷ — فشار موج‌ها صعودی‌تر
  const waves: WaveData[] = [];

  for (let w = 0; w < 10; w++) {
    // ----- موج Boss -----
    if (w === 9) {
      const bossTier = Math.round((1 + (D - 1) * 0.024) * 100) / 100;
      const groups: SpawnGroup[] = [
        { enemy: chapter.bossId, count: 1, interval: 1, delay: 2, tier: bossTier, path: 0 },
      ];
      // محافظ‌های Boss — پخش روی همه مسیرها در مراحل چندمسیره
      const escorts = pool.filter((e) => roleOf(e) !== 'utility');
      const e1 = escorts[Math.floor(rng() * escorts.length)];
      const e2 = escorts[Math.floor(rng() * escorts.length)];
      const eCount = Math.round(6 + D * 0.085);
      groups.push({ enemy: e1, count: eCount, interval: Math.max(1.4, 3.2 - D * 0.012), delay: 12, tier: tFrac });
      if (D > 28) {
        groups.push({ enemy: e2, count: Math.max(3, Math.round(eCount * 0.6)), interval: Math.max(1.8, 3.6 - D * 0.012), delay: 20, tier: tFrac });
      }
      // بخش ۲۱ — نرمال‌سازی موج Boss (Boss ثابت؛ محافظ‌ها با کف ۴۰٪ حفظ می‌شوند)
      // v2.1 — اوج Boss پررنگ‌تر: ×۱٫۷۲ (بود ×۱٫۵۵)
      const bossTarget = WAVE_BASE * growAt(D) * intensity * 1.23 * tierMult * comp * 1.72;
      normalizeWave(groups, bossTarget, true, Math.max(2, Math.floor(eCount * 0.4)));
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
    // تنوع: هوایی از موج ۴ به بعد، شفادهنده/احضارکننده از موج ۵ به بعد، جادوگر از موج ۲
    for (const e of poolShuffled) {
      if (picked.length >= nGroups) break;
      const role = roleOf(e);
      if (role === 'air' && w < 3) continue;
      if (role === 'utility' && w < 4) continue;
      if (role === 'caster' && w < 1) continue; // موج اول بدون سپر جادوگر — شروع نرم
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
      // بخش ۲۱ — jitter مهارشده (قبلاً ۰٫۸۵–۱٫۱۵ نوسان ±۵۰٪ بین مراحل مجاور می‌ساخت)
      const count = Math.max(1, Math.round(base.count * wavePower * (0.9 + rng() * 0.2)));
      const interval = Math.max(0.5, base.interval - D * 0.004 + (rng() - 0.5) * 0.3);
      const gTier = Math.round((tFrac + (w >= 6 && rng() < 0.3 ? 0.3 : 0)) * 100) / 100;
      groups.push({
        enemy: enemyId,
        count,
        interval: Math.round(interval * 10) / 10,
        delay: gi * (3 + rng() * 3),
        tier: gTier,
      });
    });

    // بخش ۲۱ — نرمال‌سازی HP مؤثر موج به منحنی هدف
    // (ترکیب نقش‌ها و هویت دشمنان حفظ می‌شود؛ فقط فشار کل یکنواخت می‌گردد)
    const target = WAVE_BASE * growAt(D) * wavePower * tierMult * comp;
    normalizeWave(groups, target);

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

/** درآمد کل مرحله بدون جبران (سکه شروع + کشتار + پاداش پایه) — پایه جبران اقتصاد (بخش ۲۰/۲۱) */
function stageTotalIncome(chapter: ChapterDef, stage: number): number {
  const lv = buildStage(chapter, stage, 1);
  let kill = 0, bonus = 0;
  for (const w of lv.waves) {
    bonus += w.coinBonus ?? 0;
    for (const g of w.groups) kill += g.count * (tiered(ENEMIES[g.enemy], g.tier)?.reward ?? 0);
  }
  return lv.startCoins + kill + bonus;
}

export function buildStage(chapter: ChapterDef, stage: number, incomeComp = 1): LevelData {
  const D = (chapter.id - 1) * 10 + stage;
  const pathCount = pathCountFor(chapter.id, stage);
  const waves = buildWaves(chapter, stage, pathCount);
  if (incomeComp !== 1) {
    // بخش ۲۰ — موج‌های کم‌درآمد (تانک‌سنگین) پاداش بیشتر می‌گیرند تا اقتصاد صاف بماند
    for (const w of waves) w.coinBonus = Math.round((w.coinBonus ?? 0) * incomeComp);
  }
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
    waves,
  };
}

/** هر ۱۰۰ مرحله — یک بار در load ساخته می‌شود (داده خالص، هزینه نزدیک صفر)
 * دومرحله‌ای: اول درآمد کل هر مرحله، بعد هموارسازی به منحنی درآمد کمپین
 * (لنگر = میانگین فصل ۱؛ موج‌های کم‌درآمدِ تانک‌سنگین پاداش بیشتر می‌گیرند) */
function buildAllStages(): Record<string, LevelData> {
  const incomes: number[] = [];
  for (const ch of CHAPTERS) {
    for (let s = 1; s <= 10; s++) incomes.push(stageTotalIncome(ch, s));
  }
  const ref = incomes.slice(0, 10).reduce((a, r) => a + r, 0) / 10; // لنگر فصل ۱
  const levels: Record<string, LevelData> = {};
  let i = 0;
  for (const ch of CHAPTERS) {
    for (let s = 1; s <= 10; s++) {
      const D = (ch.id - 1) * 10 + s;
      // v2.1 — اقتصاد آهسته‌تر از فشار رشد می‌کند (۰٫۰۱۱۷ → ۰٫۰۱۰۲) → صعود سختی واقعی
      const target = ref * Math.pow(1.0117, D - 1); // منحنی درآمد کمپین
      const incomeComp = Math.min(2.0, Math.max(0.6, target / incomes[i++]));
      levels[stageId(ch.id, s)] = buildStage(ch, s, incomeComp);
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

/**
 * مرحلهٔ «ادامه» — مبنای دکمهٔ شروع منو:
 * آخرین مرحلهٔ بازی‌شده اگر تمام نشده؛ اگر تمام شده مرحلهٔ بعدش؛ وگرنه اولین مرحلهٔ آزاد.
 */
export function continueStageId(save: SaveData): string {
  const last = save.lastStageId && STAGES[save.lastStageId] ? save.lastStageId : '';
  if (last) {
    const rec = save.levels[last];
    if (!rec?.completed) return last;
    const st = STAGES[last];
    const nxt = nextStageId(st.chapter ?? 1, st.stage ?? 1);
    if (nxt && STAGES[nxt] && isStageUnlocked(STAGES[nxt].chapter ?? 1, STAGES[nxt].stage ?? 1, completedStageIds(save))) {
      return nxt;
    }
  }
  return firstPlayableStageId(save);
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
  { id: 'storm_caller', nameKey: 'achStormCaller', descKey: 'achStormCallerDesc', crystalReward: 30, check: (s) => s.skyLightningCasts >= 50 },
  { id: 'inferno', nameKey: 'achInferno', descKey: 'achInfernoDesc', crystalReward: 30, check: (s) => s.fireRainCasts >= 50 },
  { id: 'guardian_angel', nameKey: 'achGuardianAngel', descKey: 'achGuardianAngelDesc', crystalReward: 30, check: (s) => s.shieldCasts >= 20 },
  { id: 'hero_max', nameKey: 'achHeroMax', descKey: 'achHeroMaxDesc', crystalReward: 50, check: () => false }, // رویدادی — سطح ۵ قهرمان در یک نبرد
  { id: 'forge20', nameKey: 'achForge20', descKey: 'achForge20Desc', crystalReward: 60, check: () => false }, // رویدادی — آهنگری آذر تا سطح ۲۰
];

// سازگاری — بقیه پروژه از STAGES استفاده می‌کنند
export const LEVELS = STAGES;
