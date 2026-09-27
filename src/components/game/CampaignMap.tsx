'use client';

import { useState } from 'react';
import { ArrowRight, Lock, Star, Play, Heart, Swords, Shield, Zap, Flame, Snowflake, Bug, Ghost, Bird, Gem } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { REGIONS, LEVEL_1 } from '@/game/data/level1';
import { ENEMIES } from '@/game/data/enemies';
import { TOWERS } from '@/game/data/towers';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// نقشه Campaign — مناطق آریانا + گزارش نبرد مرحله ۱
// ============================================================

const ENEMY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  shadow: Ghost, warrior: Swords, golem: Shield, spider: Bug, warlock: Zap, flyer: Bird, golemKing: Shield,
};

const TOWER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sentinel: Swords, lightning: Zap, fire: Flame, ice: Snowflake,
};

export function CampaignMap({ onStart }: { onStart: () => void }) {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  const [briefing, setBriefing] = useState(false);
  const stars = save?.levels['l1']?.stars ?? 0;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      {/* هدر */}
      <div className="flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        <button onClick={() => setScreen('menu')}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-amber-200">{t('campaign')}</h2>
      </div>

      {/* مناطق */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-3">
          {REGIONS.map((r) => {
            const unlocked = r.unlocked;
            return (
              <button key={r.id}
                onClick={() => unlocked && setBriefing(true)}
                className={`relative w-full overflow-hidden rounded-2xl border p-4 text-right transition-all
                  ${unlocked
                    ? 'border-amber-400/40 bg-gradient-to-l from-emerald-900/50 to-[#0d1420] active:scale-[0.98]'
                    : 'border-slate-700/50 bg-black/40 opacity-70'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-black
                    ${unlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                    {unlocked ? faNum(r.id) : <Lock className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-black text-slate-100">{t(r.nameKey)}</div>
                    <div className="text-xs text-slate-400">
                      {unlocked ? t('protectCore') : t('regionLocked')}
                    </div>
                  </div>
                  {r.id === 1 && (
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <Star key={i} className={`h-5 w-5 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* گزارش نبرد */}
      {briefing && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setBriefing(false)}>
          <div className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl border-t border-amber-400/30 bg-[#0d1420] p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-amber-200">{t(LEVEL_1.nameKey)}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">{t('storyIntro2')}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatCard icon={Heart} label={t('coreHealth')} value={faNum(100)} color="text-rose-400" />
              <StatCard icon={Swords} label={t('enemyWaves')} value={faNum(LEVEL_1.waves.length)} color="text-amber-400" />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm font-bold text-slate-300">{t('enemies')}</div>
              <div className="flex flex-wrap gap-2">
                {Object.values(ENEMIES).map((e) => {
                  const Icon = ENEMY_ICONS[e.id] ?? Ghost;
                  return (
                    <div key={e.id} className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-slate-300">
                      <Icon className="h-4 w-4" style={{ color: '#' + e.accent.toString(16).padStart(6, '0') }} />
                      {t(e.nameKey)}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-2 text-sm font-bold text-slate-300">{t('recommended')}</div>
              <div className="flex flex-wrap gap-2">
                {Object.values(TOWERS).map((tw) => {
                  const Icon = TOWER_ICONS[tw.id] ?? Shield;
                  return (
                    <div key={tw.id} className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-slate-300">
                      <Icon className="h-4 w-4" style={{ color: '#' + tw.color.toString(16).padStart(6, '0') }} />
                      {t(tw.nameKey)}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={onStart}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-400/40
              bg-gradient-to-b from-amber-500 to-orange-600 px-8 py-4 text-xl font-black text-white
              shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-95">
              <Play className="h-6 w-6" />
              {t('startBattle')}
            </button>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-cyan-300/70">
              <Gem className="h-3.5 w-3.5" />
              {faNum(LEVEL_1.startCrystals)} {t('crystal')} + {faNum(LEVEL_1.startCoins)} {t('coins')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-black/40 p-3">
      <div className={`flex items-center gap-1.5 text-xs font-bold ${color}`}>
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-slate-100">{value}</div>
    </div>
  );
}
