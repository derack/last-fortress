'use client';

import { Component, useEffect, type ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';
import { t } from '@/game/data/i18n';
import { CampaignMap } from './CampaignMap';
import { HeroesPanel } from './HeroesPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { SettingsPanel } from './SettingsPanel';
import { CharacterGallery } from './CharacterGallery';

// ============================================================
// صفحه مستقل — هر پنل به‌صورت روت مجزا برای نمایش در iframe
// ------------------------------------------------------------
// این صفحات در iframe منوی اصلی سوار می‌شوند و با postMessage
// با پنجره والد صحبت می‌کنند:
//   { type: 'startBattle', levelId } — شروع نبرد از نقشه
//   { type: 'saveChanged' }          — ذخیره عوض شد (قهرمان/تنظیمات)
//   { type: 'closePage' }            — بستن صفحه از داخل iframe
// ذخیره‌سازی مشترک از طریق localStorage همگام می‌ماند.
// ============================================================

export type StandalonePageId = 'map' | 'heroes' | 'achievements' | 'settings' | 'gallery';

export function isStandalonePage(v: string): v is StandalonePageId {
  return ['map', 'heroes', 'achievements', 'settings', 'gallery'].includes(v);
}

// ------------------------------------------------------------
// ErrorBoundary — اگر پنلی خطا بدهد، صفحه هرگز سفید/خالی نمی‌ماند
// ------------------------------------------------------------
class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0f1c] p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <p className="text-lg font-black text-amber-200">{t('pageError')}</p>
          <p className="max-w-xs text-xs leading-5 text-slate-400">{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); useGameStore.getState().initSave(); }}
            className="rounded-xl border border-amber-400/40 bg-amber-500/20 px-6 py-2 text-sm font-black text-amber-200 active:scale-95">
            {t('pageRetry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ------------------------------------------------------------
// لودینگ برنددار — به‌جای صفحه خالی
// ------------------------------------------------------------
function PageLoading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b0f1c]">
      <div className="core-crystal h-14 w-14 rotate-45 animate-pulse rounded-lg bg-gradient-to-br
        from-amber-200 via-amber-400 to-orange-600 shadow-[0_0_50px_14px_rgba(245,158,11,0.4)]" />
      <p className="text-sm font-bold text-slate-400">{t('pageLoading')}</p>
    </div>
  );
}

export function StandaloneScreen({ id }: { id: StandalonePageId }) {
  const initSave = useGameStore((s) => s.initSave);
  const save = useGameStore((s) => s.save);

  // راه‌اندازی ذخیره مشترک — همان localStorage برنامه اصلی
  useEffect(() => {
    useGameStore.getState().initSave();
  }, [initSave]);

  // نشانگر حالت iframe — پنل‌ها هدر داخلی خودشان را مخفی می‌کنند
  // (تیتر و دکمه بستن روی قاب والد هست؛ تکرار نمی‌شود)
  useEffect(() => {
    document.documentElement.dataset.standalone = '1';
    return () => {
      delete document.documentElement.dataset.standalone;
    };
  }, []);

  // پل ذخیره — هر تغییر به والد اطلاع داده می‌شود
  useEffect(() => {
    const onSaved = () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'saveChanged' }, '*');
      }
    };
    window.addEventListener('savePersisted', onSaved);
    return () => window.removeEventListener('savePersisted', onSaved);
  }, []);

  const startBattle = () => {
    // نقشه داخل iframe — شروع نبرد به پنجره اصلی پیام داده می‌شود
    const levelId = useGameStore.getState().pendingLevelId;
    window.parent.postMessage({ type: 'startBattle', levelId }, '*');
  };

  const closePage = () => {
    window.parent.postMessage({ type: 'closePage' }, '*');
  };

  // تا ذخیره لود نشود — لودینگ برنددار (هرگز خالی نمی‌ماند)
  if (!save) {
    return <PageLoading />;
  }

  return (
    <PanelErrorBoundary>
      <div className="fixed inset-0 bg-[#0b0f1c]">
        {id === 'map' && <CampaignMap onStart={startBattle} />}
        {id === 'heroes' && <HeroesPanel />}
        {id === 'achievements' && <AchievementsPanel />}
        {id === 'settings' && <SettingsPanel />}
        {id === 'gallery' && <CharacterGallery onClose={closePage} />}
      </div>
    </PanelErrorBoundary>
  );
}
