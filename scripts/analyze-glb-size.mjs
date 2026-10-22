#!/usr/bin/env node
// تحلیل سهم اجزای GLB: JSON / هندسه / انیمیشن / تکسچر
import fs from 'node:fs';
const file = process.argv[2];
const bytes = fs.readFileSync(file);
const jsonLen = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
let off = 20 + jsonLen;
let bin = null, binLen = 0;
if (off + 8 <= bytes.length && bytes.readUInt32LE(off + 4) === 0x004e4942) {
  binLen = bytes.readUInt32LE(off);
  bin = bytes.subarray(off + 8, off + 8 + binLen);
}
const texBytes = (doc.images ?? []).reduce((t, img) => {
  if (img.bufferView !== undefined) {
    const bv = doc.bufferViews[img.bufferView];
    return t + bv.byteLength;
  }
  return t;
}, 0);
// هندسه = bufferViewهای هدف 34962/34963 که در mesh استفاده می‌شوند
const texViewSet = new Set((doc.images ?? []).filter(i => i.bufferView !== undefined).map(i => doc.bufferViews[i.bufferView]));
const meshViews = new Set();
for (const m of doc.meshes ?? []) for (const p of m.primitives ?? []) {
  for (const a of Object.values(p.attributes ?? {})) meshViews.add(doc.accessors[a].bufferView);
  if (p.indices !== undefined) meshViews.add(doc.accessors[p.indices].bufferView);
}
let geo = 0, anim = 0, ibm = 0;
const isAnimView = (vi) => (doc.animations ?? []).some(an =>
  an.samplers.some(s => doc.accessors[s.input].bufferView === vi || doc.accessors[s.output].bufferView === vi));
for (const [i, bv] of (doc.bufferViews ?? []).entries()) {
  if (texViewSet.has(i)) continue;
  if (meshViews.has(i)) geo += bv.byteLength;
  else if (isAnimView(i)) anim += bv.byteLength;
}
// ibm = accessor skin
for (const s of doc.skins ?? []) ibm += 0;
let verts = 0, tris = 0;
for (const m of doc.meshes ?? []) for (const p of m.primitives ?? []) {
  verts += doc.accessors[p.attributes.POSITION].count;
  tris += (p.indices !== undefined ? doc.accessors[p.indices].count : doc.accessors[p.attributes.POSITION].count) / 3;
}
console.log(`file: ${file}`);
console.log(`  total ${(bytes.length/1048576).toFixed(2)}MB | JSON ${(jsonLen/1024).toFixed(0)}KB | BIN ${(binLen/1048576).toFixed(2)}MB`);
console.log(`  textures: ${(texBytes/1048576).toFixed(2)}MB (${(doc.images??[]).length} imgs) | geometry: ${(geo/1048576).toFixed(2)}MB | animations: ${(anim/1048576).toFixed(2)}MB | other: ${((binLen-texBytes-geo-anim)/1024).toFixed(0)}KB`);
console.log(`  verts: ${verts} | tris: ${Math.round(tris)} | clips: ${(doc.animations??[]).length} | nodes: ${(doc.nodes??[]).length}`);
