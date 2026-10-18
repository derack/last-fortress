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
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();

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
      const list = byMat.get(mats[0]);
      if (list) list.push(geo);
      else byMat.set(mats[0], [geo]);
    });
  }

  const out: THREE.Mesh[] = [];
  for (const [mat, geos] of byMat) {
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = opts?.castShadow ?? true;
    mesh.receiveShadow = opts?.receiveShadow ?? true;
    mesh.matrixAutoUpdate = false;
    out.push(mesh);
  }
  return out;
}
