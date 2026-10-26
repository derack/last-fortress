"""Probe HF Spaces: TRELLIS / Hunyuan3D availability via gradio_client."""
import sys, traceback
from gradio_client import Client

CANDIDATES = [
    "microsoft/TRELLIS",
    "tencent/Hunyuan3D-2",
    "tencent/Hunyuan3D-2mini",
    "tencent/Hunyuan3D-2mv",
    "wendyliu/Hunyuan3D-2mini",  # fallback mirror
]

results = []
for name in CANDIDATES:
    try:
        c = Client(name, verbose=False)
        api = c.view_api(return_format="dict")
        endpoints = list(api.get("named_endpoints", {}).keys())
        results.append((name, "OK", endpoints))
        print(f"[OK] {name}: {endpoints}")
    except Exception as e:
        msg = str(e)[:300]
        results.append((name, "FAIL", msg))
        print(f"[FAIL] {name}: {msg}")

print("\n=== SUMMARY ===")
for r in results:
    print(r[0], "->", r[1])
