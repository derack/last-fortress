#!/usr/bin/env node
// ============================================================
// generate-tower-levels.mjs — تولید ۵ نسخه سطحی از هر GLB برج
// ------------------------------------------------------------
// مشکل: GLBهای برج یک مدل کامل «مکس» هستند و در همه سطوح ۱ تا ۵
// همان مدل نمایش داده می‌شد (لول ۱ شبیه مکس).
//
// راه‌حل: هر GLB برج را می‌خوانیم، به هر گره بر اساس نامش «کمینهٔ
// سطح» اختصاص می‌دهیم و برای هر سطح ۱..۵ یک GLB هرس‌شده با بافر
// بازسازی‌شده می‌سازیم: {id}_l{1..5}.glb
//   لول ۱: فقط هسته (پایه + بدنه + برجک + سلاح)
//   لول ۲: + پایه پرچ‌شده (baseCollar + BaseRivet*)
//   لول ۳: + بدنه تراش‌خورده (lowerTrim + ShaftFlute*)
//   لول ۴: + زره/سپر/تاج (armor, helmet, TurretSidePlate*, ...)
//   لول ۵: + شکوه نهایی (OrbitShard*, FireEmber*, VoidCrown, ...)
// گره‌های gameplay (turret, muzzlePoint, spinCrystal, spinRing,
// ember, chestPoint) همیشه حفظ می‌شوند (tier 1).
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'public/assets/3d/towers');
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

/** کمینه سطح قابل مشاهده هر گره بر اساس نام (case-insensitive) */
const TIER_RULES = [
  [2, /^baserivet/], [2, /^basecollar$/],
  [3, /^shaftflute/], [3, /^lowertrim$/],
  [4, /^armor$/], [4, /^helmet$/], [4, /^turretsideplate/], [4, /^shield$/],
  [4, /^icecrown$/], [4, /^crossbrace$/], [4, /^tensionbolt/],
  [4, /^outerpillar/], [4, /^pillarcapital$/],
  [5, /^orbitshard/], [5, /^flameouter$/], [5, /^fireember/], [5, /^frostshard/],
  [5, /^cannonbreech$/], [5, /^barrelrib/], [5, /^barreldetail/],
  [5, /^sidevial/], [5, /^vialneck/],
  [5, /^templefrontrelief$/], [5, /^templeroofridge$/],
  [5, /^voidshard/], [5, /^voidcrown$/],
];
function nodeTier(name) {
  const n = String(name ?? '').toLowerCase();
  for (const [tier, re] of TIER_RULES) if (re.test(n)) return tier;
  return 1;
}

// ---------------------------- GLB I/O ----------------------------
function parseGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`invalid GLB: ${file}`);
  const jsonLen = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON');
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
  let bin = null;
  const binStart = 20 + jsonLen;
  if (binStart + 8 <= bytes.length && bytes.readUInt32LE(binStart + 4) === 0x004e4942) {
    const binLen = bytes.readUInt32LE(binStart);
    bin = bytes.subarray(binStart + 8, binStart + 8 + binLen);
  }
  return { doc, bin };
}

function readAccessorData(doc, bin, acc) {
  const bv = doc.bufferViews[acc.bufferView];
  const compBytes = COMPONENT_BYTES[acc.componentType];
  const elemCount = TYPE_COUNT[acc.type];
  const elemBytes = compBytes * elemCount;
  const stride = bv.byteStride && bv.byteStride >= elemBytes ? bv.byteStride : elemBytes;
  const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out = new Uint8Array(acc.count * elemBytes);
  for (let i = 0; i < acc.count; i++) {
    out.set(bin.subarray(base + i * stride, base + i * stride + elemBytes), i * elemBytes);
  }
  return { bytes: out, componentType: acc.componentType, type: acc.type, count: acc.count };
}

/** min/max برای POSITION — برای frustum culling صحیح الزامی است */
function computeMinMaxVec3(data) {
  const f = new Float32Array(data.bytes.buffer, data.bytes.byteOffset, data.count * 3);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = f[i * 3 + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

function pad4(n) { return (n + 3) & ~3; }

function buildGlb(doc, bin) {
  const jsonStr = JSON.stringify(doc);
  const jsonBytes = Buffer.from(jsonStr + ' '.repeat(pad4(jsonStr.length) - jsonStr.length), 'utf8');
  const binBytes = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length, 0)]);
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBytes.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(out, 20);
  const at = 20 + jsonBytes.length;
  out.writeUInt32LE(binBytes.length, at);
  out.writeUInt32LE(0x004e4942, at + 4);
  binBytes.copy(out, at + 8);
  return out;
}

/** جمع مثلث‌های قابل‌رسیدن از درخت گره‌ها (per-instance) */
function triCount(doc) {
  let total = 0;
  const meshTris = (m) => (m.primitives ?? []).reduce((t, p) => {
    const acc = doc.accessors[p.indices ?? p.attributes.POSITION];
    return t + acc.count / 3;
  }, 0);
  const walk = (idx) => {
    const n = doc.nodes[idx];
    if (Number.isInteger(n.mesh) && doc.meshes[n.mesh]) total += meshTris(doc.meshes[n.mesh]);
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of doc.scenes[0].nodes) walk(r);
  return total;
}

/**
 * ساخت GLB یک سطح: درخت گره‌ها tier-aware هرس می‌شود، فرزندان گره‌های
 * واسطه حذف‌شده pull-up می‌شوند و bin فقط شامل accessorهای زنده است.
 */
function buildLevelVariant(srcDoc, srcBin, level) {
  const newNodes = [];

  const buildSubtreeInto = (oldIdx, outList) => {
    const node = srcDoc.nodes[oldIdx];
    const childNew = [];
    for (const c of node.children ?? []) buildSubtreeInto(c, childNew);
    if (nodeTier(node.name) > level) {
      outList.push(...childNew); // این گره حذف می‌شود ولی فرزندان سالم بالا کشیده می‌شوند
      return;
    }
    const copy = { ...node };
    if (childNew.length > 0) copy.children = childNew;
    else delete copy.children;
    outList.push(newNodes.push(copy) - 1);
  };

  const newSceneRoots = [];
  for (const r of srcDoc.scenes[0].nodes) buildSubtreeInto(r, newSceneRoots);
  if (newSceneRoots.length === 0) throw new Error(`level ${level}: empty scene after pruning`);

  // ---- mesh/accessor/material زنده ----
  const usedMeshes = new Set();
  for (const n of newNodes) if (Number.isInteger(n.mesh)) usedMeshes.add(n.mesh);
  const usedAccessors = new Set();
  const usedMaterials = new Set();
  for (const m of usedMeshes) {
    for (const prim of srcDoc.meshes[m].primitives ?? []) {
      for (const a of Object.values(prim.attributes ?? {})) usedAccessors.add(a);
      if (Number.isInteger(prim.indices)) usedAccessors.add(prim.indices);
      if (Number.isInteger(prim.material)) usedMaterials.add(prim.material);
    }
  }

  // ---- بازسازی bin — یک bufferView تازه برای هر accessor ----
  const newBinChunks = [];
  const newBufferViews = [];
  let binCursor = 0;
  const accRemap = new Map(); // oldAccessorIdx -> newAccessorIdx
  const compactAccessors = [];
  for (const oldAcc of [...usedAccessors].sort((a, b) => a - b)) {
    const srcAcc = srcDoc.accessors[oldAcc];
    const data = readAccessorData(srcDoc, srcBin, srcAcc);
    const pad = (4 - (binCursor % 4)) % 4;
    if (pad > 0) { newBinChunks.push(Buffer.alloc(pad, 0)); binCursor += pad; }
    const byteOffset = binCursor;
    newBinChunks.push(data.bytes);
    binCursor += data.bytes.length;
    const acc = {
      bufferView: newBufferViews.push({ buffer: 0, byteOffset, byteLength: data.bytes.length }) - 1,
      componentType: data.componentType,
      count: data.count,
      type: data.type,
    };
    if (data.type === 'VEC3' && data.componentType === 5126) {
      const mm = computeMinMaxVec3(data);
      acc.min = mm.min;
      acc.max = mm.max;
    }
    accRemap.set(oldAcc, compactAccessors.push(acc) - 1);
  }

  // ---- remap mesh/material + پرکردن نهایی ----
  const newMeshes = [];
  for (const oldMesh of [...usedMeshes].sort((a, b) => a - b)) {
    const prims = (srcDoc.meshes[oldMesh].primitives ?? []).map((prim) => {
      const attrs = {};
      for (const [k, a] of Object.entries(prim.attributes ?? {})) attrs[k] = accRemap.get(a);
      const out = { attributes: attrs, mode: prim.mode ?? 4 };
      if (Number.isInteger(prim.indices)) out.indices = accRemap.get(prim.indices);
      if (Number.isInteger(prim.material)) out.material = prim.material;
      return out;
    });
    newMeshes.push({ name: srcDoc.meshes[oldMesh].name, primitives: prims });
  }
  const newMaterials = [];
  const matRemap = new Map();
  for (const oldMat of [...usedMaterials].sort((a, b) => a - b)) {
    matRemap.set(oldMat, newMaterials.length);
    newMaterials.push(srcDoc.materials[oldMat]);
  }
  const meshRemap = new Map();
  for (const [i, m] of newMeshes.entries()) meshRemap.set([...usedMeshes].sort((a, b) => a - b)[i], i);
  for (const n of newNodes) {
    if (Number.isInteger(n.mesh)) n.mesh = meshRemap.get(n.mesh);
    delete n.skin; // برج‌ها بدون اسکلت
  }
  for (const m of newMeshes) {
    for (const prim of m.primitives) {
      if (Number.isInteger(prim.material)) prim.material = matRemap.get(prim.material);
    }
  }

  const outDoc = {
    asset: { ...srcDoc.asset, generator: 'Last Fortress Tower Level Pipeline' },
    scene: 0,
    scenes: [{ name: srcDoc.scenes[0]?.name, nodes: newSceneRoots }],
    nodes: newNodes,
    meshes: newMeshes,
    accessors: compactAccessors,
    bufferViews: newBufferViews,
    materials: newMaterials,
    buffers: [{ byteLength: binCursor }],
  };
  return buildGlb(outDoc, Buffer.concat(newBinChunks));
}

// ---------------------------- main ----------------------------
const files = fs.readdirSync(SRC_DIR).filter((f) => /^[\w]+\.glb$/.test(f) && !/_l\d\.glb$/.test(f));
let written = 0;
let totalBytes = 0;
for (const file of files) {
  const id = file.replace(/\.glb$/, '');
  const { doc, bin } = parseGlb(path.join(SRC_DIR, file));
  if (!bin) throw new Error(`${file}: no BIN chunk`);
  const srcTris = triCount(doc);
  for (let level = 1; level <= 5; level++) {
    const glb = buildLevelVariant(doc, bin, level);
    const out = path.join(SRC_DIR, `${id}_l${level}.glb`);
    fs.writeFileSync(out, glb);
    written++;
    totalBytes += glb.length;
    // self-check — خواندن مجدد و تایید ساختار
    const back = parseGlb(out);
    const tOut = triCount(back.doc);
    if (tOut <= 0) throw new Error(`${id}_l${level}: empty geometry`);
    if (level === 5 && tOut < srcTris * 0.98) {
      throw new Error(`${id}_l5: max level lost geometry (${tOut} < ${srcTris})`);
    }
    console.log(`  ${id}_l${level}.glb — ${(glb.length / 1024).toFixed(1)}KB, ${Math.round(tOut)} tris / src ${Math.round(srcTris)}`);
  }
}
console.log(`TOWER LEVELS READY — ${written} file, ${(totalBytes / 1024).toFixed(0)}KB total`);
