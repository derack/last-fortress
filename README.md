# آخرین سنگر: نگهبانان سرزمین — Last Fortress: Guardians of the Land

بازی سه‌بعدی دفاع از قلعه (Tower Defense) به زبان فارسی، ساخته‌شده با Next.js + Three.js و بسته‌بندی‌شده برای اندروید با Capacitor.

Persian 3D tower-defense game built with Next.js + Three.js, packaged for Android via Capacitor.

## ✨ ویژگی‌ها / Features

- ۱۰ فصل × ۱۰ مرحله کامل با دشمنان و باس‌های متنوع (اژدهای سیاه، هیولای یخی، گرگینه و…)
- ۶ برج قابل ارتقا تا سطح ۵ + جادوهای آسمانی (رعد و برق، بارش آتش، سپر مقدس)
- ۴ قهرمان قابل انتخاب و ارتقا
- سیستم کامل دستاوردها، ذخیرهٔ خودکار و دو زبانه (فارسی/انگلیسی)
- رابط کاربری راست‌به‌چپ فارسی با فونت اختصاصی

## 🛠 تکنولوژی / Stack

- **Next.js 16 + React + TypeScript** — منطق بازی و UI
- **Three.js** — رندر سه‌بعدی (GLB + fallback پروسیجرال)
- **Zustand** — مدیریت state
- **Capacitor** — خروجی اندروید (APK امضاشده)

## 🚀 اجرا / Run

```bash
bun install
bun run dev        # توسعه: http://localhost:3000
bun run build      # بیلد پروداکشن
```

## 📱 ساخت APK اندروید / Android Build

```bash
CAP_BUILD=1 bun run build:cap   # خروجی استاتیک به out/
cd android && ./gradlew assembleRelease
# خروجی: android/app/build/outputs/apk/release/app-release.apk
```

امضای release با keystore واقعی Google انجام می‌شود (فایل‌ها در `android/keystore/` — ⚠️ هرگز public نکنید).

## ⚠️ نکتهٔ امنیتی

این ریپو **Private** است چون keystore امضای APK و مشخصات آن داخل آن ذخیره شده است.
