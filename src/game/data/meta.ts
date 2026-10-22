import { HEROES } from './magic';
import { TOWERS, TOWER_BUILD_ORDER } from './towers';
import { ACHIEVEMENTS } from './campaign';
import type { SaveData } from './types';

// ============================================================
// آهنگری آذر — سیستم ارتقای دائمی (Meta Progression)
// ------------------------------------------------------------
// منبع: دانش باستانی (knowledge) که از پیروزی‌ها به‌دست می‌آید
// قهرمان: هر سطح  +۸٪  جان و آسیب       (حداکثر سطح ۲۰)
// برج:    هر سطح  +۶٪  آسیب             (حداکثر سطح ۲۰)
//                +۳٪  نرخ شلیک
//                +۲٪  برد
// ارتقاها روی آمارهٔ پایه ضرب می‌شوند و در همهٔ ۱۰۰ مرحله اثر دارند؛
// سقف ۲۰ با رشد قدرت دشمنان در مراحل ۱۱..۱۰۰ (stagePowerMul) هم‌تراز است.
// ============================================================

export const META_MAX_LEVEL = 20;

/** گام تقویت قهرمان در هر سطح (۰٫۰۸ = ۸٪) */
export const HERO_META_STEP = 0.08;

/** گام تقویت برج در هر سطح (۰٫۰۶ = ۶٪ آسیب) */
export const TOWER_META_STEP = 0.06;

/** ضریب اثر ارتقا روی نرخ شلیک برج (۳٪ در هر سطح) */
export const TOWER_META_RATE_RATIO = 0.5;

/** ضریب اثر ارتقا روی برد برج (۲٪ در هر سطح) */
export const TOWER_META_RANGE_RATIO = 1 / 3;

/** هزینهٔ پایهٔ ارتقای قهرمان — سطح n هزینهٔ base×(n+1) دارد */
export const HERO_UPGRADE_BASE_COST = 10;

/** هزینهٔ پایهٔ ارتقای برج */
export const TOWER_UPGRADE_BASE_COST = 8;

/** درصد تقویت قهرمان در سطح داده‌شده */
export function heroMetaPct(level: number): number {
  return level * HERO_META_STEP;
}

/** درصد تقویت برج در سطح داده‌شده */
export function towerMetaPct(level: number): number {
  return level * TOWER_META_STEP;
}

/** هزینهٔ ارتقا از «سطح» فعلی به سطح بعد (سطح ۰ = پایه) */
export function metaUpgradeCost(currentLevel: number, base: number): number {
  return base * (currentLevel + 1);
}

export function heroUpgradeCost(currentLevel: number): number {
  return metaUpgradeCost(currentLevel, HERO_UPGRADE_BASE_COST);
}

export function towerUpgradeCost(currentLevel: number): number {
  return metaUpgradeCost(currentLevel, TOWER_UPGRADE_BASE_COST);
}

// ============================================================
// اقتصاد کارت برج — کارت از جعبهٔ پیروزی + سکه از کیف پول
// ارتقای هر برج = کارت آن برج + سکه (سبک Clash Royale)
// ============================================================

/** کارت لازم برای ارتقا از «سطح» فعلی به بعد — سطح ۰→۱: ۲ کارت … ۱۹→۲۰: ۵۹ کارت */
export function towerCardCost(currentLevel: number): number {
  return 2 + currentLevel * 3;
}

/** سکه لازم برای ارتقا از «سطح» فعلی به بعد — سطح ۰→۱: ۱۵۰ … ۱۹→۲۰: ۴۹۰۰ */
export function towerCoinCost(currentLevel: number): number {
  return 150 + currentLevel * 250;
}

/** کارت‌های موجود یک برج در سیو */
export function towerCardCount(save: { towerCards?: Record<string, number> }, towerId: string): number {
  return Math.max(0, Math.floor(save.towerCards?.[towerId] ?? 0));
}

// ============================================================
// فروش کارت اضافی — v2.3
// برجی که آهنگری‌اش مکس (سطح ۲۰) شده دیگر کارت لازم ندارد؛
// کارت‌های اضافی آن به‌ازای هر کارت به سکهٔ کیف پول فروخته می‌شود.
// ============================================================

/** قیمت فروش هر کارت اضافی برج مکس (سکه) */
export const CARD_SELL_PRICE = 40;

/** آیا آهنگری این برج مکس شده؟ */
export function isTowerMetaMaxed(save: { towerUpgrades?: Record<string, number> }, towerId: string): boolean {
  return towerMetaLevel(save, towerId) >= META_MAX_LEVEL;
}

/**
 * افزودن کارت به سیو — اگر برج مکس باشد کارت‌ها خودکار به سکه فروخته می‌شوند
 * و تعداد سکهٔ فروخته‌شده برمی‌گردد (برای toast). همهٔ منابع کارت (جعبهٔ پیروزی/
 * جعبهٔ روزانه/چالش روزانه) از این مسیر پرداخت می‌شوند تا کارت مرده انباشته نشود.
 */
export function awardTowerCards(
  save: SaveData,
  towerId: string,
  count: number,
): number {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return 0;
  if (isTowerMetaMaxed(save, towerId)) {
    const coins = n * CARD_SELL_PRICE;
    save.coins = Math.max(0, Math.floor((save.coins ?? 0) + coins));
    return coins;
  }
  save.towerCards[towerId] = Math.min(9999, (save.towerCards[towerId] ?? 0) + n);
  return 0;
}

/** فروش دستی کارت‌های اضافی برج مکس — تعداد سکهٔ به‌دست‌آمده (۰ یعنی چیزی برای فروش نبود) */
export function sellExtraTowerCards(save: SaveData, towerId: string): number {
  if (!isTowerMetaMaxed(save, towerId)) return 0;
  const have = towerCardCount(save, towerId);
  if (have <= 0) return 0;
  save.towerCards[towerId] = 0;
  const coins = have * CARD_SELL_PRICE;
  save.coins = Math.max(0, Math.floor((save.coins ?? 0) + coins));
  return coins;
}

// ============================================================
// قدرت ویژهٔ قهرمان — v2.3
// قرینهٔ قاعدهٔ برج (قدرت در سطح ۵ مکس برج): قدرت ویژهٔ هر قهرمان
// با رسیدن آهنگری همان قهرمان به سطح ۵ باز می‌شود.
// ============================================================

/** سطح آهنگری قهرمان که قدرت ویژه در آن آزاد می‌شود */
export const HERO_POWER_META_LEVEL = 5;

/** آیا قدرت ویژهٔ این قهرمان باز شده؟ */
export function heroPowerUnlocked(save: { heroUpgrades?: Record<string, number> }, heroId: string): boolean {
  return heroMetaLevel(save, heroId) >= HERO_POWER_META_LEVEL;
}

/** سطح ارتقای ذخیره‌شدهٔ قهرمان — ۰ اگر ثبت نشده */
export function heroMetaLevel(save: { heroUpgrades?: Record<string, number> }, heroId: string): number {
  const lvl = save.heroUpgrades?.[heroId] ?? 0;
  return Math.max(0, Math.min(META_MAX_LEVEL, lvl));
}

/** سطح ارتقای ذخیره‌شدهٔ برج — ۰ اگر ثبت نشده */
export function towerMetaLevel(save: { towerUpgrades?: Record<string, number> }, towerId: string): number {
  const lvl = save.towerUpgrades?.[towerId] ?? 0;
  return Math.max(0, Math.min(META_MAX_LEVEL, lvl));
}

/** شناسهٔ همهٔ قهرمانان — برای UI آهنگری */
export const META_HERO_IDS = Object.keys(HEROES);

/** شناسهٔ همهٔ برج‌ها به‌ترتیب باز شدن — برای UI آهنگری */
export const META_TOWER_IDS = [...TOWER_BUILD_ORDER];

/**
 * دستاوردهای آهنگری — پس از هر ارتقای دائمی صدا زده می‌شود (بخش ۳۸ سند قبولی)
 * همیشه idempotent — دستاورد تکراری پرداخت نمی‌شود
 */
export function grantForgeAchievements(s: SaveData): boolean {
  const lvls = [...Object.values(s.heroUpgrades ?? {}), ...Object.values(s.towerUpgrades ?? {})];
  const maxLvl = lvls.length ? Math.max(...lvls) : 0;
  let changed = false;
  const want: [string, number][] = [['hero_max', 10], ['forge20', 20]];
  for (const [id, threshold] of want) {
    if (maxLvl >= threshold && !s.achievements.includes(id)) {
      s.achievements.push(id);
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) s.crystals += def.crystalReward;
      changed = true;
    }
  }
  return changed;
}
