#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src/game/assets/AssetManifest.ts');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const referenced = [...manifest.matchAll(/file:\s*'([^']+\.glb)'/g)].map((m) => m[1]);
const failures = [];
const warnings = [];
const checked = new Set();

function validate(file) {
  const bytes = fs.readFileSync(file);
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  if (bytes.length < 28) throw new Error('file is too small to be a GLB');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('invalid GLB magic');
  if (view.getUint32(4, true) !== 2) throw new Error('GLB version must be 2');
  if (view.getUint32(8, true) !== bytes.length) throw new Error('header length does not match file size');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('first chunk is not JSON');
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd + 8 > bytes.length) throw new Error('JSON chunk extends beyond file');
  const doc = JSON.parse(new TextDecoder().decode(bytes.subarray(jsonStart, jsonEnd)).trim());
  if (doc.asset?.version !== '2.0') throw new Error('asset.version must be 2.0');
  const binLength = view.getUint32(jsonEnd, true);
  if (view.getUint32(jsonEnd + 4, true) !== 0x004e4942) throw new Error('second chunk is not BIN');
  if (jsonEnd + 8 + binLength !== bytes.length) throw new Error('BIN chunk length does not match file size');
  if (!doc.scenes?.length || !doc.nodes?.length) throw new Error('scene or nodes missing');
  for (const [i, node] of doc.nodes.entries()) {
    if (node.mesh !== undefined && (!Number.isInteger(node.mesh) || node.mesh < 0 || node.mesh >= (doc.meshes?.length ?? 0))) {
      throw new Error(`node ${i} references invalid mesh ${node.mesh}`);
    }
    for (const child of node.children ?? []) if (!Number.isInteger(child) || child < 0 || child >= doc.nodes.length) {
      throw new Error(`node ${i} references invalid child ${child}`);
    }
  }
  for (const [i, mesh] of (doc.meshes ?? []).entries()) {
    if (!mesh.primitives?.length) throw new Error(`mesh ${i} has no primitives`);
    for (const primitive of mesh.primitives) {
      if (primitive.material !== undefined && (primitive.material < 0 || primitive.material >= (doc.materials?.length ?? 0))) {
        throw new Error(`mesh ${i} references invalid material`);
      }
      for (const accessor of [...Object.values(primitive.attributes ?? {}), primitive.indices].filter((x) => x !== undefined)) {
        if (!Number.isInteger(accessor) || accessor < 0 || accessor >= (doc.accessors?.length ?? 0)) {
          throw new Error(`mesh ${i} references invalid accessor ${accessor}`);
        }
      }
    }
  }
  for (const [i, accessor] of (doc.accessors ?? []).entries()) {
    if (!Number.isInteger(accessor.bufferView) || accessor.bufferView < 0 || accessor.bufferView >= (doc.bufferViews?.length ?? 0)) {
      throw new Error(`accessor ${i} references invalid bufferView`);
    }
    const bv = doc.bufferViews[accessor.bufferView];
    if ((bv.byteOffset ?? 0) + bv.byteLength > (doc.buffers?.[0]?.byteLength ?? 0)) {
      throw new Error(`bufferView for accessor ${i} exceeds declared buffer length`);
    }
  }
  checked.add(rel);
  return { rel, bytes: bytes.length, meshes: doc.meshes?.length ?? 0, nodes: doc.nodes.length, materials: doc.materials?.length ?? 0 };
}

for (const url of referenced) {
  const file = path.join(root, 'public', (url.startsWith('/') ? url.slice(1) : url));
  if (!fs.existsSync(file)) {
    failures.push(`Missing manifest asset: public${url}`);
    continue;
  }
  try { validate(file); } catch (error) { failures.push(`${path.relative(root, file)}: ${error.message}`); }
}

const assetRoot = path.join(root, 'public/assets/3d');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb') && !checked.has(path.relative(root, full).replaceAll(path.sep, '/'))) {
      try { validate(full); } catch (error) { failures.push(`${path.relative(root, full)}: ${error.message}`); }
    }
  }
}
walk(assetRoot);
console.log(`GLB validation: ${checked.size} valid files; ${referenced.length} manifest references.`);
if (warnings.length) for (const warning of warnings) console.warn('WARN:', warning);
if (failures.length) {
  for (const failure of failures) console.error('FAIL:', failure);
  process.exitCode = 1;
} else {
  console.log('All manifest GLB paths exist and every discovered GLB passed structural checks.');
}
