import type { SaveData } from './types';

// ============================================================
// کوره اثیر (Aether Forge) — ارتقاهای دائمی ۲۰ سطحی
// ------------------------------------------------------------
// ارز: ذرات اثیر — از پیروزی در مراحل کمپین به‌دست می‌آیند
// ۶ مسیر ارتقا × ۲۰ سطح — همه روی هر نبرد اعمال می‌شوند:
//   قهرمان (آسیب/تندرستی) + برج‌ها (آسیب/برد) + دژ (اقتصاد/هسته)
// طبق PROMPT نهایی بخش ۱۸ + درخواست کاربر: سقف ۲۰ سطح
// ============================================================

export type ForgeTrackId =
  | 'heroAttack'
  | 'heroVitality'
  | 'towerDamage'
  | 'towerRange'
  | 'economy'
  | 'coreFort';

export interface ForgeTrack {
  id: ForgeTrackId;
  nameKey: string;
  descKey: string;
  /** ضریب اثر هر سطح — مثال ۰٫۰۶ یعنی +۶٪ در هر سطح */
  effectPerLevel: number;
  /** کلید الگوی نمایش اثر — {0} درصد فعلی، {1} درصد سطح بعد */
  effectKey: string;
  /** رنگ نئون UI */
  color: string;
  /** حداکثر سطح — طبق طراحی ۲۰ */
  maxLevel: number;
}

export const FORGE_MAX = 20;

export const FORGE_TRACKS: ForgeTrack[] = [
  {
    id: 'heroAttack',
    nameKey: 'forgeHeroAttack',
    descKey: 'forgeHeroAttackDesc',
    effectPerLevel: 0.06,
    effectKey: 'forgeEffectDamage',
    color: '#fbbf24',
    maxLevel: FORGE_MAX,
  },
  {
    id: 'heroVitality',
    nameKey: 'forgeHeroVitality',
    descKey: 'forgeHeroVitalityDesc',
    effectPerLevel: 0.06,
    effectKey: 'forgeEffectHealth',
    color: '#4ade80',
    maxLevel: FORGE_MAX,
  },
  {
    id: 'towerDamage',
    nameKey: 'forgeTowerDamage',
    descKey: 'forgeTowerDamageDesc',
    effectPerLevel: 0.05,
    effectKey: 'forgeEffectDamage',
    color: '#f97316',
    maxLevel: FORGE_MAX,
  },
  {
    id: 'towerRange',
    nameKey: 'forgeTowerRange',
    descKey: 'forgeTowerRangeDesc',
    effectPerLevel: 0.02,
    effectKey: 'forgeEffectRange',
    color: '#38bdf8',
    maxLevel: FORGE_MAX,
  },
  {
    id: 'economy',
    nameKey: 'forgeEconomy',
    descKey: 'forgeEconomyDesc',
    effectPerLevel: 0.04,
    effectKey: 'forgeEffectCoins',
    color: '#facc15',
    maxLevel: FORGE_MAX,
  },
  {
    id: 'coreFort',
    nameKey: 'forgeCoreFort',
    descKey: 'forgeCoreFortDesc',
    effectPerLevel: 0.03,
    effectKey: 'forgeEffectCore',
    color: '#a78bfa',
    maxLevel: FORGE_MAX,
  },
];

/** هزینه ارتقا از «level» به «level+1» — منحنی رشد ۱٫۲۲ با پله هر ۵ سطح */
export function forgeNextCost(trackId: ForgeTrackId, level: number): number {
  if (level >= FORGE_MAX) return 0;
  const base = trackId === 'towerRange' ? 3 : 2;
  const step = Math.floor(level / 5);
  return Math.ceil(base * Math.pow(1.22, level)) + step + level; // +level → اکیداً صعودی (بدون فلات ceil)
}

/** سطح فعلی یک مسیر از ذخیره — پیش‌فرض ۰ */
export function forgeLevel(save: SaveData | null, trackId: ForgeTrackId): number {
  if (!save) return 0;
  return Math.min(FORGE_MAX, Math.max(0, save.forge?.[trackId] ?? 0));
}

/** مجموع اثر یک مسیر به‌صورت ضریب (مثال ۰٫۶ = +۶۰٪) */
export function forgePct(save: SaveData | null, trackId: ForgeTrackId): number {
  const t = FORGE_TRACKS.find((x) => x.id === trackId);
  if (!t) return 0;
  return forgeLevel(save, trackId) * t.effectPerLevel;
}

/** مجموع سطوح خریداری‌شده — برای نمایش پیشرفت کل */
export function forgeTotalLevels(save: SaveData | null): number {
  if (!save?.forge) return 0;
  let sum = 0;
  for (const t of FORGE_TRACKS) sum += forgeLevel(save, t.id);
  return sum;
}
