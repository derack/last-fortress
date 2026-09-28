'use client';

import { ArrowRight, User, Lock, Star, Zap, Heart, Gauge, Check, Swords } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useStandaloneBack } from './standalone';
import { HEROES } from '@/game/data/magic';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// قهرمانان — ۴ قهرمان قابل بازی: بازکردن با کریستال + انتخاب
// ============================================================

const ROLE_KEYS: Record<string, string> = {
  commander: 'heroArmanTitle',
  guardian: 'heroAriaTitle',
  berserker: 'heroRadinTitle',
  ranger: 'heroNilaTitle',
};

export function HeroesPanel() {
  const goBack = useStandaloneBack();
  const save = useGameStore((s) => s.save);
  const setSelectedHero = useGameStore((s) => s.setSelectedHero);
  const unlockHero = useGameStore((s) => s.unlockHero);
  const pushToast = useGameStore((s) => s.pushToast);
  if (!save) return null;

  const roster = ['arman', 'aria', 'radin', 'nila'];

  const handleUnlock = (id: string, cost: number) => {
    if (unlockHero(id, cost)) {
      pushToast('heroUnlocked', 'success');
    } else {
      pushToast('notEnoughCrystals', 'error');
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      <div className="flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        <button onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-amber-200">{t('heroes')}</h2>
      </div>

      <div className="px-4 pt-3 text-center text-xs font-bold text-slate-400">{t('heroesDesc')}</div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-3">
          {roster.map((id) => {
            const hero = HEROES[id];
            const unlocked = save.unlockedHeroes.includes(id);
            const selected = save.selectedHero === id;
            return (
              <div key={id}
                className={`rounded-2xl border p-4 transition-all
                  ${selected
                    ? 'border-amber-400/60 bg-gradient-to-l from-amber-900/40 to-[#0d1420] shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                    : unlocked
                      ? 'border-slate-600/50 bg-gradient-to-l from-slate-800/60 to-[#0d1420]'
                      : 'border-slate-700/50 bg-black/40 opacity-80'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl
                    ${selected ? 'bg-amber-400/25 text-amber-300' : unlocked ? 'bg-slate-700/60 text-slate-200' : 'bg-slate-800/80 text-slate-500'}`}>
                    <User className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-amber-100">{t(hero.nameKey)}</span>
                      {selected && <Check className="h-4 w-4 text-amber-400" />}
                    </div>
                    <div className="text-xs font-bold text-amber-400/80">{t(hero.titleKey)}</div>
                  </div>

                  {/* اقدام: انتخاب / بازکردن / قفل */}
                  {unlocked ? (
                    <button
                      onClick={() => setSelectedHero(id)}
                      disabled={selected}
                      className={`rounded-full px-4 py-1.5 text-xs font-black active:scale-95
                        ${selected ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-600/80 text-white'}`}>
                      {selected ? t('selectedHero') : t('selectHero')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnlock(id, hero.unlockCost)}
                      className="flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-300 active:scale-95">
                      <GemIcon />
                      {faNum(hero.unlockCost)}
                      <span className="text-cyan-200/80">· {t('unlockHero')}</span>
                    </button>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-400">{t(hero.descKey)}</p>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <HeroStat icon={Heart} label={t('damage')} value={faNum(hero.damage)} color="text-rose-400" />
                  <HeroStat icon={Swords} label={t('fireRate')} value={faNum(hero.fireRate)} color="text-amber-400" />
                  <HeroStat icon={Gauge} label={t('range')} value={faNum(hero.range)} color="text-cyan-400" />
                  <HeroStat icon={Zap} label="HP" value={faNum(hero.hp)} color="text-emerald-400" />
                </div>

                <div className="mt-3 rounded-xl border border-violet-400/30 bg-violet-950/30 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-black text-violet-300">
                    <Star className="h-4 w-4" />
                    {t(hero.abilityNameKey)}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {t(hero.abilityDescKey, hero.abilityKind === 'rainOfArrows' ? faNum(12) : faNum(hero.abilityBuff))}
                  </p>
                </div>

                {!unlocked && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <Lock className="h-3 w-3" />
                    {t('heroLocked')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GemIcon() {
  return <span className="inline-block h-3 w-3 rotate-45 rounded-[2px] bg-cyan-400" />;
}

function HeroStat({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-black/40 p-2 text-center">
      <Icon className={`mx-auto h-4 w-4 ${color}`} />
      <div className="mt-0.5 text-[9px] font-bold text-slate-500">{label}</div>
      <div className="text-sm font-black text-slate-100">{value}</div>
    </div>
  );
}
