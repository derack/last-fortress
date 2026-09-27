import * as THREE from 'three';
import { TOWERS } from '../data/towers';
import type { EnemyData } from '../data/types';

// ============================================================
// سازنده مدل‌های سه‌بعدی سبک «واقع‌گرایی سبک‌پردازی‌شده»
// برج: پایه فلزی مدرن + هسته کریستالی جادویی (تضاد اصلی بازی)
// هر مدل: Group با userData برای انیمیشن
// ============================================================

const mat = (color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.25, ...opts });

const glow = (color: number) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.1,
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

  // پایه فلزی مشترک — مدرن
  const baseH = 0.9 + lv * 0.12;
  const base = mesh(new THREE.CylinderGeometry(1.5, 1.8, baseH, 8), mat(0x4a4f58, { metalness: 0.7, roughness: 0.4 }), 0, baseH / 2, 0);
  g.add(base);
  const trim = mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.14, 8), mat(0x6b7280, { metalness: 0.8 }), 0, baseH + 0.07, 0);
  g.add(trim);

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
    g.userData.turret = head;
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
    tube.rotation.x = -0.6;
    mortar.add(tube);
    const ember = mesh(new THREE.SphereGeometry(0.3 - lv * 0.02, 8, 8), glow(0xf97316), 0, 0.95, -0.42);
    mortar.add(ember);
    g.add(mortar);
    g.userData.turret = mortar;
    g.userData.ember = ember;
    // مشعل‌های اطراف
    for (const [dx, dz] of [[1.1, 0.6], [-1.1, -0.6]] as const) {
      g.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6), mat(0x2a2521), dx, stoneH + 0.3, dz));
      g.add(mesh(new THREE.SphereGeometry(0.14, 8, 8), glow(0xfbbf24), dx, stoneH + 0.75, dz));
    }
    if (level >= 5) {
      g.add(mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 24), glow(0xf97316), 0, 0.3, 0));
      g.userData.spinRing = g.children[g.children.length - 1];
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
  }

  g.userData.animParts = parts;
  g.scale.setScalar(s);
  g.traverse((o) => {
    o.userData.selectable = true;
  });
  return g;
}

// ---------------------------- قهرمان ----------------------------

export function buildHeroMesh(): THREE.Group {
  const g = new THREE.Group();
  const armor = mat(0x5a5e4a);
  const gold = mat(0xd4a017, { metalness: 0.85, roughness: 0.3 });

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
  g.traverse((o) => {
    o.userData.selectable = true;
  });
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
  const trunk = mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6), mat(0x5d4a36), 0, 0.7, 0);
  g.add(trunk);
  const leafMat = mat(0x3f7d3a, { roughness: 0.95 });
  g.add(mesh(new THREE.ConeGeometry(1.15, 1.7, 7), leafMat, 0, 2.2, 0));
  g.add(mesh(new THREE.ConeGeometry(0.85, 1.3, 7), leafMat, 0, 3.1, 0));
  return g;
}

export function buildRock(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const r = mesh(new THREE.DodecahedronGeometry(0.7, 0), mat(0x8a8578, { roughness: 1 }), 0, 0.35, 0);
  r.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  r.scale.setScalar(scale);
  g.add(r);
  return g;
}

export function buildHouse(): THREE.Group {
  const g = new THREE.Group();
  const wall = mat(0xd6cdb8, { roughness: 0.9 });
  const roof = mat(0x9c4a3a, { roughness: 0.85 });
  g.add(mesh(new THREE.BoxGeometry(2.4, 1.6, 2), wall, 0, 0.8, 0));
  const r = mesh(new THREE.ConeGeometry(2, 1.2, 4), roof, 0, 2.2, 0);
  r.rotation.y = Math.PI / 4;
  g.add(r);
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), mat(0x5d4a36), 0, 0.45, 1.02));
  return g;
}

export function buildCrystal(color = 0x22d3ee): THREE.Group {
  const g = new THREE.Group();
  const cmat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.2, roughness: 0.2, transparent: true, opacity: 0.9,
  });
  const c1 = mesh(new THREE.ConeGeometry(0.3, 1.6, 5), cmat, 0, 0.8, 0);
  c1.rotation.z = 0.1;
  g.add(c1);
  g.add(mesh(new THREE.ConeGeometry(0.2, 1.0, 5), cmat, 0.35, 0.5, 0.1));
  g.add(mesh(new THREE.ConeGeometry(0.16, 0.8, 5), cmat, -0.28, 0.4, -0.15));
  return g;
}

export function buildMountain(): THREE.Group {
  const g = new THREE.Group();
  const m = mat(0x7c8494, { roughness: 1 });
  const peak = mesh(new THREE.ConeGeometry(9, 16, 6), m, 0, 8, 0);
  g.add(peak);
  const snow = mesh(new THREE.ConeGeometry(3, 4.5, 6), mat(0xe8eaf0, { roughness: 0.7 }), 0, 13.5, 0);
  g.add(snow);
  return g;
}
