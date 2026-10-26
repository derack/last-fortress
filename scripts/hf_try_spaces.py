"""hf_try_spaces.py — امتحان اسپیس‌های جایگزین با endpointهای مختلف برای یک shape"""
import sys, time, shutil, glob
from gradio_client import Client, handle_file

cid = sys.argv[1] if len(sys.argv) > 1 else 'warlock'

for space, api, kwargs in [
    ('tencent/Hunyuan3D-2mv', '/shape_generation',
     dict(caption=None, image=None, mv_image_front=None, mv_image_back=None,
          mv_image_left=None, mv_image_right=None, steps=30, guidance_scale=5.0,
          seed=1234, octree_resolution=256, check_box_rembg=True,
          num_chunks=8000, randomize_seed=False)),
    ('tencent/Hunyuan3D-2.1', '/shape_generation',
     dict(caption=None, image=None, resolution=256, num_inference_steps=30,
          guidance_scale=5.0, seed=1234, octree_resolution=256,
          check_box_rembg=True)),
    ('VAST-AI/TripoSG', '/generate',
     dict(image=None, steps=30, guidance_scale=5.0, seed=1234, octree_resolution=256)),
]:
    try:
        c = Client(space, verbose=False)
        names = list(c.view_api(all_endpoints=True).keys()) if hasattr(c, 'view_api') else []
        print(f'{space}: endpoints={names[:8]}', flush=True)
    except Exception as e:
        print(f'{space}: view_api fail: {str(e)[:100]}', flush=True)
