#!/usr/bin/env python3
"""InstantMesh batch — step-resumable with per-step retries.

Usage: python3 instant_batch2.py id1 id2 ...
Writes raw/<id>.glb (textured) + raw/<id>.json
"""
import json, os, shutil, sys, time

from gradio_client import Client, handle_file

BASE = "/home/z/my-project/scripts/hf3d"
RAW = os.path.join(BASE, "raw")
os.makedirs(RAW, exist_ok=True)
SPACE = "TencentARC/InstantMesh"


def with_retry(fn, tries=4, wait=10, label=""):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa
            last = e
            msg = str(e).replace("\n", " ")[:120]
            print(f"    [{label}] retry {i+1}: {type(e).__name__} {msg}", flush=True)
            if "quota" in msg.lower():
                raise
            time.sleep(wait)
    raise last


def gen(client, mid, seed=1234):
    dest_glb = os.path.join(RAW, f"{mid}.glb")
    meta = os.path.join(RAW, f"{mid}.json")
    if os.path.isfile(dest_glb) and os.path.isfile(meta):
        print(f"  skip {mid} (done)", flush=True)
        return "done"
    img = os.path.join(BASE, "preprocess", f"{mid}.png")
    if not os.path.isfile(img):
        print(f"  NO PREPROCESSED {mid}", flush=True)
        return "noimg"

    p = with_retry(lambda: client.predict(
        input_image=handle_file(img), do_remove_background=False,
        api_name="/preprocess"), label=f"{mid}/prep")

    t0 = time.time()
    with_retry(lambda: client.predict(
        input_image=p, sample_steps=30, sample_seed=seed,
        api_name="/generate_mvs"), label=f"{mid}/mvs", tries=3)
    print(f"    mvs {round(time.time()-t0,1)}s", flush=True)

    t0 = time.time()
    out = with_retry(lambda: client.predict(api_name="/make3d"),
                     label=f"{mid}/make3d", tries=3)
    print(f"    make3d {round(time.time()-t0,1)}s", flush=True)

    glb = None
    for x in out:
        if isinstance(x, str) and os.path.isfile(x) and x.endswith(".glb"):
            glb = x
    if not glb:
        raise RuntimeError(f"no glb in {out}")
    shutil.copyfile(glb, dest_glb)
    with open(meta, "w") as f:
        json.dump({"id": mid, "space": SPACE,
                   "bytes": os.path.getsize(dest_glb)}, f, indent=2)
    print(f"  OK {mid} {os.path.getsize(dest_glb)}B", flush=True)
    return "ok"


def main():
    ids = sys.argv[1:]
    client = with_retry(lambda: Client(SPACE, verbose=False, download_files=True),
                        tries=6, wait=15, label="connect")
    print("connected", flush=True)
    ok = fail = 0
    for mid in ids:
        print(f"[{mid}]", flush=True)
        try:
            r = gen(client, mid)
            if r in ("ok", "done"):
                ok += 1
            else:
                fail += 1
        except Exception as e:
            msg = str(e).replace("\n", " ")[:200]
            print(f"  FAIL {mid}: {type(e).__name__} {msg}", flush=True)
            fail += 1
            if "quota" in msg.lower():
                print("QUOTA_EXHAUSTED — stop", flush=True)
                break
        time.sleep(3)
    print(f"batch done ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
