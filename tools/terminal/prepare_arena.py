"""Local Terminal arena preparation. Original conversion remains untouched.
Spatial visual batches + shared model nodes; architectural shot geometry and
radius-eroded, multi-height walk graph. No invented replacement map.
"""
from pathlib import Path
from collections import defaultdict,deque,Counter
import json,struct,io,copy,time
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/agent-work/terminal-2';OUT.mkdir(exist_ok=True)
CELL=.4;R=.28;BOUNDS=(-75,45,-78,64);X0,X1,Z0,Z1=BOUNDS
W=round((X1-X0)/CELL)+1;H=round((Z1-Z0)/CELL)+1

def dump(n,o): (OUT/n).write_text(json.dumps(o,indent=2),encoding='utf8')
def read():
 b=(ROOT/'public/assets/fps/terminal/terminal.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def access(d,b,i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 return np.frombuffer(b,dtype={5126:'<f4',5125:'<u4'}[a['componentType']],count=a['count']*dim,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim)
def world(d,b,node,pr):
 p=access(d,b,pr['attributes']['POSITION']);m=np.array(node.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T
 return p@m[:3,:3].T+m[:3,3]+d['nodes'][0]['translation']
def cells(t,pad=0):
 lo=t[:,[0,2]].min(0)-pad;hi=t[:,[0,2]].max(0)+pad
 ix=np.arange(max(0,int(np.ceil((lo[0]-X0)/CELL))),min(W-1,int(np.floor((hi[0]-X0)/CELL)))+1)
 iz=np.arange(max(0,int(np.ceil((lo[1]-Z0)/CELL))),min(H-1,int(np.floor((hi[1]-Z0)/CELL)))+1)
 xx,zz=np.meshgrid(ix,iz);return (zz*W+xx).flatten()
def bary(t,x,z):
 a,b,c=t;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
 if abs(den)<1e-9:return None
 u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
 v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
 return u,v,1-u-v

def gameplay(d,b):
 selected=[];counts=Counter()
 # Only authored architecture and substantial physical cover, never foliage,
 # signs, wires, alpha effects, shadow cards, tiny props or visual seat fabrics.
 cover=('barrier','container','truck','policecar','suburban','cart_baggage','xray_scanner','vending','furniture_table','trashcompactor','generator','bookstore','727_coach_seat','stairs_moveable','evacslide')
 excluded=('decal','stain','ceiling_light','light_fixture','linear_light','light_effect','light_on','light_off','sign','glass_banister','crosswalk','streetline','compass','banner','wires','water','grass','gravel','shadow','effect','screw','canopy')
 for node in d['nodes']:
  if 'mesh' not in node:continue
  name=node['name'];is_map=name.startswith('map/')
  if not is_map and not any(s in name for s in cover):continue
  for pr in d['meshes'][node['mesh']]['primitives']:
   mat=d['materials'][pr['material']]['name'].lower()
   if any(s in mat for s in excluded):continue
   p=world(d,b,node,pr);p[:,2]*=-1 # same RH -> LH conversion as Babylon loader
   ts=p[access(d,b,pr['indices']).reshape(-1,3)]
   norm=np.cross(ts[:,1]-ts[:,0],ts[:,2]-ts[:,0]);area=np.linalg.norm(norm,axis=1)/2
   lo=ts.min(1);hi=ts.max(1)
   keep=(area>.018)&(hi[:,0]>=X0-3)&(lo[:,0]<=X1+3)&(hi[:,2]>=Z0-3)&(lo[:,2]<=Z1+3)&(hi[:,1]>=-.3)&(lo[:,1]<=11)
   selected.extend(ts[keep]);counts['architecture'if is_map else'cover']+=int(keep.sum())
 ts=np.array(selected);# weld duplicate triangles regardless of original winding
 _,unique=np.unique(np.round(ts,4).reshape(len(ts),9),axis=0,return_index=True);ts=ts[np.sort(unique)]
 n=np.cross(ts[:,1]-ts[:,0],ts[:,2]-ts[:,0]);ny=abs(n[:,1])/np.maximum(np.linalg.norm(n,axis=1),1e-10)
 floors=defaultdict(set)
 for t in ts[(n[:,1]/np.maximum(np.linalg.norm(n,axis=1),1e-10)<-.68)&(ts[:,:,1].min(1)<6.8)&(ts[:,:,1].max(1)>-.15)]:
  ids=cells(t);x=X0+(ids%W)*CELL;z=Z0+(ids//W)*CELL;uv=bary(t,x,z)
  if uv is None:continue
  inside=np.minimum.reduce(uv)>=-.0001;y=sum(uv[i]*t[i,1] for i in range(3))
  for i,h in zip(ids[inside],y[inside]):
   if -.15<=h<=6.8:floors[int(i)].add(round(float(h),2))
 pts=[];grid=defaultdict(list)
 for i,hs in floors.items():
  # Collapse coplanar surfaces/decals, retain stacked floors.
  last=-100
  for h in sorted(hs):
   if h-last<.12:continue
   grid[i].append(len(pts));pts.append([X0+(i%W)*CELL,h,Z0+(i//W)*CELL]);last=h
 pts=np.array(pts);blocked=np.zeros(len(pts),dtype=bool)
 print('floors',len(pts),'shot triangles',len(ts),flush=True)
 for t in ts:
  ids=np.array([j for i in cells(t,R) for j in grid[int(i)]],dtype=int)
  if not len(ids):continue
  ids=ids[~blocked[ids]]
  if not len(ids):continue
  p=pts[ids];miny=t[:,1].min();maxy=t[:,1].max()
  low=.08 if maxy-miny<1e-5 else .52
  use=(p[:,1]+1.68>=miny)&(p[:,1]+low<=maxy)
  ids=ids[use];p=p[use]
  if not len(ids):continue
  if maxy-miny<1e-5:
   uv=bary(t,p[:,0],p[:,2]);
   if uv is not None:blocked[ids[np.minimum.reduce(uv)>=-1e-5]]=True
   continue
  for offset in [.52,.95,1.4,1.65]:
   h=p[:,1]+offset;ends=[];valid=[]
   for a,c in [(t[0],t[1]),(t[1],t[2]),(t[2],t[0])]:
    if abs(c[1]-a[1])<1e-8:ends.append(np.tile(a[[0,2]],(len(p),1)));valid.append(np.zeros(len(p),bool));continue
    f=(h-a[1])/(c[1]-a[1]);ends.append(a[[0,2]]+f[:,None]*(c-a)[[0,2]]);valid.append((f>=0)&(f<=1))
   for a,c in [(0,1),(1,2),(2,0)]:
    v=ends[c]-ends[a];q=p[:,[0,2]]-ends[a];f=np.clip((q*v).sum(1)/np.maximum((v*v).sum(1),1e-10),0,1)
    distance=np.linalg.norm(q-f[:,None]*v,axis=1)
    blocked[ids[(valid[a]&valid[c])&(distance<R+.005)]]=True
 # Require support near the centre rather than allow a capsule on a paper-thin rim.
 good=(~blocked)&(pts[:,0]>X0+R)&(pts[:,0]<X1-R)&(pts[:,2]>Z0+R)&(pts[:,2]<Z1-R)
 def nearby(i):return grid.get(i,())
 adjacency=[[] for _ in pts]
 for cell,ns in grid.items():
  for i in ns:
   if not good[i]:continue
   for other in [cell-1 if cell%W else -1,cell+1 if cell%W<W-1 else -1,cell-W,cell+W]:
    for j in nearby(other):
     if good[j] and abs(pts[i,1]-pts[j,1])<=.52:adjacency[i].append(j)
 seen=set();components=[]
 for i in np.flatnonzero(good):
  if i in seen:continue
  q=[int(i)];seen.add(int(i))
  for u in q:
   for v in adjacency[u]:
    if v not in seen:seen.add(v);q.append(v)
  components.append(q)
 components.sort(key=len,reverse=True);dump('components.json',[{'count':len(c),'min':pts[c].min(0).tolist(),'max':pts[c].max(0).tolist()}for c in components[:30]]);keep=components[0];mapping={old:i for i,old in enumerate(keep)}
 points=np.round(pts[keep],3);edges=[[mapping[v]for v in adjacency[u]if v in mapping]for u in keep]
 spawns=[];checks=[]
 source=json.loads((OUT/'source-spawns.json').read_text())
 for s in source:
  if s['kind']!='mp_dm_spawn':continue
  p=np.array(s['p']);dist=np.linalg.norm(points[:,[0,2]]-p[[0,2]],axis=1)+abs(points[:,1]-p[1])*.6
  i=int(np.argmin(dist));err=float(np.linalg.norm(points[i,[0,2]]-p[[0,2]]));vertical=float(p[1]-points[i,1])
  ok=err<1.8 and -.1<vertical<1.6
  checks.append({**s,'node':i,'horizontalAdjustment':err,'verticalToFloor':vertical,'accepted':ok})
  if ok and all(np.linalg.norm(points[i]-points[j])>3 for j in spawns):spawns.append(i)
 # Visible original-design perimeter fence coincides with the chosen bounds.
 barriers=[{'x':X0,'z':(Z0+Z1)/2,'w':.25,'d':Z1-Z0,'h':8,'base':-.2},{'x':X1,'z':(Z0+Z1)/2,'w':.25,'d':Z1-Z0,'h':8,'base':-.2},{'x':(X0+X1)/2,'z':Z0,'w':X1-X0,'d':.25,'h':8,'base':-.2},{'x':(X0+X1)/2,'z':Z1,'w':X1-X0,'d':.25,'h':8,'base':-.2}]
 data={'cell':CELL,'radius':R,'bounds':list(BOUNDS),'triangles':np.round(ts,4).reshape(-1,9).tolist(),'nodes':points.tolist(),'edges':edges,'spawns':spawns,'barriers':barriers}
 (ROOT/'public/assets/fps/terminal/arena.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf8')
 dump('spawn-validation.json',checks);dump('geometry.json',{'selectedSourceTriangles':len(ts),'selectedByKind':dict(counts),'walkCandidates':len(pts),'clearCandidates':int(good.sum()),'components':[len(c)for c in components[:20]],'connectedNodes':len(keep),'spawns':len(spawns),'bounds':BOUNDS,'cell':CELL,'radius':R,'heightRange':points[:,1].min().item().__str__()+'..'+str(points[:,1].max())})
 print('arena',len(keep),'nodes',len(spawns),'spawns', 'components',[len(c)for c in components[:8]],flush=True)
 # Engineering diagram, not a screenshot. Useful for reviewing reachable levels.
 im=Image.new('RGB',(W*3,H*3),'#17232e');pix=im.load()
 for x,y,z in points:
  xx=round((x-X0)/CELL)*3;zz=round((z-Z0)/CELL)*3;color=(int(50+y*22),int(100+y*12),170)
  for dx in range(3):
   for dz in range(3):pix[xx+dx,zz+dz]=color
 im.save(OUT/'navigation-diagram.png')
 return data

class Packed:
 def __init__(self,d):self.d=copy.deepcopy(d);self.d['bufferViews']=[];self.d['accessors']=[];self.d['nodes']=[{'name':'Terminal gameplay original geometry','children':[]}];self.d['meshes']=[];self.bin=bytearray()
 def view(self,data,target=None):
  self.bin.extend(bytes((-len(self.bin))%4));o={'buffer':0,'byteOffset':len(self.bin),'byteLength':len(data)};self.bin.extend(data)
  if target:o['target']=target
  self.d['bufferViews'].append(o);return len(self.d['bufferViews'])-1
 def acc(self,arr,index=False):
  arr=np.asarray(arr,dtype='<u4'if index else'<f4');dim=arr.shape[1]if arr.ndim>1 else 1
  a={'bufferView':self.view(arr.tobytes(),34963 if index else 34962),'componentType':5125 if index else 5126,'count':len(arr),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[dim]}
  a['min']=np.atleast_1d(arr.min(0)).tolist();a['max']=np.atleast_1d(arr.max(0)).tolist();self.d['accessors'].append(a);return len(self.d['accessors'])-1
 def save(self):
  self.d['buffers']=[{'byteLength':len(self.bin)}];js=json.dumps(self.d,separators=(',',':')).encode();js+=b' '*((-len(js))%4);self.bin.extend(bytes((-len(self.bin))%4));total=28+len(js)+len(self.bin)
  path=ROOT/'public/assets/fps/terminal/terminal-play.glb';path.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(self.bin),b'BIN\0')+self.bin);return path.stat().st_size

def visual(d,b):
 out=Packed(d);copyacc={};copymesh={};groups=defaultdict(list);root=np.array(d['nodes'][0]['translation']);inst=0;triangles=0
 for node in d['nodes']:
  if 'mesh'not in node:continue
  name=node['name'];mesh=d['meshes'][node['mesh']];is_map=name.startswith('map/')
  if not is_map:
   ps=np.concatenate([world(d,b,node,pr)for pr in mesh['primitives']]);lo=ps.min(0);hi=ps.max(0)
   if hi[0]<-100 or lo[0]>65 or hi[2]<-95 or lo[2]>110:continue # RH z, arena LH reversal
   mi=node['mesh']
   if mi not in copymesh:
    m=copy.deepcopy(mesh)
    for pr in m['primitives']:
     for a in [pr['indices'],*pr['attributes'].values()]:
      if a not in copyacc:copyacc[a]=out.acc(access(d,b,a),d['accessors'][a]['componentType']==5125)
     pr['indices']=copyacc[pr['indices']];pr['attributes']={k:copyacc[a]for k,a in pr['attributes'].items()}
    copymesh[mi]=len(out.d['meshes']);out.d['meshes'].append(m)
   nn=copy.deepcopy(node);nn['mesh']=copymesh[mi];m=np.array(nn.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T;m[:3,3]+=root;nn['matrix']=m.T.flatten().tolist();out.d['nodes'][0]['children'].append(len(out.d['nodes']));out.d['nodes'].append(nn);inst+=1;triangles+=sum(d['accessors'][pr['indices']]['count']//3 for pr in mesh['primitives']);continue
  for pr in mesh['primitives']:
   ps=world(d,b,node,pr);ix=access(d,b,pr['indices']).reshape(-1,3);ts=ps[ix];lo=ts.min(1);hi=ts.max(1)
   keep=(hi[:,0]>-100)&(lo[:,0]<65)&(hi[:,2]>-95)&(lo[:,2]<110)
   ix=ix[keep];centers=ps[ix].mean(1);keys=np.floor(centers[:,[0,2]]/16).astype(int)
   for key in np.unique(keys,axis=0):
    sub=ix[np.all(keys==key,axis=1)];verts,indices=np.unique(sub.flatten(),return_inverse=True);attrs={k:(ps[verts]if k=='POSITION'else access(d,b,a)[verts])for k,a in pr['attributes'].items()};groups[(pr['material'],*key)].append((attrs,indices))
 for (mat,cx,cz),parts in groups.items():
  attrs={k:np.concatenate([a[k]for a,_ in parts])for k in parts[0][0]};offset=0;ix=[]
  for a,i in parts:ix.append(i+offset);offset+=len(a['POSITION'])
  pr={'attributes':{k:out.acc(a)for k,a in attrs.items()},'indices':out.acc(np.concatenate(ix),True),'material':mat,'mode':4};name=f'terminalZone/{cx}/{cz}/{mat}'
  out.d['meshes'].append({'name':name,'primitives':[pr]});out.d['nodes'][0]['children'].append(len(out.d['nodes']));out.d['nodes'].append({'name':name,'mesh':len(out.d['meshes'])-1});triangles+=len(np.concatenate(ix))//3
 # Dominant unavailable materials use explicitly recorded compatible originals,
 # never labelled as recovered originals. No synthetic texture downloads.
 byname={m['name']:m for m in out.d['materials']};substitutions={}
 for mat in out.d['materials']:
  name=mat['name']
  if 'missingSourceMaterial' not in mat.get('extras',{}):continue
  alternate=None;tint=[1,1,1,1]
  if 'wall' in name:alternate='office_whitewall_01';tint=[.88,.83,.71,1]if 'tan'in name else[.6,.72,.81,1]if 'blue'in name else[.8,.8,.79,1]
  elif any(s in name for s in ['floor','tile','carpet']):alternate='marble_floor_tiles_02'if 'carpet'not in name else'ap_interior_plastic_tile';tint=[.52,.3,.24,1]if'red'in name else[.78,.78,.72,1]
  elif any(s in name for s in ['metal','chrome','beam','stairs','panel']):alternate='metal_aluminum01'
  elif any(s in name for s in ['concrete','ceiling','plaster']):alternate='concrete_grey02'
  if alternate:
   mat['pbrMetallicRoughness']=copy.deepcopy(byname[alternate]['pbrMetallicRoughness']);mat['pbrMetallicRoughness']['baseColorFactor']=tint;mat['extras']['localFallbackFrom']=alternate;substitutions[name]=alternate
 # Preserve alpha. Base colour 1024 (hero signs/aircraft), normals 512 and spec128.
 imagebytes=0;resized=0
 for i,im in enumerate(out.d['images']):
  old=d['bufferViews'][im['bufferView']];raw=b[old.get('byteOffset',0):old.get('byteOffset',0)+old['byteLength']];image=Image.open(io.BytesIO(raw));role=im['name'].split('__')[-1];limit=1024 if role=='baseColor' else 512 if role=='normal' else 128
  if max(image.size)>limit:image.thumbnail((limit,limit),Image.Resampling.LANCZOS);resized+=1
  opaque=image.mode!='RGBA'or image.getextrema()[3]==(255,255);buf=io.BytesIO()
  if opaque and role=='baseColor':image.convert('RGB').save(buf,format='JPEG',quality=88);im['mimeType']='image/jpeg'
  else:image.save(buf,format='PNG',compress_level=6)
  im['bufferView']=out.view(buf.getvalue());imagebytes+=len(buf.getvalue())
 out.d['nodes'][0]['extras']={'source':'terminal.glb, original converted geometry','partial':True,'materialFallbacks':substitutions,'gameplayFile':True}
 size=out.save();dump('optimization.json',{'sourceBytes':114097536,'optimizedBytes':size,'spatialBatches':len(groups),'modelInstances':inst,'trianglesWithInstances':triangles,'imageBytes':imagebytes,'resizedImages':resized,'materialSubstitutions':substitutions,'zoneMeters':16,'originalConversionPreserved':True});print('visual bytes',size,'batches',len(groups),'instances',inst,flush=True)
if __name__=='__main__':
 import sys
 d,b=read();
 if '--geometry-only'not in sys.argv:visual(d,b)
 gameplay(d,b)