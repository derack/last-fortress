#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ============================================================
# glbkit — کتابخانهٔ ساخت GLB استایلایز low-poly برای «آخرین سنگر»
# ------------------------------------------------------------
# فاز Asset Production — فاز ۱: چهار قهرمان (کارت ۶.۱..۶.۴ Art Bible)
# قواعد خط لوله (مانیفست/نرمال‌ایزر بازی):
#   • جهت Forward استاندارد: +Z — مدل ایستاده روی y=0
#   • ارتفاع دقیق مدل ساخته می‌شود؛ ModelNormalizer به targetHeight می‌رساند
#   • نقاط VFX = نود خالی با نام WeaponPoint/MuzzlePoint/ChestPoint/HeadPoint/HitPoint
#     (یافته با تطبیق فازی نام — ModelNormalizer.NAME_ALIASES)
#   • سلاح = «یک» Mesh جدا با چند Primitive (Prop-Swing قطعی:
#     کوچک‌ترین جزء مدل = سلاح کشیده → پیوت تاب خودکار در حمله)
# ============================================================
import json
import math
import struct
import numpy as np


# ------------------------------------------------------------
# ریاضی
# ------------------------------------------------------------

def _rotmat(rx, ry, rz):
    ax, ay, az = math.radians(rx), math.radians(ry), math.radians(rz)
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


class Mat:
    """متریال PBR"""
    __slots__ = ('name', 'color', 'metallic', 'roughness', 'emissive', 'emissive_k', 'alpha', 'double_sided')

    def __init__(self, name, color, metallic=0.0, roughness=0.8, emissive=None, emissive_k=1.0,
                 alpha=1.0, double_sided=False):
        self.name = name
        self.color = color
        self.metallic = metallic
        self.roughness = roughness
        self.emissive = emissive
        self.emissive_k = emissive_k
        self.alpha = alpha
        self.double_sided = double_sided


class Geo:
    """هندسهٔ چندبلوکی — هر بلوک = یک Primitive با متریال خودش"""

    def __init__(self):
        self.pos = []
        self.nrm = []
        self.idx = []
        self.blocks = []  # (start_idx, count_idx, Mat)

    def _add(self, mat, positions, normals, indices, rot, scale, at):
        R = _rotmat(*rot)
        P = np.asarray(positions, dtype=np.float64).reshape(-1, 3)
        N = np.asarray(normals, dtype=np.float64).reshape(-1, 3)
        S = np.asarray(scale, dtype=np.float64)
        P = P * S
        N = N / np.where(np.abs(S) < 1e-9, 1e-9, np.abs(S))
        P = P @ R.T + np.asarray(at, dtype=np.float64)
        N = N @ R.T
        ln = np.linalg.norm(N, axis=1, keepdims=True)
        N = N / np.where(ln < 1e-9, 1e-9, ln)
        base = len(self.pos)
        self.pos.extend(P.tolist())
        self.nrm.extend(N.tolist())
        start = len(self.idx)
        self.idx.extend((np.asarray(indices, dtype=np.int64) + base).tolist())
        self.blocks.append((start, len(self.idx) - start, mat))

    # ------------------ شکل‌ها ------------------

    def box(self, mat, w, h, d, rot=(0, 0, 0), scale=(1, 1, 1), at=(0, 0, 0), pivot='center'):
        hw, hh, hd = w / 2, h / 2, d / 2
        y0 = 0.0 if pivot == 'bottom' else -hh
        y1 = h if pivot == 'bottom' else hh
        faces = [
            ((0, 0, 1), [(-hw, y0, hd), (hw, y0, hd), (hw, y1, hd), (-hw, y1, hd)]),
            ((0, 0, -1), [(hw, y0, -hd), (-hw, y0, -hd), (-hw, y1, -hd), (hw, y1, -hd)]),
            ((1, 0, 0), [(hw, y0, hd), (hw, y0, -hd), (hw, y1, -hd), (hw, y1, hd)]),
            ((-1, 0, 0), [(-hw, y0, -hd), (-hw, y0, hd), (-hw, y1, hd), (-hw, y1, -hd)]),
            ((0, 1, 0), [(-hw, y1, hd), (hw, y1, hd), (hw, y1, -hd), (-hw, y1, -hd)]),
            ((0, -1, 0), [(-hw, y0, -hd), (hw, y0, -hd), (hw, y0, hd), (-hw, y0, hd)]),
        ]
        pos, nrm, idx = [], [], []
        for n, corners in faces:
            b = len(pos)
            pos.extend(corners)
            nrm.extend([n] * 4)
            idx.extend([b, b + 1, b + 2, b, b + 2, b + 3])
        self._add(mat, pos, nrm, idx, rot, scale, at)
        return self

    def cyl(self, mat, r0, r1, h, seg=10, rot=(0, 0, 0), scale=(1, 1, 1), at=(0, 0, 0),
            pivot='bottom', cap0=True, cap1=True):
        yc0 = -h / 2 if pivot == 'center' else 0.0
        yc1 = yc0 + h
        ang = [2 * math.pi * i / seg for i in range(seg)]
        pos, nrm, idx = [], [], []
        if r0 > 1e-6 and r1 > 1e-6:
            slope = (r0 - r1) / max(h, 1e-9)
            k = 1.0 / math.hypot(1.0, slope)
            ny = slope * k
            for i in range(seg):
                j = (i + 1) % seg
                x0, z0 = math.cos(ang[i]), math.sin(ang[i])
                x1, z1 = math.cos(ang[j]), math.sin(ang[j])
                nx, nz = x0 + x1, z0 + z1
                l = math.hypot(nx, nz) or 1.0
                nx, nz = nx / l * k, nz / l * k
                b = len(pos)
                pos.extend([
                    (x0 * r0, yc0, z0 * r0), (x1 * r0, yc0, z1 * r0),
                    (x1 * r1, yc1, z1 * r1), (x0 * r1, yc1, z0 * r1),
                ])
                nrm.extend([(nx, ny, nz)] * 4)
                idx.extend([b, b + 2, b + 1, b, b + 3, b + 2])
        if cap1 and r1 > 1e-6:
            b = len(pos)
            pos.append((0, yc1, 0)); nrm.append((0, 1, 0))
            for i in range(seg):
                a = ang[i]
                pos.append((math.cos(a) * r1, yc1, math.sin(a) * r1)); nrm.append((0, 1, 0))
            for i in range(seg):
                idx.extend([b, b + 1 + i, b + 1 + (i + 1) % seg])
        if cap0 and r0 > 1e-6:
            b = len(pos)
            pos.append((0, yc0, 0)); nrm.append((0, -1, 0))
            for i in range(seg):
                a = ang[i]
                pos.append((math.cos(a) * r0, yc0, math.sin(a) * r0)); nrm.append((0, -1, 0))
            for i in range(seg):
                idx.extend([b, b + 1 + (i + 1) % seg, b + 1 + i])
        self._add(mat, pos, nrm, idx, rot, scale, at)
        return self

    def sphere(self, mat, r, lat=7, lon=12, rot=(0, 0, 0), scale=(1, 1, 1), at=(0, 0, 0), hemisphere=False):
        pos, nrm, idx = [], [], []
        lat_n = lat if not hemisphere else lat // 2 + 1
        top_cut = hemisphere
        for i in range(lat_n + 1):
            phi = math.pi * i / lat
            if top_cut and phi > math.pi / 2:
                break
            y = math.cos(phi)
            rr = math.sin(phi)
            for j in range(lon):
                th = 2 * math.pi * j / lon
                x, z = rr * math.cos(th), rr * math.sin(th)
                pos.append((x * r, y * r, z * r))
                nrm.append((x, y, z))
        rows = lat_n if not top_cut else len(pos) // lon
        for i in range(rows - 1 if top_cut else lat):
            for j in range(lon):
                a = i * lon + j
                b = i * lon + (j + 1) % lon
                c = (i + 1) * lon + (j + 1) % lon
                d = (i + 1) * lon + j
                if i != 0:
                    idx.extend([a, d, b])
                if not top_cut and i != lat - 1:
                    idx.extend([b, d, c])
                elif top_cut and (i + 1) * lon + j < len(pos):
                    idx.extend([b, d, c])
        self._add(mat, pos, nrm, idx, rot, scale, at)
        return self

    def octa(self, mat, r, rot=(0, 0, 0), scale=(1, 1, 1), at=(0, 0, 0)):
        v = [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r)]
        faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
        pos, nrm, idx = [], [], []
        for f in faces:
            a, b, c = [v[i] for i in f]
            n = np.cross(np.subtract(b, a), np.subtract(c, a))
            n = n / (np.linalg.norm(n) or 1.0)
            b0 = len(pos)
            pos.extend([a, b, c]); nrm.extend([tuple(n)] * 3)
            idx.extend([b0, b0 + 1, b0 + 2])
        self._add(mat, pos, nrm, idx, rot, scale, at)
        return self

    def prism3(self, mat, w, h, d, rot=(0, 0, 0), scale=(1, 1, 1), at=(0, 0, 0), pivot='bottom'):
        """منشور سه‌گوش — مقطع مثلث در XY، امتداد در Z"""
        y0 = 0.0 if pivot == 'bottom' else -h / 2
        y1 = y0 + h
        pts = [(-w / 2, y0), (w / 2, y0), (0, y1)]
        pos, nrm, idx = [], [], []
        for zoff, n, flip in [(d / 2, (0, 0, 1), True), (-d / 2, (0, 0, -1), False)]:
            b = len(pos)
            pos.extend([(x, y, zoff) for (x, y) in pts]); nrm.extend([n] * 3)
            idx.extend([b, b + 2, b + 1] if flip else [b, b + 1, b + 2])
        for i0, i1 in [(0, 1), (1, 2), (2, 0)]:
            p0, p1 = pts[i0], pts[i1]
            b = len(pos)
            pos.extend([(p0[0], p0[1], d / 2), (p1[0], p1[1], d / 2),
                        (p1[0], p1[1], -d / 2), (p0[0], p0[1], -d / 2)])
            ex, ey = p1[0] - p0[0], p1[1] - p0[1]
            l = math.hypot(ex, ey) or 1.0
            n = (ey / l, -ex / l, 0)
            nrm.extend([n] * 4)
            idx.extend([b, b + 2, b + 1, b, b + 3, b + 2])
        self._add(mat, pos, nrm, idx, rot, scale, at)
        return self

    def tri_fan(self, mat, verts, rot=(0, 0, 0), scale=(1, 1, 1), at=(0, 0, 0), double=False):
        """چندوجهی دستی از مثلث‌ها — verts: لیست مثلث‌ها هرکدام ۳ رأس"""
        pos, nrm, idx = [], [], []
        for tri in verts:
            a, b, c = tri
            n = np.cross(np.subtract(b, a), np.subtract(c, a))
            l = np.linalg.norm(n) or 1.0
            n = n / l
            b0 = len(pos)
            pos.extend([a, b, c]); nrm.extend([tuple(n)] * 3)
            idx.extend([b0, b0 + 1, b0 + 2])
            if double:
                idx.extend([b0, b0 + 2, b0 + 1])
        self._add(mat, pos, nrm, idx, rot, scale, at)
        return self


class Part:
    """یک Mesh نود GLB — چند Primitive با متریال‌های متنوع"""

    def __init__(self, name, translation=(0, 0, 0), rotation=(0, 0, 0)):
        self.name = name
        self.translation = tuple(translation)
        self.rotation = tuple(rotation)
        self.geo = Geo()

    # میانبرها — هر شکل با متریال خودش
    def box(self, mat, w, h, d, **kw):
        self.geo.box(mat, w, h, d, **kw)
        return self

    def cyl(self, mat, r0, r1, h, **kw):
        self.geo.cyl(mat, r0, r1, h, **kw)
        return self

    def sphere(self, mat, r, **kw):
        self.geo.sphere(mat, r, **kw)
        return self

    def octa(self, mat, r, **kw):
        self.geo.octa(mat, r, **kw)
        return self

    def prism3(self, mat, w, h, d, **kw):
        self.geo.prism3(mat, w, h, d, **kw)
        return self

    def tri_fan(self, mat, verts, **kw):
        self.geo.tri_fan(mat, verts, **kw)
        return self

    @property
    def vol(self):
        if not self.geo.pos:
            return 0.0
        mn = np.min(self.geo.pos, axis=0); mx = np.max(self.geo.pos, axis=0)
        s = mx - mn
        return float(s[0] * s[1] * s[2])


class Model:
    def __init__(self, name, generator='glbkit 1.0 — Azar Asset Pipeline'):
        self.name = name
        self.generator = generator
        self.parts = []
        self.points = {}

    def part(self, name, translation=(0, 0, 0), rotation=(0, 0, 0)):
        p = Part(name, translation, rotation)
        self.parts.append(p)
        return p

    def point(self, name, at):
        self.points[name] = tuple(float(v) for v in at)
        return self

    def bbox(self):
        mn = np.full(3, np.inf); mx = np.full(3, -np.inf)
        for p in self.parts:
            P = np.asarray(p.geo.pos, dtype=np.float64)
            R = _rotmat(*p.rotation)
            P = P @ R.T + np.asarray(p.translation, dtype=np.float64)
            if len(P) == 0:
                continue
            mn = np.minimum(mn, P.min(axis=0)); mx = np.maximum(mx, P.max(axis=0))
        return mn, mx

    def height(self):
        mn, mx = self.bbox()
        return float(mx[1] - mn[1])

    def tris(self):
        return sum(len(p.geo.idx) // 3 for p in self.parts)

    # ------------------ GLB ------------------

    def save(self, path):
        mats_by_key: dict[int, dict] = {}
        mat_index: dict[int, int] = {}

        def mat_json(m: Mat) -> dict:
            r, g, b = [int(m.color[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
            j = {
                "name": m.name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [r, g, b, m.alpha],
                    "metallicFactor": m.metallic,
                    "roughnessFactor": m.roughness,
                },
            }
            if m.emissive:
                er, eg, eb = [int(m.emissive[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
                j["emissiveFactor"] = [min(1.0, er * m.emissive_k), min(1.0, eg * m.emissive_k), min(1.0, eb * m.emissive_k)]
            if m.alpha < 1.0:
                j["alphaMode"] = "BLEND"
            if m.double_sided:
                j["doubleSided"] = True
            return j

        def mi(m: Mat) -> int:
            k = (m.name, m.color, m.metallic, m.roughness, m.emissive, m.emissive_k, m.alpha, m.double_sided)
            if k not in mat_index:
                mats_by_key[k] = mat_json(m)
                mat_index[k] = len(mat_index)
            return mat_index[k]

        views = []
        accessors = []
        meshes = []
        nodes = []
        binary = bytearray()
        offset = 0

        def add_view(data: bytes, target=None) -> int:
            nonlocal offset
            start = offset
            binary.extend(data)
            offset += len(data)
            while offset % 4:
                binary.append(0)
                offset += 1
            v = {"buffer": 0, "byteOffset": start, "byteLength": len(data)}
            if target:
                v["target"] = target
            views.append(v)
            return len(views) - 1

        def emit_geo(geo: Geo):
            """هندسهٔ یک Part → primitives (هر بلوک یک Primitive)"""
            # ادغام بلوک‌های هم‌متریال برای کاهش primitive
            merged: dict[int, list[int]] = {}
            order = []
            for start, count, m in geo.blocks:
                k = mi(m)
                if k not in merged:
                    merged[k] = []
                    order.append(k)
                merged[k].extend(geo.idx[start:start + count])
            pos_arr = np.asarray(geo.pos, dtype=np.float32)
            nrm_arr = np.asarray(geo.nrm, dtype=np.float32)
            pv = add_view(pos_arr.tobytes(), 34962)
            nv = add_view(nrm_arr.tobytes(), 34962)
            a_pos = len(accessors)
            accessors.append({"bufferView": pv, "componentType": 5126, "count": len(geo.pos),
                              "type": "VEC3", "min": pos_arr.min(axis=0).tolist(), "max": pos_arr.max(axis=0).tolist()})
            a_nrm = len(accessors)
            accessors.append({"bufferView": nv, "componentType": 5126, "count": len(geo.nrm), "type": "VEC3"})
            prims = []
            for k in order:
                arr = np.asarray(merged[k], dtype=np.uint32)
                iv = add_view(arr.tobytes(), 34963)
                a_idx = len(accessors)
                accessors.append({"bufferView": iv, "componentType": 5125, "count": len(merged[k]), "type": "SCALAR"})
                prims.append({"attributes": {"POSITION": a_pos, "NORMAL": a_nrm}, "indices": a_idx, "material": k})
            return prims

        # نود ریشه
        root_id = 0
        nodes.append({"name": self.name, "children": []})

        for p in self.parts:
            if not p.geo.pos:
                continue
            prims = emit_geo(p.geo)
            mesh_id = len(meshes)
            meshes.append({"name": p.name, "primitives": prims})
            node = {"name": p.name, "mesh": mesh_id}
            if p.translation != (0, 0, 0):
                node["translation"] = list(p.translation)
            if p.rotation != (0, 0, 0):
                node["rotation"] = list(euler_to_quat(p.rotation))
            nodes.append(node)
            nodes[root_id]["children"].append(len(nodes) - 1)

        # نقاط VFX — نود خالی
        for name, at in self.points.items():
            nodes.append({"name": name, "translation": list(at)})
            nodes[root_id]["children"].append(len(nodes) - 1)

        scenes = [{"nodes": [root_id]}]
        gltf = {
            "asset": {"version": "2.0", "generator": self.generator},
            "scene": 0,
            "scenes": scenes,
            "nodes": nodes,
            "meshes": meshes,
            "materials": list(mats_by_key.values()),
            "accessors": accessors,
            "bufferViews": views,
            "buffers": [{"byteLength": offset}],
        }

        json_b = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(json_b) % 4:
            json_b += b" "
        while len(binary) % 4:
            binary.append(0)
        total = 12 + 8 + len(json_b) + 8 + len(binary)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(json_b), 0x4E4F534A))
            f.write(json_b)
            f.write(struct.pack("<II", len(binary), 0x004E4942))
            f.write(binary)
        return path


def euler_to_quat(rot):
    """اویلر XYZ درجه → کواترنیون — بدون وابستگی"""
    ax, ay, az = [math.radians(v) / 2 for v in rot]
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    # ترتیب XYZ: q = qx * qy * qz
    x = cx * sy * sz + sx * cy * cz
    y = cx * sy * cz - sx * cy * sz
    z = cx * cy * sz + sx * sy * cz
    w = cx * cy * cz - sx * sy * sz
    return (x, y, z, w)
