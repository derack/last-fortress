'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ASSETS,
  allAssetEntries,
  assetManager,
  validateAsset,
  ASSET_SPECS,
  type CharacterAssetEntry,
  type AssetValidationReport,
  type AssetStatus,
} from '@/game/assets';
import { characterFactory } from '@/game/assets/CharacterFactory';
import { createFallbackHero, createFallbackEnemy, createTowerFallback } from '@/game/assets/FallbackFactory';
import { CharacterAnimationController } from '@/game/assets/CharacterAnimationController';
import { normalizeModel } from '@/game/assets/ModelNormalizer';
import { ENEMIES } from '@/game/data/enemies';
import { t, faNum } from '@/game/data/i18n';

// ============================================================
// Character Gallery — صفحه Debug/Developer (بخش ۲۵ و ۲۶)
// نمایش همه Assetها: مدل سه‌بعدی، چرخش/زوم، انتخاب انیمیشن،
// نام/نوع/Tier/وضعیت Asset + پنل اعتبارسنجی کامل
// ============================================================

type StatusKind = 'real' | 'placeholder' | 'missing' | 'error' | 'loading';

function statusOf(entry: CharacterAssetEntry): StatusKind {
  const s = assetManager.status(entry.id);
  if (s === 'ready') return 'real';
  if (s === 'missing') return entry.phase === 'slice' ? 'placeholder' : 'missing';
  if (s === 'error') return 'error';
  if (s === 'loading') return 'loading';
  return 'missing';
}

const STATUS_STYLE: Record<StatusKind, { cls: string; key: string }> = {
  real: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', key: 'assetStatusReal' },
  placeholder: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', key: 'assetStatusPlaceholder' },
  missing: { cls: 'bg-slate-500/15 text-slate-400 border-slate-500/40', key: 'assetStatusMissing' },
  error: { cls: 'bg-red-500/15 text-red-300 border-red-500/40', key: 'assetStatusError' },
  loading: { cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40', key: 'assetStatusLoading' },
};

export function CharacterGallery({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const animRef = useRef<CharacterAnimationController | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rafRef = useRef(0);

  const [selectedId, setSelectedId] = useState('arman');
  const [animName, setAnimName] = useState<string>('');
  const [animOptions, setAnimOptions] = useState<string[]>([]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [tick, setTick] = useState(0); // رفرش وضعیت‌ها
  const [reports, setReports] = useState<AssetValidationReport[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [statusVersion, setStatusVersion] = useState(0);

  const entries = useMemo(() => allAssetEntries(), []);
  const entry = useMemo(() => entries.find((e) => e.id === selectedId)!, [entries, selectedId]);
  const spec = ASSET_SPECS[entry.specId];

  // اشتراک در تغییر وضعیت AssetManager — لیست زنده شود
  useEffect(() => {
    const off = assetManager.onStatus(() => setStatusVersion((v) => v + 1));
    return () => {
      off();
    };
  }, []);

  // ---------------- صحنه پیش‌نمایش ----------------
  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    import('three/examples/jsm/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
      scene.environmentIntensity = 0.6;
      pmrem.dispose();
    });

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.6, 4.2);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.target.set(0, 0.9, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x2a2430, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2d9, 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 1.1);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    // سکوی نمایش
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.9, 0.14, 40),
      new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.4, metalness: 0.7 })
    );
    disc.position.y = -0.07;
    disc.receiveShadow = true;
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.02, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.6, roughness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    const root = new THREE.Group();
    scene.add(root);
    modelRootRef.current = root;

    const resize = () => {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      controls.update();
      animRef.current?.update(1 / 60);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      animRef.current?.dispose();
    };
  }, []);

  // ---------------- نمایش مدل انتخاب‌شده ----------------
  useEffect(() => {
    const root = modelRootRef.current;
    if (!root) return;

    let cancelled = false;
    animRef.current?.dispose();
    animRef.current = null;
    setAnimOptions([]);
    setAnimName('');

    const clear = () => {
      for (const c of [...root.children]) {
        if (c.userData.isGlbClone) {
          root.remove(c); // منابع مشترک — dispose نمی‌شود
        } else {
          c.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              const m = o.material;
              if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
              else m.dispose();
            }
          });
          root.remove(c);
        }
      }
    };

    const build = async () => {
      // ۱) تلاش برای GLB واقعی (lazy — فایل‌های آینده هم اینجا تلاش می‌شوند)
      const rec = await assetManager.load(entry);
      if (cancelled) return;
      clear();

      if (rec.status === 'ready' && rec.source) {
        const inst = assetManager.instantiate(entry)!;
        const norm = normalizeModel(inst.scene, entry, 1);
        root.add(norm.inner);
        root.userData.isGlbClone = true;
        const anim = new CharacterAnimationController(root, inst.animations);
        animRef.current = anim;
        anim.playLocomotion('idle');
        const names = inst.animations.map((c) => c.name);
        setAnimOptions(names);
        if (names.length) setAnimName(names[0]);
        return;
      }
      root.userData.isGlbClone = false;

      // ۲) Placeholder شفاف برای محتوای فعلی
      if (entry.category === 'heroes') {
        const fb = createFallbackHero();
        root.add(fb.group);
      } else if (entry.category === 'towers') {
        const fb = createTowerFallback(entry.id, 1);
        root.add(fb.group);
      } else if (ENEMIES[entry.id]) {
        const fb = createFallbackEnemy(ENEMIES[entry.id], 1);
        root.add(fb.group);
      } else {
        // ۳) محتوای آینده بدون فایل — قاب سیمی شفاف به‌عنوان جای خالی
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(entry.targetHeight * 0.55, entry.targetHeight, entry.targetHeight * 0.45),
          new THREE.MeshBasicMaterial({ color: 0x3f3f46, wireframe: true, transparent: true, opacity: 0.4 })
        );
        box.position.y = entry.targetHeight / 2;
        box.name = 'awaitingGlb';
        root.add(box);
      }
      controlsRef.current?.target.set(0, Math.max(0.5, entry.targetHeight * 0.55), 0);
    };

    void build();
    return () => {
      cancelled = true;
    };
  }, [entry, statusVersion]);

  // تنظیم ارتفاع هدف دوربین با تغییر مدل
  useEffect(() => {
    controlsRef.current?.target.set(0, Math.max(0.5, entry.targetHeight * 0.55), 0);
  }, [entry]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  // پخش انیمیشن انتخاب‌شده
  const playAnim = useCallback(
    (name: string) => {
      setAnimName(name);
      const anim = animRef.current;
      if (!anim) return;
      const n = name.toLowerCase();
      if (n.includes('death') || n.includes('die')) anim.playDeath();
      else if (n.includes('walk')) anim.playLocomotion('walk');
      else if (n.includes('run')) anim.playLocomotion('run');
      else if (n.includes('idle')) anim.playLocomotion('idle');
      else anim.playOneShot(name, { fade: 0.15 });
    },
    []
  );

  // اعتبارسنجی کامل
  const runValidation = useCallback(async () => {
    setValidating(true);
    const out: AssetValidationReport[] = [];
    for (const e of entries) {
      out.push(await validateAsset(e));
      setTick((v) => v + 1);
    }
    setReports(out);
    setValidating(false);
  }, [entries]);

  const grouped: { key: keyof typeof ASSETS; label: string }[] = [
    { key: 'heroes', label: t('catHeroes') },
    { key: 'enemies', label: t('catEnemies') },
    { key: 'bosses', label: t('catBosses') },
    { key: 'towers', label: t('catTowers') },
  ];

  const st = statusOf(entry);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0b0d13]">
      {/* هدر */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-amber-300">{t('gallery')}</h1>
          <p className="text-xs text-slate-400">{t('galleryDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runValidation}
            disabled={validating}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-300 active:scale-95 disabled:opacity-50"
          >
            {validating ? '...' : t('assetValidationRun')}
          </button>
          <button onClick={onClose} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 active:scale-95">
            {t('close')}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* لیست Assetها */}
        <div className="flex max-h-40 shrink-0 overflow-y-auto border-b border-white/10 lg:max-h-none lg:w-64 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-l">
          {grouped.map((g) => (
            <div key={g.key} className="lg:mb-2">
              <div className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g.label}</div>
              {ASSETS[g.key].map((e) => {
                const s = statusOf(e);
                const active = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-right text-xs transition ${
                      active ? 'bg-amber-500/10 text-amber-200' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">
                      {e.displayName.fa}
                      <span className="mr-1 text-[10px] text-slate-500">{e.displayName.en}</span>
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                      s === 'real' ? 'bg-emerald-400' : s === 'placeholder' ? 'bg-amber-400' : s === 'error' ? 'bg-red-400' : 'bg-slate-500'
                    }`} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* نمایشگر سه‌بعدی + جزئیات */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
            <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-slate-500">{t('galleryHint')}</div>
            <button
              onClick={() => setAutoRotate((v) => !v)}
              className={`absolute top-2 left-2 rounded-md border px-2 py-1 text-[10px] ${
                autoRotate ? 'border-amber-500/50 bg-amber-500/15 text-amber-300' : 'border-white/15 bg-white/5 text-slate-400'
              }`}
            >
              {t('assetRotate')}
            </button>
            {/* نشان وضعیت */}
            <div className={`absolute top-2 right-2 rounded-md border px-2 py-1 text-[10px] font-bold ${STATUS_STYLE[st].cls}`}>
              {t(STATUS_STYLE[st].key)}
            </div>
          </div>

          {/* انتخاب انیمیشن */}
          <div className="border-t border-white/10 px-4 py-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('assetAnimations')}</div>
            {animOptions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {animOptions.map((n) => (
                  <button
                    key={n}
                    onClick={() => playAnim(n)}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      animName === n ? 'border-amber-500/50 bg-amber-500/15 text-amber-200' : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">{t('assetNoAnimations')}</div>
            )}
          </div>

          {/* جزئیات */}
          <div className="max-h-52 overflow-y-auto border-t border-white/10 px-4 py-3" key={tick}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-white">{entry.displayName.fa}</span>
              <span className="text-xs text-slate-400">{entry.displayName.en}</span>
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">{entry.tier}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300">
              <div>
                {t('assetFile')}: <span className="text-slate-400" dir="ltr">{entry.file.split('/').pop()}</span>
              </div>
              <div>
                {t('assetHeight')}: {faNum(entry.targetHeight)}{' '}
                {st === 'real' && reports?.find((r) => r.entryId === entry.id)?.tris !== undefined
                  ? `— ${faNum(reports.find((r) => r.entryId === entry.id)!.tris!)} ${t('assetTris')}`
                  : ''}
              </div>
            </div>

            {spec && (
              <div className="mt-2 space-y-1.5 text-xs">
                <p className="text-slate-300">
                  <span className="font-bold text-amber-300/90">{t('assetSpecIdentity')}: </span>
                  {spec.identity}
                </p>
                <p className="text-slate-400">
                  <span className="font-bold text-slate-300">{t('assetSpecSilhouette')}: </span>
                  {spec.silhouette}
                </p>
                <p className="text-slate-400">
                  <span className="font-bold text-slate-300">{t('assetPolyBudget')}: </span>
                  {faNum(spec.polyBudgetTris)} {t('assetTris')} — {t('assetTextureSize')}: {faNum(spec.textureSize)}
                </p>
                <p className="text-slate-400">
                  <span className="font-bold text-slate-300">{t('assetVfxPoints')}: </span>
                  <span dir="ltr">{entry.vfxPoints.join(' · ')}</span>
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {spec.materials.map((m) => (
                    <span key={m.part} className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-sm border border-white/20" style={{ background: m.color }} />
                      {m.part}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* گزارش اعتبارسنجی */}
            {reports && (
              <div className="mt-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('assetValidation')}</div>
                {reports
                  .filter((r) => r.entryId === entry.id)
                  .map((r) => (
                    <div key={r.entryId} className="space-y-1">
                      {r.checks.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-xs">
                          <span className={c.level === 'pass' ? 'text-emerald-400' : c.level === 'warn' ? 'text-amber-400' : 'text-red-400'}>
                            {c.level === 'pass' ? '✓' : c.level === 'warn' ? '!' : '✗'}
                          </span>
                          <span className="text-slate-300">
                            {c.label}
                            {c.detail && <span className="text-slate-500"> — {c.detail}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
