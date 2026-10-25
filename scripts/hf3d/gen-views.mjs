// Generate multi-view concept variants (back/left/right) for a model id
// Usage: node scripts/hf3d/gen-views.mjs arman [aria ...]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROSTER, conceptPrompt } from './roster.mjs';

const OUT = '/home/z/my-project/scripts/hf3d/concepts';
const VIEWS = [
  ['back', 'exact rear view of the same object from directly behind, same size and style'],
  ['left', 'exact left side view of the same object at 90 degrees, same size and style'],
  ['right', 'exact right side view of the same object at 90 degrees, same size and style'],
];

const only = process.argv.slice(2);
const list = ROSTER.filter((r) => only.length === 0 || only.includes(r.id));

for (const r of list) {
  for (const [tag, viewDesc] of VIEWS) {
    const dest = path.join(OUT, `${r.id}_${tag}.png`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 20000) {
      console.log(`skip ${r.id}_${tag}`);
      continue;
    }
    const prompt = `${conceptPrompt(r).replace(r.desc, r.desc)} — ${viewDesc}`;
    const size = r.kind === 'char' ? '768x1344' : '1024x1024';
    try {
      execSync(`z-ai image -p ${JSON.stringify(prompt)} -o ${JSON.stringify(dest)} -s ${size}`, {
        stdio: ['ignore', 'ignore', 'pipe'],
        timeout: 120000,
      });
      console.log(`OK ${r.id}_${tag} (${(fs.statSync(dest).size / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`FAIL ${r.id}_${tag}: ${String(e.message).slice(0, 100)}`);
    }
  }
}
console.log('views done');
