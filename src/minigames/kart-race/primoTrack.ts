import {Vector3} from '@babylonjs/core';
import {TrackSpline} from './track';
import type {ItemBoxPlacement} from './track';
import type {KartState} from './raceTypes';
import type {MinigameContext} from '../types';
import {KART_CONFIG} from './kartPhysics';
import route from './primoRoute.json';

const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const PRIMO_SCALE=5;

/** Closed lap surveyed from the original skid ribbon and the physical tyre/plastic
 * boundaries. The supplied textured meshes remain the entire visible circuit. */
export class PrimoTrack extends TrackSpline {
  readonly checkpoints:number[];
  readonly boxes:ItemBoxPlacement[];
  constructor(){
    super(route.map(([x,y,z])=>new Vector3(x,y,z)),route.map(p=>p[3]),route.length*8,false,false);
    this.checkpoints=Array.from({length:12},(_,i)=>i*this.totalLength/12);
    // Pickups precede the slower corners and reward their exits; none touch a wall.
    this.boxes=[.045,.13,.22,.31,.40,.49,.58,.69,.80,.91].map(f=>({s:f*this.totalLength,lateral:0}));
  }
  curvature(s:number):number{return angle(this.tangentAngleAt(s+3)-this.tangentAngleAt(s-3))/6;}
  override botLateralAt(s:number,id:string):number{
    const bend=Math.max(Math.abs(this.curvature(s+7)),Math.abs(this.curvature(s+20)));
    return bend<.035?(id.charCodeAt(id.length-1)%2?1:-1)*Math.min(2.1,this.widthAt(s)*.13):0;
  }
  sector(s:number):string{
    const f=this.wrap(s)/this.totalLength;
    return f<.11||f>.93?'RETTILINEO · PREPARA LA STACCATA':f<.37?'ESSE VELOCI · USCITA IN TURBO':f<.72?'TORNANTI · FRENA E DERAPA':'CURVE TECNICHE · DIFENDI LA TRAIETTORIA';
  }
}

/** Circuit-specific preview replaces only steering/throttle/drift for Primo bots.
 * Item reactions, ability decisions, physics and human input remain the existing systems. */
export function guidePrimoBots(track:PrimoTrack,ctx:MinigameContext,karts:KartState[]):void{
  const ids=new Set(ctx.players.filter(p=>p.bot).map(p=>p.id));
  for(const k of karts){
    if(!ids.has(k.playerId)||k.finished||k.respawnTimer>0)continue;
    const pin=ctx.input.get(k.playerId),lane=track.botLateralAt(k.distance,k.playerId);
    const preview=Math.max(6,k.speed*.28);let curve=0;
    for(const ds of [0,preview,preview+9])curve=Math.max(curve,Math.abs(track.curvature(k.distance+ds)));
    // Actual steering rate gives the corner speed ceiling. Brake early, without
    // changing speed/position directly or assuming what an opponent will do next.
    const poweredCap=44*Math.max(k.abilitySpeedFactor,k.boostTimer>0?1+KART_CONFIG.boostSpeedGain*k.boostPower:1);
    const target=clamp(1.35/Math.max(.015,curve),17,poweredCap);
    const direction=track.curvature(k.distance+5);
    const error=angle(track.tangentAngleAt(k.distance+4)-k.absHeading);
    const drift=Math.abs(direction)>.012&&Math.abs(direction)<.065&&k.speed>24&&Math.abs(k.lateral-lane)<2.6&&Math.abs(k.heading)<.45&&k.driftCharge<1.25;
    const rate=KART_CONFIG.maxTurnRate*(1-KART_CONFIG.highSpeedSteerLoss*Math.min(1,(k.speed/44)**2))*k.steerMultiplier*(k.faultyTimer>0?.68:1)*(k.bumperTimer>0?.9:1);
    const feed=track.curvature(k.distance+3)*k.speed-(k.drifting?k.driftDir*KART_CONFIG.driftExtraRate:0);
    const steer=clamp(feed/Math.max(.5,rate)+error*1.8-(k.lateral-lane)*.10-k.slipVelocity*.035,-1,1);
    pin.setAxis('steer',ctx.modifier?.id==='controlli_invertiti'?-steer:steer,0);
    const hold=(control:string,on:boolean)=>{if(on)pin.setDown(control);else pin.setUp(control);};
    hold('up',k.speed<target+.8);hold('down',k.speed>target+2.5);hold('drift',drift);
  }
}
