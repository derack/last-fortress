import * as THREE from 'three';

// ============================================================
// CharacterAnimationController — کنترلر انیمیشن کاراکتر
// ------------------------------------------------------------
// روی THREE.AnimationMixer سوار است:
//   • حالت‌های حرکتی: Idle / Walk / Run با Crossfade نرم
//   • تک‌پخش‌ها (One-Shot): Attack / Hit / Skill / Roar / PhaseChange
//   • Death: یک‌بار پخش، Freeze روی فریم آخر
//   • بازگشت خودکار به حالت حرکتی بعد از تک‌پخش
//   • Fuzzy matching نام کلیپ‌ها (Attack01 → attack و...)
//   • اگر GLB انیمیشنی نداشت همه متدها no-op می‌شوند
//     (Fallback پروسیجرال سمت Entity به کار خودش ادامه می‌دهد)
// ============================================================

export type LocomotionState = 'idle' | 'walk' | 'run';

export interface OneShotOptions {
  /** مدت Crossfade ورودی (ثانیه) */
  fade?: number;
  /** بعد از پایان به حالت حرکتی برگردد؟ (برای Death false) */
  returnToLocomotion?: boolean;
  /** سرعت پخش */
  timeScale?: number;
}

function normName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class CharacterAnimationController {
  mixer: THREE.AnimationMixer;
  /** نام‌های نرمال‌شده انیمیشن‌های موجود */
  available: string[] = [];
  private actions = new Map<string, THREE.AnimationAction>(); // key: نام درخواستی نرمال‌شده
  private clipActions = new Map<THREE.AnimationClip, THREE.AnimationAction>();
  private currentLoco: LocomotionState | null = null;
  private oneshotActive: THREE.AnimationAction | null = null;
  private oneshotName = '';
  private dead = false;
  private baseTimeScale = 1;
  private finishedBound: ((e: { action: THREE.AnimationAction }) => void) | null = null;
  /** Stable per-instance variation prevents crowds from marching in lockstep. */
  private readonly phaseOffset: number;
  private readonly speedVariation: number;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    // Derive repeatable variation from the cloned root UUID: no frame-time RNG,
    // no shared mutable state, and no synchronization between identical enemies.
    let seed = 2166136261;
    for (let i = 0; i < root.uuid.length; i++) {
      seed ^= root.uuid.charCodeAt(i);
      seed = Math.imul(seed, 16777619) >>> 0;
    }
    const unit = seed / 0xffffffff;
    const unit2 = ((Math.imul(seed ^ 0x9e3779b9, 2246822519) >>> 0) / 0xffffffff);
    this.phaseOffset = unit;
    this.speedVariation = 0.94 + unit2 * 0.12;

    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      this.clipActions.set(clip, action);
      this.available.push(normName(clip.name));
    }

    if (clips.length > 0) {
      this.finishedBound = (e) => {
        const action = e.action;
        if (action === this.oneshotActive) {
          if (!this.dead) {
            this.oneshotActive = null;
            // بازگشت نرم به حالت حرکتی فعلی
            if (this.currentLoco) {
              const loco = this.resolveLoco(this.currentLoco);
              if (loco) loco.action.reset().fadeIn(LOCOMOTION_FADE).play();
            }
          }
        }
      };
      this.mixer.addEventListener('finished', this.finishedBound as never);
    }
  }

  get hasAnimations(): boolean {
    return this.available.length > 0;
  }

  /** یافتن اکشن با تطبیق فازی نام */
  private resolve(requested: string): THREE.AnimationAction | null {
    if (this.available.length === 0) return null;
    const target = normName(requested);
    if (this.actions.has(target)) return this.actions.get(target)!;

    // ۱) تطبیق دقیق
    let match: THREE.AnimationClip | null = null;
    for (const clip of this.clipActions.keys()) {
      if (normName(clip.name) === target) {
        match = clip;
        break;
      }
    }
    // ۲) کلیپ شامل نام درخواستی (Attack_Forward → attack)
    if (!match) {
      for (const clip of this.clipActions.keys()) {
        const cn = normName(clip.name);
        if (cn.startsWith(target) || cn.includes(target)) {
          match = clip;
          break;
        }
      }
    }
    // ۳) نام درخواستی شامل کلیپ (attack1 → attack)
    if (!match) {
      for (const clip of this.clipActions.keys()) {
        const cn = normName(clip.name);
        if (target.includes(cn)) {
          match = clip;
          break;
        }
      }
    }
    if (!match) return null;
    const action = this.clipActions.get(match)!;
    this.actions.set(target, action);
    return action;
  }

  /** Run نبود → Walk سریع‌تر (graceful) */
  private resolveLoco(state: LocomotionState): { action: THREE.AnimationAction; timeScale: number } | null {
    const direct = this.resolve(state);
    if (direct) return { action: direct, timeScale: 1 };
    if (state === 'run') {
      const walk = this.resolve('walk');
      if (walk) return { action: walk, timeScale: 1.6 };
    }
    if (state === 'walk') {
      const run = this.resolve('run');
      if (run) return { action: run, timeScale: 0.7 };
    }
    return null;
  }

  /**
   * تغییر حالت حرکتی با Crossfade نرم (بخش ۶: Idle→Walk→Run بدون پرش)
   * اگر حالت عوض نشده باشد فقط سرعت پخش آپدیت می‌شود.
   */
  playLocomotion(state: LocomotionState, speedRatio = 1) {
    if (!this.hasAnimations || this.dead) return;
    if (this.currentLoco === state) {
      // هماهنگی سرعت انیمیشن با سرعت واقعی حرکت
      const cur = this.resolveLoco(state);
      if (cur) {
        cur.action.timeScale = cur.timeScale * this.speedVariation * Math.min(1.4, Math.max(0.75, speedRatio));
      }
      return;
    }
    const next = this.resolveLoco(state);
    if (!next) return;

    const prevAction = this.oneshotActive ?? (this.currentLoco ? this.resolveLoco(this.currentLoco)?.action : null) ?? null;
    this.currentLoco = state;
    this.oneshotActive = null;

    next.action.reset();
    next.action.setLoop(THREE.LoopRepeat, Infinity);
    // Start at a different point in the loop for each instance; after reset the
    // time must be assigned before play/crossfade to avoid a visible snap.
    next.action.time = next.action.getClip().duration * this.phaseOffset;
    next.action.timeScale = next.timeScale * this.speedVariation;
    next.action.enabled = true;
    if (prevAction && prevAction !== next.action && prevAction.isRunning()) {
      next.action.play();
      next.action.crossFadeFrom(prevAction, 0.22, true);
    } else {
      next.action.fadeIn(0.22).play();
    }
  }

  /** تک‌پخش (Attack/Skill/Hit/Roar/...) — بعد از پایان خودکار به حرکتی برمی‌گردد */
  playOneShot(name: string, opts: OneShotOptions = {}): boolean {
    if (!this.hasAnimations || this.dead) return false;
    const { fade = 0.12, returnToLocomotion = true, timeScale = 1 } = opts;
    const action = this.resolve(name);
    if (!action) return false;

    this.baseTimeScale = timeScale;
    if (returnToLocomotion) this.oneshotActive = action;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.timeScale = timeScale * this.speedVariation;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.clampWhenFinished = !returnToLocomotion;
    action.play();

    const prev = this.currentLoco ? this.resolveLoco(this.currentLoco)?.action : null;
    if (prev && prev !== action && prev.isRunning()) {
      action.crossFadeFrom(prev, fade, true);
    } else {
      action.fadeIn(fade);
    }
    return true;
  }

  /** انیمیشن مرگ — یک‌بار، Freeze روی فریم آخر، بدون بازگشت */
  playDeath(): boolean {
    if (!this.hasAnimations || this.dead) return false;
    const action = this.resolve('death') ?? this.resolve('die');
    if (!action) return false;
    this.dead = true;
    this.oneshotActive = null;
    this.mixer.stopAllAction();
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();
    return true;
  }

  /** آیا تک‌پخش در حال اجراست؟ (برای جلوگیری از Interrupt) */
  isBusy(): boolean {
    return this.oneshotActive !== null;
  }

  isDead(): boolean {
    return this.dead;
  }

  /** ریست کامل — برای reuse از Object Pool */
  reset() {
    if (!this.hasAnimations) return;
    this.dead = false;
    this.oneshotActive = null;
    this.currentLoco = null;
    this.mixer.stopAllAction();
    this.playLocomotion('idle');
  }

  stopAll() {
    this.mixer.stopAllAction();
    this.currentLoco = null;
    this.oneshotActive = null;
  }

  /**
   * بروزرسانی هر فریم.
   * LOD انیمیشن: با throttling (مثلاً هر فریم دوم) dt تجمعی پاس داده می‌شود.
   */
  update(dt: number) {
    if (!this.hasAnimations) return;
    this.mixer.update(dt);
  }

  dispose() {
    if (this.finishedBound) {
      this.mixer.removeEventListener('finished', this.finishedBound as never);
    }
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}

const LOCOMOTION_FADE = 0.22;
