// GLB Inspector — ساختار، اسکلت، انیمیشن، متریال، ابعاد
const fs = require('fs');

const path = process.argv[2];
const buf = fs.readFileSync(path);

// --- GLB header ---
const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const totalLen = buf.readUInt32LE(8);
console.log(`magic=0x${magic.toString(16)} (${magic === 0x46546c67 ? 'VALID glTF' : 'INVALID!'})  version=${version}  totalLen=${totalLen}  fileSize=${buf.length}`);

let off = 12;
let json = null;
let binChunks = 0;
let binBytes = 0;
while (off < buf.length) {
  const chunkLen = buf.readUInt32LE(off);
  const chunkType = buf.readUInt32LE(off + 4);
  if (chunkType === 0x4e4f534a) { // JSON
    json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
  } else if (chunkType === 0x004e4942) { // BIN
    binChunks++; binBytes += chunkLen;
  }
  off += 8 + chunkLen;
}
if (!json) { console.error('NO JSON CHUNK — not a valid GLB'); process.exit(1); }

const g = json;
console.log(`\nasset: generator="${g.asset?.generator || '?'}"  gltfVersion=${g.asset?.version}`);
console.log(`nodes=${g.nodes?.length ?? 0}  meshes=${g.meshes?.length ?? 0}  skins=${g.skins?.length ?? 0}  animations=${g.animations?.length ?? 0}  materials=${g.materials?.length ?? 0}  textures=${g.textures?.length ?? 0}  images=${g.images?.length ?? 0}  binChunks=${binChunks} (${binBytes} B)`);

// --- Skins / skeleton ---
for (const [i, s] of (g.skins || []).entries()) {
  console.log(`\nskin[${i}] name="${s.name || '?'}" joints=${s.joints?.length}`);
  const rootNames = (s.skeleton !== undefined && g.nodes[s.skeleton]?.name) ? [g.nodes[s.skeleton].name] : [];
  if (rootNames.length) console.log(`  skeletonRoot: ${rootNames.join(', ')}`);
  // count bones by top-level prefixes
  const names = (s.joints || []).map(j => g.nodes[j]?.name || `#${j}`);
  console.log(`  first bones: ${names.slice(0, 12).join(', ')}${names.length > 12 ? ' ...' : ''}`);
}

// --- Animations ---
for (const [i, a] of (g.animations || []).entries()) {
  const dur = Math.max(...a.samplers.map(s => {
    const acc = g.accessors[s.input];
    return acc && acc.max ? acc.max[0] : 0;
  }));
  const chans = a.channels.reduce((m, c) => { m[c.target.path] = (m[c.target.path] || 0) + 1; return m; }, {});
  console.log(`anim[${i}] "${a.name || '?'}"  dur=${dur.toFixed(2)}s  channels=${a.channels.length} (${JSON.stringify(chans)})`);
}
if (!g.animations?.length) console.log('NO ANIMATIONS!');

// --- Meshes & primitives & materials ---
let triCount = 0;
for (const [i, m] of (g.meshes || []).entries()) {
  let mt = 0;
  for (const p of m.primitives) {
    const posAcc = g.accessors[p.attributes.POSITION];
    const count = posAcc ? posAcc.count : 0;
    const idx = p.indices !== undefined ? g.accessors[p.indices] : null;
    mt += idx ? idx.count / 3 : count / 3;
  }
  triCount += mt;
  console.log(`mesh[${i}] "${m.name || '?'}" prims=${m.primitives.length} tris=${Math.round(mt)}`);
}
console.log(`TOTAL triangles: ${Math.round(triCount)}`);

// --- Bounds / height estimation from POSITION accessors of skinned/primitives ---
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const acc of (g.accessors || [])) {
  if (acc.type === 'VEC3' && acc.min && acc.max && acc.componentType === 5126) {
    // only POSITION-like accessors with reasonable bounds
    if (acc.min.length === 3 && isFinite(acc.min[1])) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], acc.min[k]);
        max[k] = Math.max(max[k], acc.max[k]);
      }
    }
  }
}
if (isFinite(min[0])) {
  console.log(`raw bounds: X[${min[0].toFixed(2)},${max[0].toFixed(2)}] Y[${min[1].toFixed(2)},${max[1].toFixed(2)}] Z[${min[2].toFixed(2)},${max[2].toFixed(2)}]`);
  console.log(`raw size: ${(max[0]-min[0]).toFixed(2)} × ${(max[1]-min[1]).toFixed(2)}(H) × ${(max[2]-min[2]).toFixed(2)}`);
}

// --- Materials / textures ---
for (const [i, m] of (g.materials || []).entries()) {
  const pbr = m.pbrMetallicRoughness || {};
  const flags = [];
  if (pbr.baseColorTexture) flags.push('baseColorTex');
  if (pbr.metallicFactor !== undefined) flags.push(`metal=${pbr.metallicFactor}`);
  if (pbr.roughnessFactor !== undefined) flags.push(`rough=${pbr.roughnessFactor}`);
  if (m.normalTexture) flags.push('normalTex');
  if (m.emissiveTexture) flags.push('emissiveTex');
  console.log(`mat[${i}] "${m.name || '?'}" ${flags.join(' ')} baseColor=${JSON.stringify(pbr.baseColorFactor || 'default')}`);
}

// --- Images (embedded textures) ---
for (const [i, img] of (g.images || []).entries()) {
  console.log(`img[${i}] name="${img.name || '?'}" mime=${img.mimeType} size=${img.bufferView !== undefined ? 'embedded' : img.uri || '?'}`);
}

// --- Node tree summary (top 2 levels) ---
const roots = [];
const isChild = new Set();
for (const n of g.nodes || []) for (const c of (n.children || [])) isChild.add(c);
for (let i = 0; i < (g.nodes || []).length; i++) if (!isChild.has(i)) roots.push(i);
const nameOf = (i) => g.nodes[i]?.name || `#${i}`;
const walk = (i, d, out, maxD) => {
  const n = g.nodes[i];
  const info = [];
  if (n.mesh !== undefined) info.push(`mesh=${g.meshes[n.mesh]?.name || n.mesh}`);
  if (n.scale) info.push(`scale=[${n.scale.map(x=>+x.toFixed(2)).join(',')}]`);
  if (n.translation) info.push(`t=[${n.translation.map(x=>+x.toFixed(2)).join(',')}]`);
  out.push(`${'  '.repeat(d)}${nameOf(i)}${info.length ? '  (' + info.join(' ') + ')' : ''}`);
  if (d < maxD) for (const c of (n.children || [])) walk(c, d + 1, out, maxD);
};
console.log(`\nscene roots: ${roots.map(nameOf).join(', ')}`);
const out = [];
for (const r of roots.slice(0, 4)) walk(r, 0, out, 1);
console.log(out.join('\n'));
