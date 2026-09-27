import * as THREE from 'three';
import type { LevelData } from '../data/types';
import { buildCoreMesh, buildRiftMesh, buildTree, buildRock, buildHouse, buildCrystal, buildMountain } from './models';

// ============================================================
// صحنه نبرد — زمین، مسیر دشمن (Curve)، هسته آذر، دروازه، محیط
// ============================================================

export class BattleScene {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  curve: THREE.CatmullRomCurve3;
  pathPoints: THREE.Vector3[] = []; // نقاط نمونه‌برداری برای اعتبارسنجی ساخت
  pathLength = 0;
  coreMesh: THREE.Group;
  riftMesh: THREE.Group;
  corePos: THREE.Vector3;
  riftPos: THREE.Vector3;
  private decorSpinners: { obj: THREE.Object3D; speed: number }[] = [];
  private portalPulse = 0;
  private quality: 'low' | 'medium' | 'high' | 'ultra' = 'medium';

  constructor(canvas: HTMLCanvasElement, level: LevelData, quality: 'low' | 'medium' | 'high' | 'ultra') {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality === 'high' || quality === 'ultra',
      powerPreference: 'high-performance',
    });
    const pixelRatio = quality === 'low' ? 1 : quality === 'medium' ? Math.min(1.5, window.devicePixelRatio) : Math.min(2, window.devicePixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // آسمان و مه
    const night = level.timeOfDay === 'night';
    this.scene.background = new THREE.Color(night ? 0x0a0d1a : 0x87b5d9);
    this.scene.fog = new THREE.Fog(night ? 0x0a0d1a : 0xa9c8e0, 60, 150);

    // نورپردازی
    const hemi = new THREE.HemisphereLight(night ? 0x334466 : 0xbfd9ff, night ? 0x1a1a24 : 0x3f6b3f, night ? 0.7 : 1.0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(night ? 0x8899ff : 0xfff2d9, night ? 0.8 : 1.6);
    sun.position.set(-30, 45, -20);
    if (this.renderer.shadowMap.enabled) {
      sun.castShadow = true;
      const shadowSize = quality === 'ultra' ? 2048 : 1024;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      sun.shadow.camera.left = -55;
      sun.shadow.camera.right = 55;
      sun.shadow.camera.top = 55;
      sun.shadow.camera.bottom = -55;
      sun.shadow.camera.far = 130;
      sun.shadow.bias = -0.0004;
    }
    this.scene.add(sun);

    // زمین
    this.buildGround(night);

    // مسیر
    const pts = level.path.map((p) => new THREE.Vector3(p.x, 0, p.z));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.12);
    this.pathLength = this.curve.getLength();
    this.pathPoints = this.curve.getSpacedPoints(Math.max(40, Math.floor(this.pathLength / 1.5)));
    this.buildPathMesh(night);

    // هسته آذر (انتهای مسیر)
    this.corePos = pts[pts.length - 1].clone();
    this.coreMesh = buildCoreMesh();
    this.coreMesh.position.set(this.corePos.x, 0, this.corePos.z);
    this.scene.add(this.coreMesh);

    // دروازه تاریکی (شروع مسیر)
    this.riftPos = pts[0].clone();
    this.riftMesh = buildRiftMesh();
    const dir = pts[1].clone().sub(pts[0]).normalize();
    this.riftMesh.position.set(this.riftPos.x, 0, this.riftPos.z);
    this.riftMesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.scene.add(this.riftMesh);

    // محیط
    this.buildEnvironment(level, pts, night);
  }

  // ------------------- زمین -------------------

  private buildGround(night: boolean) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const base = night ? '#22301f' : '#4d7a3e';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    const rnd = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
    };
    const r = rnd(12345);
    for (let i = 0; i < 1400; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const tone = 0.85 + r() * 0.3;
      ctx.fillStyle = night
        ? `rgba(${30 * tone},${45 * tone},${28 * tone},0.5)`
        : `rgba(${70 * tone},${115 * tone},${55 * tone},0.5)`;
      ctx.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.colorSpace = THREE.SRGBColorSpace;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = this.renderer.shadowMap.enabled;
    this.scene.add(ground);
  }

  // ------------------- مسیر -------------------

  private buildPathMesh(night: boolean) {
    const width = 3.2;
    const pts = this.pathPoints;
    const segs = pts.length - 1;

    // هر سگمنت یک کوارت مستقل — بدون تاخوردگی در پیچ‌ها
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vi = 0;
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dir = b.clone().sub(a).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width);
      const y = 0.05 + (i % 2) * 0.006; // جلوگیری از z-fighting در همپوشانی
      // چهار راس کوارت
      positions.push(
        a.x + side.x, y, a.z + side.z,
        a.x - side.x, y, a.z - side.z,
        b.x + side.x, y, b.z + side.z,
        b.x - side.x, y, b.z - side.z
      );
      uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
      indices.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
      vi += 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ color: night ? 0x4a4438 : 0x8f8570, roughness: 1 });
    const pathMesh = new THREE.Mesh(geo, mat);
    pathMesh.receiveShadow = this.renderer.shadowMap.enabled;
    this.scene.add(pathMesh);

    // دیسک‌های اتصال در پیچ‌ها — پوشش گوشه‌ها
    const discPositions: number[] = [];
    const discIndices: number[] = [];
    let dvi = 0;
    const SIDES = 10;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const y = 0.048;
      for (let s = 0; s < SIDES; s++) {
        const a1 = (s / SIDES) * Math.PI * 2;
        const a2 = ((s + 1) / SIDES) * Math.PI * 2;
        discPositions.push(p.x, y, p.z);
        discPositions.push(p.x + Math.cos(a1) * width, y, p.z + Math.sin(a1) * width);
        discPositions.push(p.x + Math.cos(a2) * width, y, p.z + Math.sin(a2) * width);
        discIndices.push(dvi, dvi + 2, dvi + 1); // winding صحیح رو به بالا
        dvi += 3;
      }
    }
    const discGeo = new THREE.BufferGeometry();
    discGeo.setAttribute('position', new THREE.Float32BufferAttribute(discPositions, 3));
    discGeo.setIndex(discIndices);
    discGeo.computeVertexNormals();
    const discMesh = new THREE.Mesh(discGeo, mat);
    discMesh.receiveShadow = this.renderer.shadowMap.enabled;
    this.scene.add(discMesh);

    // سنگ‌فرش کنار مسیر + نشانگرهای جادویی
    for (let i = 0; i < pts.length; i += 6) {
      const p = pts[i];
      const rune = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 6),
        new THREE.MeshBasicMaterial({ color: night ? 0x4c1d95 : 0x7c5cd6, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(p.x, 0.09, p.z);
      this.scene.add(rune);
    }
  }

  // ------------------- محیط -------------------

  private buildEnvironment(level: LevelData, pathPts: THREE.Vector3[], night: boolean) {
    const nearPath = (x: number, z: number, min: number) => {
      for (const p of this.pathPoints) {
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < min * min) return true;
      }
      return false;
    };
    const rnd = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
    };
    const r = rnd(777);

    // کوه‌های دور
    for (let i = 0; i < 7; i++) {
      const m = buildMountain();
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const dist = 62 + r() * 14;
      m.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      m.rotation.y = r() * Math.PI;
      m.scale.setScalar(0.8 + r() * 0.9);
      this.scene.add(m);
    }

    // درختان
    const treeCount = this.quality === 'low' ? 26 : 44;
    for (let i = 0; i < treeCount; i++) {
      const x = (r() - 0.5) * 66;
      const z = (r() - 0.5) * 66;
      if (nearPath(x, z, 4.5)) continue;
      if (Math.hypot(x - this.corePos.x, z - this.corePos.z) < 7) continue;
      const tree = buildTree();
      tree.position.set(x, 0, z);
      tree.scale.setScalar(0.7 + r() * 0.8);
      tree.rotation.y = r() * Math.PI;
      this.scene.add(tree);
    }

    // سنگ‌ها
    for (let i = 0; i < 20; i++) {
      const x = (r() - 0.5) * 64;
      const z = (r() - 0.5) * 64;
      if (nearPath(x, z, 4)) continue;
      const rock = buildRock(0.5 + r());
      rock.position.set(x, 0, z);
      this.scene.add(rock);
    }

    // روستا — کنار مسیر (حس دشت سبز)
    const houseSpots = [
      { x: -20, z: -8 }, { x: -23, z: -12 }, { x: 4, z: -8 }, { x: 8, z: 14 }, { x: 4, z: 18 },
    ];
    for (const s of houseSpots) {
      const h = buildHouse();
      h.position.set(s.x, 0, s.z);
      h.rotation.y = r() * Math.PI * 2;
      this.scene.add(h);
    }

    // کریستال‌های جادویی درخشان (سایه‌روشن فانتزی-مدرن)
    const crystalSpots = [
      { x: -12, z: 12 }, { x: 28, z: -14 }, { x: -26, z: 20 }, { x: 26, z: 10 },
    ];
    for (const s of crystalSpots) {
      const c = buildCrystal(night ? 0xa855f7 : 0x22d3ee);
      c.position.set(s.x, 0, s.z);
      c.scale.setScalar(0.8 + r() * 0.5);
      this.scene.add(c);
      this.decorSpinners.push({ obj: c, speed: 0.5 + r() });
      const l = new THREE.PointLight(0x22d3ee, night ? 6 : 3, 8, 1.8);
      l.position.set(s.x, 1.4, s.z);
      this.scene.add(l);
    }

    void level;
    void pathPts;
  }

  // ------------------- اعتبارسنجی محل ساخت برج -------------------

  canBuild(x: number, z: number, towerPositions: THREE.Vector3[]): boolean {
    if (Math.abs(x) > 32 || Math.abs(z) > 32) return false;
    // فاصله از مسیر
    for (const p of this.pathPoints) {
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < 3.9 ** 2) return false;
    }
    // فاصله از هسته و دروازه
    if (Math.hypot(x - this.corePos.x, z - this.corePos.z) < 5.5) return false;
    if (Math.hypot(x - this.riftPos.x, z - this.riftPos.z) < 5.5) return false;
    // همپوشانی با برج‌های دیگر
    for (const t of towerPositions) {
      if (Math.hypot(x - t.x, z - t.z) < 3.8) return false;
    }
    return true;
  }

  // ------------------- بروزرسانی انیمیشن محیط -------------------

  update(dt: number) {
    // هسته آذر — نبض و چرخش
    const core = this.coreMesh.userData;
    if (core.core) {
      core.core.rotation.y += dt * 0.6;
      const pulse = 1 + Math.sin(performance.now() * 0.002) * 0.05;
      core.core.scale.set(pulse, 1.5 * pulse, pulse);
    }
    if (core.ring1) core.ring1.rotation.z += dt * 0.5;
    if (core.ring2) core.ring2.rotation.z -= dt * 0.35;

    // دروازه تاریکی — تپش
    this.portalPulse += dt;
    const portal = this.riftMesh.userData.portal as THREE.Mesh | undefined;
    if (portal) {
      const m = portal.material as THREE.MeshBasicMaterial;
      m.opacity = 0.45 + Math.sin(this.portalPulse * 3) * 0.15;
      portal.rotation.z += dt * 1.2;
    }

    // کریستال‌های محیط
    for (const d of this.decorSpinners) {
      d.obj.rotation.y += dt * d.speed * 0.4;
    }
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
  }

  render(camera: THREE.PerspectiveCamera) {
    this.renderer.render(this.scene, camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
