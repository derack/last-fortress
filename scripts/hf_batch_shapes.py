"""hf_batch_shapes.py — تولید shape همه کاراکترها تا اتمام سهمیه ZeroGPU"""
import os, shutil, time, glob, sys

from gradio_client import Client, handle_file

CONCEPT_DIR = 'scripts/concepts'
RAW_DIR = 'scripts/hf_raw'
PRIORITY = [
    'darkLord', 'golemKing', 'fireGiant', 'iceGiant', 'blackDragon',  # bosses
    'shadow', 'warrior', 'golem', 'spider', 'warlock',                # enemies
    'flyer', 'warMachine', 'aetherTank', 'smallDragon',
    'crystalMonster', 'hunter', 'destroyer', 'summoner',
    'spirit', 'shadowSoldier', 'annihilator',
]

client = Client('tencent/Hunyuan3D-2', verbose=False)
done = 0
for cid in PRIORITY:
    raw = f'{RAW_DIR}/{cid}_shape.glb'
    if os.path.exists(raw) and os.path.getsize(raw) > 500_000:
        print(f'[skip] {cid}')
        continue
    img = f'{CONCEPT_DIR}/{cid}.png'
    if not os.path.exists(img):
        print(f'[no-concept] {cid}')
        continue
    t0 = time.time()
    try:
        client.predict(
            caption=None, image=handle_file(img),
            mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None,
            steps=30, guidance_scale=5.0, seed=1234, octree_resolution=256,
            check_box_rembg=True, num_chunks=8000, randomize_seed=False,
            api_name='/shape_generation')
        cutoff = time.time() - 240
        local = [p for p in glob.glob('/tmp/gradio/*/*.glb') if os.path.getmtime(p) > cutoff]
        p = max(local, key=os.path.getmtime)
        shutil.copy(p, raw)
        print(f'[OK] {cid} {os.path.getsize(raw)//1024}KB t={time.time()-t0:.0f}s', flush=True)
        done += 1
    except Exception as e:
        msg = str(e).replace('\n', ' ')
        print(f'[FAIL] {cid}: {msg[:200]}', flush=True)
        if 'quota' in msg.lower() or 'gpu' in msg.lower():
            print('[abort] quota finished.')
            break

print(f'\nbatch done: {done} new')
