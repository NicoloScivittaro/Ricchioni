"""Supplement body collision from original Terminal prop triangles; no scenery boxes."""
import sys,json,struct
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from prepare_arena import read,access,world
d,b=read();triangles=[];objects={}
# Substantial interactive cover omitted by the original architecture-only export.
include=('furniture_bench','furniture_chair','restaurant_chair','stacking_chair','longseat','rectangular_table','square_table','side_table','kitchentable','boothchair','garbage_bin','industrial_fridge','potted_plant_large','cargo_cage','vehicle_cart_airport','metal_detector','727_cross_section','727_lower_frame','railing_single','bank_divider_pole')
exclude=('glass','foliage','leaf','shadow','decal','effect')
for node in d['nodes']:
    if 'mesh'not in node or not any(s in node.get('name','')for s in include):continue
    count=0
    for p in d['meshes'][node['mesh']]['primitives']:
        material=d['materials'][p['material']]['name'].lower()
        if any(s in material for s in exclude):continue
        vertices=world(d,b,node,p);vertices[:,2]*=-1
        ts=vertices[access(d,b,p['indices']).reshape(-1,3)]
        area=np.linalg.norm(np.cross(ts[:,1]-ts[:,0],ts[:,2]-ts[:,0]),axis=1)*.5
        # Keep thin physical frames too. Discard only degenerate and out-of-map faces.
        lo=ts.min(1);hi=ts.max(1);keep=(area>.0002)&(hi[:,0]>-75)&(lo[:,0]<45)&(hi[:,2]>-78)&(lo[:,2]<64)&(hi[:,1]>-.3)&(lo[:,1]<11)
        triangles.extend(ts[keep]);count+=int(keep.sum())
    if count:objects[node['name']]=objects.get(node['name'],0)+count
t=np.array(triangles,dtype='<f4').reshape(-1,9)
t=np.unique(np.round(t,5),axis=0)
dest=ROOT/'public/assets/fps/terminal/body-props.bin';dest.write_bytes(t.tobytes())
(ROOT/'docs/agent-work/solid-collision-fixes/terminal-props.json').write_text(json.dumps({'source':'terminal.glb','triangleCount':len(t),'bytes':dest.stat().st_size,'objects':objects,'geometry':'Exact original transformed triangles; body collision only, shot rules unchanged'},indent=2))
print('Body props:',len(t),'triangles,',len(objects),'object types,',dest.stat().st_size,'bytes')
