"""hf_probe.py — پروب سریع چند اسپیس 3D برای یافتن یکی زنده با GPU آزاد"""
import sys, time
from gradio_client import Client

SPACES = [
    ('tencent/Hunyuan3D-2', 'tencent/Hunyuan3D-2'),
    ('tencent/Hunyuan3D-2mv', 'tencent/Hunyuan3D-2mv'),
    ('tencent/Hunyuan3D-2.1', 'tencent/Hunyuan3D-2.1'),
    ('mytreillis/TRELLIS', 'TRELLIS community'),
    ('JeffreyXiang/TRELLIS', 'TRELLIS official'),
    ('microsoft/TRELLIS', 'TRELLIS microsoft'),
    ('JunhaoZhuang/TRELLIS-Codec', 'TRELLIS-Codec'),
    ('VAST-AI/TripoSG', 'TripoSG'),
    ('zxhezexin/OpenLRM', 'OpenLRM'),
    ('Stable-X/StablePointAware3D', 'SF3D'),
]

for sid, label in SPACES:
    try:
        t0 = time.time()
        c = Client(sid, verbose=False)
        # فچ کانفیگ = اسپیس زنده است
        views = [v.get('api_name') for v in c.view_api(return_format='dict').get('named_endpoints', {})] \
            if hasattr(c, 'view_api') else []
        print(f'[ALIVE] {sid} ({label}) config OK in {time.time()-t0:.1f}s', flush=True)
    except Exception as e:
        msg = str(e).replace('\n', ' ')[:110]
        print(f'[DEAD] {sid} ({label}): {msg}', flush=True)
