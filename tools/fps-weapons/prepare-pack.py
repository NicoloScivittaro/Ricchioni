"""Preserve authored rigs/clips; normalize author camera and cap embedded textures at 1024."""
import sys,json,io,copy,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'monsters'))
from gltf import load,save,trs,add,accessor,rotation
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parents[2];out=root/'public/assets/fps/animated';out.mkdir(parents=True,exist_ok=True)
audit=json.loads((root/'docs/agent-work/fps-weapon-pack/audit.json').read_text())
(root/'shared/fpsClips.json').write_text(json.dumps({name:{c['name'].split('|')[-1]:{'from':c['from'],'seconds':c['to']-c['from']}for c in row['clips']}for name,row in audit.items()},indent=2))
profiles={'acr':(1,[0,.2158354,0],False),'glock':(1,[.01292725,1.529892,-.11],False),'shotgun':(.025,[0,34,0],False),'ak74u':(1,[.081,1.542,-.332],True)}
for name in sys.argv[1:]:
 info=audit[name];g,b=load(Path.home()/'Downloads'/info['file']);scale,camera,flip=profiles[name];m=np.eye(4);m[:3,:3]=np.diag([-scale if flip else scale,scale,-scale if flip else scale]);m[:3,3]=-m[:3,:3]@camera
 if name=='acr':
  # Original export has six corrupt magazine influences (huge negative weights).
  # This is a rigid magazine: all remaining 1152 vertices identify Pmag joint 79.
  pr=g['meshes'][4]['primitives'][0];count=g['accessors'][pr['attributes']['POSITION']]['count'];weights=np.zeros((count,4));weights[:,0]=1;pr['attributes']['WEIGHTS_0']=add(g,b,weights,'VEC4')
  joints=np.zeros((count,4),dtype='<u2');joints[:,0]=79;b+=b'\0'*((-len(b))%4);g['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':joints.nbytes});b+=joints.tobytes();g['accessors'].append({'bufferView':len(g['bufferViews'])-1,'componentType':5123,'count':count,'type':'VEC4'});pr['attributes']['JOINTS_0']=len(g['accessors'])-1
 if name=='shotgun':
  # Export baked the three rigid gun meshes in centimetres while the skin's
  # inverse binds and hand vertices are already metres (100x discrepancy).
  for index in [3,4]:
   pr=g['meshes'][index]['primitives'][0];a=pr['attributes']['POSITION'];pr['attributes']['POSITION']=add(g,b,accessor(g,b,a)*.01,'VEC3')
  # Shell was exported away from its bind bone. Recover the original shell
  # shape around the authored Shell joint; its animation still owns movement.
  pr=g['meshes'][5]['primitives'][0];v=accessor(g,b,pr['attributes']['POSITION']);center=(v.min(axis=0)+v.max(axis=0))/2;bind=np.linalg.inv(accessor(g,b,g['skins'][0]['inverseBindMatrices'])[87].reshape(4,4).T);r=rotation(bind);axis=np.array([[1,0,0],[0,0,1],[0,-1,0]])
  v=(v-center)@axis.T*.025@r.T+bind[:3,3];pr['attributes']['POSITION']=add(g,b,v,'VEC3');norm=accessor(g,b,pr['attributes']['NORMAL'])@axis.T@r.T;pr['attributes']['NORMAL']=add(g,b,norm,'VEC3')
 scenes=g['scenes'];children=list(scenes[g.get('scene',0)]['nodes']);g['nodes'].append({'name':'FPS_camera_normalization','matrix':m.T.ravel().tolist(),'children':children});scenes[g.get('scene',0)]['nodes']=[len(g['nodes'])-1]
 for image in g.get('images',[]):
  view=g['bufferViews'][image['bufferView']];data=bytes(b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);im=Image.open(io.BytesIO(data));original=im.size;im.thumbnail((1024,1024),Image.Resampling.LANCZOS);buf=io.BytesIO();im.save(buf,format='PNG',optimize=True);encoded=buf.getvalue()
  if original==im.size and len(data)<len(encoded):continue
  data=encoded;b+=b'\0'*((-len(b))%4);g['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(data)});b+=data;image['bufferView']=len(g['bufferViews'])-1;image['mimeType']='image/png'
 # Compact buffers after replacing images; retain accessor offsets/strides unchanged.
 used=set(a['bufferView']for a in g['accessors']if 'bufferView'in a)|set(i['bufferView']for i in g['images']);new=bytearray();views=[];mapping={}
 for index in sorted(used):
  v=copy.deepcopy(g['bufferViews'][index]);new+=b'\0'*((-len(new))%4);start=v.get('byteOffset',0);data=b[start:start+v['byteLength']];v['byteOffset']=len(new);new+=data;mapping[index]=len(views);views.append(v)
 for a in g['accessors']:
  if 'bufferView'in a:a['bufferView']=mapping[a['bufferView']]
 for i in g['images']:i['bufferView']=mapping[i['bufferView']]
 g['bufferViews']=views;g.setdefault('extras',{})['partyGameSource']={'filename':info['file'],'sha256':info['sha256'],'operations':'author camera normalization; embedded texture maximum 1024; original rig and all clips preserved'}
 for mesh in g['meshes']:
  for pr in mesh['primitives']:
   a=g['accessors'][pr['attributes']['POSITION']]
   if 'min'not in a:
    v=accessor(g,new,pr['attributes']['POSITION']);a['min']=v.min(axis=0).tolist();a['max']=v.max(axis=0).tolist()
 save(out/(name+'.glb'),g,new);print(name,(out/(name+'.glb')).stat().st_size)
