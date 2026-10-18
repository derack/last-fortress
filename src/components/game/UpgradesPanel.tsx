'use client';

import { useState } from 'react';
import {
  ArrowRight, Hammer, Lock, User, Swords, Shield, Flame, Snowflake, Zap, Target,
  FlaskConical, MoveDiagonal, Sparkles, Sun, Moon, BookOpen, Check, Gem, Heart, Star,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useStandaloneBack } from './standalone';
import { HEROES } from '@/game/data/magic';
import { TOWERS, isTowerUnlocked, starsUntilTower } from '@/game/data/towers';
import {
  META_MAX_LEVEL, HERO_META_STEP, TOWER_META_STEP,
  heroMetaLevel, towerMetaLevel, heroMetaPct, towerMetaPct,
  heroUpgradeCost, towerUpgradeCost, META_TOWER_IDS, grantForgeAchievements,
} from '@/game/data/meta';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// آهنگری آذر — ارتقای دائمی قهرمانان و برج‌ها با دانش باستانی
// هر سطح قهرمان: +۸٪ جان و آسیب — هر سطح برج: +۶٪ آسیب +۳٪ نرخ +۲٪ برد
// ارتقاها در همهٔ مناطق کمپین اثر دارند (سازندهٔ موتور از ذخیره می‌خواند)
// ============================================================

const TOWER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  sentinel: Swords, lightning: Zap, fire: Flame, ice: Snowflake, cannon: Target,
  poison: FlaskConical, ballista: MoveDiagonal, arcane: Sparkles, temple: Sun, void: Moon,
};

const HERO_ROLE_COLORS: Record<string, string> = {
  commander: 'text-sky-300',
  guardian: 'text-cyan-300',
  berserker: 'text-rose-300',
  ranger: 'text-violet-300',
};

type ForgeTab = 'heroes' | 'towers';

export function UpgradesPanel() {
  const goBack = useStandaloneBack();
  const save = useGameStore((s) => s.save);
  const updateSave = useGameStore((s) => s.updateSave);
  const pushToast = useGameStore((s) => s.pushToast);
  const [tab, setTab] = useState<ForgeTab>('heroes');

  if (!save) return null;

  /** ارتقای دائمی — پرداخت با دانش باستانی و ثبت در ذخیره */
  const doUpgrade = (kind: ForgeTab, id: string) => {
    const store = useGameStore.getState();
    const sv = store.save;
    if (!sv) return;
    const lvl = kind === 'heroes' ? heroMetaLevel(sv, id) : towerMetaLevel(sv, id);
    if (lvl >= META_MAX_LEVEL) {
      store.pushToast('forgeMaxedToast', 'info');
      return;
    }
    const cost = kind === 'heroes' ? heroUpgradeCost(lvl) : towerUpgradeCost(lvl);
    if (sv.knowledge < cost) {
      store.pushToast('forgeNotEnoughKnowledge', 'error');
      return;
    }
    store.updateSave((s2) => {
      if (kind === 'heroes') s2.heroUpgrades[id] = (s2.heroUpgrades[id] ?? 0) + 1;
      else s2.towerUpgrades[id] = (s2.towerUpgrades[id] ?? 0) + 1;
      s2.knowledge -= cost; // پرداخت دانش باستانی
      // دستاوردهای آهنگری — سطح ۱۰ و ۲۰ (idempotent)
      grantForgeAchievements(s2);
    });
    store.pushToast('forgeUpgraded', 'success');
    // اگر دستاوردی فعال شده باشد پاداشش در همان updateSave ثبت شده است
  };

  const pct = (p: number) => `+${faNum(Math.round(p * 100))}٪`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      {/* هدر */}
      <div className="panel-header flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        <button onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <Hammer className="h-5 w-5 text-orange-400" />
        <h2 className="text-xl font-black text-amber-200">{t('forgeTitle')}</h2>
      </div>

      <div className="px-4 pt-3 text-center text-xs font-bold leading-5 text-slate-400">{t('forgeDesc')}</div>

      {/* نوار موجودی دانش + تب‌ها — همیشه مرئی حتی در حالت iframe */}
      <div className="mx-auto mt-3 flex w-full max-w-md items-center gap-2 px-4">
        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 py-2.5 text-base font-black text-violet-300">
          <BookOpen className="h-5 w-5" />
          {faNum(save.knowledge)}
          <span className="text-xs font-bold text-violet-300/70">{t('knowledge')}</span>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="mx-auto mt-3 flex w-full max-w-md gap-2 px-4">
        {(['heroes', 'towers'] as ForgeTab[]).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-black transition-all active:scale-95
              ${tab === id
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                : 'border-slate-700/50 bg-black/40 text-slate-400'}`}>
            {id === 'heroes' ? <User className="h-4 w-4" /> : <Hammer className="h-4 w-4" />}
            {t(id === 'heroes' ? 'forgeHeroesTab' : 'forgeTowersTab')}
          </button>
        ))}
      </div>

      {/* کارت‌ها */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-3">
          {tab === 'heroes'
            ? Object.keys(HEROES).map((id) => {
              const hero = HEROES[id];
              const unlocked = save.unlockedHeroes.includes(id);
              const lvl = heroMetaLevel(save, id);
              const maxed = lvl >= META_MAX_LEVEL;
              const cost = heroUpgradeCost(lvl);
              const affordable = save.knowledge >= cost;
              const curPct = heroMetaPct(lvl);
              const nextPct = heroMetaPct(lvl + 1);
              return (
                <div key={id}
                  className={`rounded-2xl border p-4 transition-all
                    ${maxed
                    ? 'border-emerald-500/40 bg-gradient-to-l from-emerald-900/30 to-[#0d1420]'
                    : unlocked
                      ? 'border-slate-600/50 bg-gradient-to-l from-slate-800/60 to-[#0d1420]'
                      : 'border-slate-700/50 bg-black/40 opacity-75'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-700/60 text-slate-200">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-black text-amber-100">{t(hero.nameKey)}</div>
                      <div className={`text-xs font-bold ${HERO_ROLE_COLORS[hero.role] ?? 'text-amber-400/80'}`}>{t(hero.titleKey)}</div>
                    </div>
                    {maxed && <Check className="h-5 w-5 text-emerald-400" />}
                  </div>

                  {/* سطوح — ۱۰ پله */}
                  <LevelPips level={lvl} max={META_MAX_LEVEL} />

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <ForgeStat icon={Heart} label={t('forgeHeroBonus')} value={pct(curPct)} color="text-rose-400" />
                    <ForgeStat icon={Swords} label={t('level')} value={`${t('forgeLevel')} ${faNum(lvl)}`} color="text-amber-400" />
                    <ForgeStat icon={Sparkles} label={t('forgeNext')} value={maxed ? t('forgeMax') : pct(nextPct)} color="text-violet-300" />
                  </div>

                  {/* اقدام ارتقا */}
                  {unlocked ? (
                    maxed ? (
                      <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-center text-sm font-black text-emerald-300">
                        {t('forgeMax')}
                      </div>
                    ) : (
                      <UpgradeButton cost={cost} affordable={affordable} onClick={() => doUpgrade('heroes', id)} />
                    )
                  ) : (
                    <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/60 bg-black/40 py-2 text-xs font-bold text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      {t('forgeHeroLockedHint')}
                    </div>
                  )}
                </div>
              );
            })
            : null}

          {tab === 'towers' && (
            <>
              {META_TOWER_IDS.map((id) => {
                const tw = TOWERS[id];
                const unlocked = isTowerUnlocked(save, id);
                const lvl = towerMetaLevel(save, id);
                const maxed = lvl >= META_MAX_LEVEL;
                const cost = towerUpgradeCost(lvl);
                const affordable = save.knowledge >= cost;
                const Icon = TOWER_ICONS[id] ?? Shield;
                const accent = '#' + tw.color.toString(16).padStart(6, '0');
                const dmgPct = Math.round(lvl * TOWER_META_STEP * 100);
                const ratePct = Math.round(lvl * TOWER_META_STEP * 0.5 * 100);
                const rangePct = Math.round(lvl * TOWER_META_STEP * (1 / 3) * 100);
                const nextDmg = Math.round((lvl + 1) * TOWER_META_STEP * 100);
                return (
                  <div key={id}
                    className={`rounded-2xl border p-4 transition-all
                      ${maxed
                      ? 'border-emerald-500/40 bg-gradient-to-l from-emerald-900/30 to-[#0d1420]'
                      : unlocked
                        ? 'border-slate-600/50 bg-gradient-to-l from-slate-800/60 to-[#0d1420]'
                        : 'border-slate-700/50 bg-black/40 opacity-70'}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80">
                        {unlocked
                          ? <Icon className="h-6 w-6" style={{ color: accent }} />
                          : <Lock className="h-5 w-5 text-slate-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-base font-black text-amber-100">{t(tw.nameKey)}</div>
                        {!unlocked && (
                          <div className="flex items-center gap-1 text-xs font-bold text-yellow-300/80">
                            <Star className="h-3 w-3 fill-yellow-300/80" />
                            {t('forgeLockedTower')} — {faNum(starsUntilTower(save, id))} ★
                          </div>
                        )}
                      </div>
                      {maxed && <Check className="h-5 w-5 text-emerald-400" />}
                    </div>

                    <LevelPips level={lvl} max={META_MAX_LEVEL} />

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <ForgeStat icon={Swords} label={t('forgeTowerDamageBonus')} value={`+${faNum(dmgPct)}٪`} color="text-rose-400" />
                      <ForgeStat icon={Zap} label={t('forgeTowerRateBonus')} value={`+${faNum(ratePct)}٪`} color="text-amber-400" />
                      <ForgeStat icon={Target} label={t('forgeTowerRangeBonus')} value={`+${faNum(rangePct)}٪`} color="text-cyan-400" />
                    </div>

                    {unlocked ? (
                      maxed ? (
                        <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-center text-sm font-black text-emerald-300">
                          {t('forgeMax')}
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex-1 rounded-xl border border-violet-400/30 bg-violet-950/30 px-3 py-2 text-center text-xs font-bold text-violet-300">
                            {t('forgeNext')}: +{faNum(nextDmg)}٪ {t('forgeTowerDamageBonus')}
                          </div>
                          <UpgradeButton cost={cost} affordable={affordable} onClick={() => doUpgrade('towers', id)} compact />
                        </div>
                      )
                    ) : (
                      <div className="mt-3 rounded-xl border border-slate-700/60 bg-black/40 py-2 text-center text-xs font-bold text-slate-500">
                        <Lock className="mr-1 inline h-3 w-3" />
                        {t('forgeLockedTower')}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------- زیرسازها ----------------------------

/** نمایش پله‌های سطح — ۲۰ سطح در ۲ ردیف ۱۰تایی */
function LevelPips({ level, max }: { level: number; max: number }) {
  const rows = max > 10 ? 2 : 1;
  const per = Math.ceil(max / rows);
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[10px] font-black text-slate-500">{t('forgeLevel')} {faNum(level)}/{faNum(max)}</span>
      <div className="flex flex-1 flex-col gap-1">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-1">
            {Array.from({ length: per }, (_, i) => {
              const idx = row * per + i;
              if (idx >= max) return null;
              return (
                <div key={i}
                  className={`h-1.5 flex-1 rounded-full
                    ${idx < level ? 'bg-gradient-to-l from-orange-400 to-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'bg-slate-700/60'}`} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function UpgradeButton({ cost, affordable, onClick, compact }: {
  cost: number; affordable: boolean; onClick: () => void; compact?: boolean;
}) {
  return (
    // disabled واقعی — بخش ۱۹ سند Polish: پول ناکافی = دکمهٔ غیرفعال + بازخورد واضح
    <button onClick={onClick} disabled={!affordable}
      className={`flex items-center justify-center gap-1.5 rounded-xl border text-sm font-black
        ${compact ? 'px-3 py-2' : 'mt-3 w-full py-2.5'}
        ${affordable
        ? 'border-violet-400/50 bg-gradient-to-b from-violet-500/80 to-violet-700/80 text-white shadow-[0_0_18px_rgba(139,92,246,0.3)] active:scale-95'
        : 'cursor-not-allowed border-slate-700/60 bg-black/50 text-slate-500 opacity-70'}`}>
      <BookOpen className="h-4 w-4" />
      {t('forgeUpgrade')}
      <span className="mx-0.5 opacity-60">·</span>
      {faNum(cost)}
      <Gem className="h-3 w-3 opacity-70" />
    </button>
  );
}

function ForgeStat({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-black/40 p-2 text-center">
      <Icon className={`mx-auto h-4 w-4 ${color}`} />
      <div className="mt-0.5 truncate text-[9px] font-bold text-slate-500">{label}</div>
      <div className="text-sm font-black text-slate-100">{value}</div>
    </div>
  );
}
