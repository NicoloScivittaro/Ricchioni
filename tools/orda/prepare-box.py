"""Keep both authored Mystery Box variants; bake static transforms and cap textures."""
from pathlib import Path
import sys,json,copy,hashlib,io
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'monsters'))
from gltf import load,save,accessor,add,globalize,parents,trs
root=Path(__file__).resolve().parents[2];source=Path.home()/'Downloads/call_of_duty_black_ops_mystery_box.glb';g,b=load(source);world=globalize([trs(n)for n in g['nodes']],parents(g));dest=root/'public/assets/orda';dest.mkdir(exist_ok=True,parents=True)
variants={'closed':[],'open':[]};parts=[]
for i,node in enumerate(g['nodes']):
 if 'mesh'not in node:continue
 mesh=copy.deepcopy(g['meshes'][node['mesh']]);m=world[i]
 for p in mesh['primitives']:
  v=accessor(g,b,p['attributes']['POSITION']);v=(m@np.c_[v,np.ones(len(v))].T).T[:,:3];group='closed'if v[:,0].mean()<0 else'open';parts.append((mesh,p,v,m,group))
boxes={}
for group in variants:
 v=np.concatenate([v for _,_,v,_,kind in parts if kind==group]);lo=v.min(axis=0);hi=v.max(axis=0);boxes[group]={'center':(lo[0]+hi[0])/2,'base':lo[1],'scale':2.2/(hi[0]-lo[0])}
nodes=[];meshes=[]
for mesh,p,v,m,group in parts:
 cfg=boxes[group];v=(v-np.array([cfg['center'],cfg['base'],0]))*cfg['scale'];index=add(g,b,v,'VEC3');g['accessors'][index].update(min=v.min(axis=0).tolist(),max=v.max(axis=0).tolist());p['attributes']['POSITION']=index
 if 'NORMAL'in p['attributes']:
  n=accessor(g,b,p['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3]);n/=np.linalg.norm(n,axis=1)[:,None];p['attributes']['NORMAL']=add(g,b,n,'VEC3')
 meshes.append(mesh);nodes.append({'name':f'MysteryBox_{group}_{len(meshes)}','mesh':len(meshes)-1});variants[group].append(len(nodes)-1)
g['meshes']=meshes;g['nodes']=nodes;roots=[]
for group,children in variants.items():roots.append(len(nodes));nodes.append({'name':group,'children':children})
g['scenes']=[{'nodes':roots}];g['scene']=0
colors=set()
for m in g['materials']:
 t=m.get('pbrMetallicRoughness',{}).get('baseColorTexture');
 if t:colors.add(g['textures'][t['index']]['source'])
for i,image in enumerate(g['images']):
 v=g['bufferViews'][image['bufferView']];raw=bytes(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);im=Image.open(io.BytesIO(raw));limit=1024 if i in colors else 512;size=im.size;im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
 if im.size==size:continue
 output=io.BytesIO();jpeg=image['mimeType']=='image/jpeg';im.save(output,format='JPEG'if jpeg else'PNG',**({'quality':92,'optimize':True}if jpeg else{'optimize':True}));raw=output.getvalue();b+=b'\0'*((-len(b))%4);g['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(raw)});b+=raw;image['bufferView']=len(g['bufferViews'])-1
used=sorted(set(a['bufferView']for a in g['accessors'])|set(i['bufferView']for i in g['images']));new=bytearray();views=[];mapping={}
for i in used:
 v=copy.deepcopy(g['bufferViews'][i]);start=v.get('byteOffset',0);new+=b'\0'*((-len(new))%4);v['byteOffset']=len(new);new+=b[start:start+v['byteLength']];mapping[i]=len(views);views.append(v)
g['bufferViews']=views
for a in g['accessors']:a['bufferView']=mapping[a['bufferView']]
for i in g['images']:i['bufferView']=mapping[i['bufferView']]
g['extras']={'sourceFilename':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'variants':'original closed/open geometry, rebased to common center; no source animation clips','width':2.2}
save(dest/'mystery-box.glb',g,new)
(dest/'CREDITS.md').write_text('''# Mystery Box

Call of Duty: Black Ops: Mystery Box — **Navillus360**.
[Original model](https://sketchfab.com/3d-models/call-of-duty-black-ops-mystery-box-f9561f9ec3b64b038c66ebb98ce9a3d6), [author](https://sketchfab.com/Navillus360), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

User-supplied original unchanged. Derived GLB keeps both original closed/open variants and materials, normalizes each to 2.2 metres, bakes static transforms, caps color textures at 1024 and other maps at 512. No authored animations in the source; opening states use its original geometry variants.
''',encoding='utf8')
report={'sourceSha256':g['extras']['sourceSha256'],'bytes':(dest/'mystery-box.glb').stat().st_size,'sourceBytes':source.stat().st_size,'meshes':len(meshes),'textures':len(g['images']),'variants':variants,'license':g['asset']['extras']}
(root/'docs/agent-work/orda-zombies/asset.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
