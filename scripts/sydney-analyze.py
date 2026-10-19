"""Read the supplied asset without a DCC roundtrip. Raw FBX coordinates are Y-up.
The two glTF parent matrices combine to a uniform 0.01 scale.
"""
import struct, json, pathlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/agent-work/sydney-sprint'
OUT.mkdir(parents=True, exist_ok=True)
b = pathlib.Path(r'C:/Users/niluf.PC-NIKO/Downloads/sydney_sprint.glb').read_bytes()
n = struct.unpack_from('<I', b, 12)[0]
g = json.loads(b[20:20+n]); binary = b[28+n:]
def accessor(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    dtype = {5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    size = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    return np.frombuffer(binary, dtype=dtype, count=a['count']*size,
                         offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,size)
meshes = []
for node in g['nodes']:
    if 'mesh' not in node: continue
    for p in g['meshes'][node['mesh']]['primitives']:
        pos = accessor(p['attributes']['POSITION']); idx = accessor(p['indices']).reshape(-1,3)
        meshes.append((node['name'],p['material'],pos,idx))
        if node['name'].startswith(('N_Road','N_Operahouse_M_Mobs1_Road','ShadowCollision')):
            print(node['name'], 'bounds', pos.min(0),pos.max(0),'triangles',len(idx))
def pixel(x,z): return (int((x+850)*1.65+30), int((z+840)*1.65+30))
for kind in ['roads','city','collision']:
    im = Image.new('RGB',(2150,2100),'#17222b'); d = ImageDraw.Draw(im)
    for name, mat, pos, idx in meshes:
        if kind=='roads' and not (name.startswith(('N_Road','N_Operahouse_M_Mobs1_Road')) and mat in [2,7,9]):continue
        if kind=='collision' and 'ShadowCollision' not in name:continue
        if kind=='city' and mat in [10,12]:continue
        color = ['#708090','#526769','#c0b5a0','#6983a0','#1e697b','#eaca72','#faca33','#c6c8ce','#9bbb92','#9ca5aa','#d46a55','#d4968c','#3a6679','#388765','#caa588'][mat]
        for face in idx:
            pts=pos[face]; norm=np.cross(pts[1]-pts[0],pts[2]-pts[0]);
            if kind in ['roads','collision'] and abs(norm[1])<np.linalg.norm(norm)*.65:continue
            d.polygon([pixel(v[0],v[2]) for v in pts],fill=color)
    for x in range(-800,401,50):
        for z in range(-800,401,50):
            px,py=pixel(x,z);d.ellipse((px-1,py-1,px+1,py+1),fill='#ee6871');d.text((px+3,py+2),f'{x},{z}',fill='white')
    im.save(OUT/f'analysis-{kind}.png')
summary={'asset':g['asset'],'meshes':len(meshes),'triangles':sum(len(i) for _,_,_,i in meshes),'materials':len(g['materials']),'images':len(g.get('images',[])),'nodesWithTransforms':[{k:n[k] for k in ['name','matrix','translation','rotation','scale'] if k in n} for n in g['nodes'] if any(k in n for k in ['matrix','translation','rotation','scale'])]}
(OUT/'asset-analysis.json').write_text(json.dumps(summary,indent=2))
np.savez(OUT/'analysis-meshes.npz',**{f'p{i}':p for i,(_,_,p,_) in enumerate(meshes)},**{f'i{i}':idx for i,(_,_,_,idx) in enumerate(meshes)})
