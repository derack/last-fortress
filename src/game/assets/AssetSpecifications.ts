// ============================================================
// Asset Specifications — مشخصات کامل مدل‌سازی هر کاراکتر
// ------------------------------------------------------------
// این مشخصات «قرارداد» هر Asset است: هنرمند ۳بعدی یا ابزار
// تولید Asset (مثل Meshy / Tripo / Blender) باید دقیقاً همین را بسازد.
// گالری کاراکترها و AssetValidator همین مشخصات را اعتبارسنجی می‌کنند.
// ============================================================

export interface MaterialSpec {
  part: string;
  color: string;
  roughness: number; // 0..1
  metalness: number; // 0..1
  emissive?: string;
  emissiveIntensity?: number;
  note?: string;
}

export interface AssetSpecification {
  specId: string;
  role: string;
  /** خلاصه هویت بصری — چه چیزی این کاراکتر را یکتا می‌کند */
  identity: string;
  /** توصیف silhouette در یک جمله */
  silhouette: string;
  bodyShape: string;
  proportions: string;
  materials: MaterialSpec[];
  details: string[];
  /** بودجه مثلث برای موبایل */
  polyBudgetTris: number;
  /** رزولوشن پیشنهادی بافت */
  textureSize: 512 | 1024 | 2048;
  animations: string[];
  vfxPoints: string[];
  rigBones?: string[];
}

const HUMAN_RIG = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Shoulder.L/R', 'Arm.L/R', 'ForeArm.L/R', 'Hand.L/R', 'UpLeg.L/R', 'Leg.L/R', 'Foot.L/R'];

export const ASSET_SPECS: Record<string, AssetSpecification> = {
  // ============================ قهرمانان ============================
  arman: {
    specId: 'arman',
    role: 'Fantasy Tactical Commander — قهرمان اصلی بازی',
    identity: 'فرمانده تاکتیکی فانتزی: زره فلز تیره با خطوط طلایی، هسته آذر درخشان مرکز سینه، شمشیر انرژی کهربایی، شنل کوتاه قرمز تیره',
    silhouette: 'اندام انسانی قهرمانی با شمشیر بلند انرژی و شنل کوتاه — خط عمودی غالب با تاج نور کهربایی روی سینه',
    bodyShape: 'انسان‌نما (Humanoid) — V-shape تنومند، کمر باریک، شانه‌های زره‌دار با Pauldron لایه‌ای',
    proportions: '۷.۵ سر (Heroic proportions) — پهنای شانه ۲.۲ سر، ارتفاع کل ۱.۸۵ واحد',
    materials: [
      { part: 'زره بدن', color: '#3d4450', roughness: 0.42, metalness: 0.85, note: 'فلز تیره brushed با Bevel واقعی لبه‌ها' },
      { part: 'خطوط طلایی', color: '#d4a017', roughness: 0.28, metalness: 0.95, note: 'Trimهای طلایی روی سینه، شانه و کمر' },
      { part: 'هسته آذر سینه', color: '#ffb020', roughness: 0.2, metalness: 0.1, emissive: '#ff9d00', emissiveIntensity: 2.2, note: 'کریستال درخشان مرکز زره' },
      { part: 'شمشیر انرژی', color: '#ffd54a', roughness: 0.15, metalness: 0.2, emissive: '#ffb020', emissiveIntensity: 1.8, note: 'تیغه انرژی + محافظ فلزی تیره' },
      { part: 'شنل', color: '#7a1f1f', roughness: 0.92, metalness: 0.0, note: 'پارچه سنگین با چین‌های واقعی' },
      { part: 'چرم زیرین', color: '#2a2622', roughness: 0.8, metalness: 0.05 },
      { part: 'پوست', color: '#c8a06a', roughness: 0.65, metalness: 0.0, note: 'چهره قابل تشخیص — چشم/ابرو/فرم فک' },
    ],
    details: [
      'Pauldron سه‌لایه روی شانه راست',
      'هسته آذر شش‌ضلعی در مرکز سینه با قاب طلایی',
      'شنل کوتاه تا وسط پشت با Pin فلزی',
      'چکمه زره‌دار با پره فلزی',
      'کمربند با روکش طلایی و Pouch کنار ران',
      'چهره: چشم‌ها ماتریال جدا با Iris، ابرو مش هندسی',
    ],
    polyBudgetTris: 25000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Run', 'Attack', 'Skill', 'Hit', 'Death', 'Victory'],
    vfxPoints: ['weaponPoint (دست راست — نوک شمشیر)', 'muzzlePoint (نوک تیغه برای شلیک)', 'chestPoint', 'headPoint', 'hitPoint (مرکز بدن)'],
    rigBones: HUMAN_RIG,
  },

  aria: {
    specId: 'aria',
    role: 'Fantasy Arcane Guardian — جنگاور جادویی',
    identity: 'زن جنگاور جادویی: زره سبک نقره‌ای-فیروزه‌ای، کریستال‌های انرژی اثری درخشان، شنل بلند، سلاح جادویی قوسی',
    silhouette: 'اندام کشیده با شنل بلند و هاله کریستالی — منحنی‌های نرم در تضاد با لبه‌های تیز کریستال',
    bodyShape: 'انسان‌نما زن — اندام چابک، شانه‌های آزاد، دامن زره‌ای کوتاه',
    proportions: '۷ سر — فریم ظریف‌تر از آرمان، ارتفاع ۱.۷۸ واحد',
    materials: [
      { part: 'زره سبک', color: '#8fa8b8', roughness: 0.35, metalness: 0.8 },
      { part: 'کریستال اثری', color: '#67e8f9', roughness: 0.1, metalness: 0.05, emissive: '#22d3ee', emissiveIntensity: 1.6 },
      { part: 'پارچه زیرین', color: '#1e2a3a', roughness: 0.9, metalness: 0 },
      { part: 'شنل', color: '#2c4a6e', roughness: 0.88, metalness: 0 },
    ],
    details: ['تاج کریستالی جلوی پیشانی', 'شنل بلند با لبه رون‌خورده', 'جواهرسنگ اثری روی کمربند و سینه'],
    polyBudgetTris: 24000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Run', 'Attack', 'Skill', 'Hit', 'Death', 'Victory'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
    rigBones: HUMAN_RIG,
  },

  radin: {
    specId: 'radin',
    role: 'Heavy Fantasy Warrior — جنگاور سنگین',
    identity: 'جنگاور سنگین: زره کامل فلزی سنگین با پرچ، هسته اثری روی سینه‌پوش، پتک/تبر سنگین بزرگ، اندام قدرتمند',
    silhouette: 'مکعبی و عریض — دیوار متحرک فلز با سلاح سنگین روی شانه',
    bodyShape: 'انسان‌نما تنومند — ۱.۳ برابر عرض قهرمان معمولی',
    proportions: '۷ سر با شانه فوق‌العاده پهن — ارتفاع ۱.۹۵ واحد',
    materials: [
      { part: 'زره سنگین', color: '#4a4f58', roughness: 0.5, metalness: 0.9, note: 'صفحات پرچ‌دار لایه‌ای' },
      { part: 'هسته اثری', color: '#fbbf24', roughness: 0.2, metalness: 0.1, emissive: '#f59e0b', emissiveIntensity: 1.8 },
      { part: 'سلاح سنگین', color: '#2f3540', roughness: 0.4, metalness: 0.85 },
      { part: 'چرم و پارچه', color: '#3a2f28', roughness: 0.85, metalness: 0 },
    ],
    details: ['پرچ‌های واقعی روی صفحات زره', 'شانه‌های دو‌لایه', 'تبر دو‌دسته با حکاکی رون', 'کلاهخود با Vizor باز و ریش فلزی'],
    polyBudgetTris: 26000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Run', 'Attack', 'Skill', 'Hit', 'Death', 'Victory'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
    rigBones: HUMAN_RIG,
  },

  nila: {
    specId: 'nila',
    role: 'Arcane Ranger — تک‌تیرانداز جادویی',
    identity: 'کمانگیر جادویی: زره سبک چرمی-کریستالی، کمان انرژی، شنل کوتاه چابک، تیردان کریستالی',
    silhouette: 'کشیده و چابک — کمان انرژی قوسی شکل مهم‌ترین عنصر silhouette',
    bodyShape: 'انسان‌نما زن چابک — فریم سبک، حرکات سریع',
    proportions: '۷ سر — ارتفاع ۱.۷۵ واحد',
    materials: [
      { part: 'زره سبک', color: '#3d5245', roughness: 0.6, metalness: 0.3 },
      { part: 'کمان انرژی', color: '#a7f3d0', roughness: 0.1, metalness: 0, emissive: '#34d399', emissiveIntensity: 1.7 },
      { part: 'کریستال‌های متصل', color: '#6ee7b7', roughness: 0.15, metalness: 0.05, emissive: '#10b981', emissiveIntensity: 1.2 },
      { part: 'چرم', color: '#2d241c', roughness: 0.85, metalness: 0 },
    ],
    details: ['کمان بدون زه با قوس انرژی', 'تیردان روی پشت با تیرهای کریستالی', 'نقاب سبک روی یک چشم'],
    polyBudgetTris: 22000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Run', 'Attack', 'Skill', 'Hit', 'Death', 'Victory'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
    rigBones: HUMAN_RIG,
  },

  // ============================ دشمنان ============================
  shadow: {
    specId: 'shadow',
    role: 'Shadow Creature — موجود سایه شناور',
    identity: 'موجود سایه: بدنه دودی نیمه‌شفاف شناور، هسته بنفش درخشان، دنباله‌های دودی رو به پایین، چشم‌های نورانی',
    silhouette: 'قطره معکوس شناور با دنباله‌های دودی — بدون پا، حرکت شناور',
    bodyShape: 'غیرانسان‌نما — بدنه ابری با هسته جامد، بدون اندام',
    proportions: 'پهن ۱.۱ برابر ارتفاع — ارتفاع ۱.۴۵ واحد، شناور ۰.۲ بالاتر از زمین',
    materials: [
      { part: 'بدنه دودی', color: '#1f1b2e', roughness: 0.95, metalness: 0, note: 'سطح نرم با نویز — نیمه‌شفاف در لبه‌ها' },
      { part: 'هسته بنفش', color: '#a855f7', roughness: 0.15, metalness: 0, emissive: '#8b5cf6', emissiveIntensity: 2.0, note: 'قلب درخشان داخل بدنه' },
      { part: 'چشم‌ها', color: '#e9d5ff', roughness: 0.1, metalness: 0, emissive: '#c084fc', emissiveIntensity: 2.5 },
    ],
    details: ['۳ تا ۴ دنباله مخروطی دودی زیر بدنه', 'لبه‌های بالایی بدنه به بیرون موج می‌زند', 'هسته از داخل بدنه سوسو می‌زند (Emissive pulse در انیمیشن)'],
    polyBudgetTris: 8000,
    textureSize: 512,
    animations: ['Idle', 'Walk (شنا)', 'Attack', 'Hit', 'Death (تبخیر)'],
    vfxPoints: ['chestPoint (هسته)', 'hitPoint'],
    rigBones: ['Root', 'Core', 'Tendril.1..4', 'Eye.L/R'],
  },

  warrior: {
    specId: 'warrior',
    role: 'Dark Warrior — جنگجوی تاریکی',
    identity: 'جنگجوی تاریکی: کلاهخود با چشم‌های قرمز درخشان، زره صفحه‌ای تیره با لبه‌های قرمز، شمشیر پهن + سپر کوچک، پارچه آویزان',
    silhouette: 'انسان‌نمای زره‌پوش با شمشیر پهن و کلاهخود شاخدار — فرم مثلثی رو به بالا',
    bodyShape: 'انسان‌نما — تنومند ولی نه غول‌پیکر',
    proportions: '۷ سر — ارتفاع ۱.۸ واحد',
    materials: [
      { part: 'صفحات زره', color: '#3b3648', roughness: 0.5, metalness: 0.8 },
      { part: 'کلاهخود', color: '#2a2733', roughness: 0.45, metalness: 0.85 },
      { part: 'چشم‌ها', color: '#ff4444', roughness: 0.1, metalness: 0, emissive: '#ef4444', emissiveIntensity: 2.5 },
      { part: 'شمشیر', color: '#8a8f98', roughness: 0.3, metalness: 0.9 },
      { part: 'پارچه', color: '#4a1520', roughness: 0.9, metalness: 0 },
    ],
    details: ['کلاهخود با دو شاخ کوتاه', 'Pauldron لایه‌ای', 'Tabard قرمز تیره روی سینه', 'سپر کوچک با نشان تاریکی روی بازوی چپ'],
    polyBudgetTris: 12000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (ضربه شمشیر)', 'Hit', 'Death'],
    vfxPoints: ['weaponPoint (دست راست)', 'chestPoint', 'headPoint', 'hitPoint'],
    rigBones: HUMAN_RIG,
  },

  golem: {
    specId: 'golem',
    role: 'Stone Golem — غول سنگی',
    identity: 'غول سنگی: بلوک‌های سنگ واقعی با ترک‌های نورانی کهربایی، کریستال درخشان در سینه، مفاصل قابل باور، proportions سنگین',
    silhouette: 'مونولیت متحرک — بدنه چهارگوش عظیم، بازوهای ستون‌مانند که تا زمین می‌رسند',
    bodyShape: 'غیرانسان‌نما — torso سنگی بزرگ، بازوهای غول‌پیکر، پاهای کوتاه قدرتمند',
    proportions: '۵ سر — پهن ۱.۵ برابر ارتفاع، ارتفاع ۲.۶ واحد',
    materials: [
      { part: 'سنگ بدن', color: '#57534e', roughness: 0.95, metalness: 0, note: 'سطح سنگ با نویز Normal — هر بلوک فرم جدا' },
      { part: 'ترک‌های نورانی', color: '#f59e0b', roughness: 0.2, metalness: 0, emissive: '#f59e0b', emissiveIntensity: 1.8, note: 'ترک‌ها Emissive — انرژی درون سنگ' },
      { part: 'کریستال سینه', color: '#fbbf24', roughness: 0.15, metalness: 0.05, emissive: '#f59e0b', emissiveIntensity: 2.0 },
      { part: 'مفاصل', color: '#44403c', roughness: 0.85, metalness: 0.1 },
    ],
    details: [
      'لایه‌بندی سنگ‌ها: صفحه‌های همپوشان روی سینه و شانه',
      'ترک‌های عمیق با نور درونی از داخل',
      'کریستال شش‌وجهی فرورفته در سینه',
      'مفصل کروی قابل باور در شانه و ران',
      'دست‌ها مشت‌های سنگی بزرگ بدون انگشت مجزا (۳ انگشت توده‌ای)',
      'چشم‌ها شکاف‌های نورانی در سر سنگی',
    ],
    polyBudgetTris: 14000,
    textureSize: 1024,
    animations: ['Idle', 'Walk (سنگین)', 'Attack (مشت)', 'Hit', 'Death (فروپاشی)'],
    vfxPoints: ['chestPoint (کریستال)', 'headPoint', 'hitPoint'],
    rigBones: ['Root', 'Pelvis', 'Torso', 'Head', 'Shoulder.L/R', 'UpperArm.L/R', 'ForeArm.L/R', 'Fist.L/R', 'Hip.L/R', 'Thigh.L/R', 'Shin.L/R', 'Foot.L/R'],
  },

  spider: {
    specId: 'spider',
    role: 'Dark Spider — عنکبوت سایه',
    identity: 'عنکبوت سایه: بدن سگمنت‌شده دو‌بخشی، ۸ پا با مفاصل واقعی، هسته یخی فیروزه‌ای درخشان زیر شکم، چشم‌های چندتایی',
    silhouette: 'پهن و خزنده — بدن بیضی بزرگ پشتی با ۸ پای قوسی در دو ردیف',
    bodyShape: 'غیرانسان‌نما — Cephalothorax کوچک جلو + Abdomen بزرگ پشت',
    proportions: 'پهن ۱.۸ برابر ارتفاع — ارتفاع ۱.۱ واحد (کم‌ارتفاع و سریع)',
    materials: [
      { part: 'پوسته بدن', color: '#292524', roughness: 0.55, metalness: 0.3, note: 'Chitin براق با برجستگی‌های سگمنتی' },
      { part: 'هسته درخشان', color: '#22d3ee', roughness: 0.1, metalness: 0, emissive: '#22d3ee', emissiveIntensity: 2.0, note: 'زیر شکم — انرژی درونی' },
      { part: 'پاها', color: '#1c1917', roughness: 0.6, metalness: 0.25 },
      { part: 'چشم‌ها', color: '#a5f3fc', roughness: 0.1, metalness: 0, emissive: '#67e8f9', emissiveIntensity: 2.2, note: '۸ چشم کوچک در دو ردیف' },
    ],
    details: [
      '۸ پا هرکدام ۳ سگمنت با مفصل قابل باور (Coxa/Femur/Tibia)',
      'بدن دو‌سگمنتی با فاصله باریک',
      'Chelicera (نیش) جلوی سر',
      'ترک‌های نورانی روی Abdomen',
    ],
    polyBudgetTris: 11000,
    textureSize: 1024,
    animations: ['Idle', 'Walk (خزش ۸‌پا)', 'Attack (پرتاب/نیش)', 'Hit', 'Death (غلتیدن پاها به بالا)'],
    vfxPoints: ['mouthPoint', 'chestPoint (هسته)', 'hitPoint'],
    rigBones: ['Root', 'Body', 'Abdomen', 'Leg1A.L/R..Leg4A.L/R', 'Leg1B.L/R..Leg4B.L/R', 'Leg1C.L/R..Leg4C.L/R'],
  },

  warlock: {
    specId: 'warlock',
    role: 'Dark Mage — جادوگر تاریکی',
    identity: 'جادوگر تاریکی: ردای بلند بنفش تیره با کلاه (Hood)، عصای بلند با کریستال درخشان، صورت سایه‌ای با چشم‌های بنفش',
    silhouette: 'مخروط ردا + عصای بلند با گوی نورانی — سر پنهان در Hood',
    bodyShape: 'انسان‌نما پنهان در ردا — بدن واقعی زیر پارچه دیده نمی‌شود',
    proportions: '۶.۵ سر (ردا کشیده) — ارتفاع ۱.۹ واحد',
    materials: [
      { part: 'ردا', color: '#312e81', roughness: 0.92, metalness: 0, note: 'پارچه سنگین با چین‌های عمودی' },
      { part: 'Hood داخلی', color: '#1e1b3a', roughness: 0.95, metalness: 0, note: 'داخل کلاه کاملاً تاریک' },
      { part: 'کریستال عصا', color: '#8b5cf6', roughness: 0.1, metalness: 0, emissive: '#8b5cf6', emissiveIntensity: 2.2 },
      { part: 'عصا', color: '#1c1917', roughness: 0.8, metalness: 0.1, note: 'چوب خمیده با حکاکی رون' },
      { part: 'چشم‌ها', color: '#c4b5fd', roughness: 0.1, metalness: 0, emissive: '#a78bfa', emissiveIntensity: 2.4 },
    ],
    details: ['حاشیه طلایی کهنه دور ردا', 'رون‌های شناور دور کریستال عصا', 'دست استخوانی از آستین بیرون‌زده', 'پای ردا بدون پا — کشیده تا زمین'],
    polyBudgetTris: 10000,
    textureSize: 1024,
    animations: ['Idle', 'Walk (لغزانی)', 'Attack (پرتاب جادو)', 'Hit', 'Death (فروپاشی به دود)'],
    vfxPoints: ['staffPoint (نوک کریستال عصا)', 'weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
    rigBones: HUMAN_RIG,
  },

  flyer: {
    specId: 'flyer',
    role: 'Flying Shadow — پرنده سایه',
    identity: 'پرنده سایه: بدن دودی کشیده، دو بال بزرگ نیمه‌شفاف با لبه نورانی، دم بلند باریک، چشم‌های بنفش',
    silhouette: 'صیاد آسمانی — V بال‌های باز، دم بلند — کاملاً متفاوت از دشمنان زمینی',
    bodyShape: 'غیرانسان‌نما — بدن جریان‌دار (Aerodynamic) با بال‌های پارچه‌ای دودی',
    proportions: 'دهانه بال ۲.۲ برابر طول بدن — ارتفاع ۱.۵ واحد (شناور در ارتفاع ۵.۵)',
    materials: [
      { part: 'بدن', color: '#1e1b2e', roughness: 0.9, metalness: 0 },
      { part: 'غشای بال', color: '#2a2342', roughness: 0.85, metalness: 0, note: 'نیمه‌شفاف — opacity 0.85' },
      { part: 'لبه بال', color: '#c084fc', roughness: 0.2, metalness: 0, emissive: '#a855f7', emissiveIntensity: 1.5 },
      { part: 'چشم‌ها', color: '#e9d5ff', roughness: 0.1, metalness: 0, emissive: '#c084fc', emissiveIntensity: 2.4 },
    ],
    details: ['استخوان‌های بال قابل مشاهده زیر غشا', 'دم سه‌شاخه دودی', 'شاخ‌های خمیده کوچک'],
    polyBudgetTris: 9000,
    textureSize: 512,
    animations: ['Idle (بال‌زدن شناور)', 'Walk = پرواز', 'Attack (شارژ هوایی)', 'Hit', 'Death (سقوط)'],
    vfxPoints: ['chestPoint', 'hitPoint'],
    rigBones: ['Root', 'Body', 'Wing.L/R (2 segment)', 'Tail.1..3', 'Head', 'Jaw'],
  },

  // -------- محتوای آینده --------
  warMachine: {
    specId: 'warMachine',
    role: 'War Machine — ماشین جنگی تاریکی',
    identity: 'ماشین جنگی: شاسی فلزی چهار‌پای مکانیکی، تفکر تیره با گیره‌های باز، چراغ قرمز خط جلو، بخار و پیستون',
    silhouette: 'چاهور متحرک — بدنه فلزی زاویه‌دار با ۴ پای مکانیکی و توپ بزرگ جلو',
    bodyShape: 'مکانیکی — بدنه زاویه‌دار، پای مکانیکی دو‌مفصلی',
    proportions: 'پهن ۱.۶ برابر ارتفاع — ارتفاع ۲.۲ واحد',
    materials: [
      { part: 'شاسی فلزی', color: '#3d4450', roughness: 0.45, metalness: 0.9 },
      { part: 'چراغ خط', color: '#ff5544', roughness: 0.1, metalness: 0, emissive: '#ef4444', emissiveIntensity: 2.0 },
      { part: 'پای مکانیکی', color: '#2a2e36', roughness: 0.5, metalness: 0.85 },
      { part: 'لوله توپ', color: '#22262e', roughness: 0.35, metalness: 0.9 },
    ],
    details: ['پیستون‌های متحرک در مفاصل', 'پرچ و صفحه فلزی لایه‌ای', 'دهانه توپ با درخشش داخلی'],
    polyBudgetTris: 15000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (شلیک)', 'Hit', 'Death (انفجار قطعات)'],
    vfxPoints: ['muzzlePoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  aetherTank: {
    specId: 'aetherTank',
    role: 'Aether Tank — تانک انرژی تاریک',
    identity: 'تانک اثری: بدنه زره‌ای سنگین با هسته اثری آبی درخشان در مرکز، شنی‌های جادویی، سپر انرژی اطراف',
    silhouette: 'جعبه زرهی عریض با هسته درخشان مرکز — فرم دفاعی و سنگین',
    bodyShape: 'مکانیکی — بدنه boxy با زره شیاردار',
    proportions: 'پهن ۱.۹ برابر ارتفاع — ارتفاع ۲.۴ واحد',
    materials: [
      { part: 'زره بدنه', color: '#2f3540', roughness: 0.5, metalness: 0.85 },
      { part: 'هسته اثری', color: '#38bdf8', roughness: 0.15, metalness: 0, emissive: '#0ea5e9', emissiveIntensity: 2.2 },
      { part: 'شنی', color: '#1f2329', roughness: 0.7, metalness: 0.4 },
    ],
    details: ['شیارهای زره با نور آبی بین‌شان', 'هسته کروی در قاب طلایی-تیره', 'اگزوز با ذرات انرژی'],
    polyBudgetTris: 15000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (شلیک پلاسما)', 'Hit', 'Death'],
    vfxPoints: ['muzzlePoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  smallDragon: {
    specId: 'smallDragon',
    role: 'Small Dragon — اژدهای کوچک',
    identity: 'اژدهای کوچک: فلس‌های تیره، بال‌های غشایی، شاخ و پنجه، دم بلند، هسته آتشین در سینه',
    silhouette: 'کلاسیک اژدها — S گردن، بال‌های بزرگ، دم بلند',
    bodyShape: 'غیرانسان‌نما — آناتومی اژدهای قابل باور',
    proportions: 'طول ۲ برابر ارتفاع — ارتفاع ۲.۸ واحد',
    materials: [
      { part: 'فلس', color: '#3f2a35', roughness: 0.6, metalness: 0.35, note: 'فلس‌های همپوشان دو ردیف' },
      { part: 'غشای بال', color: '#6b2740', roughness: 0.8, metalness: 0, note: 'نیمه‌شفاف با رگبال' },
      { part: 'هسته آتشین', color: '#fb923c', roughness: 0.2, metalness: 0, emissive: '#f97316', emissiveIntensity: 2.0 },
      { part: 'چشم‌ها', color: '#fdba74', roughness: 0.1, metalness: 0, emissive: '#fb923c', emissiveIntensity: 2.4 },
    ],
    details: ['شاخ‌های خمیده به عقب', 'رگبال‌های قابل مشاهده', 'پنجه‌های سه‌چنگ', 'خارهای پشتی از گردن تا دم'],
    polyBudgetTris: 16000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (گاز+نفس)', 'Hit', 'Death'],
    vfxPoints: ['mouthPoint (نفس آتش)', 'chestPoint', 'hitPoint'],
  },

  crystalMonster: {
    specId: 'crystalMonster',
    role: 'Crystal Monster — هیولای کریستالی',
    identity: 'هیولای کریستالی: بدن سنگی با خوشه‌های کریستال فیروزه‌ای روی شانه/پشت/بازو، هسته درخشان مرکز',
    silhouette: 'توده سنگی نامتقارن با شاخه‌های کریستالی — مثل خارها بیرون زده',
    bodyShape: 'غیرانسان‌نما — توده‌ای با کریستال‌های زاویه‌دار',
    proportions: 'پهن ۱.۴ برابر — ارتفاع ۱.۷ واحد',
    materials: [
      { part: 'بدنه سنگی', color: '#4b4741', roughness: 0.9, metalness: 0.05 },
      { part: 'کریستال', color: '#67e8f9', roughness: 0.1, metalness: 0.05, emissive: '#22d3ee', emissiveIntensity: 1.8, note: 'appearance نیمه‌شفاف' },
    ],
    details: ['۵ تا ۷ خوشه کریستالی با زوایای متفاوت', 'ترک‌های نورانی بین سنگ‌ها', 'هسته در حفره سینه'],
    polyBudgetTris: 10000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (شلاق کریستال)', 'Hit', 'Death (شکستن)'],
    vfxPoints: ['chestPoint', 'headPoint', 'hitPoint'],
  },

  hunter: {
    specId: 'hunter',
    role: 'Hunter — شکارچی تاریکی',
    identity: 'شکارچی: زره چرمی خزنده، تیربار دو‌شاخه، نقاب سبک، پارچه‌های آویزان، چشم سبز درخشان',
    silhouette: 'خمیده و چابک — فرم دویدن، سلاح بلند دو‌شاخه',
    bodyShape: 'انسان‌نما خمیده — فرم پیش‌رونده',
    proportions: '۷ سر خمیده — ارتفاع ۱.۸ واحد',
    materials: [
      { part: 'زره چرمی', color: '#33302b', roughness: 0.8, metalness: 0.15 },
      { part: 'سلاح', color: '#2a2e36', roughness: 0.4, metalness: 0.85 },
      { part: 'چشم‌ها', color: '#a3e635', roughness: 0.1, metalness: 0, emissive: '#84cc16', emissiveIntensity: 2.2 },
    ],
    details: ['نقاب استخوانی نیم‌چهره', 'تسمه‌های چرمی متقاطع', 'پارچه‌های نوار‌مانند آویزان از کمربند'],
    polyBudgetTris: 11000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack', 'Hit', 'Death'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  destroyer: {
    specId: 'destroyer',
    role: 'Destroyer — نابودگر',
    identity: 'نابودگر: زره جهنمی قرمز-تیره، دو بازوی غول‌پیکر مکانیکی، شعله از مفاصل، اندام هراس‌انگیز',
    silhouette: 'غول دو‌بازوی مکانیکی — فرم V با شعله از شانه‌ها',
    bodyShape: 'انسان‌نما مهندسی‌شده — بازوهای غول‌پیکر، بدن کوچک‌تر',
    proportions: '۵.۵ سر — ارتفاع ۲.۳ واحد',
    materials: [
      { part: 'زره', color: '#3d1f1f', roughness: 0.5, metalness: 0.8 },
      { part: 'شعله مفاصل', color: '#f97316', roughness: 0.15, metalness: 0, emissive: '#f97316', emissiveIntensity: 2.2 },
      { part: 'بازوی مکانیکی', color: '#26221f', roughness: 0.45, metalness: 0.9 },
    ],
    details: ['دودکش‌های شعله روی شانه', 'مشت‌های غول‌پیکر با میخ', 'هسته گداخته در سینه'],
    polyBudgetTris: 15000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (ضربه زمین)', 'Hit', 'Death'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  summoner: {
    specId: 'summoner',
    role: 'Summoner — احضارکننده',
    identity: 'احضارکننده: ردای تشریفاتی بنفش-طلایی، حلقه احضار شناور دور دست، عصا با جمجمه درخشان',
    silhouette: 'مخروط ردا با حلقه‌های جادویی شناور — مجلل‌تر از جادوگر معمولی',
    bodyShape: 'انسان‌نما پنهان در ردا',
    proportions: '۶.۵ سر — ارتفاع ۱.۹ واحد',
    materials: [
      { part: 'ردا', color: '#4c1d95', roughness: 0.9, metalness: 0 },
      { part: 'حاشیه طلایی', color: '#d4a017', roughness: 0.3, metalness: 0.9 },
      { part: 'حلقه احضار', color: '#a78bfa', roughness: 0.1, metalness: 0, emissive: '#8b5cf6', emissiveIntensity: 2.0 },
    ],
    details: ['حلقه‌های رونی شناور دور عصا', 'جمجمه کریستالی نوک عصا', 'چین‌های مجلل ردا'],
    polyBudgetTris: 12000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (احضار)', 'Hit', 'Death'],
    vfxPoints: ['staffPoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  spirit: {
    specId: 'spirit',
    role: 'Spirit — روح سرگردان',
    identity: 'روح: بدن نیمه‌شفاف آبی-سبز، دنباله محو به پایین، حلقه‌های انرژی، صورت بی‌چهره با چشم‌های نورانی',
    silhouette: 'شبح شناور محو‌شونده به پایین — بدون پا',
    bodyShape: 'غیرانسان‌نما — نیم‌تنه شناور با دنباله',
    proportions: 'ارتفاع ۱.۵ واحد — شناور',
    materials: [
      { part: 'بدن روح', color: '#93c5fd', roughness: 0.3, metalness: 0, emissive: '#60a5fa', emissiveIntensity: 0.9, note: 'شفافیت 0.7 — Additive feel' },
      { part: 'چشم‌ها', color: '#e0f2fe', roughness: 0.1, metalness: 0, emissive: '#7dd3fc', emissiveIntensity: 2.5 },
    ],
    details: ['لبه‌های بدن موجی و محو', 'ذرات نوری اطراف بدن', 'دست‌های نیمه‌شفاف'],
    polyBudgetTris: 7000,
    textureSize: 512,
    animations: ['Idle', 'Walk (شنا)', 'Attack', 'Hit', 'Death (تبخیر)'],
    vfxPoints: ['chestPoint', 'hitPoint'],
  },

  shadowSoldier: {
    specId: 'shadowSoldier',
    role: 'Shadow Soldier — سرباز سایه',
    identity: 'سرباز سایه: زره تیره ساده‌تر از جنگجو، نیزه سایه، شانه‌های دودی، چشم بنفش',
    silhouette: 'پیاده‌نظام سایه — نیزه بلند، فرم منظم',
    bodyShape: 'انسان‌نما — لاغرتر از جنگجوی تاریکی',
    proportions: '۷ سر — ارتفاع ۱.۷۵ واحد',
    materials: [
      { part: 'زره', color: '#2c2836', roughness: 0.55, metalness: 0.7 },
      { part: 'نیزه سایه', color: '#1e1b2e', roughness: 0.4, metalness: 0.3, emissive: '#7c3aed', emissiveIntensity: 0.8 },
      { part: 'چشم‌ها', color: '#ddd6fe', roughness: 0.1, metalness: 0, emissive: '#a78bfa', emissiveIntensity: 2.2 },
    ],
    details: ['کلاهخود ساده بدون شاخ', 'پارچه آویزان از شانه', 'نیزه با نوک انرژی سایه'],
    polyBudgetTris: 9000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (نیزه)', 'Hit', 'Death'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  annihilator: {
    specId: 'annihilator',
    role: 'Annihilator — محوکننده',
    identity: 'محوکننده: توپخانه متحرک تاریکی — بدنه زرهی با چهار بازوی توپ، هسته تاریک، حرکت لرزان سنگین',
    silhouette: 'قلعه متحرک توپخانه — چهار لوله رو به جلو',
    bodyShape: 'مکانیکی سنگین',
    proportions: 'پهن ۲ برابر — ارتفاع ۲.۶ واحد',
    materials: [
      { part: 'زره', color: '#26222b', roughness: 0.5, metalness: 0.85 },
      { part: 'هسته تاریک', color: '#7c3aed', roughness: 0.15, metalness: 0, emissive: '#6d28d9', emissiveIntensity: 2.0 },
      { part: 'لوله‌ها', color: '#1c1917', roughness: 0.35, metalness: 0.9 },
    ],
    details: ['چهار لوله توپ هم‌زمان', 'شیارهای زره با نور بنفش', 'بخار تاریک از اگزوز'],
    polyBudgetTris: 16000,
    textureSize: 1024,
    animations: ['Idle', 'Walk', 'Attack (رگبار)', 'Hit', 'Death (انفجار)'],
    vfxPoints: ['muzzlePoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  // ============================ Boss‌ها ============================
  golemKing: {
    specId: 'golemKing',
    role: 'Stone Golem King — Boss مرحله ۱',
    identity: 'نسخه سلطنتی غول سنگی: تاج سنگی-طلایی، کریستال آذر غول‌پیکر سینه، زره سنگی لایه‌ای، proportions ۲.۲ برابر — باید Boss به نظر برسد',
    silhouette: 'غول سنگی + تاج + کریستال غول — عظیم‌تر و مجلل‌تر',
    bodyShape: 'مثل golem با جزئیات بیشتر — تاج، شانه‌پوش سنگی، مشت‌های غول',
    proportions: '۴.۵ سر عظیم — ارتفاع پایه ۲.۶ (× scale 2.2 = ۵.۷ واحد جهانی)',
    materials: [
      { part: 'سنگ سلطنتی', color: '#44403c', roughness: 0.92, metalness: 0.05 },
      { part: 'تاج/شاخ', color: '#b45309', roughness: 0.35, metalness: 0.85 },
      { part: 'کریستال آذر', color: '#fbbf24', roughness: 0.12, metalness: 0, emissive: '#f59e0b', emissiveIntensity: 2.4, note: '۴ برابر کریستال غول معمولی' },
      { part: 'ترک‌ها', color: '#f97316', roughness: 0.2, metalness: 0, emissive: '#f97316', emissiveIntensity: 1.8, note: 'در فاز ۲ شدت ×۲' },
    ],
    details: [
      'تاج سنگی تراش‌خورده با ۵ بلوک',
      'شانه‌پوش سنگی لایه‌ای با حکاکی رون',
      'کریستال آذر بزرگ در قFrame طلایی سینه',
      'مشت‌های غول با میخ‌های سنگی',
      'دستبندهای سنگی با نور درون',
    ],
    polyBudgetTris: 45000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Attack1 (مشت راست)', 'Attack2 (ضربه دوتایی)', 'SpecialAttack (Slam زمین)', 'Roar', 'Hit', 'PhaseChange (فریاد+ترک‌های درخشان)', 'Death (فروپاشی)'],
    vfxPoints: ['chestPoint (کریستال)', 'headPoint', 'hitPoint', 'weaponPoint (مشت راست)'],
    rigBones: ['Root', 'Pelvis', 'Torso', 'Chest', 'Head', 'Jaw', 'Shoulder.L/R', 'UpperArm.L/R', 'ForeArm.L/R', 'Fist.L/R', 'Hip.L/R', 'Thigh.L/R', 'Shin.L/R', 'Foot.L/R'],
  },

  fireGiant: {
    specId: 'fireGiant',
    role: 'Fire Giant — Boss آتش',
    identity: 'غول آتش: بدن گداخته با ترک‌های آتشین، زره سنگی سوخته، پتک آتشین عظیم، موهای شعله',
    silhouette: 'غول انسانی عظیم با پتک آتشین — شعله از شانه و پشت',
    bodyShape: 'انسان‌نما غول‌پیکر',
    proportions: '۴ سر — ارتفاع ۳.۶ واحد',
    materials: [
      { part: 'پوست گداخته', color: '#3d1f1a', roughness: 0.85, metalness: 0.05, note: 'ترک‌های آتشین emissive روی کل بدن' },
      { part: 'ترک‌های آتش', color: '#f97316', roughness: 0.2, metalness: 0, emissive: '#ea580c', emissiveIntensity: 2.2 },
      { part: 'زره', color: '#2b211c', roughness: 0.55, metalness: 0.7 },
      { part: 'پتک', color: '#1f1a17', roughness: 0.4, metalness: 0.85, note: 'سر پتک گداخته emissive' },
    ],
    details: ['موهای شعله‌ای', 'شعله از شانه‌ها و پشت', 'زنجیرهای شکسته روی بدن', 'پتک دو‌دسته عظیم'],
    polyBudgetTris: 45000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Attack1', 'Attack2', 'SpecialAttack (بارش آتش)', 'Roar', 'Hit', 'PhaseChange', 'Death'],
    vfxPoints: ['mouthPoint', 'chestPoint', 'headPoint', 'hitPoint', 'weaponPoint'],
  },

  iceGiant: {
    specId: 'iceGiant',
    role: 'Ice Giant — Boss یخ',
    identity: 'غول یخ: بدن یخی شفاف‌نما با ترک‌های آبی درخشان، زخم‌های یخی، تبر یخی عظیم، یخ‌زدگی اطراف پاها',
    silhouette: 'غول کریستالی یخی — لبه‌های تیز یخ در همه‌جا',
    bodyShape: 'انسان‌نما غول‌پیکر با فرم کریستالی',
    proportions: '۴ سر — ارتفاع ۳.۶ واحد',
    materials: [
      { part: 'یخ بدن', color: '#93c5fd', roughness: 0.15, metalness: 0.05, note: 'نیمه‌شفاف با عمق کریستالی' },
      { part: 'ترک‌های نورانی', color: '#67e8f9', roughness: 0.1, metalness: 0, emissive: '#22d3ee', emissiveIntensity: 1.8 },
      { part: 'تبر یخی', color: '#bae6fd', roughness: 0.1, metalness: 0.05 },
    ],
    details: ['تیغه‌های یخی از شانه و بازو', 'بخار سرد از دهان', 'قطعات یخ شناور دور بدن'],
    polyBudgetTris: 45000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Attack1', 'Attack2', 'SpecialAttack (زمستان)', 'Roar', 'Hit', 'PhaseChange', 'Death'],
    vfxPoints: ['mouthPoint', 'chestPoint', 'headPoint', 'hitPoint', 'weaponPoint'],
  },

  blackDragon: {
    specId: 'blackDragon',
    role: 'Black Dragon — Boss اژدها',
    identity: 'اژدهای سیاه: فلس‌های مشکی براق، چشم‌های بنفش، بال‌های عظیم غشایی، نفس سایه، شاخ‌های خمیده، anatomy کاملاً اژدهایی',
    silhouette: 'اژدهای کلاسیک عظیم — بال‌های عظیم، گردن S، دم بلند با تیغه',
    bodyShape: 'غیرانسان‌نما — آناتومی کامل اژدها (گردن/تنه/دو بال/دو پا/دم)',
    proportions: 'طول ۲.۵ برابر ارتفاع — ارتفاع ۴.۵ واحد',
    materials: [
      { part: 'فلس مشکی', color: '#181420', roughness: 0.4, metalness: 0.6, note: 'فلس‌های همپوشان با ردیف‌های منظم' },
      { part: 'غشای بال', color: '#3b1d4e', roughness: 0.75, metalness: 0, note: 'نیمه‌شفاف با رگبال بنفش' },
      { part: 'چشم‌ها', color: '#c084fc', roughness: 0.1, metalness: 0, emissive: '#a855f7', emissiveIntensity: 2.6 },
      { part: 'نفس سایه', color: '#8b5cf6', roughness: 0.1, metalness: 0, emissive: '#7c3aed', emissiveIntensity: 2.0, note: 'دهان — glow داخلی' },
    ],
    details: [
      'شاخ‌های خمیده به عقب + شاخ‌های پیشانی',
      'رگبال‌های قابل مشاهده (۶ رگبال هر بال)',
      'تیغه انتهای دم',
      'خارهای پشتی از گردن تا دم',
      'پنجه‌های چنگالی سه‌بخشی',
      'فلس‌های شکم روشن‌تر',
    ],
    polyBudgetTris: 60000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Attack1 (گاز)', 'Attack2 (چنگ)', 'SpecialAttack (نفس سایه)', 'Roar', 'Hit', 'PhaseChange (پرواز کوتاه)', 'Death'],
    vfxPoints: ['mouthPoint (نفس)', 'chestPoint', 'headPoint', 'hitPoint'],
    rigBones: ['Root', 'Spine.1..4', 'Neck.1..3', 'Head', 'Jaw', 'Wing.L/R (3 segment)', 'Leg.L/R (3 segment)', 'Tail.1..5'],
  },

  darkLord: {
    specId: 'darkLord',
    role: 'Dark Lord — Final Boss بازی',
    identity: 'ارباب تاریکی: زره جهنمی مجلل با لبه‌های بنفش، شمشیر سایه عظیم، شنل غول‌آسا، تاج شاخ‌دار، هسته تاریک سینه — باید Final Boss واقعی به نظر برسد',
    silhouette: 'فرمانده تاریکی عظیم — شنل بلند، شمشیر سایه غول، شاخ‌های تاج',
    bodyShape: 'انسان‌نما heroic غول‌پیکر با زره کاملاً مجلل',
    proportions: '۵ سر — ارتفاع ۴.۲ واحد',
    materials: [
      { part: 'زره جهنمی', color: '#1a1526', roughness: 0.4, metalness: 0.85 },
      { part: 'لبه‌های بنفش', color: '#a855f7', roughness: 0.2, metalness: 0.3, emissive: '#8b5cf6', emissiveIntensity: 2.0 },
      { part: 'شمشیر سایه', color: '#2a2342', roughness: 0.3, metalness: 0.5, emissive: '#7c3aed', emissiveIntensity: 1.5, note: 'تیغه با لبه انرژی سایه' },
      { part: 'شنل', color: '#150f1e', roughness: 0.95, metalness: 0 },
      { part: 'هسته تاریک', color: '#7c3aed', roughness: 0.1, metalness: 0, emissive: '#6d28d9', emissiveIntensity: 2.4 },
    ],
    details: [
      'تاج شاخ‌دار سه‌شاخ',
      'شنل غول‌آسا با حاشیه رون‌دار',
      'صفحات شناور دور بدن (۵ قطعه)',
      'شمشیر دو‌دسته با شکاف انرژی',
      'هسته تاریک تپنده در سینه',
    ],
    polyBudgetTris: 55000,
    textureSize: 2048,
    animations: ['Idle', 'Walk', 'Attack1', 'Attack2', 'SpecialAttack (طوفان سایه)', 'Roar', 'Hit', 'PhaseChange', 'Death'],
    vfxPoints: ['weaponPoint', 'chestPoint', 'headPoint', 'hitPoint'],
  },

  // ============================ برج‌ها ============================
  sentinel: {
    specId: 'sentinel',
    role: 'Sentinel Tower — برج نگهبان',
    identity: 'برجک توپ مسلسل: پایه فلزی مدرن، برجک چرخان با لوله دوقلو در سطوح بالا، نوار نوری آذری',
    silhouette: 'برج نظامی مدرن — پایه هرمی-استوانه‌ای + برجک گرد چرخان',
    bodyShape: 'سازه دفاعی — پایه + برجک جدا (Turret node جداگانه برای چرخش)',
    proportions: 'ارتفاع ۳.۲ واحد، شعاع پایه ۱.۸',
    materials: [
      { part: 'پایه فلزی', color: '#4a4f58', roughness: 0.4, metalness: 0.7 },
      { part: 'برجک', color: '#565f6e', roughness: 0.45, metalness: 0.75 },
      { part: 'لوله', color: '#22262e', roughness: 0.3, metalness: 0.85 },
      { part: 'نوار آذری', color: '#ffb020', roughness: 0.2, metalness: 0.1, emissive: '#ff9d00', emissiveIntensity: 1.6 },
    ],
    details: ['گره Turret جدا با نام turret (برای چرخش به هدف)', 'گره muzzlePoint نوک لوله', 'کریستال سطح ۵ با نام spinCrystal'],
    polyBudgetTris: 18000,
    textureSize: 1024,
    animations: [],
    vfxPoints: ['muzzlePoint'],
  },
  lightning: {
    specId: 'lightning',
    role: 'Lightning Tower — برج صاعقه',
    identity: 'ستون کریستالی بنفش با هسته شناور و کره‌های رسانا',
    silhouette: 'ستون شش‌ضلعی + کریستال شناور نوک',
    bodyShape: 'سازه — ستون + هسته شناور (نام node: spinCrystal)',
    proportions: 'ارتفاع ۴.۴ واحد',
    materials: [
      { part: 'ستون سنگ تیره', color: '#2b2838', roughness: 0.7, metalness: 0.3 },
      { part: 'کریستال', color: '#c084fc', roughness: 0.15, metalness: 0, emissive: '#a855f7', emissiveIntensity: 2.0 },
    ],
    details: ['کره‌های رسانا اطراف', 'حلقه سطح ۳+', 'هسته شناور با نام spinCrystal'],
    polyBudgetTris: 14000,
    textureSize: 1024,
    animations: [],
    vfxPoints: ['chestPoint'],
  },
  fire: {
    specId: 'fire',
    role: 'Fire Tower — برج آتش',
    identity: 'خمپاره آتشین سنگی با مشعل‌های اطراف و ember درخشان',
    silhouette: 'پایه سنگی + لوله خمپاره زاویه‌دار',
    bodyShape: 'سازه — پایه + خمپاره (node: turret)',
    proportions: 'ارتفاع ۲.۹ واحد',
    materials: [
      { part: 'سنگ', color: '#4d3f36', roughness: 0.9, metalness: 0.05 },
      { part: 'لوله فلزی', color: '#33302e', roughness: 0.4, metalness: 0.6 },
      { part: 'ember', color: '#fdba74', roughness: 0.2, metalness: 0, emissive: '#f97316', emissiveIntensity: 2.0 },
    ],
    details: ['مشعل‌های دو طرف', 'حلقه آتش سطح ۵', 'node: muzzlePoint دهانه خمپاره'],
    polyBudgetTris: 14000,
    textureSize: 1024,
    animations: [],
    vfxPoints: ['muzzlePoint'],
  },
  ice: {
    specId: 'ice',
    role: 'Ice Tower — برج یخ',
    identity: 'خوشه کریستال یخی با کریستال اصلی شناور و خوشه‌های فرعی',
    silhouette: 'مخروط سنگی + خوشه کریستال یخی نوک',
    bodyShape: 'سازه — مخروط + کریستال (node: spinCrystal)',
    proportions: 'ارتفاع ۴.۵ واحد',
    materials: [
      { part: 'مخروط سنگی', color: '#37505c', roughness: 0.7, metalness: 0.2 },
      { part: 'کریستال یخ', color: '#a5f3fc', roughness: 0.12, metalness: 0.05, emissive: '#22d3ee', emissiveIntensity: 0.9, note: 'appearance نیمه‌شفاف' },
    ],
    details: ['۳ خوشه فرعی', 'حلقه یخ سطح ۵', 'کریستال اصلی نام node: spinCrystal'],
    polyBudgetTris: 14000,
    textureSize: 1024,
    animations: [],
    vfxPoints: ['chestPoint'],
  },
};
