import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "آخرین سنگر — نگهبانان سرزمین | Last Fortress",
  description:
    "بازی دفاع از برج فانتزی مدرن فارسی — از هسته آذر در برابر دشمنان تاریکی دفاع کن",
  keywords: ["آخرین سنگر", "tower defense", "بازی فارسی", "Last Fortress", "آریانا"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // فاز ۸ — بخش ۲۳ — نمایش تمام‌صفحه روی دستگاه‌های Notch‌دار
  themeColor: "#07090d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
