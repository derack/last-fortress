import * as THREE from 'three';
import type { TargetingMode, DamageType } from '../data/types';

// ============================================================
// Context بین موجودیت‌ها و موتور بازی — جلوگیری از import دایره‌ای
// ============================================================

/** یک مسیر حمله — نقاط نمونه‌برداری‌شده و طول واقعی */
export interface PathInfo {
  points: THREE.Vector3[];
  length: number;
}

export interface DamageableEnemy {
  id: number;
  getPos(): THREE.Vector3;
  takeDamage(amount: number, type: DamageType, pierceArmor?: boolean): boolean; // true = مرگ
  alive: boolean;
  data: { boss?: boolean; flying?: boolean; id: string };
  hpRatio: number;
  hp: number;
  maxHp: number;
  dist: number;
  speed: number;
  tier: number;
  /** مسیر فعلی دشمن — مراحل چندمسیره */
  pathIndex: number;
  applySlow(factor: number, duration: number): void;
  applyBurn(dps: number, duration: number): void;
  applyShred(amount: number, duration: number): void; // شکستن زره
  heal(amount: number): void; // شفادهنده‌ها
  hasShield(): boolean;
}

/** رابط هیرو برای دشمنان — هدف‌گیری و آسیب‌زدن قهرمان */
export interface HeroRef {
  getPos(): THREE.Vector3;
  /** فقط وقتی استقرار یافته و زنده است true */
  alive: boolean;
  /** آسیب از دشمن — مرگ ریسپاون را فعال می‌کند */
  takeDamage(amount: number): void;
}

export interface GameContext {
  /** همه مسیرهای حمله (۱ تا ۳) — همه به هسته ختم می‌شوند */
  paths: PathInfo[];
  /** مسیر اصلی (۰) — سازگاری با کد موجود */
  pathPoints: THREE.Vector3[];
  pathLength: number;
  corePos: THREE.Vector3;
  enemies: DamageableEnemy[];
  towers: TowerLike[];
  /** قهرمان — دشمنان در برد، حمله‌اش می‌کنند (null تا استقرار) */
  heroRef: HeroRef | null;
  vfx: {
    burst(pos: THREE.Vector3, color: number, count: number, opts?: { speed?: number; life?: number; size?: number; gravity?: number; up?: number; spread?: number }): void;
    hitSpark(pos: THREE.Vector3, color: number): void;
    explosion(pos: THREE.Vector3, color: number, big?: boolean): void;
    bolt(from: THREE.Vector3, to: THREE.Vector3, color?: number, thick?: boolean): void;
    ring(pos: THREE.Vector3, color: number, maxRadius: number, life?: number): void;
    magicCircle(pos: THREE.Vector3, color: number, radius: number, duration: number): void;
  };
  audio: { play(name: string): void };
  cameraShake(amount: number): void;
  /** فاز ۶ — بخش ۱۴ — لرزش هپتیک (فقط اندروید، gated توسط تنظیمات) */
  haptic(pattern: number | number[]): void;
  spawnProjectile(kind: string, from: THREE.Vector3, target: DamageableEnemy | null, opts: { damage: number; splash?: number; burn?: number; slow?: number; slowDur?: number; color: number; dmgType?: DamageType; poisonDps?: number; poisonDur?: number; pierceArmor?: boolean }): void;
  chainLightning(from: THREE.Vector3, firstTarget: DamageableEnemy, chains: number, damage: number, color: number): void;
  scheduleFireBarrage(center: THREE.Vector3, radius: number, count: number, damage: number, visual?: 'fire' | 'arrow'): void;
  summonAt(pos: THREE.Vector3, enemyId?: string): void;
  requestCoreShield(duration: number): void; // سپر اثری آریا
  onEnemyKilled(enemy: DamageableEnemy): void;
  onEnemyLeak(enemy: DamageableEnemy): void;
  heroDamageBuff: number; // ضریب افزایش آسیب از قهرمان
  towerRateBuff: number; // ضریب افزایش سرعت شلیک (فرمان نبرد)
  /** کوره اثیر — آسیب دائمی برج‌ها (مثال ۰٫۲ = +۲۰٪) */
  towerDamageBuff: number;
  /** کوره اثیر — برد دائمی برج‌ها */
  towerRangeBuff: number;
  /** کوره اثیر — آسیب دائمی قهرمان */
  forgeHeroDamage: number;
  /** کوره اثیر — تندرستی دائمی قهرمان */
  forgeHeroHp: number;
  /** از کار انداختن موقت برج — فوران غول آتش/نفس اژدها/آئورای یخ */
  disableTower(towerId: number, duration: number, color?: number): void;
  /** نمایش بنر «فاز دوم» Boss در UI */
  onBossPhase(nameKey: string, color: number): void;
  /** بخش ۱۴ — شانس آسیب انتقاد (۰٫۱ = ۱۰٪) */
  critChance: number;
  /** بخش ۱۴ — ضریب آسیب انتقاد */
  critMult: number;
  /** بخش ۱۴ — عدد آسیب شناور — تجمیع per-enemy در موتور */
  showDamage(enemyId: number, pos: THREE.Vector3, amount: number, crit: boolean): void;
  /** زمان بازی (ثانیه از شروع نبرد) — پایهٔ زمانی یکسان همهٔ افکت‌های موقتی (کندی/سوزش/شکستن زره) */
  gameTime: number;
  // —— آهنگری آذر: ارتقاهای دائمی از سیو (۰ بدون ارتقا — اثر فقط با خرید در پنل آهنگری) ——
  /** ضریب آسیب دائمی هر برج از سطح آهنگری (۰٫۰۶ در هر سطح) */
  towerMetaDamage: (towerId: string) => number;
  /** ضریب نرخ شلیک دائمی هر برج (۰٫۰۳ در هر سطح) */
  towerMetaRate: (towerId: string) => number;
  /** ضریب برد دائمی هر برج (۰٫۰۲ در هر سطح) */
  towerMetaRange: (towerId: string) => number;
  /** ضریب آسیب دائمی قهرمان (۰٫۰۸ در هر سطح) */
  heroMetaDamage: (heroId: string) => number;
  /** ضریب تندرستی دائمی قهرمان (۰٫۰۸ در هر سطح) */
  heroMetaHp: (heroId: string) => number;
}

export interface TowerLike {
  id: number;
  towerId: string;
  position: THREE.Vector3;
  damage: number;
  range: number;
  targeting: TargetingMode;
  alive: boolean;
}
