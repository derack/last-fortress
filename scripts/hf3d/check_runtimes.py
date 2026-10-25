#!/usr/bin/env python3
"""Check runtime/hardware of candidate spaces individually (parallel)."""
import json, urllib.request, concurrent.futures as cf

def api(url, t=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=t))

ids = set()
queries = [
    "https://huggingface.co/api/spaces?pipeline_tag=image-to-3d&sort=likes&limit=120",
    "https://huggingface.co/api/spaces?search=trellis&limit=60",
    "https://huggingface.co/api/spaces?search=hunyuan&limit=60",
    "https://huggingface.co/api/spaces?search=3d&sort=likes&limit=100",
    "https://huggingface.co/api/spaces?search=instantmesh&limit=30",
    "https://huggingface.co/api/spaces?search=unique3d&limit=20",
    "https://huggingface.co/api/spaces?search=triposr&limit=20",
    "https://huggingface.co/api/spaces?search=tripo&sort=likes&limit=40",
]
for q in queries:
    try:
        for s in api(q):
            if s.get("id"):
                ids.add(s["id"])
    except Exception:
        pass
print("candidates:", len(ids))

def check(sid):
    try:
        d = api(f"https://huggingface.co/api/spaces/{sid}")
        rt = d.get("runtime") or {}
        stage = rt.get("stage")
        hw = (rt.get("hardware") or {}).get("current") or "-"
        if stage == "RUNNING" and hw not in ("cpu-basic", "cpu-upgrade", "-", None):
            return (hw, d.get("likes", 0), sid, stage)
    except Exception:
        return None
    return None

results = []
with cf.ThreadPoolExecutor(max_workers=12) as ex:
    for r in ex.map(check, sorted(ids)):
        if r:
            results.append(r)

results.sort(key=lambda x: (0 if "zero" not in str(x[0]) else 1, -x[1]))
print("\n== RUNNING GPU spaces ==")
for hw, likes, sid, _ in results:
    tag = "ZERO " if "zero" in str(hw) else "DEDIC"
    print(f"  [{tag}] {hw:14} L{likes:<6} {sid}")
print("done")
