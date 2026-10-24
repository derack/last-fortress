// QA render harness — سبک‌شده: بدون PMREM، با checkpoint
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

window.__stage = 'boot'; document.title = 'STAGE:' + window.__stage;
const GLB_B64 = window.__GLB_B64__;
const bin = Uint8Array.from(atob(GLB_B64), c => c.charCodeAt(0)).buffer;
window.__stage = 'decoded'; document.title = 'STAGE:' + window.__stage;

const W = 500, H = 640, COLS = 3, ROWS = 2;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
renderer.setSize(W * COLS, H * ROWS);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);
window.__stage = 'renderer'; document.title = 'STAGE:' + window.__stage;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2130);
// نورپردازی استودیویی بدون IBL — کلید + فیل + ریم + همی
const key = new THREE.DirectionalLight(0xfff0dc, 3.0); key.position.set(2.4, 3.4, 2.6); scene.add(key);
const fill = new THREE.DirectionalLight(0xbfd4ff, 1.1); fill.position.set(-2.6, 1.2, 1.4); scene.add(fill);
const rim = new THREE.DirectionalLight(0x9fc2ff, 2.2); rim.position.set(0.2, 2.6, -3.0); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffd9a0, 1.0); rim2.position.set(-1.6, 2.2, -2.2); scene.add(rim2);
scene.add(new THREE.HemisphereLight(0x46536e, 0x11151d, 1.15));
window.__stage = 'lights'; document.title = 'STAGE:' + window.__stage;

const floor = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshStandardMaterial({ color: 0x252d3d, roughness: 0.95, metalness: 0 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.755, 48), new THREE.MeshBasicMaterial({ color: 0x3a6ea8, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; scene.add(ring);
window.__stage = 'floor'; document.title = 'STAGE:' + window.__stage;

new GLTFLoader().parse(bin, '', (gltf) => {
  const model = gltf.scene;
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
  scene.add(model);
  window.__stage = 'model-added'; document.title = 'STAGE:' + window.__stage;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = size.y;
  const views = [
    { az: 0, el: 0.10, tag: 'FRONT' },
    { az: Math.PI / 4, el: 0.13, tag: '3-4 VIEW' },
    { az: Math.PI / 2, el: 0.10, tag: 'SIDE' },
    { az: Math.PI, el: 0.12, tag: 'BACK' },
    { az: Math.PI / 4.5, el: 0.14, tag: 'WALK t=0.21', anim: ['Walk', 0.21] },
    { az: Math.PI / 4.5, el: 0.14, tag: 'ATTACK t=0.40', anim: ['Attack', 0.40] },
  ];
  const mixer = new THREE.AnimationMixer(model);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 40);
  for (let idx = 0; idx < views.length; idx++) {
    const v = views[idx];
    if (v.anim) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, v.anim[0]);
      if (clip) { const a = mixer.clipAction(clip); a.play(); mixer.setTime(v.anim[1]); a.stop(); mixer.update(0); }
    }
    const dist = height * 2.5;
    cam.position.set(center.x + Math.sin(v.az) * dist, center.y + Math.sin(v.el) * dist * 0.42, center.z + Math.cos(v.az) * dist);
    cam.lookAt(center.x, height * 0.52, center.z);
    const cx = (idx % COLS) * W, cyS = Math.floor(idx / COLS) * H;
    renderer.setViewport(cx, H * ROWS - cyS - H, W, H);
    renderer.setScissor(cx, H * ROWS - cyS - H, W, H);
    renderer.setScissorTest(true);
    renderer.render(scene, cam);
  }
  window.__stage = 'rendered'; document.title = 'STAGE:rendered'; document.title = 'STAGE:' + window.__stage;
}, (err) => { window.__stage = 'PARSE-ERROR'; document.title = 'STAGE:PARSE-ERROR'; });
