// ============================================================
// HERO ANATOMY FORGE — Arman (فاز ۱: یک هیرو، کیفیت جدید)
// ------------------------------------------------------------
// قرارداد کامل حفظ می‌شود: نام مفصل‌ها، اسکین سخت، VFX نقاط،
// LOD1/LOD2، کلیپ‌های انیمیشن — اما با:
//  ۱) آناتومی قهرمانی (نسبت ~۷ سر، شانه/سینه/کمر واقعی)
//  ۲) مفصل‌های آناتومیک در جای درست (لگن 0.98، شانه 1.50)
//  ۳) فرم‌های عضلانی smooth-shaded (دلتوئید، پکتورال، ساق، ران)
//  ۴) زره لایه‌لایه + شنل + شمشیر بزرگ + سپر ایجیس
// خروجی: public/assets/3d/rigged/arman.glb (جایگزین کامل)
// ============================================================
import fs from 'node:fs';
import zlib from 'node:zlib';

// ============ ریگ آناتومیک (قرارداد نام‌ها حفظ شده) ============
const jointNames = [
  'Root','Hips','Spine','Chest','Neck','Head',
  'Arm_L','ForeArm_L','Hand_L','Arm_R','ForeArm_R','Hand_R',
  'Leg_L','Knee_L','Foot_L','Leg_R','Knee_R','Foot_R',
  'Tail','Wing_L','WingTip_L','Wing_R','WingTip_R','Jaw',
  'SpiderLegL0','SpiderLegR0','SpiderLegL1','SpiderLegR1',
  'SpiderLegL2','SpiderLegR2','SpiderLegL3','SpiderLegR3',
  'TailMid','TailTip'
];
const jointIndex = Object.fromEntries(jointNames.map((n,i)=>[n,i]));
const boneParents = [
  -1,0,1,2,3,4, 3,6,7,3,9,10, 1,12,13,1,15,16, 1,3,19,3,21,5,
  1,1,1,1,1,1,1,1,18,32
];
// آناتومی آرمان: لگن 0.98 / کمر 1.17 / سینه 1.42 / شانه 1.50 / سر 1.74
// زانو 0.50 / مچ‌پا 0.09 — آرنج 1.17 / مچ‌دست 0.90
const boneLocal = [
  [0,0,0],[0,0.98,0],[0,0.19,0],[0,0.25,0],[0,0.13,0],[0,0.19,0],
  [-0.26,0.08,0.01],[-0.035,-0.33,0],[-0.005,-0.27,0.01],
  [0.26,0.08,0.01],[0.035,-0.33,0],[0.005,-0.27,0.01],
  [-0.10,-0.04,0],[0,-0.44,0],[0,-0.41,0.05],
  [0.10,-0.04,0],[0,-0.44,0],[0,-0.41,0.05],
  [0,-0.12,-0.25],[-0.31,0.28,-0.08],[-0.34,0,-0.12],
  [0.31,0.28,-0.08],[0.34,0,-0.12],[0,-0.14,0.12],
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

function quat(axis, angle) {
  const h=angle/2, s=Math.sin(h), c=Math.cos(h);
  return axis==='x'?[s,0,0,c]:axis==='y'?[0,s,0,c]:[0,0,s,c];
}
function clampColor(c){return [((c>>16)&255)/255,((c>>8)&255)/255,(c&255)/255,1];}

// ============ پریمیتیوهای آناتومیک ============
// taper: لاته عمودی با نرمال smooth (ران/ساق/بازو) — ellipsoid: عضله/مفصل
function rotatePoint(p, rot, c) {
  let [x,y,z]=p; const [rx,ry,rz]=rot;
  let yy=y*Math.cos(rx)-z*Math.sin(rx), zz=y*Math.sin(rx)+z*Math.cos(rx); y=yy;z=zz;
  let xx=x*Math.cos(ry)+z*Math.sin(ry); zz=-x*Math.sin(ry)+z*Math.cos(ry); x=xx;z=zz;
  xx=x*Math.cos(rz)-y*Math.sin(rz); yy=x*Math.sin(rz)+y*Math.cos(rz); x=xx;y=yy;
  return [x+c[0],y+c[1],z+c[2]];
}
function rotateDir(p, rot) {
  let [x,y,z]=p; const [rx,ry,rz]=rot;
  let yy=y*Math.cos(rx)-z*Math.sin(rx), zz=y*Math.sin(rx)+z*Math.cos(rx); y=yy;z=zz;
  let xx=x*Math.cos(ry)+z*Math.sin(ry); zz=-x*Math.sin(ry)+z*Math.cos(ry); x=xx;z=zz;
  xx=x*Math.cos(rz)-y*Math.sin(rz); yy=x*Math.sin(rz)+y*Math.cos(rz); x=xx;y=yy;
  const l=Math.hypot(x,y,z)||1; return [x/l,y/l,z/l];
}

function buildTaper(piece, lod) {
  const seg=[20,15,11][lod]??20;
  const {y0,y1,r0,r1,x=0,z=0,sx=1,sz=1,r=[0,0,0]}=piece;
  const h=y1-y0, slope=(r1-r0)/Math.max(h,1e-5);
  const pos=[],norm=[],uv=[],indices=[];
  const ring=(rr,y,ri)=>{ // ri: 0=bottom ring start, 1=top ring start
    const base=pos.length/3;
    for(let i=0;i<=seg;i++){
      const th=i/seg*Math.PI*2;
      const p=rotatePoint([Math.cos(th)*rr*sx, y, Math.sin(th)*rr*sz], r, [x,0,z]);
      // نرمال بیضی مقطع + شیب پروفیل
      let n=[Math.cos(th)/sx, -slope, Math.sin(th)/sz];
      const l=Math.hypot(...n)||1; n=[n[0]/l,n[1]/l,n[2]/l];
      const nr=rotateDir(n,r);
      pos.push(...p); norm.push(...nr); uv.push(th/(Math.PI*2)*0.72, (y-y0)/Math.max(h,1e-5)*0.72);
    }
    return base;
  };
  const b0=ring(r0,y0,0), t0=ring(r1,y1,1);
  for(let i=0;i<seg;i++){
    const a=b0+i,b=b0+i+1,c=t0+i+1,d=t0+i;
    indices.push(a,d,b,b,d,c);
  }
  // درپوش‌ها (صفحات زره بسته می‌شوند)
  if(piece.cap0!==false){
    const ci=pos.length/3; pos.push(...rotatePoint([x,y0,z],r,[0,0,0])); norm.push(...rotateDir([0,-1,0],r)); uv.push(0.36,0.36);
    for(let i=0;i<seg;i++){ indices.push(ci,b0+i+1,b0+i); }
  }
  if(piece.cap1!==false){
    const ci=pos.length/3; pos.push(...rotatePoint([x,y1,z],r,[0,0,0])); norm.push(...rotateDir([0,1,0],r)); uv.push(0.36,0.64);
    for(let i=0;i<seg;i++){ indices.push(ci,t0+i,t0+i+1); }
  }
  return {pos,norm,uv,indices};
}

function buildEllipsoid(piece, lod) {
  const lat=[18,14,10][lod]??18, lon=[26,20,14][lod]??26;
  const [cx,cy,cz]=piece.c, [sx,sy,sz]=piece.s, rot=piece.r||[0,0,0];
  const pos=[],norm=[],uv=[],indices=[],points=[];
  for(let y=0;y<=lat;y++) for(let x=0;x<=lon;x++) {
    const phi=y/lat*Math.PI, th=x/lon*Math.PI*2;
    const local=[Math.sin(phi)*Math.cos(th)*sx, Math.cos(phi)*sy, Math.sin(phi)*Math.sin(th)*sz];
    const world=rotatePoint(local,rot,[cx,cy,cz]);
    const normal=rotateDir([Math.sin(phi)*Math.cos(th)/Math.max(sx,1e-5), Math.cos(phi)/Math.max(sy,1e-5), Math.sin(phi)*Math.sin(th)/Math.max(sz,1e-5)],rot);
    pos.push(...world); norm.push(...normal);
    uv.push(th/(Math.PI*2)*0.72, phi/Math.PI*0.72);
    points.push(pos.length/3-1);
  }
  for(let y=0;y<lat;y++) for(let x=0;x<lon;x++) {
    const a=points[y*(lon+1)+x],b=points[(y+1)*(lon+1)+x],c=points[(y+1)*(lon+1)+x+1],d=points[y*(lon+1)+x+1];
    indices.push(a,b,d,b,c,d);
  }
  return {pos,norm,uv,indices};
}

function buildBox(piece, lod) {
  const [cx,cy,cz]=piece.c, [sx,sy,sz]=piece.s, rot=piece.r||[0,0,0];
  const pos=[],norm=[],uv=[],indices=[];
  const pushTri=(a,b,c)=>{
    const ab=b.map((v,i)=>v-a[i]), ac=c.map((v,i)=>v-a[i]);
    let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const l=Math.hypot(...n)||1; n=n.map(v=>v/l);
    const ax=Math.abs(n[0]), ay=Math.abs(n[1]), az=Math.abs(n[2]);
    const project=(p)=> ay>=ax&&ay>=az ? [p[0],p[2]] : ax>=az ? [p[2],p[1]] : [p[0],p[1]];
    const base=pos.length/3;
    for(const p of [a,b,c]) {const t=project(p);pos.push(...p);norm.push(...n);uv.push(t[0]*0.72,t[1]*0.72);}
    indices.push(base,base+1,base+2);
  };
  const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]].map(p=>rotatePoint([p[0]*sx,p[1]*sy,p[2]*sz],rot,[cx,cy,cz]));
  const faces=[[0,2,1,0,3,2],[4,5,6,4,6,7],[0,1,5,0,5,4],[3,7,6,3,6,2],[0,4,7,0,7,3],[1,2,6,1,6,5]];
  for(const f of faces) for(let i=0;i<6;i+=3) pushTri(v[f[i]],v[f[i+1]],v[f[i+2]]);
  return {pos,norm,uv,indices};
}

function buildCone(piece, lod) {
  const seg=[16,12,9][lod]??16;
  const [cx,cy,cz]=piece.c, [sx,sy,sz]=piece.s, rot=piece.r||[0,0,0];
  const h=sy, slope=sx/Math.max(h,1e-5);
  const pos=[],norm=[],uv=[],indices=[];
  const base=pos.length/3, apex=pos.length/3+1;
  for(let i=0;i<=seg;i++){
    const th=i/seg*Math.PI*2;
    const p=rotatePoint([Math.cos(th)*sx, -h/2, Math.sin(th)*sz], rot, [cx,cy,cz]);
    let n=[Math.cos(th)/sx, -slope*1.6, Math.sin(th)/sz];
    const l=Math.hypot(...n)||1; n=[n[0]/l,n[1]/l,n[2]/l];
    pos.push(...p); norm.push(...rotateDir(n,rot)); uv.push(th/(Math.PI*2)*0.72,0.2);
  }
  pos.push(...rotatePoint([0,h/2,0],rot,[cx,cy,cz])); norm.push(...rotateDir([0,1,0],rot)); uv.push(0.5,0.85);
  for(let i=0;i<seg;i++) indices.push(base,base+i,base+i+1);
  const ci=pos.length/3;
  pos.push(...rotatePoint([0,-h/2,0],rot,[cx,cy,cz])); norm.push(...rotateDir([0,-1,0],rot)); uv.push(0.5,0.1);
  for(let i=0;i<seg;i++) indices.push(ci,base+i+1,base+i);
  return {pos,norm,uv,indices};
}
