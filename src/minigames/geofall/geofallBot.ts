import {Rng} from '../../../shared/rng';
import {tileCenter} from './geofallRules';
import type {GeofallMatch,GeoActor} from './geofallRules';
/** I bot scelgono con ritardo, possono sbagliare e si muovono con le stesse regole. */
export class GeofallBots {
 private plans=new Map<string,{round:number;delay:number;target:number;offset:number}>();
 constructor(private rng:Rng){}
 command(p:GeoActor,m:GeofallMatch,dt:number):{x:number;z:number;push:boolean;ability:boolean}{
  let plan=this.plans.get(p.id);
  if(!plan||plan.round!==m.round){plan={round:m.round,delay:this.rng.int(70,180)/100,target:this.rng.chance([0,.82,.68,.52,.4][m.question.difficulty]??.4)?m.correctIndex:this.rng.int(0,9),offset:this.rng.next()*Math.PI*2};this.plans.set(p.id,plan);}
  if(m.phase!=='answer'||p.lives<=0)return{x:0,z:0,push:false,ability:false};plan.delay-=dt;if(plan.delay>0)return{x:0,z:0,push:false,ability:false};
  const c=tileCenter(plan.target),dx=c.x+Math.sin(plan.offset)*.9-p.x,dz=c.z+Math.cos(plan.offset)*.9-p.z,d=Math.hypot(dx,dz);
  const nearby=m.alive.some(q=>q!==p&&Math.hypot(q.x-p.x,q.z-p.z)<2.5);
  const useful=p.characterId==='judoka'?Math.hypot(p.vx,p.vz)>2:p.characterId==='dottore'?d>3&&m.remaining<3:p.characterId==='ciro'?nearby&&m.remaining>2.5:nearby&&m.remaining<3;
  const direction=p.confusion>0?-1:1;
  return{x:d>.15?direction*dx/Math.max(.6,d):0,z:d>.15?direction*dz/Math.max(.6,d):0,push:!p.pushUsed&&m.remaining<2&&m.alive.some(q=>q!==p&&Math.hypot(q.x-p.x,q.z-p.z)<1.8)&&this.rng.chance(dt*.8),ability:useful&&p.ab.charges>0&&p.ab.cooldown<=0&&this.rng.chance(dt*1.5)};
 }
}
