// ============================================================
// آخرین سنگر — انواع داده‌ای مرکزی (Data-Driven Design)
// ============================================================

export type Language = 'fa' | 'en';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface Vec2 {
  x: number;
  z: number;
}

export type DamageType = 'physical' | 'magic' | 'fire' | 'ice' | 'shadow' | 'energy';

export type TargetingMode = 'first' | 'strongest' | 'weakest' | 'fastest' | 'boss';

export type ProjectileKind = 'bullet' | 'fireball' | 'frost' | 'shard' | 'beam' | 'none';

// ---------------------------- برج‌ها ----------------------------

export interface TowerLevelStats {
  damage: number;
  range: number;
  fireRate: number; // شلیک در ثانیه
  upgradeCost: number; // هزینه ارتقا به این سطح (سطح ۱ = هزینه ساخت)
}

export interface TowerData {
  id: string;
  nameKey: string;
  descKey: string;
  abilityNameKey: string;
  abilityDescKey: string;
  abilityCooldown: number;
  cost: number;
  damageType: DamageType;
  canHitAir: boolean;
  projectile: ProjectileKind;
  splashRadius?: number;
  chainCount?: number; // برای صاعقه
  slowFactor?: number; // برای یخ
  slowDuration?: number;
  burnDps?: number; // برای آتش
  color: number; // رنگ نئون UI
  levels: TowerLevelStats[];
}

// ---------------------------- دشمنان ----------------------------

export interface EnemyData {
  id: string;
  nameKey: string;
  hp: number;
  speed: number;
  armor: number;
  reward: number;
  crystalReward?: number;
  coreDamage: number;
  flying?: boolean;
  dodgeChance?: number;
  shieldGiver?: { radius: number; amount: number; interval: number };
  boss?: boolean;
  scale: number;
  color: number;
  accent: number;
  resist?: Partial<Record<DamageType, number>>;
}

// ---------------------------- موج‌ها ----------------------------

export interface SpawnGroup {
  enemy: string;
  count: number;
  interval: number; // فاصله زمانی بین اسپاون (ثانیه)
  delay: number; // تاخیر شروع گروه
  tier: number;
}

export interface WaveData {
  groups: SpawnGroup[];
  boss?: boolean;
  coinBonus: number;
  crystalBonus?: number;
}

// ---------------------------- جادو ----------------------------

export type MagicId = 'skyLightning' | 'fireRain' | 'arianaShield';

export interface MagicData {
  id: MagicId;
  nameKey: string;
  descKey: string;
  crystalCost: number;
  cooldown: number;
  radius: number;
  damage?: number;
  duration?: number;
  targeted: boolean;
  color: string; // رنگ CSS
}

// ---------------------------- قهرمان ----------------------------

export interface HeroData {
  id: string;
  nameKey: string;
  titleKey: string;
  hp: number;
  damage: number;
  range: number;
  fireRate: number;
  moveSpeed: number;
  xpPerLevel: number;
  abilityNameKey: string;
  abilityDescKey: string;
  abilityCooldown: number;
  abilityDuration: number;
  abilityBuff: number; // درصد افزایش سرعت شلیک برج‌ها
}

// ---------------------------- مرحله ----------------------------

export interface LevelData {
  id: string;
  region: number;
  nameKey: string;
  descKey: string;
  coreHp: number;
  startCoins: number;
  startCrystals: number;
  waves: WaveData[];
  timeOfDay: 'day' | 'night';
  env: 'plains';
  path: Vec2[];
  star2HealthPct: number; // حداقل درصد سلامت برای ستاره دوم
  star3ChallengeKey: string;
}

// ---------------------------- دستاورد ----------------------------

export interface PlayerStats {
  kills: number;
  bossKills: number;
  magicCasts: number;
  wavesSurvived: number;
  victories: number;
  towersBuilt: number;
  upgrades: number;
  totalStars: number;
}

export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  crystalReward: number;
  check: (s: PlayerStats) => boolean;
}

// ---------------------------- ذخیره‌سازی ----------------------------

export interface LevelRecord {
  stars: number;
  bestHealthPct: number;
  completed: boolean;
}

export interface SettingsData {
  language: Language;
  quality: Quality;
  music: number; // 0..1
  sfx: number; // 0..1
  haptics: boolean;
}

export interface SaveData {
  version: number;
  settings: SettingsData;
  levels: Record<string, LevelRecord>;
  crystals: number;
  knowledge: number;
  stats: PlayerStats;
  achievements: string[];
  tutorialDone: boolean;
}
