#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = fs.readFileSync(path.join(root, 'src/game/assets/AssetManifest.ts'), 'utf8');
const refs = [...manifest.matchAll(/file:\s*'([^']+\.gltf)'/g)].map(m => m[1]);
const failures = [];
let totalTriangles = 0, totalBytes = 0, totalPrimitives = 0;
const requiredClips = ['Idle','Walk','Run','Attack','Hit','Death'];
if (!refs.length) failures.push('No generated rigged glTF references found in AssetManifest.ts');
for (const url of refs) {
  const file = path.join(root, 'public', url.replace(/^\//, ''));
  try {
    if (!fs.existsSync(file)) throw new Error('asset file is missing (run generate-rigged-characters.mjs first)');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (doc.asset?.version !== '2.0') throw new Error('asset.version must be 2.0');
    if (!doc.nodes?.length || !doc.scenes?.length || !doc.skins?.length) throw new Error('scene, nodes, and a skin are required');
    if (!doc.buffers?.[0]?.uri?.startsWith('data:application/octet-stream;base64,')) throw new Error('expected self-contained base64 buffer');
    const binary = Buffer.from(doc.buffers[0].uri.split(',')[1], 'base64');
    if (binary.length !== doc.buffers[0].byteLength) throw new Error('embedded buffer length mismatch');
    totalBytes += fs.statSync(file).size;
    const skin = doc.skins[0];
    if (!skin.joints || skin.joints.length < 8) throw new Error('skeleton has too few joints');
    if (!Number.isInteger(skin.inverseBindMatrices) || !doc.accessors[skin.inverseBindMatrices]) throw new Error('inverse bind matrices missing');
    const animationNames = new Set((doc.animations ?? []).map(a => a.name));
    for (const clip of requiredClips) if (!animationNames.has(clip)) throw new Error('missing animation clip '+clip);
    if ((doc.animations ?? []).length < 6) throw new Error('expected at least six embedded animation clips');
    for (const [ni,node] of doc.nodes.entries()) {
      if (node.mesh !== undefined && (!Number.isInteger(node.mesh) || !doc.meshes?.[node.mesh])) throw new Error('node '+ni+' has invalid mesh reference');
      for (const child of node.children ?? []) if (!Number.isInteger(child) || child < 0 || child >= doc.nodes.length) throw new Error('node '+ni+' has invalid child');
    }
    for (const joint of skin.joints) if (!Number.isInteger(joint) || joint < 0 || joint >= doc.nodes.length) throw new Error('skin has invalid joint node');
    for (const [ai,a] of doc.accessors.entries()) {
      const bv = doc.bufferViews?.[a.bufferView];
      if (!bv) throw new Error('accessor '+ai+' has invalid bufferView');
      const sizes = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
      const counts = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
      const element = sizes[a.componentType] * counts[a.type];
      if (!element || !Number.isInteger(a.count) || a.count < 1) throw new Error('accessor '+ai+' has invalid shape');
      const end = (a.byteOffset ?? 0) + (a.count-1)*(bv.byteStride ?? element) + element;
      if (end > bv.byteLength || (bv.byteOffset ?? 0)+bv.byteLength > binary.length) throw new Error('accessor '+ai+' exceeds buffer bounds');
    }
    for (const [mi,mesh] of (doc.meshes ?? []).entries()) for (const [pi,p] of (mesh.primitives ?? []).entries()) {
      const attrs = p.attributes ?? {};
      for (const key of ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0']) if (!Number.isInteger(attrs[key])) throw new Error('mesh '+mi+' primitive '+pi+' lacks '+key);
      const vertexCount = doc.accessors[attrs.POSITION].count;
      for (const key of ['NORMAL','JOINTS_0','WEIGHTS_0']) if (doc.accessors[attrs[key]].count !== vertexCount) throw new Error(key+' count differs from POSITION');
      const jAccessor=doc.accessors[attrs.JOINTS_0], jView=doc.bufferViews[jAccessor.bufferView];
      const jOffset=(jView.byteOffset??0)+(jAccessor.byteOffset??0);
      const jData=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);
      for(let v=0;v<jAccessor.count;v++) for(let c=0;c<4;c++) {
        const ji=jData.getUint16(jOffset+(v*4+c)*2,true);
        if(ji>=skin.joints.length) throw new Error('vertex joint index out of skin range');
      }
      if (p.indices !== undefined) {
        const ia=doc.accessors[p.indices];
        if(ia.type!=='SCALAR'||![5121,5123,5125].includes(ia.componentType)||ia.count%3!==0) throw new Error('invalid triangle indices');
        const ibv=doc.bufferViews[ia.bufferView], off=(ibv.byteOffset??0)+(ia.byteOffset??0);
        const width=ia.componentType===5121?1:ia.componentType===5123?2:4;
        for(let i=0;i<ia.count;i++){
          const idx=width===1?binary.readUInt8(off+i):width===2?binary.readUInt16LE(off+i*2):binary.readUInt32LE(off+i*4);
          if(idx>=vertexCount) throw new Error('index out of vertex range');
        }
        totalTriangles+=ia.count/3;
      }
      totalPrimitives++;
    }
    for (const [ai,anim] of (doc.animations ?? []).entries()) {
      if (!anim.channels?.length || !anim.samplers?.length) throw new Error('animation '+anim.name+' has no channels');
      for (const channel of anim.channels) {
        if (!doc.nodes[channel.target?.node]) throw new Error('animation '+anim.name+' targets invalid node');
        if (!anim.samplers[channel.sampler]) throw new Error('animation '+anim.name+' targets invalid sampler');
      }
    }
  } catch (e) {
    failures.push(url+': '+e.message);
  }
}
console.log('Rigged glTF audit: '+refs.length+' manifest assets; '+totalPrimitives+' merged draw primitives; '+Math.round(totalTriangles).toLocaleString()+' triangles; '+(totalBytes/1024).toFixed(1)+' KiB JSON+embedded geometry.');
if (failures.length) {
  for (const failure of failures) console.error('FAIL:', failure);
  process.exitCode = 1;
} else {
  console.log('All generated enemy/boss models have valid skin data, embedded geometry, and Idle/Walk/Run/Attack/Hit/Death animation clips.');
}
