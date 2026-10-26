"""hf_generate.py — تولید مدل سه‌بعدی هر کاراکتر با Hunyuan3D-2 روی Hugging Face Spaces.

Pipeline (per character):
  1. /generation_all(image=concept)  -> (glb_raw, glb_textured?, html, stats, seed)
  2. /on_export_click(file1, file2, glb, reduce_face=True, export_texture=True, target_face_num)
     -> (html, download_path)   <- GLB نهایی decimate شده سمت سرور

Usage:
  python3 scripts/hf_generate.py arman aria ...     # فقط این‌ها
  python3 scripts/hf_generate.py --all              # همه‌ی conceptهای موجود
"""
import os, sys, time, shutil, traceback

from gradio_client import Client

SPACE = 'tencent/Hunyuan3D-2'
CONCEPT_DIR = 'scripts/concepts'
RAW_DIR = 'scripts/hf_raw'
FINAL_DIR = 'scripts/hf_final'
TARGET_FACES = 25000

PRIORITY = [
    'arman', 'aria', 'radin', 'nila',                     # heroes
    'darkLord', 'golemKing', 'fireGiant', 'iceGiant', 'blackDragon',  # bosses
    'shadow', 'warrior', 'golem', 'spider', 'warlock',    # common enemies
    'flyer', 'warMachine', 'aetherTank', 'smallDragon',
    'crystalMonster', 'hunter', 'destroyer', 'summoner',
    'spirit', 'shadowSoldier', 'annihilator',
]

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(FINAL_DIR, exist_ok=True)

if '--all' in sys.argv:
    ids = [i for i in PRIORITY if os.path.exists(f'{CONCEPT_DIR}/{i}.png')]
else:
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]

print(f'[hf] targets: {ids}')
client = Client(SPACE, verbose=False)

results = []
for cid in ids:
    img = f'{CONCEPT_DIR}/{cid}.png'
    final = f'{FINAL_DIR}/{cid}.glb'
    if not os.path.exists(img):
        print(f'[skip] no concept for {cid}')
        continue
    if os.path.exists(final) and os.path.getsize(final) > 200_000:
        print(f'[skip] already done {cid}')
        continue
    t0 = time.time()
    try:
        print(f'[gen ] {cid} ...', flush=True)
        r = client.predict(
            caption=None,
            image=img,
            mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None,
            steps=30, guidance_scale=5.0, seed=1234, octree_resolution=256,
            check_box_rembg=True, num_chunks=8000, randomize_seed=False,
            api_name='/generation_all',
        )
        f1, f2 = r[0], r[1]
        print(f'   raw: {os.path.basename(f1)} ({os.path.getsize(f1)//1024}KB) + {os.path.basename(f2)} ({os.path.getsize(f2)//1024}KB)  t={time.time()-t0:.0f}s', flush=True)

        t1 = time.time()
        exp = client.predict(
            f1, f2, 'glb', True, True, TARGET_FACES,
            api_name='/on_export_click',
        )
        download_path = exp[1]
        shutil.copy(download_path, final)
        dt = time.time() - t0
        kb = os.path.getsize(final) // 1024
        print(f'[done] {cid}: {kb}KB total={dt:.0f}s (export {time.time()-t1:.0f}s)', flush=True)
        results.append((cid, 'OK', kb, f'{dt:.0f}s'))
    except Exception as e:
        msg = str(e).replace('\n', ' ')[:220]
        print(f'[FAIL] {cid}: {msg}', flush=True)
        results.append((cid, 'FAIL', msg, ''))
        # خطای سهمیه/اتم GPU => توقف کامل
        low = msg.lower()
        if 'quota' in low or 'gpu' in low or 'exceeded' in low or '401' in low or '503' in low or '429' in low:
            print('[abort] GPU quota/access error — stopping batch.')
            break

print('\n=== RESULTS ===')
for r in results:
    print(*r)
