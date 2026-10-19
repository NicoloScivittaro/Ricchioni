import {Vector3} from '@babylonjs/core';
import {TrackSpline,buildItemBoxes} from './track';
import type {GlideGap} from './rainbowTrack';
import {glideLift} from './glideDynamics';
import route from './sydneyRoute.json';

/** Surveyed on N_Road01/02 and the Opera road/ramp. Coordinates are baked Y-up,
 * at 0.65 game units per original FBX unit. No procedural replacement road. */
export class SydneyTrack extends TrackSpline {
  readonly gaps:GlideGap[];
  readonly checkpoints:number[];
  readonly boxes;
  readonly accessRamps:{start:number;end:number}[];
  private readonly operaAt:number;
  private readonly cityAt:number;
  constructor(){
    super(route.map(([x,y,z])=>new Vector3(x,y,z)),route.map(p=>p[3]),route.length*5,false,false,route.map(p=>new Vector3(p[5],p[6],p[7])));
    this.gaps=[{name:'VOLO SUL PORTO',launch:this.atSurvey(13),landing:this.atSurvey(17.2),height:11}];
    this.accessRamps=[{start:this.atSurvey(6.12),end:this.atSurvey(6.9)},{start:this.atSurvey(12.05),end:this.atSurvey(12.65)}];
    this.operaAt=this.atSurvey(5);this.cityAt=this.atSurvey(34);
    const safe=[0,this.gaps[0].launch-10,this.gaps[0].landing+15];
    for(let i=1;i<12;i++){const s=i*this.totalLength/12;if(!this.gapAt(s,22))safe.push(s);}
    this.checkpoints=safe.sort((a,b)=>a-b).filter((s,i,a)=>!i||s-a[i-1]>9);
    this.boxes=buildItemBoxes(this).filter(p=>!this.gapAt(p.s,20));
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
