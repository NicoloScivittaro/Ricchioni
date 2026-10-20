"""Bake supplied CAD meshes into compact, static LH geometry and matching collision planes.
Re-run locally; original GLBs stay untouched. No network or external converters.
"""
import json,struct,pathlib,numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/assets/minigolf'
def load(name):
 b=(ASSETS/name).read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def accessor(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'};dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};d=dims[a['type']];dt=np.dtype(types[a['componentType']]);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],d),dt,buffer=b,offset=off,strides=(v.get('byteStride',dt.itemsize*d),dt.itemsize)).copy()
def bake_group(group,center,base,scale=.04):
 g,b=load('mini_golf_models1-9.glb');nodes=g['nodes'];root=next(i for i,n in enumerate(nodes) if n.get('name')==group);desc=[]
 def visit(i):
  if 'mesh' in nodes[i]:desc.append(nodes[i]['mesh'])
  for j in nodes[i].get('children',[]):visit(j)
 visit(root);geo=[];floors=[];walls={};lawn=[]
 for mi in desc:
  for pr in g['meshes'][mi]['primitives']:
   source=accessor(g,b,pr['attributes']['POSITION']);pos=np.stack([source[:,2]*scale,(source[:,1]-base)*scale,-(source[:,0]-center)*scale],axis=1);inds=accessor(g,b,pr['indices']).reshape(-1,3);mat=g['materials'][pr.get('material',0)]['name'];is_rail='Light_Gray' in mat;is_base='Golden_Beige' in mat
   geo.append({'name':g['meshes'][mi].get('name','part'),'material':mat,'positions':np.round(pos,5).flatten().tolist(),'indices':inds[:,[0,2,1]].flatten().tolist()})
   for tri in pos[inds]:
    n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);length=np.linalg.norm(n)
    if length<1e-7:continue
    n=n/length
    # Source winding is RH. Only actual upward play surfaces, never timber skirts or rail tops.
    if n[1]>.55 and not is_rail and not is_base:
     x,z=(tri[:,0].min()+tri[:,0].max())/2,(tri[:,2].min()+tri[:,2].max())/2;y=tri[0,1]-(n[0]*(x-tri[0,0])+n[2]*(z-tri[0,2]))/n[1];floors.append({'x':round(float(x),5),'z':round(float(z),5),'y':round(float(y),5),'w':round(float(np.ptp(tri[:,0])),5),'d':round(float(np.ptp(tri[:,2])),5),'slopeX':round(float(-n[0]/n[1]),5),'slopeZ':round(float(-n[2]/n[1]),5),'triangle':[{'x':round(float(p[0]),5),'z':round(float(p[2]),5)} for p in tri]})
    if n[1]>.55 and any(k in mat for k in ['BROWN_GREEN','Pale_Jade','BROOM_YELLOW','LIGHT_BLUE']):lawn.append(tri)
    if abs(n[1])<.04 and not is_base and float(max(tri[:,1]))>.18:
     # Each vertical face projects onto its exact horizontal segment. Merge duplicate triangle halves.
     pts=sorted(set((round(float(p[0]),4),round(float(p[2]),4)) for p in tri));a,c=pts[0],pts[-1]
     if np.hypot(c[0]-a[0],c[1]-a[1])<.03:continue
     lo=max(0,float(min(tri[:,1])));hi=float(max(tri[:,1]));key=(a,c)
     if hi<=lo:continue
     old=walls.get(key);walls[key]={'a':{'x':a[0],'z':a[1]},'b':{'x':c[0],'z':c[1]},'y':round(min(lo,old['y']) if old else lo,5),'height':round(max(hi,old['y']+old['height'])-min(lo,old['y']) if old else hi-lo,5),'radius':.015}
 def lawn_height(x,z):
  heights=[]
  for tri in lawn:
   a,c,d=tri[:,[0,2]];q=np.array([x,z]);cross=lambda u,v:u[0]*v[1]-u[1]*v[0]
   signs=[cross(c-a,q-a),cross(d-c,q-c),cross(a-d,q-d)]
   if min(signs)<-.0002 and max(signs)>.0002:continue
   n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);heights.append(float(tri[0,1]-(n[0]*(x-tri[0,0])+n[2]*(z-tri[0,2]))/n[1]))
  return max(heights) if heights else None
 filtered=[]
 for w in walls.values():
  heights=[lawn_height(w['a']['x']+(w['b']['x']-w['a']['x'])*t,w['a']['z']+(w['b']['z']-w['a']['z'])*t) for t in [.05,.25,.5,.75,.95]]
  # Retaining faces that end at the lawn are the side of a ramp, not a barrier
  # across it. Keep exposed rails/obstacles; do not turn terrain seams into walls.
  if any(y is None for y in heights) or max(w['y']+w['height']-y for y in heights if y is not None)>.035:filtered.append(w)
 return {'geometry':geo,'floors':floors,'walls':filtered,'source':group}
result={'dune':bake_group('Model_v2',550,11),'palme':bake_group('Model__v4',550,11)}
# The windmill is Z-up in its authored vertices. Bake it explicitly, avoiding its Sketchfab wrapper.
g,b=load('mini_golf_windmill.glb');decor=[]
for mesh in g['meshes']:
 for pr in mesh['primitives']:
  p=accessor(g,b,pr['attributes']['POSITION']);pos=np.stack([(p[:,0]-180)*.025,p[:,2]*.025,(p[:,1]-50)*.025],axis=1)
  # Skip the long putting lane: retain tower, roof and sails as off-course architecture.
  tri=accessor(g,b,pr['indices']).reshape(-1,3);valid=(np.max(p[tri,2],axis=1)>8)&(np.max(p[tri,1],axis=1)<95)&(np.min(p[tri,0],axis=1)>140)
  if valid.any():decor.append({'material':pr.get('material',0),'positions':np.round(pos,5).flatten().tolist(),'indices':tri[valid].flatten().tolist()})
result['windmill']=decor
out=ROOT/'src/minigames/minigolf/minigolfImported.json';out.write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
for k in ['dune','palme']:print(k,'meshes',len(result[k]['geometry']),'floors',len(result[k]['floors']),'walls',len(result[k]['walls']))
print('generated',out.stat().st_size,'bytes; windmill parts',len(decor))

