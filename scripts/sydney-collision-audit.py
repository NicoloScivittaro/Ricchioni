"""Sweep body-height rays along the runtime route against every visible source
triangle, rather than only checking that some road exists underneath it."""
import json, numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'docs/agent-work/track-corrections'
data=np.load(root/'docs/agent-work/sydney-sprint/analysis-meshes.npz');meta=json.loads((out/'sydney-meshes.json').read_text())
tri=[];owners=[]
for m in meta:
    if m['id'] in [4,28,38,39]:continue # water, technical helper, sky, underwater reflection
    t=data['p'+str(m['id'])][data['i'+str(m['id'])]]*.65
    tri.append(t);owners.extend([m['id']]*len(t))
tri=np.concatenate(tri);owners=np.array(owners);a=tri[:,0];e1=tri[:,1]-a;e2=tri[:,2]-a
grid={}
for i,t in enumerate(tri):
    lo=np.floor(t[:,[0,2]].min(0)/12).astype(int);hi=np.floor(t[:,[0,2]].max(0)/12).astype(int)
    for x in range(lo[0],hi[0]+1):
        for z in range(lo[1],hi[1]+1):grid.setdefault((x,z),[]).append(i)
probes=json.loads((out/'sydney-probes.json').read_text());hits=[]
for i,p in enumerate(probes):
    q=probes[(i+1)%len(probes)];start=np.array(p['p']);end=np.array(q['p']);start[1]+=p['height'];end[1]+=q['height']
    for lateral in [0,-.85,.85]:
      for height in [.45,1.25,1.9]:
        origin=start+np.array(p['r'])*lateral+np.array([0,height,0]);target=end+np.array(q['r'])*lateral+np.array([0,height,0]);v=target-origin;length=np.linalg.norm(v)
        if length<1e-6:continue
        ii=set()
        for x in range(int(np.floor(min(origin[0],target[0])/12)),int(np.floor(max(origin[0],target[0])/12))+1):
          for z in range(int(np.floor(min(origin[2],target[2])/12)),int(np.floor(max(origin[2],target[2])/12))+1):ii.update(grid.get((x,z),[]))
        if not ii:continue
        ii=np.array(list(ii));direction=v/length;pv=np.cross(direction,e2[ii]);det=np.einsum('ij,ij->i',e1[ii],pv);ok=abs(det)>1e-8;inv=1/np.where(ok,det,1);tv=origin-a[ii];u=np.einsum('ij,ij->i',tv,pv)*inv;qv=np.cross(tv,e1[ii]);vv=qv@direction*inv;distance=np.einsum('ij,ij->i',e2[ii],qv)*inv
        ok&=(u>=-1e-5)&(vv>=-1e-5)&(u+vv<=1.00001)&(distance>=0)&(distance<length)
        for index in ii[ok]:hits.append({'s':p['s'],'mesh':int(owners[index]),'lateral':lateral,'height':height,'point':start.tolist(),'air':p['air']})
groups=[]
for mesh in sorted(set(h['mesh']for h in hits)):
    rows=sorted([h for h in hits if h['mesh']==mesh],key=lambda h:h['s']);current=[]
    for h in rows:
        if current and h['s']-current[-1]['s']>3:groups.append({'mesh':mesh,'name':meta[mesh]['name'],'start':current[0]['s'],'end':current[-1]['s'],'hits':current});current=[]
        current.append(h)
    if current:groups.append({'mesh':mesh,'name':meta[mesh]['name'],'start':current[0]['s'],'end':current[-1]['s'],'hits':current})
report={'probes':len(probes),'bodyRays':len(probes)*9,'groups':groups}
(out/'sydney-wall-audit.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps([{k:v for k,v in g.items() if k!='hits'} for g in groups]))
