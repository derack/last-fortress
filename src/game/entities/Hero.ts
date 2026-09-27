import * as THREE from 'three';
import { HEROES } from '../data/magic';
import { characterFactory, type CharacterHandle } from '../assets';
import type { GameContext, DamageableEnemy } from './context';

// ============================================================
// قهرمان آرمان — استقرار، حرکت، حمله خودکار، XP، فرمان نبرد
// ------------------------------------------------------------
// Rendering Layer: مدل از Asset Pipeline می‌آید (arman.glb یا
// Placeholder شفاف در انتظار GLB). Gameplay (HP/XP/حرکت/حمله/
// توانایی) بدون تغییر باقی مانده است.
// ============================================================

export class Hero {
  mesh: THREE.Group;
  level = 1;
  xp = 0;
  hp: number;
  maxHp: number;
  damage: number;
  position = new THREE.Vector3(10, 0, 8);
  private moveTarget: THREE.Vector3 | null = null;
  private cooldown = 0;
  abilityCd = 0;
  abilityActiveTime = 0;
  private data = HEROES.arman;
  private ctx: GameContext;
  private walkPhase = 0;
  private muzzleFlash = 0;
  deployed = false;
  /** Handle سیستم Asset — مدیریت مدل واقعی/Placeholder و انیمیشن */
  private handle: CharacterHandle;
  private tmpV = new THREE.Vector3();

  constructor(scene: THREE.Scene, ctx: GameContext) {
    this.ctx = ctx;
    this.maxHp = this.data.hp;
    this.hp = this.data.hp;
    this.damage = this.data.damage;
    // Asset Pipeline — مدل واقعی GLB به‌محض آماده شدن درجا سوار می‌شود
    this.handle = characterFactory.createHeroHandle('arman');
    this.mesh = this.handle.root;
    this.mesh.position.copy(this.position);
    this.mesh.visible = false; // تا استقرار نیافته پنهان
    scene.add(this.mesh);
  }

  get range(): number {
    return this.data.range + this.level * 0.3;
  }

  get fireRate(): number {
    return this.data.fireRate * (1 + (this.level - 1) * 0.04);
  }

  get abilityReady(): boolean {
    return this.abilityCd <= 0;
  }

  deploy(pos: THREE.Vector3) {
    this.position.copy(pos);
    this.position.y = 0;
    this.mesh.visible = true;
    this.deployed = true;
    this.ctx.vfx.ring(pos, 0xffb020, 3, 0.6);
    this.ctx.vfx.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffb020, 20, { speed: 4, life: 0.6, size: 0.5, gravity: 4 });
  }

  moveTo(pos: THREE.Vector3) {
    this.moveTarget = pos.clone();
    this.moveTarget.y = 0;
  }

  gainXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.data.xpPerLevel * this.level) {
      this.xp -= this.data.xpPerLevel * this.level;
      this.levelUp();
    }
  }

  private levelUp() {
    this.level++;
    this.maxHp += 55;
    this.hp = Math.min(this.maxHp, this.hp + 120);
    this.damage += 7;
    this.ctx.vfx.ring(this.position, 0xfbbf24, 4.5, 0.8);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xfbbf24, 26, { speed: 5, life: 0.8, size: 0.5, gravity: 2, up: 1 });
  }

  useAbility(): boolean {
    if (this.abilityCd > 0 || !this.deployed) return false;
    this.abilityCd = this.data.abilityCooldown;
    this.abilityActiveTime = this.data.abilityDuration;
    this.ctx.vfx.ring(this.position, 0xffb020, 6, 0.7);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xffb020, 30, { speed: 6, life: 0.9, size: 0.6, gravity: 2, up: 1 });
    this.ctx.audio.play('magic');
    this.handle.animation?.playOneShot('skill', { fade: 0.15 });
    return true;
  }

  update(dt: number, time: number) {
    if (!this.deployed) return;
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.abilityActiveTime = Math.max(0, this.abilityActiveTime - dt);

    // حرکت
    let moving = false;
    if (this.moveTarget) {
      const dir = this.moveTarget.clone().sub(this.position);
      const dist = dir.length();
      if (dist < 0.3) {
        this.moveTarget = null;
      } else {
        moving = true;
        dir.normalize();
        const step = Math.min(dist, this.data.moveSpeed * dt);
        this.position.addScaledVector(dir, step);
        const wantRot = Math.atan2(dir.x, dir.z);
        let diff = wantRot - this.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.mesh.rotation.y += diff * 0.18;
        this.walkPhase += dt * 12;
        // Placeholder: انیمیشن پا پروسیجرال | GLB: انیمیشن اسکلتی
        if (!this.handle.hasAnimations) {
          for (const p of this.handle.proceduralAnimParts) {
            p.node.rotation.x = (p.kind === 'leg' ? 1 : -1) * Math.sin(this.walkPhase) * 0.6;
          }
        }
      }
    } else {
      // حمله خودکار — قهرمان به دشمنان زمینی و هوایی شلیک می‌کند
      this.cooldown -= dt;
      const targets = this.ctx.enemies.filter((e) => e.alive && e.getPos().distanceTo(this.position) <= this.range);
      const target = targets.length
        ? targets.reduce((a, b) => (b.dist > a.dist ? b : a))
        : null;
      if (target && this.cooldown <= 0) {
        this.cooldown = 1 / this.fireRate;
        this.shoot(target);
      }
      // ایستادن رو به نزدیک‌ترین دشمن
      if (target) {
        const dir = target.getPos().clone().sub(this.position);
        const wantRot = Math.atan2(dir.x, dir.z);
        let diff = wantRot - this.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.mesh.rotation.y += diff * 0.1;
      }
    }

    // انیمیشن حرکتی (فقط GLB) — Placeholder با پاهای پروسیجرال کار می‌کند
    if (this.handle.hasAnimations) {
      this.handle.animation?.playLocomotion(moving ? 'walk' : 'idle');
      this.handle.animation?.update(dt);
    }

    this.mesh.position.copy(this.position);
    // فلش دهانه تفنگ
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
  }

  private shoot(target: DamageableEnemy) {
    // نقطه شلیک: WeaponPoint واقعی مدل (GLB) یا نقطه محاسبه‌شده (Placeholder)
    const fallbackTip = this.position
      .clone()
      .add(new THREE.Vector3(0, 1.15, 0))
      .addScaledVector(new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)), 1.2);
    const tip = this.handle.vfxWorld('weapon', this.tmpV) ?? this.handle.vfxWorld('muzzle', this.tmpV) ?? fallbackTip;
    this.ctx.vfx.burst(tip, 0xffd54a, 2, { speed: 1.5, life: 0.12, size: 0.35, gravity: 0 });
    this.ctx.vfx.bolt(tip, target.getPos().clone().add(new THREE.Vector3(0, 1, 0)), 0xffd54a);
    this.ctx.audio.play('heroShot');
    this.handle.animation?.playOneShot('attack', { fade: 0.08, returnToLocomotion: true });
    target.takeDamage(this.damage, 'physical');
  }

  /** آزادسازی Handle هنگام تخریب بازی */
  dispose() {
    this.handle.dispose();
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
