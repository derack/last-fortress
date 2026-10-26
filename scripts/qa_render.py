"""qa_render.py — رندر دو نمای +Z/-Z از مدل‌های نصب‌شده با رنگ‌های vertex برای QA."""
import struct, json, sys, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

def load_glb(path):
    with open(path, 'rb') as f:
        f.seek(12)
        clen, = struct.unpack('<I', f.read(4)); f.read(4)
        j = json.loads(f.read(clen))
        blen, = struct.unpack('<I', f.read(4)); f.read(4)
        blob = f.read(blen)
    prim = j['meshes'][0]['primitives'][0]
    acc = j['accessors']; bv = j['bufferViews']
    def read_attr(idx):
        a = acc[idx]; v = bv[a['bufferView']]
        off = (v.get('byteOffset',0)) + a.get('byteOffset',0)
        comp = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        types = {5126:'f4',5123:'u2',5125:'u4',5121:'u1'}
        dt = np.dtype(types[a['componentType']]).newbyteorder('<')
        arr = np.frombuffer(blob, dtype=dt, count=a['count']*comp, offset=off)
        return arr.reshape(a['count'], comp)
    pos = read_attr(prim['attributes']['POSITION']).astype(np.float64)
    idx = read_attr(prim['indices']).reshape(-1)
    colors = None
    if 'COLOR_0' in prim['attributes']:
        c = read_attr(prim['attributes']['COLOR_0']).astype(np.float64)
        if c.max() > 1.5: c = c / 255.0
        if c.shape[1] == 3: c = np.hstack([c, np.ones((len(c),1))])
        colors = c
    return pos, idx, colors, j

def render(cid, out_png):
    pos, idx, colors, j = load_glb(f'public/assets/3d/rigged/{cid}.glb')
    # glTF (x,Y-up,z-front) → mpl (x, y=z, Z-up=y): یعنی «جلو» = نگاه از +Y‌ در mpl
    P = np.stack([pos[:,0], pos[:,2], pos[:,1]], axis=1)
    tri = P[idx.reshape(-1,3)]
    if colors is not None:
        fc = colors[idx.reshape(-1,3), :3].mean(axis=1)
    else:
        fc = np.full((len(tri),3), 0.6)
    # شیدینگ لمبرت ساده برای شبیه‌سازی نور موتور
    v1 = tri[:,1]-tri[:,0]; v2 = tri[:,2]-tri[:,0]
    n = np.cross(v1, v2)
    nl = np.linalg.norm(n, axis=1, keepdims=True); n = n/np.maximum(nl,1e-9)
    L1 = np.array([0.4, 0.8, 0.45]); L1 = L1/np.linalg.norm(L1)
    L2 = np.array([-0.5, 0.2, -0.6]); L2 = L2/np.linalg.norm(L2)
    lam = np.abs(n@L1)*0.75 + np.abs(n@L2)*0.35 + 0.42
    fc = np.clip(fc * lam[:,None], 0, 1)
    fig = plt.figure(figsize=(9, 5.2), constrained_layout=True)
    fig.patch.set_facecolor('#1a2433')
    for k, (azim, title) in enumerate([(90, 'FRONT (+Z glTF)'), (-90, 'BACK (-Z glTF)')]):
        ax = fig.add_subplot(1, 2, 1 + k, projection='3d')
        ax.set_facecolor('#1a2433')
        pc = Poly3DCollection(tri, linewidths=0)
        pc.set_facecolor(np.clip(fc, 0, 1))
        ax.add_collection3d(pc)
        c = P.mean(axis=0); r = (P.max(axis=0)-P.min(axis=0)).max()*0.55
        ax.set_xlim(c[0]-r, c[0]+r); ax.set_ylim(c[1]-r, c[1]+r); ax.set_zlim(c[2]-r, c[2]+r)
        ax.view_init(elev=4, azim=azim)
        ax.set_box_aspect((1,1,1)); ax.set_axis_off()
        ax.set_title(f'{cid} {title}', color='white', fontsize=10)
    fig.savefig(out_png, dpi=88, facecolor=fig.get_facecolor())
    plt.close(fig)
    print('saved', out_png)

for cid in sys.argv[1:]:
    render(cid, f'scripts/qa_{cid}.png')
