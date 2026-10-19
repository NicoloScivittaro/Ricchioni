"""Offline centreline extraction from the supplied road triangles; no extra packages."""
from pathlib import Path
import numpy as np, heapq, json, math
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[1]
data=np.load(root/'docs/agent-work/rainbow-glide/geometry.npz')
v=data['vertices']; tris=data['triangles']
step=.16; ox=134; oy=-4; w=850; h=810
im=Image.new('L',(w,h)); draw=ImageDraw.Draw(im)
for t in tris:
 draw.polygon([((v[i,0]-ox)/step,(v[i,1]-oy)/step) for i in t],fill=255)
mask=np.asarray(im)>0
# Eight-neighbour distance from the edges. A weighted shortest path strongly
# prefers the road centre, while retaining all bends of the original mesh.
dist=np.where(mask,1e6,0.)
for y in range(1,h-1):
 for x in range(1,w-1):
  if mask[y,x]:dist[y,x]=min(dist[y,x],dist[y-1,x]+1,dist[y,x-1]+1,dist[y-1,x-1]+1.414,dist[y-1,x+1]+1.414)
for y in range(h-2,0,-1):
 for x in range(w-2,0,-1):
  if mask[y,x]:dist[y,x]=min(dist[y,x],dist[y+1,x]+1,dist[y,x+1]+1,dist[y+1,x-1]+1.414,dist[y+1,x+1]+1.414)
def route(a,b):
 def cell(p):return (round((p[1]-oy)/step),round((p[0]-ox)/step))
 start=cell(a);end=cell(b); costs={start:0};prev={};q=[(0,start)]
 while q:
  cost,p=heapq.heappop(q)
  if cost!=costs[p]:continue
  if p==end:break
  for dy,dx in [(0,1),(0,-1),(1,0),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)]:
   n=(p[0]+dy,p[1]+dx)
   if not(0<=n[0]<h and 0<=n[1]<w) or not mask[n]:continue
   nc=cost+math.hypot(dx,dy)*(1+60/max(1,dist[n])**2)
   if nc<costs.get(n,1e100):costs[n]=nc;prev[n]=p;heapq.heappush(q,(nc,n))
 if end not in prev:raise Exception(('no path',a,b))
 out=[end]
 while out[-1]!=start:out.append(prev[out[-1]])
 return np.array([[ox+x*step,oy+y*step] for y,x in out[::-1]])
paths=[route((228.4,0),(241.1,0)),route((241.1,0),(262.2,14.1)),route((264.1,104.2),(177.6,103.8)),route((175.1,103.8),(228.4,0))]
# Gap nodes are explicit. No collision ribbon is rendered across either hole.
path=np.concatenate([paths[0][:-1],paths[1],np.array([[262.4,20],[263,40],[263.7,65],[264.1,88],[264.1,104]]),paths[2],np.array([[176.4,103.8]]),paths[3][:-1]])
# Smooth only the raster staircase (less than 0.5 original units), then sample
# every 0.65 units and barycentrically recover the actual mesh elevation.
for _ in range(12):path=(np.roll(path,1,axis=0)+2*path+np.roll(path,-1,axis=0))/4
cum=np.r_[0,np.cumsum(np.linalg.norm(np.diff(np.r_[path,path[:1]],axis=0),axis=1))]
ds=np.arange(0,cum[-1],.65); closed=np.r_[path,path[:1]]
xy=np.c_[np.interp(ds,cum,closed[:,0]),np.interp(ds,cum,closed[:,1])]
tv=v[tris];a=tv[:,0,:2];b=tv[:,1,:2]-a;c=tv[:,2,:2]-a;det=b[:,0]*c[:,1]-b[:,1]*c[:,0]
points=[];missing=[]
for i,p in enumerate(xy):
 d=p-a;u=(d[:,0]*c[:,1]-d[:,1]*c[:,0])/np.where(abs(det)>1e-9,det,1);t=(b[:,0]*d[:,1]-b[:,1]*d[:,0])/np.where(abs(det)>1e-9,det,1)
 hits=np.where((abs(det)>1e-9)&(u>=-1e-5)&(t>=-1e-5)&(u+t<=1.00001))[0]
 z=0;normal=np.array([0.,0.,1.])
 if len(hits):
  j=hits[0];z=tv[j,0,2]+u[j]*(tv[j,1,2]-tv[j,0,2])+t[j]*(tv[j,2,2]-tv[j,0,2])
  normal=np.cross(tv[j,1]-tv[j,0],tv[j,2]-tv[j,0]);normal/=np.linalg.norm(normal)
  if normal[2]<0:normal=-normal
 else:missing.append(i)
 points.append([round(float(p[0]),4),round(float(p[1]),4),round(float(z),4),*[round(float(x),6) for x in normal]])
out=root/'src/minigames/kart-race/rainbowRoute.json';out.write_text(json.dumps(points,separators=(',',':')),encoding='utf-8')
vis=Image.new('RGB',(w,h),'#090c20');vis.paste('#37516e',(0,0,w,h),im);dr=ImageDraw.Draw(vis)
dr.line([((p[0]-ox)/step,(p[1]-oy)/step) for p in points],fill='#ffed73',width=2)
vis.transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(root/'docs/agent-work/rainbow-glide/extracted-route.png')
print(json.dumps({'points':len(points),'lengthOriginal':cum[-1],'offSurface':len(missing),'indices':missing}))
