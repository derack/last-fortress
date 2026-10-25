#!/usr/bin/env python3
"""Search HF for RUNNING image-to-3d spaces and report hardware."""
import json, urllib.request, time

def api(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=30))

seen = {}
queries = [
    "https://huggingface.co/api/spaces?pipeline_tag=image-to-3d&sort=likes&limit=100&full=true",
    "https://huggingface.co/api/spaces?search=trellis&sort=likes&limit=50&full=true",
    "https://huggingface.co/api/spaces?search=hunyuan&sort=likes&limit=50&full=true",
    "https://huggingface.co/api/spaces?search=instantmesh&limit=20&full=true",
    "https://huggingface.co/api/spaces?search=unique3d&limit=20&full=true",
    "https://huggingface.co/api/spaces?search=tripo&sort=likes&limit=30&full=true",
]
for q in queries:
    try:
        for s in api(q):
            sid = s.get("id") or s.get("cardData", {}).get("id")
            if not sid or sid in seen:
                continue
            seen[sid] = s
    except Exception as e:
        print("QERR", q[:60], e)

running = []
for sid, s in seen.items():
    rt = s.get("runtime") or {}
    stage = rt.get("stage")
    hw = (rt.get("hardware") or {}).get("current") or "?"
    likes = s.get("likes", 0)
    if stage == "RUNNING":
        running.append((hw, likes, sid))

running.sort(reverse=True)
print(f"total spaces scanned: {len(seen)}  running: {len(running)}")
zero = [r for r in running if "zero" in str(r[0])]
dedi = [r for r in running if "zero" not in str(r[0])]
print("\n== DEDICATED (no quota!) ==")
for hw, likes, sid in dedi[:40]:
    print(f"  {hw:12} L{likes:<5} {sid}")
print("\n== ZERO (quota-limited) top ==")
for hw, likes, sid in zero[:15]:
    print(f"  {hw:12} L{likes:<5} {sid}")
