import {rayVsAabb, resolveCollisions} from '../fpsMap';
import type {Aabb} from '../fpsMap';
import {MYSTERY_BOX}from './zombiesRules';

export interface Point {x:number;z:number}
export const ARENA_W=44, ARENA_D=36;
export const COVERS:(Aabb & {kind:'container'|'crate'|'machine'|'wall'|'mystery'})[]=[
 {x:0,z:-18,w:45,d:1,h:6,kind:'wall'},{x:0,z:18,w:45,d:1,h:6,kind:'wall'},
 {x:-22,z:0,w:1,d:36,h:6,kind:'wall'},{x:22,z:0,w:1,d:36,h:6,kind:'wall'},
 {x:-11,z:-6,w:4,d:8,h:2.7,kind:'container'}, {x:11,z:5,w:4,d:8,h:2.7,kind:'container'},
 {x:-11,z:8,w:4,d:5,h:2.7,kind:'container'}, {x:11,z:-8,w:4,d:5,h:2.7,kind:'container'},
 {x:-3,z:1,w:2.8,d:3,h:1.45,kind:'crate'}, {x:4,z:-3,w:3,d:2.5,h:1.45,kind:'crate'},
 {x:3,z:8,w:2.6,d:2.5,h:2,kind:'machine'}, {x:-17,z:0,w:2,d:2,h:1.3,kind:'crate'},
 {x:17,z:-1,w:2,d:2,h:1.3,kind:'crate'},
 {...MYSTERY_BOX,kind:'mystery'},
 // Raised loading dock: a solid plinth and two broad walkable ramps, no invisible floor.
 {x:0,z:14.7,w:20,d:3.6,h:1.6,kind:'machine'}
];
export const STARTS:Point[]=[{x:-6,z:-12},{x:0,z:-12},{x:6,z:-12},{x:-6,z:-8},{x:5,z:-8}];
export const GATES:Point[]=[{x:-19,z:-14},{x:19,z:-14},{x:-19,z:14},{x:19,z:14},{x:0,z:-16},{x:-19,z:0},{x:19,z:0},{x:0,z:15}];
export const SUPPLIES=[{x:-18,z:6,kind:'ammo'},{x:18,z:-7,kind:'ammo'},{x:0,z:14.5,kind:'health'}] as const;
export function floorAt(x:number,z:number):number{
 if(z>=12.9&&z<=16.5){if(Math.abs(x)<=10)return 1.6;if(Math.abs(x)<16)return(16-Math.abs(x))/6*1.6;}
 return 0;
}
export function free(x:number,z:number,r=.55):boolean{
 if(Math.abs(x)>21.2-r||Math.abs(z)>17.2-r)return false;
 const y=floorAt(x,z);
 return !COVERS.some(b=>b.h>y+.15&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);
}
export function move(x:number,z:number,dx:number,dz:number,r=.43,y=floorAt(x,z)):Point{
 const nx=Math.max(-21.1+r,Math.min(21.1-r,x+dx)),nz=Math.max(-17.1+r,Math.min(17.1-r,z+dz));
 const ground=floorAt(nx,nz);
 // Can't walk up the vertical dock edge. Both ramps remain available.
 const rampEntry=ground-y<.28;
 const blocks=COVERS.filter(b=>b.h>y+.23 && !(rampEntry&&ground>0&&Math.abs(nx)>9.8&&b===COVERS[COVERS.length-1]));
 const q=resolveCollisions(nx,nz,r,blocks);
 return q;
}
export function wallDistance(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number,range:number):number{
 let best=range;
 for(const b of COVERS){const t=rayVsAabb(ox,oy,oz,dx,dy,dz,b);if(t!==null&&t>=0)best=Math.min(best,t);}
 // Ramps use the same analytic height as movement; sample only rays near the floor.
 if(dy<0)for(let t=.25;t<best;t+=.25)if(oy+dy*t<floorAt(ox+dx*t,oz+dz*t)){best=t;break;}
 return best;
}
export function visible(a:Point,b:Point,ay=floorAt(a.x,a.z)+1.3,by=floorAt(b.x,b.z)+1.1):boolean{
 const dx=b.x-a.x,dy=by-ay,dz=b.z-a.z,d=Math.hypot(dx,dy,dz);return d<.1||wallDistance(a.x,ay,a.z,dx/d,dy/d,dz/d,d) >=d-.12;
}
const key=(x:number,z:number)=>`${x},${z}`;
/** Small immutable navigation graph, shared by all enemies. No diagonal corner cutting. */
export class DepotNavigation{
 readonly nodes=new Map<string,Point>();readonly links=new Map<string,string[]>();
 constructor(){
  for(let x=-20;x<=20;x++)for(let z=-16;z<=16;z++)if(free(x,z,.66))this.nodes.set(key(x,z),{x,z});
  for(const[k,p]of this.nodes){const edges:string[]=[];for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const n=key(p.x+dx,p.z+dz);if(!this.nodes.has(n))continue;if(dx&&dz&&(!this.nodes.has(key(p.x+dx,p.z))||!this.nodes.has(key(p.x,p.z+dz))))continue;
    const q=this.nodes.get(n)!;if(Math.abs(floorAt(p.x,p.z)-floorAt(q.x,q.z))>.4)continue;edges.push(n);
  }this.links.set(k,edges);}
 }
 nearest(p:Point):string{const k=key(Math.round(p.x),Math.round(p.z));if(this.nodes.has(k))return k;let best='',d=Infinity;for(const[k,q]of this.nodes){const n=(q.x-p.x)**2+(q.z-p.z)**2;if(n<d){d=n;best=k;}}return best;}
 path(a:Point,b:Point):Point[]{
  const start=this.nearest(a),goal=this.nearest(b);if(start===goal)return[this.nodes.get(goal)!];
  const open=new Set([start]),cost=new Map([[start,0]]),parent=new Map<string,string>();let expanded=0;
  while(open.size&&expanded++<1600){let at='',best=Infinity;const end=this.nodes.get(goal)!;for(const k of open){const p=this.nodes.get(k)!,s=(cost.get(k)??Infinity)+Math.hypot(end.x-p.x,end.z-p.z);if(s<best){best=s;at=k;}}
   if(at===goal){const path:Point[]=[];let k=goal;while(k!==start){path.unshift(this.nodes.get(k)!);k=parent.get(k)!;}return path;}
   open.delete(at);const p=this.nodes.get(at)!;for(const n of this.links.get(at)??[]){const q=this.nodes.get(n)!,c=cost.get(at)!+Math.hypot(q.x-p.x,q.z-p.z);if(c<(cost.get(n)??Infinity)){cost.set(n,c);parent.set(n,at);open.add(n);}}
  }return[];
 }
}
