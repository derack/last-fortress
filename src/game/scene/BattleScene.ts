import * as THREE from 'three';
import type { LevelData, RegionEnv } from '../data/types';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCoreMesh, buildRiftMesh, buildTree, buildRock, buildHouse, buildCrystal, buildMountain, buildPineTree, buildDeadTree, buildDebris, buildObsidianRock } from './models';
import { mergeDecorGroups } from './mergeDecor';

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
  private ambientVelocity: Float32Array | null = null;
  private quality: 'low' | 'medium' | 'high' | 'ultra' = 'medium';
  // تفکیک‌پذیری تطبیقی — روی دستگاه ضعیف خودکار پایین می‌آید تا لگ حذف شود
  private targetRatio = 1;
  private currentRatio = 1;
  private lastRenderAt = 0;
  private perfAccum = 0;
  private perfFrames = 0;
  private debugOverlay: HTMLDivElement | null = null;
  private debugFrames = 0;
  private debugWindowStart = 0;
  private theme: EnvTheme;
  private level: LevelData;

  constructor(canvas: HTMLCanvasElement, level: LevelData, quality: 'low' | 'medium' | 'high' | 'ultra') {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality === 'ultra',
      powerPreference: 'high-performance',
    });
    const pixelRatio = quality === 'low' ? 1 : Math.min(1.35, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pixelRatio);
    this.targetRatio = pixelRatio;
    this.currentRatio = pixelRatio;
    this.lastRenderAt = performance.now();
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = level.timeOfDay === 'night' ? 0.92
      : level.env === 'tundra' ? 1.02
      : level.env === 'volcano' || level.env === 'citadel' ? 0.96 : 1.0;

    const night = level.timeOfDay === 'night';
    this.theme = ENV_THEMES[level.env] ?? ENV_THEMES.plains;
    this.level = level;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('graphicsDebug') === '1') {
      const overlay = document.createElement('div');
      overlay.setAttribute('aria-label', 'Graphics performance diagnostics');
      overlay.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;white-space:pre-line;pointer-events:none;padding:9px 11px;border:1px solid rgba(148,184,220,.35);border-radius:8px;background:rgba(5,10,18,.88);color:#d8e7f8;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;backdrop-filter:blur(8px);';
      overlay.textContent = 'LAST FORTRESS · GRAPHICS QA\nCollecting frame data…';
      document.body.appendChild(overlay);
      this.debugOverlay = overlay;
      this.debugWindowStart = performance.now();
    }

    // نورپردازی محیطی PBR — متریال‌های واقعی GLB (فلز/سنگ/پارچه) درست دیده شوند
    if (quality !== 'low') {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new RoomEnvironment();
      this.scene.environment = pmrem.fromScene(envScene, 0.06).texture;
      // Keep metal and stone readable without flattening the scene with excessive fill.
      this.scene.environmentIntensity = night ? 0.24 : 0.48;
      envScene.dispose();
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
      const shadowSize = quality === 'ultra' ? 1024 : 768;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      sun.shadow.camera.left = -55;
      sun.shadow.camera.right = 55;
      sun.shadow.camera.top = 55;
      sun.shadow.camera.bottom = -55;
      sun.shadow.camera.far = 130;
      sun.shadow.bias = -0.00015;
      sun.shadow.normalBias = 0.035;
    }
    this.scene.add(sun);

    // نور پرکننده از سمت مخالف — عمق و حجم بهتر مدل‌ها (بدون سایه)
    const rimColor = level.env === 'tundra' ? 0x8edaff
      : level.env === 'forest' ? 0x9bc9a1
      : level.env === 'volcano' ? 0xff6842
      : level.env === 'wastes' ? 0xe6bd82
      : level.env === 'citadel' ? 0xb6a0ff
      : 0xb8d8ff;
    const rim = new THREE.DirectionalLight(rimColor, night ? 0.28 : 0.52);
    rim.position.set(28, 18, 26);
    rim.castShadow = false;
    this.scene.add(rim);

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

    // Sculpt the ground after paths exist so the terrain naturally settles around the route.
    this.buildGround(night);

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
    // Art-directed biome ground: broad painterly strata, restrained micro-detail,
    // and shallow sculpting that blends into the road instead of a flat green plane.
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const env = this.level.env;
    const palette: Record<RegionEnv, { base: string; mid: string; light: string; dark: string; soil: string }> = {
      plains:  { base: night ? '#202c20' : '#405b32', mid: night ? '#293927' : '#587343', light: night ? '#34452b' : '#71834b', dark: '#263025', soil: '#65513a' },
      forest:  { base: night ? '#101a13' : '#203a25', mid: night ? '#19271b' : '#2d4d31', light: night ? '#243322' : '#42613a', dark: '#121b15', soil: '#514233' },
      tundra:  { base: night ? '#303f4b' : '#a9bec9', mid: night ? '#3b4d59' : '#c4d5dc', light: night ? '#50636c' : '#e2e9e8', dark: '#71858e', soil: '#788b96' },
      volcano: { base: night ? '#1b1110' : '#30221e', mid: night ? '#2a1714' : '#473027', light: night ? '#3a2119' : '#604033', dark: '#160f0e', soil: '#171414' },
      wastes:  { base: night ? '#25241f' : '#6a604d', mid: night ? '#302e26' : '#83745b', light: night ? '#40392c' : '#a18c6a', dark: '#4c463a', soil: '#514435' },
      citadel: { base: night ? '#100e18' : '#272332', mid: night ? '#1a1524' : '#383146', light: night ? '#282035' : '#51465b', dark: '#17131f', soil: '#40333d' },
    };
    const p = palette[env];
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, size, size);

    // Wide, overlapping pigment fields create material depth without a dotted/noisy look.
    let seed = 78123 + Object.keys(ENV_THEMES).indexOf(env) * 991;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const colors = [p.mid, p.light, p.dark, p.soil];
    for (let i = 0; i < 34; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rx = 45 + rand() * 170;
      const ry = 30 + rand() * 135;
      const gradient = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
      const col = colors[i % colors.length];
      const alpha = i % 4 === 1 ? 0.14 : 0.075;
      gradient.addColorStop(0, col + Math.round(alpha * 255).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, col + '00');
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 1.4);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // A small number of long, broken contour strokes read as erosion / strata at game scale.
    if (env === 'tundra' || env === 'volcano' || env === 'wastes' || env === 'citadel') {
      ctx.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const len = 35 + rand() * 145;
        ctx.strokeStyle = env === 'tundra' ? 'rgba(245,250,255,0.10)' : 'rgba(8,6,6,0.12)';
        ctx.lineWidth = 1 + rand() * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.25, y - 4, x + len * 0.55, y + 5, x + len, y + (rand() - 0.5) * 12);
        ctx.stroke();
      }
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2.8, 2.8);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    // Subtle grayscale relief derived from broad shapes, not sharp speckle noise.
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = 256;
    const bctx = bumpCanvas.getContext('2d');
    if (bctx) {
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 30; i++) {
        const x = rand() * 256, y = rand() * 256, radius = 12 + rand() * 38;
        const shade = Math.round(105 + rand() * 48);
        const g = bctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `rgb(${shade},${shade},${shade})`);
        g.addColorStop(1, 'rgba(128,128,128,0)');
        bctx.fillStyle = g;
        bctx.beginPath(); bctx.arc(x, y, radius, 0, Math.PI * 2); bctx.fill();
      }
    }
    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.copy(map.repeat);
    bump.colorSpace = THREE.NoColorSpace;

    // Convert the broad height field into a seamless tangent-space normal map.
    // This gives rocks/soil readable grazing-light detail without adding particles.
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = 256;
    const nctx = normalCanvas.getContext('2d');
    if (nctx && bctx) {
      const source = bctx.getImageData(0, 0, 256, 256).data;
      const image = nctx.createImageData(256, 256);
      const heightAt = (x: number, y: number) => source[((y + 256) % 256 * 256 + (x + 256) % 256) * 4] / 255;
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 1.8;
          const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 1.8;
          const nx = -dx, ny = -dy, nz = 1;
          const len = Math.hypot(nx, ny, nz);
          const i = (y * 256 + x) * 4;
          image.data[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
          image.data[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
          image.data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
          image.data[i + 3] = 255;
        }
      }
      nctx.putImageData(image, 0, 0);
    }
    const normal = new THREE.CanvasTexture(normalCanvas);
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.copy(map.repeat);
    normal.colorSpace = THREE.NoColorSpace;
    normal.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    // A modestly subdivided mesh gives the terrain a real silhouette; the road
    // corridor is flattened against all active paths to prevent floating roads.
    const segments = this.quality === 'low' ? 48 : 80;
    const geometry = new THREE.PlaneGeometry(160, 160, segments, segments);
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = -positions.getY(i);
      const broad = Math.sin(x * 0.095 + 0.7) * Math.cos(z * 0.08 - 0.4)
        + Math.sin((x + z) * 0.047) * 0.65
        + Math.cos((x - z) * 0.031) * 0.45;
      const edge = Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 30) / 50);
      let height = -0.045 + broad * 0.026 + edge * edge * 0.09;
      let nearest = 999;
      for (const path of this.paths) {
        for (let j = 0; j < path.points.length; j += 2) {
          const pt = path.points[j];
          const d = Math.hypot(pt.x - x, pt.z - z);
          if (d < nearest) nearest = d;
        }
      }
      if (nearest < 5.2) {
        const t = THREE.MathUtils.smoothstep(nearest, 2.5, 5.2);
        height = THREE.MathUtils.lerp(-0.005, height, t);
      }
      positions.setZ(i, height);
    }
    geometry.computeVertexNormals();
    geometry.rotateX(-Math.PI / 2);

    const groundMaterial = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: env === 'tundra' ? 0.035 : 0.05,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.96,
      metalness: env === 'citadel' || env === 'volcano' ? 0.08 : 0.015,
    });
    const ground = new THREE.Mesh(geometry, groundMaterial);
    ground.receiveShadow = this.renderer.shadowMap.enabled;
    ground.castShadow = false;
    ground.frustumCulled = true;
    ground.name = 'SculptedBiomeTerrain';
    this.scene.add(ground);

    // Darker outer earth lip makes the playable board feel like a designed diorama,
    // while remaining understated and cheap to render.
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(82, 84, 1.15, 64, 1, true),
      new THREE.MeshStandardMaterial({ color: env === 'tundra' ? 0x536571 : env === 'volcano' ? 0x211614 : env === 'citadel' ? 0x201a2b : env === 'wastes' ? 0x4b4031 : 0x253126, roughness: 1, side: THREE.DoubleSide })
    );
    rim.position.y = -0.56;
    rim.receiveShadow = false;
    rim.castShadow = false;
    this.scene.add(rim);
  }

  // ------------------- مسیر -------------------

  private buildPathMesh(pts: THREE.Vector3[], night: boolean) {
    const width = 3.0;

    // Build a single continuous mitered ribbon per route. Independent segment quads
    // overlapped at corners and could shimmer; shared vertices remove those seams.
    const createRibbon = (halfWidth: number, y: number) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      let distance = 0;
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        const tangent = next.clone().sub(prev).setY(0).normalize();
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
        if (i > 0) distance += pts[i].distanceTo(pts[i - 1]);
        let miter = 1;
        if (i > 0 && i < pts.length - 1) {
          const d0 = pts[i].clone().sub(prev).setY(0).normalize();
          const d1 = next.clone().sub(pts[i]).setY(0).normalize();
          const side0 = new THREE.Vector3(-d0.z, 0, d0.x);
          const side1 = new THREE.Vector3(-d1.z, 0, d1.x);
          const averaged = side0.add(side1).normalize();
          const denom = Math.max(0.55, Math.abs(averaged.dot(side)));
          miter = Math.min(1.45, 1 / denom);
          side.copy(averaged);
        }
        const ox = side.x * halfWidth * miter;
        const oz = side.z * halfWidth * miter;
        positions.push(pts[i].x + ox, y, pts[i].z + oz, pts[i].x - ox, y, pts[i].z - oz);
        uvs.push(0, distance / 18, 1, distance / 18);
        if (i < pts.length - 1) {
          const v = i * 2;
          indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    // Dark compacted-earth shoulder plus a sloped side wall, so the road reads as
    // a built surface embedded in the terrain rather than a floating flat ribbon.
    const shoulderColor = this.level.env === 'tundra' ? 0x586873
      : this.level.env === 'volcano' ? 0x211815
      : this.level.env === 'citadel' ? 0x292332
      : this.level.env === 'wastes' ? 0x554a3b
      : night ? 0x302d27 : 0x514638;
    const shoulder = new THREE.Mesh(createRibbon(3.55, 0.008),
      new THREE.MeshStandardMaterial({ color: shoulderColor, roughness: 1 }));
    shoulder.receiveShadow = this.renderer.shadowMap.enabled;
    shoulder.castShadow = false;
    this.scene.add(shoulder);

    const bevelPositions: number[] = [];
    const bevelIndices: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const tangent = next.clone().sub(prev).setY(0).normalize();
      let side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      let miter = 1;
      if (i > 0 && i < pts.length - 1) {
        const d0 = pts[i].clone().sub(prev).setY(0).normalize();
        const d1 = next.clone().sub(pts[i]).setY(0).normalize();
        const side0 = new THREE.Vector3(-d0.z, 0, d0.x);
        const side1 = new THREE.Vector3(-d1.z, 0, d1.x);
        const averaged = side0.add(side1).normalize();
        miter = Math.min(1.45, 1 / Math.max(0.55, Math.abs(averaged.dot(side))));
        side = averaged;
      }
      const innerX = side.x * width * miter, innerZ = side.z * width * miter;
      const outerX = side.x * 3.55 * miter, outerZ = side.z * 3.55 * miter;
      bevelPositions.push(
        pts[i].x + innerX, 0.065, pts[i].z + innerZ,
        pts[i].x - innerX, 0.065, pts[i].z - innerZ,
        pts[i].x + outerX, 0.008, pts[i].z + outerZ,
        pts[i].x - outerX, 0.008, pts[i].z - outerZ,
      );
      if (i < pts.length - 1) {
        const v = i * 4, n = v + 4;
        bevelIndices.push(v, n, v + 2, v + 2, n, n + 2);
        bevelIndices.push(v + 1, v + 3, n + 1, v + 3, n + 3, n + 1);
      }
    }
    const bevelGeo = new THREE.BufferGeometry();
    bevelGeo.setAttribute('position', new THREE.Float32BufferAttribute(bevelPositions, 3));
    bevelGeo.setIndex(bevelIndices);
    bevelGeo.computeVertexNormals();
    const bevel = new THREE.Mesh(bevelGeo, new THREE.MeshStandardMaterial({ color: shoulderColor, roughness: 1, side: THREE.DoubleSide }));
    bevel.receiveShadow = this.renderer.shadowMap.enabled;
    bevel.castShadow = false;
    bevel.name = 'RoadBeveledShoulder';
    this.scene.add(bevel);

    // Low-contrast road surface texture: broad worn patches and long compression marks,
    // deliberately no bright grains, dots or repeated rune decals.
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = roadCanvas.height = 512;
    const roadCtx = roadCanvas.getContext('2d');
    const roadColor = new THREE.Color(night ? this.theme.pathNight : this.theme.pathDay);
    if (roadCtx) {
      roadCtx.fillStyle = roadColor.getStyle();
      roadCtx.fillRect(0, 0, 512, 512);
      let roadSeed = 9029 + Object.keys(ENV_THEMES).indexOf(this.level.env) * 127;
      const roadRand = () => { roadSeed = (roadSeed * 16807) % 2147483647; return (roadSeed - 1) / 2147483646; };
      for (let i = 0; i < 24; i++) {
        const x = roadRand() * 512, y = roadRand() * 512;
        const radius = 28 + roadRand() * 82;
        const shade = roadRand() > 0.5 ? '255,255,255' : '12,10,8';
        const alpha = 0.025 + roadRand() * 0.035;
        const gradient = roadCtx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${shade},${alpha})`);
        gradient.addColorStop(1, `rgba(${shade},0)`);
        roadCtx.fillStyle = gradient;
        roadCtx.beginPath(); roadCtx.ellipse(x, y, radius, radius * (0.35 + roadRand() * 0.3), roadRand() * 1.2, 0, Math.PI * 2); roadCtx.fill();
      }
      roadCtx.lineCap = 'round';
      roadCtx.strokeStyle = 'rgba(18,14,10,0.055)';
      for (let i = 0; i < 11; i++) {
        const x = roadRand() * 512, y = roadRand() * 512;
        roadCtx.lineWidth = 1 + roadRand() * 2;
        roadCtx.beginPath(); roadCtx.moveTo(x, y); roadCtx.lineTo(x + 80 + roadRand() * 130, y + (roadRand() - 0.5) * 10); roadCtx.stroke();
      }
    }
    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.colorSpace = THREE.SRGBColorSpace;
    roadTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const pathMesh = new THREE.Mesh(createRibbon(width, 0.065),
      new THREE.MeshStandardMaterial({ map: roadTexture, color: 0xffffff, roughness: 0.98, metalness: 0 }));
    pathMesh.receiveShadow = this.renderer.shadowMap.enabled;
    pathMesh.castShadow = false;
    pathMesh.name = 'ContinuousRoadSurface';
    this.scene.add(pathMesh);

    // Avoid overlapping coplanar disc geometry here: the old layer shimmered
    // against the ribbon and looked like repeated spots along the route.

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
    const naturalProps: THREE.Object3D[] = [];

    // Keep atmosphere architectural and grounded; avoid full-screen colored particle speckles.
    this.ambientFx = null;
    this.ambientVelocity = null;

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
    // Faceted, asymmetrical rock spires replace repeated perfect cones.
    // One shared geometry keeps the silhouette richer without adding draw calls.
    const landmarkGeo = (() => {
      const profile = this.level.env === 'tundra'
        ? [0.34, 0.92, 0.68, 0.4, 0.025]
        : this.level.env === 'citadel'
          ? [0.52, 0.84, 0.58, 0.36, 0.035]
          : this.level.env === 'volcano'
            ? [0.48, 0.78, 0.52, 0.28, 0.015]
            : this.level.env === 'wastes'
              ? [0.68, 0.92, 0.64, 0.42, 0.04]
              : this.level.env === 'forest'
                ? [0.62, 0.8, 0.58, 0.3, 0.02]
                : [0.7, 0.88, 0.62, 0.32, 0.03];
      const heights = [0, 0.12, 0.38, 0.72, 1];
      const sides = 7;
      const positions: number[] = [];
      const indices: number[] = [];
      let localSeed = 1709 + Object.keys(ENV_THEMES).indexOf(this.level.env) * 43;
      const jitter = () => {
        localSeed = (localSeed * 16807) % 2147483647;
        return 0.86 + (localSeed / 2147483647) * 0.28;
      };
      for (let ring = 0; ring < heights.length; ring++) {
        for (let side = 0; side < sides; side++) {
          const angle = side / sides * Math.PI * 2;
          const r = profile[ring] * jitter();
          positions.push(Math.cos(angle) * r, heights[ring], Math.sin(angle) * r);
        }
      }
      for (let ring = 0; ring < heights.length - 1; ring++) {
        for (let side = 0; side < sides; side++) {
          const a = ring * sides + side;
          const b = ring * sides + (side + 1) % sides;
          const c = (ring + 1) * sides + side;
          const d = (ring + 1) * sides + (side + 1) % sides;
          indices.push(a, c, b, b, c, d);
        }
      }
      // Close the base so the mesh remains watertight when viewed from elevated cameras.
      const center = positions.length / 3;
      positions.push(0, 0, 0);
      for (let side = 0; side < sides; side++) indices.push(center, (side + 1) % sides, side);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    })();
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
      dummy.position.set(x, 0.025, z);
      dummy.rotation.set((r() - 0.5) * 0.08, r() * Math.PI * 2, (r() - 0.5) * 0.08);
      const scale = 0.85 + r() * 0.8;
      const breadth = this.level.env === 'wastes' ? 1.28 : this.level.env === 'tundra' ? 0.82 : 1;
      dummy.scale.set(scale * breadth, scale * (2.8 + r() * 0.8), scale * breadth);
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
      const fill = new THREE.PointLight(fillColor, night ? 2.5 : 1.25, 30, 2);
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
        naturalProps.push(tree);
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
      naturalProps.push(rock);
    }

    // Batch the static tree/rock silhouettes by equivalent PBR material.
    // This keeps the richer environment affordable on mid-range Android devices.
    for (const merged of mergeDecorGroups(naturalProps, {
      castShadow: this.renderer.shadowMap.enabled,
      receiveShadow: this.renderer.shadowMap.enabled,
    })) {
      merged.name = 'BatchedNaturalEnvironment';
      this.scene.add(merged);
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
    }

    // نور قرمز آتشفشان
    if (this.level.env === 'volcano') {
      for (const s of [{ x: -18, z: -18 }, { x: 20, z: 20 }]) {
        const glow = new THREE.PointLight(0xff5a1f, night ? 4 : 2.2, 16, 2);
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

    // کریستال‌های محیط
    for (const d of this.decorSpinners) {
      d.obj.rotation.y += dt * d.speed * 0.4;
    }
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
  }

  render(camera: THREE.PerspectiveCamera) {
    const now = performance.now();
    const frameMs = now - this.lastRenderAt;
    this.lastRenderAt = now;
    this.renderer.render(this.scene, camera);
    if (this.debugOverlay) {
      this.debugFrames++;
      const elapsed = now - this.debugWindowStart;
      if (elapsed >= 1000) {
        const fps = Math.round(this.debugFrames * 1000 / elapsed);
        const info = this.renderer.info.render;
        this.debugOverlay.textContent = `LAST FORTRESS · GRAPHICS QA
FPS: ${fps}   Frame: ${frameMs.toFixed(1)} ms
Draw calls: ${info.calls}   Triangles: ${info.triangles.toLocaleString()}
Quality: ${this.quality}   Pixel ratio: ${this.currentRatio.toFixed(2)}`;
        this.debugFrames = 0;
        this.debugWindowStart = now;
      }
    }
    // نمونه‌گیری هر ~۱ ثانیه — بالا/پایین کردن تدریجی رزولوشن
    if (frameMs > 0 && frameMs < 1000) {
      this.perfAccum += frameMs;
      this.perfFrames++;
    }
    if (this.perfFrames >= 50) {
      const avg = this.perfAccum / this.perfFrames;
      this.perfAccum = 0;
      this.perfFrames = 0;
      if (avg > 23 && this.currentRatio > 0.8) {
        this.currentRatio = Math.max(0.8, this.currentRatio - 0.25);
        this.renderer.setPixelRatio(this.currentRatio);
      } else if (avg < 15 && this.currentRatio < this.targetRatio) {
        this.currentRatio = Math.min(this.targetRatio, this.currentRatio + 0.25);
        this.renderer.setPixelRatio(this.currentRatio);
      }
    }
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
        // GLB assets and contact-shadow resources are cached/shared across scene
        // instances. Disposing them here can cause missing meshes or flashes on replay.
        if (!o.geometry.userData.sharedAssetResource) o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const material of materials) {
          if (material.userData.sharedAssetResource) continue;
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture && !value.userData.sharedAssetResource) value.dispose();
          }
          material.dispose();
        }
      }
    });
    this.scene.environment?.dispose();
    this.debugOverlay?.remove();
    this.debugOverlay = null;
    this.renderer.dispose();
  }
}
