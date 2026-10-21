import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lastfortress.ariana',
  appName: 'آخرین سنگر',
  webDir: 'out',
  android: {
    allowMixedContent: false,
    // پس‌زمینهٔ تیره — جلوی فلش سفید قبل از اولین paint پوستهٔ تاریک بازی
    backgroundColor: '#07090d',
  },
};

export default config;
