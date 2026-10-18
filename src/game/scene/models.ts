import * as THREE from 'three';
import { TOWERS } from '../data/towers';
import type { EnemyData } from '../data/types';
import { finishEnemyModel, finishHeroModel } from './character-finish';

// ============================================================
// سازنده مدل‌های سه‌بعدی سبک «واقع‌گرایی سبک‌پردازی‌شده»
// برج: پایه فلزی مدرن + هسته کریستالی جادویی (تضاد اصلی بازی)
// هر مدل: Group با userData برای انیمیشن
// ============================================================

const mat = (color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.3, ...opts });

const glow = (color: number) =>
  new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.0,
    roughness: 0.24,
    metalness: 0.15,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
  });

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  me.receiveShadow = false;
  return me;
}

// ---------------------------- برج‌ها ----------------------------

export function buildTowerMesh(towerId: string, level: number): THREE.Group {
  const data = TOWERS[towerId];
  const g = new THREE.Group();
  const lv = level - 1;
  const accent = data.color;

  // Shared machined foundation: broader footing, cleaner silhouette and layered metal collars.
  const baseH = 0.9 + lv * 0.12;
  const footing = mesh(new THREE.CylinderGeometry(1.78, 1.88, 0.18, 12, 1), mat(0x252b33, { metalness: 0.62, roughness: 0.48 }), 0, 0.09, 0);
  g.add(footing);
  const base = mesh(new THREE.CylinderGeometry(1.48, 1.72, baseH, 12, 1), mat(0x414955, { metalness: 0.72, roughness: 0.36 }), 0, baseH / 2 + 0.12, 0);
  g.add(base);
  const trim = mesh(new THREE.CylinderGeometry(1.57, 1.57, 0.13, 16, 1), mat(0x7b8490, { metalness: 0.82, roughness: 0.28 }), 0, baseH + 0.185, 0);
  g.add(trim);
  const lowerCollar = mesh(new THREE.TorusGeometry(1.64, 0.055, 6, 24), mat(0x303741, { metalness: 0.78, roughness: 0.34 }), 0, 0.22, 0);
  lowerCollar.rotation.x = Math.PI / 2;
  g.add(lowerCollar);

  if (towerId === 'sentinel') {
    // نگهبان — برجک توپ مسلسل
    const towerH = 1.2 + lv * 0.25;
    g.add(mesh(new THREE.BoxGeometry(1.6, towerH, 1.6), mat(0x3d4450), 0, baseH + towerH / 2, 0));
    const head = new THREE.Group();
    head.position.y = baseH + towerH + 0.3;
    head.add(mesh(new THREE.SphereGeometry(0.75, 12, 10), mat(0x565f6e), 0, 0, 0));
    const barrel = mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.7, 8), mat(0x22262e, { metalness: 0.85 }), 0, 0, 0.9);
    barrel.rotation.x = Math.PI / 2;
    head.add(barrel);
    if (lv >= 2) {
      const b2 = barrel.clone();
      b2.position.x = 0.3;
      const b3 = barrel.clone();
      b3.position.x = -0.3;
      head.add(b2, b3);
    }
    // نشانگر دهانه لوله — نقطه واقعی شلیک (سر جلویی توپ)
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 1.75);
    head.add(muzzle);
    // نوار نور نظامی
    head.add(mesh(new THREE.SphereGeometry(0.16, 8, 8), glow(accent), 0.55, 0.4, 0));
    if (level >= 3) {
      g.add(mesh(new THREE.BoxGeometry(1.9, 0.5, 1.9), mat(0x2f3540, { metalness: 0.8 }), 0, baseH + 0.2, 0)); // زره
      head.add(mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), mat(0x2f3540), 0, 0.55, -0.3));
    }
    if (level >= 5) {
      // Transformation — هسته کریستالی
      const cr = mesh(new THREE.OctahedronGeometry(0.42), glow(accent), 0, 1.35, 0);
      head.add(cr);
      head.userData.spinCrystal = cr;
      g.add(mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 24), glow(accent), 0, baseH + towerH - 0.1, 0));
    }
    g.add(head); // برجک باید به گروه برج اضافه شود — قبلاً یتیم بود و رندر نمی‌شد!
    g.userData.turret = head;
    g.userData.muzzle = muzzle;
  } else if (towerId === 'lightning') {
    // صاعقه — ستون کریستالی بنفش
    const h = 2.2 + lv * 0.35;
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.95, h, 6), mat(0x2b2838), 0, baseH + h / 2, 0));
    const core = mesh(new THREE.OctahedronGeometry(0.7 + lv * 0.09), glow(accent), 0, baseH + h + 0.55, 0);
    g.add(core);
    g.userData.spinCrystal = core;
    // کره‌های رسانا
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      g.add(mesh(new THREE.SphereGeometry(0.16, 8, 8), glow(accent), dx * 0.95, baseH + h * 0.7, dz * 0.95));
    }
    if (level >= 3) {
      g.add(mesh(new THREE.TorusGeometry(1.15, 0.05, 6, 24), glow(accent), 0, baseH + h * 0.35, 0));
    }
    if (level >= 5) {
      const ring = mesh(new THREE.TorusGeometry(1.4, 0.07, 8, 32), glow(accent), 0, baseH + h + 0.55, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData.spinRing = ring;
      for (let i = 0; i < 3; i++) {
        const shard = mesh(new THREE.OctahedronGeometry(0.22), glow(accent),
          Math.cos((i / 3) * Math.PI * 2) * 1.2, baseH + h + 1.2, Math.sin((i / 3) * Math.PI * 2) * 1.2);
        g.add(shard);
      }
    }
  } else if (towerId === 'fire') {
    // آتش — خمپاره آتشین
    const stoneH = 1.1 + lv * 0.15;
    g.add(mesh(new THREE.CylinderGeometry(1.15, 1.5, stoneH, 8), mat(0x4d3f36), 0, stoneH / 2, 0));
    const mortar = new THREE.Group();
    mortar.position.y = stoneH + 0.55;
    const tube = mesh(new THREE.CylinderGeometry(0.5 - lv * 0.03, 0.62, 1.5, 10), mat(0x33302e, { metalness: 0.6 }), 0, 0.35, 0);
    // دهانه لوله رو به دشمن — برجک با atan2(dx,dz) محور +Z را به سمت هدف می‌چرخاند
    tube.rotation.x = 0.6;
    mortar.add(tube);
    const ember = mesh(new THREE.SphereGeometry(0.3 - lv * 0.02, 8, 8), glow(0xf97316), 0, 0.95, 0.42);
    mortar.add(ember);
    // نشانگر دهانه — سر جلویی لوله خمپاره (نقطه واقعی شلیک)
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.35 + 0.75 * Math.cos(0.6), 0.75 * Math.sin(0.6));
    mortar.add(muzzle);
    g.add(mortar);
    g.userData.turret = mortar;
    g.userData.ember = ember;
    g.userData.muzzle = muzzle;
    // مشعل‌های اطراف
    for (const [dx, dz] of [[1.1, 0.6], [-1.1, -0.6]] as const) {
      g.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6), mat(0x2a2521), dx, stoneH + 0.3, dz));
      g.add(mesh(new THREE.SphereGeometry(0.14, 8, 8), glow(0xfbbf24), dx, stoneH + 0.75, dz));
    }
    if (level >= 5) {
      g.add(mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 24), glow(0xf97316), 0, 0.3, 0));
      g.userData.spinRing = g.children[g.children.length - 1];
    }
  } else if (towerId === 'cannon') {
    // توپخانه — توپ سنگین فلزی
    const h = 1.0 + lv * 0.15;
    g.add(mesh(new THREE.CylinderGeometry(1.25, 1.6, h, 8), mat(0x3a3f45, { metalness: 0.7, roughness: 0.45 }), 0, h / 2, 0));
    const turret = new THREE.Group();
    turret.position.y = h + 0.5;
    const barrel = mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.7, 10), mat(0x22262c, { metalness: 0.85 }), 0, 0.18, 0.55);
    barrel.rotation.x = Math.PI / 2 - 0.18;
    turret.add(barrel);
    turret.add(mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(0x4a5058, { metalness: 0.75 }), 0, 0.1, -0.25));
    turret.add(mesh(new THREE.SphereGeometry(0.12, 8, 8), glow(accent), 0, 0.5, -0.5));
    g.add(turret);
    g.userData.turret = turret;
    // نشانگر دهانه — سر جلویی توپ سنگین
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.18 + 0.85 * Math.sin(0.18), 0.55 + 0.85 * Math.cos(0.18));
    turret.add(muzzle);
    g.userData.muzzle = muzzle;
    if (level >= 3) {
      for (const sx of [0.85, -0.85]) g.add(mesh(new THREE.BoxGeometry(0.35, h + 0.5, 0.5), mat(0x2c3036, { metalness: 0.7 }), sx, (h + 0.5) / 2, 0));
    }
    if (level >= 5) {
      const ring = mesh(new THREE.TorusGeometry(1.35, 0.07, 8, 26), glow(accent), 0, 0.25, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData.spinRing = ring;
      turret.add(mesh(new THREE.OctahedronGeometry(0.3), glow(accent), 0, 0.75, -0.3));
    }
  } else if (towerId === 'poison') {
    // زهرخانه — دیگ و لوله‌های سبز
    const h = 0.9 + lv * 0.12;
    g.add(mesh(new THREE.CylinderGeometry(1.1, 1.4, h, 8), mat(0x37402c, { roughness: 0.8 }), 0, h / 2, 0));
    const cauldron = mesh(new THREE.SphereGeometry(0.75, 12, 10), mat(0x2a3324, { metalness: 0.5, roughness: 0.5 }), 0, h + 0.45, 0);
    cauldron.scale.y = 0.8;
    g.add(cauldron);
    const brew = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 12), glow(accent), 0, h + 0.78, 0);
    g.add(brew);
    g.userData.ember = brew;
    for (const [dx, dz, s] of [[0.7, 0.5, 0.9], [-0.75, -0.3, 0.7], [0.1, -0.8, 0.8]] as const) {
      const pipe = mesh(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 1.1 * s, 6), mat(0x4a5a3a, { metalness: 0.6 }), dx, h + 0.9 * s, dz);
      pipe.rotation.z = dx > 0 ? -0.35 : 0.35;
      g.add(pipe);
      g.add(mesh(new THREE.SphereGeometry(0.1 * s, 6, 6), glow(accent), dx * 1.25, h + 1.35 * s, dz * 1.25));
    }
    if (level >= 5) {
      const ring = mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 24), glow(accent), 0, h + 1.5, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData.spinRing = ring;
    }
  } else if (towerId === 'ballista') {
    // بالیستا — پایه چوبی و بازوی کمان فولادی
    const h = 1.2 + lv * 0.2;
    g.add(mesh(new THREE.BoxGeometry(1.3, h, 1.3), mat(0x5a4632, { roughness: 0.85 }), 0, h / 2, 0));
    const mount = new THREE.Group();
    mount.position.y = h + 0.45;
    const rail = mesh(new THREE.BoxGeometry(0.3, 0.22, 2.1), mat(0x4a3a28), 0, 0, 0.25);
    mount.add(rail);
    for (const sx of [0.5, -0.5]) {
      const limb = mesh(new THREE.BoxGeometry(0.1, 0.1, 1.5), mat(0x8a8f98, { metalness: 0.85 }), sx * 1.35, 0.28, 0.75);
      limb.rotation.y = sx * 0.5;
      mount.add(limb);
    }
    mount.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), mat(0x2a2622), 0, 0.28, 0.8));
    g.add(mount);
    g.userData.turret = mount;
    // نشانگر دهانه — نوک پیکان روی ریل (سمت +Z رو به دشمن)
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.28, 1.15);
    mount.add(muzzle);
    g.userData.muzzle = muzzle;
    if (level >= 3) {
      mount.add(mesh(new THREE.BoxGeometry(1.9, 0.16, 0.16), mat(0x6b7280, { metalness: 0.8 }), 0, 0.45, 0.9));
    }
    if (level >= 5) {
      mount.add(mesh(new THREE.OctahedronGeometry(0.26), glow(accent), 0, 0.5, -0.4));
      const ring = mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 24), glow(accent), 0, 0.3, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData.spinRing = ring;
    }
  } else if (towerId === 'arcane') {
    // رازآسا — سه ستون مدار و هسته پرایسم
    const h = 1.4 + lv * 0.22;
    g.add(mesh(new THREE.CylinderGeometry(1.05, 1.35, 0.7, 8), mat(0x2c3644, { metalness: 0.6 }), 0, 0.35, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const col = mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 6), mat(0x37455a, { metalness: 0.65 }), Math.cos(a) * 0.75, h / 2 + 0.5, Math.sin(a) * 0.75);
      g.add(col);
      g.add(mesh(new THREE.SphereGeometry(0.11, 8, 8), glow(accent), Math.cos(a) * 0.75, h + 0.6, Math.sin(a) * 0.75));
    }
    const core = mesh(new THREE.OctahedronGeometry(0.5 + lv * 0.07), glow(accent), 0, h + 1.05, 0);
    g.add(core);
    g.userData.spinCrystal = core;
    if (level >= 3) {
      const ring = mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 28), glow(accent), 0, h + 1.05, 0);
      ring.rotation.x = Math.PI / 2.8;
      g.add(ring);
      g.userData.spinRing = ring;
    }
    if (level >= 5) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.add(mesh(new THREE.TetrahedronGeometry(0.2), glow(accent), Math.cos(a) * 1.05, h + 1.6, Math.sin(a) * 1.05));
      }
    }
  } else if (towerId === 'temple') {
    // آذرگاه — محراب مقدس با شعله آذر
    const h = 0.8 + lv * 0.12;
    g.add(mesh(new THREE.CylinderGeometry(1.4, 1.7, h, 8), mat(0x8a7a5c, { roughness: 0.8 }), 0, h / 2, 0));
    g.add(mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.35, 8), mat(0xd9c8a0, { roughness: 0.7 }), 0, h + 0.17, 0));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pillar = mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.5 + lv * 0.12, 6), mat(0xe8dcc0, { roughness: 0.65 }), Math.cos(a) * 0.95, h + 0.95, Math.sin(a) * 0.95);
      g.add(pillar);
      g.add(mesh(new THREE.SphereGeometry(0.12, 8, 8), glow(accent), Math.cos(a) * 0.95, h + 1.8, Math.sin(a) * 0.95));
    }
    const flame = mesh(new THREE.ConeGeometry(0.34, 0.9 + lv * 0.1, 7), glow(accent), 0, h + 0.85, 0);
    g.add(flame);
    g.userData.spinCrystal = flame;
    if (level >= 5) {
      const halo = mesh(new THREE.TorusGeometry(1.45, 0.07, 8, 30), glow(0xfcd34d), 0, h + 2.0, 0);
      halo.rotation.x = Math.PI / 2;
      g.add(halo);
      g.userData.spinRing = halo;
    }
  } else if (towerId === 'void') {
    // برج تهی — منولیت سیاه با چشم تهی
    const h = 2.4 + lv * 0.35;
    g.add(mesh(new THREE.CylinderGeometry(0.95, 1.3, 0.6, 6), mat(0x1a1622, { roughness: 0.7 }), 0, 0.3, 0));
    const mono = mesh(new THREE.BoxGeometry(1.05, h, 0.75), mat(0x14101c, { roughness: 0.45, metalness: 0.3 }), 0, h / 2 + 0.5, 0);
    mono.rotation.y = Math.PI / 6;
    g.add(mono);
    const eye = mesh(new THREE.SphereGeometry(0.26 + lv * 0.03, 10, 10), glow(accent), 0, h * 0.72 + 0.5, 0.42);
    g.add(eye);
    g.userData.spinCrystal = eye;
    g.add(mesh(new THREE.OctahedronGeometry(0.32), glow(accent), 0, h + 0.85, 0));
    if (level >= 3) {
      for (const sx of [0.55, -0.55]) {
        const shard = mesh(new THREE.ConeGeometry(0.14, 0.9, 5), mat(0x1a1622), sx, h * 0.45 + 0.5, 0);
        shard.rotation.z = sx > 0 ? -0.3 : 0.3;
        g.add(shard);
      }
    }
    if (level >= 5) {
      const ring = mesh(new THREE.TorusGeometry(1.15, 0.06, 8, 28), glow(accent), 0, h + 0.85, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData.spinRing = ring;
    }
  } else if (towerId === 'ice') {
    // یخ — خوشه کریستال یخی
    const h = 1.4 + lv * 0.3;
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc, emissive: accent, emissiveIntensity: 0.9,
      roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92,
    });
    g.add(mesh(new THREE.ConeGeometry(0.9, h, 6), mat(0x37505c), 0, baseH + h / 2, 0));
    const main = mesh(new THREE.ConeGeometry(0.55, 1.6 + lv * 0.25, 6), crystalMat, 0, baseH + h + 0.6, 0);
    g.add(main);
    g.userData.spinCrystal = main;
    for (const [dx, dz, s] of [[0.7, 0.3, 0.7], [-0.6, -0.4, 0.85], [0.2, -0.75, 0.6]] as const) {
      g.add(mesh(new THREE.ConeGeometry(0.28 * s, 1.1 * s, 6), crystalMat, dx, baseH + h * 0.75, dz));
    }
    if (level >= 5) {
      // یخ دائمی اطراف برج
      const frost = new THREE.Mesh(
        new THREE.CircleGeometry(3.2, 24),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      frost.rotation.x = -Math.PI / 2;
      frost.position.y = 0.12;
      g.add(frost);
      const ring = mesh(new THREE.TorusGeometry(1.5, 0.06, 8, 28), glow(accent), 0, baseH + h + 1.1, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      g.userData.spinRing = ring;
    }
  }

  // Machined foundation: radial armor fins, fasteners and an energized lower ring.
  const boltMat = mat(0xb4bdc8, { metalness: 0.88, roughness: 0.22 });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const bolt = mesh(new THREE.SphereGeometry(0.075, 8, 6), boltMat, Math.cos(a) * 1.48, 0.19, Math.sin(a) * 1.48);
    bolt.scale.set(1, 0.55, 1);
    g.add(bolt);
    if (i % 2 === 0) {
      const fin = mesh(new THREE.BoxGeometry(0.12, 0.42 + lv * 0.035, 0.24), mat(0x303744, { metalness: 0.72, roughness: 0.36 }), Math.cos(a) * 1.35, 0.45, Math.sin(a) * 1.35);
      fin.rotation.y = -a;
      g.add(fin);
    }
  }
  const foundationGlow = mesh(new THREE.TorusGeometry(1.52, 0.035, 6, 32), glow(accent), 0, 0.22, 0);
  foundationGlow.rotation.x = Math.PI / 2;
  g.add(foundationGlow);

  // Five clearly readable visual tiers: every upgrade changes the silhouette,
  // not just the combat stats. Keep these accents low-cost for mobile GPUs.
  const visualTier = Math.max(1, Math.min(5, Math.floor(level || 1)));
  g.userData.upgradeLevel = visualTier;
  if (visualTier >= 2) {
    const armorMat = mat(0x333b49, { metalness: 0.78, roughness: 0.3 });
    const edgeMat = mat(0x9ca8b8, { metalness: 0.86, roughness: 0.22 });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const plate = mesh(new THREE.BoxGeometry(0.48, 0.58, 0.13), armorMat,
        Math.cos(a) * 1.27, 0.68, Math.sin(a) * 1.27);
      plate.rotation.y = -a;
      g.add(plate);
      const rivet = mesh(new THREE.SphereGeometry(0.045, 7, 6), edgeMat,
        Math.cos(a) * 1.29, 0.82, Math.sin(a) * 1.29);
      g.add(rivet);
    }
  }
  if (visualTier >= 3) {
    const conduitMat = glow(accent);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const conduit = mesh(new THREE.BoxGeometry(0.07, 0.72, 0.08), conduitMat,
        Math.cos(a) * 1.12, 0.83, Math.sin(a) * 1.12);
      conduit.rotation.y = -a;
      g.add(conduit);
    }
    const lowerRing = mesh(new THREE.TorusGeometry(1.68, 0.045, 6, 32), glow(accent), 0, 0.48, 0);
    lowerRing.rotation.x = Math.PI / 2;
    g.add(lowerRing);
    g.userData.upgradeConduitRing = lowerRing;
  }
  if (visualTier >= 4) {
    const shardMat = glow(accent);
    const orbitShards: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const shard = mesh(new THREE.OctahedronGeometry(0.16, 0), shardMat,
        Math.cos(a) * 1.92, baseH + 0.48 + (i % 2) * 0.22, Math.sin(a) * 1.92);
      shard.rotation.set(a * 0.5, a, a * 0.25);
      g.add(shard);
      orbitShards.push(shard);
    }
    g.userData.upgradeShards = orbitShards;
  }
  if (visualTier >= 5) {
    const ascensionRing = mesh(new THREE.TorusGeometry(1.86, 0.055, 8, 40), glow(accent), 0, baseH + 0.6, 0);
    ascensionRing.rotation.x = Math.PI / 2;
    g.add(ascensionRing);
    g.userData.upgradeAscensionRing = ascensionRing;
    const crownMat = mat(0xe4e8f0, { metalness: 0.82, roughness: 0.2 });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const crownSpike = mesh(new THREE.ConeGeometry(0.075, 0.28, 5), crownMat,
        Math.cos(a) * 1.43, baseH + 0.36, Math.sin(a) * 1.43);
      crownSpike.rotation.z = Math.cos(a) * -0.35;
      crownSpike.rotation.x = Math.sin(a) * 0.35;
      g.add(crownSpike);
    }
  }

  g.traverse((o) => {
    o.userData.selectable = true;
  });
  return g;
}

// ---------------------------- دشمنان ----------------------------

export function buildEnemyMesh(data: EnemyData, tier: number): THREE.Group {
  const g = new THREE.Group();
  const s = data.scale * (1 + 0.08 * (tier - 1));
  const body = mat(data.color, { roughness: 0.7 });
  const acc = glow(data.accent);
  const parts: { node: THREE.Object3D; kind: string }[] = [];

  if (data.id === 'shadow') {
    // سایه — موجود شناور تاریک
    const orb = mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.9, transparent: true, opacity: 0.94 }), 0, 1, 0);
    g.add(orb);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const tail = mesh(new THREE.ConeGeometry(0.12, 0.7, 5), body, Math.cos(a) * 0.4, 0.45, Math.sin(a) * 0.4);
      tail.rotation.x = Math.PI;
      g.add(tail);
    }
    g.add(mesh(new THREE.SphereGeometry(0.09, 6, 6), acc, 0.2, 1.12, 0.42));
    g.add(mesh(new THREE.SphereGeometry(0.09, 6, 6), acc, -0.2, 1.12, 0.42));
    parts.push({ node: orb, kind: 'bob' });
  } else if (data.id === 'warrior') {
    // جنگجوی تاریکی
    const torso = mesh(new THREE.BoxGeometry(0.55, 0.7, 0.38), body, 0, 0.95, 0);
    g.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.24, 8, 8), mat(0x2a2733), 0, 1.5, 0);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), acc, 0.1, 1.52, 0.2));
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), acc, -0.1, 1.52, 0.2));
    const legL = mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), body, 0.16, 0.3, 0);
    const legR = mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), body, -0.16, 0.3, 0);
    g.add(legL, legR);
    const sword = mesh(new THREE.BoxGeometry(0.1, 0.75, 0.16), mat(0x8a8f98, { metalness: 0.85 }), 0.45, 0.85, 0.1);
    sword.rotation.z = -0.3;
    g.add(sword);
    parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
  } else if (data.id === 'golem' || data.id === 'golemKing') {
    // غول سنگی / Boss
    const isBoss = data.id === 'golemKing';
    const torso = mesh(new THREE.BoxGeometry(1.15, 1.05, 0.8), body, 0, 1.35, 0);
    g.add(torso);
    const head = mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), body, 0, 2.1, 0);
    g.add(head);
    // ترک‌های نورانی
    const crack = mesh(new THREE.BoxGeometry(0.1, 0.8, 0.06), acc, 0, 1.35, 0.42);
    g.add(crack);
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, 0.13, 2.12, 0.3));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, -0.13, 2.12, 0.3));
    const armL = mesh(new THREE.BoxGeometry(0.42, 1.15, 0.42), body, 0.85, 1.2, 0);
    const armR = mesh(new THREE.BoxGeometry(0.42, 1.15, 0.42), body, -0.85, 1.2, 0);
    g.add(armL, armR);
    const legL = mesh(new THREE.BoxGeometry(0.4, 0.85, 0.45), body, 0.3, 0.42, 0);
    const legR = mesh(new THREE.BoxGeometry(0.4, 0.85, 0.45), body, -0.3, 0.42, 0);
    g.add(legL, legR);
    if (isBoss) {
      // تاج/شاخ Boss + کریستال آذر روی سینه
      const horn1 = mesh(new THREE.ConeGeometry(0.12, 0.5, 5), mat(0x292524), 0.2, 2.5, 0);
      const horn2 = mesh(new THREE.ConeGeometry(0.12, 0.5, 5), mat(0x292524), -0.2, 2.5, 0);
      horn1.rotation.z = 0.4; horn2.rotation.z = -0.4;
      g.add(horn1, horn2);
      g.add(mesh(new THREE.OctahedronGeometry(0.22), acc, 0, 1.45, 0.44));
    }
    parts.push({ node: armL, kind: 'arm' }, { node: armR, kind: 'arm2' }, { node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
  } else if (data.id === 'spider') {
    // عنکبوت سایه
    const abd = mesh(new THREE.SphereGeometry(0.5, 10, 8), body, 0, 0.62, -0.25);
    abd.scale.z = 1.3;
    g.add(abd);
    g.add(mesh(new THREE.SphereGeometry(0.3, 8, 8), body, 0, 0.6, 0.35));
    for (const sx of [0.09, -0.09]) g.add(mesh(new THREE.SphereGeometry(0.05, 5, 5), acc, sx, 0.68, 0.6));
    for (let i = 0; i < 4; i++) {
      const a = 0.5 + i * 0.55;
      const legL = mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.9, 5), mat(0x1c1917), Math.cos(a) * 0.55, 0.5, 0.25 - i * 0.22);
      legL.rotation.z = 0.9;
      const legR = mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.9, 5), mat(0x1c1917), -Math.cos(a) * 0.55, 0.5, 0.25 - i * 0.22);
      legR.rotation.z = -0.9;
      g.add(legL, legR);
      parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
    }
  } else if (data.id === 'warlock') {
    // جادوگر تاریکی
    const robe = mesh(new THREE.ConeGeometry(0.55, 1.5, 8), body, 0, 0.75, 0);
    g.add(robe);
    const head = mesh(new THREE.SphereGeometry(0.26, 8, 8), mat(0x1e1b3a), 0, 1.62, 0);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, 0.1, 1.64, 0.2));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, -0.1, 1.64, 0.2));
    const staff = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.7, 6), mat(0x1c1917), 0.5, 0.95, 0);
    g.add(staff);
    const orb = mesh(new THREE.SphereGeometry(0.16, 8, 8), acc, 0.5, 1.85, 0);
    g.add(orb);
    parts.push({ node: orb, kind: 'pulse' });
    // هاله سپر (نامرئی تا فعال شود)
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    shield.position.y = 1;
    shield.visible = false;
    shield.name = 'shieldAura';
    g.add(shield);
  } else if (data.id === 'flyer') {
    // پرنده سایه
    const bod = mesh(new THREE.SphereGeometry(0.4, 8, 8), body, 0, 1, 0);
    bod.scale.set(1, 0.8, 1.4);
    g.add(bod);
    const wingL = mesh(new THREE.BoxGeometry(1.15, 0.05, 0.5), mat(0x231f33), 0.72, 1.05, 0);
    const wingR = mesh(new THREE.BoxGeometry(1.15, 0.05, 0.5), mat(0x231f33), -0.72, 1.05, 0);
    g.add(wingL, wingR);
    g.add(mesh(new THREE.SphereGeometry(0.06, 5, 5), acc, 0.12, 1.05, 0.5));
    g.add(mesh(new THREE.SphereGeometry(0.06, 5, 5), acc, -0.12, 1.05, 0.5));
    parts.push({ node: wingL, kind: 'wing' }, { node: wingR, kind: 'wing2' });
  } else if (data.id === 'shadowSoldier') {
    // سرباز سایه — زره‌پوش با نیزه و سپر
    const torso = mesh(new THREE.BoxGeometry(0.58, 0.72, 0.4), body, 0, 0.98, 0);
    g.add(torso);
    g.add(mesh(new THREE.SphereGeometry(0.25, 8, 8), mat(0x1e1930), 0, 1.55, 0));
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), acc, 0.1, 1.57, 0.2));
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), acc, -0.1, 1.57, 0.2));
    const legL = mesh(new THREE.BoxGeometry(0.19, 0.58, 0.21), body, 0.17, 0.32, 0);
    const legR = mesh(new THREE.BoxGeometry(0.19, 0.58, 0.21), body, -0.17, 0.32, 0);
    g.add(legL, legR);
    const spear = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 5), mat(0x2a2733), 0.42, 1.05, 0.05);
    g.add(spear);
    g.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 5), mat(0x8a8f98, { metalness: 0.8 }), 0.42, 1.9, 0.05));
    const shield = mesh(new THREE.BoxGeometry(0.1, 0.5, 0.42), mat(0x352a4a, { metalness: 0.5 }), -0.42, 0.95, 0.08);
    g.add(shield);
    parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
  } else if (data.id === 'spirit') {
    // روح شفادهنده — موجود شناور با مدارهای نور
    const veil = mesh(new THREE.ConeGeometry(0.45, 1.2, 8), new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.9, transparent: true, opacity: 0.7 }), 0, 0.85, 0);
    veil.rotation.x = Math.PI;
    g.add(veil);
    g.add(mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6, transparent: true, opacity: 0.85 }), 0, 1.45, 0));
    g.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), acc, 0, 1.5, 0.22));
    const orb1 = mesh(new THREE.SphereGeometry(0.11, 6, 6), acc, 0.5, 1.2, 0);
    const orb2 = mesh(new THREE.SphereGeometry(0.09, 6, 6), acc, -0.45, 1.0, 0.15);
    g.add(orb1, orb2);
    parts.push({ node: orb1, kind: 'pulse' }, { node: orb2, kind: 'bob' }, { node: veil, kind: 'bob' });
  } else if (data.id === 'hunter') {
    // شکارچی سایه — خمیده با تیغه‌های دوگانه
    const torso = mesh(new THREE.BoxGeometry(0.45, 0.62, 0.34), body, 0, 0.9, 0);
    torso.rotation.x = 0.25;
    g.add(torso);
    g.add(mesh(new THREE.SphereGeometry(0.22, 8, 8), mat(0x2c2118), 0, 1.32, 0.1));
    g.add(mesh(new THREE.BoxGeometry(0.28, 0.07, 0.12), acc, 0, 1.34, 0.26)); // ویزور نارنجی
    const legL = mesh(new THREE.BoxGeometry(0.15, 0.6, 0.17), body, 0.15, 0.3, 0);
    const legR = mesh(new THREE.BoxGeometry(0.15, 0.6, 0.17), body, -0.15, 0.3, 0);
    g.add(legL, legR);
    const bladeL = mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), mat(0x9aa0aa, { metalness: 0.85 }), 0.34, 0.85, 0.28);
    bladeL.rotation.x = 0.7;
    const bladeR = mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), mat(0x9aa0aa, { metalness: 0.85 }), -0.34, 0.85, 0.28);
    bladeR.rotation.x = 0.7;
    g.add(bladeL, bladeR);
    parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' }, { node: bladeL, kind: 'arm' }, { node: bladeR, kind: 'arm2' });
  } else if (data.id === 'warMachine') {
    // ماشین جنگی — پابه‌های چهارگانه با برجک
    const hull = mesh(new THREE.BoxGeometry(1.0, 0.5, 1.3), mat(0x3f3f46, { metalness: 0.7, roughness: 0.5 }), 0, 1.05, 0);
    g.add(hull);
    const turret = mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.42, 8), mat(0x2c2f34, { metalness: 0.75 }), 0, 1.5, 0);
    g.add(turret);
    const barrel = mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 8), mat(0x1c1f24, { metalness: 0.85 }), 0, 1.52, 0.75);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 8), acc, 0, 1.72, 0.15)); // چشم قرمز
    for (const [dx, dz] of [[0.55, 0.45], [-0.55, 0.45], [0.55, -0.45], [-0.55, -0.45]] as const) {
      const leg = mesh(new THREE.CylinderGeometry(0.09, 0.06, 1.0, 5), mat(0x27272a, { metalness: 0.6 }), dx, 0.45, dz);
      g.add(leg);
      parts.push({ node: leg, kind: dx * dz > 0 ? 'leg' : 'leg2' });
    }
  } else if (data.id === 'crystalMonster') {
    // هیولای کریستالی — بدنه سنگی با خارهای کریستال
    const torso = mesh(new THREE.DodecahedronGeometry(0.55, 0), body, 0, 0.8, 0);
    torso.scale.set(1, 0.85, 1.15);
    g.add(torso);
    for (const [dx, dz, s] of [[0, -0.3, 1.4], [0.3, -0.05, 1.0], [-0.28, -0.1, 0.85], [0.12, 0.28, 0.7]] as const) {
      const spike = mesh(new THREE.ConeGeometry(0.14 * s, 0.7 * s, 5), acc, dx, 1.15 + 0.2 * s, dz);
      spike.rotation.x = -0.3 + dz * 0.6;
      g.add(spike);
    }
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, 0.18, 0.92, 0.5));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, -0.18, 0.92, 0.5));
    const legL = mesh(new THREE.BoxGeometry(0.2, 0.4, 0.22), body, 0.28, 0.2, 0);
    const legR = mesh(new THREE.BoxGeometry(0.2, 0.4, 0.22), body, -0.28, 0.2, 0);
    g.add(legL, legR);
    parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
  } else if (data.id === 'smallDragon') {
    // اژدهای کوچک — بال، گردن، دم
    const bod = mesh(new THREE.SphereGeometry(0.42, 9, 8), body, 0, 1.0, -0.1);
    bod.scale.set(0.9, 0.9, 1.3);
    g.add(bod);
    const neck = mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.55, 6), body, 0, 1.3, 0.35);
    neck.rotation.x = 0.7;
    g.add(neck);
    const head = mesh(new THREE.BoxGeometry(0.3, 0.24, 0.45), body, 0, 1.55, 0.6);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.05, 5, 5), acc, 0.1, 1.6, 0.82));
    g.add(mesh(new THREE.SphereGeometry(0.05, 5, 5), acc, -0.1, 1.6, 0.82));
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 4), mat(0x3a2a1a), 0.08, 1.72, 0.5));
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 4), mat(0x3a2a1a), -0.08, 1.72, 0.5));
    const wingL = mesh(new THREE.BoxGeometry(1.1, 0.05, 0.55), mat(0x2c1512), 0.62, 1.15, -0.1);
    const wingR = mesh(new THREE.BoxGeometry(1.1, 0.05, 0.55), mat(0x2c1512), -0.62, 1.15, -0.1);
    g.add(wingL, wingR);
    const tail = mesh(new THREE.ConeGeometry(0.12, 0.85, 5), body, 0, 0.95, -0.85);
    tail.rotation.x = -Math.PI / 2 - 0.35;
    g.add(tail);
    parts.push({ node: wingL, kind: 'wing' }, { node: wingR, kind: 'wing2' });
  } else if (data.id === 'summoner') {
    // احضارکننده — ردا با گوی بزرگ احضار
    const robe = mesh(new THREE.ConeGeometry(0.6, 1.65, 8), body, 0, 0.82, 0);
    g.add(robe);
    g.add(mesh(new THREE.SphereGeometry(0.27, 8, 8), mat(0x1e1b3a), 0, 1.75, 0));
    g.add(mesh(new THREE.ConeGeometry(0.3, 0.4, 8), mat(0x1e1b3a), 0, 1.95, 0)); // کلاه‌ریش
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, 0.1, 1.78, 0.2));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, -0.1, 1.78, 0.2));
    const staff = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), mat(0x1c1917), 0.55, 1.1, 0);
    g.add(staff);
    const orb = mesh(new THREE.SphereGeometry(0.24, 10, 8), acc, 0.55, 2.1, 0);
    g.add(orb);
    const ring = mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 18), acc, 0.55, 2.1, 0);
    ring.rotation.x = Math.PI / 2.5;
    g.add(ring);
    parts.push({ node: orb, kind: 'pulse' }, { node: ring, kind: 'pulse' });
  } else if (data.id === 'aetherTank') {
    // تانک اثری — پوششی زرهی عظیم با هسته اثری
    const hull = mesh(new THREE.BoxGeometry(1.25, 0.85, 1.5), body, 0, 1.1, 0);
    g.add(hull);
    g.add(mesh(new THREE.BoxGeometry(1.45, 0.3, 0.5), mat(0x3f3f46, { metalness: 0.7 }), 0, 1.35, 0.6)); // صفحه جلو
    g.add(mesh(new THREE.OctahedronGeometry(0.24), acc, 0, 1.15, 0.78)); // هسته فیروزه‌ای
    const head = mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), body, 0, 1.7, 0.3);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, 0.12, 1.74, 0.56));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), acc, -0.12, 1.74, 0.56));
    for (const [dx, dz] of [[0.6, 0.5], [-0.6, 0.5], [0.6, -0.5], [-0.6, -0.5]] as const) {
      const leg = mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.9, 6), mat(0x27272a, { metalness: 0.6 }), dx, 0.4, dz);
      g.add(leg);
      parts.push({ node: leg, kind: dx * dz > 0 ? 'leg' : 'leg2' });
    }
  } else if (data.id === 'destroyer' || data.id === 'fireGiant' || data.id === 'iceGiant') {
    // نابودگر و غول‌ها — برتن عظیم با شانه‌های سنگی
    const isFire = data.id === 'fireGiant';
    const isIce = data.id === 'iceGiant';
    const torso = mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), body, 0, 1.4, 0);
    g.add(torso);
    g.add(mesh(new THREE.BoxGeometry(1.5, 0.35, 0.9), mat(0x2c2521), 0, 1.9, 0)); // شانه‌ها
    const head = mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), body, 0, 2.2, 0);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), acc, 0.13, 2.22, 0.28));
    g.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), acc, -0.13, 2.22, 0.28));
    // ترک‌های گداخته / یخ‌زده
    g.add(mesh(new THREE.BoxGeometry(0.09, 0.7, 0.05), acc, 0.25, 1.45, 0.42));
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.5, 0.05), acc, -0.2, 1.3, 0.42));
    const armL = mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), body, 0.9, 1.25, 0);
    const armR = mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), body, -0.9, 1.25, 0);
    g.add(armL, armR);
    const legL = mesh(new THREE.BoxGeometry(0.42, 0.85, 0.48), body, 0.32, 0.43, 0);
    const legR = mesh(new THREE.BoxGeometry(0.42, 0.85, 0.48), body, -0.32, 0.43, 0);
    g.add(legL, legR);
    if (isFire) {
      // شاخه‌های گداخته روی شانه
      g.add(mesh(new THREE.ConeGeometry(0.12, 0.5, 5), mat(0x450a0a), 0.6, 2.25, 0));
      g.add(mesh(new THREE.ConeGeometry(0.12, 0.5, 5), mat(0x450a0a), -0.6, 2.25, 0));
      g.add(mesh(new THREE.SphereGeometry(0.16, 8, 8), acc, 0, 2.05, 0.42)); // هسته گداخته
    }
    if (isIce) {
      // شاخ یخی
      const h1 = mesh(new THREE.ConeGeometry(0.1, 0.6, 5), acc, 0.2, 2.55, 0);
      h1.rotation.z = 0.35;
      const h2 = mesh(new THREE.ConeGeometry(0.1, 0.6, 5), acc, -0.2, 2.55, 0);
      h2.rotation.z = -0.35;
      g.add(h1, h2);
    }
    parts.push({ node: armL, kind: 'arm' }, { node: armR, kind: 'arm2' }, { node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
  } else if (data.id === 'annihilator') {
    // محوکننده — دستگاه محاسره سه‌لوله
    const base = mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.55, 8), mat(0x18181b, { metalness: 0.7, roughness: 0.4 }), 0, 0.35, 0);
    g.add(base);
    const hull = mesh(new THREE.BoxGeometry(1.4, 0.9, 1.6), body, 0, 1.1, -0.1);
    g.add(hull);
    g.add(mesh(new THREE.OctahedronGeometry(0.28), acc, 0, 1.25, 0.72)); // هسته سرخ
    for (const sx of [0.4, 0, -0.4]) {
      const bar = mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 8), mat(0x0f0f12, { metalness: 0.85 }), sx, 1.35, 0.95);
      bar.rotation.x = Math.PI / 2;
      g.add(bar);
    }
    g.add(mesh(new THREE.SphereGeometry(0.12, 8, 8), acc, 0, 1.75, -0.3));
    for (const [dx, dz] of [[0.7, 0.55], [-0.7, 0.55], [0.7, -0.55], [-0.7, -0.55]] as const) {
      const leg = mesh(new THREE.CylinderGeometry(0.14, 0.09, 0.85, 6), mat(0x27272a, { metalness: 0.65 }), dx, 0.35, dz);
      g.add(leg);
      parts.push({ node: leg, kind: dx * dz > 0 ? 'leg' : 'leg2' });
    }
  } else if (data.id === 'blackDragon') {
    // اژدهای سیاه — بال‌های بزرگ، شاخ، دم بلند
    const bod = mesh(new THREE.SphereGeometry(0.62, 10, 9), body, 0, 1.35, -0.15);
    bod.scale.set(1, 0.95, 1.45);
    g.add(bod);
    g.add(mesh(new THREE.OctahedronGeometry(0.2), acc, 0, 1.35, 0.5)); // سینه بنفش
    const neck = mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.8, 6), body, 0, 1.75, 0.5);
    neck.rotation.x = 0.8;
    g.add(neck);
    const head = mesh(new THREE.BoxGeometry(0.4, 0.3, 0.62), body, 0, 2.1, 0.85);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.06, 5, 5), acc, 0.13, 2.16, 1.12));
    g.add(mesh(new THREE.SphereGeometry(0.06, 5, 5), acc, -0.13, 2.16, 1.12));
    const hornL = mesh(new THREE.ConeGeometry(0.07, 0.42, 5), mat(0x1c1917), 0.15, 2.32, 0.75);
    hornL.rotation.x = -0.5;
    const hornR = mesh(new THREE.ConeGeometry(0.07, 0.42, 5), mat(0x1c1917), -0.15, 2.32, 0.75);
    hornR.rotation.x = -0.5;
    g.add(hornL, hornR);
    const wingL = mesh(new THREE.BoxGeometry(1.8, 0.05, 0.85), mat(0x141018), 1.0, 1.7, -0.2);
    const wingR = mesh(new THREE.BoxGeometry(1.8, 0.05, 0.85), mat(0x141018), -1.0, 1.7, -0.2);
    g.add(wingL, wingR);
    const tail = mesh(new THREE.ConeGeometry(0.16, 1.3, 5), body, 0, 1.2, -1.25);
    tail.rotation.x = -Math.PI / 2 - 0.3;
    g.add(tail);
    parts.push({ node: wingL, kind: 'wing' }, { node: wingR, kind: 'wing2' });
  } else if (data.id === 'darkLord') {
    // ارباب تاریکی — زره شاهانه، شنل، تاج شاخ‌دار، شمشیر عظیم
    const torso = mesh(new THREE.BoxGeometry(0.85, 1.0, 0.55), body, 0, 1.5, 0);
    g.add(torso);
    g.add(mesh(new THREE.OctahedronGeometry(0.22), acc, 0, 1.55, 0.3)); // هسته بنفش سینه
    const head = mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), mat(0x0c0c10), 0, 2.25, 0);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), acc, 0.1, 2.27, 0.24));
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), acc, -0.1, 2.27, 0.24));
    // تاج شاخ‌دار
    for (const [dx, rz] of [[0.18, 0.5], [-0.18, -0.5], [0, 0]] as const) {
      const horn = mesh(new THREE.ConeGeometry(0.06, 0.45, 5), mat(0x2a2433), dx, 2.62, 0);
      horn.rotation.z = rz;
      g.add(horn);
    }
    // شنل
    const cape = mesh(new THREE.BoxGeometry(0.95, 1.5, 0.08), mat(0x1a0f22, { roughness: 0.95 }), 0, 1.35, -0.36);
    cape.rotation.x = 0.1;
    g.add(cape);
    const legL = mesh(new THREE.BoxGeometry(0.26, 0.95, 0.28), body, 0.24, 0.48, 0);
    const legR = mesh(new THREE.BoxGeometry(0.26, 0.95, 0.28), body, -0.24, 0.48, 0);
    g.add(legL, legR);
    // شمشیر عظیم
    const blade = mesh(new THREE.BoxGeometry(0.16, 1.5, 0.05), mat(0x3f3248, { metalness: 0.85, roughness: 0.25 }), 0.75, 1.35, 0.15);
    g.add(blade);
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1), mat(0x2a2433), 0.75, 0.62, 0.15));
    const shoulderL = mesh(new THREE.SphereGeometry(0.28, 8, 8), mat(0x241d30, { metalness: 0.6 }), 0.55, 1.95, 0);
    const shoulderR = mesh(new THREE.SphereGeometry(0.28, 8, 8), mat(0x241d30, { metalness: 0.6 }), -0.55, 1.95, 0);
    g.add(shoulderL, shoulderR);
    parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
  } else {
    // Expanded roster: distinct procedural silhouettes for newly added enemy archetypes.
    if (['plagueHound', 'frostWraith', 'emberDrake'].includes(data.id)) {
      const airborne = data.id !== 'plagueHound';
      const beast = mesh(new THREE.SphereGeometry(data.id === 'emberDrake' ? 0.48 : 0.4, 10, 8), body, 0, airborne ? 1.1 : 0.65, 0);
      beast.scale.set(1, data.id === 'frostWraith' ? 1.25 : 0.8, 1.35); g.add(beast);
      const head = mesh(new THREE.ConeGeometry(0.22, 0.55, 5), body, 0, airborne ? 1.55 : 0.85, 0.42); head.rotation.x = Math.PI / 2; g.add(head);
      for (const side of [-1, 1]) {
        g.add(mesh(new THREE.SphereGeometry(0.07, 7, 6), acc, side * 0.14, airborne ? 1.55 : 0.82, 0.65));
        const wing = mesh(new THREE.BoxGeometry(0.9, 0.06, 0.35), mat(data.id === 'emberDrake' ? 0x451a03 : 0x164e63), side * 0.58, 1.18, -0.08);
        wing.rotation.z = side * 0.18; g.add(wing);
        if (airborne) parts.push({ node: wing, kind: 'wing' });
        else { const leg = mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.42, 5), body, side * 0.25, 0.28, 0.05); g.add(leg); parts.push({ node: leg, kind: side > 0 ? 'leg' : 'leg2' }); }
      }
      if (data.id === 'frostWraith') { const veil = mesh(new THREE.ConeGeometry(0.48, 1.0, 7), body, 0, 0.62, -0.1); veil.rotation.x = Math.PI; g.add(veil); }
    } else if (['siegeCrawler', 'ironBrute'].includes(data.id)) {
      const hull = mesh(new THREE.BoxGeometry(1.15, 0.8, 1.35), mat(data.color, { metalness: 0.72, roughness: 0.38 }), 0, 1.05, 0); g.add(hull);
      g.add(mesh(new THREE.OctahedronGeometry(0.22), acc, 0, 1.15, 0.72));
      for (const [dx, dz] of [[0.58, 0.48], [-0.58, 0.48], [0.58, -0.48], [-0.58, -0.48]] as const) {
        const leg = mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.85, 6), body, dx, 0.4, dz); leg.rotation.z = dx * 0.16;
        g.add(leg); parts.push({ node: leg, kind: dx > 0 ? 'leg' : 'leg2' });
      }
      for (const side of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.28, 0.36, 0.5), mat(0x18181b, { metalness: 0.8 }), side * 0.7, 1.25, 0.15));
    } else if (data.id === 'abyssBehemoth') {
      const torso = mesh(new THREE.DodecahedronGeometry(0.8, 1), body, 0, 1.45, 0); torso.scale.set(1.15, 1.2, 0.9); g.add(torso);
      g.add(mesh(new THREE.OctahedronGeometry(0.3), acc, 0, 1.52, 0.65));
      for (const side of [-1, 1]) {
        const arm = mesh(new THREE.BoxGeometry(0.42, 1.25, 0.48), body, side * 0.88, 1.2, 0); arm.rotation.z = side * -0.2; g.add(arm);
        const horn = mesh(new THREE.ConeGeometry(0.14, 0.72, 5), acc, side * 0.28, 2.45, -0.02); horn.rotation.z = side * 0.42; g.add(horn);
        parts.push({ node: arm, kind: side > 0 ? 'arm' : 'arm2' });
      }
      const legL = mesh(new THREE.BoxGeometry(0.34, 0.78, 0.38), body, 0.28, 0.4, 0);
      const legR = mesh(new THREE.BoxGeometry(0.34, 0.78, 0.38), body, -0.28, 0.4, 0); g.add(legL, legR);
      parts.push({ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' });
      const halo = mesh(new THREE.TorusGeometry(0.85, 0.04, 7, 26), acc, 0, 2.35, -0.05); halo.rotation.x = Math.PI / 2; g.add(halo);
    } else {
      // Bone Reaver, Void Archer and Hex Priest: humanoid silhouettes with unique weapons.
      const torso = mesh(new THREE.BoxGeometry(data.id === 'boneReaver' ? 0.52 : 0.58, 0.72, 0.38), body, 0, 0.98, 0); g.add(torso);
      const head = mesh(data.id === 'hexPriest' ? new THREE.ConeGeometry(0.27, 0.62, 6) : new THREE.SphereGeometry(0.24, 9, 8), body, 0, 1.55, 0); g.add(head);
      g.add(mesh(new THREE.SphereGeometry(0.055, 6, 6), acc, -0.09, 1.56, 0.21));
      g.add(mesh(new THREE.SphereGeometry(0.055, 6, 6), acc, 0.09, 1.56, 0.21));
      for (const side of [-1, 1]) { const leg = mesh(new THREE.BoxGeometry(0.17, 0.55, 0.2), body, side * 0.16, 0.3, 0); g.add(leg); parts.push({ node: leg, kind: side > 0 ? 'leg' : 'leg2' }); }
      if (data.id === 'voidArcher') {
        const bow = mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 16), acc, 0.46, 1.12, 0.18); bow.rotation.z = Math.PI / 2; g.add(bow);
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 5), body, 0.42, 1.0, 0.12));
      } else if (data.id === 'hexPriest') {
        g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.55, 6), body, 0.48, 0.95, 0));
        g.add(mesh(new THREE.OctahedronGeometry(0.17), acc, 0.48, 1.78, 0));
        const ring = mesh(new THREE.TorusGeometry(0.48, 0.025, 6, 18), acc, 0, 1.2, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      } else {
        const blade = mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), mat(0xd6d3d1, { metalness: 0.7 }), 0.42, 0.9, 0.18); blade.rotation.z = -0.25; g.add(blade);
        g.add(mesh(new THREE.ConeGeometry(0.08, 0.28, 5), acc, -0.36, 1.9, 0));
      }
    }
  }

  // Extra silhouette detail for humanoid enemies and bosses: layered plates, joints and runic armor.
  if (['warrior', 'golem', 'golemKing', 'warlock', 'darkLord'].includes(data.id)) {
    const plate = mat(data.id === 'golem' || data.id === 'golemKing' ? 0x5c626c : 0x292632, { metalness: 0.68, roughness: 0.34 });
    const edge = mat(0x8c94a3, { metalness: 0.82, roughness: 0.24 });
    const frontZ = data.id === 'golem' || data.id === 'golemKing' ? 0.43 : 0.24;
    for (const side of [-1, 1]) {
      const pauldron = mesh(new THREE.SphereGeometry(data.id === 'golemKing' ? 0.34 : 0.23, 12, 10), plate, side * (data.id === 'golemKing' ? 0.62 : 0.38), data.id === 'golemKing' ? 1.95 : 1.38, 0);
      pauldron.scale.set(1.1, 0.7, 0.85);
      g.add(pauldron);
      g.add(mesh(new THREE.SphereGeometry(0.045, 7, 6), edge, side * (data.id === 'golemKing' ? 0.62 : 0.38), data.id === 'golemKing' ? 1.98 : 1.4, frontZ));
      if (data.id !== 'golem' && data.id !== 'golemKing') {
        const shin = mesh(new THREE.BoxGeometry(0.2, 0.26, 0.25), plate, side * 0.16, 0.26, 0.08);
        g.add(shin);
      }
    }
    if (data.id === 'golemKing' || data.id === 'darkLord') {
      const crownMat = mat(0x29202f, { metalness: 0.7, roughness: 0.26 });
      for (let i = -1; i <= 1; i++) {
        const horn = mesh(new THREE.ConeGeometry(0.09, data.id === 'darkLord' ? 0.55 : 0.42, 6), crownMat, i * 0.2, data.id === 'darkLord' ? 2.68 : 2.78, 0);
        horn.rotation.z = -i * 0.3;
        g.add(horn);
      }
      const bossHalo = mesh(new THREE.TorusGeometry(0.7, 0.035, 6, 24), acc, 0, data.id === 'darkLord' ? 2.45 : 2.55, -0.05);
      bossHalo.rotation.x = Math.PI / 2;
      g.add(bossHalo);
    }
  }

  // Bespoke armor/material pass for each newly added enemy archetype.
  // These are real Three.js meshes (not flat sprites), kept lightweight for Android.
  if (['boneReaver', 'plagueHound', 'voidArcher', 'ironBrute', 'frostWraith', 'emberDrake', 'hexPriest', 'siegeCrawler', 'abyssBehemoth'].includes(data.id)) {
    const darkArmor = mat(data.id === 'frostWraith' ? 0x263d55 : data.id === 'emberDrake' ? 0x43221e : 0x242832, { metalness: 0.72, roughness: 0.3 });
    const brightTrim = mat(data.id === 'boneReaver' ? 0xd6d3d1 : data.id === 'ironBrute' || data.id === 'siegeCrawler' ? 0xaab4c0 : data.color, { metalness: 0.74, roughness: 0.28 });
    if (data.id === 'boneReaver') {
      // Bone ribs and a skull-like crown.
      for (let i = 0; i < 3; i++) {
        const rib = mesh(new THREE.TorusGeometry(0.22 + i * 0.035, 0.035, 5, 12, Math.PI), brightTrim, 0, 0.82 + i * 0.13, 0.2);
        rib.rotation.z = Math.PI;
        g.add(rib);
      }
      for (const side of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.07, 0.24, 5), brightTrim, side * 0.16, 1.78, -0.02));
    } else if (data.id === 'plagueHound') {
      // Toxic dorsal spines and cheek glands.
      for (let i = 0; i < 5; i++) {
        const spine = mesh(new THREE.ConeGeometry(0.08, 0.28 + (i % 2) * 0.08, 5), acc, (i - 2) * 0.18, 1.0, -0.38 + i * 0.08);
        spine.rotation.z = (i - 2) * -0.12;
        g.add(spine);
      }
      for (const side of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.12, 8, 7), acc, side * 0.3, 0.95, 0.42));
    } else if (data.id === 'voidArcher') {
      // A visible back quiver with glowing arrowheads.
      const quiver = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.58, 7), darkArmor, -0.34, 1.1, -0.24);
      quiver.rotation.z = -0.2;
      g.add(quiver);
      for (let i = 0; i < 3; i++) {
        const arrow = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), brightTrim, -0.39 + i * 0.05, 1.42, -0.25);
        arrow.rotation.z = -0.12;
        g.add(arrow);
        g.add(mesh(new THREE.ConeGeometry(0.035, 0.11, 4), acc, -0.39 + i * 0.05, 1.7, -0.25));
      }
    } else if (data.id === 'ironBrute') {
      // Heavy layered shoulder plates and rivets.
      for (const side of [-1, 1]) {
        const plate = mesh(new THREE.BoxGeometry(0.48, 0.34, 0.48), darkArmor, side * 0.62, 1.62, 0);
        plate.rotation.z = side * -0.12;
        g.add(plate);
        for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.045, 6, 6), brightTrim, side * (0.49 + i * 0.12), 1.68, 0.25));
      }
      g.add(mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), acc, 0, 1.42, 0.42));
    } else if (data.id === 'frostWraith') {
      // Floating ice shards frame the spectral silhouette.
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const shard = mesh(new THREE.OctahedronGeometry(0.12 + (i % 2) * 0.045), acc, Math.cos(a) * 0.58, 1.15 + Math.sin(a) * 0.48, Math.sin(a) * 0.5);
        shard.rotation.set(a, a * 0.6, -a * 0.4);
        g.add(shard);
      }
    } else if (data.id === 'emberDrake') {
      // Horns, dorsal plates and ember-lit jaw.
      for (const side of [-1, 1]) {
        const horn = mesh(new THREE.ConeGeometry(0.11, 0.42, 5), darkArmor, side * 0.28, 1.75, -0.08);
        horn.rotation.z = side * -0.48;
        g.add(horn);
      }
      for (let i = 0; i < 4; i++) {
        const spike = mesh(new THREE.ConeGeometry(0.09, 0.3, 5), acc, (i - 1.5) * 0.2, 1.25, -0.38 + i * 0.08);
        spike.rotation.x = Math.PI / 2;
        g.add(spike);
      }
      g.add(mesh(new THREE.BoxGeometry(0.32, 0.09, 0.12), acc, 0, 1.18, 0.46));
    } else if (data.id === 'hexPriest') {
      // Crowned ritual collar and a brighter rune focus.
      const collar = mesh(new THREE.TorusGeometry(0.38, 0.055, 6, 20), brightTrim, 0, 1.24, 0);
      collar.rotation.x = Math.PI / 2;
      g.add(collar);
      g.add(mesh(new THREE.OctahedronGeometry(0.13), acc, 0, 1.95, 0.12));
    } else if (data.id === 'siegeCrawler') {
      // Reinforced machine armor and glowing exhaust ports.
      for (const side of [-1, 1]) {
        const plate = mesh(new THREE.BoxGeometry(0.52, 0.28, 0.7), darkArmor, side * 0.58, 0.78, 0);
        plate.rotation.z = side * -0.08;
        g.add(plate);
        for (let i = 0; i < 2; i++) g.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), acc, side * 0.6, 0.7, (i - 0.5) * 0.32));
      }
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.42, 8), brightTrim, 0, 1.05, -0.4));
    } else if (data.id === 'abyssBehemoth') {
      // Boss-grade layered chest armor and a three-point crown.
      const chest = mesh(new THREE.BoxGeometry(0.7, 0.34, 0.16), darkArmor, 0, 1.45, 0.56);
      g.add(chest);
      g.add(mesh(new THREE.OctahedronGeometry(0.2), acc, 0, 1.48, 0.68));
      for (let i = -1; i <= 1; i++) {
        const horn = mesh(new THREE.ConeGeometry(0.1, 0.36, 5), brightTrim, i * 0.22, 2.72, -0.05);
        horn.rotation.z = -i * 0.28;
        g.add(horn);
      }
    }
  }

  finishEnemyModel(g, data.id);
  g.userData.animParts = parts;
  g.scale.setScalar(s);
  g.traverse((o) => {
    o.userData.selectable = true;
  });
  return g;
}

// ---------------------------- قهرمان ----------------------------

export function buildHeroMesh(heroId = 'arman'): THREE.Group {
  const g = new THREE.Group();
  const armor = mat(0x5a5e4a);
  const gold = mat(0xd4a017, { metalness: 0.85, roughness: 0.3 });

  if (heroId === 'aria') {
    // آریا — نگهبان جادویی: ردا، عصا با کریستال، شانه‌پوش
    const robeMat = mat(0x1e3a4a, { roughness: 0.85 });
    const robe = mesh(new THREE.ConeGeometry(0.5, 1.35, 8), robeMat, 0, 0.68, 0);
    g.add(robe);
    const torso = mesh(new THREE.BoxGeometry(0.5, 0.6, 0.36), mat(0x2c4a5e, { metalness: 0.4 }), 0, 1.15, 0);
    g.add(torso);
    g.add(mesh(new THREE.OctahedronGeometry(0.14), glow(0x67e8f9), 0, 1.25, 0.2));
    const shoulderL = mesh(new THREE.SphereGeometry(0.17, 8, 8), gold, 0.33, 1.42, 0);
    const shoulderR = mesh(new THREE.SphereGeometry(0.17, 8, 8), gold, -0.33, 1.42, 0);
    g.add(shoulderL, shoulderR);
    const head = mesh(new THREE.SphereGeometry(0.24, 10, 10), mat(0xe8c8a0), 0, 1.68, 0);
    g.add(head);
    const hood = mesh(new THREE.ConeGeometry(0.3, 0.5, 8), robeMat, 0, 1.86, -0.04);
    g.add(hood);
    // عصای کریستال
    const staff = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.75, 6), mat(0x2a2d33, { metalness: 0.7 }), 0.48, 1.15, 0.05);
    g.add(staff);
    g.add(mesh(new THREE.OctahedronGeometry(0.17), glow(0x67e8f9), 0.48, 2.1, 0.05));
    g.userData.animParts = [];
    g.userData.rifleTip = new THREE.Vector3(0.48, 2.1, 0.05);
  } else if (heroId === 'radin') {
    // رادین — جنگجوی سنگین: تنپوش عظیم، کلنگ سنگین
    const steel = mat(0x3d4450, { metalness: 0.75, roughness: 0.35 });
    const torso = mesh(new THREE.BoxGeometry(0.85, 0.85, 0.55), steel, 0, 1.1, 0);
    g.add(torso);
    g.add(mesh(new THREE.BoxGeometry(0.95, 0.2, 0.6), gold, 0, 1.45, 0)); // سینه‌پوش
    const shoulderL = mesh(new THREE.SphereGeometry(0.26, 8, 8), steel, 0.5, 1.45, 0);
    const shoulderR = mesh(new THREE.SphereGeometry(0.26, 8, 8), steel, -0.5, 1.45, 0);
    g.add(shoulderL, shoulderR);
    const head = mesh(new THREE.SphereGeometry(0.26, 10, 10), mat(0xc8a06a), 0, 1.75, 0);
    g.add(head);
    const helm = mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.9), steel, 0, 1.82, 0);
    g.add(helm);
    const legL = mesh(new THREE.BoxGeometry(0.28, 0.62, 0.3), armor, 0.22, 0.33, 0);
    const legR = mesh(new THREE.BoxGeometry(0.28, 0.62, 0.3), armor, -0.22, 0.33, 0);
    g.add(legL, legR);
    // کلنگ عظیم
    const hammer = new THREE.Group();
    hammer.position.set(0.55, 1.2, 0.2);
    hammer.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.1, 6), mat(0x2a2d33, { metalness: 0.8 }), 0, 0, 0));
    hammer.add(mesh(new THREE.BoxGeometry(0.42, 0.26, 0.26), mat(0x6b7280, { metalness: 0.85 }), 0, 0.58, 0));
    hammer.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), glow(0xf87171), 0, -0.55, 0));
    g.add(hammer);
    g.userData.animParts = [{ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' }];
    g.userData.rifleTip = new THREE.Vector3(0.55, 1.8, 0.2);
  } else if (heroId === 'nila') {
    // نیلا — تیرانداز اسرار: زره سبز، کلاه‌ریش، کمان انرژی
    const cloth = mat(0x2a2438, { roughness: 0.85 });
    const torso = mesh(new THREE.BoxGeometry(0.5, 0.68, 0.34), mat(0x3a2f52, { metalness: 0.3 }), 0, 1.05, 0);
    g.add(torso);
    g.add(mesh(new THREE.OctahedronGeometry(0.1), glow(0xc084fc), 0, 1.15, 0.19));
    const head = mesh(new THREE.SphereGeometry(0.24, 10, 10), mat(0xd8b890), 0, 1.6, 0);
    g.add(head);
    const hood = mesh(new THREE.SphereGeometry(0.29, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), cloth, 0, 1.66, -0.03);
    g.add(hood);
    const legL = mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), cloth, 0.15, 0.32, 0);
    const legR = mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), cloth, -0.15, 0.32, 0);
    g.add(legL, legR);
    // کمان انرژی
    const bow = new THREE.Group();
    bow.position.set(0.42, 1.1, 0.3);
    const limb = mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 18, Math.PI), mat(0x4a3a62), 0, 0, 0);
    limb.rotation.z = Math.PI / 2;
    bow.add(limb);
    bow.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), glow(0xc084fc), 0.42, 0, 0));
    g.add(bow);
    g.userData.animParts = [{ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' }];
    g.userData.rifleTip = new THREE.Vector3(0.42, 1.1, 0.72);
  } else if (['kaelan', 'yara', 'veyra', 'borin', 'soren', 'darya', 'kaveh', 'nyx'].includes(heroId)) {
    const palette: Record<string, number> = { kaelan: 0xfbbf24, yara: 0x22d3ee, veyra: 0xf472b6, borin: 0x94a3b8, soren: 0xa78bfa, darya: 0x4ade80, kaveh: 0xfb923c, nyx: 0xc084fc };
    const accent = palette[heroId] ?? 0xfbbf24;
    const dark = mat(0x202431, { metalness: 0.72, roughness: 0.34 });
    const cloth = mat(heroId === 'darya' ? 0x14532d : heroId === 'soren' || heroId === 'nyx' ? 0x211438 : 0x303746, { roughness: 0.8 });
    const torso = mesh(new THREE.BoxGeometry(heroId === 'borin' ? 0.72 : 0.56, heroId === 'borin' ? 0.82 : 0.7, 0.38), cloth, 0, 1.03, 0); g.add(torso);
    g.add(mesh(new THREE.OctahedronGeometry(heroId === 'borin' ? 0.15 : 0.12), glow(accent), 0, 1.16, 0.23));
    g.add(mesh(new THREE.SphereGeometry(0.25, 10, 9), mat(0xc8a98b), 0, 1.62, 0));
    if (['yara', 'soren', 'nyx'].includes(heroId)) g.add(mesh(new THREE.ConeGeometry(0.32, 0.52, 7), cloth, 0, 1.82, -0.03));
    else g.add(mesh(new THREE.SphereGeometry(0.29, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), dark, 0, 1.72, 0));
    const legL = mesh(new THREE.BoxGeometry(0.19, 0.58, 0.22), dark, 0.16, 0.31, 0);
    const legR = mesh(new THREE.BoxGeometry(0.19, 0.58, 0.22), dark, -0.16, 0.31, 0); g.add(legL, legR);
    if (['yara', 'soren', 'darya'].includes(heroId)) {
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 7), dark, 0.48, 1.1, 0.05));
      g.add(mesh(new THREE.OctahedronGeometry(0.17), glow(accent), 0.48, 1.98, 0.05));
      g.add(mesh(new THREE.TorusGeometry(0.25, 0.025, 6, 18), glow(accent), 0.48, 1.98, 0.05));
      g.userData.rifleTip = new THREE.Vector3(0.48, 1.98, 0.05);
    } else if (['veyra', 'nyx'].includes(heroId)) {
      for (const side of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.07, 0.68, 0.08), dark, side * 0.36, 0.92, 0.2));
      g.userData.rifleTip = new THREE.Vector3(0.38, 1.0, 0.5);
    } else if (heroId === 'kaveh') {
      const bow = mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 20, Math.PI), glow(accent), 0.43, 1.12, 0.18); bow.rotation.z = Math.PI / 2; g.add(bow);
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), glow(accent), 0.43, 1.12, 0.18));
      g.userData.rifleTip = new THREE.Vector3(0.43, 1.12, 0.65);
    } else {
      const weapon = mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 7), dark, 0.45, 1.05, 0.1); weapon.rotation.x = Math.PI / 2; g.add(weapon);
      g.userData.rifleTip = new THREE.Vector3(0.45, 1.05, 0.75);
    }
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.SphereGeometry(heroId === 'borin' ? 0.25 : 0.19, 10, 8), dark, side * 0.36, 1.38, 0);
      shoulder.scale.set(1.1, 0.75, 0.85); g.add(shoulder);
      g.add(mesh(new THREE.SphereGeometry(0.035, 7, 6), glow(accent), side * 0.36, 1.4, 0.18));
    }
    g.userData.animParts = [{ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' }];
  } else {
    // آرمان — فرمانده (پیش‌فرض)
    const torso = mesh(new THREE.BoxGeometry(0.62, 0.75, 0.42), armor, 0, 1.0, 0);
    g.add(torso);
    g.add(mesh(new THREE.BoxGeometry(0.66, 0.16, 0.46), gold, 0, 1.32, 0)); // سینه‌پوش
    const head = mesh(new THREE.SphereGeometry(0.27, 10, 10), mat(0xc8a06a), 0, 1.62, 0);
    g.add(head);
    const helm = mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), gold, 0, 1.7, 0);
    g.add(helm);
    const legL = mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), armor, 0.17, 0.32, 0);
    const legR = mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), armor, -0.17, 0.32, 0);
    g.add(legL, legR);
    // تفنگ آذری
    const rifle = new THREE.Group();
    rifle.position.set(0.42, 1.05, 0.25);
    const barrel = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.15, 6), mat(0x2a2d33, { metalness: 0.85 }), 0, 0, 0.3);
    barrel.rotation.x = Math.PI / 2;
    rifle.add(barrel);
    rifle.add(mesh(new THREE.BoxGeometry(0.1, 0.2, 0.3), mat(0x3d412f), 0, -0.1, -0.25));
    rifle.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), glow(0xffb020), 0, 0, 0.9));
    g.add(rifle);
    // شنل
    const cape = mesh(new THREE.BoxGeometry(0.6, 0.95, 0.06), mat(0x7a1f1f, { roughness: 0.9 }), 0, 0.95, -0.28);
    cape.rotation.x = 0.12;
    g.add(cape);
    g.userData.animParts = [{ node: legL, kind: 'leg' }, { node: legR, kind: 'leg2' }];
    g.userData.rifleTip = new THREE.Vector3(0.42, 1.05, 1.3);
  }
  // پاس نهایی جزئیات قهرمان: زره چندلایه، مفصل‌ها، چهره و نشان اختصاصی.
  // این قطعات هندسه‌های بومی Three.js هستند؛ به فایل خارجی یا دانلود حین بازی نیاز ندارند.
  const skin = mat(heroId === 'aria' ? 0xe8c8a0 : heroId === 'nila' ? 0xd8b890 : 0xc8a06a, { roughness: 0.82 });
  const darkSteel = mat(0x202833, { metalness: 0.78, roughness: 0.28 });
  const trimGold = mat(0xe8bd58, { metalness: 0.82, roughness: 0.24 });
  const heroAccent = ({ arman: 0xffb020, aria: 0x67e8f9, nila: 0xc084fc, radin: 0xf87171, kaelan: 0xfbbf24, yara: 0x22d3ee, veyra: 0xf472b6, borin: 0x94a3b8, soren: 0xa78bfa, darya: 0x4ade80, kaveh: 0xfb923c, nyx: 0xc084fc } as Record<string, number>)[heroId] ?? 0xffb020;
  // Boots and articulated knee guards make the silhouette read better from the isometric camera.
  for (const side of [-1, 1]) {
    const boot = mesh(new THREE.BoxGeometry(0.24, 0.17, 0.34), darkSteel, side * (heroId === 'radin' ? 0.23 : 0.17), 0.09, 0.08);
    g.add(boot);
    const knee = mesh(new THREE.SphereGeometry(0.13, 12, 10), heroId === 'aria' ? trimGold : armor, side * (heroId === 'radin' ? 0.23 : 0.17), 0.49, 0.12);
    knee.scale.set(1, 0.78, 0.62);
    g.add(knee);
    const bracer = mesh(new THREE.CylinderGeometry(0.105, 0.13, 0.3, 8), heroId === 'aria' ? trimGold : darkSteel, side * 0.39, 0.96, 0.04);
    bracer.rotation.z = side * -0.12;
    g.add(bracer);
    const shoulder = mesh(new THREE.SphereGeometry(heroId === 'radin' ? 0.29 : 0.21, 14, 12), heroId === 'aria' ? trimGold : armor, side * (heroId === 'radin' ? 0.51 : 0.35), 1.43, 0);
    shoulder.scale.set(1.05, 0.72, 0.9);
    g.add(shoulder);
    // Small rivets on the front-facing shoulder plates.
    g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), trimGold, side * (heroId === 'radin' ? 0.52 : 0.35), 1.46, 0.19));
  }
  // Layered belt, central buckle and chest emblem.
  g.add(mesh(new THREE.CylinderGeometry(heroId === 'radin' ? 0.44 : 0.31, heroId === 'radin' ? 0.44 : 0.31, 0.12, 10), darkSteel, 0, 0.72, 0));
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.055), trimGold, 0, 0.73, 0.24));
  g.add(mesh(new THREE.OctahedronGeometry(heroId === 'radin' ? 0.12 : 0.095), glow(heroAccent), 0, heroId === 'aria' ? 1.28 : 1.2, 0.29));
  // Facial details face the +Z camera direction.
  g.add(mesh(new THREE.SphereGeometry(0.035, 8, 8), darkSteel, -0.085, heroId === 'aria' ? 1.68 : heroId === 'nila' ? 1.6 : heroId === 'radin' ? 1.75 : 1.62, 0.225));
  g.add(mesh(new THREE.SphereGeometry(0.035, 8, 8), darkSteel, 0.085, heroId === 'aria' ? 1.68 : heroId === 'nila' ? 1.6 : heroId === 'radin' ? 1.75 : 1.62, 0.225));
  if (heroId === 'arman') {
    // Commander crest, engraved breastplate and a layered shoulder cape.
    const crest = mesh(new THREE.ConeGeometry(0.11, 0.42, 5), trimGold, 0, 2.0, 0);
    crest.rotation.z = Math.PI;
    g.add(crest);
    for (const side of [-1, 1]) {
      const feather = mesh(new THREE.BoxGeometry(0.08, 0.42, 0.04), mat(0x8f2428, { roughness: 0.75 }), side * 0.18, 1.74, -0.23);
      feather.rotation.z = side * 0.28;
      g.add(feather);
    }
  } else if (heroId === 'aria') {
    // Floating arcane runes around the staff crystal.
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const rune = mesh(new THREE.TetrahedronGeometry(0.075), glow(heroAccent), 0.48 + Math.cos(a) * 0.27, 2.1 + Math.sin(a) * 0.18, 0.05);
      g.add(rune);
    }
  } else if (heroId === 'radin') {
    // Heavy shoulder plates and riveted war-hammer head.
    for (const side of [-1, 1]) {
      const spike = mesh(new THREE.ConeGeometry(0.085, 0.28, 5), trimGold, side * 0.55, 1.7, 0);
      spike.rotation.z = side * -0.45;
      g.add(spike);
    }
    g.add(mesh(new THREE.BoxGeometry(0.48, 0.07, 0.31), darkSteel, 0.55, 1.8, 0.2));
  } else if (heroId === 'nila') {
    // Hood rim, quiver and glowing bow grip.
    const rim = mesh(new THREE.TorusGeometry(0.235, 0.035, 6, 18), trimGold, 0, 1.62, -0.02);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const quiver = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.55, 7), darkSteel, -0.3, 1.05, -0.25);
    quiver.rotation.z = -0.22;
    g.add(quiver);
    for (let i = 0; i < 3; i++) {
      const arrow = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4), trimGold, -0.34 + i * 0.04, 1.38, -0.25);
      arrow.rotation.z = -0.1;
      g.add(arrow);
    }
  }
  // Final bespoke silhouette pass for the expanded roster: layered cuirass,
  // asymmetrical pauldrons, facial/helm accents and a hero-coloured relic.
  const rosterPalette: Record<string, number> = {
    arman: 0xffb020, aria: 0x67e8f9, nila: 0xc084fc, radin: 0xf87171,
    kaelan: 0xfbbf24, yara: 0x22d3ee, veyra: 0xf472b6, borin: 0x94a3b8,
    soren: 0xa78bfa, darya: 0x4ade80, kaveh: 0xfb923c, nyx: 0xc084fc,
  };
  const relicColor = rosterPalette[heroId] ?? 0xffb020;
  const cuirass = mat(heroId === 'borin' || heroId === 'radin' ? 0x39424f : 0x303443, { metalness: 0.72, roughness: 0.32 });
  const trim = mat(heroId === 'darya' ? 0xb8f7c8 : 0xd7c18a, { metalness: 0.76, roughness: 0.28 });
  // Front-facing layered chest plates read clearly from the game's isometric camera.
  const chestPlate = mesh(new THREE.BoxGeometry(heroId === 'borin' || heroId === 'radin' ? 0.5 : 0.36, 0.26, 0.085), cuirass, 0, 1.06, 0.235);
  chestPlate.rotation.z = heroId === 'nyx' ? -0.08 : 0;
  g.add(chestPlate);
  g.add(mesh(new THREE.BoxGeometry(0.27, 0.045, 0.035), trim, 0, 1.17, 0.29));
  g.add(mesh(new THREE.OctahedronGeometry(heroId === 'borin' ? 0.14 : 0.105), glow(relicColor), 0, 1.02, 0.31));
  // A different head silhouette per hero prevents the expanded roster reading as recolours.
  if (['kaelan', 'kaveh'].includes(heroId)) {
    const crest = mesh(new THREE.ConeGeometry(0.09, 0.34, 5), trim, 0, 2.02, 0);
    crest.rotation.z = Math.PI;
    g.add(crest);
  } else if (['veyra', 'nyx'].includes(heroId)) {
    for (const side of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.075, heroId === 'nyx' ? 0.42 : 0.28, 5), cuirass, side * 0.19, 1.88, -0.02);
      horn.rotation.z = side * -0.38;
      g.add(horn);
    }
  } else if (['borin', 'radin'].includes(heroId)) {
    const brow = mesh(new THREE.BoxGeometry(0.48, 0.11, 0.12), trim, 0, 1.83, 0.19);
    g.add(brow);
  } else if (heroId === 'darya') {
    for (let i = 0; i < 3; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.07, 0.28, 5), mat(0x2f855a, { roughness: 0.7 }), (i - 1) * 0.13, 1.88 + Math.abs(i - 1) * 0.04, -0.04);
      leaf.rotation.z = (i - 1) * -0.3;
      g.add(leaf);
    }
  }
  // Individual ceremonial mantle for the eight new heroes. Layered cloth,
  // stitched edging and a clasp give each silhouette a more authored fantasy-game read.
  if (['kaelan', 'yara', 'veyra', 'borin', 'soren', 'darya', 'kaveh', 'nyx'].includes(heroId)) {
    const capeColors: Record<string, number> = {
      kaelan: 0x56351d, yara: 0x123c4b, veyra: 0x4b1f43, borin: 0x303844,
      soren: 0x30224d, darya: 0x173d2a, kaveh: 0x66351d, nyx: 0x241a3d,
    };
    const capeShape = new THREE.Shape();
    capeShape.moveTo(-0.29, 0.12);
    capeShape.quadraticCurveTo(0, 0.2, 0.29, 0.12);
    capeShape.lineTo(0.48, -0.68);
    capeShape.quadraticCurveTo(0, -0.94, -0.48, -0.68);
    capeShape.closePath();
    const cape = mesh(new THREE.ExtrudeGeometry(capeShape, {
      depth: 0.035, bevelEnabled: true, bevelSegments: 2, steps: 1,
      bevelSize: 0.025, bevelThickness: 0.018, curveSegments: 5,
    }), mat(capeColors[heroId], { roughness: 0.92, metalness: 0.03, side: THREE.DoubleSide }), 0, 1.48, -0.29);
    cape.rotation.y = heroId === 'nyx' ? -0.06 : 0;
    g.add(cape);
    const clasp = mesh(new THREE.OctahedronGeometry(0.105), glow(relicColor), 0, 1.47, -0.22);
    g.add(clasp);
    const mantleTrim = mat(heroId === 'borin' ? 0x9ca3af : relicColor, { metalness: 0.68, roughness: 0.3, emissive: relicColor, emissiveIntensity: 0.18 });
    for (const side of [-1, 1]) {
      const seam = mesh(new THREE.BoxGeometry(0.035, 0.62, 0.025), mantleTrim, side * 0.32, 1.13, -0.245);
      seam.rotation.z = side * -0.12;
      g.add(seam);
    }
    // A short shoulder mantle makes the cape attachment feel integrated with armor.
    const mantle = mesh(new THREE.BoxGeometry(0.74, 0.12, 0.34), mat(capeColors[heroId], { roughness: 0.9 }), 0, 1.43, -0.08);
    mantle.rotation.x = -0.12;
    g.add(mantle);
  }
  // Distinctive shoulder plates and rivets for every hero, with role-specific asymmetry.
  for (const side of [-1, 1]) {
    const shoulderX = side * (heroId === 'borin' || heroId === 'radin' ? 0.52 : 0.39);
    const pauldron = mesh(new THREE.SphereGeometry(heroId === 'borin' ? 0.3 : 0.22, 12, 10), cuirass, shoulderX, 1.43, 0);
    pauldron.scale.set(1.2, 0.72, 0.92);
    g.add(pauldron);
    g.add(mesh(new THREE.SphereGeometry(0.04, 7, 6), trim, shoulderX, 1.46, 0.19));
    if (heroId === 'kaelan' || heroId === 'borin') {
      const spike = mesh(new THREE.ConeGeometry(0.07, 0.24, 5), trim, shoulderX, 1.65, 0);
      spike.rotation.z = side * -0.35;
      g.add(spike);
    }
  }
  // Low-cost energy inlays create a premium fantasy read without runtime textures.
  for (let i = 0; i < 3; i++) {
    const rune = mesh(new THREE.TetrahedronGeometry(0.055), glow(relicColor), (i - 1) * 0.13, 0.84, 0.28);
    rune.rotation.z = i * 0.55;
    g.add(rune);
  }
  g.traverse((o) => {
    o.userData.selectable = true;
  });
  finishHeroModel(g, heroId);
  return g;
}

// ---------------------------- هسته آذر ----------------------------

export function buildCoreMesh(): THREE.Group {
  const g = new THREE.Group();
  const stone = mat(0x6b625a, { roughness: 0.8 });
  g.add(mesh(new THREE.CylinderGeometry(3.1, 3.6, 0.7, 12), stone, 0, 0.35, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.8, 12), stone, 0, 1.05, 0));
  // ستون‌های انرژی
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 6), mat(0x3f4750, { metalness: 0.7 }), Math.cos(a) * 2.85, 1.9, Math.sin(a) * 2.85);
    g.add(px);
    g.add(mesh(new THREE.OctahedronGeometry(0.24), glow(0xfbbf24), Math.cos(a) * 2.85, 3.3, Math.sin(a) * 2.85));
  }
  // کریستال اصلی
  const core = mesh(new THREE.OctahedronGeometry(1.5), new THREE.MeshStandardMaterial({
    color: 0xfcd34d, emissive: 0xf59e0b, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.1,
  }), 0, 2.9, 0);
  core.scale.y = 1.5;
  g.add(core);
  g.userData.core = core;
  // حلقه چرخان جادویی
  const ring1 = mesh(new THREE.TorusGeometry(1.9, 0.07, 8, 40), glow(0xf59e0b), 0, 2.9, 0);
  ring1.rotation.x = Math.PI / 2;
  g.add(ring1);
  const ring2 = mesh(new THREE.TorusGeometry(2.2, 0.04, 8, 40), glow(0xfff7cc), 0, 2.9, 0);
  ring2.rotation.x = Math.PI / 2.6;
  g.add(ring2);
  g.userData.ring1 = ring1;
  g.userData.ring2 = ring2;
  const light = new THREE.PointLight(0xf59e0b, 30, 40, 1.6);
  light.position.set(0, 4, 0);
  g.add(light);
  g.userData.light = light;
  g.traverse((o) => {
    o.userData.selectable = true;
  });
  return g;
}

// ---------------------------- دروازه تاریکی ----------------------------

export function buildRiftMesh(): THREE.Group {
  const g = new THREE.Group();
  const arch = mat(0x2d2433, { roughness: 0.9 });
  const p1 = mesh(new THREE.BoxGeometry(0.7, 4.6, 0.7), arch, 2.2, 2.3, 0);
  const p2 = mesh(new THREE.BoxGeometry(0.7, 4.6, 0.7), arch, -2.2, 2.3, 0);
  g.add(p1, p2);
  const top = mesh(new THREE.BoxGeometry(5.6, 0.7, 0.9), arch, 0, 4.7, 0);
  g.add(top);
  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 28),
    new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  portal.position.set(0, 2.4, 0);
  g.add(portal);
  g.userData.portal = portal;
  const light = new THREE.PointLight(0x7c3aed, 10, 16, 1.8);
  light.position.set(0, 2.4, 0);
  g.add(light);
  g.traverse((o) => {
    o.userData.selectable = true;
  });
  return g;
}

// ---------------------------- محیط ----------------------------

export function buildTree(): THREE.Group {
  const g = new THREE.Group();
  const bark = mat(0x51402f, { roughness: 0.96 });
  const trunk = mesh(new THREE.CylinderGeometry(0.16, 0.31, 1.55, 7), bark, 0, 0.77, 0);
  trunk.rotation.z = 0.025;
  g.add(trunk);

  // Asymmetric faceted crowns replace the stacked perfect cones.
  const leafMat = mat(0x365d31, { roughness: 0.98 });
  const lower = mesh(new THREE.IcosahedronGeometry(1, 1), leafMat, 0, 2.05, 0);
  lower.scale.set(1.12, 0.92, 1.02);
  lower.rotation.y = 0.35;
  g.add(lower);
  const upper = mesh(new THREE.DodecahedronGeometry(0.78, 0), leafMat, 0.08, 2.78, -0.04);
  upper.scale.set(0.95, 1.12, 0.9);
  upper.rotation.set(0.06, 0.7, -0.04);
  g.add(upper);

  // Uneven secondary crowns and exposed boughs break the repeated two-cone silhouette.
  const leafDark = mat(0x28472a, { roughness: 0.99 });
  const leafLight = mat(0x4a6b39, { roughness: 0.98 });
  const clusters: [number, number, number, number, number, number][] = [
    [-0.58, 1.82, 0.08, 0.52, 0.64, 0.5],
    [0.55, 1.96, -0.1, 0.48, 0.6, 0.46],
    [-0.22, 2.55, -0.46, 0.42, 0.52, 0.42],
    [0.42, 2.42, 0.34, 0.4, 0.5, 0.38],
  ];
  clusters.forEach(([x, y, z, sx, sy, sz], i) => {
    const crown = mesh(new THREE.IcosahedronGeometry(0.62, 1), i % 2 ? leafDark : leafLight, x, y, z);
    crown.scale.set(sx, sy, sz);
    crown.rotation.set(0.1 * i, 0.73 * i, -0.08 * i);
    g.add(crown);
  });
  for (const side of [-1, 1]) {
    const branch = mesh(new THREE.CylinderGeometry(0.055, 0.1, 0.82, 6), bark, side * 0.32, 1.55, 0.02);
    branch.rotation.z = side * -0.82;
    branch.rotation.x = side * 0.12;
    g.add(branch);
  }
  // Root flares anchor the tree visually into the ground instead of making it float.
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const root = mesh(new THREE.CylinderGeometry(0.025, 0.11, 0.55, 5), bark,
      Math.cos(a) * 0.25, 0.22, Math.sin(a) * 0.25);
    root.rotation.z = Math.cos(a) * 0.62;
    root.rotation.x = Math.sin(a) * 0.62;
    g.add(root);
  }
  return g;
}

export function buildRock(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const rockMat = mat(0x77766f, { roughness: 0.98 });
  const rockLight = mat(0x929087, { roughness: 0.99 });
  const rockDark = mat(0x595a58, { roughness: 1 });
  const r = mesh(new THREE.IcosahedronGeometry(0.7, 1), rockMat, 0, 0.35, 0);
  r.rotation.set(Math.random() * 0.9, Math.random() * 3, Math.random() * 0.9);
  r.scale.set(1.0 * scale, 0.72 * scale, 0.9 * scale);
  g.add(r);
  const chipA = mesh(new THREE.DodecahedronGeometry(0.36, 0), rockLight, 0.38 * scale, 0.28 * scale, 0.1 * scale);
  chipA.rotation.set(0.4, 0.7, 0.25);
  chipA.scale.set(1.1, 0.7, 0.8);
  g.add(chipA);
  const chipB = mesh(new THREE.DodecahedronGeometry(0.3, 0), rockDark, -0.28 * scale, 0.2 * scale, -0.2 * scale);
  chipB.rotation.set(-0.3, 1.2, 0.5);
  chipB.scale.set(0.9, 0.65, 1.1);
  g.add(chipB);
  return g;
}

export function buildHouse(ruined = false): THREE.Group {
  const g = new THREE.Group();
  const wall = mat(0xd6cdb8, { roughness: 0.9 });
  const roof = mat(0x9c4a3a, { roughness: 0.85 });
  if (ruined) {
    // ویرانه — دیوارهای شکسته
    g.add(mesh(new THREE.BoxGeometry(2.2, 1.0, 0.25), wall, 0, 0.5, -0.9));
    g.add(mesh(new THREE.BoxGeometry(0.25, 0.8, 1.8), wall, -1.0, 0.4, 0.2));
    g.add(mesh(new THREE.BoxGeometry(0.25, 0.5, 1.4), wall, 1.0, 0.25, 0.2));
    const rubble = mesh(new THREE.DodecahedronGeometry(0.5, 0), mat(0x8a8578, { roughness: 1 }), 0.3, 0.25, 0.4);
    rubble.rotation.set(1.2, 0.4, 0.7);
    g.add(rubble);
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), mat(0x6b655a), -0.5, 0.15, 0.6));
    return g;
  }
  g.add(mesh(new THREE.BoxGeometry(2.4, 1.6, 2), wall, 0, 0.8, 0));
  const r = mesh(new THREE.ConeGeometry(2, 1.2, 4), roof, 0, 2.2, 0);
  r.rotation.y = Math.PI / 4;
  g.add(r);
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), mat(0x5d4a36), 0, 0.45, 1.02));
  return g;
}

/** کاج — جنگل/توندرا */
export function buildPineTree(snowy = false): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.2, 6), mat(0x4a3a2a), 0, 0.6, 0));
  const needle = snowy ? mat(0x7a9a8a, { roughness: 0.95 }) : mat(0x2d5a30, { roughness: 0.95 });
  const lowerCrown = mesh(new THREE.ConeGeometry(1.0, 1.5, 9), needle, 0, 1.9, 0);
  lowerCrown.rotation.y = 0.18;
  g.add(lowerCrown);
  const middleCrown = mesh(new THREE.ConeGeometry(0.72, 1.2, 8), needle, 0.06, 2.7, -0.03);
  middleCrown.rotation.y = 0.53;
  g.add(middleCrown);
  const upperCrown = mesh(new THREE.ConeGeometry(0.45, 0.9, 7), needle, -0.04, 3.4, 0.04);
  upperCrown.rotation.y = 0.28;
  g.add(upperCrown);
  // Broad irregular boughs soften the geometric tiers without adding tiny noisy leaves.
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const bough = mesh(new THREE.IcosahedronGeometry(0.42, 1), needle,
      Math.cos(a) * 0.52, 1.55 + (i % 2) * 0.38, Math.sin(a) * 0.52);
    bough.scale.set(1.0, 0.42, 0.82);
    bough.rotation.y = a;
    g.add(bough);
  }
  if (snowy) {
    g.add(mesh(new THREE.ConeGeometry(0.5, 0.5, 7), mat(0xe8f0f4, { roughness: 0.8 }), 0, 3.75, 0));
    g.add(mesh(new THREE.ConeGeometry(0.8, 0.55, 7), mat(0xe8f0f4, { roughness: 0.8 }), 0, 2.95, 0));
  }
  return g;
}

/** درخت مرده — آتشفشان/دژ */
export function buildDeadTree(): THREE.Group {
  const g = new THREE.Group();
  const bark = mat(0x2a221c, { roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.24, 1.7, 5), bark, 0, 0.85, 0));
  const b1 = mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.9, 5), bark, 0.3, 1.7, 0);
  b1.rotation.z = -0.7;
  g.add(b1);
  const b2 = mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.8, 5), bark, -0.28, 1.5, 0.1);
  b2.rotation.z = 0.8;
  g.add(b2);
  const b3 = mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.6, 5), bark, 0.05, 2.0, -0.12);
  b3.rotation.x = -0.5;
  g.add(b3);
  return g;
}

/** آقال فلزی — ویرانه‌های ماشین */
export function buildDebris(): THREE.Group {
  const g = new THREE.Group();
  const metal = mat(0x4a4f58, { metalness: 0.7, roughness: 0.5 });
  const plate = mesh(new THREE.BoxGeometry(1.6, 0.18, 1.1), metal, 0, 0.3, 0);
  plate.rotation.set(0.12, 0.5, 0.08);
  g.add(plate);
  const beam = mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), metal, 0.5, 0.7, -0.2);
  beam.rotation.z = 0.35;
  g.add(beam);
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 7), mat(0x3a3f45), -0.4, 0.25, 0.3));
  g.add(mesh(new THREE.SphereGeometry(0.09, 6, 6), glow(0x38bdf8), 0.2, 0.48, 0.2));
  return g;
}

/** سنگ سیاه آتشفشانی */
export function buildObsidianRock(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const obsidian = mat(0x15121b, { roughness: 0.3, metalness: 0.28 });
  const r = mesh(new THREE.IcosahedronGeometry(0.7, 1), obsidian, 0, 0.35, 0);
  r.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.6);
  r.scale.set(1.05 * scale, 0.78 * scale, 0.92 * scale);
  g.add(r);

  // Replace the isolated bright dot with restrained, embedded magma fissures.
  const fissure = new THREE.MeshStandardMaterial({
    color: 0x7a301c, emissive: 0xf97316, emissiveIntensity: 0.38,
    roughness: 0.72, metalness: 0.08,
  });
  const cracks: [number, number, number, number, number, number][] = [
    [0.16, 0.48, 0.43, 0.34, 0.035, 0.025],
    [-0.12, 0.32, 0.48, 0.22, 0.028, 0.022],
    [0.29, 0.25, 0.34, 0.19, 0.026, 0.02],
  ];
  cracks.forEach(([x, y, z, w, h, d], i) => {
    const crack = mesh(new THREE.BoxGeometry(w * scale, h * scale, d * scale), fissure,
      x * scale, y * scale, z * scale);
    crack.rotation.z = (i - 1) * 0.34;
    crack.rotation.y = (i - 1) * 0.18;
    g.add(crack);
  });
  return g;
}

export function buildCrystal(color = 0x22d3ee): THREE.Group {
  const g = new THREE.Group();
  const crystal = new THREE.MeshPhysicalMaterial({
    color, emissive: color, emissiveIntensity: 0.42,
    roughness: 0.24, metalness: 0.08, clearcoat: 0.72, clearcoatRoughness: 0.18,
  });
  const deepFacet = mat(new THREE.Color(color).multiplyScalar(0.28).getHex(), { roughness: 0.32, metalness: 0.18 });
  const base = mesh(new THREE.DodecahedronGeometry(0.42, 0), deepFacet, 0, 0.18, 0);
  base.scale.set(1.3, 0.55, 1.15);
  g.add(base);
  const main = mesh(new THREE.OctahedronGeometry(0.42, 1), crystal, 0, 0.95, 0);
  main.scale.set(0.82, 1.9, 0.72);
  main.rotation.set(0.04, 0.2, 0.08);
  g.add(main);
  const sideA = mesh(new THREE.OctahedronGeometry(0.28, 0), crystal, 0.34, 0.48, 0.08);
  sideA.scale.set(0.72, 1.45, 0.72);
  sideA.rotation.z = -0.22;
  g.add(sideA);
  const sideB = mesh(new THREE.OctahedronGeometry(0.24, 0), deepFacet, -0.3, 0.42, -0.12);
  sideB.scale.set(0.7, 1.25, 0.68);
  sideB.rotation.z = 0.24;
  g.add(sideB);
  const vein = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.12,
  });
  const crackA = mesh(new THREE.BoxGeometry(0.045, 0.62, 0.035), vein, 0.08, 0.72, 0.33);
  crackA.rotation.z = -0.16;
  g.add(crackA);
  const crackB = mesh(new THREE.BoxGeometry(0.035, 0.42, 0.03), vein, -0.12, 0.48, 0.28);
  crackB.rotation.z = 0.2;
  g.add(crackB);
  return g;
}

export function buildMountain(style: 'normal' | 'snow' | 'dark' | 'obsidian' = 'normal'): THREE.Group {
  const g = new THREE.Group();
  const tint = style === 'dark' ? 0x392a27 : style === 'obsidian' ? 0x211b2b : style === 'snow' ? 0x687d8c : 0x626d78;
  const rock = mat(tint, { roughness: 0.96, metalness: style === 'obsidian' ? 0.08 : 0.015 });

  // Angular rock masses form an irregular ridge instead of a repeated perfect cone.
  const main = mesh(new THREE.IcosahedronGeometry(1, 1), rock, 0, 5.0, 0);
  main.scale.set(8.8, 7.6, 7.2);
  main.rotation.set(0.03, 0.2, -0.025);
  g.add(main);

  const shoulder = mesh(new THREE.DodecahedronGeometry(1, 0), rock, -5.6, 3.0, -0.5);
  shoulder.scale.set(5.1, 4.1, 5.8);
  shoulder.rotation.y = 0.48;
  g.add(shoulder);

  const farPeak = mesh(new THREE.DodecahedronGeometry(1, 0), rock, 5.2, 3.7, -1.4);
  farPeak.scale.set(4.7, 5.0, 4.5);
  farPeak.rotation.set(0.04, -0.38, 0.02);
  g.add(farPeak);

  if (style === 'normal' || style === 'snow') {
    const snowMat = mat(style === 'snow' ? 0xd9e8ef : 0xbcc8d0, { roughness: 0.82 });
    const cap = mesh(new THREE.IcosahedronGeometry(1, 0), snowMat, 0.15, 10.1, 0.2);
    cap.scale.set(3.1, 2.3, 2.8);
    cap.rotation.set(0.05, 0.3, -0.08);
    g.add(cap);
    const ledges: [number, number, number, number, number, number][] = [
      [-4.4, 5.7, 6.0, 2.8, 0.22, 1.05],
      [3.7, 6.6, 5.9, 2.2, 0.18, 0.9],
      [0.1, 8.1, 5.3, 1.6, 0.16, 0.8],
    ];
    ledges.forEach(([x, y, z, sx, sy, sz], i) => {
      const shelf = mesh(new THREE.IcosahedronGeometry(1, 0), snowMat, x, y, z);
      shelf.scale.set(sx, sy, sz);
      shelf.rotation.set(0.04 * i, 0.3 * i, -0.08 * i);
      g.add(shelf);
    });
  } else {
    const strataMat = mat(style === 'obsidian' ? 0x14121b : 0x2b2222, { roughness: 0.98, metalness: 0.04 });
    const strata = [
      [-4.8, 2.25, 5.8, 3.1, 0.22, 1.0],
      [3.9, 3.0, 5.8, 2.5, 0.18, 0.85],
      [0.4, 4.1, 5.4, 3.6, 0.16, 0.75],
    ];
    strata.forEach(([x, y, z, sx, sy, sz], i) => {
      const band = mesh(new THREE.IcosahedronGeometry(1, 0), strataMat, x, y, z);
      band.scale.set(sx, sy, sz);
      band.rotation.set(0.05 * i, 0.2 * i, 0.04 * i);
      g.add(band);
    });
  }

  // No isolated emissive dots on distant mountains: biome colour comes from
  // the material and lighting, keeping the horizon cinematic rather than noisy.
  return g;
}
