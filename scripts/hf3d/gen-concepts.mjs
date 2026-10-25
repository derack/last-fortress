// Generate concept images for the whole roster using z-ai CLI
// Usage: node scripts/hf3d/gen-concepts.mjs [id ...]   (no args = all missing)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROSTER, conceptPrompt } from './roster.mjs';

const OUT = '/home/z/my-project/scripts/hf3d/concepts';
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const list = ROSTER.filter((r) => only.length === 0 || only.includes(r.id));

let ok = 0, fail = 0;
for (const r of list) {
  const dest = path.join(OUT, `${r.id}.png`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 20000) {
    console.log(`skip ${r.id} (exists)`);
    ok++;
    continue;
  }
  const prompt = conceptPrompt(r);
  const size = r.kind === 'char' ? '768x1344' : '1024x1024';
  try {
    execSync(`z-ai image -p ${JSON.stringify(prompt)} -o ${JSON.stringify(dest)} -s ${size}`, {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 120000,
    });
    const sz = fs.statSync(dest).size;
    if (sz < 20000) throw new Error(`too small: ${sz}`);
    console.log(`OK   ${r.id} (${(sz / 1024).toFixed(0)}KB)`);
    ok++;
  } catch (e) {
    console.log(`FAIL ${r.id}: ${String(e.message).slice(0, 120)}`);
    fail++;
  }
}
console.log(`concepts done: ok=${ok} fail=${fail}`);
