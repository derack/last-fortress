"""hf_batch_shapes.py — v2: تولید shape همه دشمنان باقی‌مانده، مقاوم به صف ZeroGPU.

صف GPU ناشناس نوسان دارد؛ به‌جای abort در اولین خطا:
  - هر shape تا MAX_TRIES تلاش می‌شود (با مکث بین تلاش‌ها)
  - پس از هر تلاش، shape بعدی امتحان می‌شود (صف ممکن است برای یکی آزاد باشد)
  - کل چرخه تا سقف زمانی TOTAL_MINUTES تکرار می‌شود
"""
import os, shutil, time, glob, sys

from gradio_client import Client, handle_file

CONCEPT_DIR = 'scripts/concepts'
RAW_DIR = 'scripts/hf_raw'
PRIORITY = [
    # v2.7 — ۱۵ دشمن باقی‌مانده (باس‌ها/قهرمانان/shadow در v2.6 نصب شدند؛
    # shape خام آن‌ها در سندباکس ریست‌شده از بین رفته — فقط دشمنان را می‌سازیم)
    'warrior', 'golem', 'spider', 'warlock',                        # early chapters
    'flyer', 'warMachine', 'aetherTank', 'smallDragon',             # mid
    'crystalMonster', 'hunter', 'destroyer', 'summoner',            # mid/late
    'spirit', 'shadowSoldier', 'annihilator',                       # utility/late
]
MAX_TRIES_PER_SHAPE = 60
PAUSE_ON_BUSY = 80          # ثانیه مکث وقتی GPU آزاد نیست
TOTAL_MINUTES = 90          # سقف کل زمان اجرا

# پارامترهای سبک — زمان GPU درخواستی را از ~60s به ~35s می‌رساند تا زیر
# باقیمانده سهمیه ناشناس بخزد (تأیید شده: spider با همین تنظیم ساخته شد)
LIGHT = dict(steps=20, guidance_scale=5.0, seed=1234, octree_resolution=192,
             check_box_rembg=True, num_chunks=2000, randomize_seed=False)

client = Client('tencent/Hunyuan3D-2', verbose=False)
t_start = time.time()
pending = [c for c in PRIORITY
           if not (os.path.exists(f'{RAW_DIR}/{c}_shape.glb')
                   and os.path.getsize(f'{RAW_DIR}/{c}_shape.glb') > 500_000)]
print(f'pending: {len(pending)} -> {pending}', flush=True)

attempt_counts = {c: 0 for c in PRIORITY}
while pending and (time.time() - t_start) < TOTAL_MINUTES * 60:
    cid = pending[0]
    img = f'{CONCEPT_DIR}/{cid}.png'
    if not os.path.exists(img):
        print(f'[no-concept] {cid} — dropped', flush=True)
        pending.pop(0)
        continue
    try:
        t0 = time.time()
        client.predict(
            caption=None, image=handle_file(img),
            mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None,
            **LIGHT, api_name='/shape_generation')
        cutoff = time.time() - 300
        local = [p for p in glob.glob('/tmp/gradio/*/*.glb') if os.path.getmtime(p) > cutoff]
        p = max(local, key=os.path.getmtime)
        shutil.copy(p, f'{RAW_DIR}/{cid}_shape.glb')
        print(f'[OK] {cid} {os.path.getsize(f"{RAW_DIR}/{cid}_shape.glb")//1024}KB '
              f't={time.time()-t0:.0f}s  (remaining={len(pending)-1})', flush=True)
        pending.pop(0)
        attempt_counts[cid] = 0
    except Exception as e:
        msg = str(e).replace('\n', ' ')
        attempt_counts[cid] += 1
        tag = 'GPU-BUSY' if ('GPU' in msg or 'quota' in msg.lower()) else 'ERROR'
        print(f'[{tag}] {cid} try={attempt_counts[cid]}: {msg[:160]}', flush=True)
        if attempt_counts[cid] >= MAX_TRIES_PER_SHAPE:
            print(f'[giveup] {cid} پس از {MAX_TRIES_PER_SHAPE} تلاش — به آخر لیست می‌رود', flush=True)
            pending.pop(0)
            pending.append(cid)
            attempt_counts[cid] = 0
        else:
            time.sleep(PAUSE_ON_BUSY)

print(f'\nbatch done: remaining={len(pending)} elapsed={(time.time()-t_start)/60:.1f}min', flush=True)
