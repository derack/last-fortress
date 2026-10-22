import { TOWER_BUILD_ORDER } from './towers';

// ============================================================
// جعبهٔ غنیمت — پاداش پس از هر پیروزی
// ------------------------------------------------------------
// محتوا: سکه (کیف پول متا) + کارت برج (برای ارتقای دائمی با سکه)
// اولین فتح مرحله = جعبه بزرگ (سکه ×۲ و کارت بیشتر)
// تکرار مرحله هم جعبه می‌دهد ولی کوچک‌تر — فارم بی‌نهایت نیست
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

  // وزن هر برج بر اساس جایگاه در نردبان باز شدن — برج‌های ابتدایی رایج‌تر
  const weights = TOWER_BUILD_ORDER.map((_, i) => Math.max(1.2, 10 - i * 0.85));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const draws = firstClear ? 4 : stars >= 3 ? 3 : 2;
  const cardMap = new Map<string, number>();
  for (let d = 0; d < draws; d++) {
    let r = rng() * totalW;
    let picked = TOWER_BUILD_ORDER[0];
    for (let i = 0; i < TOWER_BUILD_ORDER.length; i++) {
      r -= weights[i];
      if (r <= 0) { picked = TOWER_BUILD_ORDER[i]; break; }
    }
    // ۳۰٪ قرعه‌ها دو کارت می‌دهند
    const count = rng() < 0.3 ? 2 : 1;
    cardMap.set(picked, (cardMap.get(picked) ?? 0) + count);
  }

  return {
    coins,
    cards: [...cardMap.entries()].map(([towerId, count]) => ({ towerId, count })),
    firstClear,
  };
}
