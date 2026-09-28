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
  /** از کار افتادگی موقت — فوران غول آتش/نفس اژدها/آئورای یخ Boss */
  disableTimer = 0;
  private disableFxTimer = 0;
  /** هاله تقویت محلی (از آذرگاه) */
  private localBuffPct = 0;
  private localBuffUntil = 0;
  private auraPulse = 0;
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
    if (this.localBuffUntil > this.timeNow() && this.localBuffPct > 0) rate *= 1 + this.localBuffPct;
    return rate;
  }

  private timeNow() {
    return performance.now() / 1000;
  }

  /** دریافت هاله تقویت از آذرگاه */
  applyLocalBuff(pct: number, duration: number) {
    this.localBuffPct = Math.max(this.localBuffPct, pct);
    this.localBuffUntil = Math.max(this.localBuffUntil, this.timeNow() + duration);
  }

  /** از کار انداختن موقت برج توسط Boss (فاز ۲) */
  disable(duration: number, color = 0xf97316) {
    this.disableTimer = Math.max(this.disableTimer, duration);
    this.disableFxTimer = 0;
    this.ctx.vfx.ring(this.position.clone().add(new THREE.Vector3(0, 0.3, 0)), color, 3.2, 0.5);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, this.towerHeight(), 0)), color, 14, {
      speed: 4, life: 0.6, size: 0.45, gravity: -2,
    });
    this.ctx.audio.play('explosion');
  }

  get isDisabled(): boolean {
    return this.disableTimer > 0;
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
      case 'cannon': {
        // شلیک مرگبار — گلوله عظیم سه‌برابر
        const target = this.pickTarget(inRange);
        if (!target) {
          this.abilityCd = 1;
          return false;
        }
        const from = pos.clone().add(new THREE.Vector3(0, this.towerHeight(), 0));
        this.ctx.spawnProjectile('cannonball', from, target, {
          damage: this.damage * 3, splash: 5, dmgType: 'physical', color: 0xfbbf24,
        });
        this.ctx.audio.play('cannon');
        this.ctx.cameraShake(0.5);
        this.ctx.vfx.ring(pos, 0xfbbf24, 4, 0.4);
        break;
      }
      case 'poison': {
        // مه سمی — زهر سنگین + شکستن شدید زره
        for (const e of inRange) {
          e.applyBurn(this.data.poisonDps! * 2.2, 6);
          e.applyShred(this.data.armorShred! * 3, 8);
          e.takeDamage(this.damage, 'shadow');
        }
        this.ctx.vfx.ring(pos, 0x84cc16, this.range, 1.0);
        this.ctx.vfx.burst(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0x84cc16, 36, { speed: 6, life: 1.2, size: 0.8, gravity: -1.5 });
        this.ctx.audio.play('magic');
        break;
      }
      case 'ballista': {
        // پیکان شکافنده — عبور از صف دشمنان
        const target = this.pickTarget(inRange);
        if (!target) {
          this.abilityCd = 1;
          return false;
        }
        const from = pos.clone().add(new THREE.Vector3(0, this.towerHeight(), 0));
        this.ctx.vfx.bolt(from, target.getPos().clone().add(new THREE.Vector3(0, 1, 0)), 0xd97706, true);
        const pierceList = inRange
          .filter((e) => e !== target)
          .sort((a, b) => a.getPos().distanceTo(target.getPos()) - b.getPos().distanceTo(target.getPos()))
          .slice(0, 4);
        target.takeDamage(this.damage * 2, 'physical', true);
        for (const e of pierceList) {
          this.ctx.vfx.bolt(target.getPos().clone().add(new THREE.Vector3(0, 1, 0)), e.getPos().clone().add(new THREE.Vector3(0, 1, 0)), 0xd97706);
          e.takeDamage(this.damage * 1.4, 'physical', true);
        }
        this.ctx.audio.play('shoot');
        this.ctx.cameraShake(0.25);
        break;
      }
      case 'arcane': {
        // انفجار جادویی در نقطه هدف
        const target = this.pickTarget(inRange);
        if (!target) {
          this.abilityCd = 1;
          return false;
        }
        const at = target.getPos().clone();
        for (const e of this.ctx.enemies) {
          if (!e.alive) continue;
          const d = e.getPos().distanceTo(at);
          if (d <= 3.6) e.takeDamage(this.damage * 2 * (1 - (d / 3.6) * 0.35), 'magic');
        }
        this.ctx.vfx.explosion(at, 0x38bdf8, true);
        this.ctx.vfx.magicCircle(at, 0x38bdf8, 3.4, 0.8);
        this.ctx.audio.play('magic');
        this.ctx.cameraShake(0.3);
        break;
      }
      case 'temple': {
        // ستایش آذر — دو برابر شدن سرعت شلیک برج‌های نزدیک
        const radius = this.data.buffRadius ?? 7;
        for (const t of this.ctx.towers) {
          if (t.id === this.id) continue;
          if (t.position.distanceTo(this.position) <= radius + 1) {
            (t as Tower).applyLocalBuff(1.0, 6);
          }
        }
        this.ctx.vfx.ring(pos, 0xfbbf24, radius + 2, 1.0);
        this.ctx.vfx.burst(pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 0xfcd34d, 44, { speed: 7, life: 1.1, size: 0.6, gravity: -2, up: 1 });
        this.ctx.audio.play('upgrade');
        break;
      }
      case 'void': {
        // دهانه تهی — بلع دشمنان ضعیف
        const threshold = this.data.executeThreshold ?? 0.35;
        let devoured = 0;
        for (const e of inRange) {
          if (e.hpRatio <= threshold + 0.15 && !e.data.boss) {
            e.takeDamage(this.damage * 5, 'shadow');
            devoured++;
          } else {
            e.takeDamage(this.damage * 1.5, 'shadow');
          }
        }
        this.ctx.vfx.ring(pos, 0x8b5cf6, this.range, 0.9);
        this.ctx.vfx.explosion(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x7c3aed, devoured > 0);
        this.ctx.audio.play('magic');
        this.ctx.cameraShake(0.35);
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

    // از کار افتادگی توسط Boss — شلیک/هاله متوقف، دود و جرقه نشانگر
    if (this.disableTimer > 0) {
      this.disableTimer -= dt;
      this.disableFxTimer -= dt;
      if (this.disableFxTimer <= 0) {
        this.disableFxTimer = 0.4;
        this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, this.towerHeight() * 0.7, 0)), 0x64748b, 3, {
          speed: 1.2, life: 0.7, size: 0.5, gravity: -3,
        });
      }
      this.animateIdleSpin(dt);
      return;
    }

    // هاله تقویت آذرگاه — پالس هر ۰٫۵ ثانیه
    if (this.data.buffRatePct) {
      this.auraPulse -= dt;
      if (this.auraPulse <= 0) {
        this.auraPulse = 0.5;
        const radius = this.data.buffRadius ?? 7;
        for (const t of this.ctx.towers) {
          if (t.id === this.id) continue;
          if (t.position.distanceTo(this.position) <= radius) {
            (t as Tower).applyLocalBuff(this.data.buffRatePct, 0.7);
          }
        }
      }
    }

    // انیمیشن چرخش کریستال‌ها
    this.animateIdleSpin(dt);

    // چرخش برجک به سمت هدف
    const inRange = enemies.filter((e) => e.alive && this.canHit(e) && e.getPos().distanceTo(this.position) <= this.range);
    const target = this.pickTarget(inRange);
    const ud = this.mesh.userData;
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

  /** چرخش آرام کریستال/حلقه — حتی هنگام از کار افتادگی */
  private animateIdleSpin(dt: number) {
    this.spinPhase += dt;
    const ud = this.mesh.userData;
    if (ud.spinCrystal) {
      ud.spinCrystal.rotation.y += dt * 1.5;
      ud.spinCrystal.position.y += Math.sin(this.spinPhase * 2) * 0.003;
    }
    if (ud.spinRing) ud.spinRing.rotation.z += dt * 1.2;
  }

  private canHit(e: DamageableEnemy): boolean {
    if (e.data.flying && !this.data.canHitAir) return false;
    if (e.data.id === 'shadow' && this.data.damageType === 'physical') return true; // سایه‌ها آسیب فیزیکی می‌گیرند ولی کمتر — ساده‌سازی
    return true;
  }

  private fire(target: DamageableEnemy) {
    const from = this.position.clone().add(new THREE.Vector3(0, this.towerHeight(), 0));
    const ud = this.mesh.userData;
    const dt = this.data.damageType;

    switch (this.data.projectile) {
      case 'bullet':
        this.ctx.spawnProjectile('bullet', from, target, { damage: this.damage, color: 0xffd54a, dmgType: dt });
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
          dmgType: 'fire',
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
          dmgType: 'ice',
        });
        this.ctx.audio.play('freeze');
        break;
      case 'cannonball':
        this.ctx.spawnProjectile('cannonball', from, target, {
          damage: this.executeBonus(target),
          splash: this.data.splashRadius ?? 3.4,
          color: 0xf59e0b,
          dmgType: 'physical',
        });
        this.ctx.audio.play('cannon');
        break;
      case 'venom':
        this.ctx.spawnProjectile('venom', from, target, {
          damage: this.executeBonus(target),
          poisonDps: this.data.poisonDps,
          poisonDur: this.data.poisonDuration ?? 4,
          color: 0x84cc16,
          dmgType: 'shadow',
        });
        this.ctx.audio.play('shoot');
        break;
      case 'bolt':
        this.ctx.spawnProjectile('bolt', from, target, {
          damage: this.executeBonus(target),
          pierceArmor: this.data.pierceArmor,
          color: 0xd97706,
          dmgType: 'physical',
        });
        this.ctx.audio.play('shoot');
        break;
      case 'prism':
        this.ctx.spawnProjectile('prism', from, target, {
          damage: this.executeBonus(target),
          color: 0x38bdf8,
          dmgType: 'magic',
        });
        this.ctx.audio.play('magic');
        break;
      case 'hex':
        this.ctx.spawnProjectile('hex', from, target, {
          damage: this.executeBonus(target),
          color: this.data.color,
          dmgType: dt,
        });
        this.ctx.audio.play('magic');
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

  /** آسیب نهایی با احتساب اجرای برج تهی */
  private executeBonus(target: DamageableEnemy): number {
    if (this.data.executeThreshold && target.hpRatio < this.data.executeThreshold) {
      return this.damage * (this.data.executeMultiplier ?? 2);
    }
    return this.damage;
  }

  private towerHeight(): number {
    return this.data.towerHeight ?? (this.towerId === 'lightning' ? 4.2 : this.towerId === 'fire' ? 2.4 : 2.8);
  }
}

export { CHAIN_JUMP_RADIUS, CHAIN_FALLOFF, TARGETING_ORDER };
