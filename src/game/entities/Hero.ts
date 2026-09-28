import * as THREE from 'three';
import { HEROES } from '../data/magic';
import type { HeroData } from '../data/types';
import { characterFactory, type CharacterHandle } from '../assets';
import type { GameContext as GC, DamageableEnemy as DE } from './context';

// ============================================================
// قهرمان — ۴ قهرمان قابل بازی با Role متمایز
// ------------------------------------------------------------
// آرمان  (فرمانده)  — پتک آذری با رعدوبرق، فرمان نبرد: تقویت برج‌ها
// آریا   (نگهبان)   — انفجار اثری، سپر اثری: مصونیت هسته
// رادین  (برسرکر)   — کلنگ سنگین با Cleave، خشم جنگ
// نیلا   (تیرانداز) — تیر انرژی دوربرد، باران تیر
// ------------------------------------------------------------
// Rendering Layer: مدل از Asset Pipeline (heroId.glb یا Placeholder)
// Gameplay (HP/XP/حرکت/حمله/توانایی) Data-Driven است.
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
  readonly data: HeroData;
  private ctx: GC;
  private walkPhase = 0;
  private muzzleFlash = 0;
  deployed = false;
  private frenzyActive = false;
  /** مرگ — دشمنان دیگر هدف نمی‌گیرند و تا ریسپاون پنهان است */
  dead = false;
  respawnTimer = 0;
  /** زمان باقی‌مانده تا پنهان شدن جسد بعد از انیمیشن مرگ */
  private deathHideTimer = 0;
  /** آئورای رعدوبرق پتک — ساطع شدن مستمر (پتک آذری) */
  private auraTimer = 0.4;
  /** Handle سیستم Asset — مدیریت مدل واقعی/Placeholder و انیمیشن */
  private handle: CharacterHandle;
  private tmpV = new THREE.Vector3();

  constructor(heroId: string, scene: THREE.Scene, ctx: GC) {
    this.ctx = ctx;
    this.data = HEROES[heroId] ?? HEROES.arman;
    this.maxHp = this.data.hp;
    this.hp = this.data.hp;
    this.damage = this.data.damage;
    // Asset Pipeline — مدل واقعی GLB به‌محض آماده شدن درجا سوار می‌شود
    this.handle = characterFactory.createHeroHandle(this.data.id);
    this.mesh = this.handle.root;
    this.mesh.position.copy(this.position);
    this.mesh.visible = false; // تا استقرار نیافته پنهان
    scene.add(this.mesh);
  }

  get range(): number {
    return this.data.range + this.level * 0.3;
  }

  get fireRate(): number {
    let rate = this.data.fireRate * (1 + (this.level - 1) * 0.04);
    if (this.frenzyActive) rate *= 1 + this.data.abilityBuff / 100;
    return rate;
  }

  get currentDamage(): number {
    let dmg = this.damage;
    if (this.frenzyActive) dmg *= 1 + this.data.abilityBuff / 100;
    return dmg;
  }

  get abilityReady(): boolean {
    return this.abilityCd <= 0;
  }

  /** زنده و قابل هدف — دشمنان فقط این حالت را حمله می‌کنند */
  get alive(): boolean {
    return this.deployed && !this.dead && this.hp > 0;
  }

  /** آسیب از دشمنان — مرگ ریسپاون زمان‌دار را فعال می‌کند */
  takeDamage(amount: number) {
    if (!this.alive) return;
    this.hp -= amount;
    this.ctx.vfx.burst(
      this.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      0xf87171, 5, { speed: 3.5, life: 0.3, size: 0.4, gravity: 5 }
    );
    // فلینچ پروسیجرال/اسکلتی — حین اسمش حمله قطع نمی‌شود
    if (this.handle.animation && !this.handle.animation.isBusy()) {
      this.handle.animation.playOneShot('hit', { fade: 0.05 });
    }
    if (this.hp <= 0) this.die();
  }

  /** مرگ — انیمیشن افتادن + انفجار آذری و پنهانی و شمارش ریسپاون */
  private die() {
    this.dead = true;
    this.hp = 0;
    this.moveTarget = null;
    this.frenzyActive = false;
    this.abilityActiveTime = 0;
    this.respawnTimer = this.data.respawn ?? 12;
    this.ctx.vfx.explosion(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x93c5fd, true);
    this.ctx.vfx.ring(this.position, 0x93c5fd, 4, 0.8);
    this.ctx.audio.play('death');
    // مرگ پروسیجرال/اسکلتی — اول افتادن (۰٫۹s) بعد پنهان شدن | بدون انیمیشن → پنهان فوری
    this.deathHideTimer = this.handle.animation?.playDeath() ? 0.95 : 0;
    if (this.deathHideTimer === 0) this.mesh.visible = false;
  }

  /** ریسپاون کنار هسته آذر — نقطه امن پشت خط مقدم */
  private respawn() {
    this.dead = false;
    this.hp = this.maxHp;
    this.position.copy(this.ctx.corePos);
    this.position.x += 2.5;
    this.position.z += 2.5;
    this.position.y = 0;
    this.mesh.visible = true;
    this.deployed = true;
    this.deathHideTimer = 0;
    this.handle.animation?.reset(); // خروج از حالت مرگ + ژست خنثی
    const pathPt = this.nearestPathPoint();
    if (pathPt) this.mesh.rotation.y = Math.atan2(pathPt.x - this.position.x, pathPt.z - this.position.z);
    this.ctx.vfx.ring(this.position, 0x93c5fd, 4, 0.9);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x93c5fd, 30, { speed: 6, life: 0.8, size: 0.55, gravity: -3, up: 1 });
    this.ctx.audio.play('reward');
  }

  getPos(): THREE.Vector3 {
    return this.position;
  }

  /** سوییچ LOD مدل واقعی (بخش ۱۶) */
  updateLod(camPos: THREE.Vector3) {
    this.handle.updateLod(camPos);
  }

  deploy(pos: THREE.Vector3) {
    this.position.copy(pos);
    this.position.y = 0;
    this.mesh.visible = true;
    this.deployed = true;
    // بلافاصله رو به نزدیک‌ترین نقطه مسیر بایستد — موقعیت گارد طبیعی
    const pathPt = this.nearestPathPoint();
    if (pathPt) this.mesh.rotation.y = Math.atan2(pathPt.x - pos.x, pathPt.z - pos.z);
    this.ctx.vfx.ring(pos, this.data.projectileColor, 3, 0.6);
    this.ctx.vfx.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), this.data.projectileColor, 20, { speed: 4, life: 0.6, size: 0.5, gravity: 4 });
  }

  /** نزدیک‌ترین نقطه مسیر — برای جهت‌گیری پیش‌فرض قهرمان */
  private nearestPathPoint(): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const p of this.ctx.pathPoints) {
      const d = (p.x - this.position.x) ** 2 + (p.z - this.position.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** چرخش نرم و مستقل از فریم‌ریت به سمت نقطه هدف */
  private turnToward(target: THREE.Vector3, dt: number, rate = 7) {
    const wantRot = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    let diff = wantRot - this.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += diff * Math.min(1, rate * dt);
  }

  moveTo(pos: THREE.Vector3) {
    if (!this.alive) return;
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
    this.maxHp += Math.round(this.data.hp * 0.09);
    this.hp = Math.min(this.maxHp, this.hp + 120);
    this.damage += Math.round(this.data.damage * 0.27);
    this.ctx.vfx.ring(this.position, 0xfbbf24, 4.5, 0.8);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xfbbf24, 26, { speed: 5, life: 0.8, size: 0.5, gravity: 2, up: 1 });
  }

  useAbility(): boolean {
    if (this.abilityCd > 0 || !this.alive) return false;
    this.abilityCd = this.data.abilityCooldown;
    const color = this.data.projectileColor;

    switch (this.data.abilityKind) {
      case 'battleCommand': {
        // فرمان نبرد — تقویت برج‌ها (در Game.ctx.towerRateBuff اعمال می‌شود)
        this.abilityActiveTime = this.data.abilityDuration;
        break;
      }
      case 'aegisShield': {
        // سپر اثری — مصونیت کامل هسته
        this.ctx.requestCoreShield(this.data.abilityDuration);
        this.ctx.vfx.ring(this.ctx.corePos, 0x67e8f9, 7, 1.0);
        this.ctx.vfx.burst(this.ctx.corePos.clone().add(new THREE.Vector3(0, 3, 0)), 0x67e8f9, 44, { speed: 8, life: 1.1, size: 0.7, gravity: 1, up: 1 });
        break;
      }
      case 'warFrenzy': {
        // خشم جنگ — تقویت خود + ترمیم
        this.abilityActiveTime = this.data.abilityDuration;
        this.frenzyActive = true;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
        break;
      }
      case 'rainOfArrows': {
        // باران تیر — روی نزدیک‌ترین گروه دشمن
        const cluster = this.findCluster();
        if (cluster) {
          this.ctx.scheduleFireBarrage(cluster, 4.5, 12, this.currentDamage * this.data.abilityBuff / 100, 'arrow');
          this.ctx.vfx.magicCircle(cluster, color, 4.5, 1.0);
        } else {
          this.abilityCd = 1;
          return false;
        }
        break;
      }
    }

    this.ctx.vfx.ring(this.position, color, 6, 0.7);
    this.ctx.vfx.burst(this.position.clone().add(new THREE.Vector3(0, 2, 0)), color, 30, { speed: 6, life: 0.9, size: 0.6, gravity: 2, up: 1 });
    this.ctx.audio.play('magic');
    this.handle.animation?.playOneShot('skill', { fade: 0.15 });
    return true;
  }

  /** متراکم‌ترین گروه دشمن در نزدیکی قهرمان */
  private findCluster(): THREE.Vector3 | null {
    const enemies = this.ctx.enemies.filter((e) => e.alive);
    if (enemies.length === 0) return null;
    let bestPos: THREE.Vector3 | null = null;
    let bestScore = 0;
    for (const e of enemies) {
      let score = 0;
      for (const o of enemies) {
        if (o.getPos().distanceTo(e.getPos()) < 4) score++;
      }
      const nearHero = 1 - Math.min(1, e.getPos().distanceTo(this.position) / 40);
      score *= 0.5 + nearHero;
      if (score > bestScore) {
        bestScore = score;
        bestPos = e.getPos().clone();
      }
    }
    return bestPos;
  }

  update(dt: number, time: number) {
    if (!this.deployed) return;

    // مرگ — شمارش معکوس ریسپاون (UI هر ۰٫۲ ثانیه state می‌گیرد)
    if (this.dead) {
      // جسد — ادامه انیمیشن افتادن تا پنهان شدن
      if (this.deathHideTimer > 0) {
        this.deathHideTimer -= dt;
        this.handle.animation?.update(dt);
        if (this.deathHideTimer <= 0) this.mesh.visible = false;
      }
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }

    // آئورای پتک آذری — رعدوبرق مستمر از نوک سلاح
    if (this.data.weaponAura === 'lightning') {
      this.auraTimer -= dt;
      if (this.auraTimer <= 0) {
        this.auraTimer = 0.4 + Math.random() * 0.3;
        const tip = this.handle.vfxWorld('weapon', this.tmpV)
          ?? this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this.ctx.vfx.burst(tip, Math.random() < 0.5 ? 0x93c5fd : 0xe0f2fe, 3, {
          speed: 2.2, life: 0.22, size: 0.32, gravity: -1.5, spread: 0.5,
        });
        // هر از گاهی جرقه‌ی درشت‌تر — قوس الکتریکی کوتاه
        if (Math.random() < 0.3) {
          const end = tip.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 1.2,
          ));
          this.ctx.vfx.bolt(tip, end, 0xbfdbfe);
        }
      }
    }

    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.abilityActiveTime = Math.max(0, this.abilityActiveTime - dt);
    if (this.frenzyActive && this.abilityActiveTime <= 0) this.frenzyActive = false;

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
        this.turnToward(this.moveTarget, dt, 9);
        this.walkPhase += dt * 12;
        // Placeholder: انیمیشن پا پروسیجرال | GLB: انیمیشن اسکلتی
        if (!this.handle.hasAnimations) {
          for (const p of this.handle.proceduralAnimParts) {
            p.node.rotation.x = (p.kind === 'leg' ? 1 : -1) * Math.sin(this.walkPhase) * 0.6;
          }
        }
      }
    } else {
      // حمله خودکار
      this.cooldown -= dt;
      const targets = this.ctx.enemies.filter((e) => e.alive && e.getPos().distanceTo(this.position) <= this.range);
      const target = targets.length
        ? targets.reduce((a, b) => (b.dist > a.dist ? b : a))
        : null;
      if (target && this.cooldown <= 0) {
        this.cooldown = 1 / this.fireRate;
        this.attack(target, targets);
      }
      // ایستادن رو به دشمن جلوی صف — و اگر دشمنی در برد نیست، رو به مسیر (پایش گارد)
      if (target) {
        this.turnToward(target.getPos(), dt, 7);
      } else {
        const pathPt = this.nearestPathPoint();
        if (pathPt) this.turnToward(pathPt, dt, 2.5);
      }
    }

    // انیمیشن حرکتی — اسکلتی (GLB انیمیشن‌دار) یا پروسیجرال بدنه‌صلب (GLB استاتیک)
    // Placeholderها animation=null دارند و با پاهای پروسیجرال قدیمی کار می‌کنند
    this.handle.animation?.playLocomotion(moving ? 'walk' : 'idle');
    this.handle.animation?.update(dt);

    this.mesh.position.copy(this.position);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
  }

  get isDead(): boolean {
    return this.dead;
  }

  get respawnIn(): number {
    return Math.max(0, Math.ceil(this.respawnTimer));
  }

  /** حمله بر اساس Role */
  private attack(target: DE, inRange: DE[]) {
    const color = this.data.projectileColor;
    const role = this.data.role;

    if (role === 'berserker') {
      // رادین — کلنگ سنگین با Cleave زمینی
      const hitPos = target.getPos().clone();
      this.ctx.vfx.burst(hitPos.clone().add(new THREE.Vector3(0, 1, 0)), color, 10, { speed: 5, life: 0.4, size: 0.6, gravity: 4 });
      this.ctx.vfx.ring(hitPos, color, 2.2, 0.3);
      this.ctx.audio.play('heroShot');
      this.handle.animation?.playOneShot('attack', { fade: 0.08, returnToLocomotion: true });
      target.takeDamage(this.currentDamage, this.data.attackType);
      // Cleave — تا N هدف اضافه در نزدیکی هدف اصلی
      const extras = inRange
        .filter((e) => e !== target && !e.data.flying)
        .sort((a, b) => a.getPos().distanceTo(hitPos) - b.getPos().distanceTo(hitPos))
        .slice(0, this.data.cleave ?? 0);
      for (const e of extras) {
        e.takeDamage(this.currentDamage * 0.7, this.data.attackType);
      }
      this.ctx.vfx.burst(hitPos, 0xffe0b0, 4, { speed: 3, life: 0.3, size: 0.4, gravity: 2 });
      return;
    }

    if (role === 'guardian') {
      // آریا — گوی جادویی با انفجار ناحیه‌ای
      const from = this.handle.vfxWorld('weapon', this.tmpV)
        ?? this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      this.ctx.spawnProjectile('prism', from, target, {
        damage: this.currentDamage,
        splash: this.data.splash ?? 2.4,
        color,
        dmgType: this.data.attackType,
      });
      this.ctx.audio.play('magic');
      this.handle.animation?.playOneShot('attack', { fade: 0.08, returnToLocomotion: true });
      return;
    }

    // آرمان (پتک آذری) و نیلا (تیر) — شلیک/صاعقه از WeaponPoint
    const fallbackTip = this.position
      .clone()
      .add(new THREE.Vector3(0, 1.15, 0))
      .addScaledVector(new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)), 1.2);
    const tip = this.handle.vfxWorld('weapon', this.tmpV) ?? this.handle.vfxWorld('muzzle', this.tmpV) ?? fallbackTip;
    const targetPos = target.getPos().clone().add(new THREE.Vector3(0, 1, 0));

    if (this.data.attackStyle === 'hammerLightning') {
      // پتک آذری — صاعقه از نوک پتک به دشمن + جرقه رعد
      this.ctx.vfx.bolt(tip, targetPos, 0xbfdbfe);
      this.ctx.vfx.bolt(
        tip.clone().add(new THREE.Vector3(0.2, 0.1, 0)),
        targetPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)),
        0x93c5fd,
      );
      this.ctx.vfx.burst(targetPos, 0xe0f2fe, 8, { speed: 5, life: 0.3, size: 0.45, gravity: 3 });
      this.ctx.audio.play('lightning');
      this.handle.animation?.playOneShot('attack', { fade: 0.08, returnToLocomotion: true });
      target.takeDamage(this.currentDamage, this.data.attackType);
      // هر سومین ضربه — قوس زنجیره‌ای به ۲ دشمن دیگر
      if (Math.random() < 0.34) {
        const others = inRange.filter((e) => e !== target).slice(0, 2);
        let from = tip;
        for (const e of others) {
          const to = e.getPos().clone().add(new THREE.Vector3(0, 1, 0));
          this.ctx.vfx.bolt(from, to, 0x93c5fd);
          e.takeDamage(this.currentDamage * 0.55, 'energy');
          from = to;
        }
      }
      return;
    }

    this.ctx.vfx.burst(tip, color, 2, { speed: 1.5, life: 0.12, size: 0.35, gravity: 0 });
    this.ctx.vfx.bolt(tip, targetPos, color);
    this.ctx.audio.play('heroShot');
    this.handle.animation?.playOneShot('attack', { fade: 0.08, returnToLocomotion: true });
    target.takeDamage(this.currentDamage, this.data.attackType);
  }

  /** آزادسازی Handle هنگام تخریب بازی */
  dispose() {
    this.handle.dispose();
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
