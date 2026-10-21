"""Bake supplied static props, batch by material, normalize and cap textures."""
from pathlib import Path
import copy, hashlib, io, json, sys
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'monsters'))
from gltf import load,save,globalize,parents,trs
root=Path(__file__).resolve().parents[2];out=root/'docs/agent-work/orda-perks'
dest=root/'public/assets/orda/perks';dest.mkdir(parents=True,exist_ok=True)
def read(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];size=np.dtype(dtype).itemsize;offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],width),dtype=dtype,buffer=b,offset=offset,strides=(v.get('byteStride',size*width),size)).copy()
def append(g,b,v,kind,index=False):
 v=np.asarray(v,dtype='<u4'if index else'<f4');b+=b'\0'*(-len(b)%4);g['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':v.nbytes});b+=v.tobytes();a={'bufferView':len(g['bufferViews'])-1,'componentType':5125 if index else 5126,'count':len(v),'type':kind}
 if kind=='VEC3':a.update(min=v.min(0).tolist(),max=v.max(0).tolist())
 g['accessors'].append(a);return len(g['accessors'])-1
configs=[('doubletap','double_tap_call_of_duty__black_ops_2_zombies',2.15),('speedcola','speed_cola_machine_-_world_at_war',2.2),('juggernog','minecraft_jugger_nog_perk_machine',2.2),('pap','minecraft_pack_a_punch_machine',1.9),('bottles','cod_zombies_sodas',.27),('wunderwaffe','wundderwaffle_dg2',.92)]
reports=[]
for key,filename,height in configs:
 source=Path.home()/'Downloads'/(filename+'.glb');old,raw=load(source);world=globalize([trs(n)for n in old['nodes']],parents(old));parts=[]
 for i,node in enumerate(old['nodes']):
  if'mesh'not in node:continue
  for p in old['meshes'][node['mesh']]['primitives']:
   m=world[i];v=read(old,raw,p['attributes']['POSITION']);v=(m@np.c_[v,np.ones(len(v))].T).T[:,:3];n=read(old,raw,p['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3]);n/=np.maximum(1e-9,np.linalg.norm(n,axis=1)[:,None]);uv=read(old,raw,p['attributes']['TEXCOORD_0'])if'TEXCOORD_0'in p['attributes']else np.zeros((len(v),2));ind=read(old,raw,p['indices']).ravel()if'indices'in p else np.arange(len(v));ind=ind.reshape(-1,3)
   if np.linalg.det(m[:3,:3])<0:ind=ind[:,[0,2,1]]
   parts.append([p.get('material',0),v,n,uv,ind])
 all_v=np.concatenate([p[1]for p in parts]);lo,hi=all_v.min(0),all_v.max(0);scale=height/(hi[0]-lo[0]if key=='wunderwaffe'else hi[1]-lo[1]);center=np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]);groups={}
 for mat,v,n,uv,ind in parts:
  if key=='bottles':local=np.array([(v[:,0].min()+v[:,0].max())/2,v[:,1].min(),(v[:,2].min()+v[:,2].max())/2]);v=(v-local)*scale
  else:v=(v-center)*scale
  if key=='wunderwaffe':
   # Source barrel points along X; align its long axis to +Z. Rest height matches existing FPS guns.
   rotation=np.array([[0,0,-1],[0,1,0],[1,0,0]]);v=v@rotation.T;n=n@rotation.T;v[:,1]+=.02;v[:,2]+=height*.12
  group=groups.setdefault(mat,[]);group.append((v,n,uv,ind))
 g={'asset':copy.deepcopy(old['asset']),'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[],'materials':copy.deepcopy(old.get('materials',[])),'textures':copy.deepcopy(old.get('textures',[])),'samplers':copy.deepcopy(old.get('samplers',[])),'images':copy.deepcopy(old.get('images',[])),'nodes':[],'meshes':[],'scenes':[{'nodes':[]}],'scene':0};b=bytearray();before=0;after=0
 for mat,rows in groups.items():
  vs=[];ns=[];uvs=[];indices=[];offset=0
  for v,n,uv,ind in rows:vs.append(v);ns.append(n);uvs.append(uv);indices.append(ind+offset);offset+=len(v)
  v=np.concatenate(vs);n=np.concatenate(ns);uv=np.concatenate(uvs);ind=np.concatenate(indices);before+=len(ind)
  if key=='doubletap':
   # Sub-millimetre-to-8mm cluster LOD; UV/normal boundaries stay distinct.
   quant=np.c_[np.round(v/.008),np.round(n*8),np.round(uv*128)];_,first,inverse=np.unique(quant,axis=0,return_index=True,return_inverse=True);v=v[first];n=n[first];uv=uv[first];ind=inverse[ind];ind=ind[(ind[:,0]!=ind[:,1])&(ind[:,1]!=ind[:,2])&(ind[:,0]!=ind[:,2])]
  after+=len(ind);p={'attributes':{'POSITION':append(g,b,v,'VEC3'),'NORMAL':append(g,b,n,'VEC3'),'TEXCOORD_0':append(g,b,uv,'VEC2')},'indices':append(g,b,ind.reshape(-1,1),'SCALAR',True),'material':mat}
  name=({0:'juggernog',1:'doubletap',2:'phd',3:'speedcola',4:'quickrevive'}.get(mat,str(mat))if key=='bottles'else key)
  g['nodes'].append({'name':name,'mesh':len(g['meshes'])});g['meshes'].append({'name':name,'primitives':[p]});g['scenes'][0]['nodes'].append(len(g['nodes'])-1)
 for i,image in enumerate(g['images']):
  view=old['bufferViews'][image['bufferView']];blob=bytes(raw[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);im=Image.open(io.BytesIO(blob));size=im.size;im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  if im.size!=size:
   output=io.BytesIO();jpeg=image['mimeType']=='image/jpeg';im.save(output,format='JPEG'if jpeg else'PNG',**({'quality':92,'optimize':True}if jpeg else{'optimize':True}));blob=output.getvalue()
  b+=b'\0'*(-len(b)%4);g['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(blob)});b+=blob;image['bufferView']=len(g['bufferViews'])-1
 target=root/'public/assets/fps/weapons/wunderwaffe.glb'if key=='wunderwaffe'else dest/(key+'.glb');g['extras']={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'normalizedHeightOrLength':height};save(target,g,b)
 reports.append({'id':key,'source':source.name,'sourceSha256':g['extras']['sourceSha256'],'sourceBytes':source.stat().st_size,'bytes':target.stat().st_size,'path':str(target.relative_to(root)).replace('\\','/'),'trianglesBefore':before,'triangles':after,'meshes':len(g['meshes']),'asset':old['asset']})
(out/'assets.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False),encoding='utf8')
credits='# Orda — supplied Zombies assets\n\n'+''.join(f"- **{r['asset']['extras'].get('title',r['id'])}** — {r['asset']['extras'].get('author','unknown')}; {r['asset']['extras'].get('license','unknown')}. {r['asset']['extras'].get('source','')}\n"for r in reports)+'\nDerived files bake transforms, normalize metres, batch by material and cap texture dimensions at1024. Double Tap has a8mm cluster LOD preserving normal/UV boundaries. Bottles are independently centered and labelled. Wunderwaffe long axis aligned to firing direction. Originals unchanged.\n'
(dest/'CREDITS.md').write_text(credits,encoding='utf8');print(json.dumps([{k:v for k,v in r.items()if k!='asset'}for r in reports]))
