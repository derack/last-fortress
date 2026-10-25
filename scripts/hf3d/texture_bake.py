#!/usr/bin/env python3
"""Local multi-view projection texture bake (quota-free).

For each mesh: UV-unwrap with xatlas, rasterize per-face color from the
dominant view image (front/back/left/right concepts), dilate empty texels,
export textured GLB.

Usage: python3 texture_bake.py id [id ...]
  reads  raw/<id>.glb  (shape mesh)  and concepts/<id>[_view].png
  writes raw/<id>_textured.glb
"""
import os, subprocess, sys, tempfile

import numpy as np
import trimesh
import xatlas
from PIL import Image

MAX_FACES = 15000

BASE = "/home/z/my-project/scripts/hf3d"
RAW = os.path.join(BASE, "raw")
CON = os.path.join(BASE, "concepts")
ATLAS = 1024

VIEW_DIRS = {
    "front": np.array([0.0, 0.0, 1.0]),   # model forward +Z (game standard)
    "back": np.array([0.0, 0.0, -1.0]),
    "right": np.array([1.0, 0.0, 0.0]),
    "left": np.array([-1.0, 0.0, 0.0]),
}


def load_view(mid, tag):
    name = f"{mid}.png" if tag == "front" else f"{mid}_{tag}.png"
    p = os.path.join(CON, name)
    if not os.path.isfile(p):
        return None, None
    im = Image.open(p).convert("RGBA")
    arr = np.array(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    rgb = arr[..., :3]
    # inpaint transparent zone by iterative neighbor mean so sampling never
    # returns studio background
    mask = (alpha[..., 0] < 0.5)
    filled = rgb.copy()
    known = (~mask).astype(np.float32)
    for _ in range(80):
        if known.min() >= 1.0:
            break
        kpad = np.pad(known, ((1, 1), (1, 1)), mode="edge")
        vpad = np.pad(filled, ((1, 1), (1, 1), (0, 0)), mode="edge")
        cnt = (kpad[:-2, 1:-1] + kpad[2:, 1:-1] + kpad[1:-1, :-2] + kpad[1:-1, 2:])
        acc = (vpad[:-2, 1:-1] * kpad[:-2, 1:-1, None] + vpad[2:, 1:-1] * kpad[2:, 1:-1, None]
               + vpad[1:-1, :-2] * kpad[1:-1, :-2, None] + vpad[1:-1, 2:] * kpad[1:-1, 2:, None])
        empty = (known < 1.0) & (cnt > 0)
        filled[empty] = (acc[empty] / cnt[empty][:, None])
        known[empty] = 1.0
    return Image.fromarray(np.clip(filled, 0, 255).astype(np.uint8)), alpha


def normalize_mesh(mesh):
    v = mesh.vertices.copy()
    lo, hi = v.min(axis=0), v.max(axis=0)
    c = (lo + hi) / 2.0
    v[:, 0] -= c[0]
    v[:, 2] -= c[2]
    v[:, 1] -= lo[1]              # feet on ground
    h = hi[1] - lo[1]
    if h > 1e-6:
        v /= h                    # unit height
    mesh.vertices = v
    return mesh


def project_uv(pts, lo, hi, tag):
    """3D points -> image UV in [0,1] (u right, v up)."""
    u = np.empty(len(pts))
    if tag in ("front", "back"):
        x = pts[:, 0]
        if tag == "back":
            x = (lo[0] + hi[0]) - x
        u = (x - lo[0]) / max(1e-6, hi[0] - lo[0])
    else:
        z = pts[:, 2]
        if tag == "left":
            z = (lo[2] + hi[2]) - z
        u = (z - lo[2]) / max(1e-6, hi[2] - lo[2])
    v = (pts[:, 1] - lo[1]) / max(1e-6, hi[1] - lo[1])
    return np.stack([u, v], axis=1)


def bake(mid, mesh_path, out_path):
    scene = trimesh.load(mesh_path, force="scene")
    geoms = list(scene.geometry.values())
    if not geoms:
        raise RuntimeError("no geometry")
    mesh = max(geoms, key=lambda g: len(g.faces))
    mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=True)
    if len(mesh.faces) > MAX_FACES:
        ratio = max(0.01, MAX_FACES / len(mesh.faces))
        tmp = tempfile.mktemp(suffix=".glb")
        subprocess.run(["npx", "-y", "gltfpack", "-i", mesh_path, "-o", tmp,
                        "-si", str(ratio), "-kn"], check=True,
                       capture_output=True, timeout=240)
        s2 = trimesh.load(tmp, force="scene")
        mesh = max(s2.geometry.values(), key=lambda g: len(g.faces))
        mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=True)
        os.unlink(tmp)
    normalize_mesh(mesh)

    lo, hi = mesh.bounds[0], mesh.bounds[1]
    print(f"  mesh: v={len(mesh.vertices)} f={len(mesh.faces)} h={hi[1]-lo[1]:.2f}")

    # UV unwrap
    atlas = xatlas.Atlas()
    atlas.add_mesh(mesh.vertices, mesh.faces)
    atlas.generate()
    r = atlas[0]
    vmap = np.asarray(r[0])            # vertex -> new vertex index
    faces = np.asarray(r[1])           # faces over new vertices
    uvs = np.asarray(r[2])             # (N,2) uv per new vertex
    # map old face normals
    old_faces = vmap[faces]            # faces in original vertex indexing
    normals = mesh.face_normals       # per original face

    # load views
    views = {}
    for tag in VIEW_DIRS:
        img, _alpha = load_view(mid, tag)
        if img is not None:
            views[tag] = np.array(img).astype(np.float32) / 255.0
    if not views:
        raise RuntimeError("no concept views")
    tags = list(views.keys())
    dirs = np.stack([VIEW_DIRS[t] for t in tags])
    print(f"  views: {tags}")

    canvas = np.zeros((ATLAS, ATLAS, 3), dtype=np.float32)
    filled = np.zeros((ATLAS, ATLAS), dtype=bool)

    # dominant view per face
    dots = normals @ dirs.T                       # (F, V)
    dom = np.argmax(dots, axis=1)

    # rasterize per face
    for fi in range(len(faces)):
        tag = tags[dom[fi]]
        img = views[tag]
        ih, iw = img.shape[:2]
        tri_old = old_faces[fi]                   # 3 original vertex ids
        tri_uv = faces[fi]                        # 3 atlas vertex ids
        p3 = mesh.vertices[tri_old]               # (3,3)
        uv = uvs[tri_uv]                          # (3,2) in [0,1]
        px = uv * ATLAS
        # image-space projection of the 3 verts
        pu = project_uv(p3, lo, hi, tag)          # (3,2) in [0,1]
        pi = pu * np.array([iw - 1, ih - 1])
        # bbox in atlas
        x0 = max(0, int(np.floor(px[:, 0].min())) - 1)
        x1 = min(ATLAS - 1, int(np.ceil(px[:, 0].max())) + 1)
        y0 = max(0, int(np.floor(px[:, 1].min())) - 1)
        y1 = min(ATLAS - 1, int(np.ceil(px[:, 1].max())) + 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        pts = np.stack([xs.ravel(), ys.ravel()], axis=1).astype(np.float32)
        # barycentric in atlas space
        v0 = px[1] - px[0]
        v1 = px[2] - px[0]
        d = v0[0] * v1[1] - v0[1] * v1[0]
        if abs(d) < 1e-9:
            continue
        q = pts - px[0]
        a = (q[:, 0] * v1[1] - q[:, 1] * v1[0]) / d
        b = (q[:, 1] * v0[0] - q[:, 0] * v0[1]) / d
        c = 1.0 - a - b
        inside = (a >= -0.02) & (b >= -0.02) & (c >= -0.02)
        if not inside.any():
            continue
        P3 = c[:, None] * p3[0] + a[:, None] * p3[1] + b[:, None] * p3[2]
        iuv = project_uv(P3, lo, hi, tag) * np.array([iw - 1, ih - 1])
        xi = np.clip(iuv[:, 0], 0, iw - 1).astype(np.int32)
        yi = np.clip(ih - 1 - iuv[:, 1], 0, ih - 1).astype(np.int32)
        col = img[yi, xi][inside]
        gx = pts[inside, 0].astype(np.int32)
        gy = pts[inside, 1].astype(np.int32)
        canvas[gy, gx] = col
        filled[gy, gx] = True

    # dilate unfilled texels
    for _ in range(24):
        if filled.all():
            break
        fpad = np.pad(filled, 1, mode="edge")
        vpad = np.pad(canvas, ((1, 1), (1, 1), (0, 0)), mode="edge")
        cnt = (fpad[:-2, 1:-1] + fpad[2:, 1:-1] + fpad[1:-1, :-2] + fpad[1:-1, 2:])
        acc = (vpad[:-2, 1:-1] * fpad[:-2, 1:-1, None] + vpad[2:, 1:-1] * fpad[2:, 1:-1, None]
               + vpad[1:-1, :-2] * fpad[1:-1, :-2, None] + vpad[1:-1, 2:] * fpad[1:-1, 2:, None])
        e = (~filled) & (cnt > 0)
        canvas[e] = acc[e] / cnt[e][:, None]
        filled |= e

    tex = Image.fromarray(np.clip(canvas * 255, 0, 255).astype(np.uint8))
    tex.save(out_path.replace(".glb", "_atlas.png"))
    new_verts = mesh.vertices[vmap]     # xatlas duplicates verts along charts
    out = trimesh.Trimesh(vertices=new_verts, faces=faces, process=False)
    mat = trimesh.visual.material.PBRMaterial(
        baseColorTexture=tex,
        baseColorFactor=[1.0, 1.0, 1.0, 1.0],
        roughnessFactor=0.85,
        metallicFactor=0.0,
        doubleSided=True,
    )
    out.visual = trimesh.visual.TextureVisuals(
        uv=np.asarray(uvs, dtype=np.float32), image=tex, material=mat)
    out.export(out_path)
    print(f"  BAKED {out_path} ({os.path.getsize(out_path)}B)")


def main():
    ids = sys.argv[1:]
    for mid in ids:
        src = os.path.join(RAW, f"{mid}.glb")
        if not os.path.isfile(src):
            print(f"NO MESH {mid}")
            continue
        dest = os.path.join(RAW, f"{mid}_textured.glb")
        print(f"[{mid}]")
        try:
            bake(mid, src, dest)
        except Exception as e:
            print(f"  FAIL {mid}: {type(e).__name__} {e}")


if __name__ == "__main__":
    main()
