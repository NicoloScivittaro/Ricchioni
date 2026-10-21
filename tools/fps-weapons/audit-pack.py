import sys,json,hashlib,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'monsters'))
from gltf import load,accessor,trs,globalize,parents
import numpy as np
root=Path(__file__).resolve().parents[2];out=root/'docs/agent-work/fps-weapon-pack';out.mkdir(exist_ok=True,parents=True)
files={'acr':'animated_fps_hands_rifle_animation_pack.glb','glock':'glock17.glb','shotgun':'animated_shotgun.glb','ak74u':'ak74u__free_animation..glb'}
report={}
for name,file in files.items():
 p=Path.home()/'Downloads'/file;g,b=load(p);world=globalize([trs(n)for n in g['nodes']],parents(g));clips=[]
 for a in g['animations']:
  times=[accessor(g,b,s['input']).ravel()for s in a['samplers']];moving=[]
  for ch in a['channels']:
   s=a['samplers'][ch['sampler']];v=accessor(g,b,s['output']);t=accessor(g,b,s['input']).ravel();delta=np.max(np.abs(np.diff(v,axis=0)),axis=1);ids=np.where(delta>1e-5)[0]
   if len(ids):moving.extend([float(t[ids[0]]),float(t[ids[-1]+1])])
  clips.append({'name':a['name'],'from':min(float(t.min())for t in times),'to':max(float(t.max())for t in times),'motion':[min(moving),max(moving)]if moving else None})
 meshes=[]
 for i,n in enumerate(g['nodes']):
  if 'mesh'not in n:continue
  bounds=[]
  for pr in g['meshes'][n['mesh']]['primitives']:
   v=accessor(g,b,pr['attributes']['POSITION']);v=(world[i]@np.c_[v,np.ones(len(v))].T).T[:,:3];bounds.extend([v.min(axis=0).tolist(),v.max(axis=0).tolist()])
  meshes.append({'node':i,'name':n['name'],'bounds':[np.min(bounds,axis=0).tolist(),np.max(bounds,axis=0).tolist()]})
 report[name]={'file':file,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'asset':g.get('asset'),'extras':g.get('extras'),'clips':clips,'meshes':meshes,'cameras':[(i,n)for i,n in enumerate(g['nodes'])if 'camera'in n],'nodes':[(i,n.get('name',''))for i,n in enumerate(g['nodes'])if any(k in n.get('name','').lower()for k in ['camera','weapon','gun','mag','sight','muzzle','barrel'])]}
(out/'audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
