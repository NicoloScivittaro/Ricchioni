import geometry from './nuketownGeometry.json';
import {circleVsAabb, rayVsAabb} from '../../../shared/fpsMap';
import type {Aabb} from '../../../shared/fpsMap';

export interface ArenaPoint {x:number;z:number;y?:number}
export const NUKETOWN_BOUNDS={minX:-17.1,maxX:10,minZ:-40.3,maxZ:40.5};
/** Visible construction blocks close the upper floors, unsupported by FPS locomotion. */
export const NUKETOWN_BARRIERS:Aabb[]=[
  {x:-17.1,z:0,w:.3,d:8.4,h:1.6}, {x:10,z:0,w:.3,d:12.5,h:1.6},
  {x:-2.1,z:-24.7,w:5.1,d:1.6,h:1.35},
  {x:2.85,z:-16.3,w:1.9,d:5.9,h:1.35},
  {x:-8.8,z:12.8,w:1.85,d:5.8,h:1.35},
  {x:-2.1,z:21.5,w:5.1,d:1.7,h:1.35},
  {x:-6.4,z:-18.2,w:2.5,d:1.0,h:1.35}
];
const SIZE=4,CELL=.5,RADIUS=.7;
const key=(x:number,z:number)=>`${Math.floor(x/SIZE)}:${Math.floor(z/SIZE)}`;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
type Box=Aabb&{base:number};

/** No Babylon colliders. A coarse spatial index bounds the work; shots use exact
 * source triangles (doors, windows, vehicle openings and fence gaps stay open).
 * Ground movement uses merged boxes and swept body clearance, separately. */
export class NuketownArena {
  readonly name='NUKETOWN';
  readonly halfSize=41;
  readonly obstacles:Box[]=geometry.movementBoxes.map(b=>({x:(b[0]+b[3])/2,z:(b[2]+b[5])/2,w:b[3]-b[0],d:b[5]-b[2],h:b[4]-b[1],base:b[1]}));
  readonly spawns:ArenaPoint[]=[];
  readonly nav:ArenaPoint[]=[];
  private triangleCells=new Map<string,number[]>();
  private boxCells=new Map<string,Box[]>();
  private width=Math.ceil((NUKETOWN_BOUNDS.maxX-NUKETOWN_BOUNDS.minX)/CELL)+1;
  private height=Math.ceil((NUKETOWN_BOUNDS.maxZ-NUKETOWN_BOUNDS.minZ)/CELL)+1;
  private open=new Uint8Array(this.width*this.height);
  private fields=new Map<number,Int16Array>();
  constructor(){
    const insert=<T>(cells:Map<string,T[]>,value:T,minX:number,maxX:number,minZ:number,maxZ:number)=>{
      for(let x=Math.floor(minX/SIZE);x<=Math.floor(maxX/SIZE);x++)for(let z=Math.floor(minZ/SIZE);z<=Math.floor(maxZ/SIZE);z++){
        const k=`${x}:${z}`,list=cells.get(k);if(list)list.push(value);else cells.set(k,[value]);
      }
    };
    geometry.triangles.forEach((t,i)=>insert(this.triangleCells,i,Math.min(t[0],t[3],t[6]),Math.max(t[0],t[3],t[6]),Math.min(t[2],t[5],t[8]),Math.max(t[2],t[5],t[8])));
    this.obstacles.push(...NUKETOWN_BARRIERS.map(b=>({...b,base:0})));
    for(const b of this.obstacles)insert(this.boxCells,b,b.x-b.w/2-RADIUS,b.x+b.w/2+RADIUS,b.z-b.d/2-RADIUS,b.z+b.d/2+RADIUS);
    for(let i=0;i<this.open.length;i++){const p=this.point(i);this.open[i]=Number(this.isClear(p.x,p.z,.74)&&this.floorAt(p.x,p.z)!==null);}
    // Keep the single connected ground-floor arena; never spawn in isolated scenery.
    const seen=new Uint8Array(this.open.length);let largest:number[]=[];
    for(let i=0;i<this.open.length;i++)if(this.open[i]&&!seen[i]){
      const component=[i];seen[i]=1;
      for(let j=0;j<component.length;j++)for(const n of this.neighbors(component[j]))if(!seen[n]){seen[n]=1;component.push(n);}
      if(component.length>largest.length)largest=component;
    }
    this.open.fill(0);for(const i of largest){this.open[i]=1;this.nav.push(this.point(i));}
    for(const [x,z] of [[-13,-32],[6,-33],[-8,-29],[2,-28],[-14,-8],[7,-9],[-12,8],[7,8],[-13,23],[6,23],[-13,33],[6,32],[-2,-18],[-5,13],[6,-16],[-13,16]]){
      const p=this.point(this.closest({x,z}));this.spawns.push({...p,y:this.floorAt(p.x,p.z)??0});
    }
  }
  floorAt(x:number,z:number):number|null{
    const hit=this.ray(x,.32,z,0,-1,0,.8,false);return hit<.8?.32-hit:null;
  }
  private boxesAt(x:number,z:number):readonly Box[]{return this.boxCells.get(key(x,z))??[];}
  isClear(x:number,z:number,r=RADIUS):boolean{
    const b=NUKETOWN_BOUNDS;
    return x>=b.minX+r&&x<=b.maxX-r&&z>=b.minZ+r&&z<=b.maxZ-r&&!this.boxesAt(x,z).some(o=>!!circleVsAabb(x,z,r,o));
  }
  move(from:ArenaPoint,to:ArenaPoint):ArenaPoint{
    let x=from.x,z=from.z;
    const steps=Math.max(1,Math.ceil(Math.hypot(to.x-x,to.z-z)/.18)),dx=(to.x-x)/steps,dz=(to.z-z)/steps,b=NUKETOWN_BOUNDS;
    for(let i=0;i<steps;i++){
      let nx=clamp(x+dx,b.minX+RADIUS,b.maxX-RADIUS),nz=clamp(z+dz,b.minZ+RADIUS,b.maxZ-RADIUS);
      for(let j=0;j<4;j++)for(const o of this.boxesAt(nx,nz)){const p=circleVsAabb(nx,nz,RADIUS,o);if(p){nx+=p.x;nz+=p.z;}}
      if(this.isClear(nx,nz,RADIUS-.001)&&this.floorAt(nx,nz)!==null){x=nx;z=nz;}
    }
    return{x,z,y:this.floorAt(x,z)??from.y??0};
  }
  /** Double-sided Moller-Trumbore; same authoritative ray for hip fire and ADS. */
  ray(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number,max:number,barriers=true):number{
    let best=max;
    if(barriers)for(const b of NUKETOWN_BARRIERS){const t=rayVsAabb(ox,oy,oz,dx,dy,dz,b);if(t!==null&&t<best)best=t;}
    const tested=new Set<number>();
    const test=(cx:number,cz:number)=>{
      for(const index of this.triangleCells.get(`${cx}:${cz}`)??[]){
        if(tested.has(index))continue;tested.add(index);
        const t=geometry.triangles[index],ax=t[3]-t[0],ay=t[4]-t[1],az=t[5]-t[2],bx=t[6]-t[0],by=t[7]-t[1],bz=t[8]-t[2];
        const px=dy*bz-dz*by,py=dz*bx-dx*bz,pz=dx*by-dy*bx,det=ax*px+ay*py+az*pz;
        if(Math.abs(det)<1e-9)continue;
        const inv=1/det,tx=ox-t[0],ty=oy-t[1],tz=oz-t[2],u=(tx*px+ty*py+tz*pz)*inv;
        if(u<-.00001||u>1.00001)continue;
        const qx=ty*az-tz*ay,qy=tz*ax-tx*az,qz=tx*ay-ty*ax,v=(dx*qx+dy*qy+dz*qz)*inv;
        if(v<-.00001||u+v>1.00001)continue;
        const distance=(bx*qx+by*qy+bz*qz)*inv;
        if(distance>=0&&distance<best)best=distance;
      }
    };
    let cx=Math.floor(ox/SIZE),cz=Math.floor(oz/SIZE),travel=0;
    const sx=Math.sign(dx),sz=Math.sign(dz),strideX=dx?SIZE/Math.abs(dx):Infinity,strideZ=dz?SIZE/Math.abs(dz):Infinity;
    let nextX=dx?((cx+(dx>0?1:0))*SIZE-ox)/dx:Infinity,nextZ=dz?((cz+(dz>0?1:0))*SIZE-oz)/dz:Infinity;
    while(travel<=best){test(cx,cz);if(!dx&&!dz)break;if(nextX<nextZ){travel=nextX;nextX+=strideX;cx+=sx;}else{travel=nextZ;nextZ+=strideZ;cz+=sz;}}
    return best;
  }
  visible(p:ArenaPoint,q:ArenaPoint):boolean{
    const dx=q.x-p.x,dy=(q.y??0)-(p.y??0),dz=q.z-p.z,d=Math.hypot(dx,dy,dz);
    return d<.01||this.ray(p.x,(p.y??0)+1.5,p.z,dx/d,dy/d,dz/d,d)>=d-.025;
  }
  blastVisible(origin:{x:number;y:number;z:number},target:ArenaPoint):boolean{
    return [.35,1,1.65].some(h=>{const dx=target.x-origin.x,dy=(target.y??0)+h-origin.y,dz=target.z-origin.z,d=Math.hypot(dx,dy,dz);return d<.01||this.ray(origin.x,origin.y,origin.z,dx/d,dy/d,dz/d,d)>=d-.015;});
  }
  private point(i:number):ArenaPoint{return{x:NUKETOWN_BOUNDS.minX+(i%this.width)*CELL,z:NUKETOWN_BOUNDS.minZ+Math.floor(i/this.width)*CELL};}
  private neighbors(i:number):number[]{return[i%this.width?i-1:-1,i%this.width<this.width-1?i+1:-1,i-this.width,i+this.width].filter(n=>n>=0&&n<this.open.length&&this.open[n]);}
  private closest(p:ArenaPoint):number{
    const i=clamp(Math.round((p.x-NUKETOWN_BOUNDS.minX)/CELL),0,this.width-1)+this.width*clamp(Math.round((p.z-NUKETOWN_BOUNDS.minZ)/CELL),0,this.height-1);
    if(this.open[i])return i;
    let best=i,distance=Infinity;for(let n=0;n<this.open.length;n++)if(this.open[n]){const q=this.point(n),d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<distance){distance=d;best=n;}}
    return best;
  }
  canTraverse(p:ArenaPoint,q:ArenaPoint):boolean{
    const steps=Math.ceil(Math.hypot(q.x-p.x,q.z-p.z)/.2);
    for(let i=1;i<=steps;i++)if(!this.isClear(p.x+(q.x-p.x)*i/steps,p.z+(q.z-p.z)*i/steps,.74))return false;return true;
  }
  nextWaypoint(p:ArenaPoint,q:ArenaPoint):ArenaPoint{
    const goal=this.closest(q);let field=this.fields.get(goal);
    if(!field){
      field=new Int16Array(this.open.length).fill(-1);field[goal]=0;const queue=[goal];
      for(let i=0;i<queue.length;i++)for(const n of this.neighbors(queue[i]))if(field[n]<0){field[n]=field[queue[i]]+1;queue.push(n);}
      if(this.fields.size>=32)this.fields.clear();this.fields.set(goal,field);
    }
    let here=this.closest(p),dest=this.point(here);
    for(let i=0;i<8;i++){
      const next=this.neighbors(here).filter(n=>field![n]>=0&&field![n]<field![here]).sort((a,b)=>field![a]-field![b])[0];
      if(next===undefined)break;
      const candidate=this.point(next);if(!this.canTraverse(p,candidate))break;dest=candidate;here=next;
    }
    return dest;
  }
}
