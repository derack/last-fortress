'use client';

import { Swords, Users, Trophy, Settings, Gem } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// صفحه اصلی — مرکز فرماندهی فانتزی مدرن با هسته آذر
// ============================================================

export function MainMenu({ onStart }: { onStart: () => void }) {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden">
      {/* پس‌زمینه سینمایی */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f1c] via-[#12101f] to-[#1c0f0a]" />
      {/* نور هسته آذر */}
      <div className="azar-core-glow absolute left-1/2 top-[20%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 -translate-y-1/2">
        <div className="core-crystal h-16 w-16 rotate-45 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 shadow-[0_0_60px_20px_rgba(245,158,11,0.45)]" />
      </div>
      {/* خطوط شبکه مدرن */}
      <div className="hud-grid absolute inset-0 opacity-30" />
      {/* کریستال‌های محیطی */}
      <div className="absolute bottom-24 right-10 h-10 w-6 rotate-12 bg-cyan-400/40 blur-[1px]" />
      <div className="absolute bottom-32 left-14 h-8 w-5 -rotate-12 bg-violet-400/40 blur-[1px]" />

      {/* محتوا */}
      <div className="relative z-10 flex h-full flex-col items-center justify-between py-8">
        <div className="mt-24 text-center">
          <h1 className="game-title text-5xl font-black tracking-tight text-transparent md:text-6xl
            bg-gradient-to-b from-amber-100 via-amber-300 to-orange-500 bg-clip-text
            drop-shadow-[0_2px_20px_rgba(245,158,11,0.4)]">
            {t('gameTitle')}
          </h1>
          <p className="mt-2 text-lg font-bold text-amber-200/80 md:text-xl">{t('gameSubtitle')}</p>
          <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3 px-6">
          <button onClick={onStart}
            className="group relative flex items-center justify-center gap-3 rounded-2xl border border-amber-400/40
            bg-gradient-to-b from-amber-500/90 to-orange-600/90 px-8 py-4 text-xl font-black text-white
            shadow-[0_0_30px_rgba(245,158,11,0.35)] transition-all active:scale-95">
            <Swords className="h-6 w-6" />
            {t('play')}
          </button>
          <MenuButton icon={Users} label={t('heroes')} onClick={() => setScreen('heroes')} />
          <MenuButton icon={Trophy} label={t('achievements')} onClick={() => setScreen('achievements')} badge={save ? save.achievements.length : 0} />
          <MenuButton icon={Settings} label={t('settings')} onClick={() => setScreen('settings')} />
        </div>

        <div className="mb-2 flex flex-col items-center gap-1">
          {save && (
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-black/40 px-4 py-1.5 text-sm font-bold text-cyan-300">
              <Gem className="h-4 w-4" />
              {faNum(save.crystals)} {t('crystal')}
            </div>
          )}
          <p className="text-xs text-slate-500">{t('holdTheLine')}</p>
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, badge }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button onClick={onClick}
      className="relative flex items-center justify-center gap-3 rounded-xl border border-slate-600/50
      bg-black/50 px-6 py-3 text-lg font-bold text-slate-200 backdrop-blur-sm
      transition-all hover:border-amber-400/40 hover:text-amber-200 active:scale-95">
      <Icon className="h-5 w-5 text-amber-400/80" />
      {label}
      {!!badge && (
        <span className="absolute -left-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full
          bg-amber-500 px-1.5 text-xs font-black text-black">
          {faNum(badge)}
        </span>
      )}
    </button>
  );
}
