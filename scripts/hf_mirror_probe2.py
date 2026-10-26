"""hf_mirror_probe2.py — جستجوی گسترده Spaceهای image-to-3D با سخت‌افزار اختصاصی"""
import json, time, urllib.request, urllib.parse

def api(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (probe)'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

QUERIES = ['hunyuan3d', 'trellis', 'image-to-3d', 'instantmesh', 'unique3d',
           'stable-fast-3d', 'craftsman 3d', 'era3d', 'wonder3d', '3d generation']

ids = set()
for q in QUERIES:
    try:
        url = 'https://huggingface.co/api/spaces?search=' + urllib.parse.quote(q) + '&limit=40'
        for s in api(url):
            sid = s.get('id', '')
            if s.get('sdk') == 'gradio' and s.get('likes', 0) >= 2:
                ids.add(sid)
    except Exception:
        pass
    time.sleep(0.3)

print(f'candidates: {len(ids)}')

good = []
for i, sid in enumerate(sorted(ids, key=lambda x: -0)):
    try:
        d = api(f'https://huggingface.co/api/spaces/{sid}')
        rt = d.get('runtime') or {}
        stage = rt.get('stage', '')
        hw = ((rt.get('hardware') or {}).get('current') or '')
        likes = d.get('likes', 0)
        if stage == 'RUNNING' and hw and 'zero-a10g' not in hw:
            good.append((sid, hw, likes))
            print(f'[HIT ] {sid:58s} hw={hw:10s} likes={likes}')
    except Exception:
        pass
    if i % 25 == 0:
        time.sleep(0.5)

print('\n=== FINAL: dedicated-GPU RUNNING spaces ===')
for g in sorted(good, key=lambda x: -x[2]):
    print(f'{g[0]:58s} {g[1]:12s} likes={g[2]}')
