// ============================================================
// سیستم صوتی پروسیجرال — بدون فایل صوتی، با Web Audio API
// شامل SFX (شلیک، انفجار، جادو، UI) + موسیقی حماسی تکرارشونده
// ============================================================

type SfxName =
  | 'tap' | 'place' | 'upgrade' | 'sell' | 'shoot' | 'cannon' | 'lightning'
  | 'freeze' | 'explosion' | 'magic' | 'death' | 'bossRoar' | 'victory'
  | 'defeat' | 'reward' | 'error' | 'waveStart' | 'heroShot';

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
  private musicVol = 0.6;
  private sfxVol = 0.8;

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
    }
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

  // ------------------------- موسیقی -------------------------

  startMusic() {
    this.ensure();
    if (!this.ctx || this.started) return;
    this.started = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduler(), 120);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.started = false;
  }

  private scheduler() {
    if (!this.ctx) return;
    const bpm = this.bossMode ? 132 : 84;
    const stepDur = 60 / bpm / 4; // ۱۶ام
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

    // درام (بم)
    if (s === 0 || s === 8 || (this.bossMode && s === 12)) {
      this.tone(s === 0 ? 55 : 45, when, 0.28, 'sine', this.bossMode ? 0.5 : 0.32, 90, 0.06);
    }
    // هی‌هت نرم
    if (this.bossMode && (s % 4 === 2)) this.noise(when, 0.04, 6000, 0.06, 'highpass');

    // بیس
    if (s === 0 || s === 6 || s === 10) {
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

    // ملودی پنتاتونیک محو (فقط گاهی)
    const melody = [0, 3, 5, 7, 10, 12];
    if (!this.bossMode && s === 4 && Math.random() < 0.6) {
      const n = root * Math.pow(2, melody[Math.floor(Math.random() * melody.length)] / 12);
      this.tone(n, when, 0.5, 'sine', 0.06);
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
    }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
