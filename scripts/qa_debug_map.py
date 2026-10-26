"""qa_debug_map.py — نمایش نقاط نمونه‌گیری رنگ روی تصویر کانسپت + هیستوگرام."""
import sys, os, struct, json
import numpy as np
import trimesh
from PIL import Image
sys.path.insert(0, 'scripts')
import importlib
import bake_and_install as B
importlib.reload(B)

cid = sys.argv[1] if len(sys.argv) > 1 else 'arman'
ply = B.local_decimate(f'scripts/hf_raw/{cid}_shape.glb', B.TARGETS[cid])
m = trimesh.load(ply, force='scene')
parts = [trimesh.Trimesh(vertices=g.vertices, faces=g.faces, process=False)
         for g in m.geometry.values() if isinstance(g, trimesh.Trimesh) and len(g.faces) > 0]
tm = trimesh.util.concatenate(parts)
tm.merge_vertices(); tm.process(validate=True)

grid, vmask, (w, h) = B.load_image_grid(cid)
bx0, by0, bx1, by1 = B.concept_char_bbox(vmask, w, h)
print('char bbox in image:', bx0, by0, bx1, by1, '| valid px:', int(vmask.sum()), '/', w*h)

bmin, bmax = tm.bounds
size = bmax - bmin
vs = tm.vertices.copy()
u = (vs[:, 0] - bmin[0]) / max(size[0], 1e-6)
v = 1.0 - (vs[:, 1] - bmin[1]) / max(size[1], 1e-6)
px = np.clip((bx0 + u * (bx1 - bx0)).astype(int), 0, w - 1)
py = np.clip((by0 + v * (by1 - by0)).astype(int), 0, h - 1)
colors = grid[py, px]
print('sample color mean:', colors.mean(axis=0).round(1), '| min:', colors.mean(axis=1).min().round(1), '| dark(<40) frac:', float((colors.mean(axis=1) < 40).mean()).__round__(3))

img = Image.open(f'scripts/concepts/{cid}.png').convert('RGB')
arr = np.asarray(img).copy()
step = max(1, len(px) // 4000)
arr[py[::step], px[::step]] = [255, 0, 255]
Image.fromarray(arr).save(f'scripts/qa_map_{cid}.png')
print('saved', f'scripts/qa_map_{cid}.png')
