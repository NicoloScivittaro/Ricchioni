import {Vector3} from '@babylonjs/core';
import type {KartState} from './raceTypes';
import type {TrackSpline} from './track';
import {KART_HALF_WIDTH,KART_HALF_LENGTH} from './kartCollisions';

export interface PhysicalTrackData {segments:number[][];triangles?:number[][];barriers:{x:number;z:number;w:number;d:number;h:number}[];floor:number[]}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));

/** Imported circuits collide with surveyed visible obstacles, not an imaginary
 * symmetric ribbon. Numeric edges are spatially indexed; no Babylon collider
 * objects or special bot trajectories are involved. */
export class ImportedTrackCollision{
  private cells=new Map<string,number[]>();
  private triangleCells=new Map<string,number[]>();
  constructor(readonly data:PhysicalTrackData){
    data.segments.forEach((s,i)=>{
      for(let x=Math.floor((Math.min(s[0],s[2])-2)/8);x<=Math.floor((Math.max(s[0],s[2])+2)/8);x++)
      for(let z=Math.floor((Math.min(s[1],s[3])-2)/8);z<=Math.floor((Math.max(s[1],s[3])+2)/8);z++){
        const key=`${x}:${z}`,list=this.cells.get(key);if(list)list.push(i);else this.cells.set(key,[i]);
      }
    });
    data.triangles?.forEach((t,i)=>{
      for(let x=Math.floor((Math.min(t[0],t[3],t[6])-2)/8);x<=Math.floor((Math.max(t[0],t[3],t[6])+2)/8);x++)
      for(let z=Math.floor((Math.min(t[2],t[5],t[8])-2)/8);z<=Math.floor((Math.max(t[2],t[5],t[8])+2)/8);z++){
        const key=`${x}:${z}`,list=this.triangleCells.get(key);if(list)list.push(i);else this.triangleCells.set(key,[i]);
      }
    });
  }
  /** Actual asphalt bounds in the supplied model. Walls enclose the playable
   * hall well before the large source asphalt rectangle ends. */
  floorHalfWidth(track:TrackSpline,s:number,side:number):number{
    const p=track.positionAt(s),r=track.rightAt(s).scale(side<0?-1:1),b=this.data.floor;
    const x=Math.abs(r.x)>1e-5?((r.x>0?b[2]:b[0])-p.x)/r.x:Infinity;
    const z=Math.abs(r.z)>1e-5?((r.z>0?b[3]:b[1])-p.z)/r.z:Infinity;
    return Math.max(1,Math.min(x,z));
  }
  private contacts(x:number,z:number,yaw:number,footY=0):{x:number;z:number;count:number}{
    let nx=x,nz=z,count=0;
    const f={x:Math.sin(yaw),z:Math.cos(yaw)},front=KART_HALF_LENGTH-KART_HALF_WIDTH;
    const edges:number[][]=[];
    for(const index of this.triangleCells.get(`${Math.floor(x/8)}:${Math.floor(z/8)}`)??[]){
      const t=this.data.triangles![index];
      if(Math.max(t[0],t[3],t[6])<x-1.5||Math.min(t[0],t[3],t[6])>x+1.5||Math.max(t[2],t[5],t[8])<z-1.5||Math.min(t[2],t[5],t[8])>z+1.5||Math.max(t[1],t[4],t[7])<footY+.28||Math.min(t[1],t[4],t[7])>footY+1.85)continue;
      let poly=[[t[0],t[1],t[2]],[t[3],t[4],t[5]],[t[6],t[7],t[8]]];
      for(const [level,sign]of [[footY+.28,1],[footY+1.85,-1]]){
        const clipped:number[][]=[];
        for(let i=0;i<poly.length;i++){
          const a=poly[i],b=poly[(i+1)%poly.length],inside=(a[1]-level)*sign>=0,next=(b[1]-level)*sign>=0;
          if(inside)clipped.push(a);
          if(inside!==next){const f=(level-a[1])/(b[1]-a[1]);clipped.push(a.map((v,j)=>v+(b[j]-v)*f));}
        }
        poly=clipped;
      }
      for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(Math.hypot(a[0]-b[0],a[2]-b[2])>.001)edges.push([a[0],a[2],b[0],b[2]]);}
    }
    for(let pass=0;pass<3;pass++)for(const offset of [-front,0,front]){
      const px=nx+f.x*offset,pz=nz+f.z*offset;
      const candidates=[...edges,...(this.cells.get(`${Math.floor(px/8)}:${Math.floor(pz/8)}`)??[]).map(i=>this.data.segments[i])];
      for(const s of candidates){
        const vx=s[2]-s[0],vz=s[3]-s[1],length=vx*vx+vz*vz;
        const t=clamp(((px-s[0])*vx+(pz-s[1])*vz)/length,0,1),dx=px-s[0]-vx*t,dz=pz-s[1]-vz*t,d=Math.hypot(dx,dz);
        if(d>=KART_HALF_WIDTH||d<1e-8)continue;
        const push=KART_HALF_WIDTH-d+.001;nx+=dx/d*push;nz+=dz/d*push;count++;
      }
    }
    return{x:nx,z:nz,count};
  }
  blocked(p:{x:number;z:number;y?:number},yaw:number):boolean{return this.contacts(p.x,p.z,yaw,p.y??0).count>0;}
  resolve(track:TrackSpline,k:KartState,from:{distance:number;lateral:number;jumpHeight?:number}):void{
    if(k.respawnTimer>0||k.finished)return;
    const before=track.worldPoint(from.distance,from.lateral,from.jumpHeight??k.jumpHeight),desired=track.worldPoint(k.distance,k.lateral,k.jumpHeight);
    let x=before.x,z=before.z,contacts=0;
    const travel=Vector3.Distance(before,desired),steps=Math.max(1,Math.ceil(travel/.22));
    const dx=(desired.x-before.x)/steps,dz=(desired.z-before.z)/steps;
    for(let n=0;n<steps;n++){const y=before.y+(desired.y-before.y)*(n+1)/steps,hit=this.contacts(x+dx,z+dz,k.absHeading,y);x=hit.x;z=hit.z;contacts+=hit.count;}
    if(!contacts)return; // retain any contact with Sydney's visible corridor fence
    // Invert the local Frenet frame, including curvature*offset. Search stays
    // near the old progress, so adjacent lanes cannot award distant checkpoints.
    let s=from.distance,lat=from.lateral;const reach=travel*2+2;
    for(let i=0;i<10;i++){
      const p=track.worldPoint(s,lat,k.jumpHeight),ds=track.worldPoint(s+.1,lat,k.jumpHeight).subtract(track.worldPoint(s-.1,lat,k.jumpHeight)).scale(5),r=track.rightAt(s);
      const ex=x-p.x,ez=z-p.z,det=ds.x*r.z-ds.z*r.x;if(Math.abs(det)<.05)break;
      s=clamp(s+clamp((ex*r.z-ez*r.x)/det,-2,2),from.distance-reach,from.distance+reach);
      lat+=clamp((ds.x*ez-ds.z*ex)/det,-2,2);
      if(Math.hypot(ex,ez)<.002)break;
    }
    const represented=track.worldPoint(s,lat,k.jumpHeight);
    if(Math.hypot(represented.x-x,represented.z-z)>.1){s=from.distance;lat=from.lateral;}
    k.distance=s;k.lateral=lat;
    const px=x-desired.x,pz=z-desired.z,n=Math.hypot(px,pz)||1,nx=px/n,nz=pz/n;
    const into=Math.sin(k.absHeading)*nx+Math.cos(k.absHeading)*nz;
    if(!k.wallContact&&into<-.05){
      const impact=Math.abs(k.speed*into);k.speed*=Math.max(.3,Math.sqrt(Math.max(0,1-into*into)));
      if(impact>6&&k.invulnTimer<=0)k.stunTimer=Math.max(k.stunTimer,.18);
    }
    k.slipVelocity*=.4;k.collisionYawVelocity*=.35;k.wallContact=true;
    k.heading=angle(k.absHeading-track.tangentAngleAt(k.distance));
  }
}
