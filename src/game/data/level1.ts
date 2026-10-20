import type { LegacyLevelData, AchievementDef, PlayerStats } from './types';

// ============================================================
// مرحله ۱ — دشت‌های سبز (Vertical Slice) — ۱۰ موج + Boss
// مسیر از دروازه تاریکی در جنوب‌غرب تا هسته آذر
// ============================================================

export const LEVEL_1: LegacyLevelData = {
  id: 'l1',
  region: 1,
  nameKey: 'region1',
  descKey: 'storyIntro3',
  coreHp: 100,
  startCoins: 240,
  startCrystals: 30,
  timeOfDay: 'day',
  env: 'plains',
  star2HealthPct: 70,
  star3ChallengeKey: 'starChallenge',
  path: [
    { x: -32, z: 28 },
    { x: -32, z: 4 },
    { x: -8, z: 4 },
    { x: -8, z: -20 },
    { x: 18, z: -20 },
    { x: 18, z: 2 },
  ],
  waves: [
    {
      coinBonus: 60,
      groups: [{ enemy: 'shadow', count: 5, interval: 1.4, delay: 0, tier: 1 }],
    },
    {
      coinBonus: 65,
      groups: [
        { enemy: 'shadow', count: 6, interval: 1.1, delay: 0, tier: 1 },
        { enemy: 'warrior', count: 3, interval: 2.4, delay: 5, tier: 1 },
      ],
    },
    {
      coinBonus: 70,
      groups: [
        { enemy: 'spider', count: 5, interval: 1.3, delay: 0, tier: 1 },
        { enemy: 'warrior', count: 4, interval: 2.0, delay: 4, tier: 1 },
      ],
    },
    {
      coinBonus: 80,
      groups: [
        { enemy: 'golem', count: 2, interval: 6, delay: 2, tier: 1 },
        { enemy: 'warrior', count: 5, interval: 1.8, delay: 6, tier: 1 },
      ],
    },
    {
      coinBonus: 85,
      groups: [
        { enemy: 'flyer', count: 6, interval: 1.6, delay: 0, tier: 1 },
        { enemy: 'shadow', count: 6, interval: 1.0, delay: 3, tier: 2 },
      ],
    },
    {
      coinBonus: 90,
      groups: [
        { enemy: 'warlock', count: 2, interval: 7, delay: 0, tier: 1 },
        { enemy: 'golem', count: 2, interval: 6, delay: 3, tier: 2 },
        { enemy: 'warrior', count: 6, interval: 1.6, delay: 6, tier: 2 },
      ],
    },
    {
      coinBonus: 95,
      groups: [
        { enemy: 'spider', count: 9, interval: 0.9, delay: 0, tier: 2 },
        { enemy: 'flyer', count: 6, interval: 1.5, delay: 4, tier: 2 },
      ],
    },
    {
      coinBonus: 100,
      groups: [
        { enemy: 'golem', count: 4, interval: 5, delay: 0, tier: 2 },
        { enemy: 'warlock', count: 2, interval: 8, delay: 4, tier: 1 },
        { enemy: 'shadow', count: 8, interval: 0.8, delay: 8, tier: 2 },
      ],
    },
    {
      coinBonus: 110,
      groups: [
        { enemy: 'warrior', count: 10, interval: 1.2, delay: 0, tier: 2 },
        { enemy: 'spider', count: 7, interval: 1.0, delay: 5, tier: 2 },
        { enemy: 'flyer', count: 7, interval: 1.4, delay: 9, tier: 2 },
      ],
    },
    {
      boss: true,
      coinBonus: 250,
      crystalBonus: 15,
      groups: [
        { enemy: 'golemKing', count: 1, interval: 1, delay: 2, tier: 1 },
        { enemy: 'warrior', count: 6, interval: 3.5, delay: 10, tier: 2 },
      ],
    },
  ],
};

// مناطق و مراحل در levels.ts — LEVEL_1 به‌عنوان منطقه ۱ آنجا ثبت شده است
// (این فایل: مرحله ۱ + دستاوردها)

// ============================================================
// دستاوردها — ۳۰ دستاورد Data-Driven
// ============================================================

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_fortress', nameKey: 'achFirstFortress', descKey: 'achFirstFortressDesc', crystalReward: 10, check: (s) => s.victories >= 1 },
  { id: 'commander', nameKey: 'achCommander', descKey: 'achCommanderDesc', crystalReward: 20, check: (s) => s.victories >= 3 },
  { id: 'legend', nameKey: 'achLegend', descKey: 'achLegendDesc', crystalReward: 100, check: (s) => s.victories >= 10 },
  { id: 'mage', nameKey: 'achMage', descKey: 'achMageDesc', crystalReward: 10, check: (s) => s.magicCasts >= 10 },
  { id: 'archmage', nameKey: 'achArchmage', descKey: 'achArchmageDesc', crystalReward: 30, check: (s) => s.magicCasts >= 50 },
  { id: 'slayer', nameKey: 'achSlayer', descKey: 'achSlayerDesc', crystalReward: 10, check: (s) => s.kills >= 50 },
  { id: 'exterminator', nameKey: 'achExterminator', descKey: 'achExterminatorDesc', crystalReward: 40, check: (s) => s.kills >= 500 },
  { id: 'wave_breaker', nameKey: 'achWaveBreaker', descKey: 'achWaveBreakerDesc', crystalReward: 15, check: (s) => s.wavesSurvived >= 25 },
  { id: 'veteran', nameKey: 'achVeteran', descKey: 'achVeteranDesc', crystalReward: 60, check: (s) => s.wavesSurvived >= 100 },
  { id: 'giant_slayer', nameKey: 'achGiantSlayer', descKey: 'achGiantSlayerDesc', crystalReward: 25, check: (s) => s.bossKills >= 1 },
  { id: 'titan_bane', nameKey: 'achTitanBane', descKey: 'achTitanBaneDesc', crystalReward: 50, check: (s) => s.bossKills >= 3 },
  { id: 'architect', nameKey: 'achArchitect', descKey: 'achArchitectDesc', crystalReward: 10, check: (s) => s.towersBuilt >= 20 },
  { id: 'master_builder', nameKey: 'achMasterBuilder', descKey: 'achMasterBuilderDesc', crystalReward: 20, check: (s) => s.upgrades >= 50 },
  { id: 'star_seeker', nameKey: 'achStarSeeker', descKey: 'achStarSeekerDesc', crystalReward: 15, check: (s) => s.totalStars >= 5 },
  { id: 'star_lord', nameKey: 'achStarLord', descKey: 'achStarLordDesc', crystalReward: 50, check: (s) => s.totalStars >= 15 },
  { id: 'untouchable', nameKey: 'achUntouchable', descKey: 'achUntouchableDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'perfect_defense', nameKey: 'achPerfectDefense', descKey: 'achPerfectDefenseDesc', crystalReward: 25, check: () => false }, // رویدادی
  { id: 'last_stand', nameKey: 'achLastStand', descKey: 'achLastStandDesc', crystalReward: 40, check: () => false }, // رویدادی
  { id: 'blitz', nameKey: 'achBlitz', descKey: 'achBlitzDesc', crystalReward: 15, check: () => false }, // رویدادی
  { id: 'tower_master', nameKey: 'achTowerMaster', descKey: 'achTowerMasterDesc', crystalReward: 20, check: () => false }, // رویدادی
  { id: 'maxed', nameKey: 'achMaxed', descKey: 'achMaxedDesc', crystalReward: 20, check: () => false }, // رویدادی
  { id: 'dragon_fear', nameKey: 'achDragonFear', descKey: 'achDragonFearDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'economy', nameKey: 'achEconomy', descKey: 'achEconomyDesc', crystalReward: 20, check: () => false }, // رویدادی
  { id: 'magic_rain', nameKey: 'achMagicRain', descKey: 'achMagicRainDesc', crystalReward: 15, check: () => false }, // رویدادی
  { id: 'rich', nameKey: 'achRich', descKey: 'achRichDesc', crystalReward: 15, check: (s: PlayerStats) => false }, // رویدادی (در نبرد بررسی می‌شود)
  { id: 'crystal_hoarder', nameKey: 'achCrystalHoarder', descKey: 'achCrystalHoarderDesc', crystalReward: 15, check: () => false }, // رویدادی
  { id: 'storm_caller', nameKey: 'achStormCaller', descKey: 'achStormCallerDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'inferno', nameKey: 'achInferno', descKey: 'achInfernoDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'guardian_angel', nameKey: 'achGuardianAngel', descKey: 'achGuardianAngelDesc', crystalReward: 30, check: () => false }, // رویدادی
  { id: 'hero_max', nameKey: 'achNewAchievement', descKey: 'achUntouchableDesc', crystalReward: 50, check: () => false }, // جایگاه نگهدارنده
];
