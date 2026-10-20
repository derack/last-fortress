// ============================================================
// PHASE 7 — 100 Stage Balance Audit
// شبیه‌سازی داده‌محور: برای هر مرحله HP مؤثر موج‌ها (با tier و
// زره) و اقتصاد موجود قبل از اوج را می‌سنجد؛ R = اوج فشار / اقتصاد
// منحنی سالم باید: مرحله ۱ آسان، رشد تدریجی، بدون پرتگاه tier،
// Bossها اوج منطقی، مرحله ۱۰۰ سخت‌ترین باشد.
// اجرا: bun scripts/balance-audit.ts
// ============================================================
import { STAGES, CHAPTERS } from '../src/game/data/campaign';
import { ENEMIES, tiered } from '../src/game/data/enemies';

interface Row {
  id: string; D: number; paths: number;
  startCoins: number; coreHp: number;
  waveHp: number[]; // HP مؤثر هر موج (غیر Boss)
  bossWaveHp: number; bossHp: number;
  peakWave: number; peakHp: number;
  totalHp: number;
  incomeBeforePeak: number; // سکه شروع + پاداش موج‌ها + جایزه کشتار تا قبل از موج اوج
  R: number; // peakEffectiveHp / incomeBeforePeak × ۱۰۰
  enemyKinds: number; // تنوع دشمنان استفاده‌شده
}

const ARMOR_K = 0.7; // جادو/فیزیک ترکیبی — زره مؤثر ≈ ۷۰٪ زره اسمی
const REF_HIT = 45; // ضربه نماینده برج میانه — زره flat، HP مؤثر = hp×REF/(REF−armor)

function effHpOf(data: { hp: number; armor: number }, hp: number): number {
  const a = data.armor * ARMOR_K;
  return hp * (REF_HIT / Math.max(8, REF_HIT - a));
}

function stageRow(cIdx: number, s: number): Row {
  const ch = CHAPTERS[cIdx];
  const lv = STAGES[`c${ch.id}s${s}`];
  const waveHp: number[] = [];
  let bossWaveHp = 0, bossHp = 0, totalHp = 0;
  const kinds = new Set<string>();
  let killIncome = 0;
  const perWaveKill: number[] = [];

  for (const w of lv.waves) {
    let hp = 0, income = 0;
    for (const g of w.groups) {
      const data = ENEMIES[g.enemy];
      if (!data) continue;
      const t = tiered(data, g.tier);
      const eff = effHpOf(data, t.hp);
      hp += g.count * eff;
      income += g.count * t.reward;
      kinds.add(g.enemy);
    }
    if (w.boss) {
      bossWaveHp = hp;
      const bg = w.groups.find((g) => ENEMIES[g.enemy]?.boss);
      bossHp = bg ? tiered(ENEMIES[bg.enemy], bg.tier).hp : 0;
    } else {
      waveHp.push(hp);
      perWaveKill.push(income);
    }
    totalHp += hp;
    killIncome += income;
  }

  const peakIdx = waveHp.reduce((m, v, i) => (v > waveHp[m] ? i : m), 0);
  const peakHp = waveHp[peakIdx];
  let incomeBeforePeak = lv.startCoins + killIncome;
  // پاداش موج‌ها تا قبل از موج اوج (پاداش موج در ابتدای همان موج داده می‌شود)
  for (let i = 0; i < peakIdx; i++) incomeBeforePeak += lv.waves[i].coinBonus ?? 0;

  return {
    id: lv.id, D: (ch.id - 1) * 10 + s, paths: (lv.paths?.length ?? 1),
    startCoins: lv.startCoins, coreHp: lv.coreHp,
    waveHp, bossWaveHp, bossHp,
    peakWave: peakIdx + 1, peakHp,
    totalHp,
    incomeBeforePeak,
    R: (peakHp / incomeBeforePeak) * 100,
    enemyKinds: kinds.size,
  };
}

const rows: Row[] = [];
for (let c = 0; c < 10; c++) for (let s = 1; s <= 10; s++) rows.push(stageRow(c, s));

// ---------- گزارش ----------
console.log('D   stage   paths coins core  peakW  peakHP      bossHP   income  R(٪)  kinds');
for (const r of rows) {
  console.log(
    String(r.D).padStart(3), r.id.padEnd(6), `p${r.paths}`, String(r.startCoins).padStart(4),
    String(r.coreHp).padStart(4), String(r.peakWave).padStart(4),
    String(Math.round(r.peakHp)).padStart(8), String(Math.round(r.bossHp)).padStart(8),
    String(Math.round(r.incomeBeforePeak)).padStart(7), r.R.toFixed(1).padStart(5), String(r.enemyKinds).padStart(3),
  );
}

// ---------- تشخیص مشکلات ----------
console.log('\n==================== ANALYSIS ====================');
const st1 = rows[0];
console.log(`Stage 1: peakWaveHP=${Math.round(st1.peakHp)} income=${st1.incomeBeforePeak} R=${st1.R.toFixed(1)}٪ (باید آسان باشد R پایین)`);
const last = rows[rows.length - 1];
console.log(`Stage 100: peakWaveHP=${Math.round(last.peakHp)} R=${last.R.toFixed(1)}٪`);

// پرتگاه‌های相邻 — نسبت R دو مرحله متوالی
console.log('\n--- جهش‌های بزرگ R بین مراحل متوالی (نسبت > ۱٫۳۵) ---');
for (let i = 1; i < rows.length; i++) {
  const ratio = rows[i].R / rows[i - 1].R;
  if (ratio > 1.35) {
    console.log(`D${rows[i - 1].D}→D${rows[i].D} (${rows[i - 1].id}→${rows[i].id}): R ×${ratio.toFixed(2)}  [peakHP ${Math.round(rows[i - 1].peakHp)}→${Math.round(rows[i].peakHp)}]`);
  }
}

// کاهش غیرمنتظره درون فصل (به‌جز مرز فصل که Boss سخت‌تر دارد)
console.log('\n--- افت R درون فصل (مرحله بعدی آسان‌تر از -۲۵٪) ---');
for (let i = 1; i < rows.length; i++) {
  if (rows[i].D % 10 === 1) continue; // شروع فصل جدید
  const ratio = rows[i].R / rows[i - 1].R;
  if (ratio < 0.75) {
    console.log(`D${rows[i - 1].D}→D${rows[i].D}: R ×${ratio.toFixed(2)} (افت غیرمنتظره)`);
  }
}

// اوج Boss نسبت به موج ۹ همان مرحله
console.log('\n--- Boss ضعیف‌تر از موج ۹ (اوج Boss باید باشد) ---');
for (const r of rows) {
  const w9 = r.waveHp[8];
  if (r.bossWaveHp < w9 * 1.15) {
    console.log(`${r.id}: bossWave ${Math.round(r.bossWaveHp)} ≤ موج۹ ${Math.round(w9)} ×1.15`);
  }
}

// آمار فصل‌ها
console.log('\n--- میانگین R هر فصل (شیب کلی) ---');
for (let c = 1; c <= 10; c++) {
  const sub = rows.filter((r) => r.D > (c - 1) * 10 && r.D <= c * 10);
  const avg = sub.reduce((a, r) => a + r.R, 0) / sub.length;
  const mx = Math.max(...sub.map((r) => r.R));
  console.log(`فصل ${c}: میانگین R=${avg.toFixed(1)}٪  حداکثر=${mx.toFixed(1)}٪`);
}
