// ============================================================
// Asset Manifest — منبع واحد حقیقت برای همه Assetهای سه‌بعدی
// ------------------------------------------------------------
// هر کاراکتر یک فایل GLB مستقل دارد. این فایل‌ها باید در
// public/assets/3d/... قرار بگیرند. به محض قرار گرفتن فایل واقعی،
// AssetManager آن را Load می‌کند — بدون هیچ تغییری در کد Gameplay.
//
// قالب: GLB (glTF 2.0 Binary) — جهت Forward استاندارد: +Z
// ارتفاع: targetHeight بر حسب World Unit (قبل از ضریب scale داده)
// ============================================================

export type AssetCategory = 'heroes' | 'enemies' | 'bosses' | 'towers';

/** slice: در Vertical Slice استفاده می‌شود (preload) — future: محتوا آینده (lazy) */
export type AssetPhase = 'slice' | 'future';

export interface CharacterAssetEntry {
  /** شناسه یکتا — با id داده‌های Gameplay (EnemyData.id / HeroData.id / TowerData.id) یکی است */
  id: string;
  category: AssetCategory;
  /** مسیر فایل GLB داخل public */
  file: string;
  displayName: { fa: string; en: string };
  /** برچسب سطح برای گالری */
  tier: string;
  /** ارتفاع پایه مدل به World Unit — normalizeModel مدل را دقیقاً به این ارتفاع می‌رساند.
   *  برای دشمنان این ارتفاع در scale 1 است؛ ضریب data.scale و Tier جداگانه اعمال می‌شود. */
  targetHeight: number;
  /** اصلاح جهت — اگر مدل به‌جای +Z رو به جهت دیگری باشد (درجه) */
  rotationOffsetDeg: number;
  /** انیمیشن‌های مورد انتظار داخل GLB (نام‌های استاندارد) */
  animations: string[];
  /** نقاط VFX مورد انتظار (WeaponPoint / HeadPoint / ChestPoint / HitPoint / muzzlePoint / mouthPoint / staffPoint) */
  vfxPoints: string[];
  /** فاز محتوایی — slice یعنی در بازی فعلی استفاده می‌شود */
  phase: AssetPhase;
  /** کلید مشخصات مدل‌سازی در AssetSpecifications */
  specId: string;
  /** پیش‌بینی حجم فایل (برای گزارش) */
  estSizeMB?: number;
}

const HERO_ANIMS = ['Idle', 'Walk', 'Run', 'Attack', 'Skill', 'Hit', 'Death', 'Victory'];
const ENEMY_ANIMS = ['Idle', 'Walk', 'Attack', 'Hit', 'Death'];
const BOSS_ANIMS = ['Idle', 'Walk', 'Attack1', 'Attack2', 'SpecialAttack', 'Roar', 'Hit', 'PhaseChange', 'Death'];
const HUMAN_POINTS = ['chestPoint', 'headPoint', 'hitPoint'];
const WEAPON_POINTS = ['weaponPoint', ...HUMAN_POINTS];

export const ASSETS: { heroes: CharacterAssetEntry[]; enemies: CharacterAssetEntry[]; bosses: CharacterAssetEntry[]; towers: CharacterAssetEntry[] } = {
  // ---------------------------- قهرمانان ----------------------------
  heroes: [
    {
      id: 'arman',
      category: 'heroes',
      file: '/assets/3d/heroes/arman.glb',
      displayName: { fa: 'آرمان', en: 'Arman' },
      tier: 'Legendary',
      targetHeight: 1.85,
      rotationOffsetDeg: 0,
      animations: HERO_ANIMS,
      vfxPoints: ['muzzlePoint', 'weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
      phase: 'slice',
      specId: 'arman',
      estSizeMB: 4,
    },
    {
      id: 'aria',
      category: 'heroes',
      file: '/assets/3d/heroes/aria.glb',
      displayName: { fa: 'آریا', en: 'Aria' },
      tier: 'Epic',
      targetHeight: 1.78,
      rotationOffsetDeg: 0,
      animations: HERO_ANIMS,
      vfxPoints: WEAPON_POINTS,
      phase: 'future',
      specId: 'aria',
      estSizeMB: 4,
    },
    {
      id: 'radin',
      category: 'heroes',
      file: '/assets/3d/heroes/radin.glb',
      displayName: { fa: 'رادین', en: 'Radin' },
      tier: 'Epic',
      targetHeight: 1.95,
      rotationOffsetDeg: 0,
      animations: HERO_ANIMS,
      vfxPoints: WEAPON_POINTS,
      phase: 'future',
      specId: 'radin',
      estSizeMB: 5,
    },
    {
      id: 'nila',
      category: 'heroes',
      file: '/assets/3d/heroes/nila.glb',
      displayName: { fa: 'نیلا', en: 'Nila' },
      tier: 'Epic',
      targetHeight: 1.75,
      rotationOffsetDeg: 0,
      animations: HERO_ANIMS,
      vfxPoints: WEAPON_POINTS,
      phase: 'future',
      specId: 'nila',
      estSizeMB: 4,
    },
  ],

  // ---------------------------- دشمنان ----------------------------
  enemies: [
    {
      id: 'shadow',
      category: 'enemies',
      file: '/assets/3d/enemies/shadow-creature.glb',
      displayName: { fa: 'موجود سایه', en: 'Shadow Creature' },
      tier: 'Common',
      targetHeight: 1.45,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['chestPoint', 'hitPoint'],
      phase: 'slice',
      specId: 'shadow',
      estSizeMB: 1.5,
    },
    {
      id: 'warrior',
      category: 'enemies',
      file: '/assets/3d/enemies/dark-warrior.glb',
      displayName: { fa: 'جنگجوی تاریکی', en: 'Dark Warrior' },
      tier: 'Common',
      targetHeight: 1.8,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['weaponPoint', ...HUMAN_POINTS],
      phase: 'slice',
      specId: 'warrior',
      estSizeMB: 2,
    },
    {
      id: 'golem',
      category: 'enemies',
      file: '/assets/3d/enemies/stone-golem.glb',
      displayName: { fa: 'غول سنگی', en: 'Stone Golem' },
      tier: 'Elite',
      targetHeight: 2.6,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['chestPoint', 'headPoint', 'hitPoint'],
      phase: 'slice',
      specId: 'golem',
      estSizeMB: 2.5,
    },
    {
      id: 'spider',
      category: 'enemies',
      file: '/assets/3d/enemies/dark-spider.glb',
      displayName: { fa: 'عنکبوت سایه', en: 'Dark Spider' },
      tier: 'Common',
      targetHeight: 1.1,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['mouthPoint', 'chestPoint', 'hitPoint'],
      phase: 'slice',
      specId: 'spider',
      estSizeMB: 2,
    },
    {
      id: 'warlock',
      category: 'enemies',
      file: '/assets/3d/enemies/dark-mage.glb',
      displayName: { fa: 'جادوگر تاریکی', en: 'Dark Mage' },
      tier: 'Elite',
      targetHeight: 1.9,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['staffPoint', 'weaponPoint', ...HUMAN_POINTS],
      phase: 'slice',
      specId: 'warlock',
      estSizeMB: 2,
    },
    {
      id: 'flyer',
      category: 'enemies',
      file: '/assets/3d/enemies/flying-shadow.glb',
      displayName: { fa: 'پرنده سایه', en: 'Flying Shadow' },
      tier: 'Common',
      targetHeight: 1.5,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['chestPoint', 'hitPoint'],
      phase: 'slice',
      specId: 'flyer',
      estSizeMB: 1.5,
    },
    // -------- دشمنان محتوای آینده (فایل GLB لازم دارد) --------
    {
      id: 'warMachine',
      category: 'enemies',
      file: '/assets/3d/enemies/war-machine.glb',
      displayName: { fa: 'ماشین جنگی', en: 'War Machine' },
      tier: 'Elite',
      targetHeight: 2.2,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['muzzlePoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'warMachine',
      estSizeMB: 3,
    },
    {
      id: 'aetherTank',
      category: 'enemies',
      file: '/assets/3d/enemies/aether-tank.glb',
      displayName: { fa: 'تانک اثری', en: 'Aether Tank' },
      tier: 'Elite',
      targetHeight: 2.4,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['muzzlePoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'aetherTank',
      estSizeMB: 3,
    },
    {
      id: 'smallDragon',
      category: 'enemies',
      file: '/assets/3d/enemies/small-dragon.glb',
      displayName: { fa: 'اژدهای کوچک', en: 'Small Dragon' },
      tier: 'Elite',
      targetHeight: 2.8,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['mouthPoint', 'chestPoint', 'hitPoint'],
      phase: 'future',
      specId: 'smallDragon',
      estSizeMB: 3,
    },
    {
      id: 'crystalMonster',
      category: 'enemies',
      file: '/assets/3d/enemies/crystal-monster.glb',
      displayName: { fa: 'هیولای کریستالی', en: 'Crystal Monster' },
      tier: 'Elite',
      targetHeight: 1.7,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['chestPoint', 'headPoint', 'hitPoint'],
      phase: 'future',
      specId: 'crystalMonster',
      estSizeMB: 2,
    },
    {
      id: 'hunter',
      category: 'enemies',
      file: '/assets/3d/enemies/hunter.glb',
      displayName: { fa: 'شکارچی', en: 'Hunter' },
      tier: 'Elite',
      targetHeight: 1.8,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['weaponPoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'hunter',
      estSizeMB: 2,
    },
    {
      id: 'destroyer',
      category: 'enemies',
      file: '/assets/3d/enemies/destroyer.glb',
      displayName: { fa: 'نابودگر', en: 'Destroyer' },
      tier: 'Legendary',
      targetHeight: 2.3,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['weaponPoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'destroyer',
      estSizeMB: 3,
    },
    {
      id: 'summoner',
      category: 'enemies',
      file: '/assets/3d/enemies/summoner.glb',
      displayName: { fa: 'احضارکننده', en: 'Summoner' },
      tier: 'Legendary',
      targetHeight: 1.9,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['staffPoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'summoner',
      estSizeMB: 2.5,
    },
    {
      id: 'spirit',
      category: 'enemies',
      file: '/assets/3d/enemies/spirit.glb',
      displayName: { fa: 'روح', en: 'Spirit' },
      tier: 'Common',
      targetHeight: 1.5,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['chestPoint', 'hitPoint'],
      phase: 'future',
      specId: 'spirit',
      estSizeMB: 1.5,
    },
    {
      id: 'shadowSoldier',
      category: 'enemies',
      file: '/assets/3d/enemies/shadow-soldier.glb',
      displayName: { fa: 'سرباز سایه', en: 'Shadow Soldier' },
      tier: 'Common',
      targetHeight: 1.75,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['weaponPoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'shadowSoldier',
      estSizeMB: 2,
    },
    {
      id: 'annihilator',
      category: 'enemies',
      file: '/assets/3d/enemies/annihilator.glb',
      displayName: { fa: 'محوکننده', en: 'Annihilator' },
      tier: 'Legendary',
      targetHeight: 2.6,
      rotationOffsetDeg: 0,
      animations: ENEMY_ANIMS,
      vfxPoints: ['muzzlePoint', ...HUMAN_POINTS],
      phase: 'future',
      specId: 'annihilator',
      estSizeMB: 3.5,
    },
  ],

  // ---------------------------- Boss‌ها ----------------------------
  bosses: [
    {
      id: 'golemKing',
      category: 'bosses',
      file: '/assets/3d/bosses/stone-golem-king.glb',
      displayName: { fa: 'پادشاه غول سنگی', en: 'Stone Golem King' },
      tier: 'Boss',
      targetHeight: 2.6, // × data.scale 2.2 → ۵.۷ واحد جهانی
      rotationOffsetDeg: 0,
      animations: BOSS_ANIMS,
      vfxPoints: ['chestPoint', 'headPoint', 'hitPoint', 'weaponPoint'],
      phase: 'slice',
      specId: 'golemKing',
      estSizeMB: 6,
    },
    {
      id: 'fireGiant',
      category: 'bosses',
      file: '/assets/3d/bosses/fire-giant.glb',
      displayName: { fa: 'غول آتش', en: 'Fire Giant' },
      tier: 'Boss',
      targetHeight: 3.6,
      rotationOffsetDeg: 0,
      animations: BOSS_ANIMS,
      vfxPoints: ['mouthPoint', 'chestPoint', 'headPoint', 'hitPoint'],
      phase: 'future',
      specId: 'fireGiant',
      estSizeMB: 7,
    },
    {
      id: 'iceGiant',
      category: 'bosses',
      file: '/assets/3d/bosses/ice-giant.glb',
      displayName: { fa: 'غول یخ', en: 'Ice Giant' },
      tier: 'Boss',
      targetHeight: 3.6,
      rotationOffsetDeg: 0,
      animations: BOSS_ANIMS,
      vfxPoints: ['mouthPoint', 'chestPoint', 'headPoint', 'hitPoint'],
      phase: 'future',
      specId: 'iceGiant',
      estSizeMB: 7,
    },
    {
      id: 'blackDragon',
      category: 'bosses',
      file: '/assets/3d/bosses/black-dragon.glb',
      displayName: { fa: 'اژدهای سیاه', en: 'Black Dragon' },
      tier: 'Boss',
      targetHeight: 4.5,
      rotationOffsetDeg: 0,
      animations: BOSS_ANIMS,
      vfxPoints: ['mouthPoint', 'chestPoint', 'headPoint', 'hitPoint'],
      phase: 'future',
      specId: 'blackDragon',
      estSizeMB: 8,
    },
    {
      id: 'darkLord',
      category: 'bosses',
      file: '/assets/3d/bosses/dark-lord.glb',
      displayName: { fa: 'ارباب تاریکی', en: 'Dark Lord' },
      tier: 'Final Boss',
      targetHeight: 4.2,
      rotationOffsetDeg: 0,
      animations: BOSS_ANIMS,
      vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
      phase: 'future',
      specId: 'darkLord',
      estSizeMB: 8,
    },
  ],

  // ---------------------------- برج‌ها (اختیاری — GLB جایگزین) ----------------------------
  towers: [
    {
      id: 'sentinel',
      category: 'towers',
      file: '/assets/3d/towers/sentinel.glb',
      displayName: { fa: 'برج نگهبان', en: 'Sentinel Tower' },
      tier: 'Tower',
      targetHeight: 3.2,
      rotationOffsetDeg: 0,
      animations: [],
      vfxPoints: ['muzzlePoint'],
      phase: 'slice',
      specId: 'sentinel',
      estSizeMB: 2,
    },
    {
      id: 'lightning',
      category: 'towers',
      file: '/assets/3d/towers/lightning.glb',
      displayName: { fa: 'برج صاعقه', en: 'Lightning Tower' },
      tier: 'Tower',
      targetHeight: 4.4,
      rotationOffsetDeg: 0,
      animations: [],
      vfxPoints: ['chestPoint'],
      phase: 'slice',
      specId: 'lightning',
      estSizeMB: 2,
    },
    {
      id: 'fire',
      category: 'towers',
      file: '/assets/3d/towers/fire.glb',
      displayName: { fa: 'برج آتش', en: 'Fire Tower' },
      tier: 'Tower',
      targetHeight: 2.9,
      rotationOffsetDeg: 0,
      animations: [],
      vfxPoints: ['muzzlePoint'],
      phase: 'slice',
      specId: 'fire',
      estSizeMB: 2,
    },
    {
      id: 'ice',
      category: 'towers',
      file: '/assets/3d/towers/ice.glb',
      displayName: { fa: 'برج یخ', en: 'Ice Tower' },
      tier: 'Tower',
      targetHeight: 4.5,
      rotationOffsetDeg: 0,
      animations: [],
      vfxPoints: ['chestPoint'],
      phase: 'slice',
      specId: 'ice',
      estSizeMB: 2,
    },
  ],
};

/** همه ورودی‌ها به‌صورت تخت */
export function allAssetEntries(): CharacterAssetEntry[] {
  return [
    ...ASSETS.heroes,
    ...ASSETS.enemies,
    ...ASSETS.bosses,
    ...ASSETS.towers,
  ];
}

/** یافتن ورودی بر اساس شناسه Gameplay */
export function findAssetEntry(id: string): CharacterAssetEntry | undefined {
  return allAssetEntries().find((e) => e.id === id);
}

/** ورودی‌های فاز Vertical Slice — برای preload در Splash Screen */
export function sliceAssetEntries(): CharacterAssetEntry[] {
  return allAssetEntries().filter((e) => e.phase === 'slice');
}
