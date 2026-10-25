#!/usr/bin/env python3
"""Probe candidate HF Spaces for image-to-3D availability."""
import sys, json, traceback

CANDIDATES = [
    "microsoft/TRELLIS",
    "JeffreyXiang/TRELLIS",
    "tencent/Hunyuan3D-2",
    "tencent/Hunyuan3D-2mini",
    "tencent/Hunyuan3D-2mv",
    "tencent/Hunyuan3D-2.1",
    "vast-ai/TripoSR",
    "stabilityai/TripoSR",
]

from gradio_client import Client

results = {}
for space in CANDIDATES:
    try:
        c = Client(space, verbose=False, download_files=False)
        info = c.view_api(return_format="dict")
        # collect named endpoints
        eps = []
        try:
            for k in info.get("named_endpoints", {}).keys():
                eps.append(k)
        except Exception:
            eps = list(info.keys()) if isinstance(info, dict) else ["?"]
        results[space] = {"ok": True, "endpoints": eps[:12]}
        print(f"OK   {space}: {eps[:12]}", flush=True)
    except Exception as e:
        msg = str(e).replace("\n", " ")[:180]
        results[space] = {"ok": False, "error": msg}
        print(f"FAIL {space}: {msg}", flush=True)

with open("/home/z/my-project/scripts/hf3d/probe_results.json", "w") as f:
    json.dump(results, f, indent=2)
print("DONE")
