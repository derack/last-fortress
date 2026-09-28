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

export type ProjectileKind = 'bullet' | 'fireball' | 'frost' | 'shard' | 'beam' | 'none'
  | 'cannonball' | 'bolt' | 'venom' | 'prism' | 'hex';

// ---------------------------- برج‌ها ----------------------------

export interface TowerLevelStats {
  damage: number;
  range: number;
  fireRate: number; // شلیک در ثانیه
  upgradeCost: number; // هزینه ارتقا «از» این سطح به سطح بعد (سطح ۵ = ۰ یعنی حداکثر)
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
  poisonDps?: number; // برای زهر
  poisonDuration?: number;
  armorShred?: number; // کاهش زره هر اصابت (زهرخانه)
  pierceArmor?: boolean; // بی‌توجه به زره (بالیستا)
  executeThreshold?: number; // اجرای دشمن کمتر از این درصد HP (برج تهی)
  executeMultiplier?: number;
  buffRadius?: number; // هاله تقویت (آذرگاه)
  buffRatePct?: number; // درصد افزایش سرعت شلیک برج‌های اطراف
  towerHeight?: number; // ارتفاع دهانه شلیک (پیش‌فرض ۲.۸)
  color: number; // رنگ نئون UI
  /** حداقل مجموع ستاره‌های کمپین برای آزادسازی برج — ۰ یعنی از ابتدا باز */
  unlockStars?: number;
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
  healer?: { radius: number; amount: number; interval: number }; // شفادهنده — ترمیم HP هم‌رزما
  summoner?: { enemy: string; count: number; interval: number }; // احضارکننده دوره‌ای
  regen?: number; // HP بازسازی در ثانیه
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

export type MagicId = 'skyLightning' | 'fireRain' | 'arianaShield' | 'deepFreeze' | 'azarBlessing' | 'coreMend';

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
  /** یخبندان — کندی شدید به‌جای آسیب */
  freezeFactor?: number;
  /** برکت آذر — افزایش سرعت شلیک همه برج‌ها */
  rateBuffPct?: number;
  /** تندرستی هسته — بازگردانی HP هسته */
  healCore?: number;
  color: string; // رنگ CSS
}

// ---------------------------- قهرمان ----------------------------

export type HeroRole = 'commander' | 'guardian' | 'berserker' | 'ranger';

export interface HeroData {
  id: string;
  nameKey: string;
  titleKey: string;
  role: HeroRole;
  hp: number;
  damage: number;
  range: number;
  fireRate: number;
  moveSpeed: number;
  xpPerLevel: number;
  attackType: DamageType; // نوع آسیب حمله قهرمان
  projectileColor: number;
  splash?: number; // شعاع انفجار حمله (آریا)
  cleave?: number; // تعداد هدف اضافه حمله زمینی (رادین)
  abilityNameKey: string;
  abilityDescKey: string;
  abilityCooldown: number;
  abilityDuration: number;
  abilityBuff: number; // معنی بر اساس abilityKind
  abilityKind: 'battleCommand' | 'aegisShield' | 'warFrenzy' | 'rainOfArrows';
  unlockCost: number; // هزینه بازکردن با کریستال — ۰ یعنی رایگان
  descKey: string;
}

// ---------------------------- مرحله ----------------------------

export type RegionEnv = 'plains' | 'forest' | 'tundra' | 'volcano' | 'wastes' | 'citadel';

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
  env: RegionEnv;
  path: Vec2[];
  star2HealthPct: number; // حداقل درصد سلامت برای ستاره دوم
  star3ChallengeKey: string;
}

// ---------------------------- منطقه ----------------------------

export interface RegionDef {
  id: number;
  levelId: string;
  nameKey: string;
  env: RegionEnv;
  /** توضیح کوتاه برای نقشه */
  tagKey: string;
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
  /** قهرمانان باز‌شده — پیش‌فرض فقط آرمان */
  unlockedHeroes: string[];
  /** قهرمان انتخابی برای نبرد */
  selectedHero: string;
}
