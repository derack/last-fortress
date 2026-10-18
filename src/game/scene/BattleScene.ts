import * as THREE from 'three';
import type { LevelData, RegionEnv } from '../data/types';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCoreMesh, buildRiftMesh, buildTree, buildRock, buildHouse, buildCrystal, buildMountain, buildPineTree, buildDeadTree, buildDebris, buildObsidianRock } from './models';

// ============================================================
// صحنه نبرد — زمین، مسیر دشمن (Curve)، هسته آذر، دروازه، محیط
// هر منطقه تم محیطی خودش را دارد (بخش محتوای کامل)
// ارتقای بصری: گنبد آسمان گرادیانی، ستاره‌های شب، نور Rim،
// سنگ‌ریزه لبه مسیر، زمین لکه‌دار غنی‌تر
// ============================================================

interface EnvTheme {
  skyDay: number; skyNight: number;
  fogDay: number; fogNight: number;
  groundDay: string; groundNight: string;
  groundDotDay: string; groundDotNight: string;
  pathDay: number; pathNight: number;
  crystal: number;
  treeStyle: 'leafy' | 'pine' | 'dead' | 'none' | 'mixed';
  houses: 'village' | 'none' | 'ruin' | 'debris';
  treeCount: number;
}

/** شبه‌تصادفی قطعی برای جانمایی پایدار دکور */
function rnd2(a: number, b: number): number {
  let s = (a * 7919 + b * 104729 + 12345) % 2147483647;
  if (s <= 0) s += 2147483646;
  return ((s * 16807) % 2147483647) / 2147483647;
}

const ENV_THEMES: Record<RegionEnv, EnvTheme> = {
  plains: {
    skyDay: 0x87b5d9, skyNight: 0x0a0d1a, fogDay: 0xa9c8e0, fogNight: 0x0a0d1a,
    groundDay: '#4d7a3e', groundNight: '#22301f', groundDotDay: '70,115,55', groundDotNight: '30,45,28',
    pathDay: 0x8f8570, pathNight: 0x4a4438, crystal: 0x22d3ee, treeStyle: 'leafy', houses: 'village', treeCount: 44,
  },
  forest: {
    skyDay: 0x4a6b52, skyNight: 0x070b10, fogDay: 0x5d7a64, fogNight: 0x0a1210,
    groundDay: '#2e4a2a', groundNight: '#131f13', groundDotDay: '40,75,38', groundDotNight: '20,38,20',
    pathDay: 0x6b5d4a, pathNight: 0x3a332b, crystal: 0xa855f7, treeStyle: 'pine', houses: 'ruin', treeCount: 60,
  },
  tundra: {
    skyDay: 0xb8d4e8, skyNight: 0x0c1522, fogDay: 0xd8e8f4, fogNight: 0x16222e,
    groundDay: '#c8d8e0', groundNight: '#3a4a58', groundDotDay: '190,205,215', groundDotNight: '70,88,100',
    pathDay: 0x8ca0b0, pathNight: 0x445260, crystal: 0x7dd3fc, treeStyle: 'pine', houses: 'ruin', treeCount: 34,
  },
  volcano: {
    skyDay: 0x3a1f1a, skyNight: 0x140808, fogDay: 0x54261c, fogNight: 0x200a08,
    groundDay: '#3a2a24', groundNight: '#1c1210', groundDotDay: '90,52,40', groundDotNight: '48,28,22',
    pathDay: 0x5a4034, pathNight: 0x302019, crystal: 0xf97316, treeStyle: 'dead', houses: 'none', treeCount: 22,
  },
  wastes: {
    skyDay: 0x9a8f78, skyNight: 0x11131a, fogDay: 0xb0a68c, fogNight: 0x1a1e26,
    groundDay: '#7a6f5a', groundNight: '#2a2822', groundDotDay: '120,110,88', groundDotNight: '44,42,36',
    pathDay: 0x8a8070, pathNight: 0x3c3a34, crystal: 0x38bdf8, treeStyle: 'none', houses: 'debris', treeCount: 8,
  },
  citadel: {
    skyDay: 0x241a30, skyNight: 0x0c0814, fogDay: 0x2e2242, fogNight: 0x120c1e,
    groundDay: '#2a2438', groundNight: '#14101e', groundDotDay: '52,44,68', groundDotNight: '30,24,44',
    pathDay: 0x453c52, pathNight: 0x262032, crystal: 0xa855f7, treeStyle: 'dead', houses: 'ruin', treeCount: 18,
  },
};

export class BattleScene {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  curve: THREE.CatmullRomCurve3;
  /** همه مسیرهای حمله — مراحل چندمسیره ۲-۳ مسیر دارند */
  paths: { points: THREE.Vector3[]; length: number; curve: THREE.CatmullRomCurve3 }[] = [];
  pathPoints: THREE.Vector3[] = []; // نقاط مسیر اصلی (۰) — سازگاری
  pathLength = 0;
  coreMesh: THREE.Group;
  riftMeshes: THREE.Group[] = [];
  /** دروازه اصلی — سازگاری */
  riftMesh: THREE.Group;
  corePos: THREE.Vector3;
  riftPos: THREE.Vector3;
  private decorSpinners: { obj: THREE.Object3D; speed: number }[] = [];
  private portalPulse = 0;
  private starPoints: THREE.Points | null = null;
  private ambientFx: THREE.Points | null = null;
  private quality: 'low' | 'medium' | 'high' | 'ultra' = 'medium';
  private theme: EnvTheme;
  private level: LevelData;

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

    const night = level.timeOfDay === 'night';
    this.theme = ENV_THEMES[level.env] ?? ENV_THEMES.plains;
    this.level = level;

    // نورپردازی محیطی PBR — متریال‌های واقعی GLB (فلز/سنگ/پارچه) درست دیده شوند
    if (quality !== 'low') {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new RoomEnvironment();
      this.scene.environment = pmrem.fromScene(envScene, 0.06).texture;
      this.scene.environmentIntensity = night ? 0.22 : 0.45;
      pmrem.dispose();
    }

    // آسمان و مه — بر اساس تم منطقه
    this.scene.background = new THREE.Color(night ? this.theme.skyNight : this.theme.skyDay);
    this.scene.fog = new THREE.Fog(night ? this.theme.fogNight : this.theme.fogDay, 55, 145);

    // گنبد آسمان گرادیانی — افق روشن‌تر، سمت سقف عمیق‌تر (جای رنگ تخت)
    this.buildSkyDome(night);

    // ستاره‌های شب — فقط در مناطق تاریک
    if (night && quality !== 'low') this.buildStars();

    // نورپردازی — رنگ آفتاب بر اساس تم
    const sunTint = level.env === 'volcano' ? 0xffb090 : level.env === 'tundra' ? 0xe8f4ff : level.env === 'citadel' ? 0x9a88c8 : 0xfff2d9;
    const hemi = new THREE.HemisphereLight(night ? 0x334466 : 0xbfd9ff, night ? 0x1a1a24 : 0x3f6b3f, night ? 0.7 : 1.0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(night ? 0x8899ff : sunTint, night ? 0.8 : 1.6);
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

    // نور پرکننده از سمت مخالف — عمق و حجم بهتر مدل‌ها (بدون سایه)
    const rim = new THREE.DirectionalLight(sunTint, night ? 0.22 : 0.45);
    rim.position.set(28, 18, 26);
    this.scene.add(rim);

    // زمین
    this.buildGround(night);

    // مسیرها — ۱ تا ۳ مسیر حمله، همه به هسته ختم می‌شوند
    const pathDefs = level.paths?.length ? level.paths : [level.paths ?? []];
    for (const def of pathDefs) {
      const pts = def.map((p) => new THREE.Vector3(p.x, 0, p.z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.12);
      const length = curve.getLength();
      const points = curve.getSpacedPoints(Math.max(40, Math.floor(length / 1.5)));
      this.paths.push({ points, length, curve });
      this.buildPathMesh(points, night);
    }
    this.curve = this.paths[0].curve;
    this.pathPoints = this.paths[0].points;
    this.pathLength = this.paths[0].length;

    // هسته آذر (انتهای مشترک همه مسیرها)
    const endPts = this.paths[0].points;
    this.corePos = endPts[endPts.length - 1].clone();
    this.coreMesh = buildCoreMesh();
    this.coreMesh.position.set(this.corePos.x, 0, this.corePos.z);
    this.scene.add(this.coreMesh);

    // دروازه تاریکی — یکی در ابتدای هر مسیر
    for (const path of this.paths) {
      const rift = buildRiftMesh();
      const start = path.points[0];
      const next = path.points[1] ?? path.points[0];
      const dir = next.clone().sub(start).normalize();
      rift.position.set(start.x, 0, start.z);
      rift.rotation.y = Math.atan2(dir.x, dir.z);
      this.scene.add(rift);
      this.riftMeshes.push(rift);
    }
    this.riftMesh = this.riftMeshes[0];
    this.riftPos = this.riftMeshes[0].position.clone();

    // محیط
    this.buildEnvironment(level, this.paths[0].points, night);
  }

  // ------------------- آسمان -------------------

  /** گنبد آسمان با گرادیان عمودی — افق روشن، اوج تیره */
  private buildSkyDome(night: boolean) {
    const sky = new THREE.Color(night ? this.theme.skyNight : this.theme.skyDay);
    const horizon = sky.clone().lerp(new THREE.Color(night ? 0x2a3550 : 0xf2e2c4), night ? 0.35 : 0.45);
    const zenith = sky.clone().lerp(new THREE.Color(night ? 0x04060f : 0x3a6ba8), night ? 0.55 : 0.35);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: zenith },
        bottomColor: { value: horizon },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.65)), 1.0);
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 14), mat);
    dome.position.y = -8;
    dome.renderOrder = -10;
    this.scene.add(dome);
  }

  /** ستاره‌های نقطه‌ای روی نیم‌کره بالایی */
  private buildStars() {
    const N = 320;
    const pos = new Float32Array(N * 3);
    let s = 424242;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const elev = 0.12 + rnd() * 0.85; // بالاتر از افق
      const r = 260;
      pos[i * 3] = Math.cos(a) * r * Math.cos(elev * Math.PI * 0.5);
      pos[i * 3 + 1] = Math.sin(elev * Math.PI * 0.5) * r;
      pos[i * 3 + 2] = Math.sin(a) * r * Math.cos(elev * Math.PI * 0.5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false })
    );
    this.starPoints.renderOrder = -9;
    this.scene.add(this.starPoints);
  }

  // ------------------- زمین -------------------

  private buildGround(night: boolean) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const base = night ? this.theme.groundNight : this.theme.groundDay;
    const dot = night ? this.theme.groundDotNight : this.theme.groundDotDay;
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
    const density = this.level.env === 'volcano' || this.level.env === 'citadel' ? 900 : 1400;
    for (let i = 0; i < density; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const tone = 0.85 + r() * 0.3;
      const [dr, dg, db] = dot.split(',').map(Number);
      ctx.fillStyle = `rgba(${Math.round(dr * tone)},${Math.round(dg * tone)},${Math.round(db * tone)},0.5)`;
      ctx.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
    }
    // لکه‌های بزرگ نرم — بافت زمین یکنواخت نباشد (چمن/خاک/خاکستر)
    const blobs = 26;
    const [br, bg, bb] = dot.split(',').map(Number);
    for (let i = 0; i < blobs; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const rad = 14 + r() * 30;
      const dark = r() > 0.5;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, rad);
      const a = 0.1 + r() * 0.1;
      grad.addColorStop(0, dark ? `rgba(${Math.round(br * 0.55)},${Math.round(bg * 0.55)},${Math.round(bb * 0.55)},${a})` : `rgba(${Math.min(255, br * 1.45)},${Math.min(255, bg * 1.45)},${Math.min(255, bb * 1.45)},${a})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
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

  private buildPathMesh(pts: THREE.Vector3[], night: boolean) {
    const width = 3.2;
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

    const mat = new THREE.MeshStandardMaterial({ color: night ? this.theme.pathNight : this.theme.pathDay, roughness: 1 });
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

    // سنگ‌فرش کنار مسیر + نشانگرهای جادویی — رنگ کریستال تم
    const runeColor = this.theme.crystal;
    for (let i = 0; i < pts.length; i += 6) {
      const p = pts[i];
      const rune = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 6),
        new THREE.MeshBasicMaterial({ color: runeColor, transparent: true, opacity: night ? 0.55 : 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(p.x, 0.09, p.z);
      this.scene.add(rune);
    }

    // سنگ‌ریزه لبه مسیر — مرز بصری مسیر (InstancedMesh — هزینه نزدیک صفر)
    if (this.quality !== 'low') {
      const stoneGeo = new THREE.DodecahedronGeometry(0.16, 0);
      const stoneMat = new THREE.MeshStandardMaterial({ color: night ? this.theme.pathNight : this.theme.pathDay, roughness: 0.95 });
      const step = 3;
      const count = Math.floor(pts.length / step) * 2;
      if (count > 0) {
        const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, count);
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const sc = new THREE.Vector3();
        const pv = new THREE.Vector3();
        let idx = 0;
        for (let i = 1; i < pts.length - 1 && idx < count; i += step) {
          const a = pts[i - 1];
          const b = pts[i + 1];
          const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x);
          for (const sgn of [1, -1]) {
            if (idx >= count) break;
            const jitter = 0.5 + rnd2(i, sgn) * 0.4;
            pv.set(pts[i].x + side.x * (3.35 + jitter * 0.5), 0.05, pts[i].z + side.z * (3.35 + jitter * 0.5));
            q.setFromEuler(new THREE.Euler(rnd2(i, sgn) * Math.PI, rnd2(i + 7, sgn) * Math.PI, 0));
            sc.setScalar(0.7 + rnd2(i + 13, sgn) * 0.9);
            m4.compose(pv, q, sc);
            stones.setMatrixAt(idx++, m4);
          }
        }
        stones.count = idx;
        stones.castShadow = false;
        stones.receiveShadow = this.renderer.shadowMap.enabled;
        this.scene.add(stones);
      }
    }
  }

  // ------------------- محیط -------------------

  private buildEnvironment(level: LevelData, pathPts: THREE.Vector3[], night: boolean) {
    const nearPath = (x: number, z: number, min: number) => {
      for (const path of this.paths) {
        for (const p of path.points) {
          if ((p.x - x) ** 2 + (p.z - z) ** 2 < min * min) return true;
        }
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
    const theme = this.theme;

    // Seasonal/biome atmosphere: lightweight particles and large readable landmarks.
    // Each environment receives its own palette and silhouette family.
    const particleCount = this.quality === 'low' ? 140 : this.quality === 'medium' ? 360 : this.quality === 'high' ? 680 : 1050;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (r() - 0.5) * 76;
      particlePositions[i * 3 + 1] = 0.8 + r() * 13;
      particlePositions[i * 3 + 2] = (r() - 0.5) * 76;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleColor = this.level.env === 'volcano' ? 0xff7138
      : this.level.env === 'tundra' ? 0xc9efff
      : this.level.env === 'forest' ? 0x8cf0a0
      : this.level.env === 'citadel' ? 0xc5a6ff
      : this.level.env === 'wastes' ? 0xe7c78d : 0xc9f5ff;
    this.ambientFx = new THREE.Points(particleGeo, new THREE.PointsMaterial({
      color: particleColor,
      size: this.quality === 'ultra' ? 0.095 : 0.065,
      transparent: true,
      opacity: this.level.env === 'volcano' ? 0.62 : 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    this.ambientFx.frustumCulled = false;
    this.scene.add(this.ambientFx);

    // Distinct biome landmarks, visible from the isometric camera.
    // Instanced meshes keep draw calls low on mobile.
    const landmarkCount = this.quality === 'low' ? 5 : this.quality === 'medium' ? 9 : 14;
    const landmarkMat = new THREE.MeshStandardMaterial({
      color: this.level.env === 'volcano' ? 0x30211e
        : this.level.env === 'tundra' ? 0x9ab9ca
        : this.level.env === 'forest' ? 0x293b30
        : this.level.env === 'citadel' ? 0x393047
        : this.level.env === 'wastes' ? 0x665744 : 0x4b6443,
      roughness: 0.86,
      metalness: this.level.env === 'citadel' || this.level.env === 'volcano' ? 0.22 : 0.04,
    });
    const landmarkGeo = this.level.env === 'tundra'
      ? new THREE.ConeGeometry(0.72, 3.4, 5)
      : this.level.env === 'forest'
        ? new THREE.ConeGeometry(0.52, 2.6, 5)
        : this.level.env === 'citadel'
          ? new THREE.CylinderGeometry(0.36, 0.68, 3.5, 6)
          : this.level.env === 'volcano'
            ? new THREE.ConeGeometry(0.66, 2.9, 6)
            : this.level.env === 'wastes'
              ? new THREE.ConeGeometry(0.9, 2.2, 5)
              : new THREE.ConeGeometry(0.48, 2.4, 6);
    const landmarks = new THREE.InstancedMesh(landmarkGeo, landmarkMat, landmarkCount);
    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;
    while (placed < landmarkCount && attempts < landmarkCount * 12) {
      attempts++;
      const x = (r() - 0.5) * 61;
      const z = (r() - 0.5) * 61;
      if (nearPath(x, z, 6.2) || Math.hypot(x - this.corePos.x, z - this.corePos.z) < 9) continue;
      if (Math.hypot(x, z) < 10) continue;
      dummy.position.set(x, 1.1 + r() * 0.3, z);
      dummy.rotation.set((r() - 0.5) * 0.1, r() * Math.PI * 2, (r() - 0.5) * 0.1);
      const scale = 0.75 + r() * 1.1;
      dummy.scale.set(scale * (this.level.env === 'wastes' ? 1.25 : 1), scale, scale);
      dummy.updateMatrix();
      landmarks.setMatrixAt(placed++, dummy.matrix);
    }
    landmarks.count = placed;
    landmarks.castShadow = this.renderer.shadowMap.enabled;
    landmarks.receiveShadow = true;
    this.scene.add(landmarks);

    // Warm ember lighting / cool ice bounce makes each biome read differently.
    if (this.level.env === 'tundra' || this.level.env === 'volcano' || this.level.env === 'citadel') {
      const fillColor = this.level.env === 'tundra' ? 0x72cfff : this.level.env === 'volcano' ? 0xff4b24 : 0x9c63ff;
      const fill = new THREE.PointLight(fillColor, night ? 7 : 3.5, 34, 1.8);
      fill.position.set(-15, 5, 12);
      this.scene.add(fill);
    }

    // کوه‌های دور — رنگ بر اساس تم
    for (let i = 0; i < 7; i++) {
      const m = buildMountain(theme === ENV_THEMES.volcano ? 'dark' : theme === ENV_THEMES.tundra ? 'snow' : theme === ENV_THEMES.citadel ? 'obsidian' : 'normal');
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const dist = 62 + r() * 14;
      m.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      m.rotation.y = r() * Math.PI;
      m.scale.setScalar(0.8 + r() * 0.9);
      this.scene.add(m);
    }

    // درختان — سبک تم
    if (theme.treeStyle !== 'none') {
      const treeCount = this.quality === 'low' ? Math.round(theme.treeCount * 0.6) : theme.treeCount;
      for (let i = 0; i < treeCount; i++) {
        const x = (r() - 0.5) * 66;
        const z = (r() - 0.5) * 66;
        if (nearPath(x, z, 4.5)) continue;
        if (Math.hypot(x - this.corePos.x, z - this.corePos.z) < 7) continue;
        const tree = theme.treeStyle === 'pine'
          ? buildPineTree(theme === ENV_THEMES.tundra)
          : theme.treeStyle === 'dead'
            ? buildDeadTree()
            : buildTree();
        tree.position.set(x, 0, z);
        tree.scale.setScalar(0.7 + r() * 0.8);
        tree.rotation.y = r() * Math.PI;
        this.scene.add(tree);
      }
    }

    // سنگ‌ها / سنگ سیاه آتشفشانی
    for (let i = 0; i < 20; i++) {
      const x = (r() - 0.5) * 64;
      const z = (r() - 0.5) * 64;
      if (nearPath(x, z, 4)) continue;
      const rock = this.level.env === 'volcano' || this.level.env === 'citadel'
        ? buildObsidianRock(0.5 + r())
        : buildRock(0.5 + r());
      rock.position.set(x, 0, z);
      this.scene.add(rock);
    }

    // سازه‌ها بر اساس تم
    if (theme.houses === 'village') {
      const houseSpots = [
        { x: -20, z: -8 }, { x: -23, z: -12 }, { x: 4, z: -8 }, { x: 8, z: 14 }, { x: 4, z: 18 },
      ];
      for (const s of houseSpots) {
        const h = buildHouse();
        h.position.set(s.x, 0, s.z);
        h.rotation.y = r() * Math.PI * 2;
        this.scene.add(h);
      }
    } else if (theme.houses === 'ruin') {
      const ruinSpots = [
        { x: -20, z: -8 }, { x: 6, z: -10 }, { x: 10, z: 16 }, { x: -14, z: 16 },
      ];
      for (const s of ruinSpots) {
        const h = buildHouse(true);
        h.position.set(s.x, 0, s.z);
        h.rotation.y = r() * Math.PI * 2;
        this.scene.add(h);
      }
    } else if (theme.houses === 'debris') {
      const debrisSpots = [
        { x: -20, z: -8 }, { x: -22, z: -14 }, { x: 6, z: -10 }, { x: 12, z: 14 }, { x: 20, z: 18 }, { x: -12, z: 18 },
      ];
      for (const s of debrisSpots) {
        const d = buildDebris();
        d.position.set(s.x, 0, s.z);
        d.rotation.y = r() * Math.PI * 2;
        this.scene.add(d);
      }
    }

    // کریستال‌های جادویی — رنگ تم منطقه
    const crystalSpots = [
      { x: -12, z: 12 }, { x: 28, z: -14 }, { x: -26, z: 20 }, { x: 26, z: 10 },
    ];
    for (const s of crystalSpots) {
      const c = buildCrystal(theme.crystal);
      c.position.set(s.x, 0, s.z);
      c.scale.setScalar(0.8 + r() * 0.5);
      this.scene.add(c);
      this.decorSpinners.push({ obj: c, speed: 0.5 + r() });
      const l = new THREE.PointLight(theme.crystal, night ? 6 : 3, 8, 1.8);
      l.position.set(s.x, 1.4, s.z);
      this.scene.add(l);
    }

    // نور قرمز آتشفشان
    if (this.level.env === 'volcano') {
      for (const s of [{ x: -18, z: -18 }, { x: 20, z: 20 }]) {
        const glow = new THREE.PointLight(0xff5a1f, night ? 14 : 8, 18, 1.6);
        glow.position.set(s.x, 1, s.z);
        this.scene.add(glow);
      }
    }

    void pathPts;
  }

  // ------------------- اعتبارسنجی محل ساخت برج -------------------

  canBuild(x: number, z: number, towerPositions: THREE.Vector3[]): boolean {
    if (Math.abs(x) > 32 || Math.abs(z) > 32) return false;
    // فاصله از همه مسیرها
    for (const path of this.paths) {
      for (const p of path.points) {
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < 3.9 ** 2) return false;
      }
    }
    // فاصله از هسته و همه دروازه‌ها
    if (Math.hypot(x - this.corePos.x, z - this.corePos.z) < 5.5) return false;
    for (const rift of this.riftMeshes) {
      if (Math.hypot(x - rift.position.x, z - rift.position.z) < 5.5) return false;
    }
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

    // دروازه‌های تاریکی — تپش (همه مسیرها)
    this.portalPulse += dt;
    for (const rift of this.riftMeshes) {
      const portal = rift.userData.portal as THREE.Mesh | undefined;
      if (portal) {
        const m = portal.material as THREE.MeshBasicMaterial;
        m.opacity = 0.45 + Math.sin(this.portalPulse * 3) * 0.15;
        portal.rotation.z += dt * 1.2;
      }
    }

    // Biome motes drift slowly to make snow/embers/spores feel alive.
    if (this.ambientFx) this.ambientFx.rotation.y += dt * (this.level.env === 'volcano' ? 0.018 : 0.006);

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
