// تحلیل اجزای arman.glb — درخت کامل نودها + bbox فضای-جهانی هر مش
// هدف: پیدا کردن مش پتک (Object_1) و نقطهٔ دسته (grip) برای پیوت چرخش
const fs = require('fs');
const path = process.argv[2] || 'public/assets/3d/heroes/arman.glb';
const buf = fs.readFileSync(path);

let off = 12, json = null;
while (off < buf.length) {
  const chunkLen = buf.readUInt32LE(off);
  const chunkType = buf.readUInt32LE(off + 4);
  if (chunkType === 0x4e4f534a) json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
  off += 8 + chunkLen;
}
const g = json;

// --- ماتریس TRS ساده (ستون-major glTF) ---
function composeNode(n) {
  if (n.matrix) return n.matrix;
  const t = n.translation || [0, 0, 0];
  const q = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a, b) { // a × b (هر دو column-major)
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function xform(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

// --- درخت کامل ---
const isChild = new Set();
for (const n of g.nodes || []) for (const c of (n.children || [])) isChild.add(c);
const roots = [];
for (let i = 0; i < (g.nodes || []).length; i++) if (!isChild.has(i)) roots.push(i);

function walk(i, parentM, depth) {
  const n = g.nodes[i];
  const M = mul(parentM, composeNode(n));
  const pad = '  '.repeat(depth);
  const parts = [`#${i} "${n.name || '?'}"`];
  if (n.mesh !== undefined) parts.push(`mesh=${n.mesh} (${g.meshes[n.mesh].name})`);
  if (n.rotation) parts.push(`rot=[${n.rotation.map(x => +x.toFixed(3)).join(',')}]`);
  if (n.scale) parts.push(`scale=[${n.scale.map(x => +x.toFixed(2)).join(',')}]`);
  if (n.translation) parts.push(`t=[${n.translation.map(x => +x.toFixed(3)).join(',')}]`);
  console.log(pad + parts.join('  '));
  if (n.mesh !== undefined) {
    for (const p of g.meshes[n.mesh].primitives) {
      const acc = g.accessors[p.attributes.POSITION];
      if (!acc.min || !acc.max) continue;
      const mat = g.materials[p.material];
      // ۸ گوشه bbox محلی → فضای جهانی
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
        const w = xform(M, [cx ? acc.max[0] : acc.min[0], cy ? acc.max[1] : acc.min[1], cz ? acc.max[2] : acc.min[2]]);
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
      }
      const size = mx.map((v, k) => +(v - mn[k]).toFixed(3));
      const ctr = mn.map((v, k) => +((v + mx[k]) / 2).toFixed(3));
      console.log(`${pad}   ↳ mat="${mat?.name}" worldBBox size=${size} center=${ctr} Yrange=[${mn[1].toFixed(2)},${mx[1].toFixed(2)}] Zrange=[${mn[2].toFixed(2)},${mx[2].toFixed(2)}]`);
    }
  }
  for (const c of (n.children || [])) walk(c, M, depth + 1);
}

console.log('=== درخت کامل با bbox جهانی (قبل از نرمال‌سازی three) ===');
for (const r of roots) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 0);
