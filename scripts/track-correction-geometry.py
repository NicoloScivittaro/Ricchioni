"""Rebuild Sydney's local wall triangles from the visible source, at game scale.
Run track-correction-probes.ts first. No hidden collision-helper geometry is used.
"""
import json,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/track-corrections'
d=np.load(root/'docs/agent-work/sydney-sprint/analysis-meshes.npz')
meta=json.loads((out/'sydney-meshes.json').read_text());probes=json.loads((out/'sydney-probes.json').read_text())
cells={}
for p in probes:
 x,z=np.floor(np.array(p['p'])[[0,2]]/8).astype(int)
 radius=int(np.ceil((26 if p["air"] else p["w"]/2+3)/8))
 for dx in range(-radius,radius+1):
  for dz in range(-radius,radius+1):
   key=(x+dx,z+dz);lo,hi=cells.get(key,(float("inf"),-float("inf")));cells[key]=(min(lo,p["p"][1]-4),max(hi,p["p"][1]+4))
result=[];seen=set()
for m in meta:
 if m['id']in[4,28,38,39]:continue
 tri=d['p'+str(m['id'])][d['i'+str(m['id'])]]*.65
 normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(normal,axis=1)
 tri=tri[(length>1e-7)&(abs(normal[:,1])<.65*length)]
 for t in tri:
  lo=np.floor(t[:,[0,2]].min(0)/8).astype(int);hi=np.floor(t[:,[0,2]].max(0)/8).astype(int)
  if not any((x,z)in cells and t[:,1].max()>=cells[(x,z)][0] and t[:,1].min()<=cells[(x,z)][1] for x in range(lo[0],hi[0]+1)for z in range(lo[1],hi[1]+1)):continue
  a=np.round(t,4).tolist();key=tuple(sorted(tuple(v)for v in a))
  if key in seen:continue
  seen.add(key);result.append(sum(a,[]))
p=root/'src/minigames/kart-race/sydneyCollision.json';p.write_text(json.dumps({'segments':[],'triangles':result,'barriers':[],'floor':[-600,-600,600,600]},separators=(',',':'))+'\n')
print(json.dumps({'triangles':len(result),'bytes':p.stat().st_size}))
