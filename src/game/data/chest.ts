import { TOWER_BUILD_ORDER } from './towers';
import { awardTowerCards } from './meta';
import type { SaveData } from './types';

// ============================================================
// جعبهٔ غنیمت — پاداش پس از هر پیروزی
// ------------------------------------------------------------
// محتوا: سکه (کیف پول متا) + کارت برج (برای ارتقای دائمی با سکه)
// اولین فتح مرحله = جعبه بزرگ (سکه ×۲ و کارت بیشتر)
// تکرار مرحله هم جعبه می‌دهد ولی کوچک‌تر — فارم بی‌نهایت نیست
// v2.3 — جعبهٔ روزانه (ریتنشن) + جعبهٔ چالش روزانه (کارت تضمینی)
// ============================================================

export interface ChestCard {
  towerId: string;
  count: number;
}

export interface ChestContents {
  coins: number;
  cards: ChestCard[];
  firstClear: boolean;
}

/** توزیع وزنی برج — برج‌های ابتدای نردبان رایج‌تر */
function drawWeightedCards(
  draws: number,
  rng: () => number,
  into: Map<string, number>,
) {
  const weights = TOWER_BUILD_ORDER.map((_, i) => Math.max(1.2, 10 - i * 0.85));
  const totalW = weights.reduce((a, b) => a + b, 0);
  for (let d = 0; d < draws; d++) {
    let r = rng() * totalW;
    let picked = TOWER_BUILD_ORDER[0];
    for (let i = 0; i < TOWER_BUILD_ORDER.length; i++) {
      r -= weights[i];
      if (r <= 0) { picked = TOWER_BUILD_ORDER[i]; break; }
    }
    // ۳۰٪ قرعه‌ها دو کارت می‌دهند
    const count = rng() < 0.3 ? 2 : 1;
    into.set(picked, (into.get(picked) ?? 0) + count);
  }
}

function toCards(map: Map<string, number>): ChestCard[] {
  return [...map.entries()].map(([towerId, count]) => ({ towerId, count }));
}

/**
 * محتویات جعبهٔ یک پیروزی — خالص و قابل‌تست (rng تزریقی)
 * سکه: ۵۵ + فصل×۱۸ + ستاره×۱۲ (اولین فتح ×۲)
 * کارت: اولین فتح ۴ قرعه، تکرار با ۳ ستاره ۳ قرعه، تکرار معمولی ۲ قرعه — برج‌های ابتدایی رایج‌تر (وزن نزولی)
 * v2.2 — اجرای بی‌نقص (۳ ستاره) در تکرار هم جعبهٔ بهتر می‌دهد
 */
export function rollChest(
  chapter: number,
  stars: number,
  firstClear: boolean,
  rng: () => number = Math.random,
): ChestContents {
  const coins = Math.round((55 + chapter * 18 + stars * 12) * (firstClear ? 2 : 1));
  const draws = firstClear ? 4 : stars >= 3 ? 3 : 2;
  const cardMap = new Map<string, number>();
  drawWeightedCards(draws, rng, cardMap);
  return { coins, cards: toCards(cardMap), firstClear };
}

// ============================================================
// جعبهٔ روزانه — v2.3 (ریتنشن)
// هر روزِ تقویمی یک بار: سکه + کارت. ورود پیوسته (زنجیره) پاداش را
// تا ۷ روز بزرگ‌تر می‌کند — انگیزهٔ بازگشت روزانه.
// ============================================================

/**
 * محتویات جعبهٔ روزانه
 * سکه: ۱۲۰ + ۴۰×روزِ زنجیره (سقف ۷) — کارت: ۴ قرعه + ۱ قرعهٔ اضافه در زنجیرهٔ ۳/۵/۷
 */
export function rollDailyChest(streak: number, rng: () => number = Math.random): ChestContents {
  const s = Math.max(1, Math.min(7, Math.floor(streak)));
  const coins = 120 + s * 40;
  const bonusDraw = s >= 7 ? 2 : s >= 5 ? 2 : s >= 3 ? 1 : 0;
  const cardMap = new Map<string, number>();
  drawWeightedCards(4 + bonusDraw, rng, cardMap);
  return { coins, cards: toCards(cardMap), firstClear: s >= 7 };
}

// ============================================================
// جعبهٔ چالش روزانه — v2.3
// پاداش «کارت تضمینی»: حداقل ۵ کارت قطعی (قرعه‌ها همیشه کارت می‌دهند)
// + سکهٔ ثابت بر پایهٔ فصل — به‌ازای پیروزی در مرحلهٔ چالش روز.
// ============================================================

/**
 * محتویات جعبهٔ چالش روزانه — کارت تضمینی (بدون قرعهٔ خالی)
 * سکه: ۱۲۰ + فصل×۲۰ — کارت: ۵ قرعه (هر قرعه ۳۵٪ دو کارت) → حداقل ۵ کارت
 */
export function rollChallengeChest(chapter: number, rng: () => number = Math.random): ChestContents {
  const coins = 120 + Math.max(1, chapter) * 20;
  const cardMap = new Map<string, number>();
  const weights = TOWER_BUILD_ORDER.map((_, i) => Math.max(1.2, 10 - i * 0.85));
  const totalW = weights.reduce((a, b) => a + b, 0);
  for (let d = 0; d < 5; d++) {
    let r = rng() * totalW;
    let picked = TOWER_BUILD_ORDER[0];
    for (let i = 0; i < TOWER_BUILD_ORDER.length; i++) {
      r -= weights[i];
      if (r <= 0) { picked = TOWER_BUILD_ORDER[i]; break; }
    }
    const count = rng() < 0.35 ? 2 : 1;
    cardMap.set(picked, (cardMap.get(picked) ?? 0) + count);
  }
  return { coins, cards: toCards(cardMap), firstClear: true };
}

/**
 * پرداخت کارت‌های جعبه به سیو — برج مکس = فروش خودکار به سکه (v2.3)
 * تعداد سکهٔ حاصل از فروش کارت‌های برج مکس را برمی‌گرداند.
 */
export function payChestCards(save: SaveData, cards: ChestCard[]): number {
  let soldCoins = 0;
  for (const card of cards) {
    soldCoins += awardTowerCards(save, card.towerId, card.count);
  }
  return soldCoins;
}
