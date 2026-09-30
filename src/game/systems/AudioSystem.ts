// ============================================================
// سیستم صوتی پروسیجرال — بدون فایل صوتی، با Web Audio API
// شامل SFX (شلیک، انفجار، جادو، UI) + موسیقی حماسی تکرارشونده
// ============================================================

type SfxName =
  | 'tap' | 'place' | 'upgrade' | 'sell' | 'shoot' | 'cannon' | 'lightning'
  | 'freeze' | 'explosion' | 'magic' | 'death' | 'bossRoar' | 'victory'
  | 'defeat' | 'reward' | 'error' | 'waveStart' | 'heroShot'
  | 'hit' | 'bossPhase' | 'deepFreeze';

export type SceneMode = 'menu' | 'battle';

interface AudioManifest {
  sfx?: Partial<Record<SfxName, string>>;
  music?: string;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private bossMode = false;
  private scene: SceneMode = 'battle';
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private lastHitSfx = 0; // بخش ۱۵ — محدودسازی نرخ صدای اصابت

  // بخش ۱۵ — Drop-in فایل‌های صوتی واقعی (اختیاری)
  // اگر public/assets/audio/manifest.json موجود باشد، فایل‌ها جای سنتز پخش می‌شوند
  private buffers = new Map<SfxName, AudioBuffer>();
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private probed = false;

  /** باید بعد از اولین تعامل کاربر صدا زده شود (سیاست مرورگرها) */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol * 0.35;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);

      // بافر نویز سفید برای انفجارها
      const len = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    } catch {
      this.ctx = null;
      return;
    }
    void this.probeAssets();
  }

  // ------------------- Drop-in فایل صوتی (بخش ۱۵) -------------------
  // ساختار: public/assets/audio/manifest.json
  // { "music": "/assets/audio/music.mp3", "sfx": { "tap": "/assets/audio/tap.mp3", ... } }
  // بدون manifest یا در صورت خطا → سنتز پروسیجرال (بدون هیچ درخواست ۴۰۴ اضافه)

  private async probeAssets() {
    if (this.probed || !this.ctx) return;
    this.probed = true;
    try {
      const res = await fetch('/assets/audio/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const mf = (await res.json()) as AudioManifest;
      if (mf.music) this.musicBuffer = await this.loadFile(mf.music);
      for (const [k, url] of Object.entries(mf.sfx ?? {})) {
        const buf = await this.loadFile(url as string);
        if (buf) this.buffers.set(k as SfxName, buf);
      }
      // اگر موسیقی فایل‌محور آمد و موسیقی سینتی در حال پخش است → سوییچ نرم
      if (this.musicBuffer && this.started) {
        this.stopMusic();
        this.startMusic();
      }
    } catch {
      /* بدون manifest — سنتز می‌ماند */
    }
  }

  private async loadFile(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const r = await fetch(url, { cache: 'force-cache' });
      if (!r.ok) return null;
      return await this.ctx.decodeAudioData(await r.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** پخش یک بافر آماده روی گین مقصد */
  private playBuffer(buf: AudioBuffer, dest: AudioNode, vol = 1, loop = false) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(dest);
    src.start();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.ctx) {
      this.musicGain.gain.value = music * 0.35;
      this.sfxGain.gain.value = sfx;
    }
  }

  setBossMode(on: boolean) {
    this.bossMode = on;
  }

  /** فاز ۶ — حالت صحنه: منو (آرام) / نبرد (پرانرژی) — BossMode همیشه غالب است */
  setSceneMode(mode: SceneMode) {
    if (this.scene === mode) return;
    this.scene = mode;
    // با تغییر صحنه، ریتم از گام بعد می‌شود
    this.step = 0;
  }

  // ------------------------- موسیقی -------------------------

  startMusic() {
    this.ensure();
    if (!this.ctx || this.started) return;
    this.started = true;
    // فایل موسیقی واقعی (Drop-in) — لوپ بی‌درنگ
    if (this.musicBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.musicBuffer;
      src.loop = true;
      src.connect(this.musicGain);
      src.start();
      this.musicSource = src;
      return;
    }
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduler(), 120);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* قبلاً متوقف شده */ }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    this.started = false;
  }

  private scheduler() {
    if (!this.ctx) return;
    const bpm = this.bossMode ? 132 : this.scene === 'menu' ? 64 : 84;
    const stepDur = 60 / bpm / 4; // ۱۶ام
    // فاز ۶ — بعد از resume طولانی، پرش زمانی باعث موج نُه‌های همزمان نشود
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
    while (this.nextNoteTime < this.ctx.currentTime + 0.4) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextNoteTime += stepDur;
    }
  }

  private playStep(step: number, when: number, dur: number) {
    if (!this.ctx) return;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    // پیشروی آکورد: Am — F — C — G (ایرانی/حماسی)
    const roots = [110, 87.31, 130.81, 98]; // A2 F2 C3 G2
    const root = roots[bar % 4];

    // فاز ۶ — حالت منو: بدون درام و بیس، فقط پد آرام + ملودی گاه‌به‌گاه
    const menu = this.scene === 'menu' && !this.bossMode;

    // درام (بم)
    if (!menu && (s === 0 || s === 8 || (this.bossMode && s === 12))) {
      this.tone(s === 0 ? 55 : 45, when, 0.28, 'sine', this.bossMode ? 0.5 : 0.32, 90, 0.06);
    }
    // هی‌هت نرم
    if (this.bossMode && (s % 4 === 2)) this.noise(when, 0.04, 6000, 0.06, 'highpass');

    // بیس
    if (!menu && (s === 0 || s === 6 || s === 10)) {
      this.tone(root / 2, when, 0.7, 'triangle', 0.16);
    }

    // پد آکورد
    if (s === 0) {
      const fifth = root * 1.5;
      const third = root * (bar % 4 === 0 ? 1.2 : 1.19); // مینور/ماژور تقریبی
      this.tone(root, when, 2.2, 'sawtooth', 0.045, undefined, undefined, 400);
      this.tone(third, when, 2.2, 'sawtooth', 0.04, undefined, undefined, 500);
      this.tone(fifth, when, 2.2, 'sawtooth', 0.04, undefined, undefined, 600);
    }

    // ملودی پنتاتونیک محو (فقط گاهی) — در منو کمی پرتکرارتر و نرم‌تر
    const melody = [0, 3, 5, 7, 10, 12];
    if (!this.bossMode && s === 4 && Math.random() < (menu ? 0.8 : 0.6)) {
      const n = root * Math.pow(2, melody[Math.floor(Math.random() * melody.length)] / 12);
      this.tone(n, when, menu ? 0.9 : 0.5, 'sine', menu ? 0.045 : 0.06);
    }
    if (this.bossMode && s % 2 === 0 && Math.random() < 0.5) {
      const n = root * Math.pow(2, melody[Math.floor(Math.random() * melody.length)] / 12) * 2;
      this.tone(n, when, 0.16, 'square', 0.035);
    }
    void dur;
  }

  private tone(freq: number, when: number, dur: number, type: OscillatorType, vol: number,
    sweepTo?: number, sweepDur?: number, lp?: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), when + (sweepDur ?? dur));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    let node: AudioNode = g;
    if (lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      g.connect(f);
      node = f;
    }
    osc.connect(g);
    node.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  // ------------------------- SFX -------------------------

  private noise(when: number, dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, when);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  private blip(freq: number, to: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  play(name: SfxName) {
    if (!this.ctx) return;
    // فایل صوتی واقعی (Drop-in) اگر موجود باشد — وگرنه سنتز
    const buf = this.buffers.get(name);
    if (buf) {
      this.playBuffer(buf, this.sfxGain);
      return;
    }
    const now = this.ctx.currentTime;
    switch (name) {
      case 'tap':
        this.blip(700, 500, 0.06, 'square', 0.12);
        break;
      case 'place':
        this.blip(220, 70, 0.22, 'sine', 0.5);
        this.noise(now, 0.12, 400, 0.2, 'lowpass');
        break;
      case 'upgrade':
        this.blip(520, 780, 0.1, 'square', 0.16);
        setTimeout(() => this.blip(780, 1180, 0.14, 'square', 0.16), 90);
        break;
      case 'sell':
        this.blip(1100, 1500, 0.08, 'triangle', 0.2);
        setTimeout(() => this.blip(1500, 1900, 0.1, 'triangle', 0.18), 70);
        break;
      case 'shoot':
        this.noise(now, 0.05, 2400, 0.22);
        this.blip(300, 120, 0.04, 'square', 0.1);
        break;
      case 'heroShot':
        this.noise(now, 0.04, 3200, 0.15);
        break;
      case 'cannon':
        this.blip(140, 55, 0.3, 'sine', 0.55);
        this.noise(now, 0.2, 700, 0.3, 'lowpass');
        break;
      case 'lightning': {
        this.blip(2400, 200, 0.28, 'sawtooth', 0.3);
        this.noise(now, 0.25, 3600, 0.4);
        this.noise(now + 0.05, 0.3, 900, 0.3, 'lowpass');
        break;
      }
      case 'freeze':
        this.blip(1800, 2600, 0.35, 'sine', 0.14);
        this.blip(2400, 3200, 0.3, 'sine', 0.1);
        break;
      case 'deepFreeze': {
        // فاز ۶ — انجماد ابدی غول یخ: فرود عمیق + درخشش بلوری
        this.blip(320, 70, 0.7, 'sine', 0.4);
        this.blip(1200, 2400, 0.5, 'sine', 0.12);
        this.noise(now, 0.6, 5200, 0.12, 'highpass');
        setTimeout(() => this.blip(2000, 3400, 0.35, 'sine', 0.08), 180);
        break;
      }
      case 'explosion':
        this.noise(now, 0.5, 500, 0.7, 'lowpass');
        this.blip(90, 35, 0.5, 'sine', 0.7);
        break;
      case 'magic':
        this.blip(220, 1400, 0.45, 'sine', 0.25);
        this.noise(now + 0.1, 0.4, 2400, 0.15);
        break;
      case 'death':
        this.blip(400, 90, 0.16, 'triangle', 0.2);
        break;
      case 'bossRoar':
        this.blip(70, 40, 1.1, 'sawtooth', 0.6);
        this.noise(now, 0.8, 250, 0.4, 'lowpass');
        break;
      case 'victory': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((n, i) => setTimeout(() => this.blip(n, n, 0.4, 'triangle', 0.3), i * 160));
        break;
      }
      case 'defeat': {
        const notes = [392, 330, 262, 196];
        notes.forEach((n, i) => setTimeout(() => this.blip(n, n * 0.9, 0.5, 'sawtooth', 0.2), i * 220));
        break;
      }
      case 'reward':
        this.blip(900, 1400, 0.1, 'triangle', 0.2);
        setTimeout(() => this.blip(1400, 1900, 0.15, 'triangle', 0.2), 90);
        break;
      case 'error':
        this.blip(200, 140, 0.15, 'square', 0.2);
        break;
      case 'waveStart':
        this.blip(330, 440, 0.2, 'square', 0.15);
        setTimeout(() => this.blip(440, 660, 0.25, 'square', 0.15), 140);
        break;
      case 'hit': {
        // بخش ۱۵ — تیک اصابت بسیار کوتاه و آرام + محدودسازی نرخ (بدون آزار)
        if (now - this.lastHitSfx < 0.11) break;
        this.lastHitSfx = now;
        this.noise(now, 0.03, 3200, 0.07, 'highpass');
        break;
      }
      case 'bossPhase': {
        // بخش ۱۵ — شیپور ورود فاز دوم Boss (دو نت پایین‌رونده)
        this.blip(160, 110, 0.35, 'sawtooth', 0.4);
        setTimeout(() => this.blip(110, 70, 0.5, 'sawtooth', 0.45), 320);
        this.noise(now, 0.7, 300, 0.25, 'lowpass');
        break;
      }
    }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

// فاز ۶ — نمونه مشترک صدا بین همه نبردها (موسیقی پیوسته منو ↔ نبرد ↔ نقشه)
// AudioContext دیگر per-battle ساخته/بسته نمی‌شود (صرفه‌جویی منابع موبایل — بخش ۳۳)
export const audioSystem = new AudioSystem();
