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
//   • Idle   — نفس‌کشیدن (بوب ملایم + تاب خیلی ملایم + نگاه چپ‌وراست)
//   • Walk   — بونس قدم + خم‌شدن به جلو + تلوتلو جانبی (فرکانس ∝ سرعت)
//   • Run    — همان با دامنه و فرکانس بیشتر
//   • Attack — One-Shot: بدن فقط کمی جلو می‌رود؛ «سلاح جدا» (مثل پتک
//             آرمان) دور نقطهٔ دست تاب می‌خورد: عقب-بالا → کوبیدن جلو
//
// ویژگی Prop-Swing: اگر مدل یک مش جداگانهٔ کوچک و کشیده داشته باشد
// (پتک/شمشیر/عصا که از بدن مجزا است)، به‌صورت خودکار پیدا می‌شود،
// دور «نقطهٔ گریپ» (انتهای دسته سمت بدن) یک پیوت ساخته می‌شود و در
// حمله/مهارت تاب می‌خورد — دست ثابت می‌ماند و سلاح حرکت می‌کند.
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
  prop?: number; // زاویه سلاح جدا (رادیان حول محور تاب) — اختیاری
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
// فلسفهٔ جدید حمله (بازخورد کاربر: «دست پتک‌دار عقب-جلو، خودش کمتر تاب»):
//   بدن فقط کمی جلو می‌رود (pitch ≤ ۰٫۱۲ — قبلاً ۰٫۶۲!) و بیانِ ضربه
//   با «تاب سلاح» دور نقطهٔ دست انجام می‌شود: عقب-بالا → کوبیدن جلو
const PROP_WINDUP = -0.8; // بالا کشیدن پتک به عقب (رادیان)
const PROP_SMASH = 0.6; // کوبیدن پتک به جلو/پایین (رادیان)

const PROFILES: Record<string, OneShotProfile> = {
  attack: {
    duration: 0.55,
    eval: (u) => {
      if (u < 0.26) {
        // عقب — بالا کشیدن پتک (جمع کردن انرژی؛ بدن تقریباً ثابت)
        const t = easeOutCubic(u / 0.26);
        return { pitch: -0.05 * t, roll: 0.01 * t, lift: 0.015 * t, lunge: -0.025 * t, yaw: 0, prop: PROP_WINDUP * t };
      }
      if (u < 0.5) {
        // جلو — کوبیدن سریع پتک + یورش کوچک بدن
        const t = easeInQuad((u - 0.26) / 0.24);
        return {
          pitch: THREE.MathUtils.lerp(-0.05, 0.12, t),
          roll: -0.012 * t,
          lift: THREE.MathUtils.lerp(0.015, -0.02, t),
          lunge: 0.13 * t,
          yaw: 0,
          prop: THREE.MathUtils.lerp(PROP_WINDUP, PROP_SMASH, t),
        };
      }
      // بازیابی — پتک نرم به دست برمی‌گردد
      const t = easeInOutCubic((u - 0.5) / 0.5);
      return {
        pitch: THREE.MathUtils.lerp(0.12, 0, t),
        roll: -0.012 * (1 - t),
        lift: THREE.MathUtils.lerp(-0.02, 0, t),
        lunge: 0.13 * (1 - t),
        yaw: 0,
        prop: THREE.MathUtils.lerp(PROP_SMASH, 0, t),
      };
    },
  },
  hit: {
    duration: 0.26,
    eval: (u) => {
      const s = Math.sin(u * Math.PI);
      return { pitch: -0.2 * s, roll: 0.07 * s, lift: -0.02 * s, lunge: -0.1 * s, yaw: 0, prop: -0.14 * s };
    },
  },
  skill: {
    duration: 0.75,
    eval: (u) => {
      const s = Math.sin(u * Math.PI);
      return { pitch: -0.16 * s, roll: 0, lift: 0.1 * s, lunge: 0, yaw: 0, prop: -0.95 * s };
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

  // --- سلاح جدا (Prop-Swing) ---
  private propPivot: THREE.Object3D | null = null;
  private propAxis: 'x' | 'z' = 'x';

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
    this.setupPropSwing(inner);
  }

  // ------------------------- سلاح جدا (Prop-Swing) -------------------------

  /**
   * اگر مدل یک مش جداگانهٔ «کوچک + کشیده» داشته باشد (پتک/شمشیر/عصا)،
   * دور نقطهٔ گریپ (انتهای دسته سمت بدن) پیوت می‌سازد تا در حمله/مهارت
   * سلاح عقب-جلو تاب بخورد — مثل ضربهٔ دست. معیارها محافظه‌کارانه‌اند:
   *   • حجم مش < ۱۰٪ حجم بزرگ‌ترین مش (بدن)
   *   • یک بُعد کاملاً غالب (≥ ۱٫۴× بُردهای دیگر) — یعنی «دسته» دارد
   * گریپ = انتهای دسته نزدیک‌تر به مرکز بدن | محور تاب = محور افقی عمود بر دسته
   * نقاط VFX سینتتیک سلاح (weaponpoint/...) هم سوار پیوت می‌شوند تا جرقه‌ها
   * دنبال تاب خوردن پتک بروند.
   * هر خطایی بی‌صدا رد می‌شود — هیچ‌وقت مسیر رندر نمی‌شکند.
   */
  private setupPropSwing(inner: THREE.Object3D) {
    try {
      inner.updateMatrixWorld(true);
      const invPivot = new THREE.Matrix4().copy(this.pivot.matrixWorld).invert();

      // همه مش‌ها زیر پیوت + bbox در فضای پیوت (فضای محلی مدل نرمال‌شده)
      const parts: { node: THREE.Mesh; box: THREE.Box3; vol: number }[] = [];
      this.pivot.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        const box = new THREE.Box3().setFromObject(o).applyMatrix4(invPivot);
        const s = box.getSize(new THREE.Vector3());
        parts.push({ node: o as THREE.Mesh, box, vol: Math.max(1e-8, s.x * s.y * s.z) });
      });
      if (parts.length < 2) return;
      parts.sort((a, b) => b.vol - a.vol);
      const body = parts[0];
      const prop = parts[parts.length - 1];
      if (prop.vol > body.vol * 0.1) return; // عضو جداگانهٔ واضح نیست

      const ps = prop.box.getSize(new THREE.Vector3());
      const axes = ['x', 'y', 'z'] as const;
      let handle: 'x' | 'y' | 'z' = 'x';
      for (const a of axes) if (ps[a] > ps[handle]) handle = a;
      const others = axes.filter((a) => a !== handle);
      if (ps[handle] < Math.max(ps[others[0]], ps[others[1]]) * 1.4) return; // کشیده نیست (سپر/گرد)

      const bodyC = body.box.getCenter(new THREE.Vector3());
      const propC = prop.box.getCenter(new THREE.Vector3());
      const sgn = bodyC[handle] >= propC[handle] ? 1 : -1;
      const grip = propC.clone();
      grip[handle] = propC[handle] + sgn * ps[handle] * 0.5; // انتهای دسته سمت بدن
      const tip = propC.clone();
      tip[handle] = propC[handle] - sgn * ps[handle] * 0.5; // سرِ سلاح

      // پیوت در فضای والدِ مش سلاح
      const parent = prop.node.parent ?? this.pivot;
      const pp = new THREE.Object3D();
      pp.name = 'propPivot';
      parent.add(pp);
      pp.position.copy(grip.clone().applyMatrix4(this.pivot.matrixWorld));
      pp.position.copy(parent.worldToLocal(pp.position));
      pp.attach(prop.node); // حفظ ترنسفورم جهانی — مدل نمی‌پرد

      // محور تاب = محور افقی عمود بر دسته
      this.propPivot = pp;
      this.propAxis = handle === 'x' ? 'z' : 'x';

      // نقاط VFX سینتتیک سلاح → روی پیوت پتک (دنبال تاب می‌روند)
      inner.updateMatrixWorld(true);
      const tipWorld = tip.applyMatrix4(this.pivot.matrixWorld);
      for (const nm of ['synthetic_weaponpoint', 'synthetic_muzzlepoint', 'synthetic_staffpoint']) {
        const wp = inner.getObjectByName(nm);
        if (!wp) continue;
        pp.add(wp);
        wp.position.copy(pp.worldToLocal(tipWorld.clone()));
        wp.rotation.set(0, 0, 0);
        wp.scale.set(1, 1, 1);
      }
    } catch {
      // تشخیص سلاح اختیاری است — هرگز نباید رندر را ببندد
      this.propPivot = null;
    }
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
    let prop = 0; // زاویه سلاح جدا

    if (this.loco === 'idle') {
      // تنفس — بوب ملایم + تاب خیلی ملایم (کمتر از قبل — بازخورد کاربر)
      lift += (Math.sin(this.time * 2.1) * 0.016 + Math.sin(this.time * 1.23) * 0.006) * this.amp;
      pitch += Math.sin(this.time * 1.4) * 0.008;
      roll += Math.sin(this.time * 0.9) * 0.012;
      yaw += Math.sin(this.time * 0.55) * 0.015;
      // پتک با تنفس میلی‌متری همراهی می‌کند (در دست احساس می‌شود، نه لق)
      prop += Math.sin(this.time * 2.1 + 0.6) * 0.028;
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
      // پتک هنگام راه رفتن با ریتم قدم کمی تاب می‌خورد
      prop += Math.sin(this.phase) * 0.06 * runK;
    }

    // ---------- همپوشانی One-Shot (شروع/پایان صفر → ترکیب نرم) ----------
    if (this.oneshot) {
      const p = this.oneshot.eval(Math.min(1, this.oneshotT / this.oneshot.duration));
      pitch += p.pitch;
      roll += p.roll;
      lift += p.lift * this.amp;
      yaw += p.yaw;
      lunge += p.lunge * this.amp;
      prop += p.prop ?? 0;
    }

    this.applyPose(pitch, roll, lift, lunge, yaw, prop);
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
  private applyPose(pitch: number, roll: number, lift: number, lunge: number, yaw: number, prop = 0) {
    this.pivot.rotation.set(pitch, yaw, roll);
    this.pivot.position.set(0, lift + 0.18 * this.h * (1 - Math.cos(pitch)), lunge);
    if (this.propPivot) {
      this.propPivot.rotation.set(0, 0, 0);
      this.propPivot.rotation[this.propAxis] = prop;
    }
  }
}
