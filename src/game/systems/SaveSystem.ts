import type { SaveData, Language, Quality } from '../data/types';

// ============================================================
// سیستم ذخیره‌سازی — Offline با localStorage
// ============================================================

const KEY = 'last_fortress_save_v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
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
    },
    achievements: [],
    tutorialDone: false,
    unlockedHeroes: ['arman'],
    selectedHero: 'arman',
  };
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as SaveData;
    const base = defaultSave();
    return {
      ...base,
      ...data,
      settings: { ...base.settings, ...data.settings },
      stats: { ...base.stats, ...data.stats },
      levels: data.levels ?? {},
      achievements: data.achievements ?? [],
      // مهاجرت ذخیره‌های قدیمی — قهرمانان
      unlockedHeroes: data.unlockedHeroes?.length ? data.unlockedHeroes : ['arman'],
      selectedHero: data.selectedHero ?? 'arman',
    };
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // حافظه پر است — نادیده بگیر
  }
}

export function resetSave() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export type { Language, Quality };
