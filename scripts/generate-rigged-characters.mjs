#!/usr/bin/env node
/**
 * Generates lightweight, rigged glTF character assets for Last Fortress.
 * Geometry is authored from deterministic low-poly primitives, merged by
 * joint/material to keep draw calls low. Each vertex is rigidly weighted to
 * a named joint; AnimationClips are embedded in the glTF and play through
 * Three.js AnimationMixer. This is a production-ready fallback art pipeline,
 * not a claim that procedural meshes equal hand-sculpted AAA art.
 */
import fs from 'node:fs';
import path from 'node:path';


import zlib from 'node:zlib';

// Small deterministic seamless PBR texture authoring. PNGs are embedded in the
// glTF so Android/Web builds never need extra texture requests.
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); table[n]=c>>>0; }
  return table;
})();
function pngCrc32(buf) {
  let c=0xffffffff;
  for(const b of buf) c=PNG_CRC_TABLE[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function pngChunk(type,data) {
  const name=Buffer.from(type), out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0); name.copy(out,4); data.copy(out,8);
  out.writeUInt32BE(pngCrc32(Buffer.concat([name,data])),8+data.length);
  return out;
}
function encodePng(width,height,rgba) {
  const rows=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) {
    const off=y*(width*4+1); rows[off]=0;
    Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(rows,off+1);
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0); header.writeUInt32BE(height,4);
  header[8]=8; header[9]=6; header[10]=0; header[11]=0; header[12]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',zlib.deflateSync(rows,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);
}
function makePbrImages(baseColor,accent,style,category='enemies') {
  // Build-specific, seamless material atlases: each surface gets its own
  // albedo; normal/MR/AO maps are shared per character to keep memory bounded.
  // Desktop keeps richer textures; Android builds use a deliberately smaller
  // texture tier to reduce decoded/GPU texture memory by roughly 4x.
  const mobileProfile = process.env.CAP_BUILD === '1' || process.env.ASSET_TEXTURE_PROFILE === 'mobile';
  const isLargeAsset = category === 'heroes' || category === 'bosses';
  // Ultra desktop/web tier: 512px hero/boss atlases and 256px standard units.
  // This adds 78% more texels per map than the previous desktop tier. Android stays
  // at 192px/96px to keep decoded GPU memory and frame-time budgets under control.
  // The emissive atlas is increased only on desktop; all dimensions are CI-validated.
  const size = mobileProfile ? (isLargeAsset ? 192 : 96) : (isLargeAsset ? 512 : 256);
  const emissiveSize = mobileProfile ? 64 : 192;
  const albedos=Array.from({length:5},()=>new Uint8Array(size*size*4));
  const normal=new Uint8Array(size*size*4), mr=new Uint8Array(size*size*4);
  const ao=new Uint8Array(size*size*4), emissive=new Uint8Array(emissiveSize*emissiveSize*4);
  const tau=Math.PI*2;
  const periodic=(x,y,fx,fy,phase=0)=>
    Math.sin(x/size*tau*fx+phase)*Math.cos(y/size*tau*fy-phase*.7);
  const isMetal=/machine|tank|lord|warrior|hunter|ranger|brute|annihilator/i.test(style);
  const isStone=/golem|crystal|tank|giant/i.test(style);
  const isCloth=/cloth|wraith|mage|spirit|summoner/i.test(style);
  const heightAt=(x,y)=>{
    const broad=periodic(x,y,3,4,.7)*.52+periodic(x,y,5,3,1.8)*.28+periodic(x,y,8,7,2.4)*.14;
    const medium=periodic(x,y,17,13,1.2)*.045+periodic(x,y,23,19,.4)*.028;
    const micro=periodic(x,y,47,31,.9)*.012+periodic(x,y,61,53,2.1)*.008
      +periodic(x,y,83,71,1.1)*.004+periodic(x,y,97,89,2.7)*.003;
    const brushed=isMetal?Math.sin(y/size*tau*92+Math.sin(x/size*tau*7)*.12)*.026
      +Math.sin(y/size*tau*147+Math.sin(x/size*tau*11)*.08)*.009:0;
    const scales=isStone?Math.pow(Math.max(0,Math.cos(x/size*tau*11+Math.sin(y/size*tau*5)*.42)),18)*.11
      +Math.pow(Math.max(0,Math.cos(x/size*tau*19+Math.sin(y/size*tau*9)*.28)),22)*.035:0;
    const weave=isCloth?periodic(x,y,29,37,.3)*.05+periodic(x,y,59,53,1.4)*.018:0;
    return broad*.13+medium+micro+brushed+scales+weave;
  };
  const color=n=>Math.max(0,Math.min(255,Math.round(n)));
  const profileShade=(profile,x,y,h,broad,plate)=>{
    const scratch=Math.pow(Math.max(0,Math.sin(x/size*tau*37+Math.sin(y/size*tau*9)*.3)),18)
      *(.5+.5*Math.cos(y/size*tau*5));
    const fineScratch=Math.pow(Math.max(0,Math.sin(x/size*tau*113+Math.sin(y/size*tau*17)*.22)),22)
      *(.5+.5*Math.cos(y/size*tau*13));
    const brushed=.5+.5*Math.sin(y/size*tau*88+Math.sin(x/size*tau*5)*.12);
    const weave=(.5+.5*Math.sin(x/size*tau*36))*(.5+.5*Math.sin(y/size*tau*44));
    const seam=Math.pow(Math.max(0,Math.cos(x/size*tau*8+Math.sin(y/size*tau*3)*.25)),48);
    const cracks=Math.pow(Math.max(0,Math.sin((x+y)/size*tau*13+periodic(x,y,3,4,.2))),12);
    if(profile===0) return Math.max(.68,Math.min(1.16,.91+h*1.5+broad*.025+plate*.055-seam*.085+scratch*.045+fineScratch*.018));
    if(profile===1) return Math.max(.72,Math.min(1.2,.96+h*1.2+brushed*.055+scratch*.07+fineScratch*.025));
    if(profile===2) return Math.max(.68,Math.min(1.14,.88+h*1.4+weave*.045+periodic(x,y,23,29,.4)*.025+fineScratch*.012));
    if(profile===3) return Math.max(.78,Math.min(1.2,.96+h*.9+cracks*.09+periodic(x,y,5,7,.7)*.025));
    return Math.max(.68,Math.min(1.08,.83+h*1.6+scratch*.035-seam*.025));
  };
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=(y*size+x)*4, h=heightAt(x,y);
    const broad=periodic(x,y,3,4,.7)*.52+periodic(x,y,5,3,1.8)*.28+periodic(x,y,8,7,2.4)*.14;
    const plate=Math.pow(Math.max(0,Math.cos(x/size*tau*11+Math.sin(y/size*tau*5)*.42)),18);
    for(let profile=0;profile<5;profile++) {
      const shade=profileShade(profile,x,y,h,broad,plate);
      const o=albedos[profile];
      o[i]=o[i+1]=o[i+2]=color(shade*255);o[i+3]=255;
    }
    const dx=(heightAt((x+1)%size,y)-heightAt((x+size-1)%size,y))*.5;
    const dy=(heightAt(x,(y+1)%size)-heightAt(x,(y+size-1)%size))*.5;
    let nx=-dx*8,ny=-dy*8,nz=1,len=Math.hypot(nx,ny,nz);
    normal[i]=color((nx/len*.5+.5)*255);
    normal[i+1]=color((ny/len*.5+.5)*255);
    normal[i+2]=color((nz/len*.5+.5)*255);normal[i+3]=255;
    mr[i]=255;
    // glTF MR convention: G=roughness, B=metalness.
    mr[i+1]=color(Math.max(96,Math.min(248,(isMetal?112:isStone?198:226)+h*120+broad*8)));
    mr[i+2]=color(Math.max(0,Math.min(255,(isMetal?226:isStone?38:12)+plate*22+h*80)));
    mr[i+3]=255;
    // Seamless cavity shading; no border darkening, so repeated tiles do not show seams.
    const cavity=Math.max(.76,Math.min(1,.96-Math.max(0,.1-h)*.35+Math.abs(broad)*.025));
    ao[i]=ao[i+1]=ao[i+2]=color(cavity*255);ao[i+3]=255;
  }
  const accentRgb=[(accent>>16)&255,(accent>>8)&255,accent&255];
  for(let y=0;y<emissiveSize;y++) for(let x=0;x<emissiveSize;x++) {
    const i=(y*emissiveSize+x)*4;
    const pulse=.84+.16*(.5+.5*Math.sin(x/emissiveSize*tau*7+Math.sin(y/emissiveSize*tau*5)));
    for(let c=0;c<3;c++) emissive[i+c]=color((accentRgb[c]/255)*pulse*255);
    emissive[i+3]=255;
  }
  return [
    ...albedos.map(map=>encodePng(size,size,map)),
    encodePng(size,size,normal),encodePng(size,size,mr),
    encodePng(size,size,ao),encodePng(emissiveSize,emissiveSize,emissive)
  ];
}
const OUT = path.join(process.cwd(), 'public/assets/3d/rigged');
fs.mkdirSync(OUT, { recursive: true });

const roster = [
  ['shadow','enemies',0x251c3b,0xb28cff,'wraith'],
  ['warrior','enemies',0x302b3d,0xff626c,'humanoid'],
  ['golem','enemies',0x5b5144,0xf2a65a,'golem'],
  ['spider','enemies',0x292936,0x9c73ff,'spider'],
  ['warlock','enemies',0x27223f,0xc084fc,'mage'],
  ['flyer','enemies',0x342747,0x83eaff,'flyer'],
  ['warMachine','enemies',0x38404b,0xffa44b,'machine'],
  ['aetherTank','enemies',0x34434b,0x63e6d2,'tank'],
  ['smallDragon','enemies',0x4c2b2c,0xff7043,'dragon'],
  ['crystalMonster','enemies',0x263d52,0x6ee7ff,'crystal'],
  ['hunter','enemies',0x3c3029,0xff9a52,'ranger'],
  ['destroyer','enemies',0x3c2831,0xff4f68,'brute'],
  ['summoner','enemies',0x30213e,0xd5a3ff,'mage'],
  ['spirit','enemies',0x26384b,0x9be7ff,'wraith'],
  ['shadowSoldier','enemies',0x292b3a,0xc5a3ff,'humanoid'],
  ['annihilator','enemies',0x292c35,0xff5858,'brute'],
  ['golemKing','bosses',0x635447,0xffb15c,'bossGolem'],
  ['fireGiant','bosses',0x522c2a,0xff5e35,'fireBoss'],
  ['iceGiant','bosses',0x29445a,0x8cecff,'iceBoss'],
  ['blackDragon','bosses',0x252334,0xc084fc,'dragonBoss'],
  ['darkLord','bosses',0x241f37,0xc17bff,'darkBoss'],
  // Playable heroes use the same validated skeleton contract but distinct silhouettes,
  // palette and signature gear. They are generated at build time with embedded PBR maps.
  ['arman','heroes',0x242b37,0xd7ad61,'warrior'],
  ['aria','heroes',0x26344b,0x69d9ff,'ranger'],
  ['radin','heroes',0x3c2928,0xff985b,'hunter'],
  ['nila','heroes',0x302447,0xe4a0ff,'mage'],
];
const jointNames = [
  'Root','Hips','Spine','Chest','Neck','Head',
  'Arm_L','ForeArm_L','Hand_L','Arm_R','ForeArm_R','Hand_R',
  'Leg_L','Knee_L','Foot_L','Leg_R','Knee_R','Foot_R',
  'Tail','Wing_L','WingTip_L','Wing_R','WingTip_R','Jaw',
  // Dedicated articulated limbs: eight independently animated spider legs.
  'SpiderLegL0','SpiderLegR0','SpiderLegL1','SpiderLegR1',
  'SpiderLegL2','SpiderLegR2','SpiderLegL3','SpiderLegR3',
  // Secondary tail pivots let dragon silhouettes flex rather than rotate as one rigid piece.
  'TailMid','TailTip'
];
const jointIndex = Object.fromEntries(jointNames.map((n,i)=>[n,i]));
const boneParents = [
  -1,0,1,2,3,4, 3,6,7,3,9,10, 1,12,13,1,15,16, 1,3,19,3,21,5,
  1,1,1,1,1,1,1,1,18,32
];
const boneLocal = [
  [0,0,0],[0,0.72,0],[0,0.34,0],[0,0.2,0],[0,0.23,0],[0,0.24,0],
  [-0.36,0.13,0],[-0.15,-0.25,0],[-0.04,-0.23,0.02],
  [0.36,0.13,0],[0.15,-0.25,0],[0.04,-0.23,0.02],
  [-0.16,-0.23,0],[0,-0.22,0],[0,-0.22,0.08],
  [0.16,-0.23,0],[0,-0.22,0],[0,-0.22,0.08],
  [0,-0.12,-0.25],[-0.31,0.28,-0.08],[-0.34,0,-0.12],
  [0.31,0.28,-0.08],[0.34,0,-0.12],[0,-0.14,0.12],
  // Each spider leg pivot is placed at the upper-leg joint in model space.
  [-0.50,-0.19,0.22],[0.50,-0.19,0.22],
  [-0.62,-0.19,0.00],[0.62,-0.19,0.00],
  [-0.73,-0.19,-0.22],[0.73,-0.19,-0.22],
  [-0.85,-0.19,-0.44],[0.85,-0.19,-0.44],
  [0,-0.08,-0.20],[0,-0.07,-0.22],
];
const boneWorld = [];
for (let i = 0; i < boneLocal.length; i++) {
  const p = boneLocal[i], parent = boneParents[i];
  boneWorld.push(parent < 0 ? [...p] : p.map((v, k) => v + boneWorld[parent][k]));
}

const v3=(x,y,z)=>[x,y,z];
function quat(axis, angle) {
  const h=angle/2, s=Math.sin(h), c=Math.cos(h);
  return axis==='x'?[s,0,0,c]:axis==='y'?[0,s,0,c]:[0,0,s,c];
}
function clampColor(c){return [((c>>16)&255)/255,((c>>8)&255)/255,(c&255)/255,1];}
function makeCharacter(id, category, baseColor, accent, styleInput) {
  // Normalize roster labels to the shared anatomy/animation archetypes. Keep `id`
  // separate so every named unit can still author signature equipment.
  const styleAliases = { warMachine: 'machine', aetherTank: 'tank', smallDragon: 'dragon', crystalMonster: 'crystal', destroyer: 'brute', annihilator: 'brute', spirit: 'wraith', shadowSoldier: 'humanoid', ranger: 'hunter', summoner: 'mage' };
  const style = styleAliases[styleInput] ?? styleInput;
  const pieces=[];
  const add=(kind, center, size, joint='Spine', material='armor', rotation=[0,0,0])=>
    pieces.push({kind,center,size,joint,material,rotation});
  const bodyHeight = category==='bosses'?2.85:2.05;
  const scale = category==='bosses'?1.35:1;
  const armor = 'armor', edge='edge', cloth='cloth', glow='glow', dark='dark';
  const sphere=(c,s,j,m,r)=>add('sphere',c,s,j,m,r);
  const box=(c,s,j,m,r)=>add('box',c,s,j,m,r);
  const cyl=(c,s,j,m,r)=>add('cylinder',c,s,j,m,r);
  const cone=(c,s,j,m,r)=>add('cone',c,s,j,m,r);
  // Core silhouette: each archetype keeps a different body language.
  if (style==='spider') {
    sphere([0,0.72,0],[0.52,0.35,0.62],'Hips',armor);
    sphere([0,1.08,0.28],[0.34,0.3,0.34],'Head',dark);
    for(let i=0;i<4;i++) for(const side of [-1,1]) {
      const x=side*(0.32+i*0.075), z=0.22-i*0.22;
      const spiderJoint='SpiderLeg'+(side<0?'L':'R')+i;
      cyl([x*1.55,0.53,z],[0.075,0.48,0.075],spiderJoint,edge,[0,0,side*(0.42+i*0.14)]);
      cone([x*1.8,0.29,z+0.08],[0.075,0.3,0.075],spiderJoint,armor,[0,0,side*0.3]);
    }
    for(const side of [-1,1]) sphere([side*0.13,1.12,0.55],[0.07,0.08,0.04],'Head',glow);
  } else if (style==='dragon'||style==='dragonBoss'||style==='flyer') {
    const boss=style==='dragonBoss';
    sphere([0,0.86,0],[boss?0.72:0.48,0.4,boss?0.92:0.65],'Spine',armor);
    sphere([0,1.13,0.55],[boss?0.38:0.29,0.27,0.43],'Head',armor,[0.18,0,0]);
    cone([-0.18,1.35,0.62],[0.1,0.28,0.1],'Head',edge,[0,0,-0.38]);
    cone([0.18,1.35,0.62],[0.1,0.28,0.1],'Head',edge,[0,0,0.38]);
    for(const side of [-1,1]) {
      sphere([side*0.43,1.0,-0.08],[0.48,0.075,0.37],side<0?'Wing_L':'Wing_R',armor,[0,0,side*0.28]);
      cone([side*0.58,0.99,-0.08],[0.32,0.045,0.24],side<0?'Wing_L':'Wing_R',edge,[0,0,side*0.22]);
      cyl([side*0.34,0.48,0.12],[0.16,0.48,0.16],side<0?'Leg_L':'Leg_R',armor,[0,0,side*0.12]);
      cone([side*0.34,0.25,0.26],[0.11,0.22,0.14],side<0?'Leg_L':'Leg_R',edge);
    }
    for(let i=0;i<5;i++) cone([0,1.08-i*0.13,-0.25-i*0.17],[0.09,0.22,0.1],i<2?'Tail':i<4?'TailMid':'TailTip',edge,[0.22,0,0]);
    for(const side of [-1,1]) cone([side*0.14,1.15,0.83],[0.07,0.22,0.07],'Jaw',glow,[0,0,side*0.24]);
  } else if (style==='golem'||style==='bossGolem'||style==='iceBoss'||style==='fireBoss') {
    const boss=style==='bossGolem'||style==='iceBoss'||style==='fireBoss';
    const w=boss?0.74:0.52, h=boss?0.72:0.55;
    box([0,0.95,0],[w,h,0.48],'Spine',armor,[0.02,0,0]);
    box([0,1.48,0.02],[w*0.76,h*0.72,0.44],'Head',armor);
    box([0,0.58,0],[w*0.88,0.22,0.43],'Hips',dark);
    for(const side of [-1,1]) {
      sphere([side*w*0.72,1.28,0],[boss?0.29:0.2,0.25,0.27],side<0?'Arm_L':'Arm_R',armor);
      box([side*w*0.78,0.91,0.02],[0.22,boss?0.62:0.45,0.25],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.06]);
      box([side*0.2,0.31,0],[0.25,0.47,0.28],side<0?'Leg_L':'Leg_R',armor);
      box([side*0.2,0.12,0.12],[0.32,0.16,0.42],side<0?'Leg_L':'Leg_R',dark);
      for(let i=0;i<3;i++) cone([side*(w*0.65+i*0.1),1.48+i*0.08,-0.08],[0.1,0.25,0.1],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.4]);
    }
    for(let i=0;i<(boss?5:3);i++) cone([0,1.58-i*0.13,0.29],[0.065,0.18,0.065],'Head',edge,[0.15,0,0]);
  } else {
    const heavy=['machine','tank','brute','darkBoss'].includes(style);
    const w=heavy?0.62:0.43, torsoY=style==='wraith'?0.92:1.0;
    if(style==='wraith') {
      sphere([0,torsoY,0],[0.4,0.58,0.32],'Spine',cloth);
      cone([0,0.43,-0.08],[0.32,0.54,0.32],'Hips',cloth,[Math.PI,0,0]);
      for(let i=0;i<4;i++) cone([(i-1.5)*0.15,0.33,-0.1],[0.07,0.35,0.07],'Tail',cloth,[0,0,(i-1.5)*0.12]);
    } else {
      box([0,torsoY,0],[w,heavy?0.75:0.58,heavy?0.43:0.34],'Spine',armor);
      box([0,0.63,0],[w*0.85,0.24,0.34],'Hips',dark);
      sphere([0,1.49,0.02],[heavy?0.3:0.23,heavy?0.31:0.25,0.25],'Head',armor);
      if(style==='mage') cone([0,1.84,0],[0.28,0.42,0.28],'Head',cloth);
      else {
        cone([-0.13,1.69,0.02],[0.07,0.25,0.07],'Head',edge,[0,0,-0.24]);
        cone([0.13,1.69,0.02],[0.07,0.25,0.07],'Head',edge,[0,0,0.24]);
      }
      for(const side of [-1,1]) {
        const arm=side<0?'Arm_L':'Arm_R', leg=side<0?'Leg_L':'Leg_R';
        sphere([side*(heavy?0.47:0.36),1.31,0],[heavy?0.25:0.18,0.22,0.22],arm,edge);
        cyl([side*(heavy?0.48:0.38),1.03,0.01],[heavy?0.19:0.13,0.43,0.15],arm,armor,[0,0,side*0.04]);
        box([side*(heavy?0.48:0.38),0.81,0.12],[0.22,0.17,0.23],arm,dark);
        box([side*0.16,0.36,0],[0.22,0.38,0.24],leg,armor,[0,0,side*0.035]);
        box([side*0.16,0.14,0.1],[0.28,0.16,0.38],leg,dark);
      }
    }
  }
  // Distinctive silhouette pass: authored per-archetype features, not just palette swaps.
  if (style==='crystal') {
    // Faceted geode growths around a visible core.
    for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/7, x=Math.cos(a)*0.34, z=Math.sin(a)*0.28;
      cone([x,1.08+(i%3)*0.12,z],[0.13,0.42+(i%2)*0.12,0.13],'Spine',i%2?glow:edge,[0,0,-a]);
    }
    cone([0,1.7,0.02],[0.16,0.34,0.16],'Head',glow,[0.08,0,0]);
    for(const side of [-1,1]) cone([side*0.43,0.84,-0.08],[0.12,0.32,0.12],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.38]);
  }
  if (style==='ranger') {
    // Hood, asymmetric shoulder mantle, quiver and paired blade fittings.
    cone([0,1.68,-0.03],[0.28,0.35,0.28],'Head',cloth,[0.08,0,0]);
    box([-0.26,1.32,-0.18],[0.25,0.42,0.18],'Arm_L',cloth,[0,0,-0.12]);
    cyl([-0.19,1.38,-0.28],[0.11,0.44,0.11],'Spine',dark,[0.18,0,0]);
    for(let i=0;i<5;i++) cone([-0.19,1.26+i*0.065,-0.28],[0.018,0.17,0.018],'Spine',edge,[0,0,0.06]);
    box([0.25,0.96,-0.21],[0.17,0.34,0.1],'Spine',dark,[0.12,0,0.1]);
  }
  if (style==='machine'||style==='tank') {
    // Mechanical shoulder housings, vent stacks, front plating and reactor rings.
    for(const side of [-1,1]) {
      box([side*0.39,1.45,-0.02],[0.32,0.24,0.42],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.08]);
      for(let v=0;v<4;v++) box([side*0.39,1.46+v*0.045,0.205],[0.22,0.018,0.025],side<0?'Arm_L':'Arm_R',dark);
      cyl([side*0.42,1.28,0.04],[0.14,0.34,0.14],side<0?'Arm_L':'Arm_R',dark,[Math.PI/2,0,0]);
    }
    box([0,1.02,0.24],[0.48,0.36,0.09],'Spine',edge);
    for(let i=0;i<3;i++) box([(i-1)*0.13,1.02,0.295],[0.045,0.23,0.018],'Spine',glow);
    if(style==='tank') for(const side of [-1,1]) {
      box([side*0.39,0.35,-0.02],[0.2,0.48,0.55],side<0?'Leg_L':'Leg_R',dark);
      for(let i=0;i<4;i++) cyl([side*0.4,0.18+i*0.105,0.27],[0.065,0.065,0.065],side<0?'Leg_L':'Leg_R',edge,[Math.PI/2,0,0]);
    }
  }
  if (style==='brute') {
    // Heavy cleaver blades, layered rib plates and oversized gauntlets.
    for(const side of [-1,1]) {
      box([side*0.5,1.0,0.08],[0.3,0.34,0.32],side<0?'Arm_L':'Arm_R',dark,[0,0,side*0.12]);
      cone([side*0.62,0.95,0.2],[0.16,0.52,0.09],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.2]);
    }
    for(let i=0;i<4;i++) box([0,0.83+i*0.105,0.235],[0.32-i*0.025,0.035,0.04],'Spine',edge);
  }
  if (style==='humanoid'||style==='darkBoss') {
    // Overlapping faulds and segmented shoulder/forearm plates.
    for(let i=0;i<3;i++) box([0,0.55-i*0.09,0.12],[0.52-i*0.07,0.075,0.28],'Hips',i===1?dark:edge,[0.04,0,0]);
    for(const side of [-1,1]) {
      cone([side*0.43,1.44,-0.02],[0.16,0.31,0.18],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.28]);
      box([side*0.43,0.91,0.16],[0.19,0.23,0.2],side<0?'Arm_L':'Arm_R',edge);
    }
  }
  if (style==='fireBoss'||style==='iceBoss'||style==='bossGolem') {
    // Distinct boss crown, layered mantle and oversized shoulder silhouettes.
    for(const side of [-1,1]) {
      sphere([side*0.64,1.4,-0.04],[0.34,0.28,0.32],side<0?'Arm_L':'Arm_R',edge);
      cone([side*0.72,1.63,-0.06],[0.15,0.44,0.15],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.22]);
    }
    for(let i=0;i<4;i++) box([(i-1.5)*0.17,0.9,0.27],[0.13,0.12,0.05],'Spine',i%2?edge:glow);
  }
  if (style==='darkBoss') {
    // Layered mantle and long ceremonial blade.
    cone([0,1.96,-0.04],[0.32,0.44,0.3],'Head',edge);
    for(let side of [-1,1]) cone([side*0.42,1.16,-0.2],[0.2,0.62,0.13],side<0?'Wing_L':'Wing_R',cloth,[0,0,side*0.14]);
    cone([0.69,1.4,0.05],[0.12,0.68,0.06],'Arm_R',edge,[0,0,-0.12]);
  }

  // Playable-hero signature equipment: distinct silhouettes and hand-attached gear.
  // These are real mesh pieces bound to the rig, not UI icons or floating VFX.
  if (id==='arman') {
    // Aegis shield on the left forearm and a broad, two-tone greatsword.
    box([-0.58,1.02,0.12],[0.34,0.62,0.12],'Arm_L',edge,[0,0,-0.08]);
    cone([-0.58,1.38,0.13],[0.16,0.18,0.14],'Arm_L',glow);
    box([-0.58,1.02,0.19],[0.22,0.43,0.035],'Arm_L',dark,[0,0,-0.08]);
    cone([0.61,1.49,0.05],[0.12,0.36,0.055],'Arm_R',edge,[0,0,-0.12]);
    box([0.61,1.24,0.05],[0.07,0.28,0.07],'Arm_R',dark,[0,0,-0.12]);
    sphere([0.61,1.08,0.05],[0.1,0.07,0.1],'Arm_R',glow);
  }
  if (id==='aria') {
    // Recurve bow limbs, grip, string and a back-mounted arrow quiver.
    for (const side of [-1,1]) {
      cyl([-0.58,1.25+side*0.18,0.08],[0.035,0.23,0.035],'Arm_L',edge,[0,0,side*0.22]);
      cone([-0.58+side*0.055,1.43,0.08],[0.035,0.1,0.035],'Arm_L',glow,[0,0,side*0.3]);
    }
    cyl([-0.58,1.25,0.09],[0.045,0.16,0.045],'Arm_L',dark);
    cyl([-0.58,1.25,0.115],[0.009,0.52,0.009],'Arm_L',edge,[0,0,0.04]);
    box([-0.2,1.03,-0.25],[0.18,0.38,0.16],'Spine',dark,[0.1,0,0.1]);
    for(let i=0;i<4;i++) cone([-0.2+i*0.035,1.26,-0.25],[0.018,0.28,0.018],'Spine',edge,[0,0,-0.08]);
  }
  if (id==='radin') {
    // Twin curved daggers, each attached to its own animated hand.
    for (const side of [-1,1]) {
      const hand=side<0?'Arm_L':'Arm_R';
      cyl([side*0.49,0.91,0.08],[0.045,0.22,0.045],hand,dark,[0,0,side*0.12]);
      cone([side*0.49,0.69,0.12],[0.075,0.3,0.045],hand,edge,[0,0,side*0.18]);
      cone([side*0.49,0.54,0.15],[0.035,0.11,0.035],hand,glow,[0,0,side*0.12]);
    }
    box([0,1.07,-0.2],[0.48,0.22,0.09],'Spine',dark,[0.12,0,0]);
  }
  if (id==='nila') {
    // Arcane staff, faceted crown and orbiting crystal prongs attached to the right hand.
    cyl([0.57,1.13,0.02],[0.045,1.15,0.045],'Arm_R',dark,[0,0,-0.08]);
    sphere([0.52,1.76,0.02],[0.15,0.18,0.15],'Arm_R',glow);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2;
      cone([0.52+Math.cos(a)*0.17,1.76+Math.sin(a)*0.17,0.02],[0.035,0.15,0.035],'Arm_R',edge,[0,0,a]);
    }
    for(let i=0;i<3;i++) cone([0.52,1.52+i*0.11,-0.08],[0.035,0.1,0.035],'Arm_R',glow,[0.12,0,0]);
    box([0,0.92,-0.2],[0.42,0.34,0.08],'Spine',cloth,[0.12,0,0]);
  }

  // Signature armor silhouette: layered shoulder plates, chest crest, bracers and boots.
  const boss=category==='bosses';
  if(!['spider','dragon','dragonBoss','flyer','wraith'].includes(style)) {
    for(const side of [-1,1]) {
      sphere([side*(boss?0.57:0.39),1.36,0.02],[boss?0.31:0.22,0.2,0.25],side<0?'Arm_L':'Arm_R',edge);
      box([side*0.2,0.45,0.15],[0.24,0.18,0.08],side<0?'Leg_L':'Leg_R',edge);
    }
    sphere([0,1.02,0.24],[boss?0.23:0.15,boss?0.25:0.17,0.09],'Spine',glow);
    box([0,1.05,0.245],[boss?0.42:0.3,0.11,0.045],'Spine',edge);
    for(let side of [-1,1]) {
      cyl([side*0.39,0.98,0.03],[0.16,0.17,0.16],side<0?'Arm_L':'Arm_R',dark);
      for(let i=0;i<3;i++) sphere([side*(0.13+i*0.08),0.75,0.18],[0.025,0.025,0.018],'Spine',edge);
    }
    // Distinct weapon silhouette weighted to the right arm joint.
    if(style==='mage' && id!=='summoner') {
      // The staff is bound to the hand, not the upper arm, so wrist motion
      // follows the attack clip and the grip remains visually coherent.
      cyl([0.55,1.0,0.03],[0.045,1.05,0.045],'Hand_R',dark);
      sphere([0.55,1.57,0.03],[0.15,0.15,0.15],'Hand_R',glow);
      for(let i=0;i<3;i++) cone([0.55+Math.cos(i*2.094)*0.19,1.57+Math.sin(i*2.094)*0.19,0.03],[0.035,0.14,0.035],'Hand_R',edge,[0,0,i*0.7]);
    } else if(id==='arman') {
      // Arman: oversized two-handed relic blade, gold fuller and crossguard.
      cyl([0.58,0.91,0.05],[0.055,0.48,0.055],'Hand_R',dark,[0,0,-0.12]);
      box([0.62,1.22,0.07],[0.13,0.48,0.065],'Hand_R',edge,[0,0,-0.12]);
      box([0.62,1.43,0.07],[0.22,0.045,0.075],'Hand_R',glow,[0,0,-0.12]);
      cone([0.62,1.49,0.07],[0.075,0.17,0.07],'Hand_R',edge,[0,0,-0.12]);
    } else if(id==='aria') {
      // Aria: recurved aether bow with luminous grip and twin limb tips.
      cyl([0.62,1.14,0.05],[0.035,0.52,0.035],'Hand_R',edge,[0,0,-0.18]);
      cyl([0.56,1.38,0.05],[0.028,0.25,0.028],'Hand_R',dark,[0,0,-0.45]);
      cyl([0.68,0.91,0.05],[0.028,0.25,0.028],'Hand_R',dark,[0,0,0.45]);
      cyl([0.62,1.14,0.075],[0.012,0.46,0.012],'Hand_R',glow);
      sphere([0.62,1.14,0.09],[0.055,0.065,0.045],'Hand_R',glow);
    } else if(id==='radin') {
      // Radin: compact arc-rifle, vented receiver and cyan energy barrel.
      box([0.65,1.08,0.12],[0.42,0.13,0.17],'Hand_R',dark,[0,0,-0.04]);
      cyl([0.75,1.08,0.27],[0.045,0.38,0.045],'Hand_R',edge,[Math.PI/2,0,0]);
      cyl([0.75,1.08,0.43],[0.065,0.1,0.065],'Hand_R',glow,[Math.PI/2,0,0]);
      box([0.56,0.96,0.1],[0.12,0.2,0.13],'Hand_R',edge,[0,0,-0.08]);
      for(let i=0;i<3;i++) box([0.57+i*0.07,1.16,0.15],[0.025,0.025,0.1],'Hand_R',glow);
    } else {
      cyl([0.58,0.92,0.05],[0.055,0.85,0.055],'Hand_R',dark,[0,0,-0.18]);
      box([0.68,1.22,0.05],[0.28,0.36,0.09],'Hand_R',edge,[0,0,-0.18]);
      cone([0.68,1.43,0.05],[0.07,0.18,0.07],'Hand_R',glow);
    }
  }
  // Boss crowns, back spines and multi-layer plates.
  if(boss) {
    for(let i=-2;i<=2;i++) cone([i*0.17,1.82, -0.12],[0.075,0.32,0.075],'Head',edge,[0,0,-i*0.17]);
    for(let i=0;i<5;i++) cone([(i-2)*0.17,1.1-i*0.08,-0.32],[0.09,0.24,0.09],'Tail',edge,[0.25,0,0]);
    for(const side of [-1,1]) {
      sphere([side*0.55,1.0,-0.18],[0.16,0.36,0.12],side<0?'Wing_L':'Wing_R',armor,[0,0,side*0.18]);
      cone([side*0.68,1.18,-0.18],[0.1,0.32,0.1],side<0?'Wing_L':'Wing_R',edge,[0,0,side*0.4]);
    }
  }
  // Signature silhouettes: authored per-archetype equipment, not one generic weapon
  // reused across the roster. Pieces are assigned to their animated joints.
  if (id==='warMachine') {
    // Arm-mounted siege cannon with muzzle rings, cooling vents and a glowing chamber.
    cyl([0.52,1.05,0.32],[0.19,0.68,0.19],'Arm_R',dark,[Math.PI/2,0,-0.08]);
    cyl([0.52,1.05,0.62],[0.235,0.14,0.235],'Arm_R',edge,[Math.PI/2,0,-0.08]);
    cyl([0.52,1.05,0.71],[0.15,0.08,0.15],'Arm_R',glow,[Math.PI/2,0,-0.08]);
    for(let i=0;i<4;i++) box([0.52+(i-1.5)*0.09,1.24,0.3],[0.035,0.18,0.12],'Arm_R',edge);
    box([0,1.08,-0.24],[0.5,0.22,0.12],'Spine',dark);
  } else if (id==='aetherTank') {
    // Heavy reactor pack, segmented shoulder guards and forward twin vents.
    box([0,1.16,-0.34],[0.62,0.74,0.22],'Spine',dark);
    for(let side of [-1,1]) {
      cyl([side*0.19,1.19,-0.47],[0.095,0.48,0.095],'Spine',glow);
      box([side*0.42,1.38,0.02],[0.2,0.3,0.32],side<0?'Arm_L':'Arm_R',edge);
      for(let i=0;i<3;i++) box([side*0.43,1.3-i*0.09,0.19],[0.13,0.025,0.035],side<0?'Arm_L':'Arm_R',dark);
    }
    sphere([0,1.06,0.29],[0.19,0.2,0.09],'Spine',glow);
  } else if (style==='crystal') {
    // Uneven crystal growths create an unmistakable jagged silhouette.
    for(let i=0;i<7;i++) {
      const side=i%2===0?-1:1, y=0.78+(i%3)*0.18, z=-0.2-(i%2)*0.08;
      cone([side*(0.18+(i%3)*0.12),y,z],[0.12+(i%2)*0.035,0.36+(i%3)*0.1,0.12],'Spine',i%3===0?glow:edge,[0,0,side*(0.18+(i%2)*0.12)]);
    }
    cone([0,1.73,0.02],[0.14,0.42,0.14],'Head',glow);
    for(let side of [-1,1]) cone([side*0.32,0.99,0.02],[0.12,0.3,0.12],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.25]);
  } else if (style==='hunter' && id!=='aria' && id!=='radin') {
    // Ranger's asymmetric hood, quiver and compact crossbow silhouette; Aria and Radin have their own authored loadouts above.
    cone([0,1.72,-0.02],[0.27,0.35,0.26],'Head',cloth,[0.12,0,0]);
    box([0,1.04,-0.29],[0.26,0.46,0.12],'Spine',dark,[0.12,0,0]);
    for(let i=0;i<5;i++) cone([(i-2)*0.045,1.18,-0.36],[0.018,0.36,0.018],'Spine',edge,[0.04,0,0]);
    box([0.58,1.12,0.08],[0.42,0.08,0.12],'Arm_R',edge,[0,0,-0.12]);
    for(let side of [-1,1]) cone([0.58+side*0.18,1.12,0.08],[0.035,0.22,0.04],'Arm_R',dark,[0,0,side*0.9]);
  } else if (id==='destroyer'||id==='annihilator') {
    // Oversized brutalist cleaver with a serrated counter-edge.
    box([0.64,1.05,0.12],[0.1,0.72,0.1],'Arm_R',dark,[0,0,-0.14]);
    box([0.78,1.31,0.1],[0.34,0.38,0.12],'Arm_R',edge,[0,0,-0.18]);
    for(let i=0;i<4;i++) cone([0.78+(i-1.5)*0.09,1.08,0.12],[0.055,0.16,0.07],'Arm_R',glow,[0,0,Math.PI]);
    if(id==='annihilator') for(let side of [-1,1]) cone([side*0.2,1.79,0.04],[0.09,0.42,0.09],'Head',edge,[0,0,side*0.34]);
  } else if (id==='summoner') {
    // Three rune rings and floating-looking focus stones orbit the staff head.
    cyl([0.57,1.12,0.02],[0.035,1.12,0.035],'Arm_R',dark);
    for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3;
      sphere([0.57+Math.cos(a)*0.2,1.62+Math.sin(a)*0.16,0.02],[0.075,0.075,0.075],'Arm_R',glow);
      cone([0.57+Math.cos(a)*0.25,1.62+Math.sin(a)*0.16,0.02],[0.035,0.13,0.035],'Arm_R',edge,[0,0,a]);
    }
    cone([0,1.88,0.02],[0.2,0.2,0.2],'Head',glow);
  } else if (style==='darkBoss') {
    // Layered mantle and crown spikes distinguish the final dark-lord silhouette.
    for(let side of [-1,1]) {
      box([side*0.25,0.92,-0.27],[0.34,0.88,0.14],'Spine',cloth,[0,0,side*0.12]);
      cone([side*0.18,1.92,-0.02],[0.075,0.42,0.075],'Head',glow,[0,0,side*0.22]);
      box([side*0.44,1.38,-0.08],[0.26,0.42,0.22],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.18]);
    }
    sphere([0,1.06,0.31],[0.22,0.28,0.07],'Spine',glow);
  } else if (style==='warrior'||style==='humanoid') {
    // Soldier-specific crest, cheek guards and layered chest insignia.
    box([0,1.77,0.015],[0.08,0.22,0.09],'Head',edge);
    for(let side of [-1,1]) {
      box([side*0.19,1.48,0.16],[0.09,0.18,0.1],'Head',dark,[0,0,side*0.12]);
      box([side*0.12,1.02,0.29],[0.065,0.26,0.045],'Spine',glow,[0,0,side*0.12]);
    }
  } else if (style==='spider') {
    // Carapace bands and forward mandibles add a readable arachnid face.
    for(let i=0;i<3;i++) box([0,0.74+i*0.12,-0.28],[0.46-i*0.07,0.035,0.08],'Hips',edge);
    for(let side of [-1,1]) cone([side*0.16,0.92,0.53],[0.075,0.22,0.08],'Head',edge,[0,0,side*0.48]);
  } else if (style==='dragon'||style==='dragonBoss'||style==='flyer') {
    // Wing spars and layered dorsal plates read as anatomy, not flat paddles.
    for(let side of [-1,1]) {
      for(let i=0;i<3;i++) cone([side*(0.28+i*0.14),1.04,-0.08-i*0.12],[0.055,0.23,0.055],side<0?'Wing_L':'Wing_R',edge,[0,0,side*(0.25+i*0.08)]);
      for(let i=0;i<4;i++) cone([side*0.16,1.08-i*0.12,-0.23-i*0.12],[0.065,0.18,0.07],'Spine',edge,[0.2,0,0]);
    }
  } else if (style==='wraith') {
    // Ragged layered spectral shroud and elongated crown.
    for(let i=0;i<5;i++) cone([(i-2)*0.13,0.68,-0.13],[0.075,0.55+(i%2)*0.18,0.08],'Tail',cloth,[0,0,(i-2)*0.12]);
    cone([0,1.43,0.02],[0.16,0.42,0.16],'Head',edge);
    sphere([0,0.92,0.24],[0.24,0.3,0.07],'Spine',glow);
  }

  // Eye lenses are placed against each archetype's actual head silhouette (not a shared floating coordinate).
  const eye = style==='spider' ? {y:1.12,z:0.55,x:0.13,r:0.055}
    : ['dragon','dragonBoss','flyer'].includes(style) ? {y:1.16,z:0.86,x:0.12,r:0.045}
    : style==='wraith' ? {y:1.04,z:0.27,x:0.105,r:0.045}
    : {y:1.51,z:0.23,x:0.09,r:0.045};
  sphere([-eye.x,eye.y,eye.z],[eye.r,eye.r*0.78,0.025],'Head',glow);
  sphere([eye.x,eye.y,eye.z],[eye.r,eye.r*0.78,0.025],'Head',glow);
  // Vent/rivet details only belong to bipedal armor silhouettes.
  if(!['spider','dragon','dragonBoss','flyer','wraith'].includes(style)) {
    for(let side of [-1,1]) for(let i=0;i<3;i++)
      sphere([side*(0.2+i*0.11),1.25-i*0.05,0.24],[0.025,0.025,0.025],side<0?'Arm_L':'Arm_R',glow);
  }
  // Tail joint has a visible articulated chain for beast/boss motion.
  if(['dragon','dragonBoss','spider','wraith'].includes(style)) {
    for(let i=0;i<4;i++) sphere([0,0.46-i*0.1,-0.42-i*0.16],[0.12-i*0.015,0.12-i*0.015,0.16],i<2?'Tail':i===2?'TailMid':'TailTip',i%2?armor:edge);
  }

  // Final identity pass: silhouettes and readable equipment are deliberately
  // authored per named unit, even when two units share the same rig archetype.
  // Every piece is attached to a real joint so its movement stays coherent.
  if (id==='shadow') {
    // Dual void daggers and asymmetric shoulder blades.
    for (const side of [-1,1]) {
      cyl([side*0.47,0.91,0.12],[0.035,0.34,0.035],'Hand_'+(side<0?'L':'R'),dark,[0,0,side*0.22]);
      cone([side*0.5,1.13,0.14],[0.07,0.28,0.045],'Hand_'+(side<0?'L':'R'),glow,[0,0,side*0.22]);
      cone([side*0.42,1.39,-0.05],[0.1,0.28,0.1],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.45]);
    }
  } else if (id==='warrior') {
    // Guard shield with a metal rim and central aether boss.
    box([-0.54,1.0,0.18],[0.12,0.58,0.4],'Arm_L',dark,[0,0,-0.08]);
    box([-0.56,1.0,0.205],[0.055,0.49,0.32],'Arm_L',edge,[0,0,-0.08]);
    sphere([-0.6,1.0,0.25],[0.045,0.11,0.11],'Arm_L',glow);
  } else if (id==='golem') {
    // Stone seams and heavy knuckle plates, distinct from the crowned king.
    for (let i=0;i<4;i++) box([(i-1.5)*0.105,1.0,0.251],[0.025,0.34,0.025],'Spine',glow,[0,0,(i%2?1:-1)*0.16]);
    for (const side of [-1,1]) box([side*0.58,0.72,0.08],[0.28,0.2,0.3],side<0?'Arm_L':'Arm_R',dark);
  } else if (id==='spider') {
    // Toxic dorsal shell, segmented abdomen and a forward venom sac.
    sphere([0,0.73,-0.3],[0.37,0.25,0.38],'Hips',dark);
    for(let i=0;i<5;i++) cone([(i-2)*0.13,0.98,-0.35],[0.065,0.24,0.07],'Hips',edge,[0.18,0,(i-2)*0.1]);
    sphere([0,0.91,0.48],[0.13,0.12,0.12],'Head',glow);
  } else if (id==='warlock') {
    // Arcane collar and a multi-ring focus at the staff hand.
    for(let i=0;i<3;i++) cone([0,1.65-i*0.09,-0.05],[0.29-i*0.035,0.06,0.25-i*0.025],'Chest',edge);
    sphere([0.5,1.55,0.09],[0.18,0.18,0.18],'Hand_L',glow);
    for(let i=0;i<4;i++) cone([0.5+Math.cos(i*Math.PI/2)*0.2,1.55+Math.sin(i*Math.PI/2)*0.2,0.09],[0.035,0.13,0.035],'Hand_L',edge,[0,0,i*Math.PI/2]);
  } else if (id==='flyer') {
    // Feathered wing tips and a forked tail vane make the aerial silhouette legible.
    for(const side of [-1,1]) for(let i=0;i<4;i++)
      cone([side*(0.48+i*0.12),0.99-i*0.035,-0.16-i*0.06],[0.07,0.24,0.035],side<0?'Wing_L':'Wing_R',i%2?edge:armor,[0,0,side*(0.45+i*0.08)]);
    cone([-0.1,0.42,-0.95],[0.12,0.28,0.07],'Tail',edge,[0,0,-0.25]);
    cone([0.1,0.42,-0.95],[0.12,0.28,0.07],'Tail',edge,[0,0,0.25]);
  } else if (id==='smallDragon') {
    // Short dragon gets a broad jaw, cheek horns and a visible dorsal crest.
    for(const side of [-1,1]) {
      cone([side*0.25,1.2,0.64],[0.09,0.28,0.09],'Head',edge,[0,0,side*0.55]);
      cone([side*0.24,1.03,0.78],[0.06,0.2,0.07],'Jaw',glow,[0,0,side*0.35]);
    }
    for(let i=0;i<6;i++) cone([0,1.22-i*0.13,-0.16-i*0.12],[0.07,0.2,0.07],'Tail',edge,[0.2,0,0]);
  } else if (id==='hunter') {
    // Recurve bow with a bright string channel and a quiver cap.
    for(const side of [-1,1]) cone([0.61+side*0.17,1.12,0.12],[0.04,0.28,0.04],'Hand_R',[0,1].includes(side)?edge:dark,[0,0,side*0.65]);
    cyl([0.61,1.12,0.12],[0.018,0.4,0.018],'Hand_R',glow,[0,0,-0.08]);
    box([0,1.26,-0.37],[0.22,0.08,0.12],'Spine',edge);
  } else if (id==='spirit') {
    // Floating spectral ribbons and a halo-like broken crown.
    for(let i=0;i<5;i++) cone([(i-2)*0.13,0.56,-0.2],[0.06,0.52+(i%2)*0.16,0.07],'Tail',i%2?glow:cloth,[0,0,(i-2)*0.16]);
    for(let i=0;i<3;i++) cone([(i-1)*0.16,1.52,0.02],[0.055,0.22,0.055],'Head',edge,[0,0,(i-1)*0.28]);
  } else if (id==='shadowSoldier') {
    // Twin forearm blades and a segmented stealth pauldron.
    for(const side of [-1,1]) {
      box([side*0.45,1.34,-0.02],[0.3,0.13,0.29],side<0?'Arm_L':'Arm_R',dark,[0,0,side*0.18]);
      cone([side*0.48,0.9,0.19],[0.06,0.35,0.05],side<0?'Hand_L':'Hand_R',glow,[0,0,side*0.1]);
    }
  } else if (id==='golemKing') {
    // Regal basalt crown, mantle medallion and oversized rune pauldrons.
    for(let i=-2;i<=2;i++) cone([i*0.15,1.98,0.02],[0.08,0.4,0.08],'Head',glow,[0,0,-i*0.14]);
    sphere([0,1.02,0.3],[0.26,0.28,0.08],'Chest',glow);
    for(const side of [-1,1]) box([side*0.67,1.37,-0.04],[0.25,0.35,0.3],side<0?'Arm_L':'Arm_R',dark,[0,0,side*0.14]);
  } else if (id==='fireGiant') {
    // Volcanic horns and layered ember vents.
    for(const side of [-1,1]) {
      cone([side*0.24,1.94,0.02],[0.13,0.42,0.12],'Head',glow,[0,0,side*0.42]);
      for(let i=0;i<3;i++) box([side*(0.18+i*0.08),1.05-i*0.08,0.27],[0.035,0.12,0.035],'Chest',glow);
    }
  } else if (id==='iceGiant') {
    // Faceted ice crown and crystalline shoulder growths.
    for(let i=0;i<7;i++) cone([(i-3)*0.11,1.94,0.02],[0.06,0.34+(i%3)*0.08,0.06],'Head',i%2?edge:glow,[0,0,(i-3)*0.12]);
    for(const side of [-1,1]) cone([side*0.65,1.36,-0.05],[0.13,0.42,0.13],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.28]);
  } else if (id==='blackDragon') {
    // Abyssal skull horns, segmented tail armor and wing talons.
    for(const side of [-1,1]) {
      cone([side*0.25,1.3,0.72],[0.12,0.38,0.1],'Head',edge,[0,0,side*0.48]);
      cone([side*0.52,0.94,-0.12],[0.08,0.34,0.06],side<0?'Wing_L':'Wing_R',glow,[0,0,side*0.3]);
    }
    for(let i=0;i<7;i++) cone([0,1.12-i*0.12,-0.24-i*0.13],[0.075,0.24,0.075],'Tail',edge,[0.22,0,0]);
    for(let i=0;i<5;i++) sphere([0,0.91-i*0.12,-0.35-i*0.12],[0.14-i*0.012,0.09,0.11],'Tail',dark);
  } else if (id==='darkLord') {
    // The Dark Lord is a duelist, not another horned brute: split ceremonial
    // mantle, elongated void blade, crown prongs and a bright chest sigil.
    for(const side of [-1,1]) {
      box([side*0.24,0.82,-0.24],[0.25,0.78,0.12],side<0?'Wing_L':'Wing_R',cloth,[0,0,side*0.12]);
      cone([side*0.35,1.54,-0.12],[0.07,0.28,0.07],'Head',glow,[0,0,side*0.32]);
      box([side*0.22,1.18,0.255],[0.06,0.25,0.045],'Spine',glow,[0,0,side*0.1]);
    }
    // Long asymmetrical sword with a crossguard and pommel, all bound to hand.
    cyl([0.66,1.02,0.04],[0.045,0.72,0.045],'Hand_R',dark,[0,0,-0.14]);
    box([0.68,1.4,0.04],[0.13,0.64,0.055],'Hand_R',edge,[0,0,-0.14]);
    box([0.68,1.13,0.05],[0.3,0.055,0.075],'Hand_R',glow,[0,0,-0.14]);
    cone([0.68,1.74,0.04],[0.09,0.2,0.07],'Hand_R',glow,[0,0,-0.14]);
    sphere([0,1.04,0.32],[0.12,0.16,0.06],'Chest',glow);
  }

  // Boss signature kits: silhouette-first, identity-specific geometry.
  // Every attachment is weighted to its animated joint and merged by material,
  // so the added silhouette detail does not create one draw call per ornament.
  if (id === 'golemKing') {
    for (const side of [-1,1]) {
      box([side*0.62,1.42,-0.03],[0.36,0.48,0.44],side<0?'Arm_L':'Arm_R',armor,[0,0,side*0.14]);
      for(let i=0;i<3;i++) cone([side*(0.52+i*0.14),1.68-i*0.06,-0.08],[0.13,0.34,0.13],side<0?'Arm_L':'Arm_R',edge,[0,0,side*(0.32+i*0.12)]);
      box([side*0.19,0.88,0.25],[0.18,0.24,0.07],'Spine',edge,[0,0,side*0.12]);
    }
    // Ancient crown and a broad rune-carved chest plate.
    box([0,1.67,0.18],[0.46,0.19,0.13],'Head',dark);
    for(let i=-2;i<=2;i++) cone([i*0.16,1.82,0.04],[0.09,0.31,0.09],'Head',edge,[0,0,-i*0.12]);
    sphere([0,1.08,0.31],[0.18,0.22,0.06],'Chest',glow);
    for(let i=-1;i<=1;i++) box([i*0.11,1.08,0.36],[0.035,0.12,0.025],'Chest',edge,[0,0,i*0.12]);
  } else if (id === 'fireGiant') {
    // Volcanic shoulder mantle, swept horns, and layered ember vents.
    for(const side of [-1,1]) {
      sphere([side*0.64,1.48,-0.02],[0.34,0.28,0.36],side<0?'Arm_L':'Arm_R',dark);
      for(let i=0;i<4;i++) cone([side*(0.48+i*0.13),1.66-i*0.07,-0.02],[0.11,0.34-i*0.025,0.11],side<0?'Arm_L':'Arm_R',glow,[0,0,side*(0.36+i*0.08)]);
      cone([side*0.17,1.78,0.02],[0.12,0.35,0.12],'Head',edge,[0,0,side*0.48]);
    }
    box([0,1.08,0.29],[0.4,0.38,0.12],'Chest',dark);
    for(let i=-1;i<=1;i++) box([i*0.13,1.08,0.37],[0.065,0.24,0.045],'Chest',glow,[0,0,i*0.08]);
    for(let i=0;i<4;i++) cone([(i-1.5)*0.13,0.82,-0.29],[0.085,0.26,0.09],'Tail',glow,[0.24,0,0]);
  } else if (id === 'iceGiant') {
    // Faceted frost pauldrons and long ice crown create a crystalline outline.
    for(const side of [-1,1]) {
      box([side*0.62,1.45,-0.02],[0.38,0.36,0.42],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.1]);
      for(let i=0;i<4;i++) cone([side*(0.47+i*0.13),1.66-i*0.05,-0.04],[0.08,0.42-i*0.04,0.08],side<0?'Arm_L':'Arm_R',glow,[0,0,side*(0.25+i*0.09)]);
      cone([side*0.15,1.78,0.06],[0.09,0.38,0.09],'Head',glow,[0,0,side*0.32]);
    }
    for(let i=-2;i<=2;i++) cone([i*0.15,1.84,0.0],[0.07,0.4,0.07],'Head',edge,[0,0,-i*0.09]);
    sphere([0,1.08,0.31],[0.2,0.25,0.06],'Chest',glow);
    for(let i=-1;i<=1;i++) cone([i*0.14,0.91,0.28],[0.055,0.21,0.055],'Chest',edge,[0.15,0,0]);
  } else if (id === 'blackDragon') {
    // Additional articulated dorsal scutes, jaw armor, and wing claws.
    for(let i=0;i<7;i++) cone([0,1.12-i*0.07,-0.22-i*0.16],[0.12-i*0.006,0.28,0.12-i*0.006],'Tail',edge,[0.24,0,0]);
    for(const side of [-1,1]) {
      cone([side*0.28,1.15,0.82],[0.11,0.32,0.1],'Head',dark,[0,0,side*0.3]);
      for(let i=0;i<3;i++) cone([side*(0.48+i*0.12),0.98-i*0.08,-0.12],[0.07,0.27,0.055],side<0?'Wing_L':'Wing_R',edge,[0,0,side*(0.2+i*0.1)]);
      sphere([side*0.14,1.18,0.88],[0.055,0.045,0.03],'Head',glow);
    }
    cone([0,0.83,0.72],[0.12,0.25,0.12],'Jaw',dark,[0.18,0,0]);
  } else if (id === 'darkLord') {
    // Asymmetric crown, back-mounted void blades, and layered chest sigil.
    for(let i=-2;i<=2;i++) {
      cone([i*0.13,1.85,0.02],[0.065,0.3+(i===0?0.12:0),0.065],'Head',edge,[0,0,-i*0.16]);
    }
    for(const side of [-1,1]) {
      cone([side*0.56,1.18,-0.26],[0.13,0.66,0.08],side<0?'Wing_L':'Wing_R',armor,[0,0,side*0.28]);
      cone([side*0.62,1.48,-0.22],[0.09,0.36,0.07],side<0?'Wing_L':'Wing_R',glow,[0,0,side*0.34]);
    }
    sphere([0,1.08,0.31],[0.2,0.24,0.07],'Chest',glow);
    box([0,1.08,0.36],[0.32,0.06,0.035],'Chest',edge);
    for(let i=0;i<3;i++) sphere([0,0.98-i*0.1,0.34],[0.035,0.035,0.025],'Chest',glow);
  }

  // Named-unit silhouette pass: readable signature gear and anatomy.
  // Every unit receives authored-from-code identifying forms, not only a palette swap.
  if (id==='warMachine') {
    for(let i=-1;i<=1;i++) {
      cyl([i*0.18,1.12,0.36],[0.065,0.48,0.065],'Arm_R',dark);
      cyl([i*0.18,1.32,0.36],[0.085,0.09,0.085],'Arm_R',edge);
    }
    box([0,1.0,-0.25],[0.68,0.28,0.16],'Spine',dark);
    for(let side of [-1,1]) box([side*0.36,0.38,0],[0.2,0.5,0.42],'Leg_'+(side<0?'L':'R'),dark);
  } else if (id==='aetherTank') {
    box([0,1.16,-0.18],[0.78,0.38,0.62],'Spine',edge);
    cyl([0,1.27,0.34],[0.13,0.56,0.13],'Arm_R',dark,[Math.PI/2,0,0]);
    sphere([0,1.27,0.62],[0.2,0.2,0.2],'Arm_R',glow);
    for(let side of [-1,1]) {
      box([side*0.43,0.38,0],[0.18,0.52,0.55],'Leg_'+(side<0?'L':'R'),dark);
      for(let n=0;n<4;n++) cyl([side*0.44,0.2+n*0.12,0.16],[0.045,0.08,0.045],'Leg_'+(side<0?'L':'R'),edge,[0,0,Math.PI/2]);
    }
  } else if (id==='crystalMonster') {
    for(let i=0;i<7;i++) {
      const a=i/7*Math.PI*2;
      cone([Math.cos(a)*0.36,1.1+Math.sin(i*1.7)*0.16,Math.sin(a)*0.32],[0.13,0.48+(i%3)*0.12,0.13],'Spine',i%2?glow:edge,[Math.sin(a)*0.2,0,Math.cos(a)*0.2]);
    }
    cone([0,1.72,0.02],[0.13,0.35,0.13],'Head',glow);
  } else if (id==='hunter' || id==='radin') {
    // Ranger shoulder mantle and split bow limbs.
    box([0,1.42,-0.12],[0.66,0.2,0.18],'Chest',cloth,[0.08,0,0]);
    for(let side of [-1,1]) {
      cone([side*0.16,1.13,0.34],[0.045,0.26,0.045],'Spine',glow,[0,0,side*0.12]);
      cyl([0.64,1.03,0.05],[0.035,0.72,0.035],'Hand_R',edge,[0,0,-0.2]);
    }
  } else if (id==='warlock' || id==='summoner' || id==='nila') {
    // Arcane staff head with three independently readable crystal prongs.
    cyl([0.62,0.91,-0.02],[0.035,0.9,0.035],'Hand_R',dark,[0,0,-0.08]);
    sphere([0.62,1.43,-0.02],[0.13,0.16,0.13],'Hand_R',glow);
    for(let n=0;n<3;n++) {
      const a=n*Math.PI*2/3;
      cone([0.62+Math.cos(a)*0.16,1.43+Math.sin(a)*0.16,-0.02],[0.04,0.16,0.04],'Hand_R',edge,[0,0,a]);
    }
  } else if (id==='spider') {
    // Eight visibly separated articulated leg tips and a segmented abdomen.
    sphere([0,0.68,-0.32],[0.38,0.27,0.4],'Hips',edge);
    for(let side of [-1,1]) for(let n=0;n<4;n++) {
      const x=side*(0.42+n*0.035), z=0.28-n*0.2;
      sphere([x*1.65,0.42,z],[0.065,0.07,0.07],'Leg_'+(side<0?'L':'R'),glow);
    }
  } else if (id==='golemKing') {
    for(let side of [-1,1]) {
      cone([side*0.56,1.75,0.04],[0.18,0.55,0.17],'Head',edge,[0,0,side*0.28]);
      box([side*0.58,1.12,-0.12],[0.25,0.48,0.3],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.2]);
    }
    sphere([0,1.1,0.29],[0.3,0.29,0.12],'Chest',glow);
  } else if (id==='fireGiant') {
    for(let side of [-1,1]) {
      cone([side*0.23,1.72,0.03],[0.13,0.42,0.12],'Head',glow,[0,0,side*0.35]);
      cone([side*0.55,1.18,-0.08],[0.13,0.44,0.13],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.42]);
    }
    for(let n=0;n<5;n++) sphere([(n-2)*0.12,0.95,0.28],[0.055,0.12,0.045],'Chest',glow);
  } else if (id==='iceGiant') {
    for(let n=0;n<7;n++) {
      const x=(n-3)*0.18;
      cone([x,1.65+(n%2)*0.1,-0.13],[0.08,0.42+(n%3)*0.08,0.08],'Head',n%2?glow:edge,[0,0,-x*0.7]);
    }
    for(let side of [-1,1]) cone([side*0.48,1.16,-0.08],[0.12,0.42,0.12],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.3]);
  } else if (id==='blackDragon' || id==='smallDragon') {
    for(let side of [-1,1]) {
      cone([side*0.23,1.34,0.72],[0.1,0.38,0.1],'Head',edge,[0,0,side*0.45]);
      for(let n=0;n<4;n++) cone([side*(0.28+n*0.09),0.98-n*0.1,-0.18-n*0.11],[0.07,0.24,0.07],'Tail',edge,[0.2,0,side*0.18]);
    }
  } else if (id==='darkLord') {
    for(let side of [-1,1]) {
      cone([side*0.18,1.82,0.02],[0.075,0.42,0.075],'Head',glow,[0,0,side*0.28]);
      box([side*0.52,1.34,-0.04],[0.28,0.36,0.16],side<0?'Wing_L':'Wing_R',edge,[0,0,side*0.22]);
    }
    box([0,0.96,0.27],[0.34,0.4,0.08],'Spine',glow);
  } else if (id==='arman') {
    // Hero crest, layered pauldrons and sword guard.
    box([0,1.45,0.2],[0.18,0.22,0.08],'Chest',glow);
    for(let side of [-1,1]) {
      cone([side*0.43,1.38,0.02],[0.16,0.3,0.18],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.2]);
      sphere([side*0.18,0.8,0.2],[0.07,0.09,0.035],'Spine',glow);
    }
  } else if (id==='aria') {
    box([0,1.45,-0.1],[0.52,0.24,0.2],'Chest',edge,[0.08,0,0]);
    for(let side of [-1,1]) cone([side*0.24,1.55,-0.08],[0.09,0.32,0.09],'Chest',glow,[0,0,side*0.2]);
  } else if (id==='nila') {
    for(let n=0;n<4;n++) sphere([(n-1.5)*0.12,1.0,0.27],[0.035,0.035,0.025],'Chest',glow);
  } else if (id==='destroyer' || id==='annihilator') {
    for(let side of [-1,1]) {
      box([side*0.48,1.34,-0.04],[0.32,0.27,0.28],side<0?'Arm_L':'Arm_R',edge,[0,0,side*0.16]);
      cone([side*0.5,1.5,-0.03],[0.13,0.32,0.13],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.4]);
    }
    box([0,1.04,0.26],[0.3,0.32,0.07],'Spine',glow);
  } else if (id==='shadow' || id==='spirit') {
    for(let side of [-1,1]) cone([side*0.28,1.18,-0.1],[0.08,0.42,0.08],'Spine',glow,[0,0,side*0.4]);
    for(let n=0;n<3;n++) cone([(n-1)*0.16,0.25,-0.05],[0.06,0.3,0.06],'Tail',edge,[0,0,(n-1)*0.18]);
  } else if (id==='flyer') {
    for(let side of [-1,1]) {
      sphere([side*0.5,0.92,-0.05],[0.32,0.08,0.42],side<0?'Wing_L':'Wing_R',edge,[0,0,side*0.3]);
      cone([side*0.64,0.92,-0.1],[0.1,0.42,0.1],side<0?'Wing_L':'Wing_R',glow,[0,0,side*0.5]);
    }
  } else if (id==='shadowSoldier') {
    box([0,1.03,0.24],[0.33,0.38,0.08],'Spine',edge);
    for(let side of [-1,1]) cone([side*0.44,1.37,0.02],[0.12,0.32,0.12],side<0?'Arm_L':'Arm_R',glow,[0,0,side*0.3]);
  }
  const materials = [
    {name:'Obsidian Armor',pbrMetallicRoughness:{baseColorFactor:clampColor(baseColor),metallicFactor:0.62,roughnessFactor:0.38}},
    {name:'Forged Edge',pbrMetallicRoughness:{baseColorFactor:[0.63,0.7,0.8,1],metallicFactor:0.88,roughnessFactor:0.24}},
    {name:'Woven/Hide',pbrMetallicRoughness:{baseColorFactor:[0.16,0.13,0.2,1],metallicFactor:0.08,roughnessFactor:0.9}},
    {name:'Aether Core',pbrMetallicRoughness:{baseColorFactor:clampColor(accent),metallicFactor:0.22,roughnessFactor:0.2},emissiveFactor:clampColor(accent).slice(0,3),extensions:{KHR_materials_emissive_strength:{emissiveStrength:1.8}}},
    {name:'Dark Iron',pbrMetallicRoughness:{baseColorFactor:[0.07,0.08,0.12,1],metallicFactor:0.76,roughnessFactor:0.34}},
  ];
  const pbrPngs = makePbrImages(baseColor,accent,style,category);
  const imageUris = pbrPngs.map(png => 'data:image/png;base64,'+png.toString('base64'));
  const textures = Array.from({length:9},(_,i)=>({sampler:0,source:i}));
  const albedoTextureIndex={armor:0,edge:1,cloth:2,glow:3,dark:4};
  for (const [materialName,mat] of [['armor',materials[0]],['edge',materials[1]],['cloth',materials[2]],['glow',materials[3]],['dark',materials[4]]]) {
    mat.pbrMetallicRoughness.baseColorTexture={index:albedoTextureIndex[materialName]};
    mat.pbrMetallicRoughness.metallicRoughnessTexture={index:6};
    mat.normalTexture={index:5,scale:0.7};
    mat.occlusionTexture={index:7,strength:0.28};
  }
  materials[3].emissiveTexture={index:8};
  const materialIndex={armor:0,edge:1,cloth:2,glow:3,dark:4};
  // Build low-poly primitives in character/model space.
  const buildPrimitive=(piece,lodLevel=0)=>{
    const pos=[],norm=[],uv=[],indices=[];
    const [cx,cy,cz]=piece.center,[sx,sy,sz]=piece.size;
    const rot=piece.rotation||[0,0,0];
    const rotate=(p)=>{
      let [x,y,z]=p; const [rx,ry,rz]=rot;
      let yy=y*Math.cos(rx)-z*Math.sin(rx), zz=y*Math.sin(rx)+z*Math.cos(rx); y=yy;z=zz;
      let xx=x*Math.cos(ry)+z*Math.sin(ry); zz=-x*Math.sin(ry)+z*Math.cos(ry); x=xx;z=zz;
      xx=x*Math.cos(rz)-y*Math.sin(rz); yy=x*Math.sin(rz)+y*Math.cos(rz); x=xx;y=yy;
      return [x+cx,y+cy,z+cz];
    };
    const pushTri=(a,b,c)=>{
      const ab=b.map((v,i)=>v-a[i]), ac=c.map((v,i)=>v-a[i]);
      let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      const l=Math.hypot(...n)||1; n=n.map(v=>v/l);
      // Dominant-axis planar UV projection: top surfaces use XZ, side faces use
      // XY/YZ. This avoids the stretched horizontal stripes caused by applying
      // XZ UVs to every vertical armor plate, weapon, and limb.
      const ax=Math.abs(n[0]), ay=Math.abs(n[1]), az=Math.abs(n[2]);
      const project=(p)=> ay>=ax&&ay>=az ? [p[0],p[2]] : ax>=az ? [p[2],p[1]] : [p[0],p[1]];
      const base=pos.length/3;
      for(const p of [a,b,c]) {const tex=project(p);pos.push(...p);norm.push(...n);uv.push(tex[0]*0.72,tex[1]*0.72);}
      indices.push(base,base+1,base+2);
    };
    if(piece.kind==='box') {
      const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]].map(p=>rotate([p[0]*sx,p[1]*sy,p[2]*sz]));
      const faces=[[0,2,1,0,3,2],[4,5,6,4,6,7],[0,1,5,0,5,4],[3,7,6,3,6,2],[0,4,7,0,7,3],[1,2,6,1,6,5]];
      for(const f of faces) for(let i=0;i<6;i+=3) pushTri(v[f[i]],v[f[i+1]],v[f[i+2]]);
    } else if(piece.kind==='sphere') {
      // Indexed smooth sphere: reuse vertices instead of duplicating every triangle corner.
      const baseLat=(category==='heroes'||category==='bosses')?16:12;
      const baseLon=(category==='heroes'||category==='bosses')?24:18;
      const lat=Math.max(4,baseLat-lodLevel*2);
      const lon=Math.max(6,baseLon-lodLevel*4);
      const base=pos.length/3, points=[];
      const rotateDir=(p)=>{
        let [x,y,z]=p; const [rx,ry,rz]=rot;
        let yy=y*Math.cos(rx)-z*Math.sin(rx), zz=y*Math.sin(rx)+z*Math.cos(rx); y=yy;z=zz;
        let xx=x*Math.cos(ry)+z*Math.sin(ry); zz=-x*Math.sin(ry)+z*Math.cos(ry); x=xx;z=zz;
        xx=x*Math.cos(rz)-y*Math.sin(rz); yy=x*Math.sin(rz)+y*Math.cos(rz); x=xx;y=yy;
        const l=Math.hypot(x,y,z)||1; return [x/l,y/l,z/l];
      };
      for(let y=0;y<=lat;y++) for(let x=0;x<=lon;x++) {
        const phi=y/lat*Math.PI, th=x/lon*Math.PI*2;
        const local=[Math.sin(phi)*Math.cos(th)*sx,Math.cos(phi)*sy,Math.sin(phi)*Math.sin(th)*sz];
        const world=rotate(local);
        const normal=rotateDir([Math.sin(phi)*Math.cos(th)/Math.max(sx,1e-5),Math.cos(phi)/Math.max(sy,1e-5),Math.sin(phi)*Math.sin(th)/Math.max(sz,1e-5)]);
        pos.push(...world); norm.push(...normal); uv.push(world[0]*0.72,world[2]*0.72); points.push(base+y*(lon+1)+x);
      }
      for(let y=0;y<lat;y++) for(let x=0;x<lon;x++) {
        const a=points[y*(lon+1)+x],b=points[(y+1)*(lon+1)+x],c=points[(y+1)*(lon+1)+x+1],d=points[y*(lon+1)+x+1];
        indices.push(a,b,d,b,c,d);
      }
    } else {
      const baseSegments=(category==='heroes'||category==='bosses')?(piece.kind==='cone'?12:16):(piece.kind==='cone'?10:12);
      const segments=Math.max(piece.kind==='cone'?6:8,baseSegments-lodLevel*3);
      const topR=piece.kind==='cone'?0:0.5, botR=0.5;
      for(let i=0;i<segments;i++) {
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        const point=(ang,y,rad)=>rotate([Math.cos(ang)*sx*rad,(y-.5)*sy,Math.sin(ang)*sz*rad]);
        const a0=point(a,0,botR),b0=point(b,0,botR),a1=point(a,1,topR),b1=point(b,1,topR);
        pushTri(a0,a1,b0);if(topR>0)pushTri(b0,a1,b1);
        const c0=rotate([0,-sy/2,0]),c1=rotate([0,sy/2,0]);
        pushTri(c0,b0,a0);if(topR>0)pushTri(c1,a1,b1);
      }
    }
    return {pos,norm,uv,indices,joint:jointIndex[piece.joint]??jointIndex.Spine,mat:materialIndex[piece.material]??0};
  };
  // Build three independently simplified skinned variants. LOD geometry keeps the same
  // authored silhouette/material palette while reducing sphere/cylinder tessellation and
  // dropping tiny non-emissive trim at distance.
  const mergePieces=(lodLevel=0)=>{
    const merged=new Map();
    for(const piece of pieces) {
      const maxDim=Math.max(...piece.size);
      if(lodLevel===1 && maxDim<0.045 && piece.material!=='glow') continue;
      if(lodLevel===2 && maxDim<0.095 && piece.material!=='glow') continue;
      const g=buildPrimitive(piece,lodLevel),key=String(g.mat);
      if(!merged.has(key))merged.set(key,{pos:[],norm:[],uv:[],joints:[],weights:[],indices:[],joint:g.joint,mat:g.mat});
      const m=merged.get(key),offset=m.pos.length/3;
      m.pos.push(...g.pos);m.norm.push(...g.norm);m.uv.push(...g.uv);
      for(let i=0;i<g.pos.length/3;i++){m.joints.push(g.joint,0,0,0);m.weights.push(1,0,0,0);}
      m.indices.push(...g.indices.map(i=>i+offset));
    }
    return merged;
  };

  // glTF binary packer (aligned bufferViews + accessor bounds).
  const chunks=[];let byteLength=0;const bufferViews=[],accessors=[];
  const addBytes=(typed,target)=>{
    while(byteLength%4){chunks.push(Buffer.from([0]));byteLength++;}
    const b=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength),offset=byteLength;
    chunks.push(b);byteLength+=b.length;
    const view={buffer:0,byteOffset:offset,byteLength:b.length};if(target)view.target=target;
    const vi=bufferViews.push(view)-1;return vi;
  };
  const accessor=(typed,type,componentType,count,target,min,max)=>{
    const view=addBytes(typed,target);
    const a={bufferView:view,componentType,count,type};
    if(min)a.min=min;if(max)a.max=max;
    accessors.push(a);return accessors.length-1;
  };
  const meshDefs=[];
  const appendMeshes=(merged,suffix='')=>{
    const meshNodes=[];
    for(const g of merged.values()) {
      const pos=new Float32Array(g.pos),norm=new Float32Array(g.norm),uv=new Float32Array(g.uv);
      const joints=new Uint16Array(g.joints),weights=new Float32Array(g.weights);
      const max=[-Infinity,-Infinity,-Infinity],min=[Infinity,Infinity,Infinity];
      for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i+k]);max[k]=Math.max(max[k],pos[i+k]);}
      const p=accessor(pos,'VEC3',5126,pos.length/3,34962,min,max);
      const n=accessor(norm,'VEC3',5126,norm.length/3,34962);
      const tex=accessor(uv,'VEC2',5126,uv.length/2,34962);
      const j=accessor(joints,'VEC4',5123,joints.length/4,34962);
      const w=accessor(weights,'VEC4',5126,weights.length/4,34962);
      const idxType=g.indices.length>65535?Uint32Array:Uint16Array;
      const ix=accessor(new idxType(g.indices),'SCALAR',idxType===Uint32Array?5125:5123,g.indices.length,34963);
      const meshName=id+'_'+materials[g.mat].name+(suffix ? suffix+'_Part' : '');
      meshDefs.push({name:meshName,primitives:[{attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:tex,JOINTS_0:j,WEIGHTS_0:w},indices:ix,material:g.mat,mode:4}]});
      meshNodes.push({name:meshName,mesh:meshDefs.length-1,skin:0});
    }
    return meshNodes;
  };
  const baseMeshNodes=appendMeshes(mergePieces(0));
  const lod1MeshNodes=appendMeshes(mergePieces(1),'_LOD1');
  const lod2MeshNodes=appendMeshes(mergePieces(2),'_LOD2');

  const nodes=jointNames.map((name,i)=>({name,translation:boneLocal[i],children:[]}));
  for(let i=1;i<jointNames.length;i++)nodes[boneParents[i]].children.push(i);
  // Authored attachment transforms follow the relevant animated joint and provide
  // stable VFX origins for hits, breath, staff, weapon swings, and chest effects.
  const attach=(name,parent,worldPosition)=>{
    const p=boneWorld[jointIndex[parent]];
    const index=nodes.length;
    nodes.push({name,translation:worldPosition.map((v,k)=>v-p[k]),children:[]});
    nodes[jointIndex[parent]].children.push(index);
  };
  const headPos = style==='spider'?[0,1.08,0.32]
    : ['dragon','dragonBoss','flyer'].includes(style)?[0,1.12,0.55]
    : style==='wraith'?[0,1.0,0]
    : [0,1.49,0.02];
  attach('HeadPoint','Head',headPos);
  attach('ChestPoint','Spine',[0,1.0,0.24]);
  attach('HitPoint','Hips',[0,0.82,0]);
  attach('WeaponPoint','Arm_R',style==='mage'?[0.55,1.82,0.03]:[0.68,1.42,0.05]);
  attach('StaffPoint','Arm_R',[0.55,1.78,0.03]);
  attach('MuzzlePoint','Spine',[0.32,1.25,0.42]);
  attach('MouthPoint',style==='spider'?'Head':(['dragon','dragonBoss','flyer'].includes(style)?'Head':'Jaw'),
    style==='spider'?[0,1.08,0.62]:['dragon','dragonBoss','flyer'].includes(style)?[0,1.08,0.98]:[0,1.3,0.2]);
  const meshNodeStart=nodes.length;
  nodes.push(...baseMeshNodes);
  const roots=[0,...baseMeshNodes.map((_,i)=>meshNodeStart+i)];
  const appendLodGroup=(name,meshNodes)=>{
    const groupIndex=nodes.length;
    const childStart=groupIndex+1;
    nodes.push({name,children:meshNodes.map((_,i)=>childStart+i)});
    nodes.push(...meshNodes);
    roots.push(groupIndex);
  };
  appendLodGroup(id+'_LOD1',lod1MeshNodes);
  appendLodGroup(id+'_LOD2',lod2MeshNodes);
  const invBind=[];
  for(const p of boneWorld) invBind.push(1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1);
  const ibm=accessor(new Float32Array(invBind),'MAT4',5126,jointNames.length);
  const animations=[];
  // Preserve each authored pose while sampling a smooth Catmull-Rom curve between
  // key poses. Dense baked keys remain glTF/Three.js native and avoid runtime CPU
  // interpolation. Quaternions are normalized after cubic interpolation.
  const clipDuration=(name)=>({
    Idle:3.2,Walk:0.82,Run:0.58,Attack:0.72,Attack1:0.72,Attack2:0.86,
    SpecialAttack:1.12,Skill:0.96,Hit:0.38,Death:1.28,Roar:1.62,
    PhaseChange:1.48,Dodge:0.48,Block:0.56,Stagger:0.64,Spawn:1.14,
    Taunt:1.82,Victory:2.18
  }[name] ?? 1);
  const catmull=(p0,p1,p2,p3,t)=>{
    const t2=t*t,t3=t2*t;
    return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);
  };
  const addAnim=(name,tracks)=>{
    const samplers=[],channels=[];
    const sourceCount=5, samplesPerSegment=4, sampleCount=(sourceCount-1)*samplesPerSegment+1;
    const duration=clipDuration(name);
    const times=Float32Array.from({length:sampleCount},(_,i)=>duration*i/(sampleCount-1));
    const ti=accessor(times,'SCALAR',5126,times.length);
    for(const track of tracks) {
      const source=track.values;
      const width=track.path==='rotation'?4:3;
      const sampled=[];
      for(let i=0;i<sampleCount;i++) {
        const position=i/samplesPerSegment;
        const segment=Math.min(sourceCount-2,Math.floor(position));
        const t=position-segment;
        const p0=source[Math.max(0,segment-1)],p1=source[segment];
        const p2=source[segment+1],p3=source[Math.min(sourceCount-1,segment+2)];
        let value=Array.from({length:width},(_,c)=>catmull(p0[c],p1[c],p2[c],p3[c],t));
        if(track.path==='rotation') {
          const length=Math.hypot(...value)||1;
          value=value.map(v=>v/length);
        }
        sampled.push(...value);
      }
      const oi=accessor(new Float32Array(sampled),track.path==='rotation'?'VEC4':'VEC3',5126,sampleCount);
      const si=samplers.length;samplers.push({input:ti,output:oi,interpolation:'LINEAR'});
      channels.push({sampler:si,target:{node:jointIndex[track.joint],path:track.path}});
    }
    animations.push({name,samplers,channels});
  };
  const rot=(joint,axis,angles)=>({joint,path:'rotation',values:angles.map(a=>quat(axis,a))});
  const tr=(joint,values)=>({joint,path:'translation',values});
  const beast=['dragon','dragonBoss','flyer'].includes(style);
  const crawler=style==='spider';
  const spectral=['wraith','darkBoss'].includes(style);
  const heavy=['golem','bossGolem','fireBoss','iceBoss','machine','tank','brute','darkBoss'].includes(style);
  const mage=['mage'].includes(style);
  const winged=beast || category==='bosses';
  const idleTracks = beast
    ? [rot('Spine','x',[0,0.025,0,-0.018,0]),rot('Head','y',[0,-0.055,0,0.055,0]),rot('Tail','y',[0,0.08,0,-0.08,0]),rot('TailMid','y',[0,0.04,0,-0.04,0]),rot('TailTip','y',[0,0.07,0,-0.07,0]),rot('Wing_L','z',[0,-0.06,0,-0.035,0]),rot('Wing_R','z',[0,0.06,0,0.035,0])]
    : crawler
      ? [rot('Spine','x',[0,0.045,0,-0.025,0]),rot('Head','y',[0,-0.08,0,0.08,0]),
        ...['SpiderLegL0','SpiderLegL1','SpiderLegL2','SpiderLegL3'].map((j,i)=>rot(j,'z',[0,0.035+i*0.012,0,-0.035-i*0.012,0])),
        ...['SpiderLegR0','SpiderLegR1','SpiderLegR2','SpiderLegR3'].map((j,i)=>rot(j,'z',[0,-0.035-i*0.012,0,0.035+i*0.012,0]))]
      : [rot('Spine','x',[0,0.018,0,-0.012,0]),rot('Head','y',[0,-0.035,0,0.035,0]),...(spectral?[rot('Chest','z',[0,-0.025,0,0.025,0])]:[])];
  addAnim('Idle',idleTracks);
  const walkTracks = beast
    ? [rot('Leg_L','x',[0,0.16,0,-0.16,0]),rot('Leg_R','x',[0,-0.16,0,0.16,0]),rot('Wing_L','z',[0,-0.28,0,0.28,0]),rot('Wing_R','z',[0,0.28,0,-0.28,0]),rot('Tail','x',[0,0.12,0,-0.12,0]),rot('TailMid','x',[0,0.08,0,-0.08,0]),rot('TailTip','x',[0,0.12,0,-0.12,0])]
    : crawler
      ? [...['SpiderLegL0','SpiderLegL2'].map(j=>rot(j,'z',[0,0.48,0,-0.48,0])),
          ...['SpiderLegL1','SpiderLegL3'].map(j=>rot(j,'z',[0,-0.42,0,0.42,0])),
          ...['SpiderLegR0','SpiderLegR2'].map(j=>rot(j,'z',[0,-0.48,0,0.48,0])),
          ...['SpiderLegR1','SpiderLegR3'].map(j=>rot(j,'z',[0,0.42,0,-0.42,0])),
          rot('Spine','x',[0,0.04,0,-0.04,0])]
      : heavy
        ? [rot('Leg_L','x',[0,0.28,0,-0.28,0]),rot('Leg_R','x',[0,-0.28,0,0.28,0]),rot('Knee_L','x',[0,0.12,0.02,0.2,0]),rot('Knee_R','x',[0,0.2,0.02,0.12,0]),rot('Foot_L','x',[0,-0.08,0,0.07,0]),rot('Foot_R','x',[0,0.07,0,-0.08,0]),rot('Arm_L','x',[0,-0.18,0.24,0,0]),rot('Arm_R','x',[0,0.18,-0.24,0,0]),rot('ForeArm_L','x',[0,-0.1,0.12,0,0]),rot('ForeArm_R','x',[0,0.1,-0.12,0,0]),rot('Spine','x',[0,0.035,0,-0.02,0]),rot('Chest','x',[0,0.018,0,-0.018,0]),tr('Hips',[[0,0.72,0],[0,0.745,0],[0,0.72,0],[0,0.745,0],[0,0.72,0]])]
        : mage
          ? [rot('Leg_L','x',[0,0.3,0,-0.3,0]),rot('Leg_R','x',[0,-0.3,0,0.3,0]),rot('Arm_L','x',[0,-0.12,0,0.12,0]),rot('Arm_R','x',[0,0.16,0,-0.16,0]),rot('Hand_R','z',[0,-0.08,0.08,0,0]),rot('Spine','x',[0,-0.025,0.02,0,0]),rot('Head','y',[0,0.035,-0.035,0,0]),tr('Hips',[[0,0.72,0],[0,0.745,0],[0,0.72,0],[0,0.745,0],[0,0.72,0]])]
          : spectral
            ? [rot('Leg_L','x',[0,0.18,0,-0.18,0]),rot('Leg_R','x',[0,-0.18,0,0.18,0]),rot('Spine','z',[0,-0.07,0,0.07,0]),rot('Chest','x',[0,0.05,0,-0.04,0]),rot('Arm_L','z',[0,-0.12,0,0.12,0]),rot('Arm_R','z',[0,0.12,0,-0.12,0]),rot('Head','y',[0,-0.07,0,0.07,0]),tr('Hips',[[0,0.72,0],[0,0.75,0],[0,0.72,0],[0,0.75,0],[0,0.72,0]])]
            : [rot('Leg_L','x',[0,0.42,0,-0.42,0]),rot('Leg_R','x',[0,-0.42,0,0.42,0]),rot('Knee_L','x',[0,0.18,0.04,0.32,0]),rot('Knee_R','x',[0,0.32,0.04,0.18,0]),rot('Foot_L','x',[0,-0.12,0,0.1,0]),rot('Foot_R','x',[0,0.1,0,-0.12,0]),rot('Arm_L','x',[0,-0.3,0,0.3,0]),rot('Arm_R','x',[0,0.3,0,-0.3,0]),rot('ForeArm_L','x',[0,-0.08,0.04,0.08,0]),rot('ForeArm_R','x',[0,0.08,0.04,-0.08,0]),rot('Chest','x',[0,0.025,0,-0.025,0]),tr('Hips',[[0,0.72,0],[0,0.76,0],[0,0.72,0],[0,0.76,0],[0,0.72,0]])];
  addAnim('Walk',walkTracks);
  const runTracks = beast
    ? [rot('Leg_L','x',[0,0.3,0,-0.3,0]),rot('Leg_R','x',[0,-0.3,0,0.3,0]),rot('Wing_L','z',[0,-0.62,0,0.62,0]),rot('Wing_R','z',[0,0.62,0,-0.62,0]),rot('Tail','x',[0,0.2,0,-0.2,0]),rot('TailMid','x',[0,0.14,0,-0.14,0]),rot('TailTip','x',[0,0.2,0,-0.2,0])]
    : crawler
      ? [...['SpiderLegL0','SpiderLegL2'].map(j=>rot(j,'z',[0,0.75,0,-0.75,0])),
          ...['SpiderLegL1','SpiderLegL3'].map(j=>rot(j,'z',[0,-0.65,0,0.65,0])),
          ...['SpiderLegR0','SpiderLegR2'].map(j=>rot(j,'z',[0,-0.75,0,0.75,0])),
          ...['SpiderLegR1','SpiderLegR3'].map(j=>rot(j,'z',[0,0.65,0,-0.65,0])),
          rot('Spine','x',[0,0.08,0,-0.08,0])]
      : heavy
        ? [rot('Leg_L','x',[0,0.46,0,-0.46,0]),rot('Leg_R','x',[0,-0.46,0,0.46,0]),rot('Knee_L','x',[0,0.24,0.05,0.16,0]),rot('Knee_R','x',[0,0.16,0.05,0.24,0]),rot('Foot_L','x',[0,-0.13,0,0.09,0]),rot('Foot_R','x',[0,0.09,0,-0.13,0]),rot('Arm_L','x',[0,-0.32,0.42,0,0]),rot('Arm_R','x',[0,0.32,-0.42,0,0]),rot('ForeArm_L','x',[0,-0.16,0.18,0,0]),rot('ForeArm_R','x',[0,0.16,-0.18,0,0]),rot('Spine','x',[0,0.11,0,-0.07,0]),rot('Chest','x',[0,-0.045,0.025,-0.045,0]),tr('Hips',[[0,0.72,0],[0,0.79,0],[0,0.72,0],[0,0.79,0],[0,0.72,0]])]
        : mage
          ? [rot('Leg_L','x',[0,0.52,0,-0.52,0]),rot('Leg_R','x',[0,-0.52,0,0.52,0]),rot('Arm_L','x',[0,-0.2,0,0.2,0]),rot('Arm_R','x',[0,0.28,0,-0.28,0]),rot('Hand_R','z',[0,-0.14,0.14,0,0]),rot('Spine','x',[0,-0.04,0.04,0,0]),rot('Head','y',[0,0.05,-0.05,0,0]),tr('Hips',[[0,0.72,0],[0,0.78,0],[0,0.72,0],[0,0.78,0],[0,0.72,0]])]
          : spectral
            ? [rot('Leg_L','x',[0,0.26,0,-0.26,0]),rot('Leg_R','x',[0,-0.26,0,0.26,0]),rot('Spine','z',[0,-0.11,0,0.11,0]),rot('Chest','x',[0,0.08,0,-0.06,0]),rot('Arm_L','z',[0,-0.2,0,0.2,0]),rot('Arm_R','z',[0,0.2,0,-0.2,0]),rot('Head','y',[0,-0.1,0,0.1,0]),tr('Hips',[[0,0.72,0],[0,0.78,0],[0,0.72,0],[0,0.78,0],[0,0.72,0]])]
            : [rot('Leg_L','x',[0,0.72,0,-0.72,0]),rot('Leg_R','x',[0,-0.72,0,0.72,0]),rot('Knee_L','x',[0,0.42,0,0.18,0]),rot('Knee_R','x',[0,0.18,0,0.42,0]),rot('Foot_L','x',[0,-0.2,0,0.12,0]),rot('Foot_R','x',[0,0.12,0,-0.2,0]),rot('Arm_L','x',[0,-0.48,0,0.48,0]),rot('Arm_R','x',[0,0.48,0,-0.48,0]),rot('ForeArm_L','x',[0,-0.14,0.08,0.14,0]),rot('ForeArm_R','x',[0,0.14,0.08,-0.14,0]),rot('Spine','x',[0,0.08,0,0.08,0]),rot('Chest','x',[0,-0.06,0.02,-0.06,0])];
  addAnim('Run',runTracks);
  const heroAttackTracks = id === 'arman'
    ? [rot('Arm_R','x',[-0.18,-0.92,0.78,0.16,-0.18]),rot('Hand_R','z',[0,-0.32,0.62,0.08,0]),rot('Arm_L','x',[0,-0.16,0.22,0,0]),rot('Spine','y',[0,-0.16,0.22,0,0])]
    : id === 'aria'
      ? [rot('Arm_L','z',[0,-0.48,-0.72,-0.2,0]),rot('Arm_R','x',[0,-0.32,-0.62,0.18,0]),rot('ForeArm_R','z',[0,0.22,0.48,0.08,0]),rot('Hand_R','x',[0,-0.12,0.24,0,0]),rot('Spine','y',[0,-0.12,0.16,0,0])]
      : id === 'radin'
        ? [rot('Arm_R','x',[0,-0.42,-0.16,0.2,0]),rot('Arm_L','x',[0,-0.28,-0.1,0.14,0]),rot('Hand_R','z',[0,-0.12,0.18,0,0]),rot('Spine','x',[0,0.06,-0.12,0,0]),rot('Head','y',[0,-0.04,0.08,0,0])]
        : id === 'nila'
          ? [rot('Arm_R','z',[0,-0.42,-0.78,-0.18,0]),rot('Hand_R','x',[0,-0.24,0.48,0.12,0]),rot('Arm_L','z',[0,0.18,0.42,0.08,0]),rot('Head','y',[0,-0.1,0.16,0,0]),rot('Spine','x',[0,-0.08,-0.16,0,0])]
          : null;
  const attackTracks = heroAttackTracks ?? (id === 'blackDragon'
    ? [rot('Head','x',[-0.04,-0.3,0.18,0.08,-0.04]),rot('Jaw','x',[0,0.2,0.42,0.1,0]),rot('Wing_L','z',[0,-0.38,-0.88,-0.12,0]),rot('Wing_R','z',[0,0.38,0.88,0.12,0]),rot('TailMid','y',[0,0.26,-0.34,0.08,0]),rot('TailTip','y',[0,0.38,-0.5,0.12,0])]
    : id === 'golemKing'
      ? [rot('Hips','x',[0,-0.08,0.16,0.02,0]),rot('Spine','x',[0,-0.2,-0.48,0.14,0]),rot('Arm_R','x',[-0.12,-0.8,-1.18,0.12,-0.12]),rot('ForeArm_R','x',[0,-0.22,-0.42,0.08,0]),rot('Arm_L','x',[0,-0.22,0.48,0.08,0]),rot('Head','x',[0,-0.12,-0.32,0.04,0])]
      : id === 'fireGiant'
        ? [rot('Spine','y',[0,-0.18,0.32,0.08,0]),rot('Arm_L','z',[0,-0.62,-0.95,-0.16,0]),rot('Arm_R','z',[0,0.42,0.78,0.18,0]),rot('ForeArm_L','x',[0,-0.18,-0.36,0.04,0]),rot('Head','x',[0,-0.12,-0.3,0.02,0])]
        : id === 'iceGiant'
          ? [rot('Spine','x',[0,-0.12,-0.3,0.08,0]),rot('Arm_L','z',[0,-0.42,-0.72,-0.16,0]),rot('Arm_R','z',[0,0.42,0.72,0.16,0]),rot('Hand_L','x',[0,-0.18,-0.38,-0.06,0]),rot('Hand_R','x',[0,-0.18,-0.38,-0.06,0]),rot('Head','y',[0,-0.12,0.2,0,0])]
          : id === 'darkLord'
            ? [rot('Spine','y',[0,-0.2,0.36,-0.14,0]),rot('Arm_R','x',[0,-0.88,0.72,0.2,0]),rot('Hand_R','x',[0,-0.48,0.72,0.12,0]),rot('Wing_L','z',[0,-0.52,-0.96,-0.18,0]),rot('Wing_R','z',[0,0.44,0.84,0.16,0]),rot('Head','y',[0,-0.2,0.18,0,0])]
            : beast
    ? [rot('Head','x',[-0.05,-0.35,0.24,0.08,-0.05]),rot('Jaw','x',[0,0.18,0.38,0.12,0]),rot('Tail','y',[0,0.22,-0.25,0.08,0]),rot('TailMid','y',[0,0.3,-0.32,0.1,0]),rot('TailTip','y',[0,0.42,-0.45,0.12,0]),rot('Wing_L','z',[0,-0.5,-0.9,-0.2,0]),rot('Wing_R','z',[0,0.5,0.9,0.2,0])]
    : crawler
      ? [rot('Head','x',[0,-0.24,0.12,0,0]),
          ...['SpiderLegL0','SpiderLegL2','SpiderLegR1','SpiderLegR3'].map(j=>rot(j,'z',[0,0.3,-0.6,0.15,0])),
          ...['SpiderLegR0','SpiderLegR2','SpiderLegL1','SpiderLegL3'].map(j=>rot(j,'z',[0,-0.3,0.6,-0.15,0]))]
      : mage
        ? [rot('Arm_R','x',[0,-0.55,-0.25,0.55,0]),rot('Hand_R','x',[0,-0.22,0.38,0.12,0]),rot('Head','x',[0,-0.12,-0.2,0,0]),rot('Spine','y',[0,-0.08,0.16,0,0])]
        : [rot('Arm_R','x',[-0.15,-0.95,0.85,0.3,-0.15]),rot('Hand_R','x',[0,-0.28,0.5,0.16,0]),rot('Spine','y',[0,-0.1,0.12,0,0]),...(heavy?[rot('Arm_L','x',[0,-0.35,0.55,0,0]),rot('Hips','x',[0,-0.05,0.08,0,0])]:[])]);
  addAnim('Attack',attackTracks);
  addAnim('Attack1',attackTracks);
  const heroAttack2Tracks = id === 'arman'
    ? [rot('Arm_R','x',[-0.1,-1.05,1.08,0.2,-0.1]),rot('Hand_R','z',[0,-0.48,0.78,0.12,0]),rot('Arm_L','x',[0,-0.24,0.38,0,0]),rot('Spine','y',[0,-0.28,0.34,0,0]),rot('Hips','y',[0,-0.08,0.1,0,0])]
    : id === 'aria'
      ? [rot('Arm_L','z',[0,-0.72,-1.0,-0.18,0]),rot('Arm_R','x',[0,-0.52,-0.86,0.22,0]),rot('ForeArm_R','z',[0,0.35,0.68,0.1,0]),rot('Spine','y',[0,-0.2,0.28,0,0])]
      : id === 'radin'
        ? [rot('Arm_R','x',[0,-0.58,-0.28,0.3,0]),rot('Arm_L','x',[0,-0.4,-0.2,0.2,0]),rot('Hand_R','z',[0,-0.22,0.28,0,0]),rot('Spine','x',[0,0.12,-0.22,0,0]),rot('Hips','y',[0,-0.08,0.12,0,0])]
        : id === 'nila'
          ? [rot('Arm_R','z',[0,-0.62,-1.02,-0.2,0]),rot('Hand_R','x',[0,-0.4,0.72,0.16,0]),rot('Arm_L','z',[0,0.28,0.62,0.1,0]),rot('Spine','x',[0,-0.14,-0.3,0,0]),rot('Head','y',[0,-0.16,0.24,0,0])]
          : null;
  const attack2Tracks = heroAttack2Tracks ?? (id === 'blackDragon'
    ? [rot('Head','x',[0,-0.18,0.36,0.1,0]),rot('Jaw','x',[0,0.3,0.55,0.08,0]),rot('Wing_L','z',[0,-0.7,-1.08,-0.18,0]),rot('Wing_R','z',[0,0.7,1.08,0.18,0]),rot('Tail','y',[0,-0.32,0.42,-0.1,0]),rot('TailMid','y',[0,-0.44,0.56,-0.12,0]),rot('TailTip','y',[0,-0.58,0.7,-0.16,0])]
    : id === 'golemKing'
      ? [rot('Hips','y',[0,-0.12,0.16,0,0]),rot('Spine','x',[0,-0.28,0.24,0.08,0]),rot('Arm_L','x',[0,-0.78,-1.1,-0.2,0]),rot('Arm_R','x',[0,-0.82,-1.16,-0.18,0]),rot('Head','x',[0,-0.16,0.2,0.02,0])]
      : id === 'fireGiant'
        ? [rot('Hips','y',[0,-0.18,0.28,0.04,0]),rot('Spine','y',[0,-0.32,0.48,0.08,0]),rot('Arm_L','z',[0,-0.78,-1.1,-0.2,0]),rot('Arm_R','z',[0,0.7,1.0,0.18,0]),rot('Head','x',[0,-0.18,-0.38,0,0])]
        : id === 'iceGiant'
          ? [rot('Spine','x',[0,-0.18,-0.42,0.04,0]),rot('Arm_L','z',[0,-0.62,-0.95,-0.22,0]),rot('Arm_R','z',[0,0.62,0.95,0.22,0]),rot('Hand_L','x',[0,-0.28,-0.5,-0.08,0]),rot('Hand_R','x',[0,-0.28,-0.5,-0.08,0]),rot('Head','x',[0,-0.18,-0.36,0,0])]
          : beast
    ? [rot('Head','x',[0,-0.15,0.42,0.1,0]),rot('Jaw','x',[0,0.28,0.52,0.08,0]),rot('Tail','y',[0,-0.3,0.38,-0.1,0]),rot('TailMid','y',[0,-0.4,0.48,-0.12,0]),rot('TailTip','y',[0,-0.5,0.6,-0.15,0]),rot('Wing_L','z',[0,-0.75,-1.0,-0.15,0]),rot('Wing_R','z',[0,0.75,1.0,0.15,0])]
    : crawler
      ? [rot('Head','x',[0,-0.4,0.24,0,0]),
          ...['SpiderLegL0','SpiderLegL2','SpiderLegR1','SpiderLegR3'].map(j=>rot(j,'z',[0,0.55,-0.8,0.2,0])),
          ...['SpiderLegR0','SpiderLegR2','SpiderLegL1','SpiderLegL3'].map(j=>rot(j,'z',[0,-0.55,0.8,-0.2,0]))]
      : [rot('Arm_L','x',[0,-0.7,0.95,0.2,0]),rot('Arm_R','x',[0,-0.4,0.65,0.1,0]),rot('Hand_R','x',[0,-0.2,0.42,0.1,0]),rot('Spine','y',[0,0.2,-0.24,0,0]),rot('Hips','x',[0,-0.08,0.1,0,0])]);
  addAnim('Attack2',attack2Tracks);
  const specialTracks = id === 'blackDragon'
    ? [rot('Spine','x',[0,-0.24,-0.48,0.12,0]),rot('Head','x',[0,-0.24,-0.5,-0.12,0]),rot('Jaw','x',[0,0.3,0.58,0.12,0]),rot('Wing_L','z',[0,-0.92,-1.22,-0.3,0]),rot('Wing_R','z',[0,0.92,1.22,0.3,0]),rot('Tail','y',[0,0.38,-0.45,0.12,0]),rot('TailMid','y',[0,0.52,-0.62,0.16,0]),rot('TailTip','y',[0,0.68,-0.78,0.2,0])]
    : id === 'golemKing'
      ? [rot('Spine','x',[0,-0.28,-0.55,0.18,0]),rot('Arm_L','x',[0,-0.72,-1.15,-0.2,0]),rot('Arm_R','x',[0,-0.82,-1.25,-0.24,0]),rot('Hips','x',[0,-0.12,0.18,0,0]),rot('Head','x',[0,-0.2,-0.46,-0.1,0])]
      : id === 'fireGiant'
        ? [rot('Spine','y',[0,-0.32,0.48,-0.18,0]),rot('Arm_L','z',[0,-0.92,-1.25,-0.24,0]),rot('Arm_R','z',[0,0.72,1.08,0.22,0]),rot('ForeArm_L','x',[0,-0.28,-0.48,-0.06,0]),rot('Head','x',[0,-0.22,-0.48,-0.12,0])]
        : id === 'iceGiant'
          ? [rot('Spine','x',[0,-0.22,-0.46,0.12,0]),rot('Arm_L','z',[0,-0.72,-1.12,-0.22,0]),rot('Arm_R','z',[0,0.72,1.12,0.22,0]),rot('Hand_L','x',[0,-0.32,-0.58,-0.1,0]),rot('Hand_R','x',[0,-0.32,-0.58,-0.1,0]),rot('Head','y',[0,-0.22,0.28,-0.08,0])]
        : beast
    ? [rot('Spine','x',[0,-0.18,-0.36,0.08,0]),rot('Head','x',[0,-0.2,-0.38,-0.05,0]),rot('Wing_L','z',[0,-0.75,-1.05,-0.25,0]),rot('Wing_R','z',[0,0.75,1.05,0.25,0]),rot('Tail','y',[0,0.38,-0.42,0.12,0]),rot('TailMid','y',[0,0.45,-0.5,0.14,0]),rot('TailTip','y',[0,0.58,-0.62,0.18,0])]
    : crawler
      ? [rot('Spine','x',[0,-0.12,-0.25,0.05,0]),rot('Head','x',[0,-0.3,-0.5,-0.1,0]),
          ...['SpiderLegL0','SpiderLegL2','SpiderLegR1','SpiderLegR3'].map(j=>rot(j,'z',[0,0.65,-0.95,0.1,0])),
          ...['SpiderLegR0','SpiderLegR2','SpiderLegL1','SpiderLegL3'].map(j=>rot(j,'z',[0,-0.65,0.95,-0.1,0]))]
      : id==='darkLord'
        ? [rot('Spine','y',[0,-0.22,0.36,-0.16,0]),rot('Arm_R','x',[0,-0.85,0.72,0.2,0]),rot('Hand_R','x',[0,-0.5,0.62,0.1,0]),rot('Wing_L','z',[0,-0.55,-0.95,-0.2,0]),rot('Wing_R','z',[0,0.42,0.8,0.15,0]),rot('Head','y',[0,-0.2,0.18,0,0])]
        : ['golemKing','fireGiant','iceGiant'].includes(id)
          ? [rot('Spine','x',[0,-0.12,-0.34,0.1,0]),rot('Arm_L','x',[0,-0.55,-0.9,-0.18,0]),rot('Arm_R','x',[0,-0.65,-1.0,-0.22,0]),rot('Head','x',[0,-0.18,-0.42,-0.1,0]),rot('Hips','x',[0,-0.06,0.12,0,0])]
          : [rot('Spine','x',[0,-0.18,-0.36,0.08,0]),rot('Head','x',[0,-0.2,-0.38,-0.05,0]),rot('Arm_L','z',[0,-0.45,-0.75,-0.2,0]),rot('Arm_R','z',[0,0.45,0.75,0.2,0]),...(winged?[rot('Wing_L','z',[0,-0.45,-0.85,-0.25,0]),rot('Wing_R','z',[0,0.45,0.85,0.25,0])]:[])];
  addAnim('SpecialAttack',specialTracks);
  addAnim('Hit', beast
    ? [rot('Head','x',[0,0.25,-0.08,0,0]),rot('Spine','x',[0,0.18,0,0,0]),rot('Tail','y',[0,-0.12,0,0,0])]
    : crawler
      ? [rot('Spine','x',[0,0.18,-0.04,0,0]),rot('Head','z',[0,0.16,-0.04,0,0])]
      : [rot('Spine','x',[0,-0.2,-0.05,0,0]),rot('Head','z',[0,0.12,-0.05,0,0]),rot('Arm_R','x',[0,-0.12,0,0,0])]);
  addAnim('Death', beast
    ? [rot('Spine','x',[0,0.12,0.48,0.7,0.7]),rot('Head','x',[0,0.1,0.28,0.32,0.32]),rot('Wing_L','z',[0,-0.18,-0.55,-0.7,-0.7]),rot('Wing_R','z',[0,0.18,0.55,0.7,0.7]),rot('Tail','x',[0,0.18,0.35,0.4,0.4]),rot('TailMid','x',[0,0.12,0.28,0.32,0.32]),rot('TailTip','x',[0,0.1,0.22,0.26,0.26])]
    : crawler
      ? [rot('Spine','z',[0,0.25,0.9,1.35,1.35]),rot('Head','x',[0,-0.12,-0.22,-0.22,-0.22]),
          ...['SpiderLegL0','SpiderLegL1','SpiderLegL2','SpiderLegL3'].map(j=>rot(j,'z',[0,0.25,0.6,0.8,0.8])),
          ...['SpiderLegR0','SpiderLegR1','SpiderLegR2','SpiderLegR3'].map(j=>rot(j,'z',[0,-0.25,-0.6,-0.8,-0.8]))]
      : [rot('Hips','z',[0,0.35,1.0,1.48,1.48]),rot('Spine','x',[0,-0.15,-0.32,-0.38,-0.38]),rot('Head','x',[0,0.08,0.18,0.22,0.22])]);
  addAnim('Roar', beast
    ? [rot('Head','x',[0,-0.3,-0.55,-0.25,0]),rot('Spine','x',[0,-0.12,-0.2,-0.08,0]),rot('Wing_L','z',[0,-0.4,-0.75,-0.35,0]),rot('Wing_R','z',[0,0.4,0.75,0.35,0]),rot('TailMid','y',[0,0.12,-0.14,0.04,0]),rot('TailTip','y',[0,0.2,-0.22,0.06,0])]
    : [rot('Head','x',[0,-0.3,-0.55,-0.25,0]),rot('Spine','x',[0,-0.12,-0.2,-0.08,0]),...(winged?[rot('Wing_L','z',[0,-0.4,-0.75,-0.35,0]),rot('Wing_R','z',[0,0.4,0.75,0.35,0])]:[])]);
  addAnim('PhaseChange',[rot('Spine','x',[0,-0.12,-0.28,-0.12,0]),rot('Arm_L','z',[0,-0.55,-0.9,-0.35,0]),rot('Arm_R','z',[0,0.55,0.9,0.35,0]),rot('Head','y',[0,-0.25,0.25,-0.1,0])]);
  // Hero-specific actions are embedded too; controllers can request Skill/Victory
  // without silently falling back to a generic attack or static pose.
  const heroSkillTracks = id === 'arman'
    ? [rot('Spine','y',[0,-0.24,0.38,-0.12,0]),rot('Arm_R','x',[0,-1.08,0.82,0.14,0]),rot('Hand_R','z',[0,-0.5,0.76,0.08,0]),rot('Arm_L','z',[0,-0.32,-0.62,-0.12,0])]
    : id === 'aria'
      ? [rot('Arm_L','z',[0,-0.72,-1.08,-0.24,0]),rot('Arm_R','x',[0,-0.55,-0.9,0.18,0]),rot('ForeArm_R','z',[0,0.42,0.76,0.1,0]),rot('Spine','y',[0,-0.22,0.32,0,0]),rot('Head','y',[0,0.08,-0.12,0,0])]
      : id === 'radin'
        ? [rot('Arm_R','x',[0,-0.72,-0.36,0.22,0]),rot('Arm_L','x',[0,-0.5,-0.28,0.18,0]),rot('Spine','x',[0,0.16,-0.24,0,0]),rot('Head','y',[0,-0.1,0.16,0,0]),rot('Hips','y',[0,-0.1,0.12,0,0])]
        : id === 'nila'
          ? [rot('Arm_R','z',[0,-0.7,-1.15,-0.25,0]),rot('Hand_R','x',[0,-0.5,0.82,0.12,0]),rot('Arm_L','z',[0,0.38,0.72,0.12,0]),rot('Spine','x',[0,-0.18,-0.36,-0.08,0]),rot('Head','y',[0,-0.22,0.3,0,0])]
          : null;
  addAnim('Skill', heroSkillTracks ?? (beast
    ? [rot('Head','x',[0,-0.22,-0.45,-0.15,0]),rot('Wing_L','z',[0,-0.65,-1.0,-0.3,0]),rot('Wing_R','z',[0,0.65,1.0,0.3,0]),rot('Tail','y',[0,0.32,-0.36,0.12,0])]
    : [rot('Spine','x',[0,-0.1,-0.28,-0.08,0]),rot('Arm_L','z',[0,-0.45,-0.8,-0.2,0]),rot('Arm_R','z',[0,0.45,0.8,0.2,0]),rot('Head','y',[0,-0.18,0.2,-0.08,0])]));
  // Expanded combat library: these clips are available to gameplay and the QA gallery.
  // All rotations target the shared articulated rig; creature-specific tracks add motion
  // to segmented tails, wings, or independent spider legs where applicable.
  addAnim('Dodge', beast
    ? [rot('Hips','z',[0,-0.18,0.12,0.08,0]),rot('Spine','y',[0,-0.22,0.18,0.06,0]),rot('TailMid','y',[0,-0.28,0.24,0.08,0]),rot('TailTip','y',[0,-0.42,0.34,0.1,0])]
    : crawler
      ? [rot('Spine','z',[0,-0.16,0.12,0.04,0]),...['SpiderLegL0','SpiderLegL1','SpiderLegL2','SpiderLegL3'].map(j=>rot(j,'z',[0,0.3,-0.22,-0.08,0])),...['SpiderLegR0','SpiderLegR1','SpiderLegR2','SpiderLegR3'].map(j=>rot(j,'z',[0,-0.3,0.22,0.08,0]))]
      : [rot('Hips','z',[0,-0.3,0.24,0.08,0]),rot('Spine','y',[0,-0.22,0.18,0.04,0]),rot('Leg_L','x',[0,0.42,-0.18,-0.04,0]),rot('Leg_R','x',[0,-0.28,0.16,0.04,0]),rot('Arm_L','z',[0,0.35,-0.2,0,0]),rot('Arm_R','z',[0,-0.35,0.2,0,0])]);
  // One channel per node/path is required by glTF; keep the guard pose in the X plane.
  addAnim('Block',[rot('Arm_L','x',[0,-0.48,-0.58,-0.48,0]),rot('Arm_R','x',[0,-0.48,-0.58,-0.48,0]),rot('Spine','x',[0,-0.08,-0.12,-0.06,0]),rot('Head','x',[0,0.06,0.02,0,0])]);
  addAnim('Stagger', beast
    ? [rot('Head','x',[0,0.18,-0.14,0.08,0]),rot('Spine','z',[0,0.18,-0.16,0.06,0]),rot('TailMid','y',[0,0.24,-0.2,0.08,0]),rot('TailTip','y',[0,0.34,-0.28,0.1,0])]
    : crawler
      ? [rot('Spine','z',[0,0.2,-0.18,0.06,0]),rot('Head','x',[0,0.12,-0.1,0.03,0]),...['SpiderLegL0','SpiderLegR1','SpiderLegL2','SpiderLegR3'].map(j=>rot(j,'z',[0,0.28,-0.16,0.04,0]))]
      : [rot('Hips','z',[0,0.18,-0.14,0.05,0]),rot('Spine','x',[0,0.2,-0.16,0.04,0]),rot('Head','z',[0,0.16,-0.12,0.03,0]),rot('Arm_L','x',[0,0.18,-0.12,0.03,0]),rot('Arm_R','x',[0,-0.18,0.12,-0.03,0])]);
  addAnim('Spawn', beast
    ? [rot('Spine','x',[0,0.42,-0.16,0.08,0]),rot('Head','x',[0,0.35,-0.12,0.04,0]),rot('Wing_L','z',[0,-0.9,-0.35,-0.1,0]),rot('Wing_R','z',[0,0.9,0.35,0.1,0]),rot('TailMid','y',[0,-0.3,0.18,0.04,0]),rot('TailTip','y',[0,-0.48,0.24,0.06,0])]
    : [rot('Hips','x',[0,0.35,-0.12,0.04,0]),rot('Spine','x',[0,-0.28,0.12,-0.03,0]),rot('Head','x',[0,0.24,-0.08,0.02,0]),rot('Arm_L','z',[0,-0.55,-0.22,-0.06,0]),rot('Arm_R','z',[0,0.55,0.22,0.06,0])]);
  addAnim('Taunt', beast
    ? [rot('Head','x',[0,-0.22,-0.42,-0.12,0]),rot('Spine','y',[0,-0.18,0.18,0,0]),rot('Wing_L','z',[0,-0.35,-0.7,-0.25,0]),rot('Wing_R','z',[0,0.35,0.7,0.25,0]),rot('TailTip','y',[0,0.25,-0.2,0.08,0])]
    : crawler
      ? [rot('Head','y',[0,-0.25,0.28,-0.12,0]),...['SpiderLegL0','SpiderLegR1','SpiderLegL2','SpiderLegR3'].map(j=>rot(j,'z',[0,0.45,-0.25,0.12,0]))]
      : [rot('Head','y',[0,-0.32,0.36,-0.14,0]),rot('Spine','y',[0,-0.2,0.22,-0.06,0]),rot('Arm_L','z',[0,-0.38,-0.72,-0.24,0]),rot('Arm_R','z',[0,0.38,0.72,0.24,0]),rot('Hips','y',[0,-0.08,0.08,0,0])]);
  addAnim('Victory', beast
    ? [rot('Head','x',[0,-0.1,-0.2,0,0]),rot('Wing_L','z',[0,-0.25,-0.7,-0.2,0]),rot('Wing_R','z',[0,0.25,0.7,0.2,0]),rot('Tail','y',[0,0.1,-0.1,0,0]),rot('TailMid','y',[0,0.06,-0.06,0,0]),rot('TailTip','y',[0,0.08,-0.08,0,0])]
    : [rot('Spine','x',[0,-0.06,-0.12,-0.03,0]),rot('Arm_L','z',[0,-0.2,-0.6,-0.25,0]),rot('Arm_R','z',[0,0.2,0.6,0.25,0]),rot('Head','y',[0,-0.08,0.08,0,0])]);

  const bin=Buffer.concat(chunks);
  const gltf={
    asset:{version:'2.0',generator:'Last Fortress Rigged Character Forge 2.0 PBR'},
    extensionsUsed:['KHR_materials_emissive_strength'],
    scene:0,scenes:[{name:id+' scene',nodes:roots}],
    nodes,meshes:meshDefs,materials,
    images:imageUris.map((uri,i)=>({name:['Armor Albedo','Forged Edge Albedo','Woven Hide Albedo','Aether Core Albedo','Dark Iron Albedo','Tangent-Space Normal','Metallic-Roughness','Ambient Occlusion','Aether Emissive'][i] ?? ('PBR Map '+i),uri,mimeType:'image/png'})),
    textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
    skins:[{name:id+' rigid-weighted skeleton',inverseBindMatrices:ibm,skeleton:0,joints:jointNames.map((_,i)=>i)}],
    animations,buffers:[{byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')}],
    bufferViews,accessors,
  };
  return gltf;
}
function packGlb(gltf) {
  const binaryChunks = [Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64')];
  let binaryLength = binaryChunks[0].length;
  for (const image of gltf.images ?? []) {
    while (binaryLength % 4) { binaryChunks.push(Buffer.from([0])); binaryLength++; }
    const png = Buffer.from(image.uri.slice(image.uri.indexOf(',') + 1), 'base64');
    const viewIndex = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: png.length });
    binaryChunks.push(png);
    binaryLength += png.length;
    image.bufferView = viewIndex;
    delete image.uri;
  }
  gltf.buffers = [{ byteLength: binaryLength }];
  const binary = Buffer.concat(binaryChunks);
  const paddedBinary = binary.length % 4 ? Buffer.concat([binary, Buffer.alloc(4 - binary.length % 4)]) : binary;
  const jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8');
  const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(paddedJsonLength - jsonBytes.length, 0x20)]);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + paddedBinary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBinary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, paddedBinary]);
}
for(const [id,category,color,accent,style] of roster) {
  const file=path.join(OUT,id+'.glb');
  fs.writeFileSync(file,packGlb(makeCharacter(id,category,color,accent,style)));
}
console.log('Rigged character forge: generated '+roster.length+' self-contained GLB assets with embedded PBR maps, articulated animation and 3 distance LODs per model.');
