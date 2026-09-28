import * as THREE from 'three';
import { CameraController } from './CameraController';

// ============================================================
// کنترل ورودی لمسی/موس — Tap / Drag(Pan) / Pinch(Zoom)
// تشخیص Tap: جابجایی کمتر از آستانه و زمان کوتاه
// ============================================================

export interface TapHit {
  ground: THREE.Vector3;
  objects: { object: THREE.Object3D; point: THREE.Vector3 }[];
}

export class InputController {
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointers = new Map<number, { x: number; y: number }>();
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private pinchStartDist = 0;
  private pinchMoved = false;
  /** پیش‌نمایش محل ساخت — هنگام حرکت اشاره‌گر صدا می‌خورد (موسی/درگ موبایل) */
  onGroundHover: ((ground: THREE.Vector3) => void) | null = null;

  constructor(
    private dom: HTMLElement,
    private cameraCtrl: CameraController,
    private onTap: (hit: TapHit) => void,
    private scene: THREE.Scene
  ) {
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onCancel);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onDown);
    this.dom.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('pointerup', this.onUp);
    this.dom.removeEventListener('pointercancel', this.onCancel);
    this.dom.removeEventListener('wheel', this.onWheel);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.cameraCtrl.zoom(1 + Math.sign(e.deltaY) * 0.12);
  };

  private onDown = (e: PointerEvent) => {
    this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.startX = this.lastX = e.clientX;
      this.startY = this.lastY = e.clientY;
      this.startTime = performance.now();
      this.moved = false;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchMoved = false;
    }
  };

  private onMove = (e: PointerEvent) => {
    // موس — hover بدون فشردن دکمه (پیش‌نمایش محل ساخت روی دسکتاپ)
    if (e.pointerType === 'mouse' && this.pointers.size === 0) {
      if (this.onGroundHover) {
        const pt = this.pickGround(e.clientX, e.clientY);
        if (pt) this.onGroundHover(pt);
      }
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const total = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      if (total > 10) this.moved = true;
      if (this.moved) this.cameraCtrl.pan(dx, dy);
      // پیش‌نمایش محل ساخت زیر انگشت هنگام درگ
      if (this.onGroundHover) {
        const pt = this.pickGround(e.clientX, e.clientY);
        if (pt) this.onGroundHover(pt);
      }
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchStartDist > 0 && Math.abs(dist - this.pinchStartDist) > 4) {
        this.cameraCtrl.zoom(this.pinchStartDist / dist);
        this.pinchStartDist = dist;
        this.pinchMoved = true;
      }
    }
  };

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
  };

  private onUp = (e: PointerEvent) => {
    const wasTwo = this.pointers.size === 2;
    this.pointers.delete(e.pointerId);
    if (wasTwo) {
      this.moved = true; // بعد از pinch تپ حساب نشود
      return;
    }
    if (this.pointers.size > 0) return;

    const dt = performance.now() - this.startTime;
    const total = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
    if (!this.moved && dt < 400 && total < 12) {
      const hit = this.pick(e.clientX, e.clientY);
      if (hit) this.onTap(hit);
    }
  };

  /** فقط نقطه زمین — بدون برخورد با اشیاء (سبک، برای hover هر حرکت) */
  private pickGround(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, pt) ? pt : null;
  }

  /** پرتاب پرتو: نقطه زمین + برخورد با اشیاء قابل انتخاب */
  private pick(clientX: number, clientY: number): TapHit | null {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);

    const groundPt = new THREE.Vector3();
    const ok = this.raycaster.ray.intersectPlane(this.groundPlane, groundPt);

    // اشیاء انتخاب‌پذیر: گروه‌هایی که userData.selectable دارند
    const selectables: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.userData && o.userData.selectable) selectables.push(o);
    });
    const hits = this.raycaster.intersectObjects(selectables, true);
    // پیدا کردن ریشه selectable
    const objects = hits.slice(0, 3).map((h) => {
      let root: THREE.Object3D = h.object;
      while (root.parent && !root.userData.selectable) root = root.parent;
      return { object: root, point: h.point.clone() };
    });

    if (!ok) return objects.length ? { ground: objects[0].point, objects } : null;
    return { ground: groundPt, objects };
  }
}
