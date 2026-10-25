#!/usr/bin/env python3
"""Software-render a textured GLB from 4 views for QA (no GPU/browser).

Usage: python3 render_qa.py <in.glb> <out_prefix>
Writes <out_prefix>_front.png, _right.png, _back.png, _iso.png
"""
import os, sys

import numpy as np
import trimesh
from PIL import Image

W = 512


def look_at_view(mesh, azim_deg):
    """Rotate mesh around Y so that view direction becomes +Z; return verts."""
    a = np.deg2rad(azim_deg)
    c, s = np.cos(a), np.sin(a)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return mesh.vertices @ R.T


def render(verts, faces, uv, tex, azim):
    v = look_at_view(trimesh.Trimesh(vertices=verts, faces=faces, process=False), azim)
    lo, hi = v.min(axis=0), v.max(axis=0)
    scale = (W * 0.9) / max(hi[0] - lo[0], hi[1] - lo[1])
    x = (v[:, 0] - (lo[0] + hi[0]) / 2) * scale + W / 2
    y = W / 2 - (v[:, 1] - (lo[1] + hi[1]) / 2) * scale
    z = v[:, 2]
    img = np.full((W, W, 3), 240, dtype=np.float32)
    zbuf = np.full((W, W), -1e9, dtype=np.float32)
    tw, th = tex.shape[1], tex.shape[0]
    tri_uv = uv[faces]
    tri_x, tri_y, tri_z = x[faces], y[faces], z[faces]
    for fi in range(len(faces)):
        px, py, pz = tri_x[fi], tri_y[fi], tri_z[fi]
        x0, x1 = int(max(0, px.min())), int(min(W - 1, np.ceil(px.max())))
        y0, y1 = int(max(0, py.min())), int(min(W - 1, np.ceil(py.max())))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        pts = np.stack([xs.ravel(), ys.ravel()], 1).astype(np.float32) + 0.5
        v0 = np.array([px[1] - px[0], py[1] - py[0]])
        v1 = np.array([px[2] - px[0], py[2] - py[0]])
        d = v0[0] * v1[1] - v0[1] * v1[0]
        if abs(d) < 1e-9:
            continue
        q = pts - np.array([px[0], py[0]])
        a = (q[:, 0] * v1[1] - q[:, 1] * v1[0]) / d
        b = (q[:, 1] * v0[0] - q[:, 0] * v0[1]) / d
        c = 1 - a - b
        inside = (a >= 0) & (b >= 0) & (c >= 0)
        if not inside.any():
            continue
        zi = c * pz[0] + a * pz[1] + b * pz[2]
        tu = np.clip((c * tri_uv[fi][0][0] + a * tri_uv[fi][1][0] + b * tri_uv[fi][2][0]) * (tw - 1), 0, tw - 1).astype(np.int32)
        tv = np.clip((c * tri_uv[fi][0][1] + a * tri_uv[fi][1][1] + b * tri_uv[fi][2][1]) * (th - 1), 0, th - 1).astype(np.int32)
        col = tex[tv, tu][inside]
        gx = pts[inside, 0].astype(np.int32)
        gy = pts[inside, 1].astype(np.int32)
        gz = zi[inside]
        m = gz > zbuf[gy, gx]
        zbuf[gy[m], gx[m]] = gz[m]
        img[gy[m], gx[m]] = col[m]
    return Image.fromarray(img.astype(np.uint8))


def main():
    src, prefix = sys.argv[1], sys.argv[2]
    scene = trimesh.load(src, force="scene")
    geo = max(scene.geometry.values(), key=lambda g: len(g.faces))
    vis = geo.visual
    uv = np.asarray(vis.uv) if vis.uv is not None else np.zeros((len(geo.vertices), 2))
    img = getattr(vis, "image", None)
    if img is None:
        img = getattr(getattr(vis, "material", None), "baseColorTexture", None)
    tex = np.array(img.convert("RGB")) if img is not None else np.full((64, 64, 3), 180, np.uint8)
    faces = np.asarray(geo.faces)
    views = [("front", 0), ("right", 90), ("back", 180), ("iso", 35)]
    for name, az in views:
        im = render(geo.vertices, faces, uv, tex, az)
        out = f"{prefix}_{name}.png"
        im.save(out)
        print("saved", out)


if __name__ == "__main__":
    main()
