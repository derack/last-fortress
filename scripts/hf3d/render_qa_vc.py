#!/usr/bin/env python3
"""render_qa_vc.py — رندر نرم‌افزاری GLB ورتکس-کالر از ۴ نما برای QA.

Usage: python3 render_qa_vc.py <in.glb> <out_prefix>
"""
import sys

import numpy as np
import trimesh
from PIL import Image

W = 512


def look_at_view(mesh, azim_deg):
    a = np.deg2rad(azim_deg)
    c, s = np.cos(a), np.sin(a)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return mesh.vertices @ R.T, mesh.faces


def render(verts, faces, vcol, azim):
    v, fc = look_at_view(trimesh.Trimesh(vertices=verts, faces=faces, process=False), azim)
    lo, hi = v.min(axis=0), v.max(axis=0)
    scale = (W * 0.9) / max(hi[0] - lo[0], hi[1] - lo[1])
    x = (v[:, 0] - (lo[0] + hi[0]) / 2) * scale + W / 2
    y = W / 2 - (v[:, 1] - (lo[1] + hi[1]) / 2) * scale
    z = v[:, 2]
    img = np.full((W, W, 3), 240, dtype=np.float32)
    zbuf = np.full((W, W), -1e9, dtype=np.float32)
    tri_c = vcol[fc]
    tri_x, tri_y, tri_z = x[fc], y[fc], z[fc]
    for fi in range(len(fc)):
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
        col = np.clip(
            c[:, None] * tri_c[fi][0] + a[:, None] * tri_c[fi][1] + b[:, None] * tri_c[fi][2],
            0, 1)[inside] * 255
        gx = pts[inside, 0].astype(np.int32)
        gy = pts[inside, 1].astype(np.int32)
        gz = zi[inside]
        m = gz > zbuf[gy, gx]
        zbuf[gy[m], gx[m]] = gz[m]
        img[gy[m], gx[m]] = col[m]
    return Image.fromarray(img.astype(np.uint8))


def main():
    src, prefix = sys.argv[1], sys.argv[2]
    scene = trimesh.load(src, force='scene')
    geo = max(scene.geometry.values(), key=lambda g: len(g.faces))
    vis = geo.visual
    vc = getattr(vis, 'vertex_colors', None)
    if vc is None or vis.kind == 'texture':
        vc = vis.vertex_attributes.get('color')
    vc = np.asarray(vc, dtype=np.float32)
    if vc.max() > 1.0:
        vc = vc / 255.0
    vc = vc[:, :3]
    if len(vc) != len(geo.vertices):
        raise SystemExit(f'vertex color mismatch {len(vc)} vs {len(geo.vertices)}')
    faces = np.asarray(geo.faces)
    views = [('front', 0), ('right', 90), ('back', 180), ('iso', 35)]
    for name, az in views:
        im = render(geo.vertices, faces, vc, az)
        out = f'{prefix}_{name}.png'
        im.save(out)
        print('saved', out)


if __name__ == '__main__':
    main()
