import type{V3,ArenaId}from'./types';
import{terrainFor,terrainFree,terrainRay,floorAt}from'./terrain';
export interface Solid{x:number;z:number;w:number;d:number;h:number;kind:'column'|'cover'}
export const RADIUS=16;
export const SOLIDS:readonly Solid[]=[...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return{x:Math.sin(a)*7.2,z:Math.cos(a)*7.2,w:1.35,d:1.35,h:5.6,kind:'column'as const};}),{x:-10.5,z:0,w:2.4,d:1.2,h:1.15,kind:'cover'},{x:10.5,z:0,w:2.4,d:1.2,h:1.15,kind:'cover'}];
export const VENTS=Array.from({length:6},(_,i)=>{const a=(i+.5)*Math.PI/3;return{x:Math.sin(a)*11,z:Math.cos(a)*11};});
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export function rayBox(o:V3,d:V3,b:Solid,pad=0):number|null{
 let lo=0,hi=Infinity;for(const [v,n,min,max]of [[o.x,d.x,b.x-b.w/2-pad,b.x+b.w/2+pad],[o.y,d.y,-pad,b.h+pad],[o.z,d.z,b.z-b.d/2-pad,b.z+b.d/2+pad]]){if(Math.abs(n)<1e-9){if(v<min||v>max)return null;continue;}let a=(min-v)/n,c=(max-v)/n;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return null;}return lo;
}
export function wallDistance(o:V3,d:V3,max:number,pad=0,id:ArenaId='colosseum'):number{const terrain=terrainFor(id);if(terrain)return terrainRay(terrain,o,d,max,pad);let best=max;for(const b of SOLIDS){const t=rayBox(o,d,b,pad);if(t!==null)best=Math.min(best,t);}return best;}
export function visible(a:V3,b:V3,id:ArenaId='colosseum'):boolean{const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},l=Math.hypot(d.x,d.y,d.z);return l<1e-6||wallDistance(a,{x:d.x/l,y:d.y/l,z:d.z/l},l,0,id)>=l-.001;}
export function standable(x:number,z:number,r=.43,id:ArenaId='colosseum',fromY?:number):boolean{const t=terrainFor(id);return t?terrainFree(t,x,z,r,fromY):Math.hypot(x,z)<RADIUS-r&&!SOLIDS.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
export function move(x:number,z:number,dx:number,dz:number,r=.43,id:ArenaId='colosseum'):{x:number;z:number}{
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14));for(let i=0;i<n;i++){const nx=x+dx/n,nz=z+dz/n,h=floorAt(id,x,z);if(standable(nx,z,r,id,h))x=nx;if(standable(x,nz,r,id,h))z=nz;}return{x,z};
}
export function segmentDistance(p:V3,a:V3,b:V3):number{const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t,p.z-a.z-dz*t);}
/** A small shared walkability grid; bots route around exactly the visible solid bases. */
export function route(a:{x:number;z:number},b:{x:number;z:number},id:ArenaId='colosseum'):{x:number;z:number}[]{
 const size=id==='colosseum'?17:49,step=id==='colosseum'?1.75:1.2,point=(i:number)=>({x:(i%size-(size-1)/2)*step,z:(Math.floor(i/size)-(size-1)/2)*step});
 const nodes=Array.from({length:size*size},(_,i)=>i).filter(i=>{const p=point(i);return standable(p.x,p.z,.43,id);});if(!nodes.length)return[];
 const near=(p:{x:number;z:number})=>nodes.reduce((n,i)=>distance(p,point(i))<distance(p,point(n))?i:n,nodes[0]);
 const start=near(a),goal=near(b),valid=new Set(nodes),prev=new Map<number,number>(),queue=[start];prev.set(start,start);
 for(let n=0;n<queue.length&&!prev.has(goal);n++){const i=queue[n];for(const j of [i-1,i+1,i-size,i+size]){const a=point(i),b=point(j),ay=floorAt(id,a.x,a.z),by=floorAt(id,b.x,b.z);if(!valid.has(j)||prev.has(j)||distance(a,b)>step+.01||Math.abs(ay-by)>.42||!visible({...a,y:ay+.5},{...b,y:by+.5},id))continue;prev.set(j,i);queue.push(j);}}
 if(!prev.has(goal))return[];const path=[];for(let i=goal;i!==start;i=prev.get(i)!)path.push(point(i));return path.reverse();
}
