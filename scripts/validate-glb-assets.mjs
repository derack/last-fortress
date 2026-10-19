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
const audit = [];

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
  const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const binStart = jsonEnd + 8;
  for (const [i, accessor] of (doc.accessors ?? []).entries()) {
    if (!Number.isInteger(accessor.count) || accessor.count < 1) throw new Error(`accessor ${i} has invalid count`);
    const bv = doc.bufferViews[accessor.bufferView];
    const elementBytes = componentBytes[accessor.componentType] * componentCount[accessor.type];
    if (!elementBytes) throw new Error(`accessor ${i} has unsupported component/type`);
    const stride = bv.byteStride ?? elementBytes;
    const end = (accessor.byteOffset ?? 0) + (accessor.count - 1) * stride + elementBytes;
    if (end > bv.byteLength) throw new Error(`accessor ${i} reads beyond its bufferView`);
  }
  for (const [mi, mesh] of (doc.meshes ?? []).entries()) {
    for (const [pi, primitive] of mesh.primitives.entries()) {
      const attrs = primitive.attributes ?? {};
      const positionId = attrs.POSITION;
      if (positionId === undefined) throw new Error(`mesh ${mi} primitive ${pi} has no POSITION`);
      const vertexCount = doc.accessors[positionId].count;
      for (const key of ['NORMAL', 'TEXCOORD_0', 'TANGENT', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) {
        if (attrs[key] !== undefined && doc.accessors[attrs[key]].count !== vertexCount) {
          throw new Error(`mesh ${mi} primitive ${pi} attribute ${key} count does not match POSITION`);
        }
      }
      if (primitive.indices !== undefined) {
        const accessor = doc.accessors[primitive.indices];
        if (accessor.type !== 'SCALAR' || ![5121, 5123, 5125].includes(accessor.componentType)) {
          throw new Error(`mesh ${mi} primitive ${pi} has invalid index accessor`);
        }
        if ((primitive.mode ?? 4) === 4 && accessor.count % 3 !== 0) throw new Error(`mesh ${mi} primitive ${pi} triangle index count is not divisible by 3`);
        const bv = doc.bufferViews[accessor.bufferView];
        const offset = binStart + (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const bytesPerIndex = componentBytes[accessor.componentType];
        for (let k = 0; k < accessor.count; k++) {
          const at = offset + k * (bv.byteStride ?? bytesPerIndex);
          const index = accessor.componentType === 5121 ? view.getUint8(at)
            : accessor.componentType === 5123 ? view.getUint16(at, true) : view.getUint32(at, true);
          if (index >= vertexCount) throw new Error(`mesh ${mi} primitive ${pi} index ${index} exceeds vertex count ${vertexCount}`);
        }
      }
    }
  }
  const triangles = (doc.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives ?? []).reduce((inner, primitive) => {
    const accessor = primitive.indices !== undefined ? doc.accessors[primitive.indices] : doc.accessors[primitive.attributes?.POSITION];
    return inner + (primitive.indices !== undefined ? accessor.count / 3 : accessor.count / 3);
  }, 0), 0);
  checked.add(rel);
  return {
    rel, bytes: bytes.length, meshes: doc.meshes?.length ?? 0, nodes: doc.nodes.length,
    materials: doc.materials?.length ?? 0, textures: doc.images?.length ?? 0,
    skins: doc.skins?.length ?? 0, animations: doc.animations?.length ?? 0,
    triangles: Math.round(triangles),
  };
}

for (const url of referenced) {
  const file = path.join(root, 'public', (url.startsWith('/') ? url.slice(1) : url));
  if (!fs.existsSync(file)) {
    failures.push(`Missing manifest asset: public${url}`);
    continue;
  }
  try { audit.push(validate(file)); } catch (error) { failures.push(`${path.relative(root, file)}: ${error.message}`); }
}

const assetRoot = path.join(root, 'public/assets/3d');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb') && !checked.has(path.relative(root, full).replaceAll(path.sep, '/'))) {
      try { audit.push(validate(full)); } catch (error) { failures.push(`${path.relative(root, full)}: ${error.message}`); }
    }
  }
}
walk(assetRoot);
console.log(`Legacy GLB validation: ${checked.size} valid referenced files; ${referenced.length} manifest GLB references.`);
const textureless = audit.filter((item) => item.textures === 0).length;
const unriggedCombat = audit.filter((item) => /\/(?:enemies|bosses)\//.test(item.rel) && item.skins === 0).length;
const authoredCombatAnimations = audit.filter((item) => /\/(?:enemies|bosses)\//.test(item.rel) && item.animations > 0).length;
const totalTriangles = audit.reduce((sum, item) => sum + item.triangles, 0);
console.log(`Legacy GLB archive audit: ${audit.length} GLB files, ~${totalTriangles.toLocaleString()} source-mesh triangles; ${textureless} without embedded texture images.`);
console.log('Active enemy/boss roster is generated as rigged, animated glTF and is audited separately by validate-rigged-characters.mjs; these legacy GLB statistics do not describe the active roster.');
if (warnings.length) for (const warning of warnings) console.warn('WARN:', warning);
if (failures.length) {
  for (const failure of failures) console.error('FAIL:', failure);
  process.exitCode = 1;
} else {
  console.log('All manifest GLB paths exist and every discovered GLB passed structural checks.');
}
