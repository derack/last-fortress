"""hf_mirror_probe.py — یافتن Spaceهای Hunyuan3D/TRELLIS روی سخت‌افزار اختصاصی (سهمیه ZeroGPU ندارند)"""
import json, urllib.request

def api(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def probe(q, limit=60):
    url = f'https://huggingface.co/api/spaces?search={q}&limit={limit}&full=true'
    try:
        return api(url)
    except Exception as e:
        print(f'[{q}] api fail: {e}')
        return []

seen = set()
candidates = []
for q in ['hunyuan3d', 'trellis-3d', 'image-to-3d', 'hunyuan 3d']:
    for s in probe(q):
        rid = s.get('id', '')
        if rid in seen:
            continue
        seen.add(rid)
        runtime = s.get('runtime', {}) or {}
        stage = runtime.get('stage', '')
        hw = ((runtime.get('hardware') or {}).get('current') or '')
        likes = s.get('likes', 0)
        sdk = s.get('sdk', '')
        if stage == 'RUNNING' and 'zero-a10g' not in hw and sdk == 'gradio':
            candidates.append((rid, hw, likes))

candidates.sort(key=lambda x: -x[2])
print('=== RUNNING on dedicated GPU (no ZeroGPU quota) ===')
for rid, hw, likes in candidates[:25]:
    print(f'{rid:55s} hw={hw:12s} likes={likes}')
if not candidates:
    print('(none found — all ZeroGPU/sleeping)')
