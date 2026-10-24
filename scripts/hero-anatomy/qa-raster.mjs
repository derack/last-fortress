// ============================================================
// QA RASTERIZER — رندر نرم‌افزاری مدل هیرو بدون مرورگر
// هندسه LOD0 + متریال flat + نور سه‌جهته + z-buffer → PNG
// ============================================================
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  buildArmanPieces, buildArmanGear, buildTaper, buildEllipsoid, buildBox, buildCone,
  MATERIAL_DEFS, MAT_KEYS, matIndex, jointIndex, boneWorld, boneParents, jointNames, quat,
} from './lib-hero.mjs';

// ---------- PNG ----------
const PNG_CRC_TABLE = (() => { const t=new Uint32Array(256); for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;} return t; })();
function crc32(buf){let c=0xffffffff;for(let i=0;i<buf.length;i++){c=PNG_CRC_TABLE[(c^buf[i])&255]^(c>>>8);}return (c^0xffffffff)>>>0;}
function pngChunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out;}

// ---------- کواترنیون ----------
function qrot(q,v){
  const [qx,qy,qz,qw]=q;
  // t = 2*cross(q.xyz, v); v' = v + w*t + cross(q.xyz, t)
  const tx=2*(qy*v[2]-qz*v[1]), ty=2*(qz*v[0]-qx*v[2]), tz=2*(qx*v[1]-qy*v[0]);
  return [
    v[0]+qw*tx+(qy*tz-qz*ty),
    v[1]+qw*ty+(qz*tx-qx*tz),
    v[2]+qw*tz+(qx*ty-qy*tx),
  ];
}
function norm3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}

// ---------- هندسه ----------
const pieces = buildArmanGear(buildArmanPieces());
function pieceGeometry(piece, lod=0){
  if(piece.kind==='box') return buildBox(piece,lod);
  if(piece.kind==='ellipsoid') return buildEllipsoid(piece,lod);
  if(piece.kind==='taper') return buildTaper(piece,lod);
  return buildCone(piece,lod);
}
const tris=[];
for(const piece of pieces){
  const g=pieceGeometry(piece,0);
  const joint=piece.j, mat=matIndex[piece.m]??0;
  const pos=g.pos, nrm=g.norm;
  for(let i=0;i<g.indices.length;i+=3){
    const ia=g.indices[i]*3, ib=g.indices[i+1]*3, ic=g.indices[i+2]*3;
    tris.push({
      joint, mat,
      a:{p:[pos[ia],pos[ia+1],pos[ia+2]], n:[nrm[ia],nrm[ia+1],nrm[ia+2]]},
      b:{p:[pos[ib],pos[ib+1],pos[ib+2]], n:[nrm[ib],nrm[ib+1],nrm[ib+2]]},
      c:{p:[pos[ic],pos[ic+1],pos[ic+2]], n:[nrm[ic],nrm[ic+1],nrm[ic+2]]},
    });
  }
}
console.log('triangles:', tris.length);

// ---------- پوزها (نمونه‌گیری خطی کلیدها) ----------
const POSES = {
  rest: null,
  walk: { t: 0.21, dur: 0.82, r: {
    Leg_L:['x',[0,0.42,0,-0.42,0]], Leg_R:['x',[0,-0.42,0,0.42,0]],
    Knee_L:['x',[0,0.18,0.04,0.32,0]], Knee_R:['x',[0,0.32,0.04,0.18,0]],
    Foot_L:['x',[0,-0.12,0,0.1,0]], Foot_R:['x',[0,0.1,0,-0.12,0]],
    Arm_L:['x',[0,-0.3,0,0.3,0]], Arm_R:['x',[0,0.3,0,-0.3,0]],
  }},
  attack: { t: 0.40, dur: 0.72, r: {
    Arm_R:['x',[-0.18,-0.92,0.78,0.16,-0.18]], Hand_R:['z',[0,-0.32,0.62,0.08,0]],
    Arm_L:['x',[0,-0.16,0.22,0,0]], Spine:['y',[0,-0.16,0.22,0,0]],
  }},
};
function sampleTrack(vals,t,dur){
  const n=vals.length-1, pos=Math.min(n,Math.max(0,t/dur*n));
  const i=Math.min(n-1,Math.floor(pos)), f=pos-i;
  return vals[i]*(1-f)+vals[i+1]*f;
}
function makeVertexTransform(pose){
  const rotOf={};
  if(pose) for(const [j,[axis,vals]] of Object.entries(pose.r)) rotOf[j]=quat(axis,sampleTrack(vals,pose.t,pose.dur));
  const chainCache={};
  const chain=(j)=>{
    if(chainCache[j]) return chainCache[j];
    const list=[]; let i=jointIndex[j];
    while(i>=0){ list.push(i); i=boneParents[i]; }
    return chainCache[j]=list.reverse(); // Root..joint
  };
  return (joint,v)=>{
    let p=[...v];
    for(const bi of chain(joint)){
      const rq=rotOf[jointNames[bi]];
      if(!rq) continue;
      const piv=boneWorld[bi];
      p=qrot(rq,[p[0]-piv[0],p[1]-piv[1],p[2]-piv[2]]);
      p=[p[0]+piv[0],p[1]+piv[1],p[2]+piv[2]];
    }
    return p;
  };
}

// ---------- رندر یک نما ----------
const TW=490, TH=640;
const L1=norm3([2.4,3.4,2.6]), L2=norm3([-2.6,1.2,1.4]), L3=norm3([0.2,2.6,-3.0]);
const AMB=[0.30,0.34,0.42];
function renderView(tris, camAz, camEl, pose){
  const img=new Float32Array(TW*TH*3);
  const zbuf=new Float32Array(TW*TH).fill(1e9);
  const ce=Math.cos(camEl), se=Math.sin(camEl), dist=4.7;
  const eye=[Math.sin(camAz)*dist*ce, 0.95+se*dist*0.55, Math.cos(camAz)*dist*ce];
  const tgt=[0,0.95,0];
  let fwd=norm3([tgt[0]-eye[0],tgt[1]-eye[1],tgt[2]-eye[2]]);
  let right=norm3([-fwd[2],0,fwd[0]]); // cross(fwd, worldUp) → راستِ واقعی
  const up=[right[1]*fwd[2]-right[2]*fwd[1], right[2]*fwd[0]-right[0]*fwd[2], right[0]*fwd[1]-right[1]*fwd[0]];
  const f=1/Math.tan(15*Math.PI/180);
  const vt=makeVertexTransform(pose);
  for(const tr of tris){
    const col=MATERIAL_DEFS[MAT_KEYS[tr.mat]].f;
    const emit=MAT_KEYS[tr.mat]==='glow';
    const P=[vt(tr.joint,tr.a.p), vt(tr.joint,tr.b.p), vt(tr.joint,tr.c.p)];
    const S=[]; let behind=false;
    for(const p of P){
      const d=[p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]];
      const z=d[0]*fwd[0]+d[1]*fwd[1]+d[2]*fwd[2];
      if(z<0.1){behind=true;break;}
      const x=d[0]*right[0]+d[1]*right[1]+d[2]*right[2];
      const y=d[0]*up[0]+d[1]*up[1]+d[2]*up[2];
      S.push([(x/z*f*0.5+0.5)*TW,(0.5-y/z*f*0.5)*TH,z]);
    }
    if(behind) continue;
    const [s0,s1,s2]=S;
    const area=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);
    if(Math.abs(area)<0.005) continue;
    const minx=Math.max(0,Math.floor(Math.min(s0[0],s1[0],s2[0])));
    const maxx=Math.min(TW-1,Math.ceil(Math.max(s0[0],s1[0],s2[0])));
    const miny=Math.max(0,Math.floor(Math.min(s0[1],s1[1],s2[1])));
    const maxy=Math.min(TH-1,Math.ceil(Math.max(s0[1],s1[1],s2[1])));
    for(let yy=miny;yy<=maxy;yy++) for(let xx=minx;xx<=maxx;xx++){
      const px=xx+0.5, py=yy+0.5;
      const w1=((px-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(py-s0[1]))/area;
      const w2=((s1[0]-s0[0])*(py-s0[1])-(px-s0[0])*(s1[1]-s0[1]))/area;
      const w0=1-w1-w2;
      if(w0<0||w1<0||w2<0) continue;
      const z=w0*s0[2]+w1*s1[2]+w2*s2[2];
      const idx=yy*TW+xx;
      if(z<zbuf[idx]){
        zbuf[idx]=z;
        let r=AMB[0]*col[0], g=AMB[1]*col[1], bl=AMB[2]*col[2];
        if(emit){ r=col[0]*1.6+0.22; g=col[1]*1.6+0.28; bl=col[2]*1.6+0.42; }
        else {
          for(const [L,it] of [[L1,1.35],[L2,0.5],[L3,0.85]]){
            const d=Math.max(0,tr.a.n[0]*L[0]+tr.a.n[1]*L[1]+tr.a.n[2]*L[2]);
            r+=d*it*col[0]; g+=d*it*col[1]; bl+=d*it*col[2];
          }
        }
        img[idx*3]=Math.min(1,r); img[idx*3+1]=Math.min(1,g); img[idx*3+2]=Math.min(1,bl);
      }
    }
  }
  return img;
}

// ---------- کانتکت‌شیت ۳×۲ ----------
// مدل رو به +Z؛ دوربین در az=0 قرار می‌گیرد در +Z → FRONT
const views=[
  {az:0, el:0.10, pose:null, tag:'FRONT'},
  {az:0.7, el:0.13, pose:null, tag:'3/4'},
  {az:Math.PI/2, el:0.10, pose:null, tag:'SIDE'},
  {az:Math.PI, el:0.12, pose:null, tag:'BACK'},
  {az:0.62, el:0.14, pose:POSES.walk, tag:'WALK t=0.21'},
  {az:0.62, el:0.14, pose:POSES.attack, tag:'ATTACK t=0.40'},
];
const CW=TW*3, CH=TH*2;
const sheet=new Float32Array(CW*CH*3);
for(let i=0;i<CW*CH;i++){sheet[i*3]=0.075;sheet[i*3+1]=0.085;sheet[i*3+2]=0.11;}
views.forEach((v,i)=>{
  console.log('rendering view', v.tag);
  const tile=renderView(tris.concat(tris.map(t=>({joint:t.joint,mat:t.mat,a:t.a,b:t.c,c:t.b}))), v.az, v.el, v.pose);
  const ox=(i%3)*TW, oy=Math.floor(i/3)*TH;
  for(let y=0;y<TH;y++) for(let x=0;x<TW;x++){
    const si=(y*TW+x)*3, di=((y+oy)*CW+(x+ox))*3;
    sheet[di]=tile[si];sheet[di+1]=tile[si+1];sheet[di+2]=tile[si+2];
  }
});
const rgba=new Uint8Array(CW*CH*4);
for(let i=0;i<CW*CH;i++){
  rgba[i*4]=Math.pow(Math.max(0,sheet[i*3]),1/2.2)*255;
  rgba[i*4+1]=Math.pow(Math.max(0,sheet[i*3+1]),1/2.2)*255;
  rgba[i*4+2]=Math.pow(Math.max(0,sheet[i*3+2]),1/2.2)*255;
  rgba[i*4+3]=255;
}
const rows=Buffer.alloc((CW*4+1)*CH);
for(let y=0;y<CH;y++){rows[y*(CW*4+1)]=0;Buffer.from(rgba.buffer,rgba.byteOffset+y*CW*4,CW*4).copy(rows,y*(CW*4+1)+1);}
const hdr=Buffer.alloc(13);hdr.writeUInt32BE(CW,0);hdr.writeUInt32BE(CH,4);hdr[8]=8;hdr[9]=6;hdr[10]=0;hdr[11]=0;hdr[12]=0;
const png=Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  pngChunk('IHDR',hdr),
  pngChunk('IDAT',zlib.deflateSync(rows,{level:6})),
  pngChunk('IEND',Buffer.alloc(0)),
]);
fs.writeFileSync('/home/z/my-project/scripts/hero-anatomy/qa-raster.png',png);
console.log('qa-raster.png written:', CW+'x'+CH, (png.length/1024).toFixed(0)+'KB');
