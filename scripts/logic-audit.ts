// ============================================================
// ممیزی کامل منطق پروژه — سطح‌ها / لول‌ها / قفل‌ها / سازگاری داده
// اجرا: bun scripts/logic-audit.ts   (exit 1 = مشکل FIND)
// ============================================================
import { STAGES, CHAPTERS, isStageUnlocked, stageId, ACHIEVEMENTS, firstPlayableStageId, nextStageId, completedStageCount } from '../src/game/data/campaign';
import { TOWERS, isTowerUnlocked } from '../src/game/data/towers';
import { ENEMIES, tiered } from '../src/game/data/enemies';
import { HEROES, HERO_ROSTER, HERO_META, MAGIC } from '../src/game/data/magic';
import { FORGE_TRACKS, FORGE_MAX, forgeNextCost } from '../src/game/data/forge';
import { dictionaries } from '../src/game/data/i18n';
import type { SaveData } from '../src/game/data/types';

let FAIL = 0, WARN = 0, PASS = 0;
const fails: string[] = [], warns: string[] = [];
const ok = (m: string) => { PASS++; console.log(`  ✅ ${m}`); };
const bad = (m: string) => { FAIL++; fails.push(m); console.log(`  ❌ ${m}`); };
const warn = (m: string) => { WARN++; warns.push(m); console.log(`  ⚠️ ${m}`); };
const sec = (m: string) => console.log(`\n━━━ ${m} ━━━`);

// ---------- ۱) سطح‌ها — ۱۰۰ مرحله ----------
sec('۱. سطح‌ها — کمپین ۱۰۰ مرحله');
const ids = Object.keys(STAGES);
const expected = new Set<string>();
for (let c = 1; c <= 10; c++) for (let s = 1; s <= 10; s++) expected.add(stageId(c, s));
if (ids.length === 100 && expected.size === 100 && ids.every((i) => expected.has(i))) ok('۱۰۰ مرحله c1s1..c10s10 کامل');
else bad(`تعداد/شناسه مراحل غلط: ${ids.length} مرحله، ${ids.filter((i) => !expected.has(i)).length} ناشناس`);

let waveIssues = 0, enemyIssues = 0, bossIssues = 0, pathIssues = 0, ecoIssues = 0;
for (const ch of CHAPTERS) {
  for (let s = 1; s <= 10; s++) {
    const lv = STAGES[stageId(ch.id, s)];
    if (lv.waves.length !== 10) { waveIssues++; if (waveIssues < 4) console.log(`      نمونه: ${lv.id} موج=${lv.waves.length}`); }
    for (let wi = 0; wi < lv.waves.length; wi++) {
      const w = lv.waves[wi];
      if (!w.groups.length) { waveIssues++; continue; }
      for (const g of w.groups) {
        if (!ENEMIES[g.enemy]) { enemyIssues++; if (enemyIssues < 4) console.log(`      دشمن ناموجود: ${lv.id} موج${wi + 1} ${g.enemy}`); }
        if (g.tier < 1 || g.tier > 3) { enemyIssues++; console.log(`      tier نامعتبر: ${lv.id} ${g.enemy}=${g.tier}`); }
        if (g.count < 1) { enemyIssues++; console.log(`      count<1: ${lv.id} ${g.enemy}`); }
        if (g.path !== undefined && (g.path < 0 || g.path >= lv.paths.length)) pathIssues++;
      }
    }
    if (lv.paths.length < 1) pathIssues++;
    // Boss — مرحله ۱۰ هر فصل باید Boss همان فصل را داشته باشد
    if (s === 10) {
      const hasBoss = lv.waves.some((w) => w.groups.some((g) => ENEMIES[g.enemy]?.boss || g.enemy === ch.bossId));
      if (!hasBoss) { bossIssues++; console.log(`      بدون Boss: ${lv.id} (${ch.bossId})`); }
    }
    if (lv.coreHp < 100 || lv.startCoins < 100) { ecoIssues++; console.log(`      اقتصاد/هسته غلط: ${lv.id} core=${lv.coreHp} coins=${lv.startCoins}`); }
    if (lv.star2HealthPct !== 70) warn(`${lv.id} star2HealthPct=${lv.star2HealthPct}`);
  }
}
if (!waveIssues) ok('هر ۱۰۰ مرحله دقیقاً ۱۰ موج با گروه‌های معتبر'); else bad(`${waveIssues} مشکل موج`);
if (!enemyIssues) ok('همه دشمنان/tier/count اشاره به ENEMIES معتبر'); else bad(`${enemyIssues} مشکل دشمن`);
if (!bossIssues) ok('Boss هر فصل در مرحله ۱۰ حضور دارد'); else bad(`${bossIssues} فصل بدون Boss`);
if (!pathIssues) ok('مسیرها و توزیع گروه‌ها سازگار'); else bad(`${pathIssues} مشکل مسیر`);
if (!ecoIssues) ok('سکه شروع/هسته همه مراحل سالم (≥۱۰۰)'); else bad(`${ecoIssues} مشکل اقتصاد پایه`);

// ---------- اعتبارسنجی سخت‌گیرانه ساختار مرحله و داده‌های موج ----------
sec('۱.۱. یکپارچگی مسیرها، اسپاون‌ها و شناسه مرحله');
{
  let stageIssues = 0, spawnIssues = 0, geometryIssues = 0;
  for (const ch of CHAPTERS) {
    for (let s = 1; s <= 10; s++) {
      const expectedId = stageId(ch.id, s);
      const lv = STAGES[expectedId];
      if (!lv || lv.id !== expectedId || lv.chapter !== ch.id || lv.stage !== s) {
        stageIssues++;
        console.log(`      شناسه/متادیتای مرحله ناسازگار: ${expectedId}`);
        continue;
      }
      if (!Number.isFinite(lv.coreHp) || !Number.isFinite(lv.startCoins) || !Number.isFinite(lv.startCrystals)
        || lv.coreHp <= 0 || lv.startCoins < 0 || lv.startCrystals < 0
        || lv.star2HealthPct < 0 || lv.star2HealthPct > 100) {
        stageIssues++;
        console.log(`      آمار مرحله نامعتبر: ${expectedId}`);
      }
      for (let pi = 0; pi < lv.paths.length; pi++) {
        const path = lv.paths[pi];
        if (path.length < 2 || path.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) {
          geometryIssues++;
          console.log(`      مسیر خالی/مختصات نامعتبر: ${expectedId} path=${pi}`);
        }
      }
      for (let wi = 0; wi < lv.waves.length; wi++) {
        const wave = lv.waves[wi];
        if (!Number.isFinite(wave.coinBonus) || wave.coinBonus < 0
          || (wave.crystalBonus !== undefined && (!Number.isFinite(wave.crystalBonus) || wave.crystalBonus < 0))) {
          spawnIssues++;
          console.log(`      پاداش موج نامعتبر: ${expectedId} wave=${wi + 1}`);
        }
        for (const g of wave.groups) {
          if (!Number.isInteger(g.count) || g.count < 1 || !Number.isFinite(g.interval) || g.interval < 0
            || !Number.isFinite(g.delay) || g.delay < 0 || !Number.isInteger(g.tier)
            || (g.path !== undefined && (!Number.isInteger(g.path) || g.path < 0 || g.path >= lv.paths.length))) {
            spawnIssues++;
            console.log(`      گروه اسپاون نامعتبر: ${expectedId} wave=${wi + 1} enemy=${g.enemy}`);
          }
        }
      }
    }
  }
  if (!stageIssues) ok('شناسه و متادیتای تمام مراحل سازگار و آمار عددی معتبر'); else bad(`${stageIssues} خطای متادیتای مرحله`);
  if (!geometryIssues) ok('مختصات تمام مسیرها محدود به اعداد معتبر و حداقل دو نقطه'); else bad(`${geometryIssues} خطای هندسه مسیر`);
  if (!spawnIssues) ok('count/tier/interval/delay/path و پاداش همه موج‌ها معتبر'); else bad(`${spawnIssues} خطای گروه اسپاون/پاداش`);

  const emptySave = { levels: {} } as unknown as SaveData;
  const first = firstPlayableStageId(emptySave);
  const allDone = { levels: Object.fromEntries(Object.keys(STAGES).map((id) => [id, { completed: true, stars: 3, bestHealthPct: 100 }])) } as unknown as SaveData;
  if (first === 'c1s1' && completedStageCount(allDone) === 100 && nextStageId(10, 10) === null)
    ok('Continue/save progression: سیو خالی، کمپین کامل و پایان فصل آخر درست');
  else bad(`Continue/save progression ناسازگار: first=${first}, completed=${completedStageCount(allDone)}, finalNext=${nextStageId(10, 10)}`);
}

// منحنی رشد HP هسته و سکه
const coreHp = CHAPTERS.flatMap((c) => Array.from({ length: 10 }, (_, i) => STAGES[stageId(c.id, i + 1)].coreHp));
const monotonic = coreHp.every((v, i) => i === 0 || v >= coreHp[i - 1]);
if (monotonic) ok(`هسته HP صعودی یکنواخت ۱۰۰ مرحله (${coreHp[0]}→${coreHp[99]})`); else warn('هسته HP کاملاً صعودی نیست (انتظار ۱۰۰→۲۵۴)');

// ---------- ۲) زنجیره قفل مراحل ----------
sec('۲. زنجیره قفل مراحل — شبیه‌سازی پیشرفت');
{
  const completed = new Set<string>();
  let chainOk = true, gateOk = true;
  for (let c = 1; c <= 10; c++) {
    for (let s = 1; s <= 10; s++) {
      if (!isStageUnlocked(c, s, completed)) { chainOk = false; console.log(`      قفل باقی‌مانده در پیشرفت کامل: c${c}s${s}`); }
      completed.add(stageId(c, s));
    }
  }
  if (chainOk) ok('پیشرفت ترتیبی: هر مرحله بعد از فتح قبلی آزاد می‌شود');
  // گیت: بدون فتح قبلی نباید آزاد شود
  const empty = new Set<string>();
  if (isStageUnlocked(1, 1, empty) && !isStageUnlocked(1, 2, empty) && !isStageUnlocked(2, 1, empty)) gateOk = gateOk && true; else gateOk = false;
  const onlyC1S1 = new Set(['c1s1']);
  if (!isStageUnlocked(2, 1, onlyC1S1) && isStageUnlocked(1, 2, onlyC1S1)) gateOk = gateOk && true; else gateOk = false;
  const c1Done = new Set(['c1s1', 'c1s2', 'c1s3', 'c1s4', 'c1s5', 'c1s6', 'c1s7', 'c1s8', 'c1s9', 'c1s10']);
  if (isStageUnlocked(2, 1, c1Done)) gateOk = gateOk && true; else gateOk = false;
  if (gateOk) ok('گیت قفل: مرحله ۱ آزاد، بقیه فقط با فتح مرحله قبل / Boss فصل قبل'); else bad('منطق گیت قفل مراحل خراب');
  // تکلیف save خالی — save بدون level نباید crash کند
  const fakeSave = { levels: {} } as unknown as SaveData;
  try { isTowerUnlocked(fakeSave, 'sentinel'); ok('isTowerUnlocked با سیو خالی، ایمن'); } catch { bad('isTowerUnlocked با سیو خالی crash می‌کند'); }
}

// ---------- ۳) لول‌ها — برج‌ها ۵ سطح ----------
sec('۳. لول‌ها — برج‌ها (۵ سطح × ۱۰ برج)');
{
  const tids = Object.keys(TOWERS);
  if (tids.length === 10) ok(`۱۰ برج: ${tids.join('، ')}`); else bad(`${tids.length} برج`);
  let lvIssues = 0, costIssues = 0, progIssues = 0;
  for (const tid of tids) {
    const tw = TOWERS[tid];
    if (tw.levels.length !== 5) { lvIssues++; console.log(`      ${tid}: ${tw.levels.length} سطح`); }
    for (let i = 0; i < tw.levels.length; i++) {
      const L = tw.levels[i];
      if (!(L.damage > 0 && L.range > 0 && L.fireRate > 0)) { progIssues++; console.log(`      ${tid} سطح${i + 1}: آمار نامعتبر`); }
      if (i > 0 && L.damage <= tw.levels[i - 1].damage) { progIssues++; console.log(`      ${tid}: damage سطح${i + 1} ≤ سطح${i}`); }
      if (i < 4 && !(L.upgradeCost > 0)) { costIssues++; console.log(`      ${tid} سطح${i + 1}: upgradeCost=${L.upgradeCost}`); }
    }
    if (tw.levels[4].upgradeCost !== 0 && tw.levels[4].upgradeCost !== undefined) warn(`${tid} سطح۵ upgradeCost=${tw.levels[4].upgradeCost} (باید ۰ باشد)`);
    if (!(tw.cost > 0 && tw.cost <= tw.levels[0].upgradeCost + tw.cost)) costIssues++;
  }
  if (!lvIssues) ok('همه برج‌ها ۵ سطح کامل'); else bad(`${lvIssues} برج با سطح ناقص`);
  if (!progIssues) ok('آمار damage/range/fireRate صعودی و معتبر'); else bad(`${progIssues} مشکل آمار برج`);
  if (!costIssues) ok('زنجیره upgradeCost سالم (سطح ۵ بدون هزینه)'); else bad(`${costIssues} مشکل هزینه ارتقا`);
  // قفل ستاره‌ای — صعودی و ≤ سقف دستاورد
  const stars = tids.map((t) => TOWERS[t].unlockStars ?? 0);
  const asc = stars.every((v, i) => i === 0 || v >= stars[i - 1]);
  const maxStars = 100 * 3;
  if (asc && Math.max(...stars) <= maxStars) ok(`قفل ستاره‌ای صعودی: [${stars.join('،')}] (سقف کمپین ${maxStars}⭐)`); else bad('منحنی قفل ستاره‌ای برج‌ها خراب');
  // قفل با سیو واقعی
  const s0 = { levels: {} } as unknown as SaveData;
  const s3 = { levels: { c1s1: { stars: 3, bestHealthPct: 100, completed: true } } } as unknown as SaveData;
  if (isTowerUnlocked(s0, 'sentinel') && !isTowerUnlocked(s0, 'fire') && isTowerUnlocked(s3, 'fire') && !isTowerUnlocked(s3, 'ice'))
    ok('قفل عملی: فقط sentinel در شروع؛ آتش با ۲⭐؛ یخ با ۳⭐ نه'); else bad('قفل عملی برج‌ها خلاف انتظار');
}

// ---------- ۴) دشمنان ----------
sec('۴. دشمنان — موجودیت و Bossها');
{
  const eids = Object.keys(ENEMIES);
  let bad2 = 0;
  for (const id of eids) {
    const e = ENEMIES[id];
    if (!(e.hp > 0 && e.speed > 0 && e.reward >= 0)) { bad2++; console.log(`      ${id}: آمار غلط`); }
  }
  if (!bad2) ok(`${eids.length} دشمن با آمار معتبر (hp/speed/reward)`); else bad(`${bad2} دشمن خراب`);
  const bossIds = Object.values(ENEMIES).filter((e) => e.boss).map((e) => e.id);
  const need = ['golemKing', 'fireGiant', 'iceGiant', 'blackDragon', 'annihilator', 'darkLord'];
  const missing = need.filter((b) => !bossIds.includes(b));
  if (!missing.length) ok(`همه Bossهای ۱۰ فصل تعریف شده (${bossIds.join('، ')})`); else bad(`Boss ناموجود: ${missing.join('،')}`);
  try { const t3 = tiered(Object.values(ENEMIES)[0], 3); if (t3 && t3.hp > Object.values(ENEMIES)[0].hp) ok('tiered() سطح ۳ پرقدرت‌تر'); else warn('tiered tier3 رفتار غیرمنتظره'); } catch { bad('tiered() crash'); }
}

// ---------- ۵) قهرمانان و جادوها ----------
sec('۵. قهرمانان، جادوها، کوره اثیر');
{
  const hids = Object.keys(HEROES);
  if (hids.length === 4 && HERO_ROSTER.length === 4) ok(`۴ قهرمان با رستر کامل: ${hids.join('، ')}`); else bad(`قهرمان/رستر: ${hids.length}/${HERO_ROSTER.length}`);
  if (HEROES.arman.unlockCost === 0 && hids.every((h) => HEROES[h].unlockCost >= 0)) ok('آرمان رایگان، بقیه با هزینه کریستال قفل');
  else bad('قفل قهرمانان خراب');
  const rosterMatch = HERO_ROSTER.every((r) => !!HEROES[r.id]) && HERO_ROSTER[0].unlocked && HERO_ROSTER.slice(1).every((r) => !r.unlocked);
  if (rosterMatch) ok('HERO_ROSTER با HEROES سازگار (فقط آرمان باز)'); else bad('HERO_ROSTER ناسازگار');
  const metaOk = Object.keys(HERO_META).every((k) => !!HEROES[k]);
  if (metaOk) ok('HERO_META اشاره به قهرمان معتبر'); else bad('HERO_META یتیم');
  const mids = Object.keys(MAGIC);
  let mBad = 0;
  for (const id of mids) { const m = MAGIC[id]; if (!(m.cooldown > 0 && m.crystalCost > 0)) { mBad++; console.log(`      ${id}: cooldown/crystalCost غلط`); } }
  if (!mBad) ok(`${mids.length} جادو با cooldown/mana معتبر: ${mids.join('، ')}`); else bad(`${mBad} جادو خراب`);
  if (FORGE_TRACKS.length === 6 && FORGE_TRACKS.every((t) => t.maxLevel === FORGE_MAX)) ok(`کوره اثیر: ${FORGE_TRACKS.length} مسیر × ${FORGE_MAX} سطح`);
  else bad('مسیرهای کوره ناقص');
  let fOk = true;
  for (const tr of FORGE_TRACKS) for (let l = 0; l < FORGE_MAX - 1; l++) if (forgeNextCost(tr.id as never, l) >= forgeNextCost(tr.id as never, l + 1)) fOk = false;
  if (fOk) ok('هزینه ارتقای کوره اکیداً صعودی'); else bad('منحنی هزینه کوره خراب');
}

// ---------- ۶) دستاوردها ----------
sec('۶. دستاوردها — ۳۰ دستاورد داده‌محور');
{
  const idsA = ACHIEVEMENTS.map((a) => a.id);
  const uniq = new Set(idsA).size === idsA.length;
  if (idsA.length === 30 && uniq) ok('۳۰ دستاورد با شناسه یکتا'); else bad(`${idsA.length} دستاورد، یکتا=${uniq}`);
  const granted = ['untouchable', 'perfect_defense', 'last_stand'];
  const missingG = granted.filter((g) => !idsA.includes(g));
  if (!missingG.length) ok('دستاوردهای اعطاشده در Game (untouchable/perfect_defense/last_stand) تعریف دارند'); else bad(`اعطای دستاورد ناموجود: ${missingG.join('،')}`);
  const checkOk = ACHIEVEMENTS.every((a) => typeof a.check === 'function' && a.crystalReward > 0);
  if (checkOk) ok('همه دستاوردها check + پاداش کریستال دارند'); else bad('دستاورد بدون check/پاداش');
}

// ---------- ۷) i18n — توازن fa/en ----------
sec('۷. i18n — ۳۹۲+ کلید، توازن fa/en');
{
  const fa = Object.keys(dictionaries.fa), en = Object.keys(dictionaries.en);
  const onlyFa = fa.filter((k) => !(k in dictionaries.en)), onlyEn = en.filter((k) => !(k in dictionaries.fa));
  if (!onlyFa.length && !onlyEn.length && fa.length >= 392) ok(`${fa.length} کلید — توازن کامل fa/en`); else bad(`فقط‌fa:${onlyFa.length} فقط‌en:${onlyEn.length} کلید=${fa.length}`);
  // کلیدهای داده‌محور
  const keyRefs: string[] = [];
  for (const c of CHAPTERS) keyRefs.push(c.nameKey, c.descKey, c.tagKey);
  for (const h of Object.values(HEROES)) keyRefs.push(h.nameKey, h.titleKey, h.descKey, h.abilityNameKey, h.abilityDescKey);
  for (const a of ACHIEVEMENTS) keyRefs.push(a.nameKey, a.descKey);
  const missingK = keyRefs.filter((k) => !(k in dictionaries.fa));
  if (!missingK.length) ok(`تمام ${keyRefs.length} کلید ارجاعی داده‌ها در i18n موجود`); else bad(`کلید گم‌شده: ${missingK.slice(0, 8).join('،')}`);
}

// ---------- ۸) گزارش ----------
console.log('\n════════════════════════════════');
console.log(`نتیجه: ✅ ${PASS} موفق | ❌ ${FAIL} خطا | ⚠️ ${WARN} هشدار`);
if (fails.length) { console.log('خطاها:'); fails.forEach((f) => console.log('  ❌ ' + f)); }
if (warns.length) { console.log('هشدارها:'); warns.forEach((f) => console.log('  ⚠️ ' + f)); }
process.exit(FAIL > 0 ? 1 : 0);
