import * as THREE from 'three';
import type { TowerData, TargetingMode } from '../data/types';
import { TOWERS, CHAIN_JUMP_RADIUS, CHAIN_FALLOFF } from '../data/towers';
import { characterFactory, type CharacterHandle } from '../assets';
import type { GameContext, DamageableEnemy, TowerLike } from './context';

// ============================================================
// برج دفاعی — هدف‌گیری، شلیک، ارتقا، قدرت ویژه
// ============================================================

const TARGETING_ORDER: TargetingMode[] = ['first', 'strongest', 'weakest', 'fastest', 'boss'];

export class Tower implements TowerLike {
  id: number;
  towerId: string;
  data: TowerData;
  level = 1;
  position: THREE.Vector3;
  mesh: THREE.Group;
  targeting: TargetingMode = 'first';
  alive = true;
  invested: number;
  abilityCd = 0;
  private cooldown = 0;
  private rateBuffTime = 0;
  private scene: THREE.Scene;
  private ctx: GameContext;
  private spinPhase = Math.random() * 10;
  /** Handle سیستم Asset — GLB اختیاری + سازنده پروسیجرال فعلی */
  private handle: CharacterHandle;

  constructor(id: number, towerId: string, position: THREE.Vector3, scene: THREE.Scene, ctx: GameContext) {
    this.id = id;
    this.towerId = towerId;
    this.data = TOWERS[towerId];
    this.position = position.clone();
    this.scene = scene;
    this.ctx = ctx;
    this.invested = this.data.cost;
    this.handle = characterFactory.createTowerHandle(towerId, 1);
    this.mesh = this.handle.root;
    this.mesh.position.copy(position);
    scene.add(this.mesh);
  }

  get damage(): number {
    return this.data.levels[this.level - 1].damage * (1 + this.ctx.heroDamageBuff);
  }

  get range(): number {
    return this.data.levels[this.level - 1].range;
  }

  get fireRate(): number {
    let rate = this.data.levels[this.level - 1].fireRate;
    if (this.rateBuffTime > 0) rate *= 1.6;
    if (this.ctx.towerRateBuff > 0) rate *= 1 + this.ctx.towerRateBuff;
    return rate;
  }

  get upgradeCost(): number {
    return this.level < 5 ? this.data.levels[this.level].upgradeCost : -1;
  }

  get sellValue(): number {
    return Math.round(this.invested * 0.6);
  }

  cycleTargeting(): TargetingMode {
    const i = TARGETING_ORDER.indexOf(this.targeting);
    this.targeting = TARGETING_ORDER[(i + 1) % TARGETING_ORDER.length];
    return this.targeting;
  }

  upgrade(): boolean {
    if (this.level >= 5) return false;
    this.level++;
    this.invested += this.data.levels[this.level - 1].upgradeCost;
    // تعویض مدل — Transformation (از طریق Asset Pipeline)
    this.scene.remove(this.mesh);
    this.handle.dispose();
    this.handle = characterFactory.createTowerHandle(this.towerId, this.level);
    this.mesh = this.handle.root;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
    // جلوه ارتقا
    this.ctx.vfx.ring(this.position, this.data.color, 4, 0.6);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, 2, 0)), this.data.color, 22, { speed: 5, life: 0.7, size: 0.5, gravity: 3, up: 1 });
    return true;
  }

  sell(): number {
    const v = this.sellValue;
    this.alive = false;
    this.scene.remove(this.mesh);
    this.handle.dispose();
    return v;
  }

  canUseAbility(): boolean {
    return this.abilityCd <= 0;
  }

  /** قدرت ویژه — هر برج رفتار خودش */
  useAbility(enemies: DamageableEnemy[]): boolean {
    if (this.abilityCd > 0) return false;
    this.abilityCd = this.data.abilityCooldown;
    const pos = this.position;
    const inRange = enemies.filter((e) => e.alive && e.getPos().distanceTo(pos) <= this.range + 2);

    switch (this.towerId) {
      case 'sentinel': {
        // باران گلوله — سه برابر سرعت شلیک
        this.rateBuffTime = 5;
        this.ctx.vfx.ring(pos, this.data.color, this.range, 0.5);
        this.ctx.audio.play('upgrade');
        break;
      }
      case 'lightning': {
        // خشم آذر — زنجیره بزرگ
        const target = this.pickTarget(inRange);
        if (!target) {
          this.abilityCd = 1;
          return false;
        }
        this.ctx.chainLightning(pos.clone().add(new THREE.Vector3(0, 4, 0)), target, 8, this.damage * 2.2, 0xc084fc);
        this.ctx.audio.play('lightning');
        this.ctx.cameraShake(0.4);
        break;
      }
      case 'fire': {
        // بارش آتش — ۶ گلوله آتشین تصادفی
        this.ctx.scheduleFireBarrage(pos, this.range, 6, this.damage * 1.4);
        this.ctx.audio.play('cannon');
        break;
      }
      case 'ice': {
        // زمستان ابدی — کندی شدید همه
        for (const e of inRange) {
          e.applySlow(0.22, 5);
          e.takeDamage(30, 'ice');
        }
        this.ctx.vfx.ring(pos, this.data.color, this.range + 2, 0.8);
        this.ctx.vfx.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x7dd3fc, 40, { speed: 9, life: 0.9, size: 0.6, gravity: 2, up: 0.9 });
        this.ctx.audio.play('freeze');
        this.ctx.cameraShake(0.2);
        break;
      }
    }
    return true;
  }

  private pickTarget(list: DamageableEnemy[]): DamageableEnemy | null {
    if (list.length === 0) return null;
    switch (this.targeting) {
      case 'strongest':
        return list.reduce((a, b) => (b.hp > a.hp ? b : a));
      case 'weakest':
        return list.reduce((a, b) => (b.hp < a.hp ? b : a));
      case 'fastest':
        return list.reduce((a, b) => (b.speed > a.speed ? b : a));
      case 'boss': {
        const boss = list.find((e) => e.data.boss);
        return boss ?? list[0];
      }
      default:
        return list.reduce((a, b) => (b.dist > a.dist ? b : a));
    }
  }

  update(dt: number, time: number, enemies: DamageableEnemy[]) {
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.rateBuffTime = Math.max(0, this.rateBuffTime - dt);
    this.cooldown -= dt;

    // انیمیشن چرخش کریستال‌ها
    this.spinPhase += dt;
    const ud = this.mesh.userData;
    if (ud.spinCrystal) {
      ud.spinCrystal.rotation.y += dt * 1.5;
      ud.spinCrystal.position.y += Math.sin(this.spinPhase * 2) * 0.003;
    }
    if (ud.spinRing) ud.spinRing.rotation.z += dt * 1.2;

    // چرخش برجک به سمت هدف
    const inRange = enemies.filter((e) => e.alive && this.canHit(e) && e.getPos().distanceTo(this.position) <= this.range);
    const target = this.pickTarget(inRange);
    if (target && ud.turret) {
      const dir = target.getPos().clone().sub(this.position);
      const wantRot = Math.atan2(dir.x, dir.z);
      let diff = wantRot - ud.turret.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ud.turret.rotation.y += diff * Math.min(1, dt * 10);
    }

    if (!target || this.cooldown > 0) return;
    this.cooldown = 1 / this.fireRate;
    this.fire(target);
  }

  private canHit(e: DamageableEnemy): boolean {
    if (e.data.flying && !this.data.canHitAir) return false;
    if (e.data.id === 'shadow' && this.data.damageType === 'physical') return true; // سایه‌ها آسیب فیزیکی می‌گیرند ولی کمتر — ساده‌سازی
    return true;
  }

  private fire(target: DamageableEnemy) {
    const from = this.position.clone().add(new THREE.Vector3(0, this.towerHeight(), 0));
    const ud = this.mesh.userData;

    switch (this.data.projectile) {
      case 'bullet':
        this.ctx.spawnProjectile('bullet', from, target, { damage: this.damage, color: 0xffd54a });
        this.ctx.audio.play('shoot');
        if (ud.turret) {
          const tip = from.clone().add(new THREE.Vector3(Math.sin(ud.turret.rotation.y), 0, Math.cos(ud.turret.rotation.y)).multiplyScalar(1.6));
          this.ctx.vfx.burst(tip, 0xffe08a, 2, { speed: 2, life: 0.1, size: 0.3, gravity: 0 });
        }
        break;
      case 'fireball':
        this.ctx.spawnProjectile('fireball', from, target, {
          damage: this.damage,
          splash: this.data.splashRadius ?? 2.8,
          burn: this.data.burnDps,
          color: 0xf97316,
        });
        this.ctx.audio.play('cannon');
        if (ud.ember) {
          this.ctx.vfx.burst(from, 0xf97316, 4, { speed: 3, life: 0.3, size: 0.4, gravity: -2 });
        }
        break;
      case 'frost':
        this.ctx.spawnProjectile('frost', from, target, {
          damage: this.damage,
          slow: this.data.slowFactor ?? 0.55,
          slowDur: this.data.slowDuration ?? 2,
          color: 0x67e8f9,
        });
        this.ctx.audio.play('freeze');
        break;
      case 'none': {
        // صاعقه — زنجیره لحظه‌ای
        const chains = this.data.chainCount ?? 2;
        this.ctx.chainLightning(from, target, chains, this.damage, 0x8b5cf6);
        this.ctx.audio.play('lightning');
        break;
      }
    }
  }

  private towerHeight(): number {
    return this.towerId === 'lightning' ? 4.2 : this.towerId === 'fire' ? 2.4 : 2.8;
  }
}

export { CHAIN_JUMP_RADIUS, CHAIN_FALLOFF, TARGETING_ORDER };
