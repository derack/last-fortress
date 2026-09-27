'use client';

import { create } from 'zustand';
import type { Language, Quality, SaveData, MagicId } from '@/game/data/types';
import { loadSave, persistSave, resetSave } from '@/game/systems/SaveSystem';
import { setLanguage } from '@/game/data/i18n';

// ============================================================
// Store مرکزی UI — هماهنگی بین React و موتور بازی
// ============================================================

export type Screen = 'menu' | 'map' | 'battle' | 'settings' | 'achievements' | 'heroes';

export interface TowerInfo {
  id: number;
  towerId: string;
  level: number;
  damage: number;
  range: number;
  fireRate: number;
  upgradeCost: number;
  sellValue: number;
  targeting: string;
  abilityCd: number;
  abilityMax: number;
  abilityNameKey: string;
}

export interface MagicInfo {
  id: string;
  cd: number;
  cdMax: number;
  cost: number;
  affordable: boolean;
}

export interface HeroInfo {
  level: number;
  xpPct: number;
  abilityCd: number;
  abilityMax: number;
  deployed: boolean;
  hp: number;
  maxHp: number;
}

export interface VictoryInfo {
  stars: number;
  healthPct: number;
  rewards: { crystals: number; knowledge: number; coins: number };
}

interface GameState {
  screen: Screen;
  save: SaveData | null;

  // نبرد
  coins: number;
  crystals: number;
  coreHp: number;
  coreMaxHp: number;
  wave: number;
  waveTotal: number;
  waveActive: boolean;
  autoIn: number;
  earlyBonus: number;
  banner: { wave: number; boss: boolean; visible: boolean } | null;
  waveClearedToast: { wave: number; bonus: number } | null;
  selectedTower: TowerInfo | null;
  buildMode: string | null;
  magicState: MagicInfo[];
  magicPending: MagicId | null;
  shieldActive: boolean;
  hero: HeroInfo | null;
  heroSelected: boolean;
  paused: boolean;
  speed: number;
  victory: VictoryInfo | null;
  defeat: boolean;
  tutorialStep: string | null;
  toasts: { id: number; key: string; type: string }[];
  battleActive: boolean;
  /** گالری کاراکترها (صفحه توسعه‌دهنده) */
  galleryOpen: boolean;

  // اکشن‌ها
  setScreen: (s: Screen) => void;
  initSave: () => SaveData;
  updateSave: (fn: (s: SaveData) => void) => void;
  setLanguage: (l: Language) => void;
  setQuality: (q: Quality) => void;
  setBattleActive: (v: boolean) => void;
  resetBattleState: () => void;
  handleEvent: (event: string, payload: unknown) => void;
  pushToast: (key: string, type: string) => void;
  resetAll: () => void;
  setGalleryOpen: (v: boolean) => void;
}

let toastId = 1;

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu',
  save: null,

  coins: 0,
  crystals: 0,
  coreHp: 100,
  coreMaxHp: 100,
  wave: 1,
  waveTotal: 10,
  waveActive: false,
  autoIn: 0,
  earlyBonus: 0,
  banner: null,
  waveClearedToast: null,
  selectedTower: null,
  buildMode: null,
  magicState: [],
  magicPending: null,
  shieldActive: false,
  hero: null,
  heroSelected: false,
  paused: false,
  speed: 1,
  victory: null,
  defeat: false,
  tutorialStep: null,
  toasts: [],
  battleActive: false,
  galleryOpen: false,

  setScreen: (s) => set({ screen: s }),

  initSave: () => {
    const save = loadSave();
    setLanguage(save.settings.language);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = save.settings.language === 'fa' ? 'rtl' : 'ltr';
      document.documentElement.lang = save.settings.language;
    }
    set({ save });
    return save;
  },

  updateSave: (fn) => {
    const { save } = get();
    if (!save) return;
    fn(save);
    persistSave(save);
    set({ save: { ...save } });
  },

  setLanguage: (l) => {
    setLanguage(l);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = l === 'fa' ? 'rtl' : 'ltr';
      document.documentElement.lang = l;
    }
    get().updateSave((s) => {
      s.settings.language = l;
    });
  },

  setQuality: (q) => {
    get().updateSave((s) => {
      s.settings.quality = q;
    });
  },

  setBattleActive: (v) => set({ battleActive: v }),

  /** ریست کامل state نبرد — قبل از شروع هر نبرد جدید */
  resetBattleState: () => set({
    coins: 0,
    crystals: 0,
    coreHp: 100,
    coreMaxHp: 100,
    wave: 1,
    waveTotal: 10,
    waveActive: false,
    autoIn: 0,
    earlyBonus: 0,
    banner: null,
    waveClearedToast: null,
    selectedTower: null,
    buildMode: null,
    magicState: [],
    magicPending: null,
    shieldActive: false,
    hero: null,
    heroSelected: false,
    paused: false,
    speed: 1,
    victory: null,
    defeat: false,
    tutorialStep: null,
    toasts: [],
  }),

  pushToast: (key, type) => {
    const id = toastId++;
    set((st) => ({ toasts: [...st.toasts.slice(-2), { id, key, type }] }));
    setTimeout(() => {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
    }, 2200);
  },

  handleEvent: (event, payload) => {
    const p = payload as Record<string, unknown>;
    switch (event) {
      case 'resources':
        set({ coins: p.coins as number, crystals: p.crystals as number });
        break;
      case 'core':
        set({ coreHp: p.hp as number, coreMaxHp: p.max as number });
        break;
      case 'wave':
        set({
          wave: p.wave as number,
          waveTotal: p.total as number,
          waveActive: p.active as boolean,
          autoIn: (p.autoIn as number) ?? 0,
          earlyBonus: (p.earlyBonus as number) ?? 0,
        });
        break;
      case 'banner':
        set({ banner: { wave: p.wave as number, boss: p.boss as boolean, visible: true } });
        setTimeout(() => set({ banner: null }), 2400);
        break;
      case 'waveCleared':
        set({ waveClearedToast: { wave: p.wave as number, bonus: p.bonus as number } });
        setTimeout(() => set({ waveClearedToast: null }), 2600);
        break;
      case 'selectTower':
        set({ selectedTower: p as TowerInfo });
        break;
      case 'buildMode':
        set({ buildMode: (p.towerId as string) ?? null });
        break;
      case 'magic':
        set({ magicState: payload as MagicInfo[] });
        break;
      case 'magicPending':
        set({ magicPending: (p.id as MagicId) ?? null });
        break;
      case 'shield':
        set({ shieldActive: !!p.active });
        break;
      case 'hero':
        set({ hero: payload as HeroInfo });
        break;
      case 'heroSelected':
        set({ heroSelected: true });
        setTimeout(() => set({ heroSelected: false }), 1500);
        break;
      case 'paused':
        set({ paused: !!p.paused });
        break;
      case 'speed':
        set({ speed: p.speed as number });
        break;
      case 'victory':
        set({ victory: payload as VictoryInfo });
        break;
      case 'defeat':
        set({ defeat: true });
        break;
      case 'tutorial':
        set({ tutorialStep: p.step as string });
        if (p.step === 'done') setTimeout(() => set({ tutorialStep: null }), 3000);
        break;
      case 'toast':
        get().pushToast(p.key as string, p.type as string);
        break;
    }
  },

  resetAll: () => {
    resetSave();
    const save = loadSave();
    setLanguage(save.settings.language);
    set({ save });
  },

  setGalleryOpen: (v: boolean) => set({ galleryOpen: v }),
}));
