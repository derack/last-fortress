import * as THREE from 'three';
import type { DamageType, ProjectileKind } from '../data/types';
import type { GameContext, DamageableEnemy } from './context';

// ============================================================
// پرتابه‌ها — گلوله/آتشین/برفک/توپ/زهر/پیکان/پرایسم/نفرین
// ------------------------------------------------------------
// همه انواع از یک کلاس Data-Driven استفاده می‌کنند:
// سرعت، هندسه، دنباله و نوع آسیب بر اساس kind
// ============================================================

interface ProjectileOpts {
  damage: number;
  splash?: number;
  burn?: number;
  slow?: number;
  slowDur?: number;
  poisonDps?: number;
  poisonDur?: number;
  pierceArmor?: boolean;
  dmgType?: DamageType;
  color: number;
}

const KIND_SPEED: Record<string, number> = {
  bullet: 55,
  frost: 32,
  fireball: 20,
  cannonball: 17,
  venom: 24,
  bolt: 70,
  prism: 40,
  hex: 30,
  shard: 35,
  beam: 80,
};

function kindGeometry(kind: string): THREE.BufferGeometry {
  switch (kind) {
    case 'bullet': return new THREE.SphereGeometry(0.14, 6, 6);
    case 'frost': return new THREE.OctahedronGeometry(0.22);
    case 'cannonball': return new THREE.SphereGeometry(0.42, 10, 8);
    case 'venom': return new THREE.IcosahedronGeometry(0.24, 0);
    case 'bolt': return new THREE.ConeGeometry(0.09, 0.85, 5);
    case 'prism': return new THREE.OctahedronGeometry(0.26);
    case 'hex': return new THREE.TetrahedronGeometry(0.26);
    default: return new THREE.SphereGeometry(0.34, 8, 8); // fireball / shard / beam
  }
}

export class Projectile {
  private mesh: THREE.Mesh;
  private target: DamageableEnemy | null;
  private lastTargetPos: THREE.Vector3;
  private speed: number;
  private opts: ProjectileOpts;
  private kind: ProjectileKind | string;
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
    this.speed = KIND_SPEED[kind] ?? 25;
    this.life = 4;

    const geo = kindGeometry(kind);
    const emissive = kind === 'fireball' || kind === 'cannonball' ? 2.2 : 1.6;
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.color,
      emissiveIntensity: emissive,
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

    // جهت‌گیری پیکان بالیستا
    if (this.kind === 'bolt') this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    // دنباله
    const trailRate = this.kind === 'bullet' ? 0 : this.kind === 'venom' ? 40 : 30;
    if (trailRate > 0 && Math.random() < dt * trailRate) {
      this.ctx.vfx.burst(this.mesh.position, this.opts.color, 1, { speed: 0.6, life: 0.3, size: 0.4, gravity: -1 });
    }
    if (this.mesh.position.y < 0.1) {
      this.impact(scene, this.mesh.position.clone().setY(0.2));
    }
  }

  private impact(scene: THREE.Scene, at: THREE.Vector3) {
    const dmgType: DamageType = this.opts.dmgType
      ?? (this.kind === 'fireball' ? 'fire' : this.kind === 'frost' ? 'ice' : 'physical');

    if (this.opts.splash) {
      // آسیب ناحیه‌ای
      for (const e of this.ctx.enemies) {
        if (!e.alive) continue;
        const d = e.getPos().distanceTo(at);
        if (d <= this.opts.splash) {
          const falloff = 1 - (d / this.opts.splash) * 0.45;
          e.takeDamage(this.opts.damage * falloff, dmgType);
          if (this.opts.burn) e.applyBurn(this.opts.burn, 3);
          if (this.opts.slow) e.applySlow(this.opts.slow, this.opts.slowDur ?? 2);
          if (this.opts.poisonDps) e.applyBurn(this.opts.poisonDps, this.opts.poisonDur ?? 4);
        }
      }
      this.ctx.vfx.explosion(at, this.opts.color, this.kind === 'fireball' || this.kind === 'cannonball');
      this.ctx.audio.play(this.kind === 'fireball' || this.kind === 'cannonball' ? 'cannon' : 'freeze');
    } else if (this.target && this.target.alive) {
      this.target.takeDamage(this.opts.damage, dmgType, this.opts.pierceArmor);
      if (this.opts.slow) this.target.applySlow(this.opts.slow, this.opts.slowDur ?? 2);
      if (this.opts.poisonDps) {
        this.target.applyBurn(this.opts.poisonDps, this.opts.poisonDur ?? 4);
        this.ctx.vfx.burst(at, 0x84cc16, 6, { speed: 2.5, life: 0.5, size: 0.45, gravity: 2 });
      }
      if (this.opts.burn) this.target.applyBurn(this.opts.burn, 3);
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
