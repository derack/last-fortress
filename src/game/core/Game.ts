import * as THREE from 'three';
import type { LevelData, MagicId, SaveData } from '../data/types';
import { TOWERS, isTowerUnlocked } from '../data/towers';
import { ENEMIES } from '../data/enemies';
import { MAGIC } from '../data/magic';
import { BattleScene } from '../scene/BattleScene';
import { CameraController } from './CameraController';
import { InputController, TapHit } from './InputController';
import { VFXSystem } from '../systems/VFXSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { EventBus } from './EventBus';
import { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import { Hero } from '../entities/Hero';
import { characterFactory } from '../assets';
import type { DamageableEnemy, GameContext } from '../entities/context';

// ============================================================
// موتور اصلی بازی — حلقه، موج‌ها، اقتصاد، جادو، پیروزی/شکست
// ============================================================

interface FireBarrageItem {
  time: number;
  pos: THREE.Vector3;
  damage: number;
  visual: 'fire' | 'arrow';
}

export class Game {
  bus = new EventBus();
  private canvas: HTMLCanvasElement;
  private level: LevelData;
  private scene3d: BattleScene;
  private cameraCtrl: CameraController;
  private input: InputController;
  private vfx: VFXSystem;
  audio = new AudioSystem();
  private hero: Hero;
  private ctx: GameContext;

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];
  private towerNextId = 1;

  // اقتصاد
  coins: number;
  crystals: number;
  coreHp: number;
  coreMaxHp: number;
  leaks = 0;
  killsThisLevel = 0;
  coinsEarned = 0;
  towersBuilt = 0;
  upgradesCount = 0;
  magicCastThisLevel = 0;
  towersBuiltBeforeBoss: number | null = null;

  // موج
  waveIndex = 0; // موج بعدی
  waveActive = false;
  private waveTime = 0;
  private spawnQueue: { enemyId: string; tier: number; time: number; pathIndex: number }[] = [];
  private autoStartTimer = 18; // زمان آماده‌سازی دژ قبل از موج اول
  private earlyBonus = 0;

  // جادو
  private magicCd: Record<string, number> = {};
  private magicPending: MagicId | null = null;
  private shieldUntil = 0;
  private fireBarrage: FireBarrageItem[] = [];
  private barrageTimer = 0;
  private blessingUntil = 0; // برکت آذر

  // حالت
  private paused = false;
  private speed = 1;
  private gameOver = false;
  private buildMode: string | null = null;
  private heroSelectMode = false;
  private selectedTower: Tower | null = null;
  /** پیش‌نمایش محل ساخت — دیسک سبز/قرمز + حلقه برد */
  private ghostGroup: THREE.Group | null = null;
  private ghostDisc: THREE.Mesh | null = null;
  private ghostRing: THREE.Mesh | null = null;
  private ghostValid = false;
  /** گرید قابل‌ساخت — فقط در حالت ساخت دیده می‌شود */
  private buildGrid: THREE.Mesh | null = null;
  private ghostPulse = 0;
  private heroMovePulse = 0; // تایمر حلقه پالس جابجایی قهرمان
  private time = 0;
  private raf = 0;
  private lastFrame = 0;
  private uiTimer = 0;
  private disposed = false;
  private save: SaveData;
  private totalWavesSurvivedAtStart: number;

  constructor(canvas: HTMLCanvasElement, level: LevelData, quality: string, save: SaveData, language: 'fa' | 'en', heroId = 'arman') {
    this.canvas = canvas;
    this.level = level;
    this.save = save;
    this.coins = level.startCoins;
    this.crystals = level.startCrystals + save.crystals;
    this.coreHp = level.coreHp;
    this.coreMaxHp = level.coreHp;
    this.totalWavesSurvivedAtStart = save.stats.wavesSurvived;
    for (const m of Object.values(MAGIC)) this.magicCd[m.id] = 0;

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.scene3d = new BattleScene(canvas, level, (quality as 'low' | 'medium' | 'high' | 'ultra'));
    this.scene3d.resize(w, h);
    this.cameraCtrl = new CameraController(w / h);
    this.cameraCtrl.setBounds(34);
    this.cameraCtrl.desiredTarget.set(-4, 0, 3);
    this.vfx = new VFXSystem(this.scene3d.scene);
    this.vfx.particleScale = quality === 'low' ? 0.4 : quality === 'medium' ? 0.8 : 1.2;

    this.ctx = {
      paths: this.scene3d.paths.map((p) => ({ points: p.points, length: p.length })),
      pathPoints: this.scene3d.pathPoints,
      pathLength: this.scene3d.pathLength,
      corePos: this.scene3d.corePos,
      enemies: this.enemies as unknown as DamageableEnemy[],
      towers: this.towers,
      heroRef: null,
      vfx: this.vfx,
      audio: this.audio,
      cameraShake: (a) => this.cameraCtrl.shake(a),
      spawnProjectile: (kind, from, target, opts) => {
        this.projectiles.push(new Projectile(kind, from, target, opts, this.ctx, this.scene3d.scene));
      },
      chainLightning: (from, first, chains, damage, color) => this.chainLightning(from, first, chains, damage, color),
      scheduleFireBarrage: (center, radius, count, damage, visual = 'fire') => this.scheduleFireBarrage(center, radius, count, damage, visual),
      summonAt: (pos, enemyId) => this.summonShadow(pos, enemyId),
      requestCoreShield: (duration) => this.requestCoreShield(duration),
      onEnemyKilled: (e) => this.handleKill(e as Enemy),
      onEnemyLeak: (e) => this.handleLeak(e as Enemy),
      heroDamageBuff: 0,
      towerRateBuff: 0,
      disableTower: (towerId, duration, color) => this.disableTower(towerId, duration, color),
      onBossPhase: (nameKey, color) => this.bus.emit('bossPhase', { nameKey, color }),
    };

    this.hero = new Hero(heroId, this.scene3d.scene, this.ctx);
    // دشمنان از طریق ctx قهرمان را هدف می‌گیرند
    this.ctx.heroRef = this.hero;
    this.input = new InputController(canvas, this.cameraCtrl, (hit) => this.handleTap(hit), this.scene3d.scene);
    // پیش‌نمایش محل ساخت — حرکت موس/درگ انگشت
    this.input.onGroundHover = (pt) => this.updateGhost(pt);

    this.audio.setVolumes(save.settings.music, save.settings.sfx);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.scene3d.resize(w, h);
    this.cameraCtrl.resize(w / h);
  }

  // ===================== چرخه اصلی =====================

  start() {
    this.lastFrame = performance.now();
    const loop = (t: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const rawDt = Math.min(0.05, (t - this.lastFrame) / 1000);
      this.lastFrame = t;
      if (!this.paused && !this.gameOver) {
        const dt = rawDt * this.speed;
        this.update(dt);
      }
      this.cameraCtrl.update(rawDt);
      this.scene3d.update(rawDt);
      this.vfx.update(this.paused ? rawDt * 0.2 : rawDt * this.speed);
      this.scene3d.render(this.cameraCtrl.camera);
    };
    this.raf = requestAnimationFrame(loop);
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
    this.bus.emit('wave', { wave: this.waveIndex + 1, total: this.level.waves.length, active: false, autoIn: 0 });
    this.bus.emit('core', { hp: this.coreHp, max: this.coreMaxHp });
    this.bus.emit('magic', this.magicState());
    this.bus.emit('hero', this.heroState());
  }

  private update(dt: number) {
    this.time += dt;

    // موج — شمارش معکوس شروع خودکار
    if (!this.waveActive && !this.gameOver) {
      this.autoStartTimer -= dt;
      if (this.autoStartTimer <= 0 && this.waveIndex < this.level.waves.length) {
        if (this.waveIndex > 0 || !this.save.tutorialDone) {
          // در آموزش شروع خودکار نداریم
          if (this.save.tutorialDone) this.startWave();
        } else {
          this.startWave();
        }
      }
      this.uiTimer -= dt;
      if (this.uiTimer <= 0) {
        this.uiTimer = 0.25;
        this.bus.emit('wave', { wave: this.waveIndex + 1, total: this.level.waves.length, active: false, autoIn: Math.max(0, this.autoStartTimer), earlyBonus: this.earlyBonus });
      }
    }

    // اسپاون
    if (this.waveActive) {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveTime) {
        const item = this.spawnQueue.shift()!;
        this.spawnEnemy(item.enemyId, item.tier, item.pathIndex);
      }
    }

    // دشمنان
    const camPos = this.cameraCtrl.camera.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.time);
      e.updateLod(camPos);
      if (!e.alive && e.getPos().y < -2.4) {
        e.remove();
        this.enemies.splice(i, 1);
      }
    }

    // اتمام موج
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.gameOver) {
      this.completeWave();
    }

    // برج‌ها
    for (const t of this.towers) {
      t.update(dt, this.time, this.enemies);
    }

    // پرتابه‌ها
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this.scene3d.scene);
      if (!p.isAlive) this.projectiles.splice(i, 1);
    }

    // نبض پیش‌نمایش ساخت
    if (this.ghostGroup && this.ghostGroup.visible) {
      this.ghostPulse += dt * 4;
      const pulse = 0.32 + Math.sin(this.ghostPulse) * 0.1;
      const color = this.ghostValid ? 0x22c55e : 0xef4444;
      (this.ghostDisc!.material as THREE.MeshBasicMaterial).opacity = pulse;
      (this.ghostDisc!.material as THREE.MeshBasicMaterial).color.setHex(color);
      (this.ghostRing!.material as THREE.MeshBasicMaterial).color.setHex(color);
    }

    // قهرمان
    this.hero.update(dt, this.time);
    this.hero.updateLod(this.cameraCtrl.camera.position);
    // حلقه پالس حالت جابجایی — زیر قهرمان تا کاربر بداند کجا تپ کند
    if (this.heroSelectMode && this.hero.alive) {
      this.heroMovePulse -= dt;
      if (this.heroMovePulse <= 0) {
        this.heroMovePulse = 0.55;
        this.vfx.ring(this.hero.getPos(), 0xffb020, 2.2, 0.5);
      }
    }
    const commandBuff = this.hero.data.abilityKind === 'battleCommand' && this.hero.abilityActiveTime > 0
      ? this.hero.data.abilityBuff / 100 : 0;
    const blessingBuff = this.time < this.blessingUntil
      ? (MAGIC.azarBlessing.rateBuffPct ?? 0) : 0;
    this.ctx.towerRateBuff = commandBuff + blessingBuff;

    // رگبار آتش/تیر
    this.barrageTimer -= dt;
    for (let i = this.fireBarrage.length - 1; i >= 0; i--) {
      const item = this.fireBarrage[i];
      item.time -= dt;
      if (item.time <= 0) {
        if (item.visual === 'arrow') {
          const from = item.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 16, (Math.random() - 0.5) * 8));
          this.projectiles.push(new Projectile('bolt', from, null, { damage: item.damage, color: 0xc084fc }, this.ctx, this.scene3d.scene));
        } else {
          const from = item.pos.clone().add(new THREE.Vector3(0, 22, 0));
          this.projectiles.push(new Projectile('fireball', from, null, { damage: item.damage, splash: 2.6, burn: 4, color: 0xf97316 }, this.ctx, this.scene3d.scene));
        }
        this.fireBarrage.splice(i, 1);
      }
    }

    // سردست‌های جادو
    for (const id of Object.keys(this.magicCd)) {
      this.magicCd[id] = Math.max(0, this.magicCd[id] - dt);
    }

    // سپر هسته
    if (this.shieldUntil > 0 && this.time > this.shieldUntil) {
      this.shieldUntil = 0;
      this.bus.emit('shield', { active: false });
    }

    // بروزرسانی UI با نرخ محدود
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.2;
      this.bus.emit('magic', this.magicState());
      this.bus.emit('hero', this.heroState());
      if (this.selectedTower) this.emitTowerInfo();
    }
  }

  // ===================== موج‌ها =====================

  startWave() {
    if (this.waveActive || this.waveIndex >= this.level.waves.length || this.gameOver) return;
    const wave = this.level.waves[this.waveIndex];
    this.waveActive = true;
    this.waveTime = 0;
    this.spawnQueue = [];
    const pathCount = this.level.paths.length;
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        // مسیر اسپاون — گروه مسیر مشخص دارد یا پخش متوازن روی همه مسیرها
        const pathIndex = pathCount > 1
          ? (g.path !== undefined ? g.path : i % pathCount) % pathCount
          : 0;
        this.spawnQueue.push({ enemyId: g.enemy, tier: g.tier, time: g.delay + i * g.interval, pathIndex });
      }
    }
    this.spawnQueue.sort((a, b) => a.time - b.time);
    this.earlyBonus = Math.round(15 + this.autoStartTimer * 4);
    if (this.earlyBonus > 0 && this.autoStartTimer > 1) {
      this.coins += this.earlyBonus;
      this.coinsEarned += this.earlyBonus;
      this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
    }
    this.autoStartTimer = 0;

    this.audio.play('waveStart');
    this.bus.emit('banner', { wave: this.waveIndex + 1, boss: !!wave.boss });
    this.bus.emit('wave', { wave: this.waveIndex + 1, total: this.level.waves.length, active: true, autoIn: 0 });

    if (wave.boss) {
      this.audio.setBossMode(true);
      this.audio.play('bossRoar');
      this.cameraCtrl.shake(0.6);
      this.towersBuiltBeforeBoss = this.towersBuilt;
    }

    // پاداش کریستال موج
    this.crystals += 5;
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });

    // آموزش
    if (!this.save.tutorialDone) this.bus.emit('tutorial', 'upgrade');
  }

  private completeWave() {
    const wave = this.level.waves[this.waveIndex];
    this.waveActive = false;
    this.waveIndex++;
    this.save.stats.wavesSurvived = this.totalWavesSurvivedAtStart + this.waveIndex;
    this.coins += wave.coinBonus;
    this.coinsEarned += wave.coinBonus;
    this.autoStartTimer = wave.boss ? 0 : 14;
    this.earlyBonus = 0;
    this.audio.play('reward');
    this.bus.emit('waveCleared', { wave: this.waveIndex, bonus: wave.coinBonus });
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });

    if (this.waveIndex >= this.level.waves.length) {
      this.doVictory();
    } else {
      this.bus.emit('wave', { wave: this.waveIndex + 1, total: this.level.waves.length, active: false, autoIn: this.autoStartTimer, earlyBonus: 0 });
      if (!this.save.tutorialDone) this.bus.emit('tutorial', 'magic');
    }
  }

  // ===================== دشمنان =====================

  private spawnEnemy(enemyId: string, tier: number, pathIndex = 0) {
    const data = ENEMIES[enemyId];
    if (!data) return;
    const enemy = new Enemy(data, tier, this.scene3d.scene, this.ctx, pathIndex);
    this.enemies.push(enemy);
    this.vfx.burst(enemy.getPos().clone().add(new THREE.Vector3(0, 1.5, 0)), data.accent, 10, { speed: 4, life: 0.5, size: 0.5, gravity: 3 });
    if (data.boss) {
      this.audio.play('bossRoar');
      this.cameraCtrl.shake(0.7);
    }
  }

  private summonShadow(pos: THREE.Vector3, enemyId = 'shadow') {
    const data = ENEMIES[enemyId] ?? ENEMIES.shadow;
    const e = new Enemy(data, 1, this.scene3d.scene, this.ctx);
    // نزدیک‌ترین مسیر + نزدیک‌ترین نقطه همان مسیر
    let bestPath = 0;
    let best = 0;
    let bestD = Infinity;
    this.scene3d.paths.forEach((path, pi) => {
      path.points.forEach((p, i) => {
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
          bestPath = pi;
        }
      });
    });
    e.pathIndex = bestPath;
    e.dist = (best / (this.scene3d.paths[bestPath].points.length - 1)) * this.scene3d.paths[bestPath].length;
    this.enemies.push(e);
    this.vfx.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), data.accent, 14, { speed: 5, life: 0.6, size: 0.6, gravity: 3 });
  }

  /** سپر اثری آریا — مصونیت کامل هسته */
  private requestCoreShield(duration: number) {
    this.shieldUntil = Math.max(this.shieldUntil, this.time + duration);
    this.bus.emit('shield', { active: true, duration });
  }

  private handleKill(e: Enemy) {
    this.coins += e.reward;
    this.coinsEarned += e.reward;
    this.crystals += e.data.crystalReward ?? 0;
    this.killsThisLevel++;
    this.save.stats.kills++;
    if (e.data.boss) {
      this.save.stats.bossKills++;
      this.audio.setBossMode(false);
    }
    this.hero.gainXp(e.data.boss ? 200 : 12);
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
  }

  private handleLeak(e: Enemy) {
    // حذف از صحنه
    e.alive = false;
    e.remove();
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);

    if (this.time < this.shieldUntil) {
      // سپر آریانا — جلوگیری کامل
      this.vfx.ring(this.scene3d.corePos, 0xfbbf24, 6, 0.5);
      return;
    }
    this.leaks++;
    this.coreHp = Math.max(0, this.coreHp - e.data.coreDamage);
    this.cameraCtrl.shake(e.data.boss ? 1 : 0.45);
    this.vfx.explosion(this.scene3d.corePos.clone().add(new THREE.Vector3(0, 2, 0)), 0xef4444, e.data.boss);
    this.audio.play('explosion');
    this.bus.emit('core', { hp: this.coreHp, max: this.coreMaxHp });
    if (this.coreHp <= 0 && !this.gameOver) {
      this.doDefeat();
    }
  }

  // ===================== ساخت / ارتقا / فروش برج =====================

  /** از کار انداختن موقت برج توسط توانایی فاز ۲ Boss */
  disableTower(towerId: number, duration: number, color = 0xf97316) {
    const t = this.towers.find((x) => x.id === towerId);
    if (!t || !t.alive) return;
    t.disable(duration, color);
  }

  setBuildMode(towerId: string | null) {
    // قفل برج — باز شدن تدریجی با ستاره
    if (towerId && !isTowerUnlocked(this.save, towerId)) {
      this.audio.play('error');
      this.bus.emit('toast', { key: 'towerLocked', type: 'error' });
      return;
    }
    this.buildMode = towerId;
    this.magicPending = null;
    this.heroSelectMode = false;
    this.clearGhost();
    if (towerId) {
      this.createGhost(towerId);
      this.setBuildGridVisible(true);
    } else {
      this.setBuildGridVisible(false);
    }
    this.bus.emit('buildMode', { towerId });
  }

  selectHeroMode(on: boolean) {
    this.heroSelectMode = on;
    this.buildMode = null;
    this.magicPending = null;
    this.clearGhost();
    this.setBuildGridVisible(false);
  }

  // ------------------- پیش‌نمایش محل ساخت برج -------------------

  /** ساخت Ghost — دیسک پایه + حلقه برد برج (سبز/قرمز هوشمند) */
  private createGhost(towerId: string) {
    const data = TOWERS[towerId];
    this.ghostGroup = new THREE.Group();
    this.ghostGroup.visible = false;

    // دیسک پایه — محل دقیق قرارگیری
    this.ghostDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 28),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.ghostDisc.rotation.x = -Math.PI / 2;
    this.ghostDisc.position.y = 0.12;
    this.ghostGroup.add(this.ghostDisc);

    // حلقه برد — شعاع واقعی شلیک برج سطح ۱
    const range = data.levels[0].range;
    this.ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, range - 0.22), range, 72),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
    );
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.position.y = 0.1;
    this.ghostGroup.add(this.ghostRing);

    this.scene3d.scene.add(this.ghostGroup);
  }

  /** پاک‌سازی کامل Ghost */
  private clearGhost() {
    if (this.ghostGroup) {
      this.ghostGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.ghostGroup.removeFromParent();
      this.ghostGroup = null;
      this.ghostDisc = null;
      this.ghostRing = null;
    }
  }

  /** بروزرسانی Ghost — اسنپ روی تایل + اعتبارسنجی (سبز/قرمز) */
  private updateGhost(point: THREE.Vector3) {
    if (!this.buildMode || !this.ghostGroup || !this.ghostDisc || !this.ghostRing) return;
    const data = TOWERS[this.buildMode];
    const x = Math.round(point.x / 2) * 2;
    const z = Math.round(point.z / 2) * 2;
    const valid = this.scene3d.canBuild(x, z, this.towers.map((t) => t.position)) && this.coins >= data.cost;
    this.ghostValid = valid;
    const color = valid ? 0x22c55e : 0xef4444;
    (this.ghostDisc.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.ghostRing.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.ghostGroup.position.set(x, 0, z);
    this.ghostGroup.visible = true;
  }

  /** گرید زمین در حالت ساخت — تایل‌های دوتایی */
  private setBuildGridVisible(v: boolean) {
    if (v && !this.buildGrid) {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d')!;
      g.strokeStyle = 'rgba(120, 220, 255, 0.55)';
      g.lineWidth = 2;
      const step = 512 / 16; // ۱۶ تایل در هر بعد — هر تایل ۲ واحد جهانی
      for (let i = 0; i <= 16; i++) {
        g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, 512); g.stroke();
        g.beginPath(); g.moveTo(0, i * step); g.lineTo(512, i * step); g.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(17, 17);
      this.buildGrid = new THREE.Mesh(
        new THREE.PlaneGeometry(68, 68),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.1, depthWrite: false })
      );
      this.buildGrid.rotation.x = -Math.PI / 2;
      this.buildGrid.position.y = 0.06;
      this.scene3d.scene.add(this.buildGrid);
    }
    if (this.buildGrid) this.buildGrid.visible = v;
  }

  tryBuild(towerId: string, point: THREE.Vector3): boolean {
    const data = TOWERS[towerId];
    if (!data) return false;
    // قفل برج — حتی با تپ مستقیم روی زمین
    if (!isTowerUnlocked(this.save, towerId)) {
      this.audio.play('error');
      this.bus.emit('toast', { key: 'towerLocked', type: 'error' });
      return false;
    }
    const x = Math.round(point.x / 2) * 2;
    const z = Math.round(point.z / 2) * 2;
    if (!this.scene3d.canBuild(x, z, this.towers.map((t) => t.position))) {
      this.audio.play('error');
      this.bus.emit('toast', { key: 'invalidSpot', type: 'error' });
      return false;
    }
    if (this.coins < data.cost) {
      this.audio.play('error');
      this.bus.emit('toast', { key: 'notEnoughCoins', type: 'error' });
      return false;
    }
    this.coins -= data.cost;
    const tower = new Tower(this.towerNextId++, towerId, new THREE.Vector3(x, 0, z), this.scene3d.scene, this.ctx);
    this.towers.push(tower);
    this.towersBuilt++;
    this.save.stats.towersBuilt++;
    this.audio.play('place');
    this.vfx.ring(tower.position, data.color, 4, 0.5);
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
    // خروج از حالت ساخت — هماهنگ با رویداد buildMode
    this.buildMode = null;
    this.clearGhost();
    this.setBuildGridVisible(false);
    this.bus.emit('buildMode', { towerId: null });
    if (!this.save.tutorialDone) this.bus.emit('tutorial', 'wave');
    return true;
  }

  upgradeTower(towerId: number): boolean {
    const t = this.towers.find((x) => x.id === towerId);
    if (!t) return false;
    const cost = t.upgradeCost;
    if (cost < 0) return false;
    if (this.coins < cost) {
      this.audio.play('error');
      this.bus.emit('toast', { key: 'notEnoughCoins', type: 'error' });
      return false;
    }
    this.coins -= cost;
    t.upgrade();
    this.upgradesCount++;
    this.save.stats.upgrades++;
    this.audio.play('upgrade');
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
    this.emitTowerInfo();
    if (t.level === 5) this.bus.emit('toast', { key: 'achMaxed', type: 'success' });
    if (!this.save.tutorialDone) this.bus.emit('tutorial', 'magic');
    return true;
  }

  sellTower(towerId: number): boolean {
    const i = this.towers.findIndex((x) => x.id === towerId);
    if (i < 0) return false;
    const v = this.towers[i].sell();
    this.towers.splice(i, 1);
    this.coins += v;
    this.audio.play('sell');
    this.selectedTower = null;
    this.bus.emit('selectTower', null);
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
    return true;
  }

  useTowerAbility(towerId: number): boolean {
    const t = this.towers.find((x) => x.id === towerId);
    if (!t) return false;
    return t.useAbility(this.enemies);
  }

  cycleTargeting(towerId: number) {
    const t = this.towers.find((x) => x.id === towerId);
    if (!t) return;
    t.cycleTargeting();
    this.audio.play('tap');
    this.emitTowerInfo();
  }

  private emitTowerInfo() {
    const t = this.selectedTower;
    if (!t) return;
    this.bus.emit('selectTower', {
      id: t.id,
      towerId: t.towerId,
      level: t.level,
      damage: Math.round(t.damage),
      range: Math.round(t.range),
      fireRate: Math.round(t.fireRate * 10) / 10,
      upgradeCost: t.upgradeCost,
      sellValue: t.sellValue,
      targeting: t.targeting,
      abilityCd: t.abilityCd,
      abilityMax: t.data.abilityCooldown,
      abilityNameKey: t.data.abilityNameKey,
    });
  }

  // ===================== جادو =====================

  setMagicPending(id: MagicId | null) {
    const m = id ? MAGIC[id] : undefined;
    if (m && id) {
      if (this.magicCd[id] > 0) {
        this.bus.emit('toast', { key: 'magicCooldown', type: 'error' });
        return;
      }
      if (this.crystals < m.crystalCost) {
        this.audio.play('error');
        this.bus.emit('toast', { key: 'notEnoughCrystals', type: 'error' });
        return;
      }
      // جادوی بدون هدف — بلافاصله اجرا شود (سپر آریانا)
      if (!m.targeted) {
        this.castMagic(id, this.scene3d.corePos.clone());
        return;
      }
    }
    this.magicPending = id;
    this.buildMode = null;
    this.heroSelectMode = false;
    this.clearGhost();
    this.setBuildGridVisible(false);
    this.bus.emit('magicPending', { id });
  }

  private castMagic(id: MagicId, point: THREE.Vector3): boolean {
    const m = MAGIC[id];
    if (!m) return false;
    if (this.magicCd[id] > 0 || this.crystals < m.crystalCost) return false;

    this.crystals -= m.crystalCost;
    this.magicCd[id] = m.cooldown;
    this.magicCastThisLevel++;
    this.save.stats.magicCasts++;
    this.audio.play('magic');
    this.vfx.magicCircle(point, 0xf59e0b, m.radius * 1.2, 1.6);

    switch (id) {
      case 'skyLightning': {
        const from = point.clone().add(new THREE.Vector3(0, 34, 0));
        this.vfx.bolt(from, point.clone(), 0xc4b5fd, true);
        this.vfx.bolt(from.clone().add(new THREE.Vector3(2, 0, 1)), point.clone().add(new THREE.Vector3(0.5, 0, -0.5)), 0xa78bfa, true);
        this.vfx.explosion(point, 0xa78bfa, true);
        this.cameraCtrl.shake(0.55);
        this.audio.play('lightning');
        // آسیب ناحیه‌ای
        for (const e of [...this.enemies]) {
          if (!e.alive) continue;
          const d = e.getPos().distanceTo(point);
          if (d <= m.radius) {
            e.takeDamage(m.damage! * (1 - (d / m.radius) * 0.4), 'energy');
          }
        }
        break;
      }
      case 'fireRain': {
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * m.radius;
          this.fireBarrage.push({
            time: (i / 12) * (m.duration ?? 4),
            pos: point.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)),
            damage: m.damage ?? 38,
            visual: 'fire',
          });
        }
        this.audio.play('cannon');
        break;
      }
      case 'arianaShield': {
        this.shieldUntil = this.time + (m.duration ?? 10);
        this.vfx.ring(this.scene3d.corePos, 0xfbbf24, 6, 0.9);
        this.vfx.burst(this.scene3d.corePos.clone().add(new THREE.Vector3(0, 3, 0)), 0xfbbf24, 40, { speed: 8, life: 1, size: 0.7, gravity: 1, up: 1 });
        this.bus.emit('shield', { active: true, duration: m.duration });
        break;
      }
      case 'deepFreeze': {
        // یخبندان — کندی شدید + آسیب یخ
        for (const e of [...this.enemies]) {
          if (!e.alive) continue;
          const d = e.getPos().distanceTo(point);
          if (d <= m.radius) {
            e.applySlow(m.freezeFactor ?? 0.12, m.duration ?? 4);
            e.takeDamage((m.damage ?? 60) * (1 - (d / m.radius) * 0.3), 'ice');
          }
        }
        this.vfx.ring(point, 0x67e8f9, m.radius + 1, 1.1);
        this.vfx.burst(point.clone().add(new THREE.Vector3(0, 1, 0)), 0xa5f3fc, 50, { speed: 7, life: 1.1, size: 0.6, gravity: 1, up: 0.6 });
        this.audio.play('freeze');
        this.cameraCtrl.shake(0.3);
        break;
      }
      case 'azarBlessing': {
        this.blessingUntil = this.time + (m.duration ?? 10);
        this.vfx.ring(this.scene3d.corePos, 0xfcd34d, 30, 1.4);
        this.audio.play('upgrade');
        break;
      }
      case 'coreMend': {
        this.coreHp = Math.min(this.coreMaxHp, this.coreHp + (m.healCore ?? 25));
        this.vfx.ring(this.scene3d.corePos, 0x4ade80, 6, 1.0);
        this.vfx.burst(this.scene3d.corePos.clone().add(new THREE.Vector3(0, 3, 0)), 0x4ade80, 36, { speed: 6, life: 1, size: 0.6, gravity: -2, up: 1 });
        this.audio.play('reward');
        this.bus.emit('core', { hp: this.coreHp, max: this.coreMaxHp });
        break;
      }
    }
    this.bus.emit('resources', { coins: this.coins, crystals: this.crystals });
    this.bus.emit('magic', this.magicState());
    if (!this.save.tutorialDone) this.bus.emit('tutorial', { step: 'done' });
    return true;
  }

  private magicState() {
    return Object.values(MAGIC).map((m) => ({
      id: m.id,
      cd: Math.round(this.magicCd[m.id] * 10) / 10,
      cdMax: m.cooldown,
      cost: m.crystalCost,
      affordable: this.crystals >= m.crystalCost && this.magicCd[m.id] <= 0,
    }));
  }

  private heroState() {
    const data = this.hero.data;
    return {
      level: this.hero.level,
      xpPct: Math.round((this.hero.xp / (data.xpPerLevel * this.hero.level)) * 100),
      abilityCd: Math.round(this.hero.abilityCd * 10) / 10,
      abilityMax: data.abilityCooldown,
      deployed: this.hero.deployed,
      hp: Math.round(this.hero.hp),
      maxHp: this.hero.maxHp,
      dead: this.hero.isDead,
      respawnIn: this.hero.respawnIn,
      heroId: data.id,
      nameKey: data.nameKey,
      abilityNameKey: data.abilityNameKey,
    };
  }

  // ===================== صاعقه زنجیره‌ای =====================

  private chainLightning(from: THREE.Vector3, first: DamageableEnemy, chains: number, damage: number, color: number) {
    const hitList: DamageableEnemy[] = [];
    let current = first;
    let currentDamage = damage;
    let currentFrom = from;
    for (let i = 0; i <= chains; i++) {
      if (!current || !current.alive) break;
      this.vfx.bolt(currentFrom, current.getPos().clone().add(new THREE.Vector3(0, 1.2, 0)), color);
      hitList.push(current);
      current.takeDamage(currentDamage, 'energy');
      currentDamage *= 0.72;
      currentFrom = current.getPos().clone().add(new THREE.Vector3(0, 1, 0));
      // هدف بعدی
      let next: DamageableEnemy | null = null;
      let bestD = 8;
      for (const e of this.enemies) {
        if (!e.alive || hitList.includes(e)) continue;
        const d = e.getPos().distanceTo(currentFrom);
        if (d < bestD) {
          bestD = d;
          next = e;
        }
      }
      current = next as DamageableEnemy;
      if (!next) break;
    }
  }

  private scheduleFireBarrage(center: THREE.Vector3, radius: number, count: number, damage: number, visual: 'fire' | 'arrow' = 'fire') {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.fireBarrage.push({
        time: i * 0.3,
        pos: center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)),
        damage,
        visual,
      });
    }
  }

  // ===================== تپ کاربر =====================

  private handleTap(hit: TapHit) {
    if (this.gameOver) return;

    // انتخاب شیء؟
    if (hit.objects.length > 0) {
      const root = hit.objects[0].object;
      // برج؟
      const tower = this.towers.find((t) => {
        let o: THREE.Object3D | null = root;
        while (o) {
          if (o === t.mesh) return true;
          o = o.parent;
        }
        return false;
      });
      if (tower) {
        this.selectedTower = tower;
        this.emitTowerInfo();
        this.buildMode = null;
        this.heroSelectMode = false;
        this.clearGhost();
        this.setBuildGridVisible(false);
        this.audio.play('tap');
        return;
      }
      // قهرمان؟ — تپ روی هیرو = ورود به حالت جابجایی
      if (root === this.hero.mesh || (root.parent && root.parent === this.hero.mesh)) {
        if (this.hero.alive) {
          this.buildMode = null;
          this.clearGhost();
          this.setBuildGridVisible(false);
          this.selectHeroMode(true);
          this.bus.emit('heroSelected', {});
          this.bus.emit('toast', { key: 'heroMoveHint', type: 'info' });
        } else {
          this.bus.emit('heroSelected', {});
        }
        this.audio.play('tap');
        return;
      }
    }

    // جادو در انتظار هدف
    if (this.magicPending) {
      const id = this.magicPending;
      this.magicPending = null;
      this.heroSelectMode = false;
      this.bus.emit('magicPending', { id: null });
      this.castMagic(id, hit.ground);
      return;
    }

    // حالت ساخت — اول پیش‌نمایش در نقطه تپ، بعد ساخت
    if (this.buildMode) {
      this.updateGhost(hit.ground);
      this.tryBuild(this.buildMode, hit.ground);
      return;
    }

    // حرکت/استقرار قهرمان
    if (this.heroSelectMode) {
      if (!this.hero.deployed) {
        this.deployHero(hit.ground);
      } else {
        this.hero.moveTo(hit.ground);
        this.vfx.ring(hit.ground, 0xffb020, 1.5, 0.4);
      }
      this.selectHeroMode(false);
      return;
    }

    this.selectedTower = null;
    this.bus.emit('selectTower', null);
  }

  // پیاده‌سازی قهرمان
  deployHero(point: THREE.Vector3) {
    const x = Math.round(point.x / 2) * 2;
    const z = Math.round(point.z / 2) * 2;
    this.hero.deploy(new THREE.Vector3(x, 0, z));
    this.bus.emit('hero', this.heroState());
  }

  useHeroAbility(): boolean {
    const ok = this.hero.useAbility();
    if (ok) this.bus.emit('hero', this.heroState());
    return ok;
  }

  // ===================== پایان بازی =====================

  private doVictory() {
    this.gameOver = true;
    const healthPct = (this.coreHp / this.coreMaxHp) * 100;
    const star1 = true;
    const star2 = healthPct >= this.level.star2HealthPct;
    const star3 = this.leaks === 0;
    const stars = (star1 ? 1 : 0) + (star2 ? 1 : 0) + (star3 ? 1 : 0);

    // پاداش‌ها
    const rewardCrystals = 10 + stars * 5;
    const rewardKnowledge = 2 + stars;
    this.crystals += rewardCrystals;
    this.save.crystals = this.crystals;
    this.save.knowledge += rewardKnowledge;
    this.save.stats.victories++;
    if (this.leaks === 0 && !this.save.achievements.includes('untouchable')) this.save.achievements.push('untouchable');
    if (this.coreHp === this.coreMaxHp && !this.save.achievements.includes('perfect_defense')) this.save.achievements.push('perfect_defense');
    if (healthPct < 10 && !this.save.achievements.includes('last_stand')) this.save.achievements.push('last_stand');

    const prev = this.save.levels[this.level.id];
    const bestStars = Math.max(prev?.stars ?? 0, stars);
    this.save.levels[this.level.id] = {
      stars: bestStars,
      bestHealthPct: Math.max(prev?.bestHealthPct ?? 0, Math.round(healthPct)),
      completed: true,
    };
    // بازمحاسبه مجموع ستاره‌ها
    this.save.stats.totalStars = Object.values(this.save.levels).reduce((sum, l) => sum + l.stars, 0);
    this.save.tutorialDone = true;

    this.audio.play('victory');
    this.vfx.burst(this.scene3d.corePos.clone().add(new THREE.Vector3(0, 3, 0)), 0xfbbf24, 80, { speed: 10, life: 1.4, size: 0.8, gravity: 4, up: 1 });
    this.bus.emit('victory', {
      stars,
      healthPct: Math.round(healthPct),
      rewards: { crystals: rewardCrystals, knowledge: rewardKnowledge, coins: this.coinsEarned },
    });
  }

  private doDefeat() {
    this.gameOver = true;
    this.save.crystals = this.crystals; // همگام‌سازی کریستال باقی‌مانده
    this.audio.play('defeat');
    this.audio.setBossMode(false);
    this.cameraCtrl.shake(1);
    this.vfx.explosion(this.scene3d.corePos.clone().add(new THREE.Vector3(0, 2.5, 0)), 0xef4444, true);
    this.bus.emit('defeat', {});
  }

  // ===================== کنترل‌های UI =====================

  setPaused(p: boolean) {
    this.paused = p;
    this.bus.emit('paused', { paused: p });
  }

  isPaused() {
    return this.paused;
  }

  setSpeed(s: number) {
    this.speed = s;
    this.bus.emit('speed', { speed: s });
  }

  getSpeed() {
    return this.speed;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.audio.dispose();
    this.hero.dispose();
    for (const e of this.enemies) e.remove();
    this.clearGhost();
    if (this.buildGrid) {
      this.buildGrid.geometry.dispose();
      ((this.buildGrid.material as THREE.MeshBasicMaterial).map)?.dispose();
      (this.buildGrid.material as THREE.Material).dispose();
      this.buildGrid.removeFromParent();
      this.buildGrid = null;
    }
    // آزادسازی Poolهای Handle — منابع GLB مشترک در Cache می‌مانند
    characterFactory.clearPools();
    this.scene3d.dispose();
  }
}
