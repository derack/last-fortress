import type { DamageType } from './types';

// ============================================================
// فاز دوم اختصاصی هر Boss — کاملاً Data-Driven (بخش Boss_wave)
// ------------------------------------------------------------
// هر Boss در نیمه دوم HP شخصیت خودش را عوض می‌کند:
//  - پادشاه غول سنگی: پوست سنگی + ضربه زمین یخ‌زده‌کننده
//  - غول آتش:        خشم آتشین — بدن مذاب، ایمنی به کندی، فوران آتشی
//  - غول یخ:         انجماد ابدی — انجماد برج‌ها و بازسازی یخی
//  - اژدهای سیاه:    خشم آسمانی — نفس سایه و احضار اژدهای کوچک
//  - محوکننده:       پروتکل نابودی — لیزر هدفمند و بازسازی مکانیکی
//  - ارباب تاریکی:   تجلی تاریکی — سپر اربابی و احضار بی‌وقفه
// ============================================================

export type PhaseAbilityKind = 'towerStun' | 'frostAura' | 'eruption' | 'summon';

export interface BossPhase2Config {
  /** کلید ترجمه نام فاز — روی بنر نمایش داده می‌شود */
  nameKey: string;
  /** رنگ جلوه‌های فاز (VFX و بنر) */
  color: number;
  /** ضریب زره هنگام ورود به فاز */
  armorMult: number;
  /** ضریب سرعت هنگام ورود به فاز */
  speedMult: number;
  /** ایمنی به کندی/یخ (بدن مذاب غول آتش و غول یخ) */
  slowImmune?: boolean;
  /** بازسازی اضافه HP در ثانیه */
  regenBonus?: number;
  /** سپر فوری هنگام ورود به فاز */
  shieldHp?: number;
  /** کاهش درصدی آسیب وارده در فاز ۲ (پوست سنگی) */
  damageReductionPct?: number;
  /** احضار لحظه ورود به فاز */
  onEnterSummon?: { enemy: string; count: number };
  /** توانایی دوره‌ای در طول فاز ۲ */
  periodic?: {
    kind: PhaseAbilityKind;
    interval: number;
    /** شعاع اثر (frostAura/eruption) */
    radius?: number;
    /** مدت از کار انداختن برج‌ها */
    duration?: number;
    /** تعداد برج هدف */
    towerCount?: number;
    /** تعداد و نوع احضار */
    count?: number;
    enemy?: string;
    /** نوع آسیب بصری برای vfx.bolt */
    element?: DamageType;
  };
}

export const BOSS_PHASE2: Record<string, BossPhase2Config> = {
  golemKing: {
    nameKey: 'golemKingPhase2',
    color: 0xf59e0b,
    armorMult: 1.5,
    speedMult: 1.1,
    damageReductionPct: 0.15, // پوست سنگی
    onEnterSummon: { enemy: 'golem', count: 2 },
    periodic: {
      kind: 'towerStun',
      interval: 9,
      duration: 2.5,
      towerCount: 1,
      element: 'physical',
    },
  },

  fireGiant: {
    nameKey: 'fireGiantPhase2',
    color: 0xf97316,
    armorMult: 1.2,
    speedMult: 1.3,
    slowImmune: true, // بدن مذاب — یخ و کندی بی‌اثر
    regenBonus: 8,
    onEnterSummon: { enemy: 'warrior', count: 3 },
    periodic: {
      kind: 'eruption',
      interval: 9,
      radius: 7,
      duration: 3,
      towerCount: 2,
      element: 'fire',
    },
  },

  iceGiant: {
    nameKey: 'iceGiantPhase2',
    color: 0x7dd3fc,
    armorMult: 1.45,
    speedMult: 1.05,
    slowImmune: true, // خودش تجسم سرماست
    regenBonus: 12,
    periodic: {
      kind: 'frostAura',
      interval: 10,
      radius: 9,
      duration: 4,
      element: 'ice',
    },
  },

  blackDragon: {
    nameKey: 'blackDragonPhase2',
    color: 0x8b5cf6,
    armorMult: 1.3,
    speedMult: 1.4, // خشم آسمانی — پرواز سریع‌تر
    onEnterSummon: { enemy: 'smallDragon', count: 2 },
    periodic: {
      kind: 'towerStun',
      interval: 8,
      duration: 3.5,
      towerCount: 2,
      element: 'shadow',
    },
  },

  annihilator: {
    nameKey: 'annihilatorPhase2',
    color: 0xf43f5e,
    armorMult: 1.25,
    speedMult: 1.2,
    regenBonus: 25, // دو برابر شدن بازسازی مکانیکی
    periodic: {
      kind: 'towerStun',
      interval: 6,
      duration: 2,
      towerCount: 1,
      element: 'energy',
    },
  },

  darkLord: {
    nameKey: 'darkLordPhase2',
    color: 0xa855f7,
    armorMult: 1.35,
    speedMult: 1.15,
    shieldHp: 1200,
    onEnterSummon: { enemy: 'shadowSoldier', count: 4 },
    periodic: {
      kind: 'summon',
      interval: 10,
      count: 3,
      enemy: 'shadowSoldier',
      element: 'shadow',
    },
  },
};

export function getBossPhase2(id: string): BossPhase2Config | null {
  return BOSS_PHASE2[id] ?? null;
}
