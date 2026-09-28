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

---
Task ID: 3
Agent: main (Super Z)
Task: گسترش کامل محتوا تا مشخصات ۱۰۲ بندی — ۱۰ برج، ۲۶ دشمن/Boss، ۴ قهرمان، ۶ جادو، ۶ منطقه قابل بازی + LOD

Work Log:
- types.ts: ProjectileKind×۵ جدید (cannonball/bolt/venom/prism/hex)، TowerData (poisonDps/armorShred/pierceArmor/execute/buffAura/towerHeight)، EnemyData (healer/summoner/regen)، MagicId×۶، HeroData (role/attackType/abilityKind/unlockCost)، RegionEnv شش‌گانه، SaveData (unlockedHeroes/selectedHero)
- towers.ts: ۶ برج جدید — توپخانه (splash زمینی)، زهرخانه (DoT+شکستن زره)، بالیستا (برد ۱۹+نادیده‌گرفتن زره)، رازآسا (پرایسم جادویی)، آذرگاه (هاله تقویت برج‌ها)، برج تهی (اجرا روی کم‌جان‌ها) — TOWER_BUILD_ORDER ده‌تایی
- enemies.ts: ۱۳ دشمن + ۴ Boss — shadowSoldier/spirit(شفادهنده)/hunter(جاخالی ۳۰٪)/warMachine/crystalMonster(مقاوم انرژی)/smallDragon(پرنده)/summoner(احضار shadow)/aetherTank(regen)/destroyer + Bossها: annihilator(مکانیکی regen)/fireGiant/iceGiant/blackDragon(پرنده)/darkLord(احضارکننده، Final Boss) — مجموع ۲۶ کاراکتر
- magic.ts: deepFreeze (کندی ۰٫۱۲)، azarBlessing (+۴۵٪ سرعت شلیک همه برج‌ها)، coreMend (+۲۵ HP هسته) + قهرمانان aria (magic splash + سپر اثری)/radin (melee cleave ۳ + خشم جنگ)/nila (برد ۱۳ + باران تیر)
- levels.ts (جدید): ۶ منطقه کامل با مسیر منحصربه‌فرد/تم/موج‌های ۱۰تایی/Boss — l1 دشت(plains)/golemKing، l2 جنگل شب(forest)/fireGiant، l3 توندرا(tundra)/iceGiant، l4 آتشفشان(volcano)/blackDragon، l5 ویرانه ماشین(wastes)/annihilator، l6 دژ(citadel)/darkLord + isRegionUnlocked (فتح زنجیره‌ای)
- i18n: ~۱۱۰ کلید جدید fa/en + parity کامل با اسکریپت diff، اصلاح {۰}→{0}، نام مناطق جدید
- Enemy.ts: applyShred (شکستن زره مؤثر در takeDamage)، healAllies، summonMinions (summonAt با enemyId)، regen — context.ts به‌روز
- Tower.ts: ۶ کیس ability جدید (شلیک مرگبار/مه سمی/پیکان شکافنده/انفجار جادویی/ستایش آذر/دهانه تهی)، هاله تقویت پالسی applyLocalBuff، fire() با dmgType + executeBonus
- Projectile.ts: بازنویسی Data-Driven — سرعت/هندسه/دنباله بر اساس kind، opts جدید (dmgType/poisonDps/pierceArmor)
- Hero.ts: بازنویسی چندقهرمانی — attack() بر اساس role (شلیک/گوی جادویی splash/کلنگ cleave)، useAbility با ۴ abilityKind، findCluster برای باران تیر
- Game.ts: heroId پارامتر، ۳ کیس جادوی جدید، requestCoreShield (سپر اثری)، رگبار تیر (visual:'arrow')، heroState پویا، towerRateBuff = فرمان نبرد + برکت آذر
- BattleScene.ts: ENV_THEMES شش‌گانه (آسمان/مه/زمین/مسیر/کریستال/درخت/سازه)، buildGround/buildPathMesh/buildEnvironment theme-aware، نور آفتاب per-region، نور گداخته آتشفشان
- models.ts: ۶ برج جدید (توپ/دیگ زهر/بالیستا/پرایسم/محراب/منولیت تهی)، ۱۴ سیلوئت دشمن متمایز، buildHeroMesh(heroId) چهارگانه (آریا ردا+عصا/رادین کلنگ/نیلا کمان+کلاه‌ریش)، buildPineTree/DeadTree/Debris/ObsidianRock، buildMountain(style)، buildHouse(ruined)
- Asset Pipeline: همه ورودی‌ها phase:'slice'، ۷ ورودی برج جدید در Manifest، createFallbackHero(entry.id) — باگ placeholder قهرمان اشتباه رفع شد
- LOD (بخش ۱۶): ModelNormalizer تشخیص گره‌های *LOD1/*LOD2، CharacterHandle.updateLod (سه‌سطحی ۲۲/۳۸ با lodBase)، اتصال به حلقه Game برای hero+enemies — برای GLB واقعی فعال، Placeholder بی‌هزینه
- Save/Store/Shell: unlockedHeroes+selectedHero با مهاجرت، setPendingLevel/setSelectedHero/unlockHero، GameShell از LEVELS[pendingLevelId] + selectedHero
- UI: CampaignMap بازنویسی (۶ منطقه پویا، unlock زنجیره‌ای، briefing per-region با Boss/دشمنان)، BattleUI (۱۰ برج اسکرول افقی، ۶ جادو گرید ۲×۳، heroData پویا، رفع همپوشانی قهرمان/جادو)، HeroesPanel بازنویسی (بازکردن با کریستال/انتخاب/آمار)، MainMenu دکمه نقشه
- رفع خطاهای pre-existing تایپ (desiredTarget private، MAGIC[null]، TowerInfo cast، icon style prop)
- تست مرورگر کامل: نقشه ۶ منطقه با قفل زنجیره‌ای ✓، ساخت توپخانه/زهرخانه/آذرگاه ✓، شلیک و آسیب (hp ۱۰۵→۴۵→۱) ✓، یخبندان و استقرار قهرمان ✓، بازکردن نیلا با کریستال + persist ✓، شکست و اورلی ✓، گالری ۴۰ Asset با برچسب صادقانه ✓، منطقه ۲ تم شب جنگل ✓، shadowSoldier hp دقیق طبق داده ✓، کنسول صفر error ✓، tsc/eslint/build تمیز ✓

Stage Summary:
- بازی از Vertical Slice به محتوای کامل مشخصات رسید: ۱۰ برج × ۵ سطح، ۲۶ دشمن/Boss با رفتارهای متمایز، ۴ قهرمان Role-محور، ۶ جادو، ۶ منطقه قابل بازی با تم‌های بصری متفاوت
- خط لوله Asset دست‌نخورده و فعال — GLB واقعی به‌محض قرارگیری جایگزین Placeholder می‌شود؛ LOD scaffold آماده GLBهای multi-LOD
- صادقانه: هیچ GLB جعلی اضافه نشد؛ تمام ۴۰ Placeholder برچسب «موقت» دارند

---
Task ID: 4
Agent: main (Super Z)
Task: سه درخواست کاربر — (۱) عمیق‌تر کردن سیستم Boss Phase 2 اختصاصی هر Boss (آتش/یخ/اژدها) (۲) باز شدن تدریجی برج‌ها (۳) صفحات iframe به‌جای منوی ردیفی

Work Log:
- Boss Phase 2 اختصاصی: فایل جدید src/game/data/bossPhases.ts — پیکربندی Data-Driven هر ۶ Boss: پادشاه غول سنگی (خشم سنگی: زره×۱٫۵ + پوست سنگی -۱۵٪ آسیب + احضار گolem×۲ + ضربه سنگی دوره‌ای)، غول آتش (خشم آتشین: سرعت×۱٫۳ + ایمنی به کندی/یخ + بازسازی ۸/s + احضار جنگجو×۳ + فوران آتشی دوره‌ای شعاع ۷)، غول یخ (انجماد ابدی: زره×۱٫۴۵ + ایمنی سرما + بازسازی ۱۲/s + آئورای انجماد همه برج‌های شعاع ۹ برای ۴ ثانیه)، اژدهای سیاه (خشم آسمانی: سرعت×۱٫۴ + احضار smallDragon×۲ + نفس سایه ۲ برج برای ۳٫۵ ثانیه)، محوکننده (پروتکل نابودی: بازسازی×۲ + لیزر هدفمند هر ۶ ثانیه)، ارباب تاریکی (تجلی تاریکی: سپر ۱۲۰۰ + احضار ۴ سایه‌سرباز لحظه ورود + احضار دوره‌ای)
- Enemy.ts: enterPhase2 (جلوه‌ها با رنگ اختصاصی + بنر + آمار + سپر + احضار) + updatePhase2Abilities با ۴ نوع توانایی دوره‌ای (towerStun با vfx.bolt / frostAura / eruption / summon) + slowImmune در applySlow + damageReduction در takeDamage + regen فاز۲ — رفتار عمومی قدیمی برای Bossهای بدون پیکربندی حفظ شد
- Tower.disable(duration,color): توقف شلیک/هاله + دود نشانگر + animateIdleSpin جدا شد تا کریستال‌ها هنگام ازکارافتادگی بچرخند
- GameContext: disableTower + onBossPhase جدید — Game.ts پیاده‌سازی (disableTower واقعی + bus.emit bossPhase)
- بنر «فاز دوم» در BattleUI با رنگ اختصاصی هر Boss + state bossPhase در store + resetBattleState + BUS_EVENTS
- باز شدن تدریجی برج‌ها: TowerData.unlockStars + totalStars/isTowerUnlocked/starsUntilTower در towers.ts — نگهبان ۰، یخ ۱، آتش ۲، صاعقه ۳، توپخانه ۵، زهرخانه ۷، بالیستا ۹، رازآسا ۱۱، محراب ۱۳، تهی ۱۵ (کل ممکن ۱۸ ستاره)
- گاردها در Game.setBuildMode و tryBuild + نوار برج BattleUI (آیکون قفل + ستاره لازم + badge ستاره باقی‌مانده + grayscale) + briefing نقشه (قفل + ستاره) + toast towerLocked
- صفحات iframe: مسیر /page/[screen] (SSG پنج صفحه: map/heroes/achievements/settings/gallery) + StandaloneScreen (initSave مشترک localStorage) + MainMenu بازنویسی — منوی ردیفی حذف، نوار تب پایین + قاب iframe با هدر و بستن + iframes ماندگار بین تب‌ها
- پل postMessage: startBattle (نقشه iframe → شروع نبرد والد) / saveChanged (رویداد savePersisted در SaveSystem → initSave والد) / closePage / openPage (دکمه گالری تنظیمات iframe → تب والد)
- useStandaloneBack در سه پنل (قهرمانان/دستاوردها/تنظیمات) — بازگشت در iframe به پیام closePage تبدیل می‌شود؛ CampaignMap در حالت iframe دکمه بازگشت مخفی + onStart پیام می‌فرستد
- i18n: ۱۲ کلید جدید fa/en (نام فاز ۶ Boss + bossPhaseTitle + towerLocked + menuPagesHint) — parity بررسی شد
- رفع prerender: isStandalonePage از سرور قابل فراخوانی نبود → PAGE_IDS محلی در route

تست مرورگر (390×844):
- منو: نوار تب ۵ صفحه‌ای جایگزین منوی ردیفی ✓ / تب نقشه → iframe نقشه با ۶ منطقه ✓ / briefing: برج‌های قفل با ستاره ✓ / «آغاز نبرد» از iframe → postMessage → شروع نبرد واقعی ✓
- شروع مستقیم با دکمه شروع نبرد ✓ / آموزش نمایش داده شد ✓
- Boss فاز۲: golemKing در hp<50% → phase2، زره ۱۴→۲۱ (×۱٫۵)، سرعت ×۱٫۱، احضار ۲ گolem، بنر DOM «فاز دوم/خشم سنگی» ✓ / towerStun: sentinel با disableTimer=2.25 از کار افتاد (دمو) ✓ / fireGiant: applySlow نادیده (slowFactor=۱)، زره ۲۲، سرعت ۱٫۵۶، ۳ جنگجو ✓ / blackDragon: سرعت ۲٫۲۴ (×۱٫۴)، ۲ smallDragon احضار شد ✓ / iceGiant: slowImmune + تایمر frostAura ✓
- قفل برج: void/ice با ۰ ستاره → buildMode null + toast ✓ / sentinel باز ✓ / بریفینگ ستاره باقی‌مانده ✓
- پل ذخیره: بازکردن قهرمان → رویداد savePersisted ✓ (۴۰۰→۲۵۰ کریستال) / ذخیره ریست شد برای تجربه پیشرفت تازه
- tsc: ۰ خطای src / eslint تمیز / build موفق (۵ صفحه SSG)

Stage Summary:
- هر Boss اکنون در نیمه دوم HP شخصیت واقعی خودش را دارد: مکانیک اختصاصی + توانایی دوره‌ای + جلوه و بنر مخصوص — از داده خوانده می‌شود (bossPhases.ts) و Boss جدید فقط با یک entry اضافه می‌شود
- اقتصاد پیشرفت بازطراحی شد: ستاره‌ها فقط قفل منطقه نمی‌شکنند، برج‌ها را هم قدم‌به‌قدم آزاد می‌کنند (نگهبان+یخ تقریباً از اول، تهی و محراب انتهای کمپین)
- ناوبری از React state به صفحات iframe مستقل (/page/...) منتقل شد — هر صفحه حالت و اسکرول خودش را دارد و با پل postMessage + localStorage با بازی اصلی همگام است

---
Task ID: 5
Agent: main (Super Z)
Task: پنج درخواست کاربر — (۱) صفحه خالی دکمه‌های iframe (۲) پیش‌نمایش سبز/قرمز محل ساخت برج (۳) باگ هزینه ارتقا لول ۴ صفر سکه (۴) رو به دشمن بودن هیرو (۵) گرافیک بیشتر

Work Log:
- بازتولید باگ iframe با Agent Browser: صفحات /page/* سالم بودند ولی نوار تب پایین زیر قاب iframe پوشیده می‌شد → کلیک تب‌های دیگر وقتی صفحه‌ای باز بود اثری نداشت + حالت save=null فقط یک div تیره خالی نشان می‌داد + تیتر پنل‌ها داخل iframe تکرار می‌شد
- MainMenu: نوار تب به لایه مستقل absolute پایین (z-40) منتقل شد — همیشه بالای iframe و قابل کلیک؛ قاب iframe به top-[4%] bottom-[104px] کوتاه شد؛ نقطه کهربایی روی تبِ بازِ غیرفعال؛ show水晶 pill در جریان اصلی + pb-28
- StandaloneScreen: PageLoading برنددار (کریستال پالس‌دار + «در حال بارگذاری…») به‌جای صفحه خالی + PanelErrorBoundary (catch خطای رندر هر پنل با دکمه تلاش دوباره) + ست‌شدن data-standalone روی html برای CSS
- حذف تیتر تکراری: کلاس panel-header به هدر پنج پنل (نقشه/قهرمانان/دستاوردها/تنظیمات/گالری) + قانون CSS html[data-standalone='1'] .panel-header { display:none !important } — تأیید شد getComputedStyle → none
- i18n: pageLoading/pageError/pageRetry (fa/en) — parity کامل
- پیش‌نمایش ساخت: InputController.onGroundHover (mouse hover بدون کلیک + درگ انگشت همراه pan) + pickGround سبک فقط-plane؛ Game: createGhost (دیسک CircleGeometry 1.85 + حلقه برد واقعی برج سطح ۱ RingGeometry) + updateGhost با اسنپ تایل ۲ واحدی و اعتبارسنجی canBuild+coins → سبز 0x22c55e / قرمز 0xef4444 + نبض opacity در update؛ گرید زمین تایل‌بندی‌شده فقط در حالت ساخت (CanvasTexture، y=0.06)؛ رفع باگ همزمانی: tryBuild موفق اکنون buildMode=null + clearGhost + خاموش‌کردن گرید می‌کند (قبلاً buildMode فعال می‌ماند و تپ بعدی برج ناخواسته می‌ساخت!)؛ dispose کامل ghost/grid
- باگ ارتقا: Tower.upgradeCost قبلاً levels[this.level] می‌خواند → در لول ۴ هزینه لول ۵ یعنی ۰ نمایش داده می‌شد و ارتقای لول ۵ مجانی بود! → levels[this.level - 1]؛ upgrade() هزینه را قبل از level++ ثبت می‌کند تا invested دقیق بماند (sellValue درست)؛ کامنت types.ts اصلاح شد؛ زنجیره جدید نگهبان: L1→۱۰۰، L2→۸۵، L3→۱۳۰، L4→۱۹۰
- هیرو: turnToward مستقل از فریم‌ریت (rate*dt)؛ حین حرکت رو به مقصد (rate 9)، حمله رو به دشمن جلوی صف (rate 7)، بدون دشمن در برد رو به نزدیک‌ترین نقطه مسیر (پایش گارد، rate 2.5)؛ deploy بلافاصله رو به مسیر snap می‌شود
- گرافیک: گنبد آسمان ShaderMaterial گرادیانی (افق روشن → اوج عمیق، رنگ از تم منطقه، fog:false)؛ ستاره‌های شب ۳۲۰ نقطه (فقط night و quality≠low)؛ نور Rim مخالف خورشید (0.45 روز/0.22 شب)؛ لکه‌های نرم radial-gradient روی بافت زمین (۲۶ لکه روشن/تیره)؛ سنگ‌ریزه لبه مسیر InstancedMesh (Dodecahedron، جانمایی قطعی rnd2)؛ وینیت CSS سینمایی battle-vignette در BattleUI
- تست Agent Browser: تعویض تب نقشه→قهرمانان بدون بستن ✓ (هر دو iframe زنده) / هدر داخلی مخفی ✓ / نبرد: زمین لکه‌دار + سنگ لبه مسیر ✓ / ghost قرمز روی مسیر و سبز روی زمین معتبر ✓ / ساخت نگهبان ۲۴۰→۱۴۰ ✓ / ارتقا L1→L2 با VFX، «ارتقا — ۸۵» در L2 و دکمه غیرفعال با ۴۰ سکه ✓ / استقرار هیرو رو به مسیر + پایش ✓ / کنسول صفر error / eslint تمیز / build موفق ۹ صفحه

Stage Summary:
- هر پنج درخواست انجام شد؛ باگ مجانی‌بودن ارتقای L5 (صفر سکه در لول ۴) و باگ ماندن buildMode بعد از ساخت رفع شد
- iframe اکنون مثل یک سیستم تب واقعی عمل می‌کند: باز/تعویض/بستن بدون گیر، لودینگ و خطا هرگز صفحه خالی نمی‌دهند
- صحنه نبرد عمق بصری واقعی گرفت بدون قربانی‌کردن موبایل (InstancedMesh + یک draw call برای سنگ‌ها، گنبد آسمان یک draw، وینیت CSS)

---
Task ID: 6
Agent: main (Super Z)
Task: دریافت و جایگذاری اولین GLB واقعی کاربر (arman.glb از لینک uploadkon) + اعتبارسنجی کامل + تست زنده در گالری و نبرد

Work Log:
- دانلود arman.zip از https://uploadkon.ir/uploads/fa6e28_26arman.zip (194KB) → استخراج → arman.glb (230KB)
- اسکریپت scripts/inspect-glb.js: هدر GLB معتبر (glTF 2.0, Sketchfab-16.9.0)، ۴ نود، ۲ مش (۱۵۲۶ مثلث)، ۲ متریال PBR rough با ۲ تکسچر PNG داخلی، **skins=0 و animations=0** (مدل استاتیک بدون اسکلت)
- شناسایی منبع: نود «M-FF_iOS_HERO_Thor_Odinson_Avengers» — مدل Thor از بازی Marvel Future Fight (کپی‌رایت Marvel/Disney — باید به کاربر اعلام شود)
- جایگذاری: public/assets/3d/heroes/arman.glb + حذف zip و پوشه استخراج (طبق درخواست کاربر)
- تست زنده گالری (?gallery=1): نشان «مدل واقعی GLB» سبز + وضعیت Asset: real GLB / ۲۳۰KB / مثلث ۱۵۲۶ / تکسچر ۲ / «بدون انیمیشن (Placeholder یا مدل استاتیک)» — تشخیص صحیح استاتیک بودن
- تست زنده نبرد: استقرار آرمان → مدل Thor (شنل قرمز/زره زنجیری/کلاه‌خود بالدار) داخل دایره سبز رندر شد؛ نرمال‌سازی ارتفاع و ایستادن روی زمین صحیح؛ کنسول صفر error (فقط هشدارهای انتظارِ برج‌های بدون GLB)
- صفر خط تغییر کد — دقیقاً طبق قرارداد بخش ۱۵/۲۹: GLB واقعی → جایگزینی خودکار Placeholder

Stage Summary:
- خط لوله Asset با اولین GLB واقعی کاربر تست و تأیید شد: Load→Normalize→Gallery→Battle همه سالم
- مدل آرمان فعلی «استاتیک» است (بدون اسکلت/انیمیشن) — در بازی حرکت/حمله انیمیشنی ندارد؛ برای انیمیشن باید مدل Rigged با کلیپ Idle/Walk/Attack تهیه شود
- ریسک کپی‌رایت (Thor Marvel) به کاربر گزارش شد
