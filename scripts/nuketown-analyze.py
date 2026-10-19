"""Survey original GLB. Bake source transforms once; generate gameplay-only data."""
from pathlib import Path
import json, struct, numpy as np

root = Path(__file__).resolve().parents[1]
source = root/'public/assets/fps/nuketown_from_call_of_duty_cod_warzonecodm.glb'
if not source.exists(): source = Path.home()/'Downloads/nuketown_from_call_of_duty_cod_warzonecodm.glb'
blob = source.read_bytes(); length = struct.unpack_from('<I', blob, 12)[0]
gltf = json.loads(blob[20:20+length]); binary = blob[28+length:]
def accessor(index):
    a=gltf['accessors'][index]; v=gltf['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]; item=np.dtype(dtype).itemsize
    return np.ndarray((a['count'],size), dtype=dtype, buffer=binary,
        offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',size*item),item)).copy()
triangles=[]; boxes=[]
def visit(index, parent):
    node=gltf['nodes'][index]
    world=parent@np.array(node.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T
    if 'mesh' in node:
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            p=accessor(primitive['attributes']['POSITION'])
            p=(np.c_[p,np.ones(len(p))]@world.T)[:,:3]*.025
            p[:,0]-=.75; p[:,1]+=.018
            t=p[accessor(primitive['indices']).reshape(-1,3)]
            triangles.extend(t.reshape(-1,9).round(5).tolist())
            lo=p.min(0);hi=p.max(0)
            # Ground locomotion only. Upper floors/roofs are still in exact shot geometry.
            if lo[1]<1.8 and hi[1]>.32:
                boxes.append([*(lo.round(4)),*(hi.round(4))])
    for child in node.get('children',[]): visit(child,world)
visit(0,np.eye(4))
# Merge adjacent/intersecting boxes with identical other axes. Player clearance
# cannot pass the tiny gaps of the outer picket fence; bullets retain those gaps.
for axis in [0,2,1,0,2]:
    changed=True
    while changed:
        changed=False
        for i,a in enumerate(boxes):
            for k in range(i+1,len(boxes)):
                b=boxes[k]; others=[v for v in range(3) if v!=axis]
                if all(abs(a[v]-b[v])<.006 and abs(a[v+3]-b[v+3])<.006 for v in others) and max(a[axis],b[axis])<=min(a[axis+3],b[axis+3])+.006:
                    a[axis]=min(a[axis],b[axis]);a[axis+3]=max(a[axis+3],b[axis+3]);boxes.pop(k);changed=True;break
            if changed:break
out=root/'src/minigames/fps/nuketownGeometry.json'
out.write_text(json.dumps({'scale':.025,'offset':[-.75,.018,0],'triangles':triangles,'movementBoxes':boxes},separators=(',',':')),encoding='utf8')
report={'sourceBytes':len(blob),'meshes':len(gltf['meshes']),'nodes':len(gltf['nodes']),'materials':len(gltf['materials']),'images':len(gltf.get('images',[])),'triangles':len(triangles),'movementBoxes':len(boxes),'bounds':np.array(triangles).reshape(-1,3).min(0).tolist()+np.array(triangles).reshape(-1,3).max(0).tolist(),'asset':gltf['asset']}
(root/'docs/agent-work/nuketown/model.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='asset'}))
