'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import { Swords, Map as MapIcon, Users, Trophy, Settings, Gem, X, Flame, Coins, BookOpen, Play } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { t, faNum } from '@/game/data/i18n';
import { STAGES, isStageUnlocked, completedStageIds, continueStageId } from '@/game/data/campaign';
import { PageShellContext } from './standalone';
import { CampaignMap } from './CampaignMap';
import { HeroesPanel } from './HeroesPanel';
import { ForgePanel } from './ForgePanel';
import { AchievementsPanel } from './AchievementsPanel';
import { SettingsPanel } from './SettingsPanel';

// ============================================================
// صفحه اصلی — سبک Clash Royale: نوار ارز بالا + دکمهٔ «ادامه» براق
// ------------------------------------------------------------
// دکمهٔ شروع خودکار آخرین مرحلهٔ بازی‌شده را می‌آورد (اگر تمام شده
// باشد مرحلهٔ بعدش) — دیگر هر بار از مرحلهٔ اول شروع نمی‌شود.
// ناوبری صفحات inline (بدون iframe) — تب‌ها همان لحظه باز می‌شوند.
// ============================================================

type PageId = 'map' | 'heroes' | 'forge' | 'achievements' | 'settings';

const PAGES: { id: PageId; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { id: 'map', icon: MapIcon, labelKey: 'campaign' },
  { id: 'heroes', icon: Users, labelKey: 'heroes' },
  { id: 'forge', icon: Flame, labelKey: 'forge' },
  { id: 'achievements', icon: Trophy, labelKey: 'achievements' },
  { id: 'settings', icon: Settings, labelKey: 'settings' },
];

export function MainMenu({ onStart }: { onStart: () => void }) {
  const save = useGameStore((s) => s.save);
  const [openPages, setOpenPages] = useState<PageId[]>([]);
  const [activePage, setActivePage] = useState<PageId | null>(null);

  const openPage = useCallback((id: PageId) => {
    setOpenPages((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActivePage(id);
  }, []);

  const closePage = useCallback(() => {
    setActivePage((cur) => {
      setOpenPages((prev) => (cur ? prev.filter((p) => p !== cur) : prev));
      return null;
    });
  }, []);

  // حالت «صفحه باز» — هدر داخلی پنل‌ها مخفی می‌شود (تیتر روی قاب والد هست)
  useLayoutEffect(() => {
    if (activePage) document.documentElement.dataset.standalone = '1';
    else delete document.documentElement.dataset.standalone;
    return () => {
      delete document.documentElement.dataset.standalone;
    };
  }, [activePage]);

  // v2.1 — مرحلهٔ «ادامه»: آخرین بازی‌شده / بعدش / اولین آزاد
  const continueTarget = save ? continueStageId(save) : 'c1s1';
  const targetStage = STAGES[continueTarget];
  const isNewGame = !!save && !save.lastStageId;

  // شروع نبرد از دکمهٔ بزرگ — همان گیت آنلاک پل قدیمی
  const startBattle = useCallback(() => {
    const store = useGameStore.getState();
    const levelId = store.pendingLevelId;
    if (levelId) {
      const stage = STAGES[levelId];
      const current = store.save;
      if (stage && current && !isStageUnlocked(stage.chapter ?? 1, stage.stage ?? 1, completedStageIds(current))) return;
      store.setPendingLevel(levelId);
    }
    closePage();
    onStart();
  }, [closePage, onStart]);

  // v2.1 — دکمهٔ بزرگ منو: همیشه «ادامه» را ست می‌کند (آخرین بازی‌شده / بعدش / اولین آزاد)
  const startContinue = useCallback(() => {
    const store = useGameStore.getState();
    store.setPendingLevel(continueTarget);
    closePage();
    onStart();
  }, [closePage, onStart, continueTarget]);

  // پل صفحه — پنل‌های جاسازی‌شده برای بستن/شروع از این استفاده می‌کنند
  const pageShell = useCallback(() => ({
    close: closePage,
    startBattle,
  }), [closePage, startBattle]);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden">
      {/* پس‌زمینه سینمایی */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f1c] via-[#12101f] to-[#1c0f0a]" />
      {/* نور هسته آذر */}
      <div className="azar-core-glow absolute left-1/2 top-[16%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div className="absolute left-1/2 top-[16%] -translate-x-1/2 -translate-y-1/2">
        <div className="core-crystal h-16 w-16 rotate-45 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 shadow-[0_0_60px_20px_rgba(245,158,11,0.45)]" />
      </div>
      {/* خطوط شبکه مدرن + وینیت */}
      <div className="hud-grid absolute inset-0 opacity-30" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 38%, transparent 45%, rgba(4,6,12,0.72) 100%)' }} />
      {/* کریستال‌های محیطی */}
      <div className="absolute bottom-24 right-10 h-10 w-6 rotate-12 bg-cyan-400/40 blur-[1px]" />
      <div className="absolute bottom-32 left-14 h-8 w-5 -rotate-12 bg-violet-400/40 blur-[1px]" />

      {/* ================= نوار ارز — سبک Clash Royale ================= */}
      {save && (
        <div className="absolute right-3 top-3 z-30 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/70 py-1.5 pl-4 pr-2 shadow-lg backdrop-blur-md">
            <Gem className="h-4 w-4 text-cyan-300" />
            <span className="min-w-[2.5rem] text-sm font-black text-cyan-200">{faNum(save.crystals)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/70 py-1.5 pl-4 pr-2 shadow-lg backdrop-blur-md">
            <Coins className="h-4 w-4 text-amber-300" />
            <span className="min-w-[2.5rem] text-sm font-black text-amber-200">{faNum(save.coins ?? 0)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-violet-400/40 bg-black/70 py-1.5 pl-4 pr-2 shadow-lg backdrop-blur-md">
            <BookOpen className="h-4 w-4 text-violet-300" />
            <span className="min-w-[2.5rem] text-sm font-black text-violet-200">{faNum(save.knowledge)}</span>
          </div>
        </div>
      )}

      {/* محتوا */}
      <div className="relative z-10 flex h-full flex-col items-center justify-between pb-28 pt-8">
        <div className="mt-14 text-center">
          <h1 className="game-title text-5xl font-black tracking-tight text-transparent md:text-6xl
            bg-gradient-to-b from-amber-100 via-amber-300 to-orange-500 bg-clip-text
            drop-shadow-[0_2px_20px_rgba(245,158,11,0.4)]">
            {t('gameTitle')}
          </h1>
          <p className="mt-2 text-lg font-bold text-amber-200/80 md:text-xl">{t('gameSubtitle')}</p>
          <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        </div>

        {/* ================= دکمهٔ ادامه — براق و سه‌بعدی سبک Clash ================= */}
        <div className="flex w-full max-w-xs flex-col items-center gap-3 px-6">
          <button onClick={startContinue}
            className="group relative w-full overflow-hidden rounded-2xl border-b-[6px] border-orange-800
              bg-gradient-to-b from-amber-300 via-amber-500 to-orange-600 px-8 py-4 text-center
              shadow-[0_10px_28px_rgba(245,158,11,0.45),inset_0_2px_0_rgba(255,255,255,0.55)]
              ring-2 ring-black/50 transition-all active:translate-y-1 active:border-b-2 active:shadow-[0_4px_14px_rgba(245,158,11,0.35)]">
            {/* درخشش عبوری */}
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/35 to-transparent transition-transform duration-700 group-focus-within:translate-x-full group-active:translate-x-0" />
            <span className="flex items-center justify-center gap-2.5 text-2xl font-black text-white
              drop-shadow-[0_2px_3px_rgba(120,53,15,0.9)]">
              <Play className="h-6 w-6 fill-white" />
              {isNewGame ? t('menuStartFresh') : t('menuContinue')}
            </span>
            {targetStage && (
              <span className="mt-0.5 block text-[11px] font-black tracking-wide text-amber-100/95 drop-shadow-[0_1px_2px_rgba(120,53,15,0.9)]">
                {t('menuStageInfo', faNum(targetStage.chapter ?? 1), faNum(targetStage.stage ?? 1))} · {t(targetStage.nameKey)}
              </span>
            )}
          </button>
          <p className="text-center text-[11px] leading-5 text-slate-500">
            {t('menuPagesHint')}
          </p>
        </div>

        {/* نشان پایین */}
        <div className="mb-1 flex flex-col items-center gap-1">
          <p className="text-xs text-slate-500">{t('holdTheLine')}</p>
        </div>
      </div>

      {/* ================= نوار صفحات — همیشه روی پنل‌ها و قابل کلیک ================= */}
      <div className="absolute inset-x-0 bottom-0 z-40 px-4 pb-4">
        <div className="mx-auto flex max-w-md items-stretch justify-center gap-1.5 rounded-2xl border border-slate-600/40
          bg-black/70 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
          {PAGES.map(({ id, icon: Icon, labelKey }) => {
            const active = activePage === id;
            return (
              <button key={id} onClick={() => (active ? closePage() : openPage(id))}
                className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-all active:scale-95
                  ${active
                  ? 'border border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                  : 'border border-transparent text-slate-300 hover:text-amber-200'}`}>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-black leading-none">{t(labelKey)}</span>
                {openPages.includes(id) && !active && (
                  <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/90" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= قاب صفحات — پنل‌ها inline و بدون بارگذاری مجدد ================= */}
      {openPages.map((id) => {
        const active = activePage === id;
        const label = t(PAGES.find((p) => p.id === id)?.labelKey ?? id);
        return (
          <div key={id}
            className={`absolute inset-x-2 top-[4%] bottom-[104px] z-30 flex-col overflow-hidden rounded-2xl
              border border-amber-400/30 bg-[#0b0f1c] shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-md
              ${active ? 'flex' : 'hidden'}`}>
            {/* نوار عنوان */}
            <div className="flex items-center justify-between border-b border-amber-400/20 bg-black/60 px-3 py-2">
              <span className="text-sm font-black text-amber-200">{label}</span>
              <button onClick={closePage}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/60
                bg-black/50 text-slate-300 active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* پنل — همان لحظه رندر می‌شود؛ بازگشت به تب فوری است (بدون unmount) */}
            <div className="relative flex-1 overflow-hidden">
              <PageShellContext.Provider value={pageShell()}>
                {id === 'map' && <CampaignMap onStart={startBattle} />}
                {id === 'heroes' && <HeroesPanel />}
                {id === 'forge' && <ForgePanel />}
                {id === 'achievements' && <AchievementsPanel />}
                {id === 'settings' && <SettingsPanel />}
              </PageShellContext.Provider>
            </div>
          </div>
        );
      })}
    </div>
  );
}
