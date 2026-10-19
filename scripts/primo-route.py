"""Derive the lap from the asset's closed skid ribbon, then fit it between
the actual plastic/tyre barriers. No replacement asphalt is generated."""
import pathlib,json,collections
import numpy as np
import cv2
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/agent-work/primo-karting';data=np.load(OUT/'geometry.npz');meta=json.loads((OUT/'asset-analysis.json').read_text())['meshInfo']
SCALE=5.0;PPM=35;X0=-60;Z0=-18
def pixel(x,z):return np.array([(x-X0)*PPM,(z-Z0)*PPM],dtype=np.int32)
mask=np.zeros((36*PPM,120*PPM),dtype=np.uint8)
obstacle_ids=[]
for m in meta:
    lo,hi=np.array(m['bounds']);
    physical=(m['mat']in ['Plastic_yellow','Plastic_red','Plastic_green','tyres','tyres_new','RubberBlack','Cone']and lo[1]<.65)or m['id']in [61,62,154,209]
    if not physical:continue
    obstacle_ids.append(m['id']);pos=data['p'+str(m['id'])];idx=data['i'+str(m['id'])]
    for face in idx:
        q=pos[face]
        if q[:,1].min()>1.2:continue
        cv2.fillConvexPoly(mask,pixel(q[:,0],q[:,2]).T,255)
mask=cv2.dilate(mask,np.ones((3,3),np.uint8));distance=cv2.distanceTransform(255-mask,cv2.DIST_L2,5)/PPM
def blocked(x,z):
    xx,zz=pixel(x,z)
    return xx<0 or zz<0 or xx>=mask.shape[1]or zz>=mask.shape[0]or mask[zz,xx]>0
def clearance(x,z):
    xx,zz=pixel(x,z);return float(distance[zz,xx])if 0<=xx<mask.shape[1]and 0<=zz<mask.shape[0]else 0
pos=data['p486'];idx=data['i486'];_,unique,weld=np.unique(np.round(pos,4),axis=0,return_index=True,return_inverse=True);pos=pos[unique];idx=weld[idx];quads=[set(idx[i:i+2].ravel().tolist())for i in range(0,len(idx),2)]
centres=np.array([pos[list(q)].mean(0)for q in quads]);edges=collections.defaultdict(list)
for i,q in enumerate(quads):
    for j in range(i):
        if len(q&quads[j])==2:edges[i].append(j);edges[j].append(i)
assert all(len(v)==2 for v in edges.values())
order=[0];prev=-1
while len(order)<len(quads):
    nxt=next(v for v in edges[order[-1]]if v!=prev);prev=order[-1];assert nxt not in order;order.append(nxt)
pts=centres[order][:,[0,2]]
start=int(np.argmin(np.sum((pts-np.array([1.25,-8.9]))**2,axis=1)));pts=np.roll(pts,-start,axis=0)
if pts[1,0]<pts[0,0]:pts=np.r_[pts[:1],pts[:0:-1]]
def rays(p,r):
    out=[]
    for side in [-1,1]:
        d=.08
        while d<8 and not blocked(*(p+r*d*side)):d+=.04
        out.append(d)
    return out
# Move away from the racing-line apex towards the actual middle of each lane.
for _ in range(2):
    fitted=[]
    for i,p in enumerate(pts):
        d=pts[(i+2)%len(pts)]-pts[(i-2)%len(pts)];r=np.array([d[1],-d[0]]);r/=np.linalg.norm(r);a,b=rays(p,r)
        fitted.append(p+r*float(np.clip((b-a)*.5,-1,1)))
    pts=np.array(fitted);pts=(np.roll(pts,1,axis=0)+2*pts+np.roll(pts,-1,axis=0))/4
# Round the measured apexes without cutting through the circular tyre ends.
soft=cv2.GaussianBlur(distance,(7,7),0);gz,gx=np.gradient(soft);gx*=PPM;gz*=PPM
for _ in range(65):
    delta=(np.roll(pts,1,axis=0)+np.roll(pts,-1,axis=0)-2*pts)*.22
    for i,p in enumerate(pts):
        xx,zz=pixel(*p);c=distance[zz,xx]
        if c<1.7:
            grad=np.array([gx[zz,xx],gz[zz,xx]]);norm=np.linalg.norm(grad)
            if norm>.05:delta[i]+=grad/norm*min(.2,(1.7-c)*.35)
    pts+=delta
route=[];bad=[]
for i,p in enumerate(pts):
    d=pts[(i+1)%len(pts)]-pts[(i-1)%len(pts)];r=np.array([d[1],-d[0]]);r/=np.linalg.norm(r);a,b=rays(p,r)
    # Conservative symmetric ribbon retains real plastic/tyre boundaries. More than
    # one kart fits even in the tighter turns after the single uniform world scaling.
    # Euclidean clearance is conservative even at the rounded tyre ends, where
    # a normal ray can miss the nearest diagonal face. Leave room for the existing
    # physics' 0.55-unit wall margin and its interpolated tangent frame.
    half=max(.4,min(a,b,clearance(*p))-.30)*SCALE
    route.append([round(float(p[0]*SCALE),5),.04,round(float(p[1]*SCALE),5),round(half*2,4)])
    if clearance(*p)<.45:bad.append([i,p.tolist(),clearance(*p)])
# Place s=0 exactly on the original TRKLINE start/finish stripe, rather than at
# the nearest (unevenly spaced) skid-ribbon quad centre.
for i,p in enumerate(route):
    q=route[(i+1)%len(route)];finish_x=1.25*SCALE
    if p[0]<=finish_x<q[0] and -12.13*SCALE<p[2]<-5.65*SCALE:
        t=(finish_x-p[0])/(q[0]-p[0]);finish=[float(a+(b-a)*t)for a,b in zip(p,q)]
        route=[finish]+route[i+1:]+route[:i+1]
        break
(ROOT/'src/minigames/kart-race/primoRoute.json').write_text(json.dumps(route,separators=(',',':')))
np.savez_compressed(OUT/'collision-field.npz',mask=mask,distance=distance)
im=np.zeros((*mask.shape,3),np.uint8);im[:]=[48,60,68];im[mask>0]=[84,195,225];line=np.array([pixel(p[0]/SCALE,p[2]/SCALE)for p in route]);cv2.polylines(im,[line],True,(150,235,120),3)
for i in range(0,len(line),8):cv2.putText(im,str(i),tuple(line[i]),cv2.FONT_HERSHEY_SIMPLEX,.65,(250,230,180),1,cv2.LINE_AA)
cv2.imwrite(str(OUT/'analysis-route.png'),im)
report={'scale':SCALE,'routePoints':len(route),'widthMin':min(p[3]for p in route),'badCentres':bad,'obstacleMeshes':obstacle_ids,'sourceRibbon':486,'pit':'Separate blind bays west of race loop; excluded from the competitive route.'}
(OUT/'route-analysis.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='obstacleMeshes'}))
