"""Build/validate a corridor on the asset's road triangles, not on its scenery.
Run after sydney-analyze.py. Units below are the original FBX road units.
"""
import json, pathlib, numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'docs/agent-work/sydney-sprint'
data=np.load(OUT/'analysis-meshes.npz')
# Explicit driving mesh/material whitelist; ShadowCollision is deliberately excluded.
ids=[11,13,14,15,18,19,21,23,24]
tri=np.concatenate([data[f'p{i}'][data[f'i{i}']] for i in ids])
n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); good=abs(n[:,1])>np.linalg.norm(n,axis=1)*.65
tri=tri[good]; a=tri[:,0][:,[0,2]];v0=tri[:,1][:,[0,2]]-a;v1=tri[:,2][:,[0,2]]-a
den=v0[:,0]*v1[:,1]-v1[:,0]*v0[:,1];den[abs(den)<1e-9]=1e-9
grid={}
for i,face in enumerate(tri):
    lo=np.floor(face[:,[0,2]].min(0)/32).astype(int);hi=np.floor(face[:,[0,2]].max(0)/32).astype(int)
    for gx in range(lo[0],hi[0]+1):
        for gz in range(lo[1],hi[1]+1):grid.setdefault((gx,gz),[]).append(i)
def ground(x,z,hint,with_normal=False):
    ii=grid.get((int(np.floor(x/32)),int(np.floor(z/32))),[])
    if not ii:return None
    v2=np.array([x,z])-a[ii];u=(v2[:,0]*v1[ii,1]-v1[ii,0]*v2[:,1])/den[ii];v=(v0[ii,0]*v2[:,1]-v2[:,0]*v0[ii,1])/den[ii]
    sel=(u>=-1e-5)&(v>=-1e-5)&(u+v<=1.00001)
    q=tri[ii];heights=q[:,0,1]+u*(q[:,1,1]-q[:,0,1])+v*(q[:,2,1]-q[:,0,1]);hs=heights[sel]
    if not len(hs):return None
    hit=int(np.argmin(abs(hs-hint)))
    if not with_normal:return float(hs[hit])
    face=q[sel][hit];normal=np.cross(face[1]-face[0],face[2]-face[0]);normal/=np.linalg.norm(normal)
    if normal[1]<0:normal=-normal
    return float(hs[hit]),normal
# Clockwise waterfront, Opera ramp, actual harbour gap, bridge loop, old city, southern streets.
# x, expected height, z. The launch vector follows the supplied DashGlide ramp normal.
controls=np.array([
[60,0,0],[110,0,-12],[180,0,-26],[240,0,-40],[275,0,-64],
[280,0,-100],[280,0,-130],[255,8,-147],[229,8,-155],[228,8,-179],
[216,8,-200],[195,9,-216],[170,12,-228],[161.6,13.8,-233],
[125,11,-256],[80,8,-285],[35,5,-317],[-15,4,-350],
[-60,6,-376],[-93,9,-402],[-106,12,-435],[-94,14,-469],[-65,15,-484],[-30,15,-477],[0,17,-453],[17,18,-422],[12,19,-390],[-3,20,-355],
[-35,20,-310],[-73,19,-258],[-113,19,-202],[-155,19,-145],[-195,19,-90],[-230,19,-40],[-245,19,-6],
[-212,19,8],[-166,19,35],[-120,19,64],[-79,19,89],[-76,19,120],[-85,19,155],[-84,19,187],[-67,19,213],[-35,17,230],[0,13,232],[29,8,211],[47,1,176],[49,0,130],[49,0,65],[49,0,27]
],dtype=float)
controls[37,2]-=18
# Fit the rough landmark waypoints to the centre of the actual road footprint.
# A raster clearance field is only an offline aid; runtime collision remains the race ribbon.
fields={}
for level in [0,4,8,12,16,20]:
    mask=Image.new('L',(2100,2300));draw=ImageDraw.Draw(mask)
    for face in tri:
        if abs(face[:,1].mean()-level)>3.8:continue
        if face[:,0].min()>120 and face[:,1].max()>14:continue
        draw.polygon([(int((v[0]+750)*2),int((v[2]+850)*2)) for v in face],fill=255)
    clear=np.zeros((2300,2100),dtype=np.float32);eroded=mask
    for i in range(1,36):
        clear[np.asarray(eroded)>0]=i*.5;eroded=eroded.filter(ImageFilter.MinFilter(3))
    fields[level]=clear
def snap(x,z,hint,radius=32):
    clear=fields[min(fields,key=lambda k:abs(k-hint))]
    px=int((x+750)*2);pz=int((z+850)*2);r=int(radius*2)
    yy,xx=np.mgrid[max(0,pz-r):min(2300,pz+r+1),max(0,px-r):min(2100,px+r+1)]
    dist=((xx-px)**2+(yy-pz)**2)*.25;field=clear[yy,xx]
    score=dist+np.maximum(0,10-field)**2*10
    score[field<5]=1e9
    q=np.unravel_index(np.argmin(score),score.shape)
    return np.array([xx[q]/2-750,yy[q]/2-850])
for i,p in enumerate(controls):
    if 13<=i<=17:continue
    p[[0,2]]=snap(p[0],p[2],p[1])
def catmull(t):
    k=int(t)%len(controls);u=t-int(t);p0=controls[(k-1)%len(controls)];p1=controls[k];p2=controls[(k+1)%len(controls)];p3=controls[(k+2)%len(controls)]
    return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u**3)
points=[]; misses=[];scale=.65
for t in np.arange(0,len(controls),.08):
    p=catmull(t);x,h,z=p
    # Only this measured water interval lacks road, between the real ramp and bridge approach.
    flight=13<=t<17.2
    y=ground(x,z,h)
    if y is None and not flight:misses.append([round(t,3),round(x,2),round(z,2)])
    if y is not None and not flight:p[1]=y
    # Two short, explicitly rendered access ramps bridge the supplied stair steps.
    # Keep the original DashGlide surface and its physical launch direction.
    access=6.12<=t<=6.9
    ramp_access=12.05<=t<=12.65
    if access:p[1]=8*float(np.clip((t-6.12)/.78,0,1))
    if ramp_access:p[1]=10+2.2*float(np.clip((t-12.05)/.6,0,1))
    p[1]+=.065/scale
    d=catmull(t+.01)-catmull(t-.01);r=np.array([d[2],-d[0]]);r/=np.linalg.norm(r)
    if not flight and not access and not ramp_access:
        # Recentre within this height layer, not the overlapping street below it.
        edges=[]
        for side in [-1,1]:
            edge=0
            for off in np.arange(.75,22,.75):
                yy=ground(x+r[0]*off*side,z+r[1]*off*side,p[1])
                if yy is None or abs(yy-p[1])>2.5:break
                edge=off
            edges.append(edge)
        if min(edges)<9 and max(edges)>min(edges)+2:
            shift=float(np.clip((edges[1]-edges[0])*.5,-8,8));x+=r[0]*shift;z+=r[1]*shift;p[0]=x;p[2]=z
            yy=ground(x,z,p[1])
            if yy is not None:p[1]=yy+.065/scale
    # Road half-width with physical kart clearance. Never use the red technical mesh as road.
    width=12.0
    if not flight and not access and not ramp_access:
        for off in np.arange(3,13,.4):
            ys=[ground(x+r[0]*off*s,z+r[1]*off*s,p[1]) for s in [-1,1]]
            if any(y is None or abs(y-p[1])>2.5 for y in ys):width=min(12,2*(off-.65)*scale);break
    if access:width=10
    if ramp_access:width=11
    points.append([round(v*scale,5) for v in p]+[round(width,3),round(float(t),3)])
# Smooth the measured centre corrections before final surface projection. This
# removes survey quantisation without drawing a new road or changing the flight.
points=np.array(points)
for _ in range(2):
    xy=points[:,[0,2]].copy()
    points[:,[0,2]]=(np.roll(xy,2,axis=0)+2*np.roll(xy,1,axis=0)+3*xy+2*np.roll(xy,-1,axis=0)+np.roll(xy,-2,axis=0))/9
final=[]
for p in points:
    t=p[4];normal=np.array([0.,1.,0.]);ramp=6.04<=t<=6.96 or 11.96<=t<=12.72;flight=13<=t<17.2
    if not ramp and not flight:
        hit=ground(p[0]/scale,p[2]/scale,p[1]/scale,True)
        if hit is not None:p[1]=hit[0]*scale+.065;normal=hit[1]
    final.append([round(float(v),5) for v in p]+[round(float(v),6) for v in normal])
points=final
route=ROOT/'src/minigames/kart-race/sydneyRoute.json';route.write_text(json.dumps(points,separators=(',',':')))
im=Image.open(OUT/'analysis-roads.png');d=ImageDraw.Draw(im)
pixels=[(int((p[0]/scale+850)*1.65+30),int((p[2]/scale+840)*1.65+30)) for p in points]
d.line(pixels+[pixels[0]],fill='#ff375c',width=4)
for i,p in enumerate(controls):
    px,py=int((p[0]+850)*1.65+30),int((p[2]+840)*1.65+30);d.ellipse((px-3,py-3,px+3,py+3),fill='yellow');d.text((px+4,py-10),str(i),fill='yellow')
im.save(OUT/'analysis-route.png');(OUT/'route-analysis.json').write_text(json.dumps({'scale':scale,'points':len(points),'misses':misses,'widthMin':min(p[3] for p in points)},indent=2))
print('points',len(points),'widthMin',min(p[3] for p in points),'misses',len(misses));print(misses[:60])
