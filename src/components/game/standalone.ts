'use client';

import { createContext, useContext } from 'react';
import { useGameStore } from '@/store/gameStore';

// ============================================================
// پل حالت جاسازی‌شده — صفحات منو به‌صورت inline در MainMenu رندر
// می‌شوند (بدون iframe). قبل‌ها هر تب یک سند کامل Next.js را داخل
// iframe دوباره بارگذاری می‌کرد — یعنی «لودینگ اولیه» با هر لمس.
// ------------------------------------------------------------
// PageShellContext توسط MainMenu فراهم می‌شود:
//   close()       — بستن صفحه (معادل closePage قدیمی)
//   startBattle() — شروع نبرد از نقشه (با گیت آنلاک در سمت والد)
// اگر Context نباشد، رفتار قدیمی حفظ می‌شود:
//   داخل iframe (routeهای /page قدیمی) → postMessage به والد
//   تمام‌صفحه معمولی → setScreen('menu')
// ============================================================

export interface PageShell {
  close: () => void;
  startBattle: () => void;
}

export const PageShellContext = createContext<PageShell | null>(null);

/** داخل یک صفحه جاسازی‌شده منو هستیم؟ */
export function usePageShell(): PageShell | null {
  return useContext(PageShellContext);
}

export function useStandaloneBack(): () => void {
  const shell = usePageShell();
  const setScreen = useGameStore((s) => s.setScreen);
  return () => {
    if (shell) {
      shell.close();
      return;
    }
    if (typeof window !== 'undefined' && window.self !== window.top) {
      // سازگاری با routeهای مستقل قدیمی — پیام به پنجره والد
      window.parent.postMessage({ type: 'closePage' }, '*');
    } else {
      setScreen('menu');
    }
  };
}
