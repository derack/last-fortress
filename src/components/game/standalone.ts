'use client';

import { useGameStore } from '@/store/gameStore';

// ============================================================
// پل حالت مستقل (iframe) — پنل‌ها به‌جای تغییر صفحه داخلی،
// به پنجره والد پیام می‌دهند تا iframe بسته شود
// ============================================================

export function useStandaloneBack(): () => void {
  const setScreen = useGameStore((s) => s.setScreen);
  return () => {
    if (typeof window !== 'undefined' && window.self !== window.top) {
      window.parent.postMessage({ type: 'closePage' }, '*');
    } else {
      setScreen('menu');
    }
  };
}
