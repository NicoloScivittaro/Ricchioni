import {rayVsAabb} from './fpsMap';
import type {Aabb} from './fpsMap';
/** The blast cannot pass through a solid. Sample exposed body heights, so low cover is not a full-height wall. */
export function blastVisible(origin:{x:number;y:number;z:number},body:{x:number;z:number},obstacles:readonly Aabb[]):boolean {
 return [.35,1,1.65].some(y=>{
  const dx=body.x-origin.x,dy=y-origin.y,dz=body.z-origin.z,d=Math.hypot(dx,dy,dz);
  if(d<1e-6)return true;
  return !obstacles.some(b=>{const t=rayVsAabb(origin.x,origin.y,origin.z,dx/d,dy/d,dz/d,b);return t!==null&&t<d-1e-4;});
 });
}
