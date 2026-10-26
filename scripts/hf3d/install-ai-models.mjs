#!/usr/bin/env node
// install-ai-models.mjs — copy AI-generated GLBs into public/assets/3d
// Runs in build:cap INSTEAD of the procedural character generators.
// AI sources live in scripts/hf3d/raw (id_textured.glb); originals are
// backed up in scripts/hf3d/originals. Missing AI models keep procedural ones.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const raw = path.join(root, 'scripts/hf3d/raw');
const targets = [
  // [raw id, public relative path]
  ['arman', 'public/assets/3d/rigged/arman.glb'],
  // v2.6 — Hunyuan3D-2 shapes (ZeroGPU) + single-view vertex-color bake
  ['aria', 'public/assets/3d/rigged/aria.glb'],
  ['radin', 'public/assets/3d/rigged/radin.glb'],
  ['nila', 'public/assets/3d/rigged/nila.glb'],
  ['darkLord', 'public/assets/3d/rigged/darkLord.glb'],
  ['golemKing', 'public/assets/3d/rigged/golemKing.glb'],
  ['fireGiant', 'public/assets/3d/rigged/fireGiant.glb'],
  ['iceGiant', 'public/assets/3d/rigged/iceGiant.glb'],
  ['blackDragon', 'public/assets/3d/rigged/blackDragon.glb'],
  ['shadow', 'public/assets/3d/rigged/shadow.glb'],
];

let installed = 0;
for (const [id, rel] of targets) {
  const src = path.join(raw, `${id}_textured.glb`);
  const dest = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.log(`[install-ai-models] no AI model for ${id} — keeping existing`);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[install-ai-models] ${id} -> ${rel} (${(fs.statSync(src).size / 1024).toFixed(0)}KB)`);
  installed++;
}
console.log(`[install-ai-models] installed ${installed} AI model(s)`);
