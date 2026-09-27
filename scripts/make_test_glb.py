#!/usr/bin/env python3
# ============================================================
# ساخت GLB آزمایشی موقت برای Smoke-Test خط لوله Asset
# ⚠️ این فایل یک «Asset بازی» نیست — فقط برای اثبات صحت
# Loader / Swap-in / AnimationMixer / VFX Points ساخته می‌شود
# و بعد از تست حذف خواهد شد.
# شامل: باکس با متریال PBR + نود WeaponPoint + کلیپ Idle (چرخش)
# ============================================================
import json
import struct
import os

OUT = "/home/z/my-project/scripts/test_arman.glb"

# ---------- باکس با نرمال‌های تخت ----------
def box_geometry(h=0.5):
    faces = [
        # (normal, 4 corners)
        ((0, 0, 1), [(-h, -h, h), (h, -h, h), (h, h, h), (-h, h, h)]),
        ((0, 0, -1), [(h, -h, -h), (-h, -h, -h), (-h, h, -h), (h, h, -h)]),
        ((1, 0, 0), [(h, -h, h), (h, -h, -h), (h, h, -h), (h, h, h)]),
        ((-1, 0, 0), [(-h, -h, -h), (-h, -h, h), (-h, h, h), (-h, h, -h)]),
        ((0, 1, 0), [(-h, h, h), (h, h, h), (h, h, -h), (-h, h, -h)]),
        ((0, -1, 0), [(-h, -h, -h), (h, -h, -h), (h, -h, h), (-h, -h, h)]),
    ]
    positions, normals, indices = [], [], []
    for n, corners in faces:
        base = len(positions)
        for c in corners:
            positions.extend(c)
            normals.extend(n)
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return positions, normals, indices

positions, normals, indices = box_geometry(0.5)
# ارتفاع مدل = 1.0 — normalizeModel باید به 1.85 برساند

positions_b = struct.pack(f"<{len(positions)}f", *positions)
normals_b = struct.pack(f"<{len(normals)}f", *normals)
indices_b = struct.pack(f"<{len(indices)}H", *indices)

# ---------- انیمیشن Idle — نوسان چرخش Y ----------
anim_times = [0.0, 1.0, 2.0]
import math
def quat_y(deg):
    a = math.radians(deg) / 2
    return (0.0, math.sin(a), 0.0, math.cos(a))
anim_rots = quat_y(0) + quat_y(35) + quat_y(0)  # 3×(x,y,z,w)

times_b = struct.pack("<3f", *anim_times)
rots_b = struct.pack("<12f", *anim_rots)

# ---------- چیدمان بافر (۴-بایت‌هم‌تراز) ----------
def pad(b):
    while len(b) % 4:
        b += b"\x00"
    return b

offset = 0
views = []
def add_view(data, target=None):
    global offset, views
    data = pad(data)
    v = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
    if target is not None:
        v["target"] = target
    views.append(v)
    offset += len(data)
    return len(views) - 1, data

POS_VIEW, d1 = add_view(positions_b, 34962)
NRM_VIEW, d2 = add_view(normals_b, 34962)
IDX_VIEW, d3 = add_view(indices_b, 34963)
TIM_VIEW, d4 = add_view(times_b)
ROT_VIEW, d5 = add_view(rots_b)
binary = d1 + d2 + d3 + d4 + d5

gltf = {
    "asset": {"version": "2.0", "generator": "smoke-test (temporary, not a game asset)"},
    "scene": 0,
    "scenes": [{"nodes": [0]}],
    "nodes": [
        {"name": "TestRoot", "mesh": 0, "children": [1, 2]},
        {"name": "WeaponPoint", "translation": [0.0, 0.6, 0.9]},
        {"name": "SpinPart", "mesh": 1},
    ],
    "meshes": [
        {
            "name": "TestBody",
            "primitives": [
                {"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}
            ],
        },
        {
            "name": "TestOrb",
            "primitives": [
                {"attributes": {"POSITION": 3, "NORMAL": 4}, "indices": 5, "material": 1}
            ],
        },
    ],
    "materials": [
        {
            "name": "DarkMetal",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.24, 0.27, 0.31, 1.0],
                "metallicFactor": 0.85,
                "roughnessFactor": 0.4,
            },
        },
        {
            "name": "AmberGlow",
            "pbrMetallicRoughness": {
                "baseColorFactor": [1.0, 0.69, 0.12, 1.0],
                "metallicFactor": 0.1,
                "roughnessFactor": 0.3,
            },
            "emissiveFactor": [0.9, 0.55, 0.05],
        },
    ],
    "accessors": [
        {  # 0 positions body
            "bufferView": POS_VIEW, "componentType": 5126, "count": len(positions) // 3,
            "type": "VEC3", "min": [-0.5, -0.5, -0.5], "max": [0.5, 0.5, 0.5],
        },
        {  # 1 normals body
            "bufferView": NRM_VIEW, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3",
        },
        {  # 2 indices body
            "bufferView": IDX_VIEW, "componentType": 5123, "count": len(indices), "type": "SCALAR",
        },
        {  # 3 positions orb (same geometry)
            "bufferView": POS_VIEW, "componentType": 5126, "count": len(positions) // 3,
            "type": "VEC3", "min": [-0.5, -0.5, -0.5], "max": [0.5, 0.5, 0.5],
        },
        {  # 4 normals orb
            "bufferView": NRM_VIEW, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3",
        },
        {  # 5 indices orb
            "bufferView": IDX_VIEW, "componentType": 5123, "count": len(indices), "type": "SCALAR",
        },
        {  # 6 anim times
            "bufferView": TIM_VIEW, "componentType": 5126, "count": 3,
            "type": "SCALAR", "min": [0.0], "max": [2.0],
        },
        {  # 7 anim rotations
            "bufferView": ROT_VIEW, "componentType": 5126, "count": 3, "type": "VEC4",
        },
    ],
    "animations": [
        {
            "name": "Idle",
            "samplers": [{"input": 6, "output": 7, "interpolation": "LINEAR"}],
            "channels": [{"sampler": 0, "target": {"node": 2, "path": "rotation"}}],
        }
    ],
    "buffers": [{"byteLength": len(binary)}],
    "bufferViews": views,
}

json_b = json.dumps(gltf, separators=(",", ":")).encode()
while len(json_b) % 4:
    json_b += b" "
while len(binary) % 4:
    binary += b"\x00"

total = 12 + 8 + len(json_b) + 8 + len(binary)
with open(OUT, "wb") as f:
    f.write(struct.pack("<III", 0x46546C67, 2, total))
    f.write(struct.pack("<II", len(json_b), 0x4E4F534A))
    f.write(json_b)
    f.write(struct.pack("<II", len(binary), 0x004E4942))
    f.write(binary)

print(f"OK → {OUT} ({os.path.getsize(OUT)} bytes)")
