import * as THREE from 'three';
import type { EnemyData } from '../data/types';
import { tiered } from '../data/enemies';
import { getBossPhase2, type BossPhase2Config } from '../data/bossPhases';
import { characterFactory, type CharacterHandle } from '../assets';
import type { GameContext, DamageableEnemy } from './context';

// ============================================================
// دشمن — حرکت روی مسیر، وضعیت‌ها (کندی/سوزش/سپر)، رفتارهای ویژه
// ------------------------------------------------------------
// Rendering Layer: مدل از Asset Pipeline + Object Pool.
// Load Once → Cache → Clone → AnimationMixer مستقل (بخش ۱۳).
// Gameplay (HP/Armor/مسیر/وضعیت‌ها/Boss فاز۲/احضار) دست‌نخورده.
// ------------------------------------------------------------
// فاز ۲ اختصاصی هر Boss — از bossPhases.ts (Data-Driven):
// ورود به فاز با جلوه/سپر/احضار مخصوص + توانایی دوره‌ای مخصوص
// (فوران آتش/آئورای یخ/نفس سایه/پروتکل لیزر/احضار ارباب تاریکی)
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
  /** پیکربندی فاز ۲ اختصاصی این Boss (null برای دشمن عادی) */
  private phase2Cfg: BossPhase2Config | null = null;
  private phase2RegenBonus = 0;
  private phaseAbilityTimer = 0;
  private phaseDamageReduction = 0;
  private slowImmune = false;
  private walkPhase = Math.random() * 10;
  private shredAmount = 0;
  private shredUntil = 0;
  private supportTimer = 3; // شفادهنده/احضارکننده
  private heroAtkCd = 0; // سرد حمله به قهرمان
  /** آسیب ضربه به قهرمان — مشتق از HP با کف/سقف (EnemyData فیلد damage ندارد) */
  private heroHitDmg: number;
  mesh: THREE.Group;
  private scene: THREE.Scene;
  private ctx: GameContext;
  private deathY = 0;
  private hitAnimCd = 0;
  /** بخش ۱۴ — فلش اصابت: متریال‌های مستقل این instance + تایمر محو */
  private flashMats: { mat: THREE.MeshStandardMaterial; hex: number; intensity: number }[] = [];
  private flashT = 0;
  private hitSfxCd = 0;
  /** Handle سیستم Asset — مدل واقعی/Placeholder + Pool + انیمیشن */
  private handle: CharacterHandle;
  /** مسیر حمله این دشمن — مراحل چندمسیره (۰ تا ۲) */
  pathIndex = 0;

  constructor(data: EnemyData, tier: number, scene: THREE.Scene, ctx: GameContext, pathIndex = 0) {
    this.data = data;
    this.tier = tier;
    this.pathIndex = pathIndex;
    const st = tiered(data, tier);
    this.maxHp = st.hp;
    this.hp = st.hp;
    this.armor = st.armor;
    this.speed = st.speed;
    this.reward = st.reward;
    this.scale = st.scale;
    this.heroHitDmg = Math.min(45, Math.max(6, this.maxHp * 0.035));
    this.scene = scene;
    this.ctx = ctx;
    // Asset Pipeline — از Pool یا ساخت جدید؛ GLB به‌محض آماده شدن سوار می‌شود
    this.handle = characterFactory.acquireEnemyHandle(data, tier);
    this.mesh = this.handle.root;
    scene.add(this.mesh);
    this.setupFlashMaterials();
    this.updateMeshPos();
    const myPts = this.myPath.points;
    this.mesh.rotation.y = Math.atan2(
      myPts[1].x - myPts[0].x,
      myPts[1].z - myPts[0].z
    );
  }

  /** مسیر فعلی این دشمن */
  private get myPath() {
    return this.ctx.paths[this.pathIndex] ?? this.ctx.paths[0];
  }

  /** بخش ۱۴ — فلش اصابت: clone متریال per-handle (GLB clones متریال مشترک دارند)
   *  یک‌بار per Handle Pool‌شده — فلش فقط همین instance را روشن می‌کند */
  private setupFlashMaterials() {
    const root = this.handle.root as unknown as { userData: Record<string, unknown> };
    if (!root.userData.flashCloned) {
      this.handle.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => m.clone());
        else mesh.material = (mesh.material as THREE.Material).clone();
      });
      root.userData.flashCloned = true;
    }
    this.flashMats = [];
    this.handle.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const sm = m as THREE.MeshStandardMaterial;
        if (sm.emissive) {
          this.flashMats.push({ mat: sm, hex: sm.emissive.getHex(), intensity: sm.emissiveIntensity });
        }
      }
    });
  }

  /** بخش ۱۴ — پالس روشن متریال هنگام اصابت */
  private flashHit() {
    this.flashT = 0.12;
  }

  private applyFlash(dt: number) {
    if (this.flashT <= 0) return;
    this.flashT = Math.max(0, this.flashT - dt);
    const k = this.flashT / 0.12;
    for (const f of this.flashMats) {
      if (k <= 0) {
        f.mat.emissive.setHex(f.hex);
        f.mat.emissiveIntensity = f.intensity;
      } else {
        f.mat.emissive.setRGB(k * 1.0, k * 0.82, k * 0.55);
        f.mat.emissiveIntensity = f.intensity + k * 1.4;
      }
    }
  }

  getPos(): THREE.Vector3 {
    return this.mesh.position;
  }

  /** سوییچ LOD مدل واقعی بر اساس فاصله دوربین (بخش ۱۶) — برای Placeholder بی‌هزینه */
  updateLod(camPos: THREE.Vector3) {
    this.handle.updateLod(camPos);
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  get progress(): number {
    return this.dist / this.myPath.length;
  }

  hasShield(): boolean {
    return this.shieldHp > 0;
  }

  applySlow(factor: number, duration: number) {
    if (this.slowImmune) return; // بدن مذاب غول آتش / تجسم سرمای غول یخ
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

  /** شکستن زره — زهرخانه/مه سمی */
  applyShred(amount: number, duration: number) {
    this.shredAmount = Math.max(this.shredAmount, amount);
    this.shredUntil = Math.max(this.shredUntil, this.now() + duration);
  }

  /** ترمیم توسط شفادهنده */
  heal(amount: number) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** زره مؤثر پس از شکستن */
  private get effArmor(): number {
    return this.now() < this.shredUntil
      ? Math.max(0, this.armor - this.shredAmount)
      : this.armor;
  }

  private now() {
    return performance.now() / 1000;
  }

  /** آسیب بزن — true یعنی دشمن مرد */
  takeDamage(amount: number, type: string, pierceArmor = false): boolean {
    if (!this.alive) return false;

    // جاخالی عنکبوت
    if (this.data.dodgeChance && this.dodgeCd <= 0 && Math.random() < this.data.dodgeChance) {
      this.dodgeCd = 1.2;
      this.ctx.vfx.hitSpark(this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x22d3ee);
      return false;
    }
    this.dodgeCd -= 0.016;

    // مقاومت جادویی + زره مؤثر (با احتساب شکستن)
    const resist = this.data.resist?.[type as keyof typeof this.data.resist] ?? 1;
    let dmg = Math.max(1, amount * resist - this.effArmor * (type === 'physical' ? 1 : 0.4));
    if (pierceArmor) dmg = Math.max(1, amount * resist); // بالیستا — زره نادیده
    // پوست سنگی پادشاه غول — کاهش درصدی آسیب در فاز ۲
    if (this.phaseDamageReduction > 0) dmg *= 1 - this.phaseDamageReduction;

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

    // بخش ۱۴ — انتقاد: ضریب روی آسیب نهایی
    const crit = Math.random() < this.ctx.critChance;
    if (crit) dmg *= this.ctx.critMult;

    this.hp -= dmg;
    // بخش ۱۴ — فیدبک اصابت: فلش + عدد شناور + صدای کوتاه محدودشده
    this.flashHit();
    this.ctx.showDamage(this.id, this.mesh.position.clone().add(new THREE.Vector3(0, this.data.boss ? 2.8 : 1.9)), dmg, crit);
    if (this.hitSfxCd <= 0) {
      this.hitSfxCd = 0.09;
      this.ctx.audio.play('hit');
    }
    if (this.hp <= 0) {
      this.die();
      return true;
    }

    // انیمیشن اصابت (اسکلتی یا پروسیجرال — با نرخ محدود تا اسپم نشود)
    if (this.handle.animation && this.hitAnimCd <= 0) {
      this.hitAnimCd = 0.5;
      this.handle.animation.playOneShot('hit', { fade: 0.08 });
    }

    // فاز دوم Boss — اختصاصی هر Boss از bossPhases.ts
    if (this.data.boss && !this.phase2 && this.hpRatio < 0.5) {
      this.enterPhase2();
    }
    return false;
  }

  /** ورود به فاز دوم — جلوه‌ها و توانایی‌های اختصاصی هر Boss */
  private enterPhase2() {
    this.phase2 = true;
    const cfg = this.data.boss ? getBossPhase2(this.data.id) : null;
    this.phase2Cfg = cfg;

    // جلوه ورود — رنگ اختصاصی Boss
    const fx = cfg?.color ?? 0xf59e0b;
    this.ctx.vfx.ring(this.mesh.position, fx, 8, 0.7);
    this.ctx.vfx.ring(this.mesh.position, fx, 5, 0.9);
    this.ctx.vfx.explosion(this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), fx, true);
    this.ctx.audio.play('bossRoar');
    this.ctx.audio.play('bossPhase'); // بخش ۱۵ — شیپور فاز دوم
    this.ctx.cameraShake(1.0);
    this.handle.animation?.playOneShot('phasechange', { fade: 0.2 });
    if (!this.handle.animation?.isBusy()) {
      this.handle.animation?.playOneShot('roar', { fade: 0.2 });
    }

    if (!cfg) {
      // Boss بدون پیکربندی — رفتار عمومی قدیمی
      this.armor = Math.round(this.armor * 1.25);
      for (let i = 0; i < 4; i++) this.summonMinion();
      return;
    }

    // آمار فاز ۲
    this.armor = Math.round(this.armor * cfg.armorMult);
    this.speed *= cfg.speedMult;
    if (cfg.slowImmune) {
      this.slowImmune = true;
      this.slowFactor = 1;
      this.slowUntil = 0;
    }
    if (cfg.regenBonus) this.phase2RegenBonus = cfg.regenBonus;
    if (cfg.damageReductionPct) this.phaseDamageReduction = cfg.damageReductionPct;
    if (cfg.shieldHp) {
      this.shieldHp += cfg.shieldHp;
      const aura = this.mesh.getObjectByName('shieldAura');
      if (aura) (aura as THREE.Mesh).visible = true;
    }

    // احضار لحظه ورود — نیروی مخصوص Boss
    if (cfg.onEnterSummon) {
      for (let i = 0; i < cfg.onEnterSummon.count; i++) {
        this.ctx.summonAt(this.mesh.position.clone(), cfg.onEnterSummon.enemy);
      }
    }

    // بنر «فاز دوم» با نام اختصاصی
    this.ctx.onBossPhase(cfg.nameKey, cfg.color);
    this.phaseAbilityTimer = cfg.periodic ? cfg.periodic.interval * 0.55 : 0;
  }

  /** توانایی دوره‌ای فاز ۲ — مخصوص هر Boss */
  private updatePhase2Abilities(dt: number) {
    const cfg = this.phase2Cfg;
    if (!cfg?.periodic) return;
    this.phaseAbilityTimer -= dt;
    if (this.phaseAbilityTimer > 0) return;
    this.phaseAbilityTimer = cfg.periodic.interval;

    const pos = this.mesh.position.clone();
    const fx = cfg.color;

    switch (cfg.periodic.kind) {
      case 'towerStun': {
        // نفس سایه اژدها / لیزر محوکننده / ضربه سنگی — از کار انداختن نزدیک‌ترین برج‌ها
        const targets = [...this.ctx.towers]
          .filter((t) => t.alive)
          .sort((a, b) => a.position.distanceTo(this.mesh.position) - b.position.distanceTo(this.mesh.position))
          .slice(0, cfg.periodic.towerCount ?? 1);
        for (const t of targets) {
          this.ctx.vfx.bolt(pos, t.position.clone().add(new THREE.Vector3(0, 2, 0)), fx, true);
          this.ctx.disableTower(t.id, cfg.periodic.duration ?? 3, fx);
        }
        if (targets.length) {
          this.ctx.cameraShake(0.45);
          const anim = this.handle.animation;
          if (anim) {
            if (!anim.playOneShot('attack2', { fade: 0.15 })) {
              if (!anim.playOneShot('attack1', { fade: 0.15 })) {
                anim.playOneShot('attack', { fade: 0.15 });
              }
            }
          }
        }
        break;
      }
      case 'frostAura': {
        // انجماد ابدی غول یخ — همه برج‌های اطراف منجمد می‌شوند
        const radius = cfg.periodic.radius ?? 9;
        this.ctx.vfx.ring(pos, fx, radius, 0.9);
        this.ctx.vfx.burst(pos, fx, 24, { speed: 6, life: 0.8, size: 0.5, gravity: -1 });
        let any = false;
        for (const t of this.ctx.towers) {
          if (!t.alive) continue;
          if (t.position.distanceTo(this.mesh.position) <= radius) {
            this.ctx.disableTower(t.id, cfg.periodic.duration ?? 4, fx);
            any = true;
          }
        }
        if (any) this.ctx.audio.play('deepFreeze');
        this.ctx.cameraShake(0.5);
        break;
      }
      case 'eruption': {
        // فوران آتشی غول آتش — حلقه آتش + از کار انداختن برج‌های نزدیک
        const radius = cfg.periodic.radius ?? 7;
        this.ctx.vfx.ring(pos, fx, radius, 0.7);
        this.ctx.vfx.burst(pos, fx, 30, { speed: 7, life: 0.7, size: 0.7, gravity: 2 });
        let any = false;
        for (const t of this.ctx.towers) {
          if (!t.alive) continue;
          if (t.position.distanceTo(this.mesh.position) <= radius) {
            this.ctx.disableTower(t.id, cfg.periodic.duration ?? 3, fx);
            any = true;
          }
        }
        if (any) this.ctx.audio.play('explosion');
        this.ctx.cameraShake(0.55);
        this.handle.animation?.playOneShot('specialattack', { fade: 0.15 });
        break;
      }
      case 'summon': {
        // احضار بی‌وقفه ارباب تاریکی
        for (let i = 0; i < (cfg.periodic.count ?? 2); i++) {
          this.ctx.summonAt(pos, cfg.periodic.enemy ?? 'shadowSoldier');
        }
        this.ctx.vfx.ring(pos, fx, 5, 0.6);
        this.handle.animation?.playOneShot('attack', { fade: 0.15, returnToLocomotion: true });
        break;
      }
    }
  }

  private summonMinion() {
    const game = this.ctx as unknown as { summonAt?: (pos: THREE.Vector3) => void };
    game.summonAt?.(this.mesh.position.clone());
  }

  update(dt: number, time: number) {
    this.hitAnimCd = Math.max(0, this.hitAnimCd - dt);
    this.hitSfxCd = Math.max(0, this.hitSfxCd - dt);
    this.applyFlash(dt);

    if (!this.alive) {
      // انیمیشن مرگ — GLB (افتادن +) فرورفتن کند | Placeholder: فرورفتن سریع
      this.deathY -= dt * (this.handle.animation ? 1.6 : 3);
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

    // ===== درگیری با قهرمان — دشمن در برد، می‌ایستد و حمله می‌کند =====
    const hero = this.ctx.heroRef;
    if (hero && hero.alive) {
      const heroDist = hero.getPos().distanceTo(this.mesh.position);
      const heroRange = this.data.boss ? 3.6 : 2.6;
      if (heroDist <= heroRange) {
        // ایستادن روی مسیر — روی قهرمان بچرخ و ضربه بزن
        const targetRot = Math.atan2(
          hero.getPos().x - this.mesh.position.x,
          hero.getPos().z - this.mesh.position.z,
        );
        let diff = targetRot - this.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.mesh.rotation.y += diff * Math.min(1, 8 * dt);

        this.heroAtkCd -= dt;
        if (this.heroAtkCd <= 0) {
          this.heroAtkCd = 1.25;
          const dmg = this.heroHitDmg;
          hero.takeDamage(dmg);
          this.ctx.vfx.hitSpark(
            hero.getPos().clone().add(new THREE.Vector3(0, 1.2, 0)),
            0xf87171,
          );
          this.handle.animation?.playOneShot('attack', { fade: 0.08, returnToLocomotion: true });
          this.ctx.audio.play('shoot');
        }
        // انیمیشن راه رفتن متوقف — فقط ایست +(mesh) موقعیت ثابت
        this.updateMeshPos();
        this.handle.animation?.update(dt);
        return;
      }
    } else {
      this.heroAtkCd = 0; // هیرو مرده/غایب — فوری پس از ریسپاون اولین ضربه نزند
    }

    // حرکت روی مسیر
    const effSpeed = this.speed * this.slowFactor;
    this.dist += effSpeed * dt;
    if (this.dist >= this.myPath.length) {
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

    // جادوگر — سپر به هم‌رزما | شفادهنده — ترمیم | احضارکننده — احضار
    if (this.data.shieldGiver || this.data.healer || this.data.summoner) {
      this.supportTimer -= dt;
      if (this.supportTimer <= 0) {
        if (this.data.shieldGiver) {
          this.supportTimer = this.data.shieldGiver.interval;
          this.giveShields();
        } else if (this.data.healer) {
          this.supportTimer = this.data.healer.interval;
          this.healAllies();
        } else {
          this.supportTimer = this.data.summoner!.interval;
          this.summonMinions();
        }
      }
    }

    // بازسازی HP (تانک اثری/Boss مکانیکی) + بازسازی فاز ۲ Boss
    if ((this.data.regen || this.phase2RegenBonus) && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + (this.data.regen ?? 0) * dt + this.phase2RegenBonus * dt);
    }

    // توانایی‌های دوره‌ای فاز ۲ Boss
    if (this.phase2) this.updatePhase2Abilities(dt);

    this.updateMeshPos();
    this.animate(dt, effSpeed);
  }

  private updateMeshPos() {
    const path = this.myPath;
    const pts = path.points;
    const u = (this.dist / path.length) * (pts.length - 1);
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

    const anim = this.handle.animation;
    if (anim) {
      // GLB — انیمیشن اسکلتی یا پروسیجرال بدنه‌صلب، هم‌گام با سرعت واقعی حرکت
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
    // ضربه زمین به قهرمان هم آسیب می‌زند اگر در شعاع باشد
    const hero = this.ctx.heroRef;
    if (hero && hero.alive && hero.getPos().distanceTo(pos) <= 9) {
      hero.takeDamage(Math.min(80, this.heroHitDmg * 1.8));
      this.ctx.vfx.burst(
        hero.getPos().clone().add(new THREE.Vector3(0, 1.2, 0)),
        0xf59e0b, 10, { speed: 5, life: 0.4, size: 0.5, gravity: 6 },
      );
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

  private healAllies() {
    const radius = this.data.healer!.radius;
    const amount = this.data.healer!.amount;
    let any = false;
    for (const e of this.ctx.enemies) {
      if (!e.alive || e === (this as unknown as DamageableEnemy)) continue;
      if (e.getPos().distanceTo(this.mesh.position) <= radius && e.hp < e.maxHp) {
        e.heal(amount);
        any = true;
      }
    }
    if (any) {
      this.ctx.vfx.ring(this.mesh.position, 0x4ade80, radius, 0.6);
      this.ctx.vfx.burst(this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x4ade80, 10, { speed: 3, life: 0.7, size: 0.5, gravity: -1 });
    }
  }

  private summonMinions() {
    const cfg = this.data.summoner!;
    for (let i = 0; i < cfg.count; i++) {
      this.ctx.summonAt(this.mesh.position.clone(), cfg.enemy);
    }
    this.ctx.vfx.ring(this.mesh.position, this.data.accent, 4, 0.5);
    this.handle.animation?.playOneShot('attack', { fade: 0.15, returnToLocomotion: true });
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
