import {AnimationGroup,Quaternion,TransformNode,Vector3} from '@babylonjs/core';

export type MonsterState='IDLE'|'BREATHING_IDLE'|'WALK'|'RUN'|'JUMP'|'ROAR'|'ATTACK'|'DEATH';
export type MonsterCue='step'|'roar'|'swing'|'death';
export interface MonsterProfile{model:string;rig:string;role:string;compatibility:'native'|'retargeted';walkSpeed:number;runSpeed:number;idle:MonsterState;blend:number;clipSet:string;events:{roar:number;swing:number;impactSeconds:number;captureStartSeconds:number};audio:'heavy'|'mutant'}
const MUTANT={clipSet:'mutant-v1',events:{roar:.22,swing:.16,impactSeconds:.3,captureStartSeconds:.16}} as const;
export const MONSTER_PROFILES:Record<string,MonsterProfile>={
 warrok:{...MUTANT,model:'/assets/monsters/warrok.glb',rig:'mixamorig-81',role:'heavy-assault',compatibility:'native',walkSpeed:1.47,runSpeed:2.67,idle:'BREATHING_IDLE',blend:.14,audio:'heavy'},
 hazmat:{...MUTANT,model:'/assets/monsters/hazmat-animated.glb',rig:'hazmat-66',role:'human/imitation/infected',compatibility:'retargeted',walkSpeed:1.4,runSpeed:2.54,idle:'IDLE',blend:.18,audio:'mutant'},
 partygoer:{...MUTANT,model:'/assets/monsters/partygoer-animated.glb',rig:'cc-base-69',role:'lure/runner',compatibility:'retargeted',walkSpeed:1.82,runSpeed:3.3,idle:'BREATHING_IDLE',blend:.2,audio:'mutant'}
};
type Pose={q:Quaternion;p:Vector3;s:Vector3};
type Clip={group:AnimationGroup;duration:number};
type Manifest={clips:Record<string,{seconds:number;contacts:number[]}>};
let manifest:Manifest={clips:{}};
let loading:Promise<void>|undefined;
export function loadMonsterManifest():Promise<void>{return loading??=fetch('/assets/monsters/manifest.json').then(r=>{if(!r.ok)throw Error('Monster animation manifest unavailable');return r.json();}).then(value=>{manifest=value;}).catch(e=>{loading=undefined;throw e;});}

/** Immutable animation/key data, independent target rig, clock and transition pose per actor.
 * Manual sampling avoids engine-time resets and keeps host/phone one-shots on the authoritative age.
 */
export class MonsterAnimator{
 readonly clips=new Map<string,Clip>();
 state:MonsterState='IDLE';clock=0;finished=false;
 private started=false;private dead=false;private fade=1;private previous=new Map<TransformNode,Pose>();
 private nodes=new Set<TransformNode>();private q=Quaternion.Identity();private v=Vector3.Zero();
 onCue?:(cue:MonsterCue)=>void;
 constructor(groups:AnimationGroup[],readonly profile:MonsterProfile,private seed=0){
  for(const group of groups){group.stop();const name=group.name.split(':').pop()!;const fps=group.targetedAnimations[0]?.animation.framePerSecond??60;this.clips.set(name,{group,duration:(group.to-group.from)/fps});for(const t of group.targetedAnimations)if(t.target instanceof TransformNode)this.nodes.add(t.target);}
 }
 reset(seed=this.seed):void{this.seed=seed;this.started=false;this.dead=false;this.finished=false;this.clock=0;this.previous.clear();}
 update(dt:number,state:MonsterState,speed=0,age?:number):void{
  if(this.dead&&state!=='DEATH')return;
  const clip=this.clips.get(state)??this.clips.get(state==='RUN'?'WALK':this.profile.idle)??this.clips.get('WALK');if(!clip)return;
  const loop=state==='IDLE'||state==='BREATHING_IDLE'||state==='WALK'||state==='RUN';
  if(!this.started||state!==this.state){
   this.previous.clear();for(const n of this.nodes)this.previous.set(n,{q:(n.rotationQuaternion??Quaternion.FromEulerVector(n.rotation)).clone(),p:n.position.clone(),s:n.scaling.clone()});
   this.clock=age??(loop?((this.seed*0.61803398875)%1)*clip.duration:0);this.state=state;this.fade=this.started?0:1;this.started=true;this.finished=false;
   if(state==='DEATH'){this.dead=true;this.onCue?.('death');}
  }
  const old=this.clock;let rate=state==='WALK'?speed/this.profile.walkSpeed:state==='RUN'?speed/this.profile.runSpeed:1;
  rate=loop&&speed>0?Math.min(2.2,Math.max(.45,rate)):loop&&(state==='WALK'||state==='RUN')?0:rate;
  this.clock=age??this.clock+Math.max(0,dt)*rate;const duration=Math.max(.001,clip.duration),time=loop?this.clock%duration:Math.min(this.clock,duration);
  this.finished=!loop&&this.clock>=duration;this.fade=Math.min(1,this.fade+Math.max(0,dt)/this.profile.blend);
  for(const t of clip.group.targetedAnimations){const n=t.target;if(!(n instanceof TransformNode))continue;const frame=t.animation.framePerSecond*time+clip.group.from,value=t.animation.evaluate(frame),from=this.previous.get(n);
   if(t.animation.targetProperty==='rotationQuaternion'){n.rotationQuaternion??=Quaternion.Identity();if(from&&this.fade<1){Quaternion.SlerpToRef(from.q,value,this.fade,this.q);n.rotationQuaternion.copyFrom(this.q);}else n.rotationQuaternion.copyFrom(value);}
   else if(t.animation.targetProperty==='position'||t.animation.targetProperty==='scaling'){const property=t.animation.targetProperty,base=property==='position'?from?.p:from?.s;if(base&&this.fade<1){Vector3.LerpToRef(base,value,this.fade,this.v);n[property].copyFrom(this.v);}else n[property].copyFrom(value);}
  }
  if(this.clock<=old||this.clock-old>duration)return;
  const markers=state==='WALK'||state==='RUN'?(manifest.clips[state]?.contacts??[]):state==='ROAR'?[this.profile.events.roar]:state==='ATTACK'?[this.profile.events.swing]:[];
  for(const phase of markers){const marker=phase*duration;const cycle=loop?Math.floor((old-marker)/duration)+1:0;const at=marker+cycle*duration;if(old<at&&this.clock>=at)this.onCue?.(state==='ROAR'?'roar':state==='ATTACK'?'swing':'step');}
 }
 dispose():void{this.onCue=undefined;this.previous.clear();this.nodes.clear();this.clips.clear();}
}
