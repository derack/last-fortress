'use client';

import { ArrowRight, User, Lock, Star, Zap, Heart, Gauge } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { HEROES, HERO_META, HERO_ROSTER } from '@/game/data/magic';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// قهرمانان — آرمان فعال، بقیه به‌زودی
// ============================================================

export function HeroesPanel() {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  if (!save) return null;

  const arman = HEROES.arman;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      <div className="flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        <button onClick={() => setScreen('menu')}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-amber-200">{t('heroes')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-3">
          {/* آرمان — فعال */}
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-l from-amber-900/30 to-[#0d1420] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/25 text-amber-300">
                <User className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-black text-amber-100">{t(arman.nameKey)}</div>
                <div className="text-xs font-bold text-amber-400/80">{t(arman.titleKey)}</div>
              </div>
              <div className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-300">
                {t('heroLevel', faNum(1))}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t('heroArmanDesc')}</p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <HeroStat icon={Heart} label={t('damage')} value={faNum(arman.damage)} color="text-rose-400" />
              <HeroStat icon={Zap} label={t('fireRate')} value={faNum(arman.fireRate)} color="text-amber-400" />
              <HeroStat icon={Gauge} label={t('range')} value={faNum(arman.range)} color="text-cyan-400" />
            </div>

            <div className="mt-3 rounded-xl border border-violet-400/30 bg-violet-950/30 p-3">
              <div className="flex items-center gap-1.5 text-sm font-black text-violet-300">
                <Star className="h-4 w-4" />
                {t(arman.abilityNameKey)}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {t(arman.abilityDescKey, faNum(arman.abilityBuff))}
              </p>
            </div>
          </div>

          {/* قهرمانان قفل */}
          {HERO_ROSTER.filter((h) => !h.unlocked).map((h) => {
            const meta = HERO_META[h.id];
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-black/40 p-4 opacity-70">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-600">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-black text-slate-400">{t(meta.nameKey)}</div>
                  <div className="text-xs font-bold text-slate-600">{t(meta.titleKey)}</div>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500">
                  {t('soon')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-black/40 p-2.5 text-center">
      <Icon className={`mx-auto h-4 w-4 ${color}`} />
      <div className="mt-1 text-base font-black text-slate-100">{value}</div>
      <div className="text-[10px] font-bold text-slate-500">{label}</div>
    </div>
  );
}
