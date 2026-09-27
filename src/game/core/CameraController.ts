import * as THREE from 'three';

// ============================================================
// کنترل دوربین ایزومتریک — Pan / Zoom / Shake
// برای Android Touch بهینه شده
// ============================================================

export class CameraController {
  camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3(0, 0, 0);
  desiredTarget = new THREE.Vector3(0, 0, 0);
  private radius = 42;
  private desiredRadius = 42;
  private yaw = Math.PI * 0.25;
  private pitch = 0.95; // رادیان — نمای تاکتیکی
  private minRadius = 16;
  private maxRadius = 62;
  private shakeAmount = 0;
  private shakeTime = 0;
  private bounds = 34;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 1, 300);
    this.updatePosition();
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  pan(dx: number, dz: number) {
    // تبدیل حرکت صفحه به حرکت XZ نسبت به yaw دوربین
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const scale = this.radius * 0.0016;
    this.desiredTarget.x += (-dx * cos - dz * sin) * scale;
    this.desiredTarget.z += (dx * sin - dz * cos) * scale;
    this.clampTarget();
  }

  zoom(factor: number) {
    this.desiredRadius = THREE.MathUtils.clamp(this.desiredRadius * factor, this.minRadius, this.maxRadius);
  }

  shake(amount: number) {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  }

  reset() {
    this.desiredTarget.set(6, 0, 0);
    this.desiredRadius = 42;
    this.shakeAmount = 0;
  }

  setBounds(b: number) {
    this.bounds = b;
    this.clampTarget();
  }

  private clampTarget() {
    this.desiredTarget.x = THREE.MathUtils.clamp(this.desiredTarget.x, -this.bounds, this.bounds);
    this.desiredTarget.z = THREE.MathUtils.clamp(this.desiredTarget.z, -this.bounds, this.bounds);
  }

  private updatePosition() {
    const r = this.radius;
    const y = Math.sin(this.pitch) * r;
    const flat = Math.cos(this.pitch) * r;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * flat,
      y,
      this.target.z + Math.cos(this.yaw) * flat
    );
    this.camera.lookAt(this.target);
  }

  update(dt: number) {
    // نرم‌سازی
    this.target.lerp(this.desiredTarget, Math.min(1, dt * 7));
    this.radius += (this.desiredRadius - this.radius) * Math.min(1, dt * 8);

    // لرزش
    let sx = 0, sy = 0, sz = 0;
    if (this.shakeAmount > 0.001) {
      this.shakeTime += dt * 30;
      const a = this.shakeAmount;
      sx = Math.sin(this.shakeTime * 4.1) * a * 0.6;
      sy = Math.sin(this.shakeTime * 5.7 + 1.3) * a * 0.4;
      sz = Math.cos(this.shakeTime * 3.3 + 2.1) * a * 0.6;
      this.shakeAmount *= Math.pow(0.001, dt); // decay سریع
      if (this.shakeAmount < 0.001) this.shakeAmount = 0;
    }

    const saveX = this.target.x, saveZ = this.target.z;
    this.target.x += sx; this.target.y = sy; this.target.z += sz;
    this.updatePosition();
    this.target.set(saveX, 0, saveZ);
  }
}
