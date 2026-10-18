import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ============================================================
// ادغام دکور استاتیک — کاهش درا-کال روی موبایل
// ------------------------------------------------------------
// درختان/سنگ‌ها/سازه‌ها قبلاً هرکدام ۳-۶ مش جدا بودند
// (۶۰ درخت ≈ ۲۵۰ درا-کال!). این ابزار همه را پس از بیک-کردن
// ماتریس جهانی، به‌ازای هر متریال در یک مش ادغام می‌کند
// → کل دکور صحنه ≈ ۱۰-۱۵ درا-کال.
// گروه‌های ورودی به صحنه اضافه نمی‌شوند (فقط بیک می‌شوند).
// ============================================================

const BAKE = new THREE.Matrix4();

export function mergeDecorGroups(
  groups: THREE.Object3D[],
  opts?: { castShadow?: boolean; receiveShadow?: boolean }
): THREE.Mesh[] {
  const byMat = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();

  // Many procedural props create equivalent material instances independently.
  // Group by render-relevant properties, not object identity, so batching actually works.
  const materialKey = (material: THREE.Material) => {
    const m = material as THREE.MeshStandardMaterial;
    return [
      material.type,
      m.color?.getHexString() ?? '',
      m.emissive?.getHexString() ?? '',
      m.roughness ?? '',
      m.metalness ?? '',
      m.emissiveIntensity ?? '',
      m.opacity ?? '',
      m.transparent ?? '',
      m.side ?? '',
      m.depthWrite ?? '',
      m.map?.uuid ?? '',
      m.normalMap?.uuid ?? '',
      m.roughnessMap?.uuid ?? '',
      m.metalnessMap?.uuid ?? '',
      (m as THREE.MeshPhysicalMaterial).clearcoat ?? '',
      (m as THREE.MeshPhysicalMaterial).transmission ?? '',
    ].join('|');
  };

  for (const root of groups) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || !me.geometry) return;
      const mats = Array.isArray(me.material) ? me.material : [me.material];
      if (mats.length !== 1) return; // دکور چندمتریالی نداریم
      // یکنواخت‌سازی: همه non-indexed با position/normal/uv — شرط mergeGeometries
      let geo = me.geometry.clone();
      if (geo.index) geo = geo.toNonIndexed();
      for (const key of Object.keys(geo.attributes)) {
        if (key !== 'position' && key !== 'normal' && key !== 'uv') geo.deleteAttribute(key);
      }
      if (!geo.attributes.uv) {
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      }
      geo.applyMatrix4(BAKE.copy(me.matrixWorld));
      const key = materialKey(mats[0]);
      const bucket = byMat.get(key);
      if (bucket) bucket.geos.push(geo);
      else byMat.set(key, { material: mats[0], geos: [geo] });
    });
  }

  const out: THREE.Mesh[] = [];
  for (const { material, geos } of byMat.values()) {
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = opts?.castShadow ?? true;
    mesh.receiveShadow = opts?.receiveShadow ?? true;
    mesh.matrixAutoUpdate = false;
    out.push(mesh);
  }
  return out;
}
