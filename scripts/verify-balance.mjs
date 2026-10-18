// Simulation of the 100-level balance (MASTER PROMPT #57 — Stage 1/10/50/100)
const ts = await import('typescript');
const fs = await import('fs');
const src = fs.readFileSync('src/game/data/levels.ts', 'utf8');
// strip types quickly via transpile
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
const requireShim = (p) => {
  if (p.includes('level1')) {
    const l1 = fs.readFileSync('src/game/data/level1.ts', 'utf8');
    const j1 = ts.transpileModule(l1, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const m1 = { exports: {} };
    new Function('module', 'exports', 'require', j1)(m1, m1.exports, requireShim);
    return m1.exports;
  }
  if (p.includes('towers')) {
    const t = fs.readFileSync('src/game/data/towers.ts', 'utf8');
    const jt = ts.transpileModule(t, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const mt = { exports: {} };
    new Function('module', 'exports', 'require', jt)(mt, mt.exports, requireShim);
    return mt.exports;
  }
  if (p.includes('types')) return {};
  throw new Error('unknown require ' + p);
};
new Function('module', 'exports', 'require', js)(mod, mod.exports, requireShim);
const { LEVELS, REGIONS, stagePowerMul } = mod.exports;

console.log('total levels:', Object.keys(LEVELS).length, '| regions:', REGIONS.length);
for (const n of [1, 10, 11, 20, 50, 100]) {
  const L = LEVELS['l' + n];
  const boss = L.waves.some((w) => w.boss);
  const enemies = L.waves.reduce((s, w) => s + w.groups.reduce((a, g) => a + g.count, 0), 0);
  console.log(
    `stage ${String(n).padStart(3)} | waves ${String(L.waves.length).padStart(2)} | boss ${boss ? 'Y' : 'n'} | enemies ${String(enemies).padStart(3)} | coreHp ${L.coreHp} | coins ${L.startCoins} | power ×${stagePowerMul(n).toFixed(2)}`,
  );
}
// unlock chain integrity
let ok = true;
const done = new Set();
for (const r of REGIONS) {
  const unlocked = r.id === 1 || done.has('l' + (r.id - 1));
  if (!unlocked) { ok = false; console.log('CHAIN BROKEN at', r.id); break; }
  done.add(r.levelId);
}
console.log('unlock chain:', ok ? 'OK (all 100 sequential)' : 'BROKEN');
