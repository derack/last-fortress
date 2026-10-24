// ============================================================
// بخش ۴: انیمیشن‌ها (قرارداد کلیپ‌های اصلی — baseline لگن 0.98)
// ============================================================
function buildAnimations(ctx) {
  const { accessor } = ctx;
  const animations=[];
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
  const rot=(joint,axis,angles)=>({joint,path:'rotation',values:angles.map(a=>quat(axis,a))});
  const tr=(joint,values)=>({joint,path:'translation',values});

  const addAnim=(name,tracks)=>{
    // آرتیکولاسیون ثانویه ساعد/زانو/دست — همان جدول ژنراتور اصلی
    const secondary = name === 'Idle'
      ? [rot('ForeArm_L','x',[0,-0.025,0,0.02,0]),rot('ForeArm_R','x',[0,0.02,0,-0.025,0])]
      : name === 'Walk'
        ? [rot('ForeArm_L','x',[0,-0.22,0,0.22,0]),rot('ForeArm_R','x',[0,0.22,0,-0.22,0]),rot('Knee_L','x',[0,0.38,0,-0.18,0]),rot('Knee_R','x',[0,-0.18,0,0.38,0]),rot('Hand_L','x',[0,-0.08,0,0.08,0]),rot('Hand_R','x',[0,0.08,0,-0.08,0])]
        : name === 'Run'
          ? [rot('ForeArm_L','x',[0,-0.38,0,0.38,0]),rot('ForeArm_R','x',[0,0.38,0,-0.38,0]),rot('Knee_L','x',[0,0.62,0,-0.28,0]),rot('Knee_R','x',[0,-0.28,0,0.62,0]),rot('Hand_L','x',[0,-0.12,0,0.12,0]),rot('Hand_R','x',[0,0.12,0,-0.12,0])]
          : ['Attack','Attack1'].includes(name)
            ? [rot('ForeArm_R','x',[0,-0.24,-0.72,0.18,0]),rot('Hand_R','z',[0,-0.08,0.3,0.06,0]),rot('ForeArm_L','x',[0,-0.1,-0.22,0,0]),rot('Knee_L','x',[0,0.08,0.18,0.04,0]),rot('Knee_R','x',[0,-0.06,-0.12,0,0])]
            : ['Attack2','SpecialAttack','Skill'].includes(name)
              ? [rot('ForeArm_L','x',[0,-0.2,-0.45,-0.08,0]),rot('ForeArm_R','x',[0,-0.25,-0.58,-0.08,0]),rot('Hand_L','z',[0,0.1,0.22,0.04,0]),rot('Hand_R','z',[0,-0.12,-0.28,-0.04,0]),rot('Knee_L','x',[0,0.12,0.22,0.06,0]),rot('Knee_R','x',[0,0.12,0.22,0.06,0])]
              : ['Hit','Stagger'].includes(name)
                ? [rot('ForeArm_L','x',[0,0.18,-0.12,0.03,0]),rot('ForeArm_R','x',[0,-0.18,0.12,-0.03,0]),rot('Knee_L','x',[0,0.1,0.18,0.04,0]),rot('Knee_R','x',[0,0.1,0.18,0.04,0])]
                : name === 'Death'
                  ? [rot('ForeArm_L','z',[0,-0.15,-0.45,-0.62,-0.62]),rot('ForeArm_R','z',[0,0.15,0.45,0.62,0.62]),rot('Knee_L','x',[0,0.18,0.4,0.4,0.4]),rot('Knee_R','x',[0,0.18,0.4,0.4,0.4])]
                  : ['Roar','Taunt','Victory','PhaseChange','Spawn','Block','Dodge'].includes(name)
                    ? [rot('ForeArm_L','z',[0,-0.18,-0.38,-0.12,0]),rot('ForeArm_R','z',[0,0.18,0.38,0.12,0]),rot('Hand_L','x',[0,-0.08,0.12,0,0]),rot('Hand_R','x',[0,-0.08,0.12,0,0])]
                    : [];
    const existing = new Set(tracks.map((track) => track.joint + ':' + track.path));
    tracks = [...tracks, ...secondary.filter((track) => !existing.has(track.joint + ':' + track.path))];
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

  // ---------- Idle ----------
  addAnim('Idle',[rot('Spine','x',[0,0.018,0,-0.012,0]),rot('Head','y',[0,-0.035,0,0.035,0])]);
  // ---------- Walk (baseline لگن آناتومیک 0.98) ----------
  addAnim('Walk',[
    rot('Leg_L','x',[0,0.42,0,-0.42,0]),rot('Leg_R','x',[0,-0.42,0,0.42,0]),
    rot('Knee_L','x',[0,0.18,0.04,0.32,0]),rot('Knee_R','x',[0,0.32,0.04,0.18,0]),
    rot('Foot_L','x',[0,-0.12,0,0.1,0]),rot('Foot_R','x',[0,0.1,0,-0.12,0]),
    rot('Arm_L','x',[0,-0.3,0,0.3,0]),rot('Arm_R','x',[0,0.3,0,-0.3,0]),
    rot('ForeArm_L','x',[0,-0.08,0.04,0.08,0]),rot('ForeArm_R','x',[0,0.08,0.04,-0.08,0]),
    rot('Chest','x',[0,0.025,0,-0.025,0]),
    tr('Hips',[[0,0.98,0],[0,1.02,0],[0,0.98,0],[0,1.02,0],[0,0.98,0]])
  ]);
  // ---------- Run ----------
  addAnim('Run',[
    rot('Leg_L','x',[0,0.72,0,-0.72,0]),rot('Leg_R','x',[0,-0.72,0,0.72,0]),
    rot('Knee_L','x',[0,0.42,0,0.18,0]),rot('Knee_R','x',[0,0.18,0,0.42,0]),
    rot('Foot_L','x',[0,-0.2,0,0.12,0]),rot('Foot_R','x',[0,0.12,0,-0.2,0]),
    rot('Arm_L','x',[0,-0.48,0,0.48,0]),rot('Arm_R','x',[0,0.48,0,-0.48,0]),
    rot('ForeArm_L','x',[0,-0.14,0.08,0.14,0]),rot('ForeArm_R','x',[0,0.14,0.08,-0.14,0]),
    rot('Spine','x',[0,0.08,0,0.08,0]),rot('Chest','x',[0,-0.06,0.02,-0.06,0])
  ]);
  // ---------- Attack (امضای آرمان: ضرب عمودی شمشیر بزرگ) ----------
  const attackTracks=[rot('Arm_R','x',[-0.18,-0.92,0.78,0.16,-0.18]),rot('Hand_R','z',[0,-0.32,0.62,0.08,0]),rot('Arm_L','x',[0,-0.16,0.22,0,0]),rot('Spine','y',[0,-0.16,0.22,0,0])];
  addAnim('Attack',attackTracks);
  addAnim('Attack1',attackTracks);
  addAnim('Attack2',[rot('Arm_R','x',[-0.1,-1.05,1.08,0.2,-0.1]),rot('Hand_R','z',[0,-0.48,0.78,0.12,0]),rot('Arm_L','x',[0,-0.24,0.38,0,0]),rot('Spine','y',[0,-0.28,0.34,0,0]),rot('Hips','y',[0,-0.08,0.1,0,0])]);
  addAnim('SpecialAttack',[rot('Spine','x',[0,-0.18,-0.36,0.08,0]),rot('Head','x',[0,-0.2,-0.38,-0.05,0]),rot('Arm_L','z',[0,-0.45,-0.75,-0.2,0]),rot('Arm_R','z',[0,0.45,0.75,0.2,0])]);
  addAnim('Skill',[rot('Spine','y',[0,-0.24,0.38,-0.12,0]),rot('Arm_R','x',[0,-1.08,0.82,0.14,0]),rot('Hand_R','z',[0,-0.5,0.76,0.08,0]),rot('Arm_L','z',[0,-0.32,-0.62,-0.12,0])]);
  addAnim('Hit',[rot('Spine','x',[0,-0.2,-0.05,0,0]),rot('Head','z',[0,0.12,-0.05,0,0]),rot('Arm_R','x',[0,-0.12,0,0,0])]);
  addAnim('Death',[rot('Hips','z',[0,0.35,1.0,1.48,1.48]),rot('Spine','x',[0,-0.15,-0.32,-0.38,-0.38]),rot('Head','x',[0,0.08,0.18,0.22,0.22])]);
  addAnim('Roar',[rot('Head','x',[0,-0.3,-0.55,-0.25,0]),rot('Spine','x',[0,-0.12,-0.2,-0.08,0])]);
  addAnim('PhaseChange',[rot('Spine','x',[0,-0.12,-0.28,-0.12,0]),rot('Arm_L','z',[0,-0.55,-0.9,-0.35,0]),rot('Arm_R','z',[0,0.55,0.9,0.35,0]),rot('Head','y',[0,-0.25,0.25,-0.1,0])]);
  addAnim('Dodge',[rot('Hips','z',[0,-0.3,0.24,0.08,0]),rot('Spine','y',[0,-0.22,0.18,0.04,0]),rot('Leg_L','x',[0,0.42,-0.18,-0.04,0]),rot('Leg_R','x',[0,-0.28,0.16,0.04,0]),rot('Arm_L','z',[0,0.35,-0.2,0,0]),rot('Arm_R','z',[0,-0.35,0.2,0,0])]);
  addAnim('Block',[rot('Arm_L','x',[0,-0.48,-0.58,-0.48,0]),rot('Arm_R','x',[0,-0.48,-0.58,-0.48,0]),rot('Spine','x',[0,-0.08,-0.12,-0.06,0]),rot('Head','x',[0,0.06,0.02,0,0])]);
  addAnim('Stagger',[rot('Hips','z',[0,0.18,-0.14,0.05,0]),rot('Spine','x',[0,0.2,-0.16,0.04,0]),rot('Head','z',[0,0.16,-0.12,0.03,0]),rot('Arm_L','x',[0,0.18,-0.12,0.03,0]),rot('Arm_R','x',[0,-0.18,0.12,-0.03,0])]);
  addAnim('Spawn',[rot('Hips','x',[0,0.35,-0.12,0.04,0]),rot('Spine','x',[0,-0.28,0.12,-0.03,0]),rot('Head','x',[0,0.24,-0.08,0.02,0]),rot('Arm_L','z',[0,-0.55,-0.22,-0.06,0]),rot('Arm_R','z',[0,0.55,0.22,0.06,0])]);
  addAnim('Taunt',[rot('Head','y',[0,-0.32,0.36,-0.14,0]),rot('Spine','y',[0,-0.2,0.22,-0.06,0]),rot('Arm_L','z',[0,-0.38,-0.72,-0.24,0]),rot('Arm_R','z',[0,0.38,0.72,0.24,0]),rot('Hips','y',[0,-0.08,0.08,0,0])]);
  addAnim('Victory',[rot('Spine','x',[0,-0.06,-0.12,-0.03,0]),rot('Arm_L','z',[0,-0.2,-0.6,-0.25,0]),rot('Arm_R','z',[0,0.2,0.6,0.25,0]),rot('Head','y',[0,-0.08,0.08,0,0])]);
  return animations;
}

// ============================================================
// MAIN
// ============================================================
const ctx = buildArman();
const animations = buildAnimations({ accessor: ctx.accessor });
const bin=Buffer.concat(ctx.chunks);
const gltf={
  asset:{version:'2.0',generator:'Last Fortress Hero Anatomy Forge 1.0'},
  extensionsUsed:['KHR_materials_emissive_strength'],
  scene:0,scenes:[{name:'arman scene',nodes:ctx.roots}],
  nodes:ctx.nodes,meshes:ctx.meshDefs,materials:ctx.materials,
  images:ctx.imageUris.map((uri,i)=>({name:['Armor Albedo','Forged Edge Albedo','Woven Hide Albedo','Aether Core Albedo','Dark Iron Albedo','Tangent-Space Normal','Metallic-Roughness','Ambient Occlusion','Aether Emissive'][i] ?? ('PBR Map '+i),uri,mimeType:'image/png'})),
  textures:ctx.textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
  skins:[{name:'arman anatomy skeleton',inverseBindMatrices:ctx.ibm,skeleton:0,joints:jointNames.map((_,i)=>i)}],
  animations,buffers:[{byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')}],
  bufferViews:ctx.bufferViews,accessors:ctx.accessors,
};
const glb=packGlb(gltf);
const OUT='/home/z/my-project/public/assets/3d/rigged/arman.glb';
fs.writeFileSync(OUT,glb);
// آمار
let verts=0,tris=0;
for(const m of ctx.meshDefs) for(const prim of m.primitives){verts+=prim.attributes.POSITION!==undefined?0:0;tris+=0;}
const vcount=(gltf.accessors||[]).filter(a=>a.type==='VEC3'&&a.target===34962).reduce((s,a)=>s+a.count,0);
const icount=(gltf.accessors||[]).filter(a=>a.type==='SCALAR'&&a.target===34963).reduce((s,a)=>s+a.count,0);
console.log('HERO ANATOMY FORGE — arman.glb');
console.log('  pieces: '+ctx.pieces.length);
console.log('  meshes (material groups): base='+ctx.meshDefs.filter(m=>!m.name.includes('_LOD')).length+' x3 LOD tiers');
console.log('  vertices (approx, all LODs): '+vcount);
console.log('  triangle indices: '+icount);
console.log('  animations: '+animations.length+' ('+animations.map(a=>a.name).join(', ')+')');
console.log('  file size: '+(glb.length/1024/1024).toFixed(2)+' MB');
console.log('  written: '+OUT);
