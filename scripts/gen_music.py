#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
آهنگسازی حماسی ایرانی + افکت‌های صوتی برای «آخرین سنگر» — v2 (Warm Mastering)
تغییرات نسبت به v1 (رفع «تیز و رو مخ بودن»):
  • زنجیره mastering گرم روی همه خروجی‌ها: فیلتر هوای ۱۰٫۵kHz + ریورب کنولوشن + نرم‌کننده پیک (soft-knee)
  • حذف کامل موج مربع (np.sign) از death/bossRoar/waveStart/error → اره فیلترشده/مثلثی گرم
  • نویز خام → نویز باندپس/لوپس (حذف هیس تیز) در shoot/lightning/snare/crash
  • کرکره‌های آسمان (tap/sell/magic/freeze) یک اکتاو گرم‌تر + هارمونیک زنگی
  • پیک موسیقی 0.92→0.80 و SFX 0.95→0.85 (هدروم + بدون کلپ دیجیتال)
Output: /home/z/my-project/public/assets/audio/*.mp3 + manifest.json
"""
import numpy as np, wave, os, subprocess, json, shutil

SR = 44100
OUT = "/home/z/my-project/public/assets/audio"
TMP = "/home/z/my-project/scripts/_audio_tmp"
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

rng = np.random.default_rng(2026)

# ---------------- mastering helpers (v2) ----------------

def fft_lowpass(sig, cutoff):
    S = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(sig.shape[0], 1 / SR)
    S *= 1.0 / (1.0 + (freqs / max(cutoff, 1.0)) ** 4)
    return np.fft.irfft(S, sig.shape[0])

def fft_highpass(sig, cutoff):
    S = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(sig.shape[0], 1 / SR)
    S *= 1.0 - 1.0 / (1.0 + (freqs / max(cutoff, 1.0)) ** 4)
    return np.fft.irfft(S, sig.shape[0])

def make_ir(dur=1.15):
    """ایمپالس ریورب سینتتیک: نویز میرا + پیش‌تأخیر ۱۲ms + damping"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = rng.uniform(-1, 1, n) * np.exp(-t * 4.2)
    ir = fft_lowpass(ir, 5200)
    pre = int(0.012 * SR)
    out = np.zeros(n + pre)
    out[pre:] = ir
    return out / np.abs(out).max()

REV_IR = make_ir()

def oadd_convolve(sig, ir):
    """کنولوشن overlap-add FFT — حافظه‌امن برای سیگنال‌های بلند (موسیقی ۲:۳۶)"""
    n = sig.shape[0] + ir.shape[0] - 1
    block = 1 << 16
    fftn = 1 << int(np.ceil(np.log2(block + ir.shape[0] - 1)))
    H = np.fft.rfft(ir, fftn)
    out = np.zeros(n)
    for i in range(0, sig.shape[0], block):
        chunk = sig[i:i + block]
        y = np.fft.irfft(np.fft.rfft(chunk, fftn) * H, fftn)
        end = min(i + y.shape[0], n)
        out[i:end] += y[:end - i]
    return out

def soft_knee(sig, thresh=0.72):
    """پیک‌های بالای آستانه را گرد می‌کند — حذف کلپ دیجیتالِ تیز"""
    a = np.abs(sig)
    return np.where(a <= thresh, sig,
                    np.sign(sig) * (thresh + (1 - thresh) * np.tanh((a - thresh) / (1 - thresh))))

def save_mp3(name, sig, stereo=False, kbps=160):
    sig = np.clip(sig, -1.0, 1.0)
    wpath = os.path.join(TMP, name + ".wav")
    mpath = os.path.join(OUT, name + ".mp3")
    with wave.open(wpath, "wb") as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        if stereo:
            inter = np.empty(sig.shape[0] * 2, dtype=np.int16)
            inter[0::2] = (sig[:, 0] * 32767).astype(np.int16)
            inter[1::2] = (sig[:, 1] * 32767).astype(np.int16)
            w.writeframes(inter.tobytes())
        else:
            w.writeframes((sig * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wpath,
                    "-codec:a", "libmp3lame", "-b:a", f"{kbps}k", mpath], check=True)
    os.remove(wpath)
    print(f"  {name}.mp3  {os.path.getsize(mpath)//1024} KB")

def env_ad(n, a, d, curve=3.0):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    nd = max(1, int(d * SR))
    e[-nd:] *= np.linspace(1, 0, nd) ** curve
    return e

def tone(freq, n, kind="saw", detune=0.0, vib=0.0, vibhz=5.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    ph = 2 * np.pi * f * t
    if vib > 0:
        ph += vib * np.sin(2 * np.pi * vibhz * t) * f / vibhz * 0.01
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == "saw":
        return 2 * ((f * t + 0.5) % 1.0) - 1.0
    if kind == "square":
        return np.sign(np.sin(ph))
    raise ValueError(kind)

NOTE = {}
names = ["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"]
for octv in range(1, 7):
    for i, nm in enumerate(names):
        NOTE[f"{nm}{octv}"] = 440.0 * 2 ** ((i - 9) / 12 + (octv - 4))

# ============================================================
# PART 1 — MUSIC (2:36, stereo, epic Persian D-minor/Phrygian)
# ============================================================
BPM = 100
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BARS = 65
N = int(BARS * BAR * SR)
musicL = np.zeros(N); musicR = np.zeros(N)

def put(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    seg = sig[:N - i0]
    gl = gain * min(1.0, 1.0 - pan) ** 0.5
    gr = gain * min(1.0, 1.0 + pan) ** 0.5
    musicL[i0:i0 + seg.shape[0]] += seg * gl
    musicR[i0:i0 + seg.shape[0]] += seg * gr

PROG = [["D3","F3","A3"], ["As2","D3","F3"], ["F3","A3","C4"], ["C3","E3","G3"]]
def chord_tones(ch): return [NOTE[x] for x in ch]

def strings(chord, dur, gain=0.16, bright=900):
    """زوزهٔ زهی‌ها — v2: برش روشنایی کمتر + نرمی حمله بیشتر (بدون بوز اره خام)"""
    n = int(dur * SR)
    s = np.zeros(n)
    for f in chord_tones(chord):
        for dt in (-0.004, 0.0, 0.005):
            s += tone(f, n, "saw", detune=dt) / 9
    s = fft_lowpass(s, bright)
    e = np.ones(n)
    na = int(0.35 * SR); e[:na] = np.linspace(0, 1, na) ** 1.8
    nd = int(0.45 * SR); e[-nd:] *= np.linspace(1, 0, nd)
    return s * e * gain

def drone(dur, gain=0.22):
    n = int(dur * SR)
    s = tone(NOTE["D2"], n, "sine") + 0.5 * tone(NOTE["D2"], n, "saw", detune=0.002) + 0.4 * tone(NOTE["A2"], n, "sine")
    s = fft_lowpass(s, 220)
    e = np.ones(n); na = int(1.2*SR); e[:na] = np.linspace(0,1,na); nd = int(1.2*SR); e[-nd:] *= np.linspace(1,0,nd)
    return s * e * gain

def lead(freq, dur, gain=0.2, kind="tri"):
    """v2: سهم اره 0.35→0.18 و برش 2600→2000 — ملودی لطیف‌تر"""
    n = int(dur * SR)
    s = tone(freq, n, kind, vib=0.9, vibhz=5.5) + 0.18 * tone(freq, n, "saw", vib=0.9, vibhz=5.5)
    s = fft_lowpass(s, 2000)
    e = env_ad(n, 0.06, dur * 0.35, 2.0)
    return s * e * gain

def bell(freq, dur, gain=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2*np.pi*freq*t) + 0.5*np.sin(2*np.pi*freq*2.01*t) + 0.25*np.sin(2*np.pi*freq*2.99*t)
    e = np.exp(-3.5 * t)
    return s * e * gain

def kick(gain=0.9):
    n = int(0.28 * SR); t = np.arange(n) / SR
    f = 130 * np.exp(-t * 16) + 42
    s = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 9)
    return s * gain

def snare(gain=0.5):
    """v2: به‌جای های‌پس ۹۰۰ (هیس تیز) → بدنه نویزی لوپس ۶٫۵k + تُن ۱۸۵Hz — تق تق گرم"""
    n = int(0.16 * SR); t = np.arange(n) / SR
    s = fft_lowpass(rng.uniform(-1, 1, n), 6500) * np.exp(-t * 26)
    s += 0.45 * np.sin(2*np.pi*185*t) * np.exp(-t * 30)
    return fft_highpass(s, 350) * gain * 0.78

def daf(gain=0.42, bright=3000):
    n = int(0.12 * SR); t = np.arange(n) / SR
    s = rng.uniform(-1,1,n)*np.exp(-t*55) + 0.6*np.sin(2*np.pi*210*t)*np.exp(-t*40) + 0.3*np.sin(2*np.pi*95*t)*np.exp(-t*28)
    return fft_lowpass(s, bright) * gain

def crash(gain=0.25):
    """v2: کرش نرم‌شده — لوپس ۹k و کم‌حجم‌تر (بدون سسسس تیز)"""
    n = int(1.6 * SR); t = np.arange(n) / SR
    s = rng.uniform(-1,1,n)
    s = fft_lowpass(s, 9000) * np.exp(-t * 3.2)
    return s * gain * 0.72

def add_perc_bar(bar_i, t_bar, style):
    st = BEAT / 4
    if style >= 1:
        for stp in (0, 8):
            put(kick(0.85 if stp == 0 else 0.65), t_bar + stp*st, 1, 0)
        for stp in (4, 12):
            put(snare(0.4), t_bar + stp*st, 1, 0.05)
    if style == 2:
        pat = [1,0,0.4,0.7, 0,0.4,1,0, 0.4,0.7,0,0.4, 1,0,0.7,0.4]
        for stp, v in enumerate(pat):
            if v: put(daf(0.4*v), t_bar + stp*st, 1, -0.25)
        for stp in (10,):
            put(daf(0.3), t_bar + stp*st, 1, 0.3)

PHRASE_A = [
    (0,0,1.5,"D4"),(0,1.5,0.5,"Eb4"),(0,2,2,"D4"),(0,3.5,0.5,"A3"),
    (1,0,2,"F4"),(1,2,1,"E4"),(1,3,1,"D4"),
    (2,0,1.5,"C4"),(2,1.5,0.5,"D4"),(2,2,2,"F4"),(2,3.5,0.5,"E4"),
    (3,0,3,"D4"),(3,3,1,"A3"),
    (4,0,1.5,"A3"),(4,1.5,0.5,"As3"),(4,2,2,"A3"),(4,3.5,0.5,"F4"),
    (5,0,2,"E4"),(5,2,1,"F4"),(5,3,1,"E4"),
    (6,0,1.5,"D4"),(6,1.5,0.5,"E4"),(6,2,1.5,"F4"),(6,3,1,"G4"),
    (7,0,4,"A4"),
]
PHRASE_B = [
    (0,0,1.5,"A4"),(0,1.5,0.5,"Bb4"),(0,2,2,"A4"),(0,3.5,0.5,"G4"),
    (1,0,2,"F4"),(1,2,2,"E4"),
    (2,0,1.5,"F4"),(2,1.5,0.5,"E4"),(2,2,2,"D4"),(2,3.5,0.5,"C4"),
    (3,0,4,"D4"),
]

def apply_phrase(ph, t_start, gain, pan=0.0, oct_shift=0):
    FLAT = {"Db":"Cs","Eb":"Ds","Gb":"Fs","Ab":"Gs","Bb":"As"}
    for baroff, beat, dur, note in ph:
        nm = note
        base, octv = nm[:-1], nm[-1]
        base = FLAT.get(base, base)
        if oct_shift:
            octv = str(int(octv) + oct_shift)
        nm = base + octv
        t0 = t_start + baroff*BAR + beat*BEAT
        put(lead(NOTE[nm], dur*BEAT*0.95, gain), t0, 1, pan)

print("composing music ...")
t = 0.0
for bar in range(BARS):
    tb = bar * BAR
    ci = bar % 4
    if bar < 8:
        put(drone(BAR*1.05, 0.2), tb)
        put(strings(PROG[ci], BAR*1.05, 0.10, 620), tb, 1, 0.15)
        if bar in (0,4): put(bell(NOTE["D5"], 2.0, 0.10), tb, 1, -0.2)
        if bar == 7: put(crash(0.16), tb)
    elif bar < 24:
        put(strings(PROG[ci], BAR*1.05, 0.15, 820), tb)
        put(drone(BAR*1.05, 0.18), tb)
        add_perc_bar(bar, tb, 1)
        if bar == 8: put(crash(0.3), tb)
    elif bar < 40:
        put(strings(PROG[ci], BAR*1.05, 0.17, 1050), tb)
        put(drone(BAR*1.05, 0.2), tb)
        add_perc_bar(bar, tb, 2)
        if bar % 8 == 0: put(crash(0.28), tb)
        if bar in (24, 32):
            apply_phrase(PHRASE_B if bar==32 else PHRASE_A, tb, 0.20, 0.1)
    elif bar < 56:
        put(strings(PROG[ci], BAR*1.05, 0.16, 1250), tb)
        put(drone(BAR*1.05, 0.2), tb)
        add_perc_bar(bar, tb, 2)
        if bar == 40:
            put(crash(0.32), tb)
            apply_phrase(PHRASE_A, tb, 0.23, -0.1, oct_shift=1)
        if bar == 48:
            put(crash(0.26), tb)
            apply_phrase(PHRASE_B, tb, 0.22, 0.15, oct_shift=1)
    else:
        put(drone(BAR*1.4, 0.22), tb)
        put(strings(PROG[ci] if bar < 64 else ["D3","A3"], BAR*1.4, 0.12, 700), tb, 1, 0.1)
        if bar == 56: put(crash(0.2), tb)
        if bar % 2 == 0: put(bell(NOTE["D5"], 2.4, 0.1), tb, 1, 0.2)

# v2 — زنجیره mastering گرم موسیقی: فیلتر هوا → ریورب → عرض استریو → نرم‌کننده پیک
print("warm mastering music ...")
musicL = fft_lowpass(musicL, 10500)
musicR = fft_lowpass(musicR, 10500)
musicL += oadd_convolve(musicL, REV_IR)[:N] * 0.15
musicR += oadd_convolve(musicR, REV_IR)[:N] * 0.15
d = int(0.00045 * SR)
musicR_full = np.copy(musicR)
musicR[d:] += musicL[:-d] * 0.18
musicL[d:] += musicR_full[:-d] * 0.18
music = np.stack([musicL, musicR], axis=1)
peak = max(np.abs(music[:,0]).max(), np.abs(music[:,1]).max())
music = soft_knee(music / peak * 0.80, 0.72)  # اول مقیاس، بعد فقط پیک‌های سرگردان گرد شوند (حفظ دینامیک)
save_mp3("music", music, stereo=True, kbps=176)

# ============================================================
# PART 2 — SFX (21 effects) — v2 گرم و جذاب
# ============================================================
print("synthesizing sfx ...")

def sfx_base(n): return np.zeros(n)

def add_at(sig, seg, i0):
    i0 = max(0, int(i0))
    if i0 >= sig.shape[0]: return
    nn = min(seg.shape[0], sig.shape[0] - i0)
    sig[i0:i0+nn] += seg[:nn]

def render(name, sig, kbps=128, vol=0.85, wet=0.14):
    """v2.1 — زنجیره گرم SFX: فیلتر هوا → ریورب → نرمالایز به پیک هدف (vol) → نرم‌سازی ایمنی
    vol = پیک خروجی هر افکت (بلندی نسبی طراحی‌شده)؛ دینامیک داخلی حفظ می‌شود"""
    sig = np.asarray(sig, dtype=np.float64)
    sig = fft_lowpass(sig, 10500)
    if wet > 0:
        sig = sig + oadd_convolve(sig, REV_IR)[:sig.shape[0]] * wet
    m = np.abs(sig).max()
    if m > 1e-9:
        sig = sig / m
    sig = soft_knee(sig * vol, 0.88)  # پیک هدف + فقط محافظ سقف
    save_mp3(name, sig, kbps=kbps)

def bell_note(freq, dur):
    """زنگ گرم با هارمونیک‌های غیرهارمونیک ملایم (جای سین خام)"""
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2*np.pi*freq*t) + 0.35*np.sin(2*np.pi*freq*2.01*t) + 0.15*np.sin(2*np.pi*freq*2.99*t)

# tap — v2: تیک چوبی گرم (جای کلیک ۱۶۰۰/۲۴۰۰Hz تیز) + بدون ریورب (UI فوری)
n = int(0.07*SR); t = np.arange(n)/SR
render("tap", np.sin(2*np.pi*820*t)*np.exp(-t*70) + 0.25*np.sin(2*np.pi*1480*t)*np.exp(-t*110), vol=0.55, wet=0.05)

# place — v2: تق زمین‌گذاری با بدنه بم نرم‌تر
n = int(0.3*SR); t = np.arange(n)/SR
f = 180*np.exp(-t*20)+55
render("place", (np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*14) + 0.18*fft_lowpass(rng.uniform(-1,1,n), 2500)*np.exp(-t*60)), vol=0.7)

# upgrade — v2: زنگ صعودی گرم (هارمونیک زنگی به‌جای سین خام)
sig = sfx_base(int(0.75*SR))
for i, nm in enumerate(["D5","F5","A5","D6"]):
    nn = int(0.4*SR); tt = np.arange(nn)/SR
    add_at(sig, bell_note(NOTE[nm], 0.4)*np.exp(-tt*7)*0.45, i*0.12*SR)
render("upgrade", sig, vol=0.72, wet=0.12)

# sell — v2: جینگل سکه نرم‌شده (کم‌کیفیت‌ترین حالت: سین خالی بود)
sig = sfx_base(int(0.5*SR))
for i, nm in enumerate(["A5","E5","A4"]):
    nn = int(0.3*SR); tt = np.arange(nn)/SR
    add_at(sig, bell_note(NOTE[nm], 0.3)*np.exp(-tt*16)*0.5, i*0.09*SR)
render("sell", sig, vol=0.68, wet=0.1)

# shoot — v2: نویز باندپس گرم (جای های‌پس هیس‌دار) + افت پیچ
n = int(0.18*SR); t = np.arange(n)/SR
f = 900*np.exp(-t*30)+180
shot_noise = fft_lowpass(fft_highpass(rng.uniform(-1,1,n), 350), 3800)
render("shoot", shot_noise*np.exp(-t*28)*0.55 + 0.5*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*24), vol=0.72)

# cannon — بم و آرام (خودش گرم است)
n = int(0.6*SR); t = np.arange(n)/SR
f = 110*np.exp(-t*11)+38
render("cannon", fft_lowpass(np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*7) + 0.35*rng.uniform(-1,1,n)*np.exp(-t*16), 600), kbps=144, vol=0.82)

# lightning — v2: بدنه گرم رعد + کرک نرم لوپس‌شده (جای هیس های‌پس ۱۲۰۰)
n = int(0.5*SR); t = np.arange(n)/SR
body = fft_lowpass(rng.uniform(-1,1,n), 850)*np.exp(-t*8)*1.15
crack = fft_lowpass(rng.uniform(-1,1,n)*np.exp(-t*38), 5200)*0.6
render("lightning", body + crack, kbps=144, vol=0.78)

# freeze — v2: درخشش یخی یک‌سوم گرم‌تر
n = int(0.8*SR); t = np.arange(n)/SR
s = np.zeros(n)
for fm in (1300, 1733, 2167, 2600):
    s += np.sin(2*np.pi*np.cumsum(fm*np.exp(-t*1.2))/SR)/4
render("freeze", s*np.exp(-t*4.5), vol=0.72)

# explosion — بم، فقط کمی نرم‌تر
n = int(1.1*SR); t = np.arange(n)/SR
s = rng.uniform(-1,1,n)*np.exp(-t*4.2)
s = fft_lowpass(s, 1200) + 0.5*np.sin(2*np.pi*np.cumsum(90*np.exp(-t*6)+30)/SR)*np.exp(-t*3)
render("explosion", s, kbps=144, vol=0.8)

# magic — v2: جادوی زنگی گرم‌تر (باند پایین‌تر + هارمونیک)
sig = sfx_base(int(0.65*SR))
for i, fm in enumerate([660, 990, 1320, 1976, 2637]):
    nn = int(0.35*SR); tt = np.arange(nn)/SR
    add_at(sig, bell_note(fm, 0.35)*np.exp(-tt*9)*0.4, i*0.07*SR)
render("magic", sig, vol=0.7, wet=0.12)

# death — v2: غرش میرا مثلثی گرم (جای موج مربع بوزدار)
n = int(0.7*SR); t = np.arange(n)/SR
f = 320*np.exp(-t*2.2)+60
growl = fft_lowpass(tone(f[0], n, "tri"), 750) * 0.55
# پیچ افت‌کننده: مثلث با فاز تجمعی دستی
ph = 2*np.pi*np.cumsum(f)/SR
growl = (2/np.pi*np.arcsin(np.sin(ph)))*0.45 + np.sin(ph*0.5)*0.55
render("death", fft_lowpass(growl, 900)*np.exp(-t*3.5), vol=0.72)

# bossRoar — v2: غرش اره فیلترشده + ساب‌سینوس (جای موج مربع)
n = int(1.3*SR); t = np.arange(n)/SR
f = 82*np.exp(-t*0.7)+38
ph = 2*np.pi*np.cumsum(f*(1+0.06*np.sin(2*np.pi*11*t)))/SR
s = (2/np.pi*np.arcsin(np.sin(ph)))*0.6
s = fft_lowpass(s, 950)
s += 0.5*np.sin(2*np.pi*np.cumsum(f*0.5)/SR)
s += 0.35*fft_lowpass(rng.uniform(-1,1,n), 480)*np.exp(-t*2)
render("bossRoar", s*np.exp(-t*1.8), kbps=144, vol=0.78)

# victory — v2: فانفار برنجی گرم (اره لوپس + ساب، جای سین لاغر)
sig = sfx_base(int(1.5*SR))
for (nm, dt0, dd) in [("F4",0,0.28),("A4",0.18,0.28),("C5",0.36,0.28),("F5",0.54,0.9)]:
    nn = int(dd*SR); tt = np.arange(nn)/SR
    fq = NOTE[nm]
    brass = np.sin(2*np.pi*fq*tt) + 0.55*fft_lowpass(tone(fq, nn, "saw"), 1900) + 0.22*np.sin(2*np.pi*fq*2*tt)
    add_at(sig, brass*np.exp(-tt*(2.5 if dd<0.5 else 1.2))*0.4, dt0*SR)
render("victory", sig, kbps=160, vol=0.78, wet=0.16)

# defeat — v2: نزول مینور نرم (ساب بم ملایم)
sig = sfx_base(int(1.6*SR))
for (nm, dt0) in [("D4",0),("C4",0.35),("As3",0.7),("A3",1.05)]:
    nn = int(0.5*SR); tt = np.arange(nn)/SR
    s = np.sin(2*np.pi*NOTE[nm]*tt) + 0.3*np.sin(2*np.pi*NOTE[nm]*0.5*tt)
    add_at(sig, s*np.exp(-tt*3.5)*0.42, dt0*SR)
render("defeat", sig, kbps=160, vol=0.78, wet=0.16)

# reward — v2: چایم دو نتی گرم
sig = sfx_base(int(0.9*SR))
for i, nm in enumerate(["D5","A5"]):
    nn = int(0.7*SR); tt = np.arange(nn)/SR
    add_at(sig, bell_note(NOTE[nm], 0.7)*np.exp(-tt*3.8)*0.45, i*0.14*SR)
render("reward", sig, vol=0.7, wet=0.14)

# error — v2: دابل تام بم نرم (جای بوز مربعی)
sig = sfx_base(int(0.35*SR))
for dt0 in (0, 0.14):
    nn = int(0.12*SR); tt = np.arange(nn)/SR
    add_at(sig, np.sin(2*np.pi*(190*np.exp(-tt*8)+140)*tt)*np.exp(-tt*22)*0.5, dt0*SR)
render("error", fft_lowpass(sig, 850), vol=0.6)

# waveStart — v2: شیپور گرم (اره لوپس ۱۱۰۰ + پنجم، بدون مربع)
n = int(0.9*SR); t = np.arange(n)/SR
f = NOTE["D3"]
horn = np.sin(2*np.pi*np.cumsum(f*(1+0.01*t))/SR) + 0.55*fft_lowpass(tone(f*1.002, n, "saw"), 1100) + 0.35*np.sin(2*np.pi*f*1.5*t)
e = np.minimum(t/0.35, 1) * np.exp(-np.maximum(t-0.55,0)*4)
render("waveStart", fft_lowpass(horn*e, 1500)*0.55, vol=0.75, wet=0.15)

# heroShot — v2: سوت نرم + پینگ پایین‌تر (۱۵۰۰→۱۱۰۰)
n = int(0.32*SR); t = np.arange(n)/SR
w = fft_lowpass(rng.uniform(-1,1,n), 2500)*np.exp(-((t-0.08)**2)/0.0016)*0.75
p = np.sin(2*np.pi*np.cumsum(1100*np.exp(-t*9)+450)/SR)*np.exp(-t*13)*0.45
render("heroShot", w + p, vol=0.72)

# hit — اصابت کوتاه و آرام (خودش نرم است)
n = int(0.14*SR); t = np.arange(n)/SR
f = 260*np.exp(-t*30)+70
render("hit", fft_lowpass(np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*22) + 0.35*fft_lowpass(rng.uniform(-1,1,n), 3500)*np.exp(-t*45), 1800), vol=0.7)

# bossPhase — v2: ضربه شوم + ریسر گرم لوپس
n = int(1.2*SR); t = np.arange(n)/SR
s = np.sin(2*np.pi*np.cumsum(70*np.exp(-t*4)+32)/SR)*np.exp(-t*3.2)*0.85
r = fft_lowpass(rng.uniform(-1,1,n), 1400)*np.minimum(t/0.6,1)**2*np.exp(-np.maximum(t-0.95,0)*10)*0.4
render("bossPhase", s + r, kbps=144, vol=0.78)

# deepFreeze — v2: براق یخی گرم‌تر (یک‌سوم پایین‌تر)
n = int(1.4*SR); t = np.arange(n)/SR
s = np.zeros(n)
for i, fm in enumerate([1173, 1564, 1955, 2346, 3126]):
    s += np.sin(2*np.pi*np.cumsum(fm*(1+0.12*np.sin(2*np.pi*(0.7+i*0.23)*t)))/SR)/5
render("deepFreeze", s*np.minimum(t/0.15,1)*np.exp(-t*2.6), vol=0.75)

# ============================================================
# PART 3 — manifest
# ============================================================
SFX = ["tap","place","upgrade","sell","shoot","cannon","lightning","freeze",
       "explosion","magic","death","bossRoar","victory","defeat","reward",
       "error","waveStart","heroShot","hit","bossPhase","deepFreeze"]
manifest = {"music": "/assets/audio/music.mp3", "sfx": {k: f"/assets/audio/{k}.mp3" for k in SFX}}
with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
shutil.rmtree(TMP, ignore_errors=True)
total = sum(os.path.getsize(os.path.join(OUT,x)) for x in os.listdir(OUT))
print(f"DONE — {len(os.listdir(OUT))} files, total {total/1e6:.2f} MB")
