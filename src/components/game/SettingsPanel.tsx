'use client';

import { ArrowRight, Trash2, Vibrate } from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { t, faNum } from '@/game/data/i18n';
import type { Quality } from '@/game/data/types';

// ============================================================
// تنظیمات — زبان، کیفیت، صدا، لرزش، بازنشانی
// ============================================================

export function SettingsPanel() {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const setQuality = useGameStore((s) => s.setQuality);
  const updateSave = useGameStore((s) => s.updateSave);
  const resetAll = useGameStore((s) => s.resetAll);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!save) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-[#0b0f1c] to-[#101828]">
      <div className="flex items-center gap-3 border-b border-amber-400/20 bg-black/40 px-4 py-3">
        <button onClick={() => setScreen('menu')}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/50 bg-black/40 text-slate-300 active:scale-95">
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-amber-200">{t('settings')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md space-y-5">
          {/* زبان */}
          <Section title={t('languageSetting')}>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setLanguage('fa')}
                className={`rounded-xl py-3 text-base font-black active:scale-95 ${save.settings.language === 'fa' ? 'bg-amber-500 text-black' : 'bg-black/50 text-slate-300'}`}>
                فارسی
              </button>
              <button onClick={() => setLanguage('en')}
                className={`rounded-xl py-3 text-base font-black active:scale-95 ${save.settings.language === 'en' ? 'bg-amber-500 text-black' : 'bg-black/50 text-slate-300'}`}>
                English
              </button>
            </div>
          </Section>

          {/* کیفیت */}
          <Section title={t('qualitySetting')}>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`rounded-xl py-2.5 text-xs font-black active:scale-95 ${save.settings.quality === q ? 'bg-amber-500 text-black' : 'bg-black/50 text-slate-300'}`}>
                  {t('quality' + q.charAt(0).toUpperCase() + q.slice(1))}
                </button>
              ))}
            </div>
          </Section>

          {/* صدا */}
          <Section title={t('musicSetting')}>
            <Slider value={save.settings.music} onChange={(v) => updateSave((s) => { s.settings.music = v; })} />
          </Section>
          <Section title={t('sfxSetting')}>
            <Slider value={save.settings.sfx} onChange={(v) => updateSave((s) => { s.settings.sfx = v; })} />
          </Section>

          {/* لرزش */}
          <Section title={t('hapticsSetting')}>
            <button onClick={() => updateSave((s) => { s.settings.haptics = !s.settings.haptics; })}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 active:scale-[0.98] ${save.settings.haptics ? 'bg-emerald-500/20 border border-emerald-400/40' : 'bg-black/50 border border-slate-700/60'}`}>
              <span className="flex items-center gap-2 font-bold text-slate-200">
                <Vibrate className="h-5 w-5 text-slate-400" />
                {save.settings.haptics ? t('on') : t('off')}
              </span>
              <div className={`h-6 w-11 rounded-full p-0.5 transition-all ${save.settings.haptics ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${save.settings.haptics ? 'translate-x-5' : ''}`} />
              </div>
            </button>
          </Section>

          {/* بازنشانی */}
          <button onClick={() => (confirmReset ? resetAll() : setConfirmReset(true))}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 font-black active:scale-95 ${confirmReset ? 'border-rose-500 bg-rose-600 text-white' : 'border-rose-500/40 bg-rose-950/30 text-rose-400'}`}>
            <Trash2 className="h-5 w-5" />
            {confirmReset ? t('resetConfirm') : t('resetSave')}
          </button>
          {confirmReset && (
            <button onClick={() => setConfirmReset(false)} className="w-full text-center text-xs font-bold text-slate-500">
              {t('no')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl bg-black/50 px-4 py-3">
      <div className="mb-2 flex justify-between text-sm font-bold">
        <span className="text-slate-300">{faNum(Math.round(value * 100))}٪</span>
      </div>
      <input type="range" min={0} max={100} value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-amber-500" />
    </div>
  );
}
