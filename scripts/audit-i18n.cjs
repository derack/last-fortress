// i18n audit — همهٔ کلیدهای استفاده‌شده در سورس باید در fa و en تعریف شده باشند
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
})(SRC);

const used = new Set();
const DYNAMIC = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
const TEMPLATE = /\bt\(\s*`([^`]+)`/g; // t(`quality${...}`) — پیشوند
const prefixes = new Set();
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = DYNAMIC.exec(txt))) used.add(m[1]);
  while ((m = TEMPLATE.exec(txt))) prefixes.add(m[1]);
}

// خواندن i18n.ts و استخراج کلیدهای هر زبان
const i18nSrc = fs.readFileSync(path.join(SRC, 'game', 'data', 'i18n.ts'), 'utf8');
function extractKeys(section) {
  const set = new Set();
  const re = /([a-zA-Z0-9_]+)\s*:/g;
  let m;
  while ((re.exec(section))) set.add(RegExp.lastMatch ? re.lastIndex && m : null); // noop
  return set;
}
// راه ساده‌تر: eval امن با بریدن بلوک‌ها
function getBlock(name) {
  const start = i18nSrc.indexOf(name);
  if (start < 0) return null;
  const braceStart = i18nSrc.indexOf('{', start);
  let depth = 0, end = braceStart;
  for (let i = braceStart; i < i18nSrc.length; i++) {
    if (i18nSrc[i] === '{') depth++;
    else if (i18nSrc[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  return i18nSrc.slice(braceStart, end + 1);
}
function keysOf(block) {
  const set = new Set();
  const re = /^\s*([A-Za-z0-9_]+)\s*:/gm;
  let m;
  while ((m = re.exec(block))) set.add(m[1]);
  return set;
}
const faBlock = getBlock('const fa') || getBlock('fa:');
const enBlock = getBlock('const en') || getBlock('en:');
const faKeys = keysOf(faBlock || '');
const enKeys = keysOf(enBlock || '');

// کلیدهای داینامیک: prefix expansion — quality*، ach* و…
const dynamicCandidates = new Set();
for (const p of prefixes) {
  const pre = p.replace(/\$\{[^}]*\}/g, '');
  const src = pre.includes("'") ? pre.split("'").join('') : pre;
  for (const k of faKeys) if (k.startsWith(src)) dynamicCandidates.add(k);
}
const knownDynamic = new Set([
  'tutorialBuild', 'tutorialWave', 'tutorialUpgrade', 'tutorialMagic', 'tutorialDone',
  'targetFirst', 'targetStrongest', 'targetWeakest', 'targetFastest', 'targetBoss',
  'region1', 'region2', 'region3', 'region4', 'region5', 'region6', 'region7', 'region8', 'region9', 'region10',
  'qualityLow', 'qualityMedium', 'qualityHigh', 'qualityUltra',
  'stagePart', 'waveOf', 'waveCleared', 'nextWaveBonus', 'heroLevel',
  'achFirstFortress', 'achCommander', 'achLegend', 'achMage', 'achArchmage', 'achSlayer',
  'achExterminator', 'achWaveBreaker', 'achVeteran', 'achGiantSlayer', 'achTitanBane',
  'achArchitect', 'achMasterBuilder', 'achStarSeeker', 'achStarLord', 'achUntouchable',
  'achPerfectDefense', 'achLastStand', 'achBlitz', 'achTowerMaster', 'achMaxed',
  'achDragonFear', 'achEconomy', 'achMagicRain', 'achRich', 'achCrystalHoarder',
  'achStormCaller', 'achInferno', 'achGuardianAngel', 'achNewAchievement',
  'achFirstFortressDesc', 'achCommanderDesc', 'achLegendDesc', 'achMageDesc', 'achArchmageDesc',
  'achSlayerDesc', 'achExterminatorDesc', 'achWaveBreakerDesc', 'achVeteranDesc',
  'achGiantSlayerDesc', 'achTitanBaneDesc', 'achArchitectDesc', 'achMasterBuilderDesc',
  'achStarSeekerDesc', 'achStarLordDesc', 'achUntouchableDesc', 'achPerfectDefenseDesc',
  'achLastStandDesc', 'achBlitzDesc', 'achTowerMasterDesc', 'achMaxedDesc', 'achDragonFearDesc',
  'achEconomyDesc', 'achMagicRainDesc', 'achRichDesc', 'achCrystalHoarderDesc',
  'achStormCallerDesc', 'achInfernoDesc', 'achGuardianAngelDesc', 'achUntouchableDesc',
  'heroArmanTitle', 'heroAriaTitle', 'heroRadinTitle', 'heroNilaTitle',
  'towerSentinel', 'towerLightning', 'towerFire', 'towerIce', 'towerCannon',
  'towerPoison', 'towerBallista', 'towerArcane', 'towerTemple', 'towerVoid',
]);
for (const k of knownDynamic) dynamicCandidates.add(k);

const missingInFa = [], missingInEn = [], missingInBoth = [];
for (const k of used) {
  if (dynamicCandidates.has(k)) continue;
  const inFa = faKeys.has(k), inEn = enKeys.has(k);
  if (!inFa && !inEn) missingInBoth.push(k);
  else if (!inFa) missingInFa.push(k);
  else if (!inEn) missingInEn.push(k);
}
const faOnly = [...faKeys].filter((k) => !enKeys.has(k));
const enOnly = [...enKeys].filter((k) => !faKeys.has(k));

console.log('کلیدهای استفاده‌شده:', used.size);
console.log('— کلیدهای استفاده‌شده ولی تعریف‌نشده در fa:', missingInFa.length, missingInFa.slice(0, 20));
console.log('— کلیدهای استفاده‌شده ولی تعریف‌نشده در en:', missingInEn.length, missingInEn.slice(0, 20));
console.log('— در هیچ‌کدام تعریف نشده:', missingInBoth.length, missingInBoth.slice(0, 40));
console.log('— کلید fa بدون معادل en:', faOnly.length, faOnly.slice(0, 20));
console.log('— کلید en بدون معادل fa:', enOnly.length, enOnly.slice(0, 20));
