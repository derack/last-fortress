#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = fs.readFileSync(path.join(root, 'src/game/assets/AssetManifest.ts'), 'utf8');
const refs = [...manifest.matchAll(/file:\s*'([^']+\.gltf)'/g)].map(m => m[1]);
const failures = [];
let totalTriangles = 0, totalBytes = 0, totalPrimitives = 0;
const requiredClips = ['Idle','Walk','Run','Attack','Attack1','Attack2','SpecialAttack','Skill','Hit','Death','Roar','PhaseChange','Victory'];
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
    if (!Array.isArray(doc.images) || doc.images.length < 9) throw new Error('expected five material albedos plus normal, metallic-roughness, AO, and emissive images');
    if (!Array.isArray(doc.textures) || doc.textures.length < 9) throw new Error('expected nine PBR texture bindings');
    for (const [ii,image] of doc.images.entries()) {
      if (typeof image.uri !== 'string' || !image.uri.startsWith('data:image/png;base64,')) throw new Error('image '+ii+' is not embedded PNG data');
      const png = Buffer.from(image.uri.slice(image.uri.indexOf(',')+1), 'base64');
      if (png.length < 64 || png.readUInt32BE(0) !== 0x89504e47 || png.toString('ascii',1,4) !== 'PNG') throw new Error('image '+ii+' has invalid PNG signature');
      if (png.readUInt32BE(16) < 32 || png.readUInt32BE(20) < 32) throw new Error('image '+ii+' resolution unexpectedly small');
    }
    for (const [ti,texture] of doc.textures.entries()) if (!doc.images[texture.source] || !doc.samplers?.[texture.sampler]) throw new Error('texture '+ti+' has invalid source/sampler');
    const albedoSlots = (doc.materials ?? []).map(m => m.pbrMetallicRoughness?.baseColorTexture?.index);
    if (new Set(albedoSlots).size < 5) throw new Error('armor, edge, cloth, glow, and dark iron must use distinct albedo maps');
    if (albedoSlots.some(index => !Number.isInteger(index) || !doc.textures[index])) throw new Error('material albedo texture reference is invalid');
    for (const [mi,material] of (doc.materials ?? []).entries()) {
      const pbr = material.pbrMetallicRoughness ?? {};
      for (const [label,slot] of [['albedo',pbr.baseColorTexture],['metallic-roughness',pbr.metallicRoughnessTexture],['normal',material.normalTexture],['ambient-occlusion',material.occlusionTexture]]) {
        if (!Number.isInteger(slot?.index) || !doc.textures[slot.index]) throw new Error('material '+mi+' lacks valid '+label+' texture');
      }
    }
    const skin = doc.skins[0];
    if (!skin.joints || skin.joints.length < 24) throw new Error('skeleton must contain the articulated 24-joint character rig');
    if (!Number.isInteger(skin.inverseBindMatrices) || !doc.accessors[skin.inverseBindMatrices]) throw new Error('inverse bind matrices missing');
    const jointNames = new Set(skin.joints.map(index => doc.nodes[index]?.name));
    for (const required of ['Hips','Spine','Chest','Neck','Head','Arm_L','ForeArm_L','Hand_L','Arm_R','ForeArm_R','Hand_R','Leg_L','Knee_L','Foot_L','Leg_R','Knee_R','Foot_R','Tail','Wing_L','WingTip_L','Wing_R','WingTip_R','Jaw']) {
      if (!jointNames.has(required)) throw new Error('skeleton missing articulated joint '+required);
    }
    const animationNames = new Set((doc.animations ?? []).map(a => a.name));
    for (const clip of requiredClips) if (!animationNames.has(clip)) throw new Error('missing animation clip '+clip);
    if ((doc.animations ?? []).length < 6) throw new Error('expected at least six embedded animation clips');
    for (const [ni,node] of doc.nodes.entries()) {
      if (node.mesh !== undefined && (!Number.isInteger(node.mesh) || !doc.meshes?.[node.mesh])) throw new Error('node '+ni+' has invalid mesh reference');
      for (const child of node.children ?? []) if (!Number.isInteger(child) || child < 0 || child >= doc.nodes.length) throw new Error('node '+ni+' has invalid child');
    }
    for (const joint of skin.joints) if (!Number.isInteger(joint) || joint < 0 || joint >= doc.nodes.length) throw new Error('skin has invalid joint node');
    // Runtime CharacterFactory switches these variants at 22m and 38m.
    // Enforce populated groups and monotonically decreasing triangle budgets.
    const triangleCountForNode = (node) => (doc.meshes?.[node.mesh]?.primitives ?? []).reduce((sum,p) => {
      const a = doc.accessors[p.indices];
      return sum + (a?.count ?? 0) / 3;
    }, 0);
    const baseNodes = doc.nodes.filter(node => Number.isInteger(node.mesh) && !/(?:_LOD1|_LOD2)$/i.test(node.name ?? ''));
    const baseTriangles = baseNodes.reduce((sum,node) => sum + triangleCountForNode(node), 0);
    const lodGroup = (level) => doc.nodes.find(node => (node.name ?? '').toLowerCase().endsWith('_lod'+level));
    const lod1 = lodGroup(1), lod2 = lodGroup(2);
    if (!lod1 || !lod2 || !lod1.children?.length || !lod2.children?.length) throw new Error('expected populated LOD1 and LOD2 groups');
    const lodTriangles = (group) => group.children.reduce((sum,index) => sum + triangleCountForNode(doc.nodes[index]), 0);
    const lod1Triangles = lodTriangles(lod1), lod2Triangles = lodTriangles(lod2);
    if (!(baseTriangles > lod1Triangles && lod1Triangles > lod2Triangles && lod2Triangles > 0)) {
      throw new Error('LOD triangle budgets must decrease monotonically (base '+baseTriangles+', LOD1 '+lod1Triangles+', LOD2 '+lod2Triangles+')');
    }
    if (lod1Triangles > baseTriangles * 0.92) throw new Error('LOD1 must reduce at least 8% of source triangles');
    if (lod2Triangles > baseTriangles * 0.75) throw new Error('LOD2 must reduce at least 25% of source triangles');

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
      for (const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']) if (!Number.isInteger(attrs[key])) throw new Error('mesh '+mi+' primitive '+pi+' lacks '+key);
      const vertexCount = doc.accessors[attrs.POSITION].count;
      for (const key of ['NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']) if (doc.accessors[attrs[key]].count !== vertexCount) throw new Error(key+' count differs from POSITION');
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
    // Skin weights must be finite, non-negative, and sum to one for every vertex.
    for (const [mi,mesh] of (doc.meshes ?? []).entries()) for (const [pi,p] of (mesh.primitives ?? []).entries()) {
      const wa=doc.accessors[p.attributes.WEIGHTS_0], wv=doc.bufferViews[wa.bufferView];
      const off=(wv.byteOffset??0)+(wa.byteOffset??0);
      const view=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);
      for(let v=0;v<wa.count;v++) {
        let sum=0;
        for(let c=0;c<4;c++) {
          const weight=view.getFloat32(off+(v*4+c)*4,true);
          if(!Number.isFinite(weight)||weight<0) throw new Error('mesh '+mi+' primitive '+pi+' has invalid skin weight');
          sum+=weight;
        }
        if(Math.abs(sum-1)>0.001) throw new Error('mesh '+mi+' primitive '+pi+' has non-normalized skin weights');
      }
    }
    const jointSet=new Set(skin.joints);
    const animationMotion = new Map();
    for (const [ai,anim] of (doc.animations ?? []).entries()) {
      if (!anim.channels?.length || !anim.samplers?.length) throw new Error('animation '+anim.name+' has no channels');
      for (const channel of anim.channels) {
        if (!doc.nodes[channel.target?.node]) throw new Error('animation '+anim.name+' targets invalid node');
        if (!jointSet.has(channel.target.node)) throw new Error('animation '+anim.name+' targets a node outside the skin');
        if (!['translation','rotation','scale','weights'].includes(channel.target.path)) throw new Error('animation '+anim.name+' has invalid target path');
        const sampler=anim.samplers[channel.sampler];
        if (!sampler) throw new Error('animation '+anim.name+' targets invalid sampler');
        const input=doc.accessors[sampler.input], output=doc.accessors[sampler.output];
        if(!input||!output||input.type!=='SCALAR'||input.componentType!==5126) throw new Error('animation '+anim.name+' has invalid time accessor');
        if(input.count<2||output.count<input.count) throw new Error('animation '+anim.name+' has insufficient keyframes');
        if(channel.target.path==='rotation'&&output.type!=='VEC4') throw new Error('animation '+anim.name+' rotation output must be VEC4');
        if(['translation','scale'].includes(channel.target.path)&&output.type!=='VEC3') throw new Error('animation '+anim.name+' vector output must be VEC3');
        const iv=doc.bufferViews[input.bufferView], io=(iv.byteOffset??0)+(input.byteOffset??0);
        let previous=-Infinity;
        for(let k=0;k<input.count;k++) {
          const t=binary.readFloatLE(io+k*4);
          if(!Number.isFinite(t)||t<previous) throw new Error('animation '+anim.name+' keyframe times are not finite/ordered');
          previous=t;
        }
        const ov=doc.bufferViews[output.bufferView], oo=(ov.byteOffset??0)+(output.byteOffset??0);
        const width=output.type==='VEC4'?4:output.type==='VEC3'?3:output.type==='SCALAR'?1:output.type==='VEC2'?2:0;
        if(!width) throw new Error('animation '+anim.name+' has unsupported output accessor type');
        let changed=false;
        for(let k=1;k<output.count&&!changed;k++) for(let c=0;c<width;c++) {
          const a=binary.readFloatLE(oo+c*4), b=binary.readFloatLE(oo+(k*width+c)*4);
          if(!Number.isFinite(a)||!Number.isFinite(b)) throw new Error('animation '+anim.name+' contains non-finite keyframe values');
          if(Math.abs(a-b)>1e-5) changed=true;
        }
        if(changed) animationMotion.set(anim.name,true);
      }
    }
    for(const clip of requiredClips) if(!animationMotion.get(clip)) throw new Error('animation '+clip+' has no measurable skeletal motion');
  } catch (e) {
    failures.push(url+': '+e.message);
  }
}
console.log('Rigged glTF PBR audit: '+refs.length+' manifest assets; '+totalPrimitives+' merged draw primitives; '+Math.round(totalTriangles).toLocaleString()+' triangles; '+(totalBytes/1024).toFixed(1)+' KiB JSON+embedded geometry+five PNG maps per asset.');
if (failures.length) {
  for (const failure of failures) console.error('FAIL:', failure);
  process.exitCode = 1;
} else {
  console.log('All generated character models have valid skin data, embedded PBR maps, validated animation clips, and real LOD0/LOD1/LOD2 geometry with enforced triangle budgets.');
}
