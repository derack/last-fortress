#!/usr/bin/env python3
"""Generate 3D models from concept images via Tencent Hunyuan3D HF Spaces.

Usage:
  python3 hunyuan3d.py --space tencent/Hunyuan3D-2.1 --id arman [--shape-only]

Flow per model:
  1. upload concepts/<id>.png
  2. /generation_all  -> shape + PBR texture (returns 2 files: video + mesh or mesh files)
  3. save raw output to raw/<id>_n.glb
"""
import argparse, json, os, shutil, sys, time, traceback

from gradio_client import Client, handle_file

BASE = "/home/z/my-project/scripts/hf3d"
RAW = os.path.join(BASE, "raw")
os.makedirs(RAW, exist_ok=True)

# spaces tried in order for the first successful connect; stick to the one given
SPACES = ["tencent/Hunyuan3D-2.1", "tencent/Hunyuan3D-2", "tencent/Hunyuan3D-2mv"]


def connect(space):
    last = None
    for s in ([space] if space else SPACES):
        try:
            c = Client(s, verbose=False, download_files=True)
            print(f"connected: {s}", flush=True)
            return c, s
        except Exception as e:  # noqa
            last = e
            print(f"connect fail {s}: {str(e)[:120]}", flush=True)
    raise RuntimeError(f"no space available: {last}")


def gen_one(client, image_path, octree=256, steps=30, seed=1234):
    """Run full generation (shape + texture). Returns (glb_path, extra_paths)."""
    result = client.predict(
        image=handle_file(image_path),
        mv_image_front=None,
        mv_image_back=None,
        mv_image_left=None,
        mv_image_right=None,
        steps=steps,
        guidance_scale=5.0,
        seed=seed,
        octree_resolution=octree,
        check_box_rembg=True,
        num_chunks=200000,
        randomize_seed=False,
        api_name="/generation_all",
    )
    files = []
    for item in result:
        # File outputs are filepath strings when download_files=True
        if isinstance(item, str) and os.path.isfile(item):
            files.append(item)
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--image", default=None)
    ap.add_argument("--space", default=None)
    ap.add_argument("--octree", type=int, default=256)
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--retries", type=int, default=2)
    args = ap.parse_args()

    image = args.image or os.path.join(BASE, "concepts", f"{args.id}.png")
    if not os.path.isfile(image):
        print(f"NO_IMAGE {image}")
        sys.exit(2)

    client, used = connect(args.space)
    for attempt in range(1, args.retries + 2):
        t0 = time.time()
        try:
            files = gen_one(client, image, args.octree, args.steps, args.seed + attempt)
            glbs = [f for f in files if f.lower().endswith((".glb", ".obj", ".ply", ".stl"))]
            others = [f for f in files if f not in glbs]
            if not glbs:
                raise RuntimeError(f"no mesh in output: {files}")
            # prefer glb
            glbs.sort(key=lambda f: (0 if f.endswith(".glb") else 1, -os.path.getsize(f)))
            src = glbs[0]
            dest = os.path.join(RAW, f"{args.id}.glb")
            shutil.copyfile(src, dest)
            meta = {
                "id": args.id, "space": used, "image": image, "glb": dest,
                "seed": args.seed + attempt, "seconds": round(time.time() - t0, 1),
                "bytes": os.path.getsize(dest), "extras": others[:3],
            }
            with open(os.path.join(RAW, f"{args.id}.json"), "w") as f:
                json.dump(meta, f, indent=2)
            print(f"GEN_OK {args.id} {meta['bytes']}B {meta['seconds']}s via {used}")
            return
        except Exception as e:
            msg = str(e).replace("\n", " ")[:300]
            print(f"attempt {attempt} FAIL: {msg}", flush=True)
            if "quota" in msg.lower() or "gpu" in msg.lower():
                print("GPU_QUOTA issue — waiting 60s before retry", flush=True)
                time.sleep(60)
            else:
                time.sleep(10)
    print(f"GEN_FAIL {args.id}")
    sys.exit(1)


if __name__ == "__main__":
    main()
