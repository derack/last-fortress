'use client';

import { useState } from 'react';
import {
  ArrowRight, Lock, Star, Play, Heart, Swords, Shield, Gem, Check, Ghost, Bug, Bird, Zap,
  Flame, Snowflake, Crown, Crosshair, Cog, Wand2, Axe, Target, FlaskConical, MoveDiagonal,
  Sparkles, Sun, Moon, Route, ChevronDown, MapPin, Trophy, Coins,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { CHAPTERS, STAGES, stageId, isStageUnlocked, isChapterUnlocked, chapterStars, completedStageCount } from '@/game/data/campaign';
import { ENEMIES } from '@/game/data/enemies';
import { TOWERS, TOWER_BUILD_ORDER, isTowerUnlocked, starsUntilTower } from '@/game/data/towers';
import { t, faNum } from '@/game/data/i18n';
import { usePageShell } from './standalone';

// ============================================================
// نقشه Campaign — ۱۰ فصل × ۱۰ مرحله = ۱۰۰ مرحله
// هر فصل: هویت محیطی + Boss + مراحل سخت چندمسیره (فصل ۲ به بعد)
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

const ENV_COLOR: Record<string, string> = {
  plains: 'from-emerald-900/50', forest: 'from-violet-950/60', tundra: 'from-sky-900/50',
  volcano: 'from-orange-950/60', wastes: 'from-yellow-950/40', citadel: 'from-purple-950/60',
};

const ENV_DAY: Record<string, boolean> = { plains: true, forest: false, tundra: true, volcano: false, wastes: true, citadel: false };

export function CampaignMap({ onStart }: { onStart: () => void }) {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  const setPendingLevel = useGameStore((s) => s.setPendingLevel);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<number>(1);
  // حالت جاسازی‌شده (داخل قاب منو) — دکمه بازگشت/شروع به والد سپرده می‌شود
  const shell = usePageShell();
  const embedded = shell !== null;
  // سازگاری با routeهای مستقل قدیمی
  const standalone = embedded || (typeof window !== 'undefined' && window.self !== window.top);

  const goBack = () => {
    if (shell) {
      shell.close();
    } else if (typeof window !== 'undefined' && window.self !== window.top) {
      window.parent.postMessage({ type: 'closePage' }, '*');
    } else {
      setScreen('menu');
    }
  };

  if (!save) return null;

  const completedIds = new Set(Object.entries(save.levels).filter(([, r]) => r.completed).map(([id]) => id));
  const doneCount = completedStageCount(save);
  const briefing = briefingId ? STAGES[briefingId] : null;
  const briefingStars = briefing ? save.levels[briefing.id]?.stars ?? 0 : 0;
  const briefingEnemies = briefing
    ? [...new Set(briefing.waves.flatMap((w) => w.groups.map((g) => g.enemy)))]
    : [];
  const briefingTowers = TOWER_BUILD_ORDER;

  const openStage = (chId: number, st: number) => {
    setPendingLevel(stageId(chId, st));
    setBriefingId(stageId(chId, st));
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      {/* هدر — پیشرفت کل */}
      <div className="panel-header flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        {!standalone && (
          <button onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-xl font-black text-amber-200">{t('campaign')}</h2>
        <div className="mr-auto flex items-center gap-3 text-xs font-black">
          <span className="flex items-center gap-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-300" />
            {faNum(chapterStarsSum(save))}/{faNum(300)}
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            {faNum(doneCount)}/{faNum(100)}
          </span>
        </div>
      </div>

      {/* فصل‌ها */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-2.5">
          {CHAPTERS.map((ch) => {
            const unlocked = isChapterUnlocked(ch.id, completedIds);
            const chStars = chapterStars(ch.id, save);
            const chDone = completedIds.has(stageId(ch.id, 10));
            const isOpen = openChapter === ch.id;
            const boss = ENEMIES[ch.bossId];
            return (
              <div key={ch.id}
                className={`overflow-hidden rounded-2xl border transition-all
                  ${unlocked ? 'border-amber-400/30' : 'border-slate-800/60 opacity-60'}`}>
                {/* هدر فصل — باز/بسته شدن */}
                <button
                  onClick={() => { if (unlocked) setOpenChapter(isOpen ? -1 : ch.id); }}
                  className={`relative flex w-full items-center gap-3 bg-gradient-to-l p-3.5 text-right
                    ${unlocked ? `${ENV_COLOR[ch.env] ?? 'from-emerald-900/50'} to-[#0d1420] active:scale-[0.99]` : 'bg-black/40'}`}>
                  <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl
                    ${unlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                    {unlocked ? (
                      <>
                        <span className="text-[9px] font-bold leading-none opacity-80">{t('chapterShort')}</span>
                        <span className="text-lg font-black leading-tight">{faNum(ch.id)}</span>
                      </>
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-base font-black text-slate-100">{t(ch.nameKey)}</span>
                      {chDone && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {unlocked ? t(ch.tagKey) : t('regionLockedHint')}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[11px] font-black text-yellow-300">
                      <Star className="h-3 w-3 fill-yellow-300" />
                      {faNum(chStars)}
                    </div>
                    {boss && unlocked && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-rose-300/90">
                        <Crown className="h-3 w-3" />
                        {t(boss.nameKey)}
                      </div>
                    )}
                  </div>
                  {unlocked && (
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* شبکه ۱۰ مرحله فصل */}
                {unlocked && isOpen && (
                  <div className="border-t border-slate-800/60 bg-black/30 p-3">
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((st) => {
                        const sid = stageId(ch.id, st);
                        const record = save.levels[sid];
                        const stUnlocked = isStageUnlocked(ch.id, st, completedIds);
                        const paths = STAGES[sid]?.paths?.length ?? 1;
                        const isBossStage = st === 10;
                        return (
                          <button key={sid}
                            onClick={() => { if (stUnlocked) openStage(ch.id, st); }}
                            disabled={!stUnlocked}
                            className={`relative flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-all
                              ${!stUnlocked
                                ? 'border-slate-800/70 bg-black/50 text-slate-600'
                                : record?.completed
                                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 active:scale-95'
                                  : 'border-amber-400/50 bg-amber-950/30 text-amber-200 active:scale-95'}`}>
                              {isBossStage ? <Crown className="h-4 w-4" /> : (
                                <span className="text-sm font-black leading-none">{faNum(st)}</span>
                              )}
                              <div className="flex gap-0.5">
                                {[0, 1, 2].map((i) => (
                                  <Star key={i} className={`h-2 w-2 ${record && i < record.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                                ))}
                              </div>
                              {paths > 1 && stUnlocked && (
                                <div className="flex items-center gap-0.5 text-[8px] font-bold text-cyan-300/80">
                                  <Route className="h-2.5 w-2.5" />
                                  ×{faNum(paths)}
                                </div>
                              )}
                              {!stUnlocked && <Lock className="absolute left-1 top-1 h-2.5 w-2.5 text-slate-600" />}
                            </button>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* گزارش نبرد */}
      {briefing && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setBriefingId(null)}>
          <div className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl border-t border-amber-400/30 bg-[#0d1420] p-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs font-black text-amber-300/80">
              <MapPin className="h-3.5 w-3.5" />
              {t('chapterShort')} {faNum(briefing.chapter ?? 1)} — {t('stageShort')} {faNum(briefing.stage ?? 1)}
              {briefing.stage === 10 && (
                <span className="flex items-center gap-1 rounded-md bg-rose-950/70 px-2 py-0.5 text-rose-300">
                  <Trophy className="h-3 w-3" />
                  {t('bossStage')}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-black text-amber-200">{t(briefing.nameKey)}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">{t(briefing.descKey)}</p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatCard icon={Heart} label={t('coreHealth')} value={faNum(briefing.coreHp)} color="text-rose-400" />
              <StatCard icon={Swords} label={t('enemyWaves')} value={faNum(briefing.waves.length)} color="text-amber-400" />
              <StatCard icon={Route} label={t('attackPaths')} value={faNum(briefing.paths?.length ?? 1)} color="text-cyan-400" />
            </div>

            {/* هشدار چندمسیره */}
            {(briefing.paths?.length ?? 1) > 1 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-3 py-2.5 text-xs font-bold text-cyan-200">
                <Route className="h-4 w-4 shrink-0" />
                {t('multiPathWarning', faNum(briefing.paths?.length ?? 1))}
              </div>
            )}

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
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-300/80">
              <Coins className="h-3.5 w-3.5" />
              {t('startBudget')}: {faNum(briefing.startCoins)} {t('coins')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function chapterStarsSum(save: NonNullable<ReturnType<typeof useGameStore.getState>['save']>): number {
  let sum = 0;
  for (const ch of CHAPTERS) sum += chapterStars(ch.id, save);
  return sum;
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

// استفاده ENV_DAY برای احتمال نمایش آیکون روز/شب در آینده
void ENV_DAY;
