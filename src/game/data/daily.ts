import { STAGES, isStageUnlocked, completedStageIds, stageId } from './campaign';
import { rollDailyChest, payChestCards, type ChestContents } from './chest';
import type { SaveData } from './types';

// ============================================================
// چرخهٔ روزانه — v2.3
// ------------------------------------------------------------
// ۱) جعبهٔ روزانه: هر روزِ تقویمی یک بار دریافت — زنجیرهٔ ورود
//    پیوسته تا ۷ روز پاداش را بزرگ‌تر می‌کند (ریتنشن).
// ۲) چالش روزانه: یک مرحلهٔ قطعیِ بر پایهٔ تاریخ + مادی‌فایر سختی؛
//    پیروزی در آن = جعبهٔ «کارت تضمینی» (حداقل ۵ کارت).
// هر دو تابع خالص با سیو کار می‌کنند — بدون وابستگی به React.
// ============================================================

/** کلید روزِ محلی — YYYY-MM-DD بر اساس ساعت دستگاه بازیکن */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** کلید روزِ گذشته — برای ادامهٔ زنجیرهٔ ورود */
function yesterdayKey(d: Date = new Date()): string {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return todayKey(y);
}

/** هش سبک رشتهٔ تاریخ — انتخاب قطعی مرحله/مادی‌فایر هر روز */
function dateSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// ---------------------------- جعبهٔ روزانه ----------------------------

export interface DailyChestState {
  /** امروز قابل دریافت است؟ */
  claimable: boolean;
  /** زنجیرهٔ فعلی ورود — اگر امروز دریافت شده، زنجیرهٔ همین روز */
  streak: number;
  /** اگر امروز دریافت شده، محتوای آن (برای UI) */
  claimed?: ChestContents;
}

/** وضعیت جعبهٔ روزانه از نگاه سیو — بدون تغییر سیو */
export function dailyChestState(save: SaveData, now: Date = new Date()): DailyChestState {
  const today = todayKey(now);
  const last = save.lastDailyClaim ?? '';
  if (last === today) {
    return { claimable: false, streak: save.dailyStreak ?? 0 };
  }
  // زنجیرهٔ پیش‌روی — اگر دیروز گرفته باشد زنجیره ادامه می‌یابد وگرنه از ۱
  const streak = last === yesterdayKey(now) ? (save.dailyStreak ?? 0) : 0;
  return { claimable: true, streak: streak + 1 };
}

/**
 * دریافت جعبهٔ روزانه — سیو را تغییر می‌دهد (سکه/کارت/زنجیره/تاریخ)
 * برگشت: محتوا + سکهٔ حاصل از فروش خودکار کارت‌های برج مکس
 */
export function claimDailyChest(
  save: SaveData,
  rng: () => number = Math.random,
  now: Date = new Date(),
): { chest: ChestContents; streak: number; soldCoins: number } | null {
  const st = dailyChestState(save, now);
  if (!st.claimable) return null;
  const chest = rollDailyChest(st.streak, rng);
  save.coins = Math.max(0, Math.floor((save.coins ?? 0) + chest.coins));
  const soldCoins = payChestCards(save, chest.cards);
  save.lastDailyClaim = todayKey(now);
  save.dailyStreak = st.streak;
  return { chest, streak: st.streak, soldCoins };
}

// ---------------------------- چالش روزانه ----------------------------

/** مادی‌فایر سختی چالش — روی دشمنان و بودجهٔ شروع اعمال می‌شود */
export interface DailyModifier {
  id: 'hardened' | 'swift' | 'siege' | 'famine';
  nameKey: string;
  descKey: string;
  hpMul: number;
  speedMul: number;
  /** ضریب سکهٔ شروع مرحله (۱ = بدون تغییر) */
  coinMul: number;
}

export const DAILY_MODIFIERS: Record<DailyModifier['id'], DailyModifier> = {
  hardened: { id: 'hardened', nameKey: 'challengeModHardened', descKey: 'challengeModHardenedDesc', hpMul: 1.35, speedMul: 1.0, coinMul: 1.0 },
  swift: { id: 'swift', nameKey: 'challengeModSwift', descKey: 'challengeModSwiftDesc', hpMul: 1.1, speedMul: 1.22, coinMul: 1.0 },
  siege: { id: 'siege', nameKey: 'challengeModSiege', descKey: 'challengeModSiegeDesc', hpMul: 1.25, speedMul: 1.1, coinMul: 0.8 },
  famine: { id: 'famine', nameKey: 'challengeModFamine', descKey: 'challengeModFamineDesc', hpMul: 1.18, speedMul: 1.06, coinMul: 0.7 },
};

const MODIFIER_POOL: DailyModifier['id'][] = ['hardened', 'swift', 'siege', 'famine'];

export interface DailyChallengeInfo {
  date: string;
  stageId: string;
  chapter: number;
  stage: number;
  modifier: DailyModifier;
  /** امروز با پیروزی پاداش گرفته؟ */
  done: boolean;
}

/**
 * چالش امروز — قطعی بر پایهٔ تاریخ و پیشرفت بازیکن:
 * فصل = بالاترین فصلِ آزاد، مرحله = یکی از مراحل ۷..۱۰ آزادِ همان فصل
 * (اگر هنوز به مرحلهٔ ۷ نرسیده، مرزِ فعلی پیشرفت). مادی‌فایر از هش تاریخ.
 */
export function getDailyChallenge(save: SaveData, now: Date = new Date()): DailyChallengeInfo {
  const date = todayKey(now);
  const seed = dateSeed(date);
  const completed = completedStageIds(save);

  // بالاترین فصلی که مرحلهٔ ۱‌اش آزاد است
  let topChapter = 1;
  for (let ch = 10; ch >= 1; ch--) {
    if (isStageUnlocked(ch, 1, completed)) { topChapter = ch; break; }
  }
  // بالاترین مرحلهٔ آزاد در آن فصل
  let maxStage = 1;
  for (let s = 10; s >= 1; s--) {
    if (isStageUnlocked(topChapter, s, completed)) { maxStage = s; break; }
  }

  // مرحلهٔ چالش: ترجیح مراحل پایانی (۷..۱۰) — سخت‌تر و پاداش بهتر
  const preferred = 7 + (seed % 4);
  const stage = Math.min(Math.max(preferred, 1), maxStage);
  const modId = MODIFIER_POOL[seed % MODIFIER_POOL.length];
  const id = stageId(topChapter, stage);

  return {
    date,
    stageId: STAGES[id] ? id : stageId(topChapter, maxStage),
    chapter: topChapter,
    stage,
    modifier: DAILY_MODIFIERS[modId],
    done: save.dailyChallenge?.date === date,
  };
}

/** آیا امروز چالش با پیروزی پاداش گرفته؟ */
export function isChallengeDoneToday(save: SaveData, now: Date = new Date()): boolean {
  return save.dailyChallenge?.date === todayKey(now);
}
