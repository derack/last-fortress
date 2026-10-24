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

export { rotatePoint, rotateDir };
// ============================================================
// آناتومی آرمان — فرمانده تاکتیکی (قهرمان Legendary)
// پالت Art Bible: فولاد آبی‌خاکستری #5d6b7a · طلایی آذر #d7ad61
//   لاجورد #2e5f8a · کریستال آذرخش #93c5fd (emissive)
//   چرم #7a5a3a · پوست #d9a06f
// نسبت قهرمانی ~۷ سر · قد کل ~1.87 · ایستا قهرمانی (A-pose ۶°)
// ============================================================
const ARM = { armor:'armor', edge:'edge', cloth:'cloth', glow:'glow', dark:'dark', gold:'gold', leather:'leather', skin:'skin', beard:'beard' };

function buildArmanPieces() {
  const P=[];
  const box=(c,s,j,m,r=[0,0,0])=>P.push({kind:'box',c,s,j,m,r});
  const ell=(c,s,j,m,r=[0,0,0])=>P.push({kind:'ellipsoid',c,s,j,m,r});
  const cone=(c,s,j,m,r=[0,0,0])=>P.push({kind:'cone',c,s,j,m,r});
  const taper=(j,m,o)=>P.push({kind:'taper',j,m,...o});

  for(const side of [-1,1]) {
    const s=side, x=0.112*s;
    const LEG=side<0?'Leg_L':'Leg_R', KNEE=side<0?'Knee_L':'Knee_R', FOOT=side<0?'Foot_L':'Foot_R';
    const ARMJ=side<0?'Arm_L':'Arm_R', FORE=side<0?'ForeArm_L':'ForeArm_R', HAND=side<0?'Hand_L':'Hand_R';

    // ---------- پا: ران عضلانی + زره ران ----------
    taper(LEG,ARM.armor,{y0:0.94,y1:0.52,r0:0.098,r1:0.070,x, z:0.004});                 // ران اصلی
    ell([x,0.80,0.042],[0.066,0.13,0.056],LEG,ARM.armor);                                 // چهارسر ران
    ell([x,0.72,-0.045],[0.054,0.105,0.046],LEG,ARM.armor);                               // پشت ران
    taper(LEG,ARM.leather,{y0:0.90,y1:0.80,r0:0.104,r1:0.096,x, z:0.004});                // بند چرمی ران
    taper(LEG,ARM.gold,{y0:0.80,y1:0.775,r0:0.097,r1:0.095,x, z:0.004});                  // طوقه طلایی
    // ---------- زانو ----------
    ell([x,0.505,0.022],[0.068,0.066,0.064],KNEE,ARM.edge);                               // کاسه زانو فولادی
    box([x+0.058*s,0.51,0.0],[0.048,0.095,0.08],KNEE,ARM.armor,[0,0,s*0.35]);             // بال زانوبند
    // ---------- ساق: عضله ساق + ساغر ----------
    taper(KNEE,ARM.armor,{y0:0.49,y1:0.10,r0:0.058,r1:0.038,x, z:0.0});                   // درشت‌نی
    ell([x,0.335,-0.038],[0.05,0.105,0.052],KNEE,ARM.armor);                              // عضله دوقلوی ساق
    taper(KNEE,ARM.armor,{y0:0.47,y1:0.13,r0:0.067,r1:0.046,x,z:0.014,cap0:true});        // ساغر جلویی
    taper(KNEE,ARM.gold,{y0:0.475,y1:0.455,r0:0.068,r1:0.067,x,z:0.012});                 // لبه طلایی ساغر
    taper(FOOT,ARM.dark,{y0:0.115,y1:0.16,r0:0.045,r1:0.054,x, z:0.005});                 // قُنابوت (مچ بوت)
    // ---------- پوتین ----------
    box([x,0.052,0.045],[0.116,0.088,0.25],FOOT,ARM.dark);                                // بدنه پوتین
    ell([x,0.05,0.16],[0.059,0.048,0.064],FOOT,ARM.dark);                                 // پنجه گرد
    box([x,0.098,0.02],[0.123,0.03,0.21],FOOT,ARM.edge);                                  // لبه بالای پوتین
    box([x+0.022*s,0.075,0.13],[0.03,0.035,0.05],FOOT,ARM.gold);                          // سگک طلایی
    ell([x,0.03,0.045],[0.06,0.03,0.12],FOOT,ARM.dark);                                   // کف لاستیکی

    // ---------- شانه: دلتوئید + پولدرن سه‌لایه ----------
    ell([0.10*s,1.545,0],[0.095,0.05,0.085],ARMJ==='Arm_L'?'Chest':'Chest',ARM.armor);    // شیب کول
    ell([0.245*s,1.478,0.012],[0.085,0.088,0.088],ARMJ,ARM.armor);                        // دلتوئید عضلانی
    taper(ARMJ,ARM.armor,{y0:1.53,y1:1.44,r0:0.115,r1:0.098,x:0.262*s,z:0.012,r:[0,0,s*0.14]}); // پولدرن لایه۱
    taper(ARMJ,ARM.gold,{y0:1.445,y1:1.43,r0:0.104,r1:0.1,x:0.262*s,z:0.012,r:[0,0,s*0.1]});    // طوقه طلایی
    taper(ARMJ,ARM.armor,{y0:1.435,y1:1.355,r0:0.102,r1:0.088,x:0.27*s,z:0.012,r:[0,0,s*0.09]});// پولدرن لایه۲
    taper(ARMJ,ARM.edge,{y0:1.36,y1:1.29,r0:0.09,r1:0.078,x:0.278*s,z:0.01,r:[0,0,s*0.05]});    // پولدرن لایه۳ فولاد روشن
    for(let i=0;i<3;i++) ell([0.335*s,1.47-i*0.075,0.02],[0.016,0.016,0.013],ARMJ,ARM.gold);    // پرچ‌های طلایی
    // ---------- بازو ----------
    taper(ARMJ,ARM.armor,{y0:1.42,y1:1.185,r0:0.061,r1:0.047,x:0.268*s,z:0.012});         // بازو
    ell([0.273*s,1.335,0.018],[0.05,0.072,0.048],ARMJ,ARM.armor);                         // دوسر
    ell([0.275*s,1.24,-0.028],[0.042,0.06,0.036],ARMJ,ARM.armor);                         // سه‌سر
    ell([0.292*s,1.172,0.012],[0.05,0.048,0.05],FORE,ARM.edge);                           // آرنج فولادی
    // ---------- ساعد + براسر ----------
    taper(FORE,ARM.armor,{y0:1.155,y1:0.925,r0:0.052,r1:0.042,x:0.288*s,z:0.014});        // ساعد
    taper(FORE,ARM.armor,{y0:1.10,y1:0.935,r0:0.063,r1:0.05,x:0.288*s,z:0.016});          // براسر
    taper(FORE,ARM.gold,{y0:1.105,y1:1.085,r0:0.064,r1:0.063,x:0.288*s,z:0.016});         // لبه طلایی براسر
    taper(FORE,ARM.dark,{y0:0.935,y1:0.895,r0:0.046,r1:0.048,x:0.29*s,z:0.016});          // مچ‌بند آهنی
    // ---------- دست ----------
    box([0.295*s,0.845,0.02],[0.068,0.095,0.085],HAND,ARM.leather);                       // کف دست چرمی
    box([0.295*s,0.875,0.055],[0.07,0.055,0.045],HAND,ARM.edge);                          // صفحه پشت‌دست
    ell([0.295*s+0.045*s,0.83,0.05],[0.018,0.028,0.02],HAND,ARM.leather);                 // شست
    ell([0.295*s,0.9,0.02],[0.026,0.02,0.02],HAND,ARM.gold);                              // مهره مچ دست
  }

  // ---------- لگن و دامن‌زره (فولد) ----------
  ell([0,1.0,0],[0.165,0.125,0.112],'Hips',ARM.cloth);                                    // لگن پارچه‌ای
  ell([0,0.915,0.01],[0.085,0.078,0.075],'Hips',ARM.cloth);                                 // پرکنندهٔ پرینه (بدون حفره)
  ell([0,0.885,0.045],[0.058,0.07,0.05],'Hips',ARM.edge);                                 // پرچ‌پناه (شکم‌بند فولادی)
  for(let i=0;i<6;i++) {
    const a=(i/6)*Math.PI*2+0.26, px=Math.sin(a)*0.15, pz=Math.cos(a)*0.14;
    if(Math.abs(px)<0.02 && pz>0) continue;
    box([px,0.945,pz],[0.068,0.15,0.026],'Hips',i%2?ARM.armor:ARM.dark,[0,Math.PI-a,0.03]); // فولد شش‌پاره
  }
  box([-0.16,0.94,0.03],[0.085,0.145,0.032],'Hips',ARM.armor,[0,0,-0.14]);                // تاسِت چپ
  box([0.16,0.94,0.03],[0.085,0.145,0.032],'Hips',ARM.armor,[0,0,0.14]);                  // تاسِت راست
  box([-0.163,1.012,0.035],[0.06,0.028,0.02],'Hips',ARM.gold);                            // نوار طلایی تاسِت
  box([0.163,1.012,0.035],[0.06,0.028,0.02],'Hips',ARM.gold);

  // ---------- تنه: کمر → سینه ----------
  taper('Spine',ARM.cloth,{y0:0.99,y1:1.24,r0:0.148,r1:0.152,z:0.006});                   // شکم پارچه‌ای
  ell([0,1.205,0.028],[0.128,0.11,0.10],'Spine',ARM.cloth);                               // عضله شکم زیر زره
  ell([0,1.43,0.008],[0.185,0.155,0.122],'Chest',ARM.armor);                              // قفسه سینه
  ell([0.082,1.442,0.088],[0.082,0.06,0.052],'Chest',ARM.armor);                          // پکتورال چپ
  ell([-0.082,1.442,0.088],[0.082,0.06,0.052],'Chest',ARM.armor);                         // پکتورال راست
  taper('Chest',ARM.armor,{y0:1.285,y1:1.50,r0:0.185,r1:0.158,z:0.004});                  // زره‌تنه اصلی
  box([0,1.42,0.128],[0.022,0.165,0.014],'Chest',ARM.gold);                               // ترنج مرکزی سینه
  box([0,1.445,0.135],[0.10,0.10,0.02],'Chest',ARM.gold,[0,0.785,0]);                     // لوزی طلایی
  ell([0,1.445,0.142],[0.028,0.028,0.012],'Chest',ARM.glow);                              // کریستال آذرخش لوزی
  box([0,1.325,0.117],[0.185,0.042,0.022],'Chest',ARM.edge);                              // صفحه شکمی زیر لوزی
  box([0,1.255,0.108],[0.165,0.04,0.02],'Spine',ARM.edge);                                // صفحه شکمی دوم
  ell([0,1.43,-0.062],[0.172,0.148,0.098],'Chest',ARM.armor);                             // پشت‌زره
  ell([0,1.44,-0.152],[0.052,0.052,0.045],'Chest',ARM.glow);                              // کریستال پشت (چشم آذرخش)
  taper('Chest',ARM.gold,{y0:1.545,y1:1.565,r0:0.092,r1:0.088,z:0.002});                  // طوقه گردن طلایی
  // بند مورب چرمی سینه → کمر
  box([0.13,1.335,0.095],[0.032,0.42,0.018],'Chest',ARM.leather,[0,0,0.62]);
  box([-0.12,1.36,0.1],[0.03,0.36,0.016],'Chest',ARM.leather,[0,0,-0.58]);
  // کمربند + ساش لاجوردی + قفل مُهر
  taper('Spine',ARM.leather,{y0:1.105,y1:1.16,r0:0.158,r1:0.156,z:0.004});                // کمربند چرمی
  taper('Spine',ARM.cloth,{y0:1.055,y1:1.105,r0:0.157,r1:0.159,z:0.004});                 // ساش لاجوردی
  box([0,1.132,0.152],[0.095,0.085,0.038],'Spine',ARM.gold);                              // قفل مُهر آذر
  ell([0,1.132,0.172],[0.026,0.026,0.012],'Spine',ARM.glow);                              // کریستال قفل
  box([0.085,0.975,0.125],[0.06,0.26,0.016],'Spine',ARM.cloth,[0,0,0.1]);                 // دنباله ساش
  box([0.13,1.02,0.11],[0.07,0.09,0.038],'Spine',ARM.leather,[0,0.3,0]);                  // کوله چرمی کمر

  // ---------- شنل لاجوردی — فن قوی‌تر + حاشیه A-form ----------
  for(let i=0;i<7;i++) {
    const t=(i-3)/3, px=t*0.19, yaw=t*0.75, pz=-0.175-Math.cos(t*1.2)*0.055;
    box([px,1.34,pz],[0.055,0.38,0.016],'Chest',ARM.cloth,[-0.085-t*0.02,yaw,0]);          // شنل بالا (۷ تکه)
    box([px,1.54,pz+0.012],[0.055,0.022,0.019],'Chest',ARM.gold,[-0.085-t*0.02,yaw,0]);    // پرچ طلایی یقه
    box([px*1.12,0.885,pz-0.038],[0.05,0.35,0.013],'Spine',ARM.cloth,[-0.055,yaw*0.85,0]); // شنل پایین (پهن‌تر)
    box([px*1.12,0.712,pz-0.043],[0.05,0.018,0.015],'Spine',ARM.gold,[-0.055,yaw*0.85,0]); // حاشیه طلایی
  }
  // اتصال شنل (دو سنجاق شانه)
  ell([-0.17,1.53,-0.10],[0.03,0.03,0.02],'Chest',ARM.gold);
  ell([0.17,1.53,-0.10],[0.03,0.03,0.02],'Chest',ARM.gold);

  // ---------- گردن و سر ----------
  taper('Neck',ARM.skin,{y0:1.52,y1:1.645,r0:0.052,r1:0.056,z:0.008});                    // گردن
  ell([0,1.742,0.004],[0.103,0.114,0.112],'Head',ARM.skin);                               // جمجمه
  ell([0,1.662,0.036],[0.068,0.054,0.074],'Head',ARM.skin);                               // فک
  ell([0,1.652,0.058],[0.066,0.06,0.054],'Head',ARM.beard);                               // ریش
  box([0,1.608,0.07],[0.05,0.024,0.045],'Head',ARM.beard);                                // سبیل
  ell([-0.062,1.705,0.072],[0.028,0.032,0.026],'Head',ARM.skin);                          // گونه چپ
  ell([0.062,1.705,0.072],[0.028,0.032,0.026],'Head',ARM.skin);                           // گونه راست
  box([0,1.775,0.098],[0.13,0.024,0.032],'Head',ARM.skin);                                // برجسته ابرو
  box([0,1.735,0.112],[0.026,0.052,0.036],'Head',ARM.skin);                               // بینی
  ell([-0.045,1.755,0.096],[0.022,0.024,0.013],'Head',ARM.glow);                          // چشم درخشان چپ
  ell([0.045,1.755,0.096],[0.022,0.024,0.013],'Head',ARM.glow);                           // چشم درخشان راست
  ell([0,1.725,-0.062],[0.092,0.085,0.055],'Head',ARM.beard);                             // موی پشت سر
  // خودکلاه آرمانی (تاج فولادی + لپ‌پوش + تاج‌پَر)
  ell([0,1.768,-0.008],[0.114,0.096,0.116],'Head',ARM.armor);                             // گنبد خودکلاه
  taper('Head',ARM.gold,{y0:1.70,y1:1.722,r0:0.117,r1:0.121,z:0.006});                    // لبه طلایی خودکلاه
  box([-0.104,1.69,0.028],[0.02,0.085,0.068],'Head',ARM.armor,[0,0,-0.07]);               // لپ‌پوش چپ
  box([0.104,1.69,0.028],[0.02,0.085,0.068],'Head',ARM.armor,[0,0,0.07]);                 // لپ‌پوش راست
  box([0,1.885,-0.015],[0.02,0.095,0.15],'Head',ARM.gold,[0.12,0,0]);                     // تاج‌پر طلایی
  box([0,1.845,-0.055],[0.024,0.035,0.09],'Head',ARM.gold,[0.12,0,0]);                    // پایه تاج‌پر
  ell([0,1.828,0.098],[0.022,0.022,0.014],'Head',ARM.glow);                               // نگین پیشانی

  return P;
}
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

export { buildArman, MATERIAL_DEFS, MAT_KEYS, matIndex };
export { buildArmanGear, jointIndex, jointNames, boneWorld, boneLocal, boneParents, quat };
export { buildArmanPieces, buildTaper, buildEllipsoid, buildBox, buildCone };
