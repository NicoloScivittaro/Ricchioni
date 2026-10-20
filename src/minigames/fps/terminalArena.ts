import type {Aabb} from '../../../shared/fpsMap';
import {rayVsAabb} from '../../../shared/fpsMap';
import type {FpsArenaPoint as ArenaPoint} from './importedFpsArena';
interface TerminalData {cell:number;radius:number;bounds:number[];triangles:number[][];nodes:number[][];edges:number[][];spawns:number[];barriers:Aabb[];headroom?:number[]}
const SIZE=4;
/** Source architecture/large covers only for shots. Locomotion is a separate,
 * radius-eroded multilevel graph sampled from floors, stairs and body clearance. */
export class TerminalArena {
  readonly name='TERMINAL';readonly halfSize=78;readonly obstacles:Aabb[];
  readonly spawns:ArenaPoint[];readonly nav:ArenaPoint[];
  private support=new Map<number,boolean>();
  private cells=new Map<string,number[]>();private walk=new Map<string,number[]>();private fields=new Map<number,Int32Array>();
  static async load():Promise<TerminalArena>{const r=await fetch('/assets/fps/terminal/arena.json');if(!r.ok)throw new Error('Terminal collision HTTP '+r.status);return new TerminalArena(await r.json());}
  constructor(private data:TerminalData){
    this.obstacles=data.barriers;this.nav=data.nodes.map(([x,y,z])=>({x,y,z}));this.spawns=data.spawns.map(i=>this.nav[i]);
    if(this.spawns.length<5||!this.nav.length)throw new Error('Terminal: arena incompleta');
    data.triangles.forEach((t,i)=>{for(let x=Math.floor(Math.min(t[0],t[3],t[6])/SIZE);x<=Math.floor(Math.max(t[0],t[3],t[6])/SIZE);x++)for(let z=Math.floor(Math.min(t[2],t[5],t[8])/SIZE);z<=Math.floor(Math.max(t[2],t[5],t[8])/SIZE);z++){const k=x+':'+z,list=this.cells.get(k);if(list)list.push(i);else this.cells.set(k,[i]);}});
    this.nav.forEach((p,i)=>{const k=this.key(p.x,p.z),list=this.walk.get(k);if(list)list.push(i);else this.walk.set(k,[i]);});
    for(const p of this.spawns){const i=this.at(p.x,p.z,p.y,1.8);if(i<0||!this.supported(i))throw new Error('Terminal: spawn senza pavimento '+JSON.stringify(p));}
  }
  /** Cached physical support rejects graph-only surfaces and wide source holes.
   * A body may straddle a narrow seam, but must have real support on both sides. */
  private supported(i:number):boolean{
    const cached=this.support.get(i);if(cached!==undefined)return cached;
    const p=this.nav[i],y=(p.y??0)+.55;
    // The graph spans stair lips up to the same .53 m step as movement.
    const hit=(x:number,z:number)=>Math.abs(this.ray(x,y,z,0,-1,0,1.1)-.55)<.54;
    const ok=hit(p.x,p.z)||(hit(p.x-.18,p.z)&&hit(p.x+.18,p.z))||(hit(p.x,p.z-.18)&&hit(p.x,p.z+.18));
    this.support.set(i,ok);return ok;
  }
  private key(x:number,z:number):string{return Math.round((x-this.data.bounds[0])/this.data.cell)+':'+Math.round((z-this.data.bounds[2])/this.data.cell);}
  private at(x:number,z:number,y?:number,height=0):number{
    const list=this.walk.get(this.key(x,z))??[];let best=-1,score=Infinity;
    for(const i of list){if((this.data.headroom?.[i]??12)<height||!this.supported(i))continue;const n=this.nav[i],s=y===undefined?-(n.y??0):Math.abs((n.y??0)-y);if(s<score){score=s;best=i;}}
    return best;
  }
  floorAt(x:number,z:number,y?:number):number|null{const i=this.at(x,z,y);return i<0?null:this.nav[i].y??0;}
  isClear(x:number,z:number,_radius=this.data.radius,y?:number):boolean{return this.at(x,z,y)>=0;}
  private closest(p:ArenaPoint):number{
    const exact=this.at(p.x,p.z,p.y);if(exact>=0)return exact;
    let best=0,score=Infinity;this.nav.forEach((q,i)=>{const d=(q.x-p.x)**2+(q.z-p.z)**2+((q.y??0)-(p.y??0))**2*4;if(d<score){score=d;best=i;}});return best;
  }
  headroomAt(x:number,z:number,y:number):number{const i=this.at(x,z,y);return i<0?0:this.data.headroom?.[i]??12;}
  floorBelow(x:number,z:number,y:number):number|null{
    let floor:number|null=null;for(const i of this.walk.get(this.key(x,z))??[]){const h=this.nav[i].y??0;if(h<=y&&(floor===null||h>floor)&&this.supported(i))floor=h;}return floor;
  }
  /** Air movement uses real supported layers and their body clearance, without
   * requiring a ground-walking edge across a low cover or a stair lip. */
  moveAir(from:ArenaPoint,to:ArenaPoint,height:number):ArenaPoint{
    let p={...from};const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.1)),dx=(to.x-from.x)/steps,dz=(to.z-from.z)/steps;
    const attempt=(x:number,z:number)=>{
      const r=this.data.radius,[x0,x1,z0,z1]=this.data.bounds;
      if(x<x0+r||x>x1-r||z<z0+r||z>z1-r)return false;
      const mx=x-p.x,mz=z-p.z,length=Math.hypot(mx,mz);if(length<1e-7)return true;
      const ux=mx/length,uz=mz/length;
      // Swept body samples, only while airborne: missing floor below is a real
      // gap to jump, while walls and cover still stop the body at every step.
      for(const h of [.08,height*.5,height-.03])for(const side of[-r,0,r]){
        const hit=this.ray(p.x-uz*side,(p.y??0)+h,p.z+ux*side,ux,0,uz,length+r);
        if(hit<length+r-.008)return false;
      }
      p={x,z,y:p.y};return true;
    };
    for(let n=0;n<steps;n++)if(!attempt(p.x+dx,p.z+dz)){attempt(p.x+dx,p.z);attempt(p.x,p.z+dz);}return p;
  }
  move(from:ArenaPoint,to:ArenaPoint,height=1.8):ArenaPoint{
    let p={...from};const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.12));const dx=(to.x-from.x)/steps,dz=(to.z-from.z)/steps;
    const attempt=(x:number,z:number):boolean=>{
      const a=this.at(p.x,p.z,p.y);let b=this.at(x,z,p.y);
      // Enter low doorways at crouched clearance; the shared simulation updates
      // posture from destination headroom in this same tick.
      // Select the nearest physical layer before checking clearance, otherwise
      // a low cabin door wrongly selects the apron several metres below.
      if(b>=0&&(this.data.headroom?.[b]??12)<Math.min(height,1.05))b=-1;
      if(a<0||b<0||Math.abs((this.nav[b].y??0)-(p.y??0))>.53)return false;
      if(a!==b&&!this.data.edges[a].includes(b))return false;
      p={x,z,y:this.nav[b].y};return true;
    };
    for(let i=0;i<steps;i++)if(!attempt(p.x+dx,p.z+dz)){attempt(p.x+dx,p.z);attempt(p.x,p.z+dz);}
    return p;
  }
  canTraverse(p:ArenaPoint,q:ArenaPoint):boolean{const dest=this.move(p,q,1.05);return Math.hypot(dest.x-q.x,dest.z-q.z)<.08&&Math.abs((dest.y??0)-(q.y??dest.y??0))<.35;}
  nextWaypoint(p:ArenaPoint,q:ArenaPoint):ArenaPoint{
    const goal=this.closest(q);let f=this.fields.get(goal);
    if(!f){f=new Int32Array(this.nav.length).fill(-1);f[goal]=0;const queue=[goal];for(let n=0;n<queue.length;n++)for(const v of this.data.edges[queue[n]])if(f[v]<0){f[v]=f[queue[n]]+1;queue.push(v);}if(this.fields.size>=16)this.fields.clear();this.fields.set(goal,f);}
    let here=this.closest(p),dest=this.nav[here];for(let i=0;i<7;i++){const next=this.data.edges[here].filter(n=>f![n]>=0&&f![n]<f![here]).sort((a,b)=>f![a]-f![b])[0];if(next===undefined)break;const candidate=this.nav[next];if(!this.canTraverse(p,candidate))break;dest=candidate;here=next;}return dest;
  }
  ray(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number,max:number):number{
    let best=max;for(const b of this.obstacles){const t=rayVsAabb(ox,oy,oz,dx,dy,dz,b);if(t!==null)best=Math.min(best,t);}
    const tested=new Set<number>();
    const test=(cx:number,cz:number)=>{for(const i of this.cells.get(cx+':'+cz)??[]){if(tested.has(i))continue;tested.add(i);const t=this.data.triangles[i];
      const ax=t[3]-t[0],ay=t[4]-t[1],az=t[5]-t[2],bx=t[6]-t[0],by=t[7]-t[1],bz=t[8]-t[2];
      const px=dy*bz-dz*by,py=dz*bx-dx*bz,pz=dx*by-dy*bx,det=ax*px+ay*py+az*pz;if(Math.abs(det)<1e-9)continue;
      const inv=1/det,tx=ox-t[0],ty=oy-t[1],tz=oz-t[2],u=(tx*px+ty*py+tz*pz)*inv;if(u<-.00001||u>1.00001)continue;
      const qx=ty*az-tz*ay,qy=tz*ax-tx*az,qz=tx*ay-ty*ax,v=(dx*qx+dy*qy+dz*qz)*inv;if(v<-.00001||u+v>1.00001)continue;
      const distance=(bx*qx+by*qy+bz*qz)*inv;if(distance>=.00001&&distance<best)best=distance;
    }};
    let cx=Math.floor(ox/SIZE),cz=Math.floor(oz/SIZE),travel=0;const sx=Math.sign(dx),sz=Math.sign(dz),strideX=dx?SIZE/Math.abs(dx):Infinity,strideZ=dz?SIZE/Math.abs(dz):Infinity;
    let nextX=dx?((cx+(dx>0?1:0))*SIZE-ox)/dx:Infinity,nextZ=dz?((cz+(dz>0?1:0))*SIZE-oz)/dz:Infinity;
    while(travel<=best){test(cx,cz);if(!dx&&!dz)break;if(nextX<nextZ){travel=nextX;nextX+=strideX;cx+=sx;}else{travel=nextZ;nextZ+=strideZ;cz+=sz;}}return best;
  }
  visible(p:ArenaPoint,q:ArenaPoint):boolean{const dx=q.x-p.x,dy=(q.y??0)+(q.eyeHeight??1.5)-(p.y??0)-(p.eyeHeight??1.5),dz=q.z-p.z,d=Math.hypot(dx,dy,dz);return d<.01||this.ray(p.x,(p.y??0)+(p.eyeHeight??1.5),p.z,dx/d,dy/d,dz/d,d)>=d-.025;}
  blastVisible(p:{x:number;y:number;z:number},q:ArenaPoint):boolean{return(q.crouching?[.25,.6,.95]:[.35,1,1.65]).some(h=>{const dx=q.x-p.x,dy=(q.y??0)+h-p.y,dz=q.z-p.z,d=Math.hypot(dx,dy,dz);return d<.01||this.ray(p.x,p.y,p.z,dx/d,dy/d,dz/d,d)>=d-.02;});}
}
