import type { KartState } from './raceTypes';
import { applyBoost, hitKart } from './kartPhysics';
import { trackDelta } from './itemSurface';
import {KART_HALF_WIDTH,KART_HALF_LENGTH} from './kartCollisions';

export const TRACK_RAMPS = [{at:.175,name:'SALTO DEL BELVEDERE'}, {at:.635,name:'SALTO DEL PONTILE'}] as const;
export const PORT_WET = [.50,.535] as const;
export const EXPRESS = [.79,.845] as const;
export const SWEEPER_AT = .56;
export type TrackFeedback = 'launch'|'obstacle';
export const progressAt=(distance:number,length:number):number=>((distance%length)+length)%length/length;
export const expressLateral=(width:number):number=>-width*.29;
export const sweeperLateral=(time:number,width:number):number=>Math.sin(time*.85)*(width/2-2.4);
export function trackSurface(distance:number,lateral:number,length:number):{grip:number;speed:number} {
 const f=progressAt(distance,length);
 return f>=PORT_WET[0]&&f<=PORT_WET[1]?{grip:.62,speed:.92}:{grip:1,speed:1};
}
export function trackSection(distance:number,length:number):string {
 const f=progressAt(distance,length);
 if(f>=EXPRESS[0]&&f<=EXPRESS[1])return 'BIVIO · SINISTRA TURBO / DESTRA SICURA';
 if(f>=PORT_WET[0]&&f<=PORT_WET[1])return 'PORTO · ASFALTO BAGNATO';
 if(Math.abs(f-SWEEPER_AT)<.025)return 'GRU MOBILE · SCHIVA IL CARICO';
 if(TRACK_RAMPS.some(r=>f>r.at-.018&&f<r.at+.018))return 'RAMPA · MANTIENI LA TRAIETTORIA';
 return f<.25?'LUNGOMARE · BELVEDERE':f<.5?'PAESE · CURVE PANORAMICHE':f<.75?'PORTO · PONTILE ALTO':'PADDOCK · ESSE FINALE';
}

/** Swept footprint against the expanded cargo box, including its corners. */
export function crossesCargo(from:{distance:number;lateral:number},to:{distance:number;lateral:number},s:number,lat:number,length:number,heading:number):boolean {
 const c=Math.abs(Math.cos(heading)),n=Math.abs(Math.sin(heading));
 const extents=[1.7+KART_HALF_LENGTH*c+KART_HALF_WIDTH*n,1.35+KART_HALF_WIDTH*c+KART_HALF_LENGTH*n];
 const starts=[trackDelta(from.distance,s,length),from.lateral-lat],deltas=[to.distance-from.distance,to.lateral-from.lateral];
 let enter=0,exit=1;
 for(let i=0;i<2;i++){
  if(Math.abs(deltas[i])<1e-9){if(Math.abs(starts[i])>extents[i])return false;continue;}
  const a=(-extents[i]-starts[i])/deltas[i],b=(extents[i]-starts[i])/deltas[i];enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return false;
 }
 return true;
}

/** Geometry and contact use the same Frenet coordinates; no change to checkpoints or player inputs. */
export function stepTrackDynamics(k:KartState,from:{distance:number;lateral:number},length:number,widthAt:(s:number)=>number,time:number,feedback:(event:TrackFeedback)=>void):void {
 if(k.finished||k.respawnTimer>0)return;
 for(const ramp of TRACK_RAMPS){
  const s=ramp.at*length;
  if(k.distance>from.distance&&Math.floor((from.distance-s)/length)<Math.floor((k.distance-s)/length)&&k.speed>18&&k.jumpHeight===0&&k.jumpVelocity<=0){
   k.jumpVelocity=5.6;k.jumpHeight=.01;feedback('launch');
  }
 }
 const f=progressAt(k.distance,length),width=widthAt(k.distance);
 if(f>=EXPRESS[0]&&f<=EXPRESS[1]){
  if(Math.abs(k.lateral-expressLateral(width))<1.35&&k.jumpHeight<.3&&k.speed>12)applyBoost(k,22,.2);
  // A visible island separates a fast narrow lane from a broad safe lane.
  const bodyWidth=KART_HALF_WIDTH*Math.abs(Math.cos(k.heading))+KART_HALF_LENGTH*Math.abs(Math.sin(k.heading));
  const islandLimit=.75+bodyWidth;
  if(Math.abs(k.lateral)<islandLimit&&k.jumpHeight<1.1){
   const side=k.lateral<0?-1:1;k.lateral=side*(islandLimit+.03);
   if(hitKart(k,.25)){k.invulnTimer=.8;k.slipVelocity+=side*3;feedback('obstacle');}
  }
 }
 const at=SWEEPER_AT*length,lat=sweeperLateral(time,widthAt(at));
 if(k.jumpHeight<2.2&&crossesCargo(from,k,at,lat,length,k.heading)&&hitKart(k,.35)){
  k.invulnTimer=1; k.slipVelocity+=Math.sign(k.lateral-lat||1)*3;feedback('obstacle');
 }
}
