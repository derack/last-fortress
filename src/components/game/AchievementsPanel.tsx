'use client';

import { ArrowRight, Trophy, Star, Swords, Flame, Shield, Zap } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS } from '@/game/data/level1';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// دستاوردها — ۳۰ دستاورد با پاداش کریستال
// ============================================================

export function AchievementsPanel() {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  if (!save) return null;

  const unlocked = save.achievements;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      <div className="flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        <button onClick={() => setScreen('menu')}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="flex items-center gap-2 text-xl font-black text-amber-200">
          <Trophy className="h-5 w-5" />
          {t('achievements')}
        </h2>
        <span className="mr-auto rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
          {faNum(unlocked.length)} / {faNum(ACHIEVEMENTS.length)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-2">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.includes(a.id);
            const Icon = iconFor(a.id);
            return (
              <div key={a.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${got ? 'border-amber-400/40 bg-amber-500/10' : 'border-slate-800 bg-black/40 opacity-70'}`}>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${got ? 'bg-amber-400/25 text-amber-300' : 'bg-slate-800 text-slate-600'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-black ${got ? 'text-amber-200' : 'text-slate-400'}`}>{t(a.nameKey)}</div>
                  <div className="text-xs text-slate-500">{t(a.descKey)}</div>
                </div>
                <div className={`flex items-center gap-1 text-xs font-black ${got ? 'text-emerald-400' : 'text-cyan-500/60'}`}>
                  <span dir="ltr">+{faNum(a.crystalReward)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function iconFor(id: string): React.ComponentType<{ className?: string }> {
  if (id.includes('mage') || id.includes('storm') || id.includes('magic')) return Zap;
  if (id.includes('inferno') || id.includes('slayer') || id.includes('bane') || id.includes('exterminator')) return Swords;
  if (id.includes('guardian') || id.includes('shield') || id.includes('defense')) return Shield;
  if (id.includes('star')) return Star;
  return Trophy;
}
