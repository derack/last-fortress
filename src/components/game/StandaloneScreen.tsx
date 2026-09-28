'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
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

export function StandaloneScreen({ id }: { id: StandalonePageId }) {
  const initSave = useGameStore((s) => s.initSave);
  const save = useGameStore((s) => s.save);

  // راه‌اندازی ذخیره مشترک — همان localStorage برنامه اصلی
  useEffect(() => {
    useGameStore.getState().initSave();
  }, [initSave]);

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

  // تا ذخیره لود نشده، قاب خالی (بدون پرش)
  if (!save) {
    return <div className="fixed inset-0 bg-[#0b0f1c]" />;
  }

  switch (id) {
    case 'map':
      return (
        <div className="fixed inset-0 bg-[#0b0f1c]">
          <CampaignMap onStart={startBattle} />
        </div>
      );
    case 'heroes':
      return (
        <div className="fixed inset-0 bg-[#0b0f1c]">
          <HeroesPanel />
        </div>
      );
    case 'achievements':
      return (
        <div className="fixed inset-0 bg-[#0b0f1c]">
          <AchievementsPanel />
        </div>
      );
    case 'settings':
      return (
        <div className="fixed inset-0 bg-[#0b0f1c]">
          <SettingsPanel />
        </div>
      );
    case 'gallery':
      return (
        <div className="fixed inset-0 bg-[#0b0f1c]">
          <CharacterGallery onClose={closePage} />
        </div>
      );
    default:
      return <div className="fixed inset-0 bg-[#0b0f1c]" />;
  }
}
