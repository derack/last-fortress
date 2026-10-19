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
];
const jointNames = ['Root','Hips','Spine','Head','Arm_L','Arm_R','Leg_L','Leg_R','Tail','Wing_L','Wing_R','Jaw'];
const jointIndex = Object.fromEntries(jointNames.map((n,i)=>[n,i]));
const boneParents = [-1,0,1,2,2,2,1,1,1,2,2,3];
const boneLocal = [
  [0,0,0],[0,0.72,0],[0,0.34,0],[0,0.47,0],[-0.39,0.24,0],[0.39,0.24,0],
  [-0.16,-0.23,0],[0.16,-0.23,0],[0,-0.12,-0.25],[-0.31,0.28,-0.08],[0.31,0.28,-0.08],[0,-0.14,0.12],
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
function makeCharacter(id, category, baseColor, accent, style) {
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
      cyl([x*1.55,0.53,z],[0.075,0.48,0.075],'Leg_'+(side<0?'L':'R'),edge,[0,0,side*(0.42+i*0.14)]);
      cone([x*1.8,0.29,z+0.08],[0.075,0.3,0.075],'Leg_'+(side<0?'L':'R'),armor,[0,0,side*0.3]);
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
    for(let i=0;i<5;i++) cone([0,1.08-i*0.13,-0.25-i*0.17],[0.09,0.22,0.1],'Tail',edge,[0.22,0,0]);
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
    if(style==='mage') {
      cyl([0.55,1.0,0.03],[0.045,1.05,0.045],'Arm_R',dark);
      sphere([0.55,1.57,0.03],[0.15,0.15,0.15],'Arm_R',glow);
      for(let i=0;i<3;i++) cone([0.55+Math.cos(i*2.094)*0.19,1.57+Math.sin(i*2.094)*0.19,0.03],[0.035,0.14,0.035],'Arm_R',edge,[0,0,i*0.7]);
    } else {
      cyl([0.58,0.92,0.05],[0.055,0.85,0.055],'Arm_R',dark,[0,0,-0.18]);
      box([0.68,1.22,0.05],[0.28,0.36,0.09],'Arm_R',edge,[0,0,-0.18]);
      cone([0.68,1.43,0.05],[0.07,0.18,0.07],'Arm_R',glow);
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
    for(let i=0;i<4;i++) sphere([0,0.46-i*0.1,-0.42-i*0.16],[0.12-i*0.015,0.12-i*0.015,0.16],'Tail',i%2?armor:edge);
  }

  const materials = [
    {name:'Obsidian Armor',pbrMetallicRoughness:{baseColorFactor:clampColor(baseColor),metallicFactor:0.62,roughnessFactor:0.38}},
    {name:'Forged Edge',pbrMetallicRoughness:{baseColorFactor:[0.63,0.7,0.8,1],metallicFactor:0.88,roughnessFactor:0.24}},
    {name:'Woven/Hide',pbrMetallicRoughness:{baseColorFactor:[0.16,0.13,0.2,1],metallicFactor:0.08,roughnessFactor:0.9}},
    {name:'Aether Core',pbrMetallicRoughness:{baseColorFactor:clampColor(accent),metallicFactor:0.22,roughnessFactor:0.2},emissiveFactor:clampColor(accent).slice(0,3),extensions:{KHR_materials_emissive_strength:{emissiveStrength:1.8}}},
    {name:'Dark Iron',pbrMetallicRoughness:{baseColorFactor:[0.07,0.08,0.12,1],metallicFactor:0.76,roughnessFactor:0.34}},
  ];
  const materialIndex={armor:0,edge:1,cloth:2,glow:3,dark:4};
  // Build low-poly primitives in character/model space.
  const buildPrimitive=(piece)=>{
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
      const base=pos.length/3;
      for(const p of [a,b,c]) {pos.push(...p);norm.push(...n);uv.push(p[0]*0.72,p[2]*0.72);}
      indices.push(base,base+1,base+2);
    };
    if(piece.kind==='box') {
      const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]].map(p=>rotate([p[0]*sx,p[1]*sy,p[2]*sz]));
      const faces=[[0,2,1,0,3,2],[4,5,6,4,6,7],[0,1,5,0,5,4],[3,7,6,3,6,2],[0,4,7,0,7,3],[1,2,6,1,6,5]];
      for(const f of faces) for(let i=0;i<6;i+=3) pushTri(v[f[i]],v[f[i+1]],v[f[i+2]]);
    } else if(piece.kind==='sphere') {
      // Indexed smooth sphere: reuse vertices instead of duplicating every triangle corner.
      const lat=6,lon=8, base=pos.length/3, points=[];
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
      const segments=piece.kind==='cone'?8:10, topR=piece.kind==='cone'?0:0.5, botR=0.5;
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
  // Merge all same-joint/material geometry: only a handful of skinned draw calls per character.
  const merged=new Map();
  for(const piece of pieces) {
    const g=buildPrimitive(piece),key=String(g.mat);
    if(!merged.has(key))merged.set(key,{pos:[],norm:[],uv:[],joints:[],weights:[],indices:[],joint:g.joint,mat:g.mat});
    const m=merged.get(key),offset=m.pos.length/3;
    m.pos.push(...g.pos);m.norm.push(...g.norm);m.uv.push(...g.uv);
    for(let i=0;i<g.pos.length/3;i++){m.joints.push(g.joint,0,0,0);m.weights.push(1,0,0,0);}
    m.indices.push(...g.indices.map(i=>i+offset));
  }

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
  const meshDefs=[],meshNodes=[];
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
    meshDefs.push({name:id+'_'+materials[g.mat].name,primitives:[{attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:tex,JOINTS_0:j,WEIGHTS_0:w},indices:ix,material:g.mat,mode:4}]});
    meshNodes.push({name:id+'_'+materials[g.mat].name,mesh:meshDefs.length-1,skin:0});
  }

  const nodes=jointNames.map((name,i)=>({name,translation:boneLocal[i],children:[]}));
  for(let i=1;i<jointNames.length;i++)nodes[boneParents[i]].children.push(i);
  const meshNodeStart=nodes.length;
  nodes.push(...meshNodes);
  const roots=[0,...meshNodes.map((_,i)=>meshNodeStart+i)];
  const invBind=[];
  for(const p of boneWorld) invBind.push(1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1);
  const ibm=accessor(new Float32Array(invBind),'MAT4',5126,jointNames.length);
  const animations=[];
  const addAnim=(name,tracks)=>{
    const samplers=[],channels=[];
    const times=new Float32Array([0,0.25,0.5,0.75,1]);
    const ti=accessor(times,'SCALAR',5126,times.length);
    for(const track of tracks) {
      const vals=track.values.flat();
      const oi=accessor(new Float32Array(vals),track.path==='rotation'?'VEC4':'VEC3',5126,track.values.length);
      const si=samplers.length;samplers.push({input:ti,output:oi,interpolation:'LINEAR'});
      channels.push({sampler:si,target:{node:jointIndex[track.joint],path:track.path}});
    }
    animations.push({name,samplers,channels});
  };
  const rot=(joint,axis,angles)=>({joint,path:'rotation',values:angles.map(a=>quat(axis,a))});
  const tr=(joint,values)=>({joint,path:'translation',values});
  addAnim('Idle',[rot('Spine','x',[0,0.018,0,-0.012,0]),rot('Head','y',[0,-0.035,0,0.035,0])]);
  const beast=['dragon','dragonBoss','flyer'].includes(style);
  const crawler=style==='spider';
  const heavy=['golem','bossGolem','fireBoss','iceBoss','machine','tank','brute','darkBoss'].includes(style);
  const walkTracks = beast
    ? [rot('Leg_L','x',[0,0.16,0,-0.16,0]),rot('Leg_R','x',[0,-0.16,0,0.16,0]),rot('Wing_L','z',[0,-0.28,0,0.28,0]),rot('Wing_R','z',[0,0.28,0,-0.28,0]),rot('Tail','x',[0,0.12,0,-0.12,0])]
    : crawler
      ? [rot('Leg_L','z',[0,0.48,0,-0.48,0]),rot('Leg_R','z',[0,-0.48,0,0.48,0]),rot('Spine','x',[0,0.04,0,-0.04,0])]
      : [rot('Leg_L','x',[0,0.42,0,-0.42,0]),rot('Leg_R','x',[0,-0.42,0,0.42,0]),rot('Arm_L','x',[0,-0.3,0,0.3,0]),rot('Arm_R','x',[0,0.3,0,-0.3,0]),tr('Hips',[[0,0.72,0],[0,0.76,0],[0,0.72,0],[0,0.76,0],[0,0.72,0]])];
  addAnim('Walk',walkTracks);
  const runTracks = beast
    ? [rot('Leg_L','x',[0,0.3,0,-0.3,0]),rot('Leg_R','x',[0,-0.3,0,0.3,0]),rot('Wing_L','z',[0,-0.62,0,0.62,0]),rot('Wing_R','z',[0,0.62,0,-0.62,0]),rot('Tail','x',[0,0.2,0,-0.2,0])]
    : crawler
      ? [rot('Leg_L','z',[0,0.75,0,-0.75,0]),rot('Leg_R','z',[0,-0.75,0,0.75,0])]
      : [rot('Leg_L','x',[0,0.72,0,-0.72,0]),rot('Leg_R','x',[0,-0.72,0,0.72,0]),rot('Arm_L','x',[0,-0.48,0,0.48,0]),rot('Arm_R','x',[0,0.48,0,-0.48,0]),rot('Spine','x',[0,0.08,0,0.08,0])];
  addAnim('Run',runTracks);
  const attackTracks = beast
    ? [rot('Head','x',[-0.05,-0.35,0.24,0.08,-0.05]),rot('Jaw','x',[0,0.18,0.38,0.12,0]),rot('Tail','y',[0,0.22,-0.25,0.08,0]),rot('Wing_L','z',[0,-0.5,-0.9,-0.2,0]),rot('Wing_R','z',[0,0.5,0.9,0.2,0])]
    : crawler
      ? [rot('Head','x',[0,-0.24,0.12,0,0]),rot('Leg_L','z',[0,0.3,-0.6,0.15,0]),rot('Leg_R','z',[0,-0.3,0.6,-0.15,0])]
      : [rot('Arm_R','x',[-0.15,-0.95,0.85,0.3,-0.15]),rot('Spine','y',[0,-0.1,0.12,0,0]),...(heavy?[rot('Arm_L','x',[0,-0.35,0.55,0,0])]:[])];
  addAnim('Attack',attackTracks);
  addAnim('Attack1',attackTracks);
  addAnim('Attack2',heavy?[rot('Arm_L','x',[0,-0.7,0.95,0.2,0]),rot('Spine','y',[0,0.2,-0.24,0,0])]:attackTracks);
  addAnim('SpecialAttack',[rot('Spine','x',[0,-0.18,-0.36,0.08,0]),rot('Head','x',[0,-0.2,-0.38,-0.05,0]),rot('Wing_L','z',[0,-0.45,-0.85,-0.25,0]),rot('Wing_R','z',[0,0.45,0.85,0.25,0]),rot('Tail','y',[0,0.28,-0.3,0.1,0])]);
  addAnim('Hit',[rot('Spine','x',[0,-0.2,-0.05,0,0]),rot('Head','z',[0,0.12,-0.05,0,0])]);
  addAnim('Death',[rot('Hips','z',[0,0.35,1.25,1.48,1.48]),rot('Spine','x',[0,-0.15,-0.32,-0.38,-0.38])]);
  addAnim('Roar',[rot('Head','x',[0,-0.3,-0.55,-0.25,0]),rot('Spine','x',[0,-0.12,-0.2,-0.08,0]),rot('Wing_L','z',[0,-0.4,-0.75,-0.35,0]),rot('Wing_R','z',[0,0.4,0.75,0.35,0])]);
  addAnim('PhaseChange',[rot('Spine','x',[0,-0.12,-0.28,-0.12,0]),rot('Arm_L','z',[0,-0.55,-0.9,-0.35,0]),rot('Arm_R','z',[0,0.55,0.9,0.35,0]),rot('Head','y',[0,-0.25,0.25,-0.1,0])]);

  const bin=Buffer.concat(chunks);
  const gltf={
    asset:{version:'2.0',generator:'Last Fortress Rigged Character Forge 1.0'},
    extensionsUsed:['KHR_materials_emissive_strength'],
    scene:0,scenes:[{name:id+' scene',nodes:roots}],
    nodes,meshes:meshDefs,materials,
    skins:[{name:id+' rigid-weighted skeleton',inverseBindMatrices:ibm,skeleton:0,joints:jointNames.map((_,i)=>i)}],
    animations,buffers:[{byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')}],
    bufferViews,accessors,
  };
  return gltf;
}
for(const [id,category,color,accent,style] of roster) {
  const file=path.join(OUT,id+'.gltf');
  fs.writeFileSync(file,JSON.stringify(makeCharacter(id,category,color,accent,style)));
}
console.log('Rigged character forge: generated '+roster.length+' skinned, animated glTF assets.');
