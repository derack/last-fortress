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
let environmentSurfaceMaps: { color: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;

function getEnvironmentSurfaceMaps() {
  if (environmentSurfaceMaps || typeof document === 'undefined') return environmentSurfaceMaps;
  const size = 128;
  const make = (bump: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const wave = Math.sin(x / size * Math.PI * 8 + Math.sin(y / size * Math.PI * 4) * 0.65)
        + Math.cos(y / size * Math.PI * 6 + Math.sin(x / size * Math.PI * 2) * 0.4)
        + 0.4 * Math.sin((x + y) / size * Math.PI * 12);
      const v = bump ? 128 + wave * 10 : 238 + wave * 2.8;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.max(0, Math.min(255, v));
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  const colorCanvas = make(false), bumpCanvas = make(true);
  if (!colorCanvas || !bumpCanvas) return null;
  const color = new THREE.CanvasTexture(colorCanvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.colorSpace = THREE.NoColorSpace;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 4;
  environmentSurfaceMaps = { color, bump };
  return environmentSurfaceMaps;
}

function ensureDecorUV(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute('uv')) return;
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  if (!p) return;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = n?.getX(i) ?? 0, ny = n?.getY(i) ?? 0, nz = n?.getZ(i) ?? 0;
    if (Math.abs(ny) > 0.72) { uv[i * 2] = x + 0.5; uv[i * 2 + 1] = z + 0.5; }
    else if (Math.abs(nz) >= Math.abs(nx)) { uv[i * 2] = x + 0.5; uv[i * 2 + 1] = y + 0.5; }
    else { uv[i * 2] = z + 0.5; uv[i * 2 + 1] = y + 0.5; }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function mergeDecorGroups(
  groups: THREE.Object3D[],
  opts?: { castShadow?: boolean; receiveShadow?: boolean }
): THREE.Mesh[] {
  const byMat = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const surfaceMaps = getEnvironmentSurfaceMaps();

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
      m.bumpMap?.uuid ?? '',
      m.bumpScale ?? '',
      m.normalScale?.toArray().join(',') ?? '',
      m.roughnessMap?.uuid ?? '',
      m.metalnessMap?.uuid ?? '',
      m.displacementMap?.uuid ?? '',
      m.displacementScale ?? '',
      m.displacementBias ?? '',
      m.alphaTest ?? '',
      m.wireframe ?? '',
      m.flatShading ?? '',
      m.vertexColors ?? '',
      (m as THREE.MeshPhysicalMaterial).clearcoat ?? '',
      (m as THREE.MeshPhysicalMaterial).clearcoatRoughness ?? '',
      (m as THREE.MeshPhysicalMaterial).ior ?? '',
      (m as THREE.MeshPhysicalMaterial).transmission ?? '',
      (m as THREE.MeshPhysicalMaterial).thickness ?? '',
      (m as THREE.MeshPhysicalMaterial).attenuationDistance ?? '',
      (m as THREE.MeshPhysicalMaterial).attenuationColor?.getHexString() ?? '',
    ].join('|');
  };

  for (const root of groups) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || !me.geometry) return;
      const mats = Array.isArray(me.material) ? me.material : [me.material];
      if (mats.length !== 1) return; // دکور چندمتریالی نداریم
      ensureDecorUV(me.geometry);
      if (surfaceMaps) {
        const standard = mats[0] as THREE.MeshStandardMaterial;
        if (standard.isMeshStandardMaterial) {
          if (!standard.map) standard.map = surfaceMaps.color;
          if (!standard.bumpMap) {
            standard.bumpMap = surfaceMaps.bump;
            standard.bumpScale = standard.roughness > 0.85 ? 0.018 : 0.026;
          }
          standard.needsUpdate = true;
        }
      }
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
