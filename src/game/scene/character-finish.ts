import * as THREE from 'three';

/**
 * Shared character finishing pass for the in-engine fantasy roster.
 * These are real low-poly 3D meshes with PBR-compatible materials; they are
 * intentionally lightweight for mobile rendering. This is not a replacement
 * for authored skinned GLB assets, but gives every existing archetype a more
 * deliberate silhouette, material breakup, and readable focal details.
 */
const pbr = (color: number, metalness = 0.25, roughness = 0.48) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

const energy = (color: number) =>
  new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.35,
    roughness: 0.22,
    metalness: 0.18,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  });

function part(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

const HERO_ACCENTS: Record<string, number> = {
  arman: 0xffb020, aria: 0x67e8f9, nila: 0xc084fc, radin: 0xf87171,
  kaelan: 0xfbbf24, yara: 0x22d3ee, veyra: 0xf472b6, borin: 0x94a3b8,
  soren: 0xa78bfa, darya: 0x4ade80, kaveh: 0xfb923c, nyx: 0xc084fc,
};

export function finishHeroModel(root: THREE.Group, heroId: string) {
  const accent = HERO_ACCENTS[heroId] ?? 0xffb020;
  const steel = pbr(0x29313e, 0.82, 0.27);
  const edge = pbr(0xb9c4d2, 0.86, 0.22);
  const leather = pbr(0x392b27, 0.08, 0.88);
  const rune = energy(accent);

  // Segmented front cuirass, bevel-like edge and a pair of small fasteners.
  const width = heroId === 'borin' || heroId === 'radin' ? 0.48 : 0.36;
  const breast = part(new THREE.BoxGeometry(width, 0.22, 0.075), steel, [0, 1.08, 0.285]);
  breast.rotation.z = heroId === 'nyx' ? -0.08 : 0;
  root.add(breast);
  root.add(part(new THREE.BoxGeometry(width * 0.84, 0.035, 0.025), edge, [0, 1.19, 0.328]));
  root.add(part(new THREE.OctahedronGeometry(0.075, 0), rune, [0, 1.08, 0.34]));

  // Layered shoulder guards with metallic rims and rivets.
  for (const side of [-1, 1]) {
    const x = side * (heroId === 'radin' || heroId === 'borin' ? 0.49 : 0.36);
    const pauldron = part(new THREE.SphereGeometry(heroId === 'radin' ? 0.27 : 0.205, 12, 10), steel, [x, 1.42, 0]);
    pauldron.scale.set(1.18, 0.78, 0.9);
    root.add(pauldron);
    const rim = part(new THREE.TorusGeometry(heroId === 'radin' ? 0.23 : 0.17, 0.018, 5, 14), edge, [x, 1.43, 0.095]);
    rim.rotation.x = Math.PI / 2;
    root.add(rim);
    root.add(part(new THREE.SphereGeometry(0.032, 7, 6), rune, [x, 1.45, 0.18]));

    // Bracers and segmented knee caps add visible shape language at isometric scale.
    const bracer = part(new THREE.CylinderGeometry(0.105, 0.12, 0.26, 8), leather, [side * 0.39, 0.94, 0.04]);
    bracer.rotation.z = side * -0.12;
    root.add(bracer);
    const cuff = part(new THREE.CylinderGeometry(0.112, 0.112, 0.055, 8), edge, [side * 0.39, 1.075, 0.04]);
    cuff.rotation.z = side * -0.12;
    root.add(cuff);
    const knee = part(new THREE.BoxGeometry(0.18, 0.13, 0.07), steel, [side * 0.17, 0.48, 0.115]);
    knee.rotation.z = side * -0.08;
    root.add(knee);
    root.add(part(new THREE.SphereGeometry(0.022, 6, 5), edge, [side * 0.17, 0.49, 0.155]));
  }

  // Belt hardware, side pouches and stitched leather straps.
  root.add(part(new THREE.CylinderGeometry(0.32, 0.32, 0.085, 12), leather, [0, 0.73, 0]));
  root.add(part(new THREE.BoxGeometry(0.12, 0.13, 0.04), edge, [0, 0.74, 0.32]));
  for (const side of [-1, 1]) {
    const pouch = part(new THREE.BoxGeometry(0.12, 0.16, 0.12), leather, [side * 0.31, 0.72, 0.12]);
    pouch.rotation.z = side * -0.12;
    root.add(pouch);
    root.add(part(new THREE.BoxGeometry(0.13, 0.025, 0.13), edge, [side * 0.31, 0.79, 0.12]));
  }

  // Three small orbiting relic fragments are static accents; gameplay owns animation.
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const shard = part(new THREE.TetrahedronGeometry(0.045), rune, [
      Math.cos(angle) * 0.19, 1.29 + Math.sin(angle) * 0.045, 0.30,
    ]);
    shard.rotation.set(angle * 0.4, angle, angle * 0.2);
    root.add(shard);
  }

  root.userData.pbrFinishApplied = true;
}

const ENEMY_ACCENTS: Record<string, number> = {
  warrior: 0xf87171, golem: 0xf59e0b, golemKing: 0xfb7185, warlock: 0xa78bfa,
  shadowSoldier: 0xc084fc, hunter: 0xfb923c, boneReaver: 0xe5e7eb,
  plagueHound: 0x84cc16, voidArcher: 0x8b5cf6, ironBrute: 0x94a3b8,
  frostWraith: 0x7dd3fc, emberDrake: 0xf97316, hexPriest: 0xc084fc,
  abyssBehemoth: 0xef4444, darkLord: 0xa855f7,
};

export function finishEnemyModel(root: THREE.Group, enemyId: string) {
  const accent = ENEMY_ACCENTS[enemyId] ?? 0x38bdf8;
  const metal = pbr(0x242a35, 0.8, 0.3);
  const edge = pbr(0xaeb9c8, 0.84, 0.24);
  const rune = energy(accent);

  // Keep this pass for humanoids and bosses only; beast and machine silhouettes
  // already have their own dedicated geometry in models.ts.
  const humanoid = [
    'warrior', 'golem', 'golemKing', 'warlock', 'shadowSoldier', 'hunter',
    'boneReaver', 'voidArcher', 'hexPriest', 'abyssBehemoth', 'darkLord',
  ].includes(enemyId);
  if (!humanoid) return;

  for (const side of [-1, 1]) {
    const shoulderX = side * (enemyId === 'golemKing' || enemyId === 'abyssBehemoth' ? 0.63 : 0.36);
    const shoulder = part(new THREE.DodecahedronGeometry(enemyId === 'golemKing' ? 0.25 : 0.17, 0), metal, [shoulderX, 1.42, 0]);
    shoulder.scale.set(1.05, 0.72, 0.78);
    root.add(shoulder);
    root.add(part(new THREE.SphereGeometry(0.035, 7, 6), edge, [shoulderX, 1.46, 0.15]));

    const knee = part(new THREE.BoxGeometry(0.17, 0.16, 0.08), metal, [side * 0.16, 0.46, 0.12]);
    knee.rotation.z = side * -0.1;
    root.add(knee);
    root.add(part(new THREE.BoxGeometry(0.2, 0.045, 0.035), edge, [side * 0.16, 0.52, 0.16]));
  }

  // Chest crest and segmented waist guard make enemy tiers more readable.
  const chestZ = enemyId === 'golem' || enemyId === 'golemKing' ? 0.45 : 0.245;
  const chest = part(new THREE.BoxGeometry(enemyId === 'abyssBehemoth' ? 0.65 : 0.38, 0.22, 0.07), metal, [0, 1.08, chestZ]);
  root.add(chest);
  root.add(part(new THREE.OctahedronGeometry(enemyId === 'abyssBehemoth' ? 0.17 : 0.09), rune, [0, 1.1, chestZ + 0.06]));
  root.add(part(new THREE.BoxGeometry(0.42, 0.09, 0.1), metal, [0, 0.73, 0.02]));
  root.add(part(new THREE.BoxGeometry(0.16, 0.1, 0.045), edge, [0, 0.73, 0.1]));

  if (enemyId === 'darkLord' || enemyId === 'golemKing' || enemyId === 'abyssBehemoth') {
    const halo = part(new THREE.TorusGeometry(0.62, 0.028, 6, 24), rune, [0, 2.5, -0.12]);
    halo.rotation.x = Math.PI / 2;
    root.add(halo);
    for (let i = -1; i <= 1; i++) {
      const crest = part(new THREE.ConeGeometry(0.065, 0.28, 5), edge, [i * 0.16, 2.65, -0.02]);
      crest.rotation.z = -i * 0.3;
      root.add(crest);
    }
  }

  root.userData.pbrFinishApplied = true;
}
