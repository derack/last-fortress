'use client';

import { useState } from 'react';
import { ArrowRight, Lock, Star, Play, Heart, Swords, Shield, Gem, Check, Ghost, Bug, Bird, Zap, Flame, Snowflake, Crown, Crosshair, Cog, Wand2, Axe, Target, FlaskConical, MoveDiagonal, Sparkles, Sun, Moon } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { REGIONS, LEVELS, isRegionUnlocked } from '@/game/data/levels';
import { ENEMIES } from '@/game/data/enemies';
import { TOWERS, TOWER_BUILD_ORDER, isTowerUnlocked, starsUntilTower } from '@/game/data/towers';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// نقشه Campaign — ۶ منطقه آریانا با باز شدن تدریجی
// هر منطقه: مسیر، تم محیطی، موج‌ها و Boss مخصوص خودش
// ============================================================
const ENEMY_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  shadow: Ghost, warrior: Swords, golem: Shield, spider: Bug, warlock: Zap, flyer: Bird,
  golemKing: Crown, shadowSoldier: Swords, spirit: Heart, hunter: Crosshair, warMachine: Cog,
  crystalMonster: Gem, smallDragon: Bird, summoner: Wand2, aetherTank: Shield, destroyer: Axe,
  annihilator: Cog, fireGiant: Flame, iceGiant: Snowflake, blackDragon: Crown, darkLord: Crown,
};

const TOWER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  sentinel: Swords, lightning: Zap, fire: Flame, ice: Snowflake, cannon: Target,
  poison: FlaskConical, ballista: MoveDiagonal, arcane: Sparkles, temple: Sun, void: Moon,
};

export function CampaignMap({ onStart }: { onStart: () => void }) {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  const setPendingLevel = useGameStore((s) => s.setPendingLevel);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  // حالت مستقل (iframe) — دکمه بازگشت/شروع به پنجره والد پیام می‌دهند
  const standalone = typeof window !== 'undefined' && window.self !== window.top;

  const goBack = () => {
    if (standalone && typeof window !== 'undefined') {
      window.parent.postMessage({ type: 'closePage' }, '*');
    } else {
      setScreen('menu');
    }
  };

  if (!save) return null;

  const completed = new Set(Object.entries(save.levels).filter(([, r]) => r.completed).map(([id]) => id));
  const briefing = briefingId ? LEVELS[briefingId] : null;
  const briefingStars = briefing ? save.levels[briefing.id]?.stars ?? 0 : 0;
  const briefingEnemies = briefing
    ? [...new Set(briefing.waves.flatMap((w) => w.groups.map((g) => g.enemy)))]
    : [];
  const briefingTowers = TOWER_BUILD_ORDER.slice(0, 6);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      {/* هدر — در حالت iframe دکمه بستن روی قاب والد است */}
      <div className="flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        {!standalone && (
          <button onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-xl font-black text-amber-200">{t('campaign')}</h2>
      </div>

      {/* مناطق */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-3">
          {REGIONS.map((r) => {
            const unlocked = isRegionUnlocked(r.id, completed);
            const record = save.levels[r.levelId];
            const stars = record?.stars ?? 0;
            const envColor: Record<string, string> = {
              plains: 'from-emerald-900/50', forest: 'from-violet-950/60', tundra: 'from-sky-900/50',
              volcano: 'from-orange-950/60', wastes: 'from-yellow-950/40', citadel: 'from-purple-950/60',
            };
            return (
              <button key={r.id}
                onClick={() => { if (unlocked) { setPendingLevel(r.levelId); setBriefingId(r.levelId); } }}
                className={`relative w-full overflow-hidden rounded-2xl border p-4 text-right transition-all
                  ${unlocked
                    ? `border-amber-400/40 bg-gradient-to-l ${envColor[r.env] ?? 'from-emerald-900/50'} to-[#0d1420] active:scale-[0.98]`
                    : 'border-slate-700/50 bg-black/40 opacity-70'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-black
                    ${unlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                    {unlocked ? faNum(r.id) : <Lock className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-black text-slate-100">{t(r.nameKey)}</div>
                    <div className="text-xs text-slate-400">
                      {unlocked ? t(r.tagKey) : t('regionLockedHint')}
                    </div>
                  </div>
                  {record?.completed && <Check className="h-5 w-5 text-emerald-400" />}
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <Star key={i} className={`h-4 w-4 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* گزارش نبرد */}
      {briefing && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setBriefingId(null)}>
          <div className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl border-t border-amber-400/30 bg-[#0d1420] p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-amber-200">{t(briefing.nameKey)}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">{t(briefing.descKey)}</p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatCard icon={Heart} label={t('coreHealth')} value={faNum(briefing.coreHp)} color="text-rose-400" />
              <StatCard icon={Swords} label={t('enemyWaves')} value={faNum(briefing.waves.length)} color="text-amber-400" />
              <StatCard icon={Star} label={t('starsEarned')} value={faNum(briefingStars)} color="text-yellow-300" />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm font-bold text-slate-300">{t('enemies')}</div>
              <div className="flex flex-wrap gap-2">
                {briefingEnemies.map((id) => {
                  const e = ENEMIES[id];
                  if (!e) return null;
                  const Icon = ENEMY_ICONS[e.id] ?? Ghost;
                  return (
                    <div key={id} className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-slate-300">
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
                {briefingTowers.map((id) => {
                  const tw = TOWERS[id];
                  if (!tw) return null;
                  const Icon = TOWER_ICONS[tw.id] ?? Shield;
                  // وضعیت باز شدن تدریجی — قفل با ستاره
                  const unlocked = isTowerUnlocked(save, id);
                  const remaining = starsUntilTower(save, id);
                  return (
                    <div key={id} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold
                      ${unlocked ? 'border-slate-700/60 bg-black/40 text-slate-300' : 'border-slate-800/70 bg-black/60 text-slate-500'}`}>
                      {unlocked ? (
                        <Icon className="h-4 w-4" style={{ color: '#' + tw.color.toString(16).padStart(6, '0') }} />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      {t(tw.nameKey)}
                      {!unlocked && remaining > 0 && (
                        <span className="flex items-center gap-0.5 text-yellow-300/70">
                          <Star className="h-3 w-3 fill-yellow-300/70" />
                          {faNum(remaining)}
                        </span>
                      )}
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
              {faNum(briefing.startCrystals)} {t('crystal')} + {faNum(briefing.startCoins)} {t('coins')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
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
