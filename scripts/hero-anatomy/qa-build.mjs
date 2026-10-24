// می‌سازد qa-hero.html تک‌فایلی (باندل three + GLB base64) برای رندر هدلس
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const bundle = fs.readFileSync(path.join(here, 'qa-bundle.js'), 'utf8');
const glb = fs.readFileSync('/home/z/my-project/public/assets/3d/rigged/arman.glb');
const b64 = glb.toString('base64');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>hero-qa</title></head>
<body>
<script>window.__GLB_B64__ = "${b64}";</script>
<script>${bundle}</script>
</body></html>`;
fs.writeFileSync(path.join(here, 'qa-hero.html'), html);
console.log('qa-hero.html written:', (html.length / 1024 / 1024).toFixed(1), 'MB');
