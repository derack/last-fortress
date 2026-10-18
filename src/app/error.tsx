'use client';

// ============================================================
// مرز خطا — هیچ خطای مهمی نباید صفحه سفید نشان دهد (بخش ۲۹)
// پیام دوستانه + دکمهٔ تلاش دوباره — ذخیرهٔ بازی در localStorage
// دست‌نخورده می‌ماند و پیشرفت از دست نمی‌رود
// ============================================================

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GameShell] خطای غیرمنتظره:', error);
  }, [error]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg,#0b0f1c,#101828)', fontFamily: 'Vazirmatn, system-ui, sans-serif',
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 360, padding: 32, borderRadius: 24, textAlign: 'center',
          border: '1px solid rgba(245,158,11,0.3)', background: '#0d1420', color: '#e2e8f0',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fcd34d', margin: '0 0 8px' }}>
          خطایی رخ داد
        </h1>
        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8, margin: '0 0 20px' }}>
          نبرد دچار اختلال شد اما پیشرفت شما محفوظ است. دوباره تلاش کنید.
        </p>
        <button
          onClick={reset}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(180deg,#f59e0b,#ea580c)', color: '#fff', fontSize: 16, fontWeight: 900,
          }}
        >
          تلاش دوباره
        </button>
      </div>
    </div>
  );
}
