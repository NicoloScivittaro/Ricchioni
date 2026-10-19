"""Inspect the supplied GLB, bake its node transforms and draw its real geometry."""
import struct,json,pathlib,math
import numpy as np
from PIL import Image,ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/agent-work/primo-karting';OUT.mkdir(parents=True,exist_ok=True)
b=pathlib.Path(r'C:/Users/niluf.PC-NIKO/Downloads/primo_karting__karting_race_track.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:]
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1',5122:'<i2'}[a['componentType']]);size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],size),dtype=dt,buffer=binary,offset=offset,strides=(v.get('byteStride',dt.itemsize*size),dt.itemsize)).copy()
def matrix(node):
 if 'matrix'in node:return np.array(node['matrix']).reshape(4,4).T
 m=np.eye(4);m[:3,3]=node.get('translation',[0,0,0]);x,y,z,w=node.get('rotation',[0,0,0,1]);m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(node.get('scale',[1,1,1]));return m
meshes=[]
def walk(i,parent):
 node=g['nodes'][i];m=parent@matrix(node)
 if 'mesh'in node:
  for p in g['meshes'][node['mesh']]['primitives']:
   raw=accessor(p['attributes']['POSITION']);pos=np.c_[raw,np.ones(len(raw))]@m.T;pos=pos[:,:3]/.0254;pos[:,2]*=-1
   idx=accessor(p['indices']).reshape(-1,3);meshes.append((node['name'],p['material'],pos,idx))
 for child in node.get('children',[]):walk(child,m)
for i in g['scenes'][g.get('scene',0)]['nodes']:walk(i,np.eye(4))
meta=[]
for i,(name,mat,pos,idx)in enumerate(meshes):
 meta.append({'id':i,'name':name,'mat':g['materials'][mat].get('name'),'bounds':[pos.min(0).tolist(),pos.max(0).tolist()],'triangles':len(idx)})
 if name.startswith(('1ROAD','1PIT','TRKLINE','TRKGRAS')):print(json.dumps(meta[-1]))
(OUT/'asset-analysis.json').write_text(json.dumps({'asset':g['asset'],'meshes':len(meshes),'nodes':len(g['nodes']),'triangles':sum(len(idx)for _,_,_,idx in meshes),'textures':len(g.get('textures',[])),'images':len(g.get('images',[])),'materials':len(g['materials']),'meshInfo':meta},indent=2))
np.savez_compressed(OUT/'geometry.npz',**{f'p{i}':p for i,(_,_,p,_)in enumerate(meshes)},**{f'i{i}':idx for i,(_,_,_,idx)in enumerate(meshes)})
def pixel(x,z):return(int((x+120)*7+24),int((z+90)*7+24))
for kind in ['layout','obstacles']:
 im=Image.new('RGB',(1700,1310),'#22312b');draw=ImageDraw.Draw(im)
 for name,mat,pos,idx in sorted(meshes,key=lambda m:float(m[2][:,1].mean())):
  color='#64716e'
  if name.startswith(('1ROAD','1PIT')):color='#9b9b94'if name.startswith('1ROAD')else'#6b7072'
  elif mat in [4,47,7]:color='#f19e56'
  elif name.startswith(('WLL','2WALL','3WALL')):color='#a2bfd2'
  elif name.startswith('TRKLINE'):color='#ffffff'
  elif mat==8:color='#ff5050'
  elif pos[:,1].max()>3:color='#516c80'
  if kind=='obstacles'and not(name.startswith(('1ROAD','1PIT'))or mat in[4,47,7,8]or name.startswith(('WLLARMC','TRKLINE'))):continue
  for face in idx:draw.polygon([pixel(v[0],v[2])for v in pos[face]],fill=color)
 for x in range(-110,121,10):
  for z in range(-80,91,10):
   px,py=pixel(x,z);draw.ellipse((px-1,py-1,px+1,py+1),fill='#f36e6e');draw.text((px+3,py+2),f'{x},{z}',fill='#caf4d8')
 im.save(OUT/f'analysis-{kind}.png')
