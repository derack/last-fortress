'use client';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { allAssetEntries, type CharacterAssetEntry } from '@/game/assets/AssetManifest';
import { assetManager } from '@/game/assets/AssetManager';
import { normalizeModel } from '@/game/assets/ModelNormalizer';

type AssetInfo = {
  entry: CharacterAssetEntry;
  animationNames: string[];
  animationSource: 'glb' | 'runtime-procedural' | 'none';
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  materialCount: number;
};

export default function AssetPreviewPage() {
  const entries = useMemo(() => allAssetEntries(), []);
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '');
  const [animationName, setAnimationName] = useState('Idle');
  const [animationOptions, setAnimationOptions] = useState<string[]>([]);
  const [info, setInfo] = useState<AssetInfo | null>(null);
  const [error, setError] = useState('');
  const [renderStats, setRenderStats] = useState({ fps: 0, drawCalls: 0, triangles: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipRootRef = useRef<THREE.Object3D | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const towerPartsRef = useRef<{ turret?: THREE.Object3D; crystal?: THREE.Object3D; ring?: THREE.Object3D } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1119);
    scene.fog = new THREE.Fog(0x0b1119, 28, 75);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
    camera.position.set(5, 3.8, 6.2);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene.add(new THREE.HemisphereLight(0xc9ddf6, 0x25202b, 1.25));
    const key = new THREE.DirectionalLight(0xffdfb4, 2.15);
    key.position.set(6, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0003;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x78bfff, 1.15);
    rim.position.set(-6, 5, -5);
    rim.castShadow = false;
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x202a30, roughness: 0.96, metalness: 0.02 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    scene.add(ground);

    const modelRoot = new THREE.Group();
    modelRoot.name = 'AssetPreviewModelRoot';
    scene.add(modelRoot);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.2;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 1.1, 0);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    modelRootRef.current = modelRoot;

    let frame = 0;
    let last = performance.now();
    let statsStart = last;
    let statsFrames = 0;
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      controls.update();
      mixerRef.current?.update(dt);
      const tower = towerPartsRef.current;
      if (tower) {
        if (tower.turret) tower.turret.rotation.y += dt * 0.22;
        if (tower.crystal) tower.crystal.rotation.y += dt * 1.1;
        if (tower.ring) tower.ring.rotation.y += dt * 0.8;
      }
      renderer.render(scene, camera);
      statsFrames++;
      if (now - statsStart >= 500) {
        setRenderStats({
          fps: Math.round(statsFrames * 1000 / (now - statsStart)),
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        });
        statsFrames = 0;
        statsStart = now;
      }
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      renderer.dispose();
      scene.clear();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRootRef.current = null;
      towerPartsRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const entry = entries.find((item) => item.id === selectedId);
    const root = modelRootRef.current;
    if (!entry || !root) return;
    setError('');
    setInfo(null);
    mixerRef.current?.stopAllAction();
    if (mixerRef.current && clipRootRef.current) mixerRef.current.uncacheRoot(clipRootRef.current);
    mixerRef.current = null;
    clipRootRef.current = null;
    clipsRef.current = [];
    towerPartsRef.current = null;
    root.clear();

    (async () => {
      try {
        await assetManager.load(entry);
        if (cancelled) return;
        const instance = assetManager.instantiate(entry);
        if (!instance) throw new Error('AssetManager did not return a clone');
        const normalized = normalizeModel(instance.scene, entry);
        root.add(normalized.inner);
        root.rotation.set(0, 0, 0);
        const height = Math.max(1, entry.targetHeight);
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (camera && controls) {
          controls.target.set(0, height * 0.46, 0);
          camera.position.set(height * 1.45, height * 1.0, height * 1.85);
          camera.near = Math.max(0.05, height / 80);
          camera.far = height * 40;
          camera.updateProjectionMatrix();
          controls.update();
        }
        const names = instance.animations.map((clip) => clip.name);
        clipsRef.current = instance.animations;
        setAnimationOptions(names);
        setAnimationName(names.includes('Idle') ? 'Idle' : (names[0] ?? ''));
        if (names.length) {
          mixerRef.current = new THREE.AnimationMixer(normalized.inner);
          clipRootRef.current = normalized.inner;
        }
        const getNode = (name: string) => normalized.inner.getObjectByName(name);
        towerPartsRef.current = entry.category === 'towers'
          ? { turret: getNode('turret'), crystal: getNode('spinCrystal'), ring: getNode('spinRing') }
          : null;
        let meshCount = 0, vertexCount = 0, triangleCount = 0;
        const materials = new Set<THREE.Material>();
        normalized.inner.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          meshCount++;
          vertexCount += mesh.geometry.getAttribute('position')?.count ?? 0;
          triangleCount += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position')?.count ?? 0) / 3;
          for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) materials.add(material);
        });
        const record = assetManager.record(entry.id);
        setInfo({
          entry, animationNames: names, animationSource: record?.animationSource ?? 'none',
          meshCount, vertexCount, triangleCount: Math.round(triangleCount), materialCount: materials.size,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [entries, selectedId]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || !animationName) return;
    mixer.stopAllAction();
    const clip = clipsRef.current.find((item) => item.name === animationName);
    if (clip) mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [animationName, info]);

  const categoryLabel: Record<string, string> = { heroes: 'قهرمانان', enemies: 'دشمنان', bosses: 'باس‌ها', towers: 'برج‌ها' };
  const sourceLabel = info?.animationSource === 'glb'
    ? 'انیمیشن داخل GLB'
    : info?.animationSource === 'runtime-procedural'
      ? 'انیمیشن rigid-part ساخته‌شده در runtime'
      : 'بدون کلیپ انیمیشن';

  return (
    <main style={{ minHeight: '100vh', background: '#080d14', color: '#e5edf7', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ maxWidth: 1400, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#8eb9e9', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>LAST FORTRESS · ART QA</div>
          <h1 style={{ margin: '6px 0', fontSize: 28, fontWeight: 750 }}>گالری بررسی دارایی‌های سه‌بعدی</h1>
          <p style={{ margin: 0, color: '#9aa9bb', fontSize: 14 }}>نمایش GLB نرمال‌شده با نورپردازی خنثی؛ برای بررسی فرم، متریال، pivot و انیمیشن.</p>
        </div>
        <a href="/" style={{ color: '#b8d8ff', fontSize: 14, textDecoration: 'none' }}>بازگشت به بازی ↗</a>
      </header>

      <section style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16 }}>
        <div ref={hostRef} style={{ minHeight: 540, height: 'min(72vh, 760px)', border: '1px solid #263548', borderRadius: 14, overflow: 'hidden', background: '#0b1119', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(5,8,14,.9)', color: '#ffaaa5', padding: 24, textAlign: 'center' }}>بارگذاری ناموفق: {error}</div>}
          {!info && !error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9aa9bb', pointerEvents: 'none' }}>در حال بارگذاری مدل…</div>}
          <div style={{ position: 'absolute', left: 14, bottom: 12, color: '#718399', fontSize: 11, pointerEvents: 'none' }}>Drag: orbit · Wheel: zoom · Right-drag: pan</div>
          <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 10, flexWrap: 'wrap', background: 'rgba(5,10,17,.82)', border: '1px solid #263548', borderRadius: 8, padding: '7px 9px', color: '#b9c8d8', fontSize: 11, pointerEvents: 'none' }}>
            <span>FPS <b style={{ color: renderStats.fps >= 50 ? '#8ee6b0' : renderStats.fps >= 30 ? '#f0ce7a' : '#ff9b9b' }}>{renderStats.fps || '—'}</b></span>
            <span>Draw calls <b>{renderStats.drawCalls}</b></span>
            <span>Triangles <b>{renderStats.triangles.toLocaleString()}</b></span>
          </div>
        </div>

        <aside style={{ border: '1px solid #263548', borderRadius: 14, padding: 16, background: '#0e1621', alignSelf: 'start' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#8ea0b5', marginBottom: 6 }}>انتخاب مدل</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: '100%', background: '#172333', color: '#e5edf7', border: '1px solid #34465c', borderRadius: 8, padding: '10px 8px', marginBottom: 14 }}>
            {(['heroes', 'enemies', 'bosses', 'towers'] as const).map((category) => (
              <optgroup key={category} label={categoryLabel[category]}>
                {entries.filter((entry) => entry.category === category).map((entry) => <option key={entry.id} value={entry.id}>{entry.displayName.fa} · {entry.id}</option>)}
              </optgroup>
            ))}
          </select>

          <label style={{ display: 'block', fontSize: 12, color: '#8ea0b5', marginBottom: 6 }}>انیمیشن</label>
          <select value={animationName} onChange={(e) => setAnimationName(e.target.value)} disabled={!animationOptions.length} style={{ width: '100%', background: '#172333', color: '#e5edf7', border: '1px solid #34465c', borderRadius: 8, padding: '10px 8px', marginBottom: 14 }}>
            {animationOptions.length ? animationOptions.map((name) => <option key={name} value={name}>{name}</option>) : <option value="">بدون کلیپ</option>}
          </select>

          <div style={{ borderTop: '1px solid #263548', paddingTop: 12, display: 'grid', gap: 9, fontSize: 13 }}>
            <div><span style={{ color: '#7f91a6' }}>دسته: </span>{info ? categoryLabel[info.entry.category] : '—'}</div>
            <div><span style={{ color: '#7f91a6' }}>ارتفاع هدف: </span>{info ? info.entry.targetHeight.toFixed(2) : '—'} wu</div>
            <div><span style={{ color: '#7f91a6' }}>تعداد Mesh: </span>{info?.meshCount.toLocaleString() ?? '—'}</div>
            <div><span style={{ color: '#7f91a6' }}>تعداد رأس: </span>{info?.vertexCount.toLocaleString() ?? '—'}</div>
            <div><span style={{ color: '#7f91a6' }}>تعداد مثلث: </span>{info?.triangleCount.toLocaleString() ?? '—'}</div>
            <div><span style={{ color: '#7f91a6' }}>متریال‌ها: </span>{info?.materialCount ?? '—'}</div>
            <div><span style={{ color: '#7f91a6' }}>کلیپ‌ها: </span>{info?.animationNames.length ?? '—'}</div>
            <div><span style={{ color: '#7f91a6' }}>منبع انیمیشن: </span>{info ? sourceLabel : '—'}</div>
            <div style={{ color: '#718399', fontSize: 11, wordBreak: 'break-all' }}>{info?.entry.file ?? ''}</div>
          </div>

          {info?.animationSource === 'runtime-procedural' && <p style={{ color: '#d6b779', fontSize: 12, lineHeight: 1.7, margin: '14px 0 0' }}>این حرکت‌ها rigid-part هستند؛ برای کیفیت نهایی، rig اسکلتی و کلیپ‌های authored لازم‌اند.</p>}
        </aside>
      </section>
    </main>
  );
}
