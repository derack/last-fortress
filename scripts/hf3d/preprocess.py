#!/usr/bin/env python3
"""Local background removal + SF3D-style foreground framing.

Produces preprocess/<id>.png — 512x512 RGBA, object centered at
foreground_ratio of frame (mimics sf3d_utils.resize_foreground).
"""
import os, sys

import numpy as np
from PIL import Image
from rembg import remove, new_session

BASE = "/home/z/my-project/scripts/hf3d"
OUT = os.path.join(BASE, "preprocess")
os.makedirs(OUT, exist_ok=True)

COND = 512
RATIO = 0.85

_session = None


def get_session():
    global _session
    if _session is None:
        _session = new_session("u2net")
    return _session


def resize_foreground(img: Image.Image, ratio: float = RATIO) -> Image.Image:
    """Crop to alpha bbox, scale so the largest side covers `ratio` of frame,
    paste centered on transparent 512x512 canvas."""
    img = img.convert("RGBA")
    arr = np.array(img)
    alpha = arr[..., 3]
    ys, xs = np.where(alpha > 1.5)
    if len(xs) == 0:
        raise ValueError("empty alpha mask")
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    crop = img.crop((x0, y0, x1, y1))
    # scale so max side = ratio * COND
    target = ratio * COND
    w, h = crop.size
    scale = target / max(w, h)
    crop = crop.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (COND, COND), (127, 127, 127, 0))
    px = (COND - crop.size[0]) // 2
    py = (COND - crop.size[1]) // 2
    canvas.paste(crop, (px, py), crop)
    return canvas


def main():
    ids = sys.argv[1:]
    ok = 0
    for mid in ids:
        src = os.path.join(BASE, "concepts", f"{mid}.png")
        dest = os.path.join(OUT, f"{mid}.png")
        if not os.path.isfile(src):
            print(f"NO SRC {mid}")
            continue
        if os.path.isfile(dest) and os.path.getsize(dest) > 5000:
            print(f"skip {mid}")
            ok += 1
            continue
        im = Image.open(src).convert("RGBA")
        cut = remove(im, session=get_session())
        framed = resize_foreground(cut)
        framed.save(dest)
        print(f"OK {mid} -> {dest} ({os.path.getsize(dest)}B)")
        ok += 1
    print(f"preprocess done {ok}/{len(ids)}")


if __name__ == "__main__":
    main()
