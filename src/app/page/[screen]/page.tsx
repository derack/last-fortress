import { StandaloneScreen } from '@/components/game/StandaloneScreen';
import { notFound } from 'next/navigation';

// ============================================================
// صفحات مستقل بازی — برای نمایش در iframe منوی اصلی
//   /page/map          نقشه مبارزه
//   /page/heroes       قهرمانان
//   /page/achievements دستاوردها
//   /page/settings     تنظیمات
//   /page/gallery      گالری کاراکترها
// ============================================================

const PAGE_IDS = ['map', 'heroes', 'achievements', 'settings', 'gallery'] as const;

export function generateStaticParams() {
  return PAGE_IDS.map((screen) => ({ screen }));
}

export default async function StandalonePage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!(PAGE_IDS as readonly string[]).includes(screen)) notFound();
  return <StandaloneScreen id={screen as (typeof PAGE_IDS)[number]} />;
}
