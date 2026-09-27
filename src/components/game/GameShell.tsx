'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/game/core/Game';
import { ACHIEVEMENTS, LEVEL_1 } from '@/game/data/level1';
import { MainMenu } from './MainMenu';
import { CampaignMap } from './CampaignMap';
import { BattleUI, BattleGameApi } from './BattleUI';
import { SettingsPanel } from './SettingsPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { HeroesPanel } from './HeroesPanel';
import type { SaveData } from '@/game/data/types';

// ============================================================
// پوسته بازی — اتصال موتور سه‌بعدی به رابط React
// هر نبرد روی canvas تازه سوار می‌شود (جلوگیری از مساله WebGL Context)
// ============================================================

const BUS_EVENTS = [
  'resources', 'core', 'wave', 'banner', 'waveCleared', 'selectTower', 'buildMode',
  'magic', 'magicPending', 'shield', 'hero', 'heroSelected', 'paused', 'speed',
  'victory', 'defeat', 'tutorial', 'toast',
];

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const pendingStart = useRef(false);
  const [battleKey, setBattleKey] = useState(0);
  const screen = useGameStore((s) => s.screen);
  const battleActive = useGameStore((s) => s.battleActive);
  const victory = useGameStore((s) => s.victory);

  // راه‌اندازی ذخیره
  useEffect(() => {
    useGameStore.getState().initSave();
  }, []);

  const checkAchievements = useCallback(() => {
    const store = useGameStore.getState();
    store.updateSave((save: SaveData) => {
      for (const a of ACHIEVEMENTS) {
        if (!save.achievements.includes(a.id) && a.check(save.stats)) {
          save.achievements.push(a.id);
          save.crystals += a.crystalReward;
          store.pushToast('achNewAchievement', 'success');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (victory) checkAchievements();
  }, [victory, checkAchievements]);

  /** ساخت موتور بازی روی canvas تازه */
  useEffect(() => {
    if (!pendingStart.current) return;
    pendingStart.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const store = useGameStore.getState();
    const save = store.save;
    if (!save) return;

    // ریست state نبرد قبلی
    store.resetBattleState();

    const game = new Game(canvas, LEVEL_1, save.settings.quality, save, save.settings.language);
    for (const ev of BUS_EVENTS) {
      game.bus.on(ev, (payload) => {
        useGameStore.getState().handleEvent(ev, payload);
      });
    }
    gameRef.current = game;
    // هوک دیباگ برای کنسول
    (window as unknown as { __game?: Game }).__game = game;
    game.audio.ensure();
    game.audio.startMusic();
    game.start();
    if (!save.tutorialDone) {
      game.bus.emit('tutorial', { step: 'build' });
    }
    store.setBattleActive(true);
    store.setScreen('battle');
  }, [battleKey]);

  /** درخواست شروع نبرد — remount canvas سپس ساخت موتور */
  const requestBattle = useCallback(() => {
    pendingStart.current = true;
    setBattleKey((k) => k + 1);
  }, []);

  /** خروج از نبرد */
  const endBattle = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    const store = useGameStore.getState();
    store.setBattleActive(false);
    store.updateSave(() => { /* پایدارسازی تغییرات موتور */ });
  }, []);

  const gameActions = {
    get: () => (gameRef.current as unknown as BattleGameApi) ?? null,
    startBattle: requestBattle,
    endBattle,
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07090d] select-none">
      <canvas key={battleKey} ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {screen === 'menu' && <MainMenu onStart={requestBattle} />}
      {screen === 'map' && <CampaignMap onStart={requestBattle} />}
      {screen === 'battle' && battleActive && <BattleUI actions={gameActions} />}
      {screen === 'settings' && <SettingsPanel />}
      {screen === 'achievements' && <AchievementsPanel />}
      {screen === 'heroes' && <HeroesPanel />}
    </div>
  );
}
