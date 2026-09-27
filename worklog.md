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

---
Task ID: 2
Agent: main (Super Z)
Task: Asset Pipeline واقعی سه‌بعدی — حذف Primitive به‌عنوان ظاهر نهایی کاراکترها، ساخت AssetManager/Manifest/Animation/Pool/Gallery طبق MASTER PROMPT بخش ۱-۳۰

Work Log:
- بررسی کامل کد فعلی: buildHeroMesh/buildEnemyMesh/buildTowerMesh در models.ts، نقاط اتصال در Hero/Enemy/Tower/Game/InputController (تشخیص تپ و userData.turret/spinCrystal)
- ساخت ماژول src/game/assets/: AssetManifest.ts (۲۹ ورودی: ۴ قهرمان+۱۶ دشمن+۵ Boss+۴ برج با targetHeight/rotationOffset/vfxPoints/animations/phase)، AssetSpecifications.ts (مشخصات کامل مدل‌سازی هر کاراکتر: متریال/رنگ/silhouette/budget/رگ)، AssetManager.ts (GLTFLoader+Cache مثبت/منفی+SkeletonUtils.clone+preload موازی با Progress+بدون Crash)، ModelNormalizer.ts (نرمال‌سازی ارتفاع هدف+جابجایی پا روی زمین+مرکز‌سازی+rotationOffset+استخراج/سنتز نقاط VFX)، CharacterAnimationController.ts (AnimationMixer+Crossfade نرم Idle/Walk/Run+OneShot با بازگشت خودکار+Death Freeze+Fuzzy نام کلیپ)، FallbackFactory.ts (Placeholder شفاف با برچسب صادقانه در userData)، CharacterFactory.ts (الگوی Handle پایدار+Swap-in ناهمزمان+Object Pool برای GLB با cap ۲۴+تضمین shieldAura+انتقال userData برج)، AssetValidator.ts (۸ بررسی بخش ۲۶)، index.ts
- بازنویسی Rendering Layer بدون تغییر Gameplay: Hero.ts (انیمیشن Locomotion/Attack/Skill+شلیک از WeaponPoint واقعی)، Enemy.ts (Pool+انیمیشن Walk/Run/Hit/Death/Roar/PhaseChange+sink کندتر با کلیپ مرگ)، Tower.ts (فکتوری برای ساخت/ارتقا/فروش+GLB اختیاری)، Game.ts (dispose قهرمان+clearPools)، BattleScene.ts (RoomEnvironment PBR برای quality>low)
- UI: GameShell (Splash با Progress فارسی+پیام صادقانه Placeholder+گالری با ?gallery=1)، SettingsPanel (دکمه گالری)، CharacterGallery.tsx (نمایشگر 3D با OrbitControls+انتخاب انیمیشن+نشان وضعیت+مشخصات+اعتبارسنجی کامل)، i18n (۳۷ کلید جدید fa/en)
- public/assets/3d/{heroes,enemies,bosses,towers,environment,effects}/ + README.md با جدول کامل نام فایل/ارتفاع/انیمیشن/قرارداد فنی GLB
- تست مرورگر: Splash→منو→نبرد→تایل‌دا بازی سالم با Placeholder؛ گالری: لیست ۲۹ Asset با وضعیت، Placeholder برچسب‌دار، منتظر GLB با قاب سیمی برای محتوای آینده، اعتبارسنجی اجرا شد
- Smoke-Test End-to-End: GLB آزمایشی موقت (باکس+متریال PBR+WeaponPoint+کلیپ Idle) ساخته و موقتاً به‌جای arman.glb قرار گرفت → Load/Clone/Swap-in حین نبرد/نرمال‌سازی دقیق به ۱٫۸۵/AnimationMixer فعال (mixerTime جلو می‌رود)/نقطه سبز «مدل واقعی GLB» در گالری — سپس فایل آزمایشی حذف شد
- Build نهایی موفق، Lint تمیز، کنسول بدون error (فقط warningهای انتظارِ «فایل GLB یافت نشد»)

Stage Summary:
- خط لوله کامل فعال است: به‌محض قرار گرفتن هر GLB واقعی در public/assets/3d/... با نام‌های README، بدون یک خط تغییر کد، مدل واقعی+انیمیشن+نقاط VFX جایگزین Placeholder می‌شود (با تست موقت اثبات شد)
- صداقت کامل: در این محیط ابزار تولید Asset سه‌بعدی واقعی وجود ندارد؛ هیچ GLB جعلی به‌عنوان Asset معرفی نشد؛ Placeholderها صریحاً «موقت» برچسب خورده‌اند (userData.placeholder + گالری + کنسول)
- ۲۹ مشخصات کامل مدل‌سازی آماده است؛ حجم مورد انتظار نهایی GLBها ≈ ۸۵-۱۰۰MB
