// تست واحد v2.2 — قفل قدرت برج + جادوی سکه‌ای + جعبه ۳ ستاره
import { TOWERS } from '../src/game/data/towers';
import { MAGIC } from '../src/game/data/magic';
import { rollChest } from '../src/game/data/chest';

let pass = 0, fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

console.log('━━ ۱. جادو: همه با coinCost (بدون crystalCost)');
for (const [id, m] of Object.entries(MAGIC)) {
  const anyM = m as unknown as Record<string, unknown>;
  if (typeof anyM.coinCost === 'number' && anyM.coinCost >= 60 && anyM.coinCost <= 100 && anyM.crystalCost === undefined) ok(`${id}: coinCost=${anyM.coinCost}`);
  else bad(`${id}: مشکل هزینه`);
}

console.log('━━ ۲. جعبه: ۳ ستاره در تکرار = ۳ قرعه کارت');
// شمارش قرعه‌ها با شمارش فراخوانی rng (هر قرعه = ۲ فراخوانی: انتخاب برج + قرعه دوتایی)
let calls = 0;
const counter = () => { calls++; return 0.5; };
const c2 = (() => { calls = 0; const r = rollChest(1, 1, false, counter); return { r, d: calls / 2 }; })();
const c3 = (() => { calls = 0; const r = rollChest(1, 3, false, counter); return { r, d: calls / 2 }; })();
const cFirst = (() => { calls = 0; const r = rollChest(1, 1, true, counter); return { r, d: calls / 2 }; })();
const cards = (x: { r: ReturnType<typeof rollChest> }) => x.r.cards.reduce((s, c) => s + c.count, 0);
if (c2.d === 2 && c3.d === 3) ok(`تکرار ۱★=${c2.d} قرعه (${cards(c2)} کارت) | تکرار ۳★=${c3.d} قرعه (${cards(c3)} کارت)`);
else bad(`تعداد قرعه غلط: 1★=${c2.d} 3★=${c3.d}`);
if (cFirst.d === 4) ok(`فتح اول=${cFirst.d} قرعه (${cards(cFirst)} کارت) — بزرگ‌ترین جعبه`);
else bad('فتح اول قرعه ناقص!');

console.log('━━ ۳. برج: هزینه‌ها و سطح مکس');
const sentinel = TOWERS.sentinel;
if (sentinel.levels.length === 5 && sentinel.levels[4].upgradeCost === 0) ok('sentinel: ۵ سطح، لول ۵ بدون ارتقا');
else bad('سطوح برج خراب');

console.log('━━ ۴. سکه جعبه با ستاره بیشتر');
const s1 = rollChest(1, 1, false, counter).coins;
const s3 = rollChest(1, 3, false, counter).coins;
if (s3 === s1 + 24) ok(`سکه ۱★=${s1} → ۳★=${s3} (+۲۴)`);
else bad(`سکه ستاره غلط: ${s1} vs ${s3}`);

console.log('━━ ۵. برج: گارد قفل قدرت (سطح ۵)');
const { Tower } = await import('../src/game/entities/Tower');
const lockGet = Object.getOwnPropertyDescriptor(Tower.prototype, 'abilityLocked');
if (lockGet?.get) {
  const at = (lvl: number) => lockGet.get!.call({ level: lvl });
  if (at(1) === true && at(4) === true && at(5) === false) ok('abilityLocked: L1-L4 قفل، L5 باز');
  else bad(`abilityLocked غلط: L1=${at(1)} L4=${at(4)} L5=${at(5)}`);
} else bad('getter abilityLocked یافت نشد');
// useAbility وقتی قفل است بدون تماس با ctx خروج false می‌دهد
const lockedCall = Tower.prototype.useAbility.call(
  { abilityLocked: true, abilityCd: 0 } as unknown as InstanceType<typeof Tower>, [] as never[],
);
const cdCall = Tower.prototype.useAbility.call(
  { abilityLocked: false, abilityCd: 3 } as unknown as InstanceType<typeof Tower>, [] as never[],
);
const openCall = Tower.prototype.useAbility.call(
  { abilityLocked: false, abilityCd: 0, data: { abilityCooldown: 10 } } as unknown as InstanceType<typeof Tower>, [] as never[],
);
if (lockedCall === false && cdCall === false && openCall === true) ok('useAbility: قفل/کول‌داون رد می‌شود، باز اجرا می‌شود');
else bad(`useAbility غلط: locked=${lockedCall} cd=${cdCall} open=${openCall}`);

console.log(`\n${fail === 0 ? '🎉' : '💥'} نتیجه: ${pass} ✅ | ${fail} ❌`);
process.exit(fail === 0 ? 0 : 1);
