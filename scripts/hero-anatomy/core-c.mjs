// ============================================================
// بخش ۳: سلاح‌ها + متریال + اسمبل GLB + انیمیشن
// ============================================================

function buildArmanGear(P) {
  const box=(c,s,j,m,r=[0,0,0])=>P.push({kind:'box',c,s,j,m,r});
  const ell=(c,s,j,m,r=[0,0,0])=>P.push({kind:'ellipsoid',c,s,j,m,r});
  const cone=(c,s,j,m,r=[0,0,0])=>P.push({kind:'cone',c,s,j,m,r});
  const taper=(j,m,o)=>P.push({kind:'taper',j,m,...o});

  // ---------- شمشیر بزرگ آذرخش (دست راست — Hand_R) — تناسب قهرمانی ----------
  const hx=0.295, hz=0.045;
  taper('Hand_R',ARM.leather,{y0:0.80,y1:1.005,r0:0.023,r1:0.023,x:hx,z:hz});            // دستهٔ چرمی
  taper('Hand_R',ARM.gold,{y0:0.85,y1:0.87,r0:0.026,r1:0.026,x:hx,z:hz});                // حلقهٔ طلایی دسته
  taper('Hand_R',ARM.gold,{y0:0.93,y1:0.95,r0:0.026,r1:0.026,x:hx,z:hz});
  ell([hx,0.778,hz],[0.037,0.03,0.037],'Hand_R',ARM.gold);                               // گوی پومل
  ell([hx,0.758,hz],[0.02,0.02,0.015],'Hand_R',ARM.glow);                                // نگین پومل
  box([hx,1.035,hz],[0.088,0.042,0.24],'Hand_R',ARM.gold);                               // گارد صلیبی پهن
  ell([hx,1.035,hz+0.115],[0.016,0.016,0.02],'Hand_R',ARM.glow);                         // نگین سر گارد
  ell([hx,1.035,hz-0.115],[0.016,0.016,0.02],'Hand_R',ARM.glow);
  box([hx,1.26,hz],[0.038,0.44,0.105],'Hand_R',ARM.edge);                                // تیغه پایین پهن
  box([hx,1.60,hz],[0.031,0.31,0.088],'Hand_R',ARM.edge);                                // تیغه بالا
  box([hx+0.005,1.45,hz],[0.044,0.66,0.016],'Hand_R',ARM.dark);                          // فولر (شیار مرکزی)
  box([hx,1.44,hz+0.048],[0.014,0.6,0.009],'Hand_R',ARM.glow);                           // خط آذرخش لبهٔ جلو
  box([hx,1.44,hz-0.048],[0.014,0.6,0.009],'Hand_R',ARM.glow);                           // خط آذرخش لبهٔ عقب
  cone([hx,1.815,hz],[0.037,0.13,0.05],'Hand_R',ARM.edge);                               // نوک تیغه

  // ---------- سپر ایجیس (ساعد چپ — Arm_L) ----------
  const sx0=-0.372, sz0=0.085;
  box([sx0,1.12,sz0],[0.042,0.52,0.375],'Arm_L',ARM.armor);                              // بدنه سپر
  box([sx0-0.014,1.12,sz0],[0.012,0.48,0.34],'Arm_L',ARM.edge);                          // رویهٔ فولاد روشن
  box([sx0-0.024,1.385,sz0],[0.02,0.026,0.375],'Arm_L',ARM.gold);                        // قاب طلایی بالا
  box([sx0-0.024,0.855,sz0],[0.02,0.026,0.375],'Arm_L',ARM.gold);                        // قاب طلایی پایین
  box([sx0-0.024,1.12,sz0+0.19],[0.02,0.53,0.024],'Arm_L',ARM.gold);                     // قاب طلایی لبهٔ جلو
  box([sx0-0.024,1.12,sz0-0.19],[0.02,0.53,0.024],'Arm_L',ARM.gold);                     // قاب طلایی لبهٔ عقب
  ell([sx0-0.036,1.12,sz0],[0.024,0.098,0.098],'Arm_L',ARM.gold);                        // حلقهٔ مرکزی
  ell([sx0-0.044,1.12,sz0],[0.028,0.075,0.075],'Arm_L',ARM.glow);                        // چشم آذرخش سپر
  for(const [dy,dz] of [[0.13,0.1],[0.13,-0.1],[-0.13,0.1],[-0.13,-0.1]])
    ell([sx0-0.03,1.12+dy,sz0+dz],[0.018,0.02,0.02],'Arm_L',ARM.gold);                   // چهار میخ طلایی
  cone([sx0-0.03,1.475,sz0],[0.034,0.11,0.034],'Arm_L',ARM.glow);                        // تیغهٔ بالایی کریستالی
  cone([sx0-0.03,0.765,sz0],[0.034,0.11,0.034],'Arm_L',ARM.glow,[Math.PI,0,0]);          // تیغهٔ پایینی کریستالی
  box([-0.318,1.22,0.03],[0.085,0.048,0.115],'Arm_L',ARM.leather);                       // بند بالایی
  box([-0.318,1.02,0.03],[0.085,0.048,0.115],'Arm_L',ARM.leather);                       // بند پایینی
  return P;
}

// ============ متریال‌ها (۹ عدد — روی ۵ آلبیدوی grayscale تینت می‌شوند) ============
const MATERIAL_DEFS = {
  armor:  {name:'Steel Azure',   f:[0.365,0.420,0.478,1], metal:0.62, rough:0.38, tex:0},
  edge:   {name:'Forged Edge',   f:[0.63,0.70,0.80,1],    metal:0.88, rough:0.24, tex:1},
  cloth:  {name:'Indigo Weave',  f:[0.18,0.373,0.541,1],  metal:0.08, rough:0.88, tex:2},
  glow:   {name:'Storm Crystal', f:[0.576,0.773,0.992,1], metal:0.20, rough:0.20, tex:3},
  dark:   {name:'Dark Iron',     f:[0.07,0.08,0.12,1],    metal:0.76, rough:0.34, tex:4},
  gold:   {name:'Azar Gold',     f:[0.843,0.678,0.380,1], metal:0.94, rough:0.28, tex:1},
  leather:{name:'War Leather',   f:[0.478,0.353,0.227,1], metal:0.05, rough:0.85, tex:2},
  skin:   {name:'Skin',          f:[0.851,0.627,0.435,1], metal:0.00, rough:0.62, tex:2},
  beard:  {name:'Beard',         f:[0.110,0.102,0.094,1], metal:0.02, rough:0.95, tex:2},
};
const MAT_KEYS = Object.keys(MATERIAL_DEFS);
const matIndex = Object.fromEntries(MAT_KEYS.map((k,i)=>[k,i]));

// ============ اسمبل کامل ============
function buildArman() {
  const pieces = buildArmanGear(buildArmanPieces());

  const materials = MAT_KEYS.map((k)=>{
    const d=MATERIAL_DEFS[k];
    const m={name:d.name, pbrMetallicRoughness:{baseColorFactor:d.f, metallicFactor:d.metal, roughnessFactor:d.rough}};
    if(k==='glow'){ m.emissiveFactor=[d.f[0],d.f[1],d.f[2]]; m.extensions={KHR_materials_emissive_strength:{emissiveStrength:1.8}}; }
    return m;
  });
  const pbrPngs = makePbrImages(0x242b37, 0x93c5fd, 'warrior', 'heroes');
  const imageUris = pbrPngs.map(png => 'data:image/png;base64,'+png.toString('base64'));
  const textures = Array.from({length:9},(_,i)=>({sampler:0,source:i}));
  const albedoTextureIndex = Object.fromEntries(MAT_KEYS.map(k=>[k, MATERIAL_DEFS[k].tex]));
  for (const k of MAT_KEYS) {
    const mat=materials[matIndex[k]];
    mat.pbrMetallicRoughness.baseColorTexture={index:albedoTextureIndex[k]};
    mat.pbrMetallicRoughness.metallicRoughnessTexture={index:6};
    mat.normalTexture={index:5,scale:0.7};
    mat.occlusionTexture={index:7,strength:0.28};
  }
  materials[matIndex.glow].emissiveTexture={index:8};

  // --- سازندهٔ پریمیتیو ---
  const buildPrimitive=(piece,lodLevel=0)=>{
    const g = piece.kind==='box' ? buildBox(piece,lodLevel)
      : piece.kind==='ellipsoid' ? buildEllipsoid(piece,lodLevel)
      : piece.kind==='taper' ? buildTaper(piece,lodLevel)
      : buildCone(piece,lodLevel);
    return {...g, joint:jointIndex[piece.j]??jointIndex.Spine, mat:matIndex[piece.m]??0};
  };

  const mergePieces=(lodLevel=0)=>{
    const merged=new Map();
    for(const piece of pieces) {
      const maxDim=Math.max(...(piece.kind==='taper'?[piece.r0*2,piece.r1*2,piece.y1-piece.y0]:piece.s));
      if(lodLevel===1 && maxDim<0.045 && piece.m!=='glow') continue;
      if(lodLevel===2 && maxDim<0.095 && piece.m!=='glow') continue;
      const g=buildPrimitive(piece,lodLevel), key=String(g.mat);
      if(!merged.has(key))merged.set(key,{pos:[],norm:[],uv:[],joints:[],weights:[],indices:[],joint:g.joint,mat:g.mat});
      const m=merged.get(key),offset=m.pos.length/3;
      m.pos.push(...g.pos);m.norm.push(...g.norm);m.uv.push(...g.uv);
      for(let i=0;i<g.pos.length/3;i++){m.joints.push(g.joint,0,0,0);m.weights.push(1,0,0,0);}
      m.indices.push(...g.indices.map(i=>i+offset));
    }
    return merged;
  };

  // --- بسته‌بندی باینری glTF (همان قرارداد ژنراتور اصلی) ---
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
      const meshName='arman_'+materials[g.mat].name+(suffix ? suffix+'_Part' : '');
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
  const attach=(name,parent,worldPosition)=>{
    const p=boneWorld[jointIndex[parent]];
    const index=nodes.length;
    nodes.push({name,translation:worldPosition.map((v,k)=>v-p[k]),children:[]});
    nodes[jointIndex[parent]].children.push(index);
  };
  attach('HeadPoint','Head',[0,1.79,0.05]);
  attach('ChestPoint','Chest',[0,1.42,0.16]);
  attach('HitPoint','Hips',[0,1.12,0]);
  attach('WeaponPoint','Arm_R',[0.30,1.88,0.045]);
  attach('StaffPoint','Arm_R',[0.30,1.05,0.02]);
  attach('MuzzlePoint','Chest',[0.2,1.45,0.3]);
  attach('MouthPoint','Head',[0,1.67,0.13]);
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
  appendLodGroup('arman_LOD1',lod1MeshNodes);
  appendLodGroup('arman_LOD2',lod2MeshNodes);
  const invBind=[];
  for(const p of boneWorld) invBind.push(1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1);
  const ibm=accessor(new Float32Array(invBind),'MAT4',5126,jointNames.length);
  return {materials,imageUris,textures,nodes,roots,meshDefs,ibm,accessor,accessors,bufferViews,chunks,pieces};
}
