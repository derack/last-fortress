import * as THREE from 'three';

// ============================================================
// ProceduralAnimationController — انیمیشن پروسیجرال بدنه‌صلب
// ------------------------------------------------------------
// برای GLBهای «بدون اسکلت» (skins=0 و animations=0) — مثل
// arman.glb. مدل استاتیک است ولی نباید مثل مجسمه باشد!
//
// ایده: کل مدل داخل یک «پیوت» سوار می‌شود و کنترلر همان API
// CharacterAnimationController را با حرکت بدنه‌صلب (Rigid-Body)
// پیاده می‌کند:
//   • Idle   — نفس‌کشیدن (بوب ملایم + تاب خوردن + نگاه چپ‌وراست)
//   • Walk   — بونس قدم + خم‌شدن به جلو + تلوتلو جانبی (فرکانس ∝ سرعت)
//   • Run    — همان با دامنه و فرکانس بیشتر
//   • Attack — One-Shot: کمانش به عقب → اسمش رو به جلو با لانژ → بازیابی
//   • Hit    — فلینچ کوتاه به عقب
//   • Skill  — ژست قدرت (بالا رفتن + کمانش)
//   • Roar   — جیغ/فاز۲ Boss
//   • Death  — افتادن به عقب با شتاب گرانش + فریز
//
// جابجایی‌ها روی pivot داخلی اعمال می‌شود؛ ریشه Handle (position/
// rotation.y) دست‌نخورده می‌ماند — Gameplay هیچ چیز نمی‌بیند.
// هر GLB انیمیشن‌داری که بعداً وارد شود، خودکار مسیر اسکلتی
// (CharacterAnimationController) را می‌رود و این کلاس ساخته نمی‌شود.
// ============================================================

export type ProceduralLocomotionState = 'idle' | 'walk' | 'run';

export interface ProceduralOneShotOptions {
  fade?: number;
  returnToLocomotion?: boolean;
  timeScale?: number;
}

interface OneShotPose {
  pitch: number; // خم به جلو(+) / عقب(−) — رادیان
  roll: number; // تلوتلو جانبی
  lift: number; // جابجایی عمودی
  lunge: number; // یورش به جلو (+Z محلی)
  yaw: number; // چرخش جزئی
}

interface OneShotProfile {
  duration: number;
  eval: (u: number) => OneShotPose;
}

// ---------- توابع Easing ----------
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInQuad = (t: number) => t * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- پروفایل‌های One-Shot ----------
// hamper: کمانش عقب (winding) → اسمش پرقدرت جلو (SMASH_PITCH) → بازیابی نرم
const SMASH_PITCH = 0.62;

const PROFILES: Record<string, OneShotProfile> = {
  attack: {
    duration: 0.52,
    eval: (u) => {
      if (u < 0.26) {
        // کمانش به عقب — جمع کردن انرژی
        const t = easeOutCubic(u / 0.26);
        return { pitch: -0.24 * t, roll: 0.02 * t, lift: 0.045 * t, lunge: -0.06 * t, yaw: 0 };
      }
      if (u < 0.5) {
        // اسمش — رها کردن سریع رو به جلو
        const t = easeInQuad((u - 0.26) / 0.24);
        const pitch = THREE.MathUtils.lerp(-0.24, SMASH_PITCH, t);
        return {
          pitch,
          roll: -0.03 * t,
          lift: THREE.MathUtils.lerp(0.045, -0.05, t),
          lunge: 0.34 * t,
          yaw: 0,
        };
      }
      // بازیابی
      const t = easeInOutCubic((u - 0.5) / 0.5);
      const pitch = THREE.MathUtils.lerp(SMASH_PITCH, 0, t);
      return {
        pitch,
        roll: -0.03 * (1 - t),
        lift: THREE.MathUtils.lerp(-0.05, 0, t),
        lunge: 0.34 * (1 - t),
        yaw: 0,
      };
    },
  },
  hit: {
    duration: 0.26,
    eval: (u) => {
      const s = Math.sin(u * Math.PI);
      return { pitch: -0.2 * s, roll: 0.07 * s, lift: -0.02 * s, lunge: -0.1 * s, yaw: 0 };
    },
  },
  skill: {
    duration: 0.75,
    eval: (u) => {
      const s = Math.sin(u * Math.PI);
      return { pitch: -0.16 * s, roll: 0, lift: 0.1 * s, lunge: 0, yaw: 0 };
    },
  },
  roar: {
    duration: 0.95,
    eval: (u) => {
      const s = Math.sin(u * Math.PI);
      return { pitch: -0.3 * s, roll: 0.05 * Math.sin(u * Math.PI * 2), lift: 0.07 * s, lunge: 0, yaw: 0.08 * s };
    },
  },
};

/** نگاشت نام درخواستی → پروفایل (فازی مثل کلیپ‌ها) */
function resolveProfile(name: string): OneShotProfile {
  const n = name.toLowerCase();
  if (n.includes('hit')) return PROFILES.hit;
  if (n.includes('skill')) return PROFILES.skill;
  if (n.includes('roar') || n.includes('phase') || n.includes('special')) return PROFILES.roar;
  // attack / attack1 / shoot / هر نام ناشناخته → اسمش عمومی
  return PROFILES.attack;
}

export class ProceduralAnimationController {
  readonly hasAnimations = false; // یعنی: کلیپ اسکلتی ندارد (نشان گالری هم صادق می‌ماند)
  readonly pivot: THREE.Group;

  private time = 0; // ساعت پیوسته — برای تنفس idle
  private phase = 0; // فاز گام — walk/run
  private loco: ProceduralLocomotionState = 'idle';
  private speedRatio = 1;

  private oneshot: OneShotProfile | null = null;
  private oneshotName = '';
  private oneshotT = 0;
  private oneshotTimeScale = 1;

  private dead = false;
  private deathT = 0;

  private h: number; // ارتفاع مدل — برای جبران‌های عمودی
  private amp: number; // ضریب دامنه بر اساس ارتفاع (دشمن کوچک ← دامنه کمتر)

  /**
   * @param inner گروه نرمال‌شده (normalizedModel) — همه فرزندانش داخل پیوت می‌روند
   * @param modelHeight ارتفاع نهایی مدل به World Unit
   */
  constructor(inner: THREE.Object3D, modelHeight: number) {
    this.pivot = new THREE.Group();
    this.pivot.name = 'proceduralPivot';
    for (const c of [...inner.children]) this.pivot.add(c);
    inner.add(this.pivot);
    this.h = Math.max(0.3, modelHeight);
    this.amp = THREE.MathUtils.clamp(modelHeight / 1.85, 0.65, 1.25);
  }

  // ------------------------- API مشترک با CharacterAnimationController -------------------------

  playLocomotion(state: ProceduralLocomotionState, speedRatio = 1) {
    if (this.dead) return;
    this.loco = state;
    this.speedRatio = THREE.MathUtils.clamp(speedRatio, 0.4, 2);
  }

  playOneShot(name: string, opts: ProceduralOneShotOptions = {}): boolean {
    if (this.dead) return false;
    this.oneshot = resolveProfile(name);
    this.oneshotName = name;
    this.oneshotT = 0;
    this.oneshotTimeScale = Math.max(0.25, opts.timeScale ?? 1);
    return true;
  }

  /** مرگ — افتادن به عقب با شتاب گرانش + فریز (همیشه true — خودش مسئول است) */
  playDeath(): boolean {
    if (this.dead) return true;
    this.dead = true;
    this.oneshot = null;
    this.deathT = 0;
    return true;
  }

  isBusy(): boolean {
    return this.oneshot !== null;
  }

  isDead(): boolean {
    return this.dead;
  }

  /** نام تک‌پخش جاری (داخلی/گالری) */
  get activeOneShot(): string {
    return this.oneshotName;
  }

  /** ریست کامل — reuse از Object Pool */
  reset() {
    this.dead = false;
    this.oneshot = null;
    this.oneshotName = '';
    this.loco = 'idle';
    this.speedRatio = 1;
    this.applyPose(0, 0, 0, 0, 0);
  }

  stopAll() {
    this.oneshot = null;
    this.oneshotName = '';
    this.loco = 'idle';
    this.applyPose(0, 0, 0, 0, 0);
  }

  update(dt: number) {
    this.time += dt;

    // پیشرفت One-Shot
    if (this.oneshot) {
      this.oneshotT += dt * this.oneshotTimeScale;
      if (this.oneshotT >= this.oneshot.duration) {
        this.oneshot = null;
        this.oneshotName = '';
      }
    }

    if (this.dead) {
      this.deathT += dt;
      // افتادن به عقب — شتاب‌دار مثل گرانش، با ته‌نشین جزئی در انتها
      const FALL_T = 0.55;
      const u = Math.min(1, this.deathT / FALL_T);
      let pitch = -1.38 * easeInQuad(u);
      if (u >= 1) {
        // بونس کوچک بعد از برخورد
        const b = Math.min(1, (this.deathT - FALL_T) / 0.25);
        pitch += Math.sin(b * Math.PI) * 0.05;
      }
      const lift = -0.04 * Math.sin(Math.min(1, u) * Math.PI * 0.5);
      this.applyPose(pitch, 0, lift, 0, 0);
      return;
    }

    // ---------- ژست حرکتی پایه ----------
    let pitch = 0;
    let roll = 0;
    let lift = 0;
    let yaw = 0;
    let lunge = 0;

    if (this.loco === 'idle') {
      // تنفس — دو سینو هم‌پوشان + تاب ملایم + نگاه اطراف
      lift += (Math.sin(this.time * 2.1) * 0.016 + Math.sin(this.time * 1.23) * 0.006) * this.amp;
      pitch += Math.sin(this.time * 1.4) * 0.012;
      roll += Math.sin(this.time * 0.9) * 0.02;
      yaw += Math.sin(this.time * 0.55) * 0.025;
    } else {
      // walk / run — بونس قدم هم‌گام با سرعت واقعی
      const baseFreq = this.loco === 'run' ? 12 : 9;
      this.phase += dt * baseFreq * this.speedRatio;
      const runK = this.loco === 'run' ? 1.7 : 1;

      const bounce = Math.abs(Math.sin(this.phase));
      lift += (bounce * 0.05 * runK - 0.018 * runK) * this.amp;
      pitch += (this.loco === 'run' ? 0.15 : 0.06) + Math.sin(this.phase * 2) * 0.018 * runK;
      roll += Math.sin(this.phase) * 0.05 * runK;
      yaw += Math.sin(this.phase) * 0.035 * runK;
    }

    // ---------- همپوشانی One-Shot (شروع/پایان صفر → ترکیب نرم) ----------
    if (this.oneshot) {
      const p = this.oneshot.eval(Math.min(1, this.oneshotT / this.oneshot.duration));
      pitch += p.pitch;
      roll += p.roll;
      lift += p.lift * this.amp;
      yaw += p.yaw;
      lunge += p.lunge * this.amp;
    }

    this.applyPose(pitch, roll, lift, lunge, yaw);
  }

  dispose() {
    // منابعی آزاد نمی‌شود — فقط ژست خنثی
    this.applyPose(0, 0, 0, 0, 0);
  }

  // ------------------------- اعمال ژست روی پیوت -------------------------

  /**
   * pitch حول «پاها» می‌چرخد — سر قوس جلو/عقب می‌زند و پاها کاشته می‌شوند.
   * جبران عمودی کوچک (0.18·H·(1−cosθ)) مانع فرو رفتن ظاهری بدن در زمین می‌شود؛
   * کلیپ جزئیِ پشت بافت زمین از نمای بالا پنهان است.
   */
  private applyPose(pitch: number, roll: number, lift: number, lunge: number, yaw: number) {
    this.pivot.rotation.set(pitch, yaw, roll);
    this.pivot.position.set(0, lift + 0.18 * this.h * (1 - Math.cos(pitch)), lunge);
  }
}
