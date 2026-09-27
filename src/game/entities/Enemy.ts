import * as THREE from 'three';
import type { EnemyData } from '../data/types';
import { tiered } from '../data/enemies';
import { characterFactory, type CharacterHandle } from '../assets';
import type { GameContext, DamageableEnemy } from './context';

// ============================================================
// دشمن — حرکت روی مسیر، وضعیت‌ها (کندی/سوزش/سپر)، رفتارهای ویژه
// ------------------------------------------------------------
// Rendering Layer: مدل از Asset Pipeline + Object Pool.
// Load Once → Cache → Clone → AnimationMixer مستقل (بخش ۱۳).
// Gameplay (HP/Armor/مسیر/وضعیت‌ها/Boss فاز۲/احضار) دست‌نخورده.
// ============================================================

let nextId = 1;

export class Enemy implements DamageableEnemy {
  id = nextId++;
  data: EnemyData;
  tier: number;
  maxHp: number;
  hp: number;
  armor: number;
  reward: number;
  speed: number;
  scale: number;
  dist = 0; // مسافت طی‌شده روی مسیر
  alive = true;
  shieldHp = 0;
  slowFactor = 1;
  slowUntil = 0;
  burnDps = 0;
  burnUntil = 0;
  shieldTimer = 0;
  private dodgeCd = 0;
  private slamTimer = 10;
  private phase2 = false;
  private walkPhase = Math.random() * 10;
  mesh: THREE.Group;
  private scene: THREE.Scene;
  private ctx: GameContext;
  private deathY = 0;
  private hitAnimCd = 0;
  /** Handle سیستم Asset — مدل واقعی/Placeholder + Pool + انیمیشن */
  private handle: CharacterHandle;

  constructor(data: EnemyData, tier: number, scene: THREE.Scene, ctx: GameContext) {
    this.data = data;
    this.tier = tier;
    const st = tiered(data, tier);
    this.maxHp = st.hp;
    this.hp = st.hp;
    this.armor = st.armor;
    this.speed = st.speed;
    this.reward = st.reward;
    this.scale = st.scale;
    this.scene = scene;
    this.ctx = ctx;
    // Asset Pipeline — از Pool یا ساخت جدید؛ GLB به‌محض آماده شدن سوار می‌شود
    this.handle = characterFactory.acquireEnemyHandle(data, tier);
    this.mesh = this.handle.root;
    scene.add(this.mesh);
    this.updateMeshPos();
    this.mesh.rotation.y = Math.atan2(
      ctx.pathPoints[1].x - ctx.pathPoints[0].x,
      ctx.pathPoints[1].z - ctx.pathPoints[0].z
    );
  }

  getPos(): THREE.Vector3 {
    return this.mesh.position;
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  get progress(): number {
    return this.dist / this.ctx.pathLength;
  }

  hasShield(): boolean {
    return this.shieldHp > 0;
  }

  applySlow(factor: number, duration: number) {
    if (factor < this.slowFactor || this.slowUntil < this.now() + duration * 0.5) {
      this.slowFactor = Math.min(this.slowFactor === 1 ? 99 : this.slowFactor, factor);
    }
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, this.now() + duration);
  }

  applyBurn(dps: number, duration: number) {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnUntil = Math.max(this.burnUntil, this.now() + duration);
  }

  private now() {
    return performance.now() / 1000;
  }

  /** آسیب بزن — true یعنی دشمن مرد */
  takeDamage(amount: number, type: string): boolean {
    if (!this.alive) return false;

    // جاخالی عنکبوت
    if (this.data.dodgeChance && this.dodgeCd <= 0 && Math.random() < this.data.dodgeChance) {
      this.dodgeCd = 1.2;
      this.ctx.vfx.hitSpark(this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x22d3ee);
      return false;
    }
    this.dodgeCd -= 0.016;

    // مقاومت جادویی
    const resist = this.data.resist?.[type as keyof typeof this.data.resist] ?? 1;
    let dmg = Math.max(1, amount * resist - this.armor * (type === 'physical' ? 1 : 0.4));

    // سپر (از جادوگر)
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      const aura = this.mesh.getObjectByName('shieldAura');
      if (aura) (aura as THREE.Mesh).visible = this.shieldHp > 0;
      if (dmg <= 0) {
        this.ctx.vfx.hitSpark(this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x8b5cf6);
        return false;
      }
    }

    this.hp -= dmg;
    if (this.hp <= 0) {
      this.die();
      return true;
    }

    // انیمیشن اصابت (فقط GLB — با نرخ محدود تا اسپم نشود)
    if (this.handle.hasAnimations && this.hitAnimCd <= 0) {
      this.hitAnimCd = 0.5;
      this.handle.animation?.playOneShot('hit', { fade: 0.08 });
    }

    // فاز دوم Boss
    if (this.data.boss && !this.phase2 && this.hpRatio < 0.5) {
      this.phase2 = true;
      this.armor = Math.round(this.armor * 1.25);
      this.ctx.vfx.ring(this.mesh.position, 0xf59e0b, 8, 0.7);
      this.ctx.vfx.explosion(this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xf59e0b, true);
      this.ctx.audio.play('bossRoar');
      this.ctx.cameraShake(0.8);
      this.handle.animation?.playOneShot('phasechange', { fade: 0.2 });
      if (!this.handle.animation?.isBusy()) {
        this.handle.animation?.playOneShot('roar', { fade: 0.2 });
      }
      // احضار سایه‌ها
      for (let i = 0; i < 4; i++) {
        this.summonMinion();
      }
    }
    return false;
  }

  private summonMinion() {
    const game = this.ctx as unknown as { summonAt?: (pos: THREE.Vector3) => void };
    game.summonAt?.(this.mesh.position.clone());
  }

  update(dt: number, time: number) {
    this.hitAnimCd = Math.max(0, this.hitAnimCd - dt);

    if (!this.alive) {
      // انیمیشن مرگ — GLB: پخش کلیپ + فرورفتن کند | Placeholder: فرورفتن سریع
      this.deathY -= dt * (this.handle.hasAnimations ? 1.4 : 3);
      this.mesh.position.y = this.deathY;
      this.handle.animation?.update(dt);
      if (this.deathY < -2.5) this.remove();
      return;
    }

    // وضعیت‌ها
    if (this.slowUntil < time) this.slowFactor = 1;
    if (this.burnUntil > time) {
      this.hp -= this.burnDps * dt;
      if (Math.random() < dt * 8) {
        this.ctx.vfx.burst(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xf97316, 1, { speed: 1.5, life: 0.4, size: 0.4, gravity: -2 });
      }
      if (this.hp <= 0) {
        this.die();
        return;
      }
    }
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);

    // حرکت روی مسیر
    const effSpeed = this.speed * this.slowFactor;
    this.dist += effSpeed * dt;
    if (this.dist >= this.ctx.pathLength) {
      this.ctx.onEnemyLeak(this);
      return;
    }

    // Boss — ضربه زمین دوره‌ای
    if (this.data.boss) {
      this.slamTimer -= dt;
      if (this.slamTimer <= 0) {
        this.slamTimer = 12;
        this.slam();
      }
    }

    // جادوگر — سپر به هم‌رزما
    if (this.data.shieldGiver) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = this.data.shieldGiver.interval;
        this.giveShields();
      }
    }

    this.updateMeshPos();
    this.animate(dt, effSpeed);
  }

  private updateMeshPos() {
    const pts = this.ctx.pathPoints;
    const u = (this.dist / this.ctx.pathLength) * (pts.length - 1);
    const i = Math.min(Math.floor(u), pts.length - 2);
    const f = u - i;
    const a = pts[i];
    const b = pts[i + 1];
    this.mesh.position.set(
      a.x + (b.x - a.x) * f,
      this.data.flying ? 5.5 + Math.sin(this.walkPhase * 2) * 0.4 : 0,
      a.z + (b.z - a.z) * f
    );
    // چرخش به سمت جلو
    if (i < pts.length - 1) {
      const targetRot = Math.atan2(b.x - a.x, b.z - a.z);
      let diff = targetRot - this.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * 0.15;
    }
  }

  private animate(dt: number, speed: number) {
    this.walkPhase += dt * speed * 2.2;

    if (this.handle.hasAnimations) {
      // GLB — انیمیشن اسکلتی با هماهنگی سرعت واقعی حرکت
      const anim = this.handle.animation!;
      anim.playLocomotion(speed > 3.6 ? 'run' : 'walk', speed / Math.max(0.01, this.data.speed));
      anim.update(dt);
    } else {
      // Placeholder — انیمیشن پروسیجرال بخش‌ها
      const parts = this.handle.proceduralAnimParts;
      for (const p of parts) {
        switch (p.kind) {
          case 'leg':
            p.node.rotation.x = Math.sin(this.walkPhase * 2) * 0.55;
            break;
          case 'leg2':
            p.node.rotation.x = -Math.sin(this.walkPhase * 2) * 0.55;
            break;
          case 'arm':
            p.node.rotation.x = Math.sin(this.walkPhase * 2 + 1) * 0.4;
            break;
          case 'arm2':
            p.node.rotation.x = -Math.sin(this.walkPhase * 2 + 1) * 0.4;
            break;
          case 'wing':
            p.node.rotation.z = Math.sin(this.walkPhase * 3) * 0.5;
            break;
          case 'wing2':
            p.node.rotation.z = -Math.sin(this.walkPhase * 3) * 0.5;
            break;
          case 'bob':
            p.node.position.y = 1 + Math.sin(this.walkPhase * 2.5) * 0.12;
            break;
          case 'pulse':
            p.node.scale.setScalar(1 + Math.sin(this.walkPhase * 4) * 0.25);
            break;
        }
      }
    }
    if (this.data.flying) {
      this.mesh.position.y = 5.5 + Math.sin(this.walkPhase * 2) * 0.4;
    }
  }

  private slam() {
    const pos = this.mesh.position.clone();
    this.ctx.vfx.ring(pos, 0xf59e0b, 9, 0.6);
    this.ctx.vfx.burst(pos, 0xa8a29e, 26, { speed: 8, life: 0.6, size: 0.7, gravity: 10 });
    this.ctx.audio.play('explosion');
    this.ctx.cameraShake(0.7);
    this.handle.animation?.playOneShot('specialattack', { fade: 0.15 });
    if (!this.handle.animation?.isBusy()) {
      this.handle.animation?.playOneShot('attack1', { fade: 0.15 });
      if (!this.handle.animation?.isBusy()) {
        this.handle.animation?.playOneShot('attack', { fade: 0.15 });
      }
    }
    // تقویت سرعت موقت
    this.speed *= 1.35;
    setTimeout(() => {
      if (this.alive) this.speed /= 1.35;
    }, 3000);
  }

  private giveShields() {
    const radius = this.data.shieldGiver!.radius;
    const amount = this.data.shieldGiver!.amount;
    let any = false;
    for (const e of this.ctx.enemies) {
      if (!e.alive || e === (this as unknown as DamageableEnemy)) continue;
      if (e.getPos().distanceTo(this.mesh.position) <= radius) {
        const enemy = e as Enemy;
        enemy.shieldHp = amount;
        const aura = enemy.mesh.getObjectByName('shieldAura');
        if (aura) (aura as THREE.Mesh).visible = true;
        any = true;
      }
    }
    if (any) {
      this.ctx.vfx.ring(this.mesh.position, 0x8b5cf6, radius, 0.5);
    }
  }

  die(byPlayer = true) {
    if (!this.alive) return;
    this.alive = false;
    if (byPlayer) this.ctx.onEnemyKilled(this);
    this.deathY = this.mesh.position.y;
    this.ctx.vfx.explosion(this.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), this.data.accent, !!this.data.boss);
    this.ctx.audio.play(this.data.boss ? 'bossRoar' : 'death');
    if (this.data.boss) this.ctx.cameraShake(1.0);
    // انیمیشن مرگ GLB — Freeze روی فریم آخر و سپس فرورفتن
    if (!this.handle.animation?.playDeath()) {
      // Placeholder — همان فرو رفتن قدیمی
    }
  }

  remove() {
    // Object Pool — Handleهای GLB به Pool برمی‌گردند، Placeholderها نابود می‌شوند
    this.scene.remove(this.mesh);
    characterFactory.releaseEnemyHandle(this.handle);
  }
}
