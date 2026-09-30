import * as THREE from 'three';
import { faNum } from '../data/i18n';

// ============================================================
// اعداد آسیب شناور — بخش ۱۴ Combat Feedback
// ------------------------------------------------------------
// • تجمیع per-enemy در پنجره ۰٫۲۵ ثانیه → بدون اسپم عدد (بخش ۱۳)
// • انتقاد: عدد بزرگ‌تر و کهربایی
// • Pool عناصر DOM — بدون تخصیص مکرر (بخش ۳۵ Object Pool)
// • Project دستی world → صفحه با دوربین
// ============================================================

const WINDOW = 0.25; // ثانیه تجمیع
const LIFE = 0.85; // ثانیه عمر عدد
const MAX_ACTIVE = 26; // بیشینه عدد همزمان روی صفحه

export class DamageNumbers {
  private layer: HTMLDivElement;
  private pool: HTMLSpanElement[] = [];
  private active: { el: HTMLSpanElement; until: number }[] = [];
  /** تجمیع per-enemy — آخرین موقعیت و مجموع آسیب پنجره */
  private pending = new Map<number, { pos: THREE.Vector3; amount: number; crit: boolean }>();
  private flushT = 0;
  private now = 0;
  private tmp = new THREE.Vector3();

  constructor(private camera: THREE.Camera, parent: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'damage-numbers';
    parent.appendChild(this.layer);
  }

  /** ثبت یک اصابت — تجمیع می‌شود و در پایان پنجره نمایش می‌یابد */
  add(enemyId: number, pos: THREE.Vector3, amount: number, crit: boolean) {
    const cur = this.pending.get(enemyId);
    if (cur) {
      cur.amount += amount;
      cur.crit = cur.crit || crit;
      cur.pos.copy(pos);
    } else {
      this.pending.set(enemyId, { pos: pos.clone(), amount, crit });
    }
  }

  update(dt: number) {
    this.now += dt;
    this.flushT += dt;
    if (this.flushT >= WINDOW) {
      this.flushT = 0;
      this.flush();
    }
    // بازگرداندن عناصر منقضی به pool
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (this.now >= a.until) {
        a.el.style.display = 'none';
        this.pool.push(a.el);
        this.active.splice(i, 1);
      }
    }
  }

  /** ریختن تجمیع‌ها به صفحه */
  private flush() {
    for (const [, e] of this.pending) {
      if (this.active.length >= MAX_ACTIVE) break;
      const el = this.pool.pop() ?? this.createEl();
      el.textContent = faNum(Math.max(1, Math.round(e.amount)));
      el.className = e.crit ? 'dmg-float dmg-crit' : 'dmg-float';
      // project world → px
      this.tmp.copy(e.pos).project(this.camera);
      if (this.tmp.z > 1) continue; // پشت دوربین
      const x = (this.tmp.x * 0.5 + 0.5) * this.layer.clientWidth;
      const y = (-this.tmp.y * 0.5 + 0.5) * this.layer.clientHeight;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(y)}px`;
      el.style.display = 'block';
      // ری‌استارت انیمیشن
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      this.active.push({ el, until: this.now + LIFE });
    }
    this.pending.clear();
  }

  private createEl(): HTMLSpanElement {
    const el = document.createElement('span');
    this.layer.appendChild(el);
    return el;
  }

  dispose() {
    this.layer.remove();
    this.pool.length = 0;
    this.active.length = 0;
    this.pending.clear();
  }
}
