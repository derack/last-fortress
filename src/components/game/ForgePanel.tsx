'use client';

import { useState } from 'react';
import { ArrowRight, Swords, Heart, Flame, Crosshair, Coins, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useStandaloneBack } from './standalone';
import { FORGE_TRACKS, FORGE_MAX, forgeLevel, forgeNextCost, forgeTotalLevels, type ForgeTrack, type ForgeTrackId } from '@/game/data/forge';
import { t, faNum } from '@/game/data/i18n';
import { UpgradesPanel } from './UpgradesPanel';

// ============================================================
// کوره اثیر — ارتقاهای دائمی ۲۰ سطحی
// ارز: ذرات اثیر (از پیروزی کمپین) — ۶ مسیر × ۲۰ سطح
//   قهرمان (آسیب/تندرستی) + برج‌ها (آسیب/برد) + دژ (اقتصاد/هسته)
// ============================================================

const TRACK_ICONS: Record<ForgeTrackId, React.ComponentType<{ className?: string }>> = {
  heroAttack: Swords,
  heroVitality: Heart,
  towerDamage: Flame,
  towerRange: Crosshair,
  economy: Coins,
  coreFort: ShieldCheck,
};

function pct(n: number): string {
  // نمایش درصد فارسی — بدون اعشار اضافه
  const v = Math.round(n * 1000) / 10;
  return faNum(Number.isInteger(v) ? v : v.toFixed(1));
}

export function ForgePanel() {
  const goBack = useStandaloneBack();
  const save = useGameStore((s) => s.save);
  const buyForgeLevel = useGameStore((s) => s.buyForgeLevel);
  const pushToast = useGameStore((s) => s.pushToast);
  // v2.3 — دو تب: کوره اثیر (دانش) + آهنگری کارت (کارت برج + سکه) —
  // قبلاً آهنگری کارت هیچ‌جا رندر نمی‌شد و کارت‌ها بی‌استفاده می‌ماندند
  const [tab, setTab] = useState<'aether' | 'cards'>('aether');
  if (!save) return null;

  const shards = save.knowledge;
  const total = forgeTotalLevels(save);
  const totalMax = FORGE_TRACKS.length * FORGE_MAX;

  const handleBuy = (trackId: ForgeTrackId) => {
    if (!buyForgeLevel(trackId)) {
      pushToast('forgeNotEnough', 'error');
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#14101f]">
      <div className="panel-header flex items-center gap-3 border-b border-violet-400/20 bg-black/40 px-4 py-3">
        <button onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-violet-200">{t('forge')}</h2>
        {/* موجودی ذرات اثیر */}
        <div className="ms-auto flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1.5">
          <ShardIcon />
          <span className="text-sm font-black text-violet-200">{faNum(shards)}</span>
        </div>
      </div>

      <div className="px-4 pt-3 text-center">
        <div className="text-xs font-bold text-slate-400">{t('forgeSubtitle')}</div>
        <div className="mt-0.5 text-[10px] leading-4 text-violet-300/70">{t('forgePermanent')}</div>
      </div>

      {/* v2.3 — تب کوره اثیر / آهنگری کارت */}
      <div className="mx-4 mt-3 flex gap-2">
        {([
          { id: 'aether' as const, label: t('forgeAetherTab'), Icon: Sparkles },
          { id: 'cards' as const, label: t('forgeCardsTab'), Icon: Layers },
        ]).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black transition-all active:scale-95
              ${tab === id
              ? 'border-violet-400/60 bg-violet-500/20 text-violet-200 shadow-[0_0_14px_rgba(139,92,246,0.25)]'
              : 'border-slate-700/50 bg-black/40 text-slate-400'}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'cards' && (
        <div className="relative flex-1 overflow-hidden">
          <UpgradesPanel embedded />
        </div>
      )}

      {tab === 'aether' && (
      <>
      {/* پیشرفت کل */}
      <div className="mx-4 mt-3 rounded-2xl border border-violet-400/20 bg-black/40 p-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>{t('forgeTotalProgress')}</span>
          <span className="text-violet-300">{faNum(total)} / {faNum(totalMax)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-fuchsia-400 transition-all"
            style={{ width: `${Math.round((total / totalMax) * 100)}%` }} />
        </div>
        <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-slate-500">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/70" />
          {t('forgeHint')}
        </div>
      </div>

      {/* مسیرهای ارتقا */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-3">
          {FORGE_TRACKS.map((track) => (
            <TrackCard key={track.id} track={track} level={forgeLevel(save, track.id)}
              affordable={shards >= forgeNextCost(track.id, forgeLevel(save, track.id))}
              onBuy={() => handleBuy(track.id)} />
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function TrackCard({ track, level, affordable, onBuy }: {
  track: ForgeTrack;
  level: number;
  affordable: boolean;
  onBuy: () => void;
}) {
  const Icon = TRACK_ICONS[track.id];
  const maxed = level >= track.maxLevel;
  const cur = level * track.effectPerLevel;
  const next = (level + 1) * track.effectPerLevel;
  const cost = forgeNextCost(track.id, level);

  return (
    <div className="rounded-2xl border border-slate-600/50 bg-gradient-to-l from-slate-800/60 to-[#0d1420] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${track.color}22`, color: track.color }}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-black" style={{ color: track.color }}>{t(track.nameKey)}</span>
            <span className="shrink-0 text-[10px] font-bold text-slate-500">
              {t('forgeLevelOf', faNum(level), faNum(track.maxLevel))}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{t(track.descKey)}</p>
        </div>
      </div>

      {/* نوار ۲۰ سطحی */}
      <div className="mt-3 flex gap-1" dir="ltr">
        {Array.from({ length: track.maxLevel }, (_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i < level ? track.color : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[11px] font-bold text-slate-300">
          {maxed ? (
            <span className="text-amber-300">{t('forgeMaxed')} · {t(track.effectKey, pct(cur), pct(cur))}</span>
          ) : (
            t(track.effectKey, pct(cur), pct(next))
          )}
        </div>
        {!maxed && (
          <button onClick={onBuy}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black active:scale-95
              ${affordable
                ? 'bg-gradient-to-b from-violet-500 to-purple-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.35)]'
                : 'border border-slate-600/60 bg-black/40 text-slate-500'}`}>
            <ShardIcon />
            {faNum(cost)}
            <span className="opacity-80">· {t('forgeBuy')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ShardIcon() {
  return <span className="inline-block h-3 w-3 rotate-45 rounded-[2px] bg-gradient-to-br from-violet-300 to-purple-600 shadow-[0_0_6px_rgba(167,139,250,0.8)]" />;
}
