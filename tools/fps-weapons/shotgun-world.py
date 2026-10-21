"""Static, hand-free opponent model from the actual pump/body at Shoot frame zero."""
import sys,copy
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'monsters'))
from gltf import load,save,accessor,add,trs,parents,globalize
root=Path(__file__).resolve().parents[2];g,b=load(root/'public/assets/fps/animated/shotgun.glb');nodes=copy.deepcopy(g['nodes']);a=next(a for a in g['animations']if a['name'].endswith('|Shoot'))
for c in a['channels']:
 s=a['samplers'][c['sampler']];nodes[c['target']['node']][c['target']['path']]=accessor(g,b,s['output'])[0].tolist()
world=globalize([trs(n)for n in nodes],parents(g));ib=accessor(g,b,g['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);meshes=[]
for index,joint in [(3,85),(4,83)]:
 pr=copy.deepcopy(g['meshes'][index]['primitives'][0]);m=world[g['skins'][0]['joints'][joint]]@ib[joint];v=accessor(g,b,pr['attributes']['POSITION']);v=(m@np.c_[v,np.ones(len(v))].T).T[:,:3];n=accessor(g,b,pr['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3]);n/=np.linalg.norm(n,axis=1)[:,None];meshes.append((pr,v,n))
allv=np.concatenate([v for _,v,_ in meshes]);lo=allv.min(axis=0);hi=allv.max(axis=0);scale=.7/(hi[2]-lo[2]);center=np.array([(lo[0]+hi[0])/2,lo[1]-.02/scale,(lo[2]+hi[2])/2]);newmeshes=[]
for pr,v,n in meshes:
 attrs=pr['attributes'];attrs.pop('JOINTS_0',None);attrs.pop('WEIGHTS_0',None);attrs['POSITION']=add(g,b,(v-center)*scale,'VEC3');attrs['NORMAL']=add(g,b,n,'VEC3');newmeshes.append({'primitives':[pr]})
g['meshes']=newmeshes;g['nodes']=[{'name':'Remington body/pump','mesh':i}for i in range(len(newmeshes))];g['scenes']=[{'nodes':list(range(len(newmeshes)))}];g['scene']=0;g.pop('skins',None);g.pop('animations',None)
usedmat=sorted(set(pr['material']for m in g['meshes']for pr in m['primitives']));matmap={x:i for i,x in enumerate(usedmat)};g['materials']=[g['materials'][i]for i in usedmat]
for m in g['meshes']:
 for p in m['primitives']:p['material']=matmap[p['material']]
# Only materials referenced by the actual gun, and only their textures.
texids=set()
def visit(v):
 if isinstance(v,dict):
  for k,x in v.items():
   if k.endswith('Texture')and isinstance(x,dict)and 'index'in x:texids.add(x['index'])
   else:visit(x)
 elif isinstance(v,list):
  for x in v:visit(x)
visit(g['materials']);texids=sorted(texids);texmap={x:i for i,x in enumerate(texids)}
def remap(v):
 if isinstance(v,dict):
  for k,x in v.items():
   if k.endswith('Texture')and isinstance(x,dict)and 'index'in x:x['index']=texmap[x['index']]
   else:remap(x)
 elif isinstance(v,list):
  for x in v:remap(x)
remap(g['materials']);g['textures']=[g['textures'][i]for i in texids];images=sorted(set(t['source']for t in g['textures']));immap={x:i for i,x in enumerate(images)};g['images']=[g['images'][i]for i in images]
for t in g['textures']:t['source']=immap[t['source']]
ids=sorted(set(i for m in g['meshes']for p in m['primitives']for i in [p['indices'],*p['attributes'].values()]));amap={x:i for i,x in enumerate(ids)};g['accessors']=[g['accessors'][i]for i in ids]
for m in g['meshes']:
 for p in m['primitives']:p['indices']=amap[p['indices']];p['attributes']={k:amap[i]for k,i in p['attributes'].items()}
views=sorted(set(a['bufferView']for a in g['accessors'])|set(i['bufferView']for i in g['images']));vmap={x:i for i,x in enumerate(views)};new=bytearray();newviews=[]
for i in views:
 v=copy.deepcopy(g['bufferViews'][i]);start=v.get('byteOffset',0);new+=b'\0'*((-len(new))%4);v['byteOffset']=len(new);new+=b[start:start+v['byteLength']];newviews.append(v)
g['bufferViews']=newviews
for a in g['accessors']:a['bufferView']=vmap[a['bufferView']]
for i in g['images']:i['bufferView']=vmap[i['bufferView']]
for mesh in g['meshes']:
 for pr in mesh['primitives']:
  a=g['accessors'][pr['attributes']['POSITION']];v=accessor(g,new,pr['attributes']['POSITION']);a['min']=v.min(axis=0).tolist();a['max']=v.max(axis=0).tolist()
save(root/'public/assets/fps/weapons/pack-shotgun.glb',g,new)
