'use client';

// ============================================================
// مرز خطای سراسری — آخرین سپر در برابر صفحهٔ سفید (بخش ۲۹)
// فقط وقتی خطا به ریشهٔ Layout می‌رسد نمایش داده می‌شود
// ============================================================

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg,#0b0f1c,#101828)', fontFamily: 'Vazirmatn, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 360, padding: 32, borderRadius: 24, textAlign: 'center',
            border: '1px solid rgba(245,158,11,0.3)', background: '#0d1420', color: '#e2e8f0',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fcd34d', margin: '0 0 8px' }}>
            مشکلی پیش آمد
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8, margin: '0 0 20px' }}>
            بازی بارگذاری نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.
          </p>
          <button
            onClick={reset}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(180deg,#f59e0b,#ea580c)', color: '#fff', fontSize: 16, fontWeight: 900,
            }}
          >
            بارگذاری دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
