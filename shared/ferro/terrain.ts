import hell from './map-hell.json';
import geonosis from './map-geonosis.json';
import type {ArenaId,V3} from './types';
export interface Terrain{id:string;step:number;size:number;extent:number;radius:number;heights:Float32Array;blocked:Uint8Array}
function decode(raw:typeof hell):Terrain{
 const bytes=Uint8Array.from(atob(raw.heightData),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),bits=Uint8Array.from(atob(raw.blockedData),c=>c.charCodeAt(0)),heights=new Float32Array(raw.size*raw.size),blocked=new Uint8Array(heights.length);
 for(let i=0;i<heights.length;i++){const n=view.getInt16(i*2,true);heights[i]=n===-32768?-999:n/100;blocked[i]=(bits[i>>3]>>(i%8))&1;}return{...raw,heights,blocked};
}
const HELL=decode(hell),GEONOSIS=decode(geonosis);
export const terrainFor=(id:ArenaId):Terrain|null=>id==='hell'?HELL:id==='geonosis'?GEONOSIS:null;
export const arenaRadius=(id:ArenaId)=>terrainFor(id)?.radius??16;
export function cell(t:Terrain,x:number,z:number):number{const col=Math.round((x+t.extent)/t.step),row=Math.round((z+t.extent)/t.step);return col<0||row<0||col>=t.size||row>=t.size?-1:row*t.size+col;}
export function floorAt(id:ArenaId,x:number,z:number):number{const t=terrainFor(id);if(!t)return 0;return t.heights[cell(t,x,z)]??-999;}
export function terrainFree(t:Terrain,x:number,z:number,r:number,fromY?:number):boolean{
 const index=cell(t,x,z),h=t.heights[index];if(index<0||h< -100||t.blocked[index]||fromY!==undefined&&(h>fromY+.42||h<fromY-.65))return false;
 for(let k=0;k<8;k++){const i=cell(t,x+Math.cos(k*Math.PI/4)*r,z+Math.sin(k*Math.PI/4)*r),n=t.heights[i];if(i<0||t.blocked[i]||n< -100||Math.abs(n-h)>.48)return false;}return true;
}
export function terrainRay(t:Terrain,o:V3,d:V3,max:number,pad:number):number{
 const step=Math.min(.12,t.step*.3),n=Math.ceil(max/step);for(let k=0;k<=n;k++){const at=Math.min(max,k*step),x=o.x+d.x*at,z=o.z+d.z*at,y=o.y+d.y*at,index=cell(t,x,z),h=t.heights[index];if(index<0)continue;if(h> -100&&(y<h+pad||t.blocked[index]&&y<h+2+pad))return Math.max(0,at-step);}return max;
}
export function spawnPoint(id:ArenaId,angle:number,r:number):V3{
 const t=terrainFor(id);if(!t)return{x:Math.sin(angle)*r,y:0,z:Math.cos(angle)*r};
 let best={x:0,y:0,z:0},score=Infinity;
 for(let row=0;row<t.size;row+=2)for(let col=0;col<t.size;col+=2){const x=col*t.step-t.extent,z=row*t.step-t.extent,h=t.heights[row*t.size+col];if(Math.abs(h)>2||!terrainFree(t,x,z,.53))continue;const cost=Math.hypot(x-Math.sin(angle)*r,z-Math.cos(angle)*r);if(cost<score){score=cost;best={x,y:h,z};}}return best;
}
