import {Vector3} from '@babylonjs/core';
import {TrackSpline,buildItemBoxes} from './track';
import type {GlideGap} from './rainbowTrack';
import {glideLift} from './glideDynamics';
import route from './sydneyRoute.json';
import collision from './sydneyCollision.json';
import {ImportedTrackCollision} from './importedTrackCollision';
import type {KartState} from './raceTypes';
import type {MinigameContext} from '../types';
import {KART_CONFIG} from './kartPhysics';

const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

/** Surveyed on N_Road01/02 and the Opera road/ramp. Coordinates are baked Y-up,
 * at 0.65 game units per original FBX unit. No procedural replacement road. */
export class SydneyTrack extends TrackSpline {
  readonly physical=new ImportedTrackCollision(collision);
  readonly gaps:GlideGap[];
  readonly checkpoints:number[];
  readonly boxes;
  readonly accessRamps:{start:number;end:number}[];
  private readonly operaAt:number;
  private readonly cityAt:number;
  constructor(){
    super(route.map(([x,y,z])=>new Vector3(x,y,z)),route.map(p=>p[3]),route.length*5,false,false,route.map(p=>new Vector3(p[5],p[6],p[7])));
    this.gaps=[{name:'VOLO SUL PORTO',launch:this.atSurvey(13),landing:this.atSurvey(18.5),height:18}];
    this.accessRamps=[{start:this.atSurvey(4.4),end:this.atSurvey(9)},{start:this.atSurvey(10.1),end:this.atSurvey(10.8)},{start:this.atSurvey(12.05),end:this.atSurvey(13)}];
    this.operaAt=this.atSurvey(5);this.cityAt=this.atSurvey(34);
    const safe=[0,this.gaps[0].launch-10,this.gaps[0].landing+15];
    for(let i=1;i<12;i++){const s=i*this.totalLength/12;if(!this.gapAt(s,22))safe.push(s);}
    this.checkpoints=safe.sort((a,b)=>a-b).filter((s,i,a)=>!i||s-a[i-1]>9);
    // Keep the ten existing pickups: the longer descent moves the old receiving
    // road pickup onto solid road after the new landing, rather than deleting it.
    this.boxes=buildItemBoxes(this).filter(p=>!this.gapAt(p.s,20)||p.s>this.gaps[0].landing-20)
      .map(p=>this.gapAt(p.s,20)?{s:this.gaps[0].landing+25,lateral:p.lateral}:p);
  }
  /** Locate the stored survey parameter on the resampled race spline once. */
  atSurvey(t:number):number{
    const q=route.reduce((a,p)=>Math.abs(p[4]-t)<Math.abs(a[4]-t)?p:a,route[0]);
    let best=Infinity,s=0;
    for(let d=0;d<this.totalLength;d+=.25){const p=this.positionAt(d),e=(p.x-q[0])**2+(p.z-q[2])**2;if(e<best){best=e;s=d;}}
    return s;
  }
  gapAt(s:number,margin=0):GlideGap|undefined{const d=this.wrap(s);return this.gaps.find(g=>d>=g.launch-margin&&d<=g.landing+margin);}
  override hasRoadAt(s:number):boolean{return !this.gapAt(s);}
  override flightHeightAt(s:number):number{const g=this.gapAt(s);return g?glideLift((this.wrap(s)-g.launch)/(g.landing-g.launch),g.height):0;}
  override botLateralAt():number{return 0;}
  sector(s:number):string{
    const d=this.wrap(s);
    return this.gapAt(s)?'VOLO SUL PORTO':d<this.operaAt?'LUNGOMARE · VERSO L’OPERA':d<this.gaps[0].launch?'OPERA HOUSE · RAMPA':d<this.cityAt?'HARBOUR BRIDGE':'CITTÀ · CURVE TECNICHE';
  }
}

/** Ground preview for the tighter imported passages. Only normal input changes;
 * the flight controller, physical walls and checkpoints are shared with humans. */
export function guideSydneyBots(track:SydneyTrack,ctx:MinigameContext,karts:KartState[]):void{
  const ids=new Set(ctx.players.filter(p=>p.bot).map(p=>p.id));
  const curvature=(s:number)=>angle(track.tangentAngleAt(s+2)-track.tangentAngleAt(s-2))/4;
  for(const k of karts){
    if(!ids.has(k.playerId)||k.finished||k.respawnTimer>0||k.flight!=='DRIVE')continue;
    let bend=0;for(const ds of [0,6,k.speed*.4+8])bend=Math.max(bend,Math.abs(curvature(k.distance+ds)));
    const cap=44*Math.max(k.abilitySpeedFactor,k.boostTimer>0?1+KART_CONFIG.boostSpeedGain*k.boostPower:1);
    const target=clamp(1.05/Math.max(.015,bend),15,cap);
    const rate=KART_CONFIG.maxTurnRate*(1-KART_CONFIG.highSpeedSteerLoss*Math.min(1,(k.speed/44)**2))*k.steerMultiplier*(k.faultyTimer>0?.68:1)*(k.bumperTimer>0?.9:1);
    const error=angle(track.tangentAngleAt(k.distance+3)-k.absHeading);
    const feed=curvature(k.distance+2)*k.speed-(k.drifting?k.driftDir*KART_CONFIG.driftExtraRate:0);
    const steer=clamp(feed/Math.max(.5,rate)+error*1.8-k.lateral*.18-k.slipVelocity*.04,-1,1),pin=ctx.input.get(k.playerId);
    pin.setAxis('steer',ctx.modifier?.id==='controlli_invertiti'?-steer:steer,0);
    for(const [control,on]of [['up',k.speed<target+.8],['down',k.speed>target+2.5],['drift',false]]as const){if(on)pin.setDown(control);else pin.setUp(control);}
  }
}
