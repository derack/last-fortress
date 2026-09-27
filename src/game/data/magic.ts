import type { MagicData, HeroData } from './types';

// ============================================================
// جادوهای بازیکن (Vertical Slice: ۳ جادو از ۶ جادو)
// ============================================================

export const MAGIC: Record<string, MagicData> = {
  skyLightning: {
    id: 'skyLightning',
    nameKey: 'magicSkyLightning',
    descKey: 'magicSkyLightningDesc',
    crystalCost: 15,
    cooldown: 25,
    radius: 4.2,
    damage: 260,
    targeted: true,
    color: '#a78bfa',
  },
  fireRain: {
    id: 'fireRain',
    nameKey: 'magicFireRain',
    descKey: 'magicFireRainDesc',
    crystalCost: 25,
    cooldown: 45,
    radius: 5.5,
    damage: 38,
    duration: 4,
    targeted: true,
    color: '#fb923c',
  },
  arianaShield: {
    id: 'arianaShield',
    nameKey: 'magicArianaShield',
    descKey: 'magicArianaShieldDesc',
    crystalCost: 20,
    cooldown: 60,
    radius: 6,
    duration: 10,
    targeted: false,
    color: '#fbbf24',
  },
};

export const MAGIC_IDS = ['skyLightning', 'fireRain', 'arianaShield'];

// ============================================================
// قهرمان — آرمان، فرمانده آخرین سنگر
// ============================================================

export const HEROES: Record<string, HeroData> = {
  arman: {
    id: 'arman',
    nameKey: 'heroArman',
    titleKey: 'heroArmanTitle',
    hp: 600,
    damage: 26,
    range: 10,
    fireRate: 2.0,
    moveSpeed: 6,
    xpPerLevel: 120,
    abilityNameKey: 'heroCommand',
    abilityDescKey: 'heroCommandDesc',
    abilityCooldown: 32,
    abilityDuration: 8,
    abilityBuff: 40,
  },
};

export const HERO_ROSTER = [
  { id: 'arman', unlocked: true },
  { id: 'aria', unlocked: false },
  { id: 'radin', unlocked: false },
  { id: 'nila', unlocked: false },
];

export const HERO_META = {
  aria: { nameKey: 'heroAria', titleKey: 'heroAriaTitle' },
  radin: { nameKey: 'heroRadin', titleKey: 'heroRadinTitle' },
  nila: { nameKey: 'heroNila', titleKey: 'heroNilaTitle' },
};
