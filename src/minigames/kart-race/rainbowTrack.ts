import {glideLift,smooth01,GLIDE} from './glideDynamics';
import {Vector3} from '@babylonjs/core';
import route from './rainbowRoute.json';
import {TrackSpline} from './track';
import {stepKartPhysics} from './kartPhysics';
import type {KartInputSnapshot} from './kartPhysics';
import type {KartState} from './raceTypes';

export const RAINBOW_SCALE=4;
export const rainbowPoint=(x:number,y:number,z:number):Vector3=>new Vector3((x-200)*4,z*4+40,(y-60)*4);
export interface GlideGap {name:string;launch:number;landing:number;height:number}
/** Structural contract lets imported circuits reuse the existing flight controller. */
export type GlideTrack=TrackSpline & {readonly gaps:GlideGap[];gapAt(s:number,margin?:number):GlideGap|undefined};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

/** Centreline extracted from Object_6. The original mesh remains the visible road. */
export class RainbowTrack extends TrackSpline {
  override readonly suspended=true;
  readonly gaps:GlideGap[];
  readonly checkpoints:number[];
  constructor(){
    super(route.map(([x,y,z])=>rainbowPoint(x,y,z)),route.map(()=>13.2),route.length*5,false,false,route.map(([,,,nx,ny,nz])=>new Vector3(nx,nz,ny)));
    const at=(x:number,y:number)=>{
      const target=rainbowPoint(x,y,0);let best=Infinity,s=0;
      for(let d=0;d<this.totalLength;d+=.35){const p=this.positionAt(d);const e=(p.x-target.x)**2+(p.z-target.z)**2;if(e<best){best=e;s=d;}}
      return s;
    };
    this.gaps=[
      {name:'VOLO STELLARE',launch:at(261.5,12),landing:at(264.1,106),height:18},
      {name:'SALTO AURORA',launch:at(180,103.8),landing:at(173,103.8),height:3.5}
    ];
    // Ground-only checkpoints, including a safe retry just before each launch.
    const safe=[0,...this.gaps.flatMap(g=>[g.launch-12,g.landing+18])];
    for(let s=this.totalLength/8;s<this.totalLength;s+=this.totalLength/8)if(!this.gapAt(s,28))safe.push(s);
    this.checkpoints=safe.sort((a,b)=>a-b).filter((s,i,a)=>i===0||s-a[i-1]>8);
  }
  gapAt(s:number,margin=0):GlideGap|undefined{const d=this.wrap(s);return this.gaps.find(g=>d>=g.launch-margin&&d<=g.landing+margin);}
  override hasRoadAt(s:number):boolean{return !this.gapAt(s);}
  override flightHeightAt(s:number):number {const g=this.gapAt(s);return g?glideLift((this.wrap(s)-g.launch)/(g.landing-g.launch),g.height):0;}
  override botLateralAt():number{return 0;}
}

export type FlightEvent='launch'|'land'|'fall';
/** Reuses the ground physics and timers. Only marked launch intervals enable lift. */
export function stepRainbowKart(k:KartState,input:KartInputSnapshot,dt:number,track:GlideTrack,invert:boolean,onEvent:(event:FlightEvent)=>void,groundBarriers=false):void {
  k.glideLanding=Math.max(0,k.glideLanding-dt);
  if(k.respawnTimer>0){
    if(k.flight==='FALL'){k.jumpVelocity-=18*dt;k.jumpHeight+=k.jumpVelocity*dt;}
    stepKartPhysics(k,input,dt,d=>track.widthAt(d)/2,d=>track.tangentAngleAt(d),invert);return;}
  if(k.flight==='FALL'){
    k.flightTime+=dt;k.jumpVelocity-=18*dt;k.jumpHeight+=k.jumpVelocity*dt;k.speed=0;
    if(k.flightTime>.9){k.respawnTimer=1;k.offTrackTimer=0;}
    return;
  }
  const before=k.distance,previousHeight=k.jumpHeight;
  const air=k.flight==='GLIDE';
  stepKartPhysics(k,air?{...input,drift:false,driftReleased:false}:input,dt,d=>track.widthAt(d)/2,d=>track.tangentAngleAt(d),invert,{grip:air?2.2:1,speed:1,barriers:groundBarriers&&!air,air});
  let gap=track.gapAt(k.distance);
  if(!air&&k.distance>before&&gap){
    k.flight='GLIDE';k.glideStart=k.distance-track.wrap(k.distance)+gap.launch;k.glideEnd=k.glideStart+gap.landing-gap.launch;
    k.flightEntryHeight=Math.max(0,k.jumpHeight);k.flightTime=0;k.glideYawVelocity=0;k.glideLanding=0;k.drifting=false;k.driftCharge=0;k.driftDir=0;k.offRoad=false;
    k.speed=Math.max(28,k.speed);onEvent('launch');
  }
  if(k.flight==='GLIDE'){
    k.flightTime+=dt;
    const t=clamp((k.distance-k.glideStart)/(k.glideEnd-k.glideStart),0,1);
    gap=track.gaps.find(g=>Math.abs(track.wrap(k.glideStart)-g.launch)<1)!;
    // Arcade lift: reduced apparent gravity, finite wing corridor, steerable lateral inertia.
    // Holding brake reduces forward speed; there is no free vertical flight or forced lateral centering.
    k.jumpHeight=Math.max(0,glideLift(t,gap.height)+k.flightEntryHeight*(1-smooth01(t)));
    k.jumpVelocity=(k.jumpHeight-previousHeight)/dt;
    if(k.distance>=k.glideEnd){
      if(Math.abs(k.lateral)<=track.widthAt(k.distance)/2-1.15){
        k.flight='DRIVE';k.glideLanding=GLIDE.landingTime;k.glideYawVelocity=0;k.jumpHeight=k.jumpVelocity=0;k.slipVelocity*=.5;k.drifting=false;k.driftCharge=0;onEvent('land');
      }else fall('atterraggio fuori piattaforma');
    }else if(Math.abs(k.lateral)>23||k.flightTime>25)fall(Math.abs(k.lateral)>23?'uscita dal corridoio aereo':'limite planata');
  }else if(Math.abs(k.lateral)>track.widthAt(k.distance)/2+.4)fall('bordo strada');
  function fall(reason:string){
    k.fallReason=reason;
    k.flight='FALL';k.flightTime=0;k.jumpVelocity=Math.min(-2,k.jumpVelocity);k.drifting=false;k.driftCharge=0;k.offRoad=true;
    // Delay checkpoint/rank advancement until recovered; the visible drop precedes the normal penalty.
    onEvent('fall');
  }
}
