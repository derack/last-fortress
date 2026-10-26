"""bake_and_install.py — دسیماشن سمت‌سرور + vertex-color bake از کانسپت + نصب GLB در بازی.

برای هر کاراکتر:
  1. /on_export_click(shape, reduce_face=True, target=N)  — CPU، بدون سهمیه GPU
  2. پروجکشن متعامد تصویر کانسپت روی vertices (COLOR_0)
     - ماسک پس‌زمینه + پرکردن سیلوئت + تیره‌سازی پشت (شبیه‌سازی نور)
  3. پچ متریال GLB (metallic 0 / roughness 0.8) + نصب در public/assets/3d/rigged/
"""
import io, json, os, shutil, struct, sys, time, glob, urllib.request

import numpy as np
import trimesh
import pymeshlab as pml
from PIL import Image, ImageFilter

RAW_DIR = 'scripts/hf_raw'
CONCEPT_DIR = 'scripts/concepts'
OUT_DIR = 'scripts/hf3d/raw'

# {id: (target_faces, back_dark)}
TARGETS = {
    'arman': 24000, 'aria': 24000, 'radin': 24000, 'nila': 24000,
    'darkLord': 28000, 'golemKing': 28000, 'fireGiant': 28000, 'iceGiant': 28000, 'blackDragon': 28000,
    'shadow': 14000,
}

def local_decimate(shape_path: str, target: int, tmp_dir='scripts/tmp') -> str:
    """دسیماشن لوکال Quadric Edge Collapse با pymeshlab — مسیر PLY خروجی."""
    os.makedirs(tmp_dir, exist_ok=True)
    out_ply = os.path.join(tmp_dir, os.path.basename(shape_path).replace('.glb', f'_{target}.ply'))
    if os.path.exists(out_ply) and os.path.getsize(out_ply) > 100_000:
        return out_ply
    ms = pml.MeshSet()
    ms.load_new_mesh(shape_path)
    ms.meshing_decimation_quadric_edge_collapse(
        targetfacenum=target, qualitythr=0.5, preservenormal=True,
        preservetopology=True, preserveboundary=True, optimalplacement=True,
        selected=False)
    ms.save_current_mesh(out_ply, binary=True, save_face_color=False)
    return out_ply


def load_image_grid(cid: str):
    """تصویر کانسپت + ماسک پس‌زمینه با flood-fill از لبه‌ها + پرکردن سیلوئت + بلر."""
    from collections import deque
    img = Image.open(f'{CONCEPT_DIR}/{cid}.png').convert('RGB')
    arr = np.asarray(img).astype(np.float32)
    h, w, _ = arr.shape
    # کاندید پس‌زمینه: تقریباً خاکستری روشن (کانال‌ها نزدیک هم)
    mx = arr.max(axis=2); mn = arr.min(axis=2)
    grayish = ((mx - mn) < 40) & (mn > 110)
    # flood-fill از لبه‌ها روی پیکسل‌های grayish — پس‌زمینه به لبه‌ها وصل است، زره خاکستری داخل سیلوئت نیست
    step_img = 2  # flood-fill روی گرید نصف برای سرعت
    g = grayish[::step_img, ::step_img]
    seen = np.zeros(g.shape, bool)
    dq = deque()
    for x in range(g.shape[1]):
        for y in (0, g.shape[0] - 1):
            if g[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    for y in range(g.shape[0]):
        for x in (0, g.shape[1] - 1):
            if g[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < g.shape[0] and 0 <= nx < g.shape[1] and g[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; dq.append((ny, nx))
    # بازگشت به رزولوشن کامل + کمی اتساع تا هاله‌ی لبه پاک شود
    bg = np.kron(seen, np.ones((step_img, step_img), bool))[:h, :w]
    for _ in range(4):  # dilation ساده بدون scipy
        bg = bg | np.roll(bg, 1, 0) | np.roll(bg, -1, 0) | np.roll(bg, 1, 1) | np.roll(bg, -1, 1)
    valid = ~bg
    filled = arr.copy()
    filled[bg] = 0
    # پرکردن نواحی ماسک‌شده با میانگین همسایه‌های معتبر (تکراری، روی گرید کوچک)
    step = 4
    small = filled[::step, ::step]
    smask = valid[::step, ::step]
    for _ in range(80):
        if smask.all():
            break
        padded = np.pad(smask, 1, mode='edge')
        neigh = np.zeros_like(small)
        cnt = np.zeros(smask.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                sh = padded[1 + dy: 1 + dy + smask.shape[0], 1 + dx: 1 + dx + smask.shape[1]]
                neigh += small * sh[..., None]
                cnt += sh
        fill = cnt > 0
        todo = (~smask) & fill
        small[todo] = neigh[todo] / cnt[todo][..., None]
        smask = smask | todo
    small_img = Image.fromarray(np.clip(small, 0, 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
    # بلر گاوسی — نمونه‌گیری نرم، بدون نویز جزئیات
    small_img = small_img.filter(ImageFilter.GaussianBlur(radius=5))
    return np.asarray(small_img).astype(np.float32), valid, (w, h)


def concept_char_bbox(vmask, w, h):
    ys, xs = np.where(vmask)
    if len(xs) < 100:
        return (0, 0, w, h)
    return (xs.min(), ys.min(), xs.max(), ys.max())


def bake_colors(tm: trimesh.Trimesh, cid: str, back_dark=0.55):
    grid, vmask, (w, h) = load_image_grid(cid)
    bx0, by0, bx1, by1 = concept_char_bbox(vmask, w, h)
    # Hunyuan مدل را رو به −Z تولید می‌کند؛ بازی +Z می‌خواهد → چرخش ۱۸۰° قبل از بیک
    tm = tm.copy()
    R = trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0])
    tm.apply_transform(R)
    bmin, bmax = tm.bounds
    size = bmax - bmin
    vs = tm.vertices.copy()
    # نگاشت bbox مش → bbox کاراکتر در تصویر (u افقی، v عمودی وارونه)
    u = (vs[:, 0] - bmin[0]) / max(size[0], 1e-6)
    v = 1.0 - (vs[:, 1] - bmin[1]) / max(size[1], 1e-6)
    px = np.clip((bx0 + u * (bx1 - bx0)).astype(int), 0, w - 1)
    py = np.clip((by0 + v * (by1 - by0)).astype(int), 0, h - 1)
    colors = grid[py, px] / 255.0

    # نوردهی: لیفت برای آلبدوی موتور (three.js نور خودش را اضافه می‌کند)
    colors = np.clip(colors * 1.35, 0, 1) ** 0.90

    # تیره‌سازی پشت/بغل بر اساس نرمال (فرض: جلو +Z)
    tm2 = tm.copy()
    face_n = tm2.face_normals
    vert_n = np.zeros_like(vs)
    np.add.at(vert_n, tm2.faces, face_n[:, None, :])
    norm = np.linalg.norm(vert_n, axis=1, keepdims=True)
    vert_n = vert_n / np.maximum(norm, 1e-9)
    zc = vert_n[:, 2]
    shade = np.ones(len(vs), np.float32)
    shade[zc < -0.15] = 0.62          # پشت کامل
    side = (zc >= -0.15) & (zc < 0.25)
    shade[side] = 0.80 + 0.20 * (zc[side] + 0.15) / 0.40
    colors *= shade[:, None]
    colors = np.clip(colors, 0, 1)

    rgba = np.concatenate([colors, np.ones((len(colors), 1))], axis=1).astype(np.uint8)
    tm2.visual = trimesh.visual.ColorVisuals(mesh=tm2, vertex_colors=rgba)
    if tm2.visual.kind != 'vertex':
        raise RuntimeError(f'unexpected visual kind={tm2.visual.kind}')
    if len(tm2.visual.vertex_colors) != len(tm2.vertices):
        raise RuntimeError(f'color len={len(tm2.visual.vertex_colors)} vs verts={len(tm2.vertices)}')
    return tm2


def patch_glb_material(path: str, generator_tag: str):
    """metallic=0 / roughness=0.85 برای رندر درست بدون تکسچر + درج material اگر غایب است."""
    with open(path, 'rb') as f:
        data = f.read()
    magic, ver, length = struct.unpack('<III', data[:12])
    clen, ctype = struct.unpack('<II', data[12:20])
    js = json.loads(data[20:20 + clen])
    binchunk = data[20 + clen:]
    mats = js.get('materials', [])
    if not mats:
        mats = [{'name': 'hf_baked', 'pbrMetallicRoughness': {
            'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}]
        js['materials'] = mats
        for mesh in js.get('meshes', []):
            for prim in mesh.get('primitives', []):
                prim['material'] = 0
    for m in mats:
        pbr = m.setdefault('pbrMetallicRoughness', {})
        pbr['metallicFactor'] = 0.0
        pbr['roughnessFactor'] = 0.85
        pbr.setdefault('baseColorFactor', [1, 1, 1, 1])
    js.setdefault('asset', {})['generator'] = generator_tag
    newj = json.dumps(js, separators=(',', ':')).encode()
    pad = (4 - len(newj) % 4) % 4
    newj += b' ' * pad
    out = struct.pack('<III', magic, 2, 12 + 8 + len(newj) + len(binchunk))
    out += struct.pack('<II', len(newj), 0x4E4F534A) + newj + binchunk
    with open(path, 'wb') as f:
        f.write(out)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ids = sys.argv[1:] or list(TARGETS)
    report = []
    for cid in ids:
        if cid not in TARGETS:
            continue
        target = TARGETS[cid]
        shape = f'{RAW_DIR}/{cid}_shape.glb'
        concept = f'{CONCEPT_DIR}/{cid}.png'
        if not (os.path.exists(shape) and os.path.exists(concept)):
            print(f'[skip] {cid} (shape/concept missing)')
            continue
        try:
            t0 = time.time()
            ply = local_decimate(shape, target)
            m = trimesh.load(ply, force='scene')
            # بازسازی تمیز هر جزء — حذف normals/uv/attributeهای ناهم‌بعد که concatenate را می‌شکند
            parts = [trimesh.Trimesh(vertices=g.vertices, faces=g.faces, process=False)
                     for g in m.geometry.values()
                     if isinstance(g, trimesh.Trimesh) and len(g.faces) > 0]
            tm = trimesh.util.concatenate(parts)
            tm.merge_vertices()
            tm.process(validate=True)
            baked = bake_colors(tm, cid)
            out_path = f'{OUT_DIR}/{cid}_textured.glb'
            baked.export(out_path, file_type='glb')
            patch_glb_material(out_path, f'Hunyuan3D-2 shape + vertex-bake (Last Fortress v2.1) [{cid}]')
            kb = os.path.getsize(out_path) // 1024
            report.append((cid, len(tm.faces), kb, f'{time.time()-t0:.0f}s'))
            print(f'[DONE] {cid}: faces={len(tm.faces)} {kb}KB t={time.time()-t0:.0f}s', flush=True)
        except Exception as e:
            print(f'[FAIL] {cid}: {str(e)[:180]}', flush=True)
    print('\n=== BAKE REPORT ===')
    for r in report:
        print(*r)


if __name__ == '__main__':
    main()
