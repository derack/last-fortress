# Worklog — آخرین سنگر (Last Fortress)

---
Task ID: 1
Agent: main (Super Z)
Task: ساخت Vertical Slice بازی Tower Defense سه‌بعدی فارسی «آخرین سنگر» به‌صورت Next.js + Three.js (قابل اجرا در موبایل، آماده بسته‌بندی اندروید با WebView/Capacitor)

Work Log:
- راه‌اندازی محیط fullstack و نصب three@0.186
- ساخت معماری: src/game/{core,data,entities,systems,scene}, src/components/game, src/store
- Data-Driven: types.ts + towers.ts (۴ برج×۵ سطح) + enemies.ts (۶ دشمن+Boss با Tier) + magic.ts (۳ جادو+Hero آرمان) + level1.ts (۱۰ موج+Boss+۳۰ دستاورد) + i18n.ts (fa/en کامل)
- هسته موتور: Game.ts (loop/موج/اقتصاد/جادو/پیروزی-شکست)، CameraController (pan/zoom/shake)، InputController (tap/pinch)، EventBus
- صحنه: BattleScene (زمین بافت‌دار، مسیر S شکل با کواردهای مستقل+دیسک‌های اتصال، هسته آذر، دروازه تاریکی، درخت/سنگ/خانه/کریستال/کوه)، models.ts (مدل‌های low-poly با Transformation سطح ۵)
- موجودیت‌ها: Enemy (حرکت arc-length، slow/burn/shield/dodge/Boss فاز۲+احضار+slam)، Tower (۵ حالت هدف‌گیری، ۴ قدرت ویژه)، Projectile، Hero (XP/Level/فرمان نبرد)
- سیستم‌ها: VFXSystem (۹۰۰ ذره shader، صاعقه زنجیره‌ای، حلقه، دایره جادو با رون اورجینال Canvas)، AudioSystem (Web Audio پروسیجرال — ۱۸ افکت + موسیقی سیکوئنسر با حالت Boss)، SaveSystem (localStorage)
- UI فارسی RTL: MainMenu، CampaignMap (۶ منطقه)، BattleUI (HUD کامل: سلامت/موج/سکه/کریستال/سرعت/توقف/بنر Boss/آموزش/Toast/پنل برج/جادو/قهرمان/پیروزی/شکست)، SettingsPanel، AchievementsPanel، HeroesPanel
- فونت Vazirmatn CDN + اعداد فارسی + سوییچ کامل fa/en با تغییر dir سند
- باگ‌های رفع‌شده در تست مرورگر: مرگ دشمن دوبار پاداش، پرتابه بدون هدف (باران آتش)، اسپایک‌های سیاه مسیر (تاخوردگی روبان در پیچ‌ها → کوارت مستقل + دیسک)، winding دیسک‌ها (backface culling)، overlay شکست باقی‌مانده بعد از retry (resetBattleState)، dir هاردکد RTL، عدد +۱۰ در RTL

Stage Summary:
- Vertical Slice کامل و تست‌شده با Agent Browser: منو→نقشه→نبرد→ساخت ۳ برج→ارتقا L5→قدرت ویژه→آذرخش/باران آتش/سپر→استقرار قهرمان→موج ۲→Boss با فاز ۲→پیروزی ۲ ستاره→ذخیره→نقشه با ستاره→دستاورد «اولین سنگر»→تعویض زبان→retry تمیز
- Lint بدون خطا، کنسول بدون error، چیدمان موبایل (390×844) تأیید شد
- آماده بسته‌بندی Android با Capacitor/WebView
