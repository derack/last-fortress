"""hf_squeeze.py — تست فشردن یک shape زیر باقیمانده سهمیه با پارامترهای سبک"""
import sys, time
from gradio_client import Client, handle_file

cid = sys.argv[1] if len(sys.argv) > 1 else 'spider'
steps = int(sys.argv[2]) if len(sys.argv) > 2 else 20
octree = int(sys.argv[3]) if len(sys.argv) > 3 else 192
chunks = int(sys.argv[4]) if len(sys.argv) > 4 else 2000
space = sys.argv[5] if len(sys.argv) > 5 else 'tencent/Hunyuan3D-2'

c = Client(space, verbose=False)
t0 = time.time()
try:
    if space == 'tencent/Hunyuan3D-2':
        c.predict(caption=None, image=handle_file(f'scripts/concepts/{cid}.png'),
                  mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None,
                  steps=steps, guidance_scale=5.0, seed=1234, octree_resolution=octree,
                  check_box_rembg=True, num_chunks=chunks, randomize_seed=False,
                  api_name='/shape_generation')
    else:
        print(f'[unknown-space-api] {space}')
        sys.exit(2)
    print(f'[OK] {cid} wall={time.time()-t0:.0f}s steps={steps} octree={octree}', flush=True)
except Exception as e:
    print(f'[FAIL] {cid}: {str(e)[:220]}', flush=True)
