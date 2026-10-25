#!/usr/bin/env python3
"""Batch-generate textured GLBs via stabilityai/stable-fast-3d with retries.

Usage: python3 sf3d_batch.py id1 id2 ...
Reads concepts/<id>.png (RGBA), writes raw/<id>.glb + raw/<id>.json
"""
import json, os, shutil, sys, time

from gradio_client import Client, handle_file

BASE = "/home/z/my-project/scripts/hf3d"
RAW = os.path.join(BASE, "raw")
os.makedirs(RAW, exist_ok=True)

SPACE = "stabilityai/stable-fast-3d"


def with_retry(fn, tries=4, wait=15):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa
            last = e
            msg = str(e).replace("\n", " ")[:160]
            print(f"    retry {i+1}: {msg}", flush=True)
            if "quota" in msg.lower():
                raise
            time.sleep(wait)
    raise last


def gen(client, mid):
    dest = os.path.join(RAW, f"{mid}.glb")
    meta = os.path.join(RAW, f"{mid}.json")
    if os.path.isfile(dest) and os.path.isfile(meta):
        print(f"  skip {mid} (done)")
        return True
    img = os.path.join(BASE, "concepts", f"{mid}.png")
    if not os.path.isfile(img):
        print(f"  NO IMAGE {mid}")
        return False

    r1 = with_retry(lambda: client.predict(
        image=handle_file(img), fr=0.85, api_name="/requires_bg_remove"))
    t0 = time.time()
    r2 = with_retry(lambda: client.predict(
        input_image=r1[0], foreground_ratio=0.85, remesh_option="None",
        vertex_count=-1, texture_size=1024, api_name="/run_button"))
    secs = round(time.time() - t0, 1)

    glb = None
    for x in r2:
        if isinstance(x, str) and os.path.isfile(x) and x.endswith(".glb"):
            glb = x
    if not glb:
        raise RuntimeError(f"no glb in outputs: {r2}")
    shutil.copyfile(glb, dest)
    with open(meta, "w") as f:
        json.dump({"id": mid, "space": SPACE, "seconds": secs,
                   "bytes": os.path.getsize(dest)}, f, indent=2)
    print(f"  OK {mid} {os.path.getsize(dest)}B {secs}s", flush=True)
    return True


def main():
    ids = sys.argv[1:]
    client = with_retry(lambda: Client(SPACE, verbose=False, download_files=True), tries=6, wait=20)
    print("connected", flush=True)
    ok = fail = 0
    for mid in ids:
        print(f"[{mid}]", flush=True)
        try:
            if gen(client, mid):
                ok += 1
            else:
                fail += 1
        except Exception as e:
            msg = str(e).replace("\n", " ")[:200]
            print(f"  FAIL {mid}: {msg}", flush=True)
            fail += 1
            if "quota" in msg.lower():
                print("QUOTA_EXHAUSTED — stopping batch", flush=True)
                break
    print(f"batch done ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
