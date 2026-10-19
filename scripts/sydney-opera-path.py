import numpy as np,cv2,json,heapq
from pathlib import Path
root=Path(__file__).resolve().parents[1];r=np.load(root/'docs/agent-work/sydney-sprint/analysis-meshes.npz');meta=json.load(open(root/'docs/agent-work/track-corrections/sydney-meshes.json'));ppm=3;x0=150;z0=-245;shape=(470,480);floor=np.zeros(shape,np.uint8);walls=floor.copy()
for m in meta:
 if m['id']in[4,28,38,39]:continue
 for t in r['p'+str(m['id'])][r['i'+str(m['id'])]]:
  if t[:,0].max()<150 or t[:,0].min()>310 or t[:,2].max()<-245 or t[:,2].min()>-90:continue
  n=np.cross(t[1]-t[0],t[2]-t[0]);n/=max(np.linalg.norm(n),1e-8);pts=np.stack([(t[:,0]-x0)*ppm,(t[:,2]-z0)*ppm],1).astype(np.int32)
  if abs(n[1])>.7 and 7.1<t[:,1].mean()<8.4:cv2.fillPoly(floor,[pts],255)
  if abs(n[1])<.7 and t[:,1].min()<11.2 and t[:,1].max()>7.75:cv2.fillPoly(walls,[pts],255);cv2.polylines(walls,[pts],True,255,1)
free=(floor>0)&(cv2.distanceTransform(255-walls,cv2.DIST_L2,5)/ppm>1.9)&(cv2.distanceTransform(floor,cv2.DIST_L2,5)/ppm>1.5)
def pix(x,z):return(int(round((z-z0)*ppm)),int(round((x-x0)*ppm)))
def near(p):
 ys,xs=np.where(free);d=(ys-p[0])**2+(xs-p[1])**2;i=np.argmin(d);return(int(ys[i]),int(xs[i]))
start=near(pix(281,-143));end=near(pix(229,-179));queue=[(0,start)];cost={start:0};prev={}
while queue:
 _,p=heapq.heappop(queue)
 if p==end:break
 for dy,dx in[(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
  q=(p[0]+dy,p[1]+dx)
  if not(0<=q[0]<shape[0]and 0<=q[1]<shape[1]and free[q]and free[p[0]+dy,p[1]]and free[p[0],p[1]+dx]):continue
  nc=cost[p]+np.hypot(dy,dx)
  if nc<cost.get(q,1e9):cost[q]=nc;prev[q]=p;heapq.heappush(queue,(nc+np.hypot(q[0]-end[0],q[1]-end[1]),q))
path=[]
if end in cost:
 p=end
 while p!=start:path.append(p);p=prev[p]
 path.append(start);path.reverse()
points=[[x/ppm+x0,8,z/ppm+z0]for z,x in path]
print('path',len(path));print(json.dumps(points[::max(1,len(points)//15)]))
json.dump(points,open(root/'docs/agent-work/track-corrections/opera-path.json','w'))
im=np.zeros((*shape,3),np.uint8);im[floor>0]=(90,90,90);im[walls>0]=(80,160,220);im[free]=(60,90,60)
if path:cv2.polylines(im,[np.array([[x,z]for z,x in path],np.int32)],False,(60,60,255),2)
cv2.imwrite(str(root/'docs/agent-work/track-corrections/opera-nav.png'),im)
np.savez(root/'docs/agent-work/track-corrections/opera-nav.npz',free=free,floor=floor,walls=walls)
