'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/game/core/Game';
import { audioSystem } from '@/game/systems/AudioSystem';
import { persistSave } from '@/game/systems/SaveSystem';
import { ACHIEVEMENTS, LEVELS, STAGES, firstPlayableStageId, continueStageId } from '@/game/data/campaign';
import { assetManager, sliceAssetEntries } from '@/game/assets';
import { t, faNum } from '@/game/data/i18n';
import { MainMenu } from './MainMenu';
import { CampaignMap } from './CampaignMap';
import { BattleUI, BattleGameApi } from './BattleUI';
import { SettingsPanel } from './SettingsPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { HeroesPanel } from './HeroesPanel';
import { ForgePanel } from './ForgePanel';
import type { SaveData } from '@/game/data/types';

// ============================================================
// پوسته بازی — اتصال موتور سه‌بعدی به رابط React
// هر نبرد روی canvas تازه سوار می‌شود (جلوگیری از مساله WebGL Context)
// جریان راه‌اندازی: Splash → بارگذاری Asset (GLB/Placeholder) → منو
// ============================================================

const BUS_EVENTS = [
  'resources', 'core', 'coreHit', 'wave', 'banner', 'bossPhase', 'waveCleared', 'selectTower', 'buildMode',
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

  // ---------- Splash / بارگذاری Asset (بخش ۱۴) ----------
  const [booting, setBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootNote, setBootNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const report = await assetManager.preload(sliceAssetEntries(), (p) => {
        if (cancelled) return;
        setBootProgress(p.loaded / p.total);
      });
      if (cancelled) return;
      setBootProgress(1);
      if (report.missing > 0 || report.error > 0) {
        setBootNote(t('assetPlaceholderNotice'));
      }
      // حداقل نمایش Splash برای جلوگیری از فلش
      await new Promise((r) => setTimeout(r, 500));
      if (!cancelled) setBooting(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // راه‌اندازی ذخیره
  useEffect(() => {
    useGameStore.getState().initSave();
  }, []);

  // ---------- فاز ۶ — موسیقی پیوسته + سیاست autoplay مرورگر ----------
  // موسیقی از منو شروع می‌شود (بعد از اولین لمس)، بدون وقفه تا نقشه و نبرد می‌ماند
  useEffect(() => {
    audioSystem.setSceneMode('menu');
    audioSystem.startMusic();
    const kick = () => audioSystem.ensure(); // resume AudioContext بعد از اولین تعامل
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);

  // فاز ۶ — حالت موسیقی: نبرد پرانرژی، بقیه صحنه‌ها آرام
  useEffect(() => {
    if (!booting) audioSystem.setSceneMode(screen === 'battle' ? 'battle' : 'menu');
  }, [screen, booting]);

  // فاز ۶ — اعمال زنده ولوم از تنظیمات (بدون نیاز به restart)
  const musicVol = useGameStore((s) => s.save?.settings.music ?? 0.6);
  const sfxVol = useGameStore((s) => s.save?.settings.sfx ?? 0.8);
  useEffect(() => {
    audioSystem.setVolumes(musicVol, sfxVol);
  }, [musicVol, sfxVol]);

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
    // محافظ دابل‌تپ: هر موتور قبلی (rAF فعال) باید پیش از ساخت موتور جدید نابود شود —
    // وگرنه دو نبرد هم‌زمان شبیه‌سازی می‌شود (پاداش/آمار دوبله)
    gameRef.current?.dispose();
    gameRef.current = null;
    if (!pendingStart.current) return;
    pendingStart.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const store = useGameStore.getState();
    const save = store.save;
    if (!save) return;

    // ریست state نبرد قبلی
    store.resetBattleState();

    // v2.1 — دکمهٔ ادامه: آخرین مرحلهٔ بازی‌شده / مرحلهٔ بعدش / اولین آزاد
    const level = LEVELS[store.pendingLevelId] ?? STAGES[continueStageId(save)] ?? STAGES[firstPlayableStageId(save)];
    // v2.1 — قهرمان فقط اگر باز شده باشد؛ وگرنه نبرد بدون قهرمان (خریدنی از پنل قهرمانان)
    const heroId = save.selectedHero && save.unlockedHeroes.includes(save.selectedHero) ? save.selectedHero : null;
    const game = new Game(canvas, level, save.settings.quality, save, save.settings.language, heroId);
    // ثبت آخرین مرحله برای دکمهٔ ادامهٔ منو
    store.updateSave((s) => { s.lastStageId = level.id; });
    // همگام‌سازی سیو از موتور در پایان نبرد — پیش از هر handleEvent/updateSave بعدی؛
    // بدون این، تغییر تنظیمات وسط نبرد شیء سیو را fork می‌کرد و پاداش‌ها گم می‌شدند
    const syncEngine = () => useGameStore.getState().syncEngineSave(game.engineSave);
    game.bus.on('victory', syncEngine);
    game.bus.on('defeat', syncEngine);
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
      // بخش ۵۴ — خوش‌آمد کوتاه، سپس گام ساخت برج
      game.bus.emit('tutorial', { step: 'welcome' });
      setTimeout(() => {
        if (useGameStore.getState().tutorialStep === 'welcome') {
          useGameStore.getState().handleEvent('tutorial', { step: 'build' });
        }
      }, 3400);
    }
    store.setBattleActive(true);
    store.setScreen('battle');

    // پاکسازی هنگام remount یا unmount — نشت rAF/حافظه ممکن نمی‌شود
    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [battleKey]);

  /** چرخش/تغییر اندازهٔ صفحه — بدون این، بافر رندر قدیمی می‌ماند و تصویر کشیده/تار می‌شود */
  useEffect(() => {
    let queued = false;
    const onResize = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        gameRef.current?.resize();
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  /** flush سیو هنگام مینیمایز/بسته‌شدن اپ — اندروید ممکن است WebView را بکشد */
  useEffect(() => {
    const flush = () => {
      const s = useGameStore.getState().save;
      if (s) persistSave(s);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

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
      {screen === 'forge' && <ForgePanel />}

      {/* Splash / بارگذاری Asset */}
      {booting && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#07090d]">
          <div className="mb-2 text-4xl font-black text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]">
            {t('gameTitle')}
          </div>
          <div className="mb-10 text-sm tracking-[0.3em] text-slate-400">{t('gameSubtitle')}</div>

          <div className="w-64">
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-200 transition-all duration-300"
                style={{ width: `${Math.round(bootProgress * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{bootNote ?? t('assetLoading')}</span>
              <span className="font-bold text-amber-300">{faNum(Math.round(bootProgress * 100))}٪</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-600">{t('assetLoadingSub')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
