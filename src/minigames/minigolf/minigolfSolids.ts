import imported from './minigolfImported.json';
import {floorAt,heightAt,wallAt} from './minigolfCourses';
import {GOLF} from './minigolfTypes';
import type {Course,GolfBall,Floor,Wall} from './minigolfTypes';
type V={x:number;y:number;z:number};
type Tri={a:V;b:V;c:V;minY:number;maxY:number;top?:boolean};
const cache=new WeakMap<Course,Map<string,Tri[]>>();
const cell=(x:number,z:number)=>`${Math.floor(x/3)},${Math.floor(z/3)}`;
const sub=(a:V,b:V):V=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a:V,b:V)=>a.x*b.x+a.y*b.y+a.z*b.z;
const add=(a:V,b:V,s:number):V=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s});
/** Closest point includes edges/corners and ignores triangle winding. */
function closest(p:V,{a,b,c}:Tri):V{
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,ab,d1/(d1-d3));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,ac,d2/(d2-d6));
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return add(b,sub(c,b),(d4-d3)/(d4-d3+d5-d6));
 const denominator=va+vb+vc;if(Math.abs(denominator)<1e-12)return a;
 return add(add(a,ab,vb/denominator),ac,vc/denominator);
}
function slab(f:Floor):Tri[]{
 const corners=f.triangle??[{x:f.x-f.w/2,z:f.z-f.d/2},{x:f.x+f.w/2,z:f.z-f.d/2},{x:f.x+f.w/2,z:f.z+f.d/2},{x:f.x-f.w/2,z:f.z+f.d/2}];
 const top=corners.map(p=>({...p,y:heightAt(f,p)})),bottom=top.map(p=>({...p,y:p.y-.95})),triangles:Tri[]=[];
 const put=(a:V,b:V,c:V,top=false)=>triangles.push({a,b,c,minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y),top});
 // Upper contacts also catch a fast ball meeting a rising ramp between support samples.
 for(let i=1;i<bottom.length-1;i++){put(bottom[0],bottom[i],bottom[i+1]);put(top[0],top[i],top[i+1],true);}
 for(let i=0;i<top.length;i++){const j=(i+1)%top.length;put(top[i],top[j],bottom[i]);put(top[j],bottom[j],bottom[i]);}
 return triangles;
}
function caps(w:Wall):Tri[]{
 const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,length=Math.hypot(dx,dz)||1,ux=dx/length,uz=dz/length,r=w.radius;
 const corners=[{x:w.a.x-ux*r-uz*r,z:w.a.z-uz*r+ux*r},{x:w.b.x+ux*r-uz*r,z:w.b.z+uz*r+ux*r},{x:w.b.x+ux*r+uz*r,z:w.b.z+uz*r-ux*r},{x:w.a.x-ux*r+uz*r,z:w.a.z-uz*r-ux*r}],triangles:Tri[]=[];
 for(const y of [w.y,w.y+(w.height??(w.rotation?.45:.7))]){const v=corners.map(p=>({...p,y}));for(const i of [1,2])triangles.push({a:v[0],b:v[i],c:v[i+1],minY:y,maxY:y});}return triangles;
}
function grid(course:Course):Map<string,Tri[]>{
 let cells=cache.get(course);if(cells)return cells;cells=new Map();const triangles:Tri[]=[];
 if(course.imported)for(const part of imported[course.imported].geometry){
  const v=part.positions,index=part.indices;for(let i=0;i<index.length;i+=3){const points=index.slice(i,i+3).map(j=>({x:v[j*3],y:v[j*3+1],z:v[j*3+2]})),[a,b,c]=points;
   const ab=sub(b,a),ac=sub(c,a),nx=ab.y*ac.z-ab.z*ac.y,ny=ab.z*ac.x-ab.x*ac.z,nz=ab.x*ac.y-ab.y*ac.x;
   if(nx*nx+ny*ny+nz*nz<1e-12)continue;
   const top=Math.abs(ny)/Math.hypot(nx,ny,nz)>.55&&!/Light_Gray|Golden_Beige/.test(part.material);
   triangles.push({a,b,c,minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y),top});
  }
 }else{for(const f of course.floors)if(!f.motion)triangles.push(...slab(f));for(const w of course.walls)if(!w.rotation)triangles.push(...caps(w));}
 for(const tri of triangles)for(let x=Math.floor((Math.min(tri.a.x,tri.b.x,tri.c.x)-GOLF.radius)/3);x<=Math.floor((Math.max(tri.a.x,tri.b.x,tri.c.x)+GOLF.radius)/3);x++)for(let z=Math.floor((Math.min(tri.a.z,tri.b.z,tri.c.z)-GOLF.radius)/3);z<=Math.floor((Math.max(tri.a.z,tri.b.z,tri.c.z)+GOLF.radius)/3);z++){const key=`${x},${z}`,items=cells.get(key)??[];items.push(tri);cells.set(key,items);}
 cache.set(course,cells);return cells;
}
/** Spatial substeps keep full-power shots from tunnelling through thin, double-sided faces. */
export function resolveGolfSolids(ball:GolfBall,course:Course,time:number,previous:V):boolean{
 let hit=false;const triangles=grid(course).get(cell(ball.x,ball.z))??[];
 const moving=course.imported?[]:[...course.floors.filter(f=>f.motion).flatMap(f=>slab(floorAt(f,time))),...course.walls.filter(w=>w.rotation).flatMap(w=>caps(wallAt(w,time)))];
 for(const tri of [...triangles,...moving]){
  if(ball.y+GOLF.radius<tri.minY||ball.y-GOLF.radius>tri.maxY)continue;
  if(tri.top&&ball.grounded)continue;
  const q=closest(ball,tri),delta=sub(ball,q),distance=Math.hypot(delta.x,delta.y,delta.z);if(distance>=GOLF.radius-.00001)continue;
  let normal=distance>1e-7?{x:delta.x/distance,y:delta.y/distance,z:delta.z/distance}:sub(previous,q),length=Math.hypot(normal.x,normal.y,normal.z);if(length<1e-8)continue;normal={x:normal.x/length,y:normal.y/length,z:normal.z/length};
  // A supported rolling ball uses vertical radius in the floor solver. Do not
  // repeatedly project that same slope contact (which would drain its speed).
  if(ball.grounded&&normal.y>.6&&Math.abs(ball.y-q.y-GOLF.radius)<GOLF.surfaceSnap)continue;
  const penetration=GOLF.radius-distance+.00001;ball.x+=normal.x*penetration;ball.y+=normal.y*penetration;ball.z+=normal.z*penetration;
  const velocity=ball.vx*normal.x+ball.vy*normal.y+ball.vz*normal.z;
  if(velocity<0){const rests=normal.y>.6&&velocity> -7,restitution=rests?0:Math.abs(normal.y)>.6?GOLF.verticalRestitution:GOLF.restitution,j=-(1+restitution)*velocity;ball.vx+=j*normal.x;ball.vy+=j*normal.y;ball.vz+=j*normal.z;if(rests)ball.grounded=true;hit=true;}
 }
 return hit;
}
