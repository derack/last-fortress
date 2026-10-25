#!/usr/bin/env python3
"""InstantMesh batch via gradio_client with retries.

Usage: python3 instant_batch.py id1 id2 ...
Writes raw/<id>.obj + raw/<id>.glb (textured) + raw/<id>.json
"""
import json, os, shutil, sys, time

from gradio_client import Client, handle_file

BASE = "/home/z/my-project/scripts/hf3d"
RAW = os.path.join(BASE, "raw")
os.makedirs(RAW, exist_ok=True)
SPACE = "TencentARC/InstantMesh"


def with_retry(fn, tries=5, wait=12):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa
            last = e
            msg = str(e).replace("\n", " ")[:150]
            print(f"    retry {i+1}: {type(e).__name__} {msg}", flush=True)
            if "quota" in msg.lower():
                raise
            time.sleep(wait)
    raise last


def gen(client, mid, seed=1234):
    dest_glb = os.path.join(RAW, f"{mid}.glb")
    dest_obj = os.path.join(RAW, f"{mid}.obj")
    meta = os.path.join(RAW, f"{mid}.json")
    if os.path.isfile(dest_glb) and os.path.isfile(meta):
        print(f"  skip {mid} (done)", flush=True)
        return True
    img = os.path.join(BASE, "preprocess", f"{mid}.png")
    if not os.path.isfile(img):
        print(f"  NO PREPROCESSED {mid}", flush=True)
        return False

    p = with_retry(lambda: client.predict(
        input_image=handle_file(img), do_remove_background=False, api_name="/preprocess"))
    t0 = time.time()
    with_retry(lambda: client.predict(
        input_image=p, sample_steps=30, sample_seed=seed, api_name="/generate_mvs"))
    t_mvs = round(time.time() - t0, 1)
    t0 = time.time()
    out = with_retry(lambda: client.predict(api_name="/make3d"))
    t_make = round(time.time() - t0, 1)

    glb = obj = None
    for x in out:
        if isinstance(x, str) and os.path.isfile(x):
            if x.endswith(".glb"):
                glb = x
            elif x.endswith(".obj"):
                obj = x
    if not glb:
        raise RuntimeError(f"no glb: {out}")
    shutil.copyfile(glb, dest_glb)
    if obj:
        shutil.copyfile(obj, dest_obj)
    with open(meta, "w") as f:
        json.dump({"id": mid, "space": SPACE, "mvs_s": t_mvs, "make3d_s": t_make,
                   "bytes": os.path.getsize(dest_glb)}, f, indent=2)
    print(f"  OK {mid} glb={os.path.getsize(dest_glb)}B mvs={t_mvs}s make={t_make}s", flush=True)
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
            msg = str(e).replace("\n", " ")[:220]
            print(f"  FAIL {mid}: {msg}", flush=True)
            fail += 1
            if "quota" in msg.lower():
                print("QUOTA_EXHAUSTED — stop", flush=True)
                break
    print(f"batch done ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
