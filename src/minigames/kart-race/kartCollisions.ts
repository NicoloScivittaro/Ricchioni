import type { KartState } from './raceTypes';
import { MIN_RACE_DISTANCE } from './raceTypes';
import { AB } from '../../../shared/abilityCatalog';

// Volume comune a tutti: ruote/carrozzeria, non il vecchio rettangolo largo 3,4 m.
export const KART_HALF_WIDTH = 1;
export const KART_HALF_LENGTH = 1.4;
export interface KartWorldFrame { x: number; y: number; z: number; trackAngle: number }
type Vec = { x: number; z: number };
const dot = (a: Vec,b: Vec) => a.x*b.x+a.z*b.z;
const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));
const forward = (yaw:number):Vec => ({x:Math.sin(yaw),z:Math.cos(yaw)});
const right = (yaw:number):Vec => ({x:Math.cos(yaw),z:-Math.sin(yaw)});
function body(k:KartState,frame:KartWorldFrame){
 const f=forward(frame.trackAngle+k.heading),r=right(frame.trackAngle+k.heading);
 return {f,r,center:{x:frame.x+f.x*.2,z:frame.z+f.z*.2},t:forward(frame.trackAngle),trackRight:right(frame.trackAngle)};
}
function velocity(k:KartState,b:ReturnType<typeof body>):Vec {
 return {x:b.f.x*k.speed+b.trackRight.x*k.slipVelocity,z:b.f.z*k.speed+b.trackRight.z*k.slipVelocity};
}
function addImpulse(k:KartState,b:ReturnType<typeof body>,impulse:Vec):void {
 if(k.truckMode)return; // identità dell'abilità esistente: il camion non perde velocità negli urti.
 const deltaSpeed=clamp(dot(impulse,b.t)/Math.max(.31,Math.cos(k.heading)),-18,18);
 k.speed=clamp(k.speed+deltaSpeed,-18,80);
 k.slipVelocity=clamp(k.slipVelocity+dot(impulse,b.trackRight)-deltaSpeed*Math.sin(k.heading),-14,14);
}

/** SAT di quattro assi sul volume reale orientato; nessun impulso se il contatto non si sta chiudendo. */
export function resolveKartContact(a:KartState,b:KartState,frameA:KartWorldFrame,frameB:KartWorldFrame):{closingSpeed:number;nx:number;nz:number;penetration:number}|null {
 if(Math.abs(frameA.y-frameB.y)>1.2)return null;
 const ba=body(a,frameA),bb=body(b,frameB);
 const delta={x:bb.center.x-ba.center.x,z:bb.center.z-ba.center.z};
 let depth=Infinity,normal:Vec={x:1,z:0};
 for(const axis of [ba.f,ba.r,bb.f,bb.r]){
  const extentA=Math.abs(dot(ba.f,axis))*KART_HALF_LENGTH+Math.abs(dot(ba.r,axis))*KART_HALF_WIDTH;
  const extentB=Math.abs(dot(bb.f,axis))*KART_HALF_LENGTH+Math.abs(dot(bb.r,axis))*KART_HALF_WIDTH;
  const overlap=extentA+extentB-Math.abs(dot(delta,axis));
  if(overlap<=0)return null;
  if(overlap<depth){depth=overlap;const sign=dot(delta,axis)<0?-1:1;normal={x:axis.x*sign,z:axis.z*sign};}
 }
 const aTruck=a.truckMode&&!b.truckMode,bTruck=b.truckMode&&!a.truckMode;
 const aShare=aTruck ? .08 : bTruck ? .92 : a.lightMode && !b.lightMode ? .88 : b.lightMode && !a.lightMode ? .12 : .5;
 const correction=Math.min(depth+.002,1.5);
 a.distance=Math.max(MIN_RACE_DISTANCE,a.distance-dot(normal,ba.t)*correction*aShare);
 a.lateral-=dot(normal,ba.trackRight)*correction*aShare;
 b.distance=Math.max(MIN_RACE_DISTANCE,b.distance+dot(normal,bb.t)*correction*(1-aShare));
 b.lateral+=dot(normal,bb.trackRight)*correction*(1-aShare);
 const va=velocity(a,ba),vb=velocity(b,bb);
 const closing=Math.max(0,-dot({x:vb.x-va.x,z:vb.z-va.z},normal));
 if(closing>.1){
  const invA=a.truckMode?0:a.lightMode?7.333:1,invB=b.truckMode?0:b.lightMode?7.333:1;
  const impulse=(1+.12)*closing/Math.max(1,invA+invB);
  addImpulse(a,ba,{x:-normal.x*impulse*invA,z:-normal.z*impulse*invA});
  addImpulse(b,bb,{x:normal.x*impulse*invB,z:normal.z*impulse*invB});
  for(const [kart,basis,sign] of [[a,ba,-1],[b,bb,1]] as const){
   if(kart.truckMode)continue;
   const lever=clamp(dot(delta,basis.f)*sign/KART_HALF_LENGTH,-1,1);
   kart.collisionYawVelocity=clamp(kart.collisionYawVelocity+dot(normal,basis.r)*lever*sign*Math.min(2.2,closing*.045),-3,3);
   if(closing>22 && kart.invulnTimer<=0)kart.stunTimer=Math.max(kart.stunTimer,closing>=36 ? AB.kart3d.buttafuori.p.severeStun : Math.min(.4,.15+(closing-22)*.006));
  }
 }
 return {closingSpeed:closing,nx:normal.x,nz:normal.z,penetration:depth};
}
