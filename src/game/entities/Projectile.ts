import * as THREE from 'three';
import type { GameContext, DamageableEnemy } from './context';

// ============================================================
// پرتابه‌ها — گلوله، گلوله آتشین، برفک — با Object Pool
// ============================================================

interface ProjectileOpts {
  damage: number;
  splash?: number;
  burn?: number;
  slow?: number;
  slowDur?: number;
  color: number;
}

export class Projectile {
  private mesh: THREE.Mesh;
  private target: DamageableEnemy | null;
  private lastTargetPos: THREE.Vector3;
  private speed: number;
  private opts: ProjectileOpts;
  private kind: string;
  private alive = true;
  private life = 4;
  private ctx: GameContext;
  private velocity = new THREE.Vector3();

  constructor(kind: string, from: THREE.Vector3, target: DamageableEnemy | null, opts: ProjectileOpts, ctx: GameContext, scene: THREE.Scene) {
    this.kind = kind;
    this.opts = opts;
    this.ctx = ctx;
    this.target = target;
    // بدون هدف: به نقطه زمین زیر نقطه شلیک سقوط می‌کند (باران آتش)
    this.lastTargetPos = target
      ? target.getPos().clone()
      : from.clone().setY(0.2);
    this.speed = kind === 'bullet' ? 55 : kind === 'frost' ? 32 : 20;
    this.life = 4;

    const geo = kind === 'bullet'
      ? new THREE.SphereGeometry(0.14, 6, 6)
      : kind === 'frost'
        ? new THREE.OctahedronGeometry(0.22)
        : new THREE.SphereGeometry(0.34, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.color,
      emissiveIntensity: kind === 'fireball' ? 2.2 : 1.6,
      roughness: 0.4,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(from);
    scene.add(this.mesh);
  }

  get isAlive() {
    return this.alive;
  }

  update(dt: number, scene: THREE.Scene) {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.destroy(scene);
      return;
    }

    const aim = this.target && this.target.alive ? this.target.getPos().clone().add(new THREE.Vector3(0, 1, 0)) : this.lastTargetPos;
    this.lastTargetPos.copy(aim);
    const dir = aim.clone().sub(this.mesh.position);
    const dist = dir.length();
    dir.normalize();

    if (dist < Math.max(0.6, this.speed * dt)) {
      this.impact(scene, aim);
      return;
    }
    this.velocity.copy(dir).multiplyScalar(this.speed);
    this.mesh.position.addScaledVector(this.velocity, dt);

    // دنباله
    if (this.kind !== 'bullet' && Math.random() < dt * 30) {
      this.ctx.vfx.burst(this.mesh.position, this.opts.color, 1, { speed: 0.6, life: 0.3, size: 0.4, gravity: -1 });
    }
    if (this.mesh.position.y < 0.1) {
      this.impact(scene, this.mesh.position.clone().setY(0.2));
    }
  }

  private impact(scene: THREE.Scene, at: THREE.Vector3) {
    if (this.opts.splash) {
      // آسیب ناحیه‌ای
      for (const e of this.ctx.enemies) {
        if (!e.alive) continue;
        const d = e.getPos().distanceTo(at);
        if (d <= this.opts.splash) {
          const falloff = 1 - (d / this.opts.splash) * 0.45;
          e.takeDamage(this.opts.damage * falloff, this.kind === 'fireball' ? 'fire' : 'ice');
          if (this.opts.burn) e.applyBurn(this.opts.burn, 3);
          if (this.opts.slow) e.applySlow(this.opts.slow, this.opts.slowDur ?? 2);
        }
      }
      this.ctx.vfx.explosion(at, this.opts.color, this.kind === 'fireball');
      this.ctx.audio.play(this.kind === 'fireball' ? 'cannon' : 'freeze');
    } else if (this.target && this.target.alive) {
      this.target.takeDamage(this.opts.damage, this.kind === 'frost' ? 'ice' : 'physical');
      if (this.opts.slow) this.target.applySlow(this.opts.slow, this.opts.slowDur ?? 2);
    }
    this.destroy(scene);
  }

  private destroy(scene: THREE.Scene) {
    this.alive = false;
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
