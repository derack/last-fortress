import type { SaveData, Language, Quality } from '../data/types';

// ============================================================
// سیستم ذخیره‌سازی — Offline با localStorage
// ============================================================

const KEY = 'last_fortress_save_v1';

/** نگاشت مراحل قدیمی (l1..l6) به فصل‌های کمپین ۱۰۰ مرحله‌ای */
const LEGACY_LEVEL_TO_CHAPTER: Record<string, number> = {
  l1: 1, l2: 2, l3: 3, l4: 4, l5: 5, l6: 10,
};

/** مهاجرت ذخیره نسخه ۲ → نسخه ۳ — افزودن کوره اثیر (ارتقاهای دائمی) */
function migrateV2toV3(data: SaveData): SaveData {
  if (!data.forge || typeof data.forge !== 'object') data.forge = {};
  // پاکسازی مقادیر نامعتبر — سطح بین ۰ و ۲۰
  for (const k of Object.keys(data.forge)) {
    const v = data.forge[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      delete data.forge[k];
    } else {
      data.forge[k] = Math.min(20, Math.floor(v));
    }
  }
  data.version = 3;
  return data;
}

/** مهاجرت ذخیره نسخه ۱ → نسخه ۲ — مراحل قدیمی به فصل‌ها اعتبار داده می‌شوند */
function migrateV1toV2(data: SaveData): SaveData {
  for (const [legacyId, chapterId] of Object.entries(LEGACY_LEVEL_TO_CHAPTER)) {
    const rec = data.levels[legacyId];
    if (!rec?.completed) continue;
    for (let s = 1; s <= 10; s++) {
      const sid = `c${chapterId}s${s}`;
      if (!data.levels[sid]) {
        data.levels[sid] = { stars: rec.stars, bestHealthPct: rec.bestHealthPct, completed: true };
      }
    }
    delete data.levels[legacyId];
  }
  // بازمحاسبه مجموع ستاره‌ها
  data.stats.totalStars = Object.values(data.levels).reduce((sum, l) => sum + l.stars, 0);
  data.version = 2;
  return data;
}

export function defaultSave(): SaveData {
  return {
    version: 3,
    settings: { language: 'fa', quality: 'medium', music: 0.6, sfx: 0.8, haptics: true },
    levels: {},
    crystals: 0,
    knowledge: 0,
    stats: {
      kills: 0,
      bossKills: 0,
      magicCasts: 0,
      wavesSurvived: 0,
      victories: 0,
      towersBuilt: 0,
      upgrades: 0,
      totalStars: 0,
      skyLightningCasts: 0,
      fireRainCasts: 0,
      shieldCasts: 0,
    },
    achievements: [],
    tutorialDone: false,
    unlockedHeroes: ['arman'],
    selectedHero: 'arman',
    forge: {},
    heroUpgrades: {},
    towerUpgrades: {},
  };
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as SaveData;
    const base = defaultSave();
    // سخت‌سازی رکوردهای مراحل — سیو فاسد (stars=NaN/string) نباید ستاره‌ها و برج‌های ستاره‌ای را مسموم کند
    const levels: SaveData['levels'] = {};
    for (const [id, rec] of Object.entries(data.levels ?? {})) {
      if (!rec || typeof rec !== 'object') continue;
      const stars = Math.max(0, Math.min(3, Math.floor(Number((rec as { stars?: unknown }).stars) || 0)));
      const hp = Math.max(0, Math.min(100, Math.floor(Number((rec as { bestHealthPct?: unknown }).bestHealthPct) || 0)));
      levels[id] = { stars, bestHealthPct: hp, completed: !!(rec as { completed?: unknown }).completed };
    }
    const clampCur = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
    const merged: SaveData = {
      ...base,
      ...data,
      settings: { ...base.settings, ...data.settings },
      stats: { ...base.stats, ...data.stats },
      levels,
      achievements: Array.isArray(data.achievements) ? data.achievements.filter((a) => typeof a === 'string') : [],
      // اقتصاد — مقادیر منفی/NaN از دستکاری سیو عبور نمی‌کنند
      crystals: clampCur(data.crystals),
      knowledge: clampCur(data.knowledge),
      // مهاجرت ذخیره‌های قدیمی — قهرمانان
      unlockedHeroes: data.unlockedHeroes?.length ? data.unlockedHeroes.filter((h) => typeof h === 'string') : ['arman'],
      selectedHero: data.selectedHero ?? 'arman',
      // کوره اثیر — مقادیر نامعتبر پاک می‌شوند
      forge: { ...(data.forge ?? {}) },
      // آهنگری — ارتقاهای دائمی قهرمان/برج (مهاجرت ذخیره‌های قدیمی)
      heroUpgrades: { ...(data.heroUpgrades ?? {}) },
      towerUpgrades: { ...(data.towerUpgrades ?? {}) },
    };
    // قهرمان انتخابی باید واقعاً باز باشد — سیو دستکاری‌شده بازیکن را به قهرمان قفل نمی‌برد
    if (!merged.unlockedHeroes.includes(merged.selectedHero)) {
      merged.selectedHero = merged.unlockedHeroes.includes('arman') ? 'arman' : (merged.unlockedHeroes[0] ?? 'arman');
    }
    // مهاجرت نسخه ۱ → ۲ — کمپین ۱۰۰ مرحله‌ای
    if (!data.version || data.version < 2) {
      migrateV1toV2(merged);
    }
    // مهاجرت نسخه ۲ → ۳ — کوره اثیر
    if (!data.version || data.version < 3) {
      return migrateV2toV3(merged);
    }
    // بازمحاسبه ستاره‌ها از رکوردهای پاک‌سازی‌شده
    merged.stats.totalStars = Object.values(merged.levels).reduce((s, l) => s + l.stars, 0);
    return merged;
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    // پل iframe — صفحات مستقل به پنجره والد خبر می‌دهند که ذخیره عوض شد
    window.dispatchEvent(new CustomEvent('savePersisted'));
  } catch {
    // حافظه پر است — نادیده بگیر
  }
}

export function resetSave() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export type { Language, Quality };
