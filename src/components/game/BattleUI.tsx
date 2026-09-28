'use client';

import { useState } from 'react';
import {
  Heart, Coins, Gem, Play, Pause, FastForward, Zap, Flame, Shield, Snowflake,
  Crosshair, X, Star, Home, RotateCcw, Settings, User, Sparkles, ArrowUpCircle,
  Trash2, Target, Clock, FlaskConical, MoveDiagonal, Sun, Moon, Lock,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { TOWERS, TOWER_BUILD_ORDER, isTowerUnlocked, starsUntilTower } from '@/game/data/towers';
import { MAGIC } from '@/game/data/magic';
import { HEROES } from '@/game/data/magic';
import { t, faNum } from '@/game/data/i18n';
import type { TargetingMode } from '@/game/data/types';

// ============================================================
// HUD نبرد — تمام رابط داخل بازی
// ============================================================

const TOWER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  sentinel: Crosshair, lightning: Zap, fire: Flame, ice: Snowflake,
  cannon: Target, poison: FlaskConical, ballista: MoveDiagonal,
  arcane: Sparkles, temple: Sun, void: Moon,
};

const MAGIC_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  skyLightning: Zap, fireRain: Flame, arianaShield: Shield,
  deepFreeze: Snowflake, azarBlessing: Sun, coreMend: Heart,
};

const TARGET_LABEL: Record<TargetingMode, string> = {
  first: 'targetFirst', strongest: 'targetStrongest', weakest: 'targetWeakest',
  fastest: 'targetFastest', boss: 'targetBoss',
};

interface BattleActions {
  get: () => BattleGameApi | null;
  endBattle: () => void;
  startBattle: () => void;
}

export interface BattleGameApi {
  setPaused(p: boolean): void;
  setSpeed(s: number): void;
  setBuildMode(id: string | null): void;
  setMagicPending(id: string | null): void;
  upgradeTower(id: number): boolean;
  sellTower(id: number): boolean;
  useTowerAbility(id: number): boolean;
  cycleTargeting(id: number): void;
  useHeroAbility(): boolean;
  deployHero(p: { x: number; y: number; z: number }): void;
  selectHeroMode(on: boolean): void;
  startWave(): void;
}

export function BattleUI({ actions }: { actions: BattleActions }) {
  const st = useGameStore();
  const [pauseMenu, setPauseMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const game = actions.get();

  const corePct = Math.round((st.coreHp / st.coreMaxHp) * 100);
  const heroData = HEROES[st.selectedHero] ?? HEROES.arman;

  const togglePause = (p: boolean) => {
    game?.setPaused(p);
    setPauseMenu(p);
  };

  const backToMap = () => {
    actions.endBattle();
    useGameStore.getState().setScreen('map');
  };

  const restart = () => {
    actions.endBattle();
    setTimeout(() => actions.startBattle(), 60);
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* وینیت سینمایی — عمق بیشتر تصویر */}
      <div className="battle-vignette absolute inset-0" />

      {/* ================= نوار بالا ================= */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pointer-events-auto">
        {/* سلامت هسته */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-black/60 px-2.5 py-1.5 backdrop-blur-sm">
            <Heart className={`h-4 w-4 ${corePct < 30 ? 'animate-pulse text-rose-500' : 'text-rose-400'}`} />
            <span className="text-sm font-black text-rose-200">{faNum(corePct)}٪</span>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/60">
            <div className={`h-full rounded-full transition-all ${corePct < 30 ? 'bg-rose-500' : 'bg-gradient-to-r from-rose-400 to-amber-400'}`}
              style={{ width: `${corePct}%` }} />
          </div>
        </div>

        {/* موج */}
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-lg border border-amber-400/30 bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-sm font-black text-amber-200">
              {t('waveOf', faNum(st.wave), faNum(st.waveTotal))}
            </span>
          </div>
          {st.shieldActive && (
            <div className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200 animate-pulse">
              <Shield className="h-3.5 w-3.5" />
              {t('shieldActive')}
            </div>
          )}
        </div>

        {/* منابع + کنترل */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-black/60 px-2.5 py-1.5 backdrop-blur-sm">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-black text-amber-200">{faNum(st.coins)}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-black/60 px-2.5 py-1.5 backdrop-blur-sm">
              <Gem className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-black text-cyan-200">{faNum(st.crystals)}</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => game?.setSpeed(st.speed === 1 ? 2 : 1)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm active:scale-95
                ${st.speed === 2 ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-300' : 'border-slate-600/50 bg-black/60 text-slate-300'}`}>
              <FastForward className="h-4 w-4" />
            </button>
            <button onClick={() => togglePause(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/50 bg-black/60 text-slate-300 backdrop-blur-sm active:scale-95">
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= بنر موج / Boss ================= */}
      {/* ================= بنر فاز ۲ Boss ================= */}
      {st.bossPhase && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center banner-anim pointer-events-none">
          <div
            className="rounded-2xl border bg-black/85 px-8 py-4 shadow-[0_0_50px_rgba(168,85,247,0.5)]"
            style={{ borderColor: '#' + st.bossPhase.color.toString(16).padStart(6, '0') }}
          >
            <div className="text-xs font-black tracking-[0.35em] text-rose-400">{t('bossPhaseTitle')}</div>
            <div
              className="mt-1 text-2xl font-black animate-pulse"
              style={{ color: '#' + st.bossPhase.color.toString(16).padStart(6, '0') }}
            >
              {t(st.bossPhase.nameKey)}
            </div>
          </div>
        </div>
      )}

      {/* ================= بنر موج ================= */}
      {st.banner && (
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 text-center banner-anim pointer-events-none">
          {st.banner.boss ? (
            <div className="rounded-2xl border border-rose-500/50 bg-black/80 px-8 py-4 shadow-[0_0_40px_rgba(239,68,68,0.4)]">
              <div className="text-xl font-black text-rose-400 animate-pulse">{t('bossIncoming')}</div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-400/40 bg-black/75 px-8 py-3">
              <div className="text-3xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">
                {t('wave')} {faNum(st.banner.wave)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* پیام پاک‌سازی موج */}
      {st.waveClearedToast && (
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 rounded-xl border border-emerald-400/40 bg-black/75 px-6 py-2.5 text-center banner-anim pointer-events-none">
          <div className="text-lg font-black text-emerald-300">
            {t('waveCleared', faNum(st.waveClearedToast.bonus))}
          </div>
        </div>
      )}

      {/* ================= راهنمای آموزش ================= */}
      {st.tutorialStep && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 max-w-[85%] rounded-xl border border-cyan-400/40 bg-black/80 px-5 py-2.5 text-center tutorial-anim pointer-events-none">
          <div className="text-sm font-bold text-cyan-200">
            {t(st.tutorialStep === 'build' ? 'tutorialBuild' :
              st.tutorialStep === 'wave' ? 'tutorialWave' :
              st.tutorialStep === 'upgrade' ? 'tutorialUpgrade' :
              st.tutorialStep === 'magic' ? 'tutorialMagic' : 'tutorialDone')}
          </div>
        </div>
      )}

      {/* ================= راهنمای انتخاب محل جادو ================= */}
      {st.magicPending && (
        <div className="absolute left-1/2 top-40 -translate-x-1/2 rounded-xl border border-violet-400/50 bg-violet-950/80 px-5 py-2 text-sm font-black text-violet-200 tutorial-anim pointer-events-none">
          {t('selectTarget')}
        </div>
      )}

      {/* ================= دکمه شروع موج ================= */}
      {!st.waveActive && !st.victory && !st.defeat && st.wave <= st.waveTotal && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button onClick={() => game?.startWave()}
            className="flex flex-col items-center gap-0.5 rounded-2xl border border-emerald-400/50
            bg-gradient-to-b from-emerald-500/90 to-emerald-700/90 px-8 py-3 shadow-[0_0_25px_rgba(16,185,129,0.35)] active:scale-95">
            <span className="text-lg font-black text-white">{t('startWave')}</span>
            {st.autoIn > 0 && !st.buildMode && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-100/90">
                <Clock className="h-3 w-3" />
                {faNum(Math.ceil(st.autoIn))} — {t('nextWaveBonus', faNum(15 + Math.ceil(st.autoIn) * 4))}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ================= جادو (سمت چپ — شبکه ۲ ستونه) ================= */}
      <div className="absolute bottom-4 left-3 grid w-[7.5rem] grid-cols-2 gap-2 pointer-events-auto">
        {st.magicState.map((m) => {
          const M = MAGIC[m.id];
          const Icon = MAGIC_ICONS[m.id] ?? Sparkles;
          const cdPct = m.cd > 0 ? (m.cd / m.cdMax) * 100 : 0;
          return (
            <button key={m.id}
              onClick={() => game?.setMagicPending(M.targeted ? m.id : m.id)}
              disabled={!m.affordable || !!st.magicPending}
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border backdrop-blur-sm transition-all active:scale-90
                ${st.magicPending === m.id ? 'border-white bg-white/20 scale-110' :
                  m.affordable ? 'border-amber-400/50 bg-black/70 shadow-[0_0_15px_rgba(245,158,11,0.25)]' :
                  'border-slate-700/60 bg-black/70 opacity-60'}`}>
              <Icon className="h-6 w-6" style={{ color: M.color }} />
              {/* هزینه کریستال */}
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-1.5 text-[9px] font-black text-cyan-300">
                {faNum(m.cost)}
              </span>
              {/*Cooldown */}
              {cdPct > 0 && (
                <>
                  <div className="absolute inset-0 rounded-2xl bg-black/70" style={{ clipPath: `inset(${100 - cdPct}% 0 0 0)` }} />
                  <span className="absolute text-xs font-black text-white">{faNum(Math.ceil(m.cd))}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= قهرمان (بالای شبکه جادو) ================= */}
      <div className="absolute bottom-[13.5rem] left-3 pointer-events-auto">
        <button onClick={() => {
          if (!st.hero?.deployed) {
            useGameStore.getState().pushToast('deployHint', 'info');
            game?.selectHeroMode(true);
          } else {
            game?.useHeroAbility();
          }
        }}
          disabled={!!st.hero?.deployed && (st.hero.dead || st.hero.abilityCd > 0)}
          className={`relative flex h-14 w-14 flex-col items-center justify-center rounded-2xl border backdrop-blur-sm active:scale-90
            ${!st.hero?.deployed ? 'border-amber-400/50 bg-amber-600/30' :
            st.hero.dead ? 'border-red-500/70 bg-red-950/70' :
            st.hero.abilityCd <= 0 ? 'border-amber-300/70 bg-amber-500/25 shadow-[0_0_18px_rgba(245,158,11,0.35)]' : 'border-slate-700/60 bg-black/70 opacity-70'}`}>
          <User className={`h-6 w-6 ${st.hero?.dead ? 'text-red-400' : 'text-amber-300'}`} />
          <span className="text-[9px] font-black text-amber-200">
            {!st.hero?.deployed ? t('deployHero').split(' ')[0] : `${t('heroLevel', faNum(st.hero.level))}`}
          </span>
          {/* مرگ — شمارش معکوس ریسپاون */}
          {st.hero?.deployed && st.hero.dead && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/75">
              <span className="text-sm font-black text-red-400">{faNum(st.hero.respawnIn)}</span>
              <span className="text-[7px] font-bold text-slate-300">{t('heroRespawnShort')}</span>
            </div>
          )}
          {/* سرد توانایی */}
          {st.hero?.deployed && !st.hero.dead && st.hero.abilityCd > 0 && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-xs font-black text-white">
              {faNum(Math.ceil(st.hero.abilityCd))}
            </div>
          )}
          {/* نوار جان هیرو */}
          {st.hero?.deployed && !st.hero.dead && (
            <div className="absolute -bottom-1.5 left-1/2 h-1.5 w-[4.5rem] -translate-x-1/2 overflow-hidden rounded-full border border-black/60 bg-black/80">
              <div
                className={`h-full transition-all duration-300 ${st.hero.hp / st.hero.maxHp > 0.35 ? 'bg-gradient-to-l from-emerald-400 to-lime-300' : 'bg-gradient-to-l from-red-500 to-orange-400'}`}
                style={{ width: `${Math.max(0, Math.min(100, (st.hero.hp / st.hero.maxHp) * 100))}%` }}
              />
            </div>
          )}
        </button>
      </div>

      {/* ================= نوار برج‌ها (پایین — اسکرول افقی) ================= */}
      <div className="absolute inset-x-0 bottom-0 border-t border-amber-400/20 bg-gradient-to-t from-black/90 to-black/50 p-2.5 pointer-events-auto">
        <div className="flex items-end gap-2 overflow-x-auto pb-1 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TOWER_BUILD_ORDER.map((id) => {
            const tw = TOWERS[id];
            const Icon = TOWER_ICONS[id];
            const afford = st.coins >= tw.cost;
            const active = st.buildMode === id;
            // باز شدن تدریجی — قفل با مجموع ستاره‌های کمپین
            const unlocked = isTowerUnlocked(st.save, id);
            const starsNeeded = starsUntilTower(st.save, id);
            const handleTap = () => {
              if (!unlocked) {
                useGameStore.getState().pushToast('towerLocked', 'error');
                return;
              }
              game?.setBuildMode(active ? null : id);
            };
            return (
              <button key={id}
                onClick={handleTap}
                className={`relative flex w-[4.1rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 backdrop-blur-sm transition-all active:scale-95
                  ${!unlocked ? 'border-slate-800/80 bg-black/70 opacity-45 grayscale' :
                  active ? 'border-white bg-white/15 scale-105' :
                  afford ? 'border-slate-600/60 bg-black/60' : 'border-slate-800/60 bg-black/60 opacity-50'}`}>
                {unlocked ? (
                  <Icon className="h-6 w-6" style={{ color: '#' + tw.color.toString(16).padStart(6, '0') }} />
                ) : (
                  <Lock className="h-5 w-5 text-slate-400" />
                )}
                <span className="whitespace-nowrap text-[11px] font-black text-slate-200">{t(tw.nameKey)}</span>
                {!unlocked ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-yellow-300">
                    <Star className="h-3 w-3 fill-yellow-300" />
                    {faNum(tw.unlockStars ?? 0)}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-400">
                    <Coins className="h-3 w-3" />
                    {faNum(tw.cost)}
                  </span>
                )}
                {!unlocked && starsNeeded > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-4 items-center justify-center rounded-full
                    bg-slate-700 px-1 text-[9px] font-black text-yellow-300">
                    {faNum(starsNeeded)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= پنل برج انتخاب‌شده ================= */}
      {st.selectedTower && <TowerPanel actions={actions} />}

      {/* ================= منوی توقف ================= */}
      {pauseMenu && !st.victory && !st.defeat && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
          <div className="w-72 rounded-3xl border border-amber-400/30 bg-[#0d1420] p-6 text-center">
            <h3 className="text-2xl font-black text-amber-200">{t('pause')}</h3>
            <div className="mt-5 flex flex-col gap-2.5">
              <MenuActionBtn icon={Play} label={t('resume')} onClick={() => togglePause(false)} primary />
              <MenuActionBtn icon={RotateCcw} label={t('restart')} onClick={restart} />
              <MenuActionBtn icon={Settings} label={t('settings')} onClick={() => setShowSettings(true)} />
              <MenuActionBtn icon={Home} label={t('quitToMap')} onClick={backToMap} />
            </div>
          </div>
        </div>
      )}

      {/* ================= تنظیمات داخل نبرد ================= */}
      {showSettings && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 pointer-events-auto">
          <CompactSettings onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* ================= پیروزی ================= */}
      {st.victory && (
        <EndOverlay
          title={t('victory')}
          titleClass="from-amber-200 to-amber-500"
          subtitle={t('victorySub')}
          stars={st.victory.stars}
          rewards={[
            { icon: Coins, value: faNum(st.victory.rewards.coins), label: t('coins'), color: 'text-amber-400' },
            { icon: Gem, value: faNum(st.victory.rewards.crystals), label: t('crystal'), color: 'text-cyan-400' },
            { icon: Sparkles, value: faNum(st.victory.rewards.knowledge), label: t('knowledge'), color: 'text-violet-400' },
          ]}
          actions={actions}
        />
      )}

      {/* ================= شکست ================= */}
      {st.defeat && (
        <EndOverlay
          title={t('defeat')}
          titleClass="from-rose-300 to-rose-600"
          subtitle={t('defeatSub')}
          stars={0}
          actions={actions}
        />
      )}

      {/* ================= Toasts ================= */}
      <div className="absolute left-1/2 top-16 flex -translate-x-1/2 flex-col gap-1.5 pointer-events-none">
        {st.toasts.map((toast) => (
          <div key={toast.id}
            className={`rounded-lg border px-4 py-1.5 text-sm font-black backdrop-blur-sm toast-anim
            ${toast.type === 'error' ? 'border-rose-500/50 bg-rose-950/80 text-rose-200' : 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'}`}>
            {t(toast.key)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------- پنل برج ----------------------------

function TowerPanel({ actions }: { actions: BattleActions }) {
  const st = useGameStore();
  const tw = TOWERS[st.selectedTower!.towerId];
  const game = actions.get();
  const info = st.selectedTower!;
  const Icon = TOWER_ICONS[info.towerId] ?? Crosshair;
  const maxed = info.upgradeCost < 0;

  return (
    <div className="absolute inset-x-3 bottom-20 z-20 rounded-2xl border border-slate-600/50 bg-black/85 p-3 backdrop-blur-md pointer-events-auto panel-anim">
      <div className="flex items-center gap-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{ borderColor: '#' + tw.color.toString(16).padStart(6, '0'), background: 'rgba(0,0,0,0.5)' }}>
          <Icon className="h-6 w-6" style={{ color: '#' + tw.color.toString(16).padStart(6, '0') }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-slate-100">{t(tw.nameKey)}</span>
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
              {t('level')} {faNum(info.level)}
            </span>
          </div>
          <div className="mt-0.5 flex gap-3 text-[11px] font-bold text-slate-400">
            <span>{t('damage')}: <b className="text-slate-200">{faNum(info.damage)}</b></span>
            <span>{t('range')}: <b className="text-slate-200">{faNum(info.range)}</b></span>
            <span>{t('fireRate')}: <b className="text-slate-200">{faNum(info.fireRate)}</b></span>
          </div>
        </div>
        <button onClick={() => useGameStore.getState().handleEvent('selectTower', null)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-slate-400 active:scale-95">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5 flex gap-2">
        <button onClick={() => game?.upgradeTower(info.id)} disabled={maxed || st.coins < info.upgradeCost}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-black active:scale-95
            ${maxed ? 'border border-slate-700 bg-black/40 text-slate-500' :
            st.coins >= info.upgradeCost ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white' : 'bg-slate-800 text-slate-500'}`}>
          <ArrowUpCircle className="h-4 w-4" />
          {maxed ? t('maxLevel') : `${t('upgrade')} — ${faNum(info.upgradeCost)}`}
        </button>
        <button onClick={() => game?.useTowerAbility(info.id)} disabled={info.abilityCd > 0}
          className={`relative flex w-24 items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-black active:scale-95
            ${info.abilityCd <= 0 ? 'border border-violet-400/50 bg-violet-600/30 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
          <Sparkles className="h-4 w-4" />
          {t(info.abilityNameKey)}
          {info.abilityCd > 0 && (
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 text-sm font-black text-white">
              {faNum(Math.ceil(info.abilityCd))}
            </span>
          )}
        </button>
        <button onClick={() => game?.sellTower(info.id)}
          className="flex items-center justify-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2.5 text-xs font-black text-rose-300 active:scale-95">
          <Trash2 className="h-4 w-4" />
          {faNum(info.sellValue)}
        </button>
      </div>

      <button onClick={() => {
        const g = actions.get();
        // چرخش هدف‌گیری — از طریق انتخاب مجدد
        if (g) {
          const gi = g as unknown as { cycleTargeting?: (id: number) => void };
          gi.cycleTargeting?.(info.id);
        }
      }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700/60 bg-black/40 py-1.5 text-[11px] font-bold text-slate-400 active:scale-[0.98]">
        <Target className="h-3.5 w-3.5" />
        {t('targeting')}: {t(TARGET_LABEL[info.targeting as TargetingMode])}
      </button>
    </div>
  );
}

// ---------------------------- پایان بازی ----------------------------

function EndOverlay({ title, titleClass, subtitle, stars, rewards, actions }: {
  title: string;
  titleClass: string;
  subtitle: string;
  stars: number;
  rewards?: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; value: string; label: string; color: string }[];
  actions: BattleActions;
}) {
  const backToMap = () => {
    actions.endBattle();
    useGameStore.getState().setScreen('map');
  };
  const restart = () => {
    actions.endBattle();
    setTimeout(() => actions.startBattle(), 60);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-sm rounded-3xl border border-amber-400/30 bg-[#0d1420] p-6 text-center end-anim">
        <h2 className={`bg-gradient-to-b bg-clip-text text-4xl font-black text-transparent ${titleClass}`}>
          {title}
        </h2>
        <p className="mt-2 text-sm font-bold text-slate-400">{subtitle}</p>

        {stars > 0 && (
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <Star key={i}
                className={`h-12 w-12 star-pop ${i < stars ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]' : 'text-slate-700'}`}
                style={{ animationDelay: `${i * 0.35}s` }} />
            ))}
          </div>
        )}

        {rewards && (
          <div className="mt-5">
            <div className="text-xs font-black text-slate-500">{t('rewards')}</div>
            <div className="mt-2 flex justify-center gap-4">
              {rewards.map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-700/60 bg-black/40 px-4 py-2">
                  <r.icon className={`h-5 w-5 ${r.color}`} />
                  <span className={`text-lg font-black ${r.color}`}>{r.value}</span>
                  <span className="text-[10px] font-bold text-slate-500">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button onClick={restart}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 px-6 py-3.5 text-lg font-black text-white active:scale-95">
            <RotateCcw className="h-5 w-5" />
            {t('retry')}
          </button>
          <button onClick={backToMap}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-600/60 bg-black/50 px-6 py-3 text-base font-bold text-slate-300 active:scale-95">
            <Home className="h-5 w-5" />
            {t('quitToMap')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------- تنظیمات فشرده ----------------------------

function CompactSettings({ onClose }: { onClose: () => void }) {
  const save = useGameStore((s) => s.save);
  const setQuality = useGameStore((s) => s.setQuality);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const updateSave = useGameStore((s) => s.updateSave);
  if (!save) return null;

  return (
    <div className="w-full max-w-sm rounded-3xl border border-amber-400/30 bg-[#0d1420] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-amber-200">{t('settings')}</h3>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 text-slate-400 active:scale-95">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-1.5 text-sm font-bold text-slate-400">{t('qualitySetting')}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
              <button key={q} onClick={() => setQuality(q)}
                className={`rounded-lg py-2 text-xs font-black active:scale-95 ${save.settings.quality === q ? 'bg-amber-500 text-black' : 'bg-black/50 text-slate-400'}`}>
                {t('quality' + q.charAt(0).toUpperCase() + q.slice(1))}
              </button>
            ))}
          </div>
        </div>

        <VolumeSlider label={t('musicSetting')} value={save.settings.music}
          onChange={(v) => updateSave((s) => { s.settings.music = v; })} />
        <VolumeSlider label={t('sfxSetting')} value={save.settings.sfx}
          onChange={(v) => updateSave((s) => { s.settings.sfx = v; })} />

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-400">{t('languageSetting')}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setLanguage('fa')}
              className={`rounded-lg px-4 py-1.5 text-sm font-black ${save.settings.language === 'fa' ? 'bg-amber-500 text-black' : 'bg-black/50 text-slate-400'}`}>
              فارسی
            </button>
            <button onClick={() => setLanguage('en')}
              className={`rounded-lg px-4 py-1.5 text-sm font-black ${save.settings.language === 'en' ? 'bg-amber-500 text-black' : 'bg-black/50 text-slate-400'}`}>
              English
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm font-bold text-slate-400">
        <span>{label}</span>
        <span className="text-slate-300">{faNum(Math.round(value * 100))}٪</span>
      </div>
      <input type="range" min={0} max={100} value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-amber-500" />
    </div>
  );
}

function MenuActionBtn({ icon: Icon, label, onClick, primary }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-black active:scale-95
        ${primary ? 'bg-gradient-to-b from-amber-500 to-orange-600 text-white' : 'border border-slate-600/60 bg-black/50 text-slate-300'}`}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}
