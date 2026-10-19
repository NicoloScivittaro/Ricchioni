import {BotInputs} from '../bots/BotInputs';
import {getWeapon} from '../../../shared/fpsWeapons';
import type {ArenaPoint,NuketownArena} from './nuketownArena';

interface Actor extends ArenaPoint{id:string;alive:boolean;yaw:number;magazine:number;spawnProtection:number;weaponId:string}
interface Memory {id:string;point:ArenaPoint;seen:number;acquired:number}
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

/** Uses the normal bot input channel. Hidden players' live coordinates are never
 * used as destinations: only a two-second last-seen point, then ground patrol. */
export class NuketownBots extends BotInputs{
  private memory=new Map<string,Memory>();
  private patrol=new Map<string,ArenaPoint>();
  private routes=new Map<string,{at:number;point:ArenaPoint}>();
  step(dt:number,players:Actor[],arena:NuketownArena):void{
    this.tick(dt);
    for(const p of players)if(this.ids.has(p.id)){
      if(!p.alive){this.ctx.input.cancelPlayer(p.id);this.memory.delete(p.id);this.patrol.delete(p.id);continue;}
      const input=this.ctx.input.get(p.id),weapon=getWeapon(p.weaponId);
      const visible=players.filter(q=>q.id!==p.id&&q.alive&&Math.hypot(q.x-p.x,q.z-p.z)<48&&Math.abs(angle(Math.atan2(q.x-p.x,q.z-p.z)-p.yaw))<1.65&&arena.visible(p,q));
      const enemy=visible.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
      let memory=this.memory.get(p.id);
      if(enemy){
        memory={id:enemy.id,point:{x:enemy.x,y:enemy.y,z:enemy.z},seen:this.time,acquired:memory?.id===enemy.id?memory.acquired:this.time};this.memory.set(p.id,memory);
      }else if(memory&&this.time-memory.seen>2){this.memory.delete(p.id);memory=undefined;}
      let goal=memory?.point;
      if(!goal){
        let patrol=this.patrol.get(p.id);
        if(!patrol||Math.hypot(patrol.x-p.x,patrol.z-p.z)<2){
          // Alternate ends and central flanks; searching doesn't reveal enemies.
          const choices=arena.spawns.filter(q=>Math.hypot(q.x-p.x,q.z-p.z)>10);
          patrol=choices[Math.floor(this.rng.next()*choices.length)]??arena.spawns[0];this.patrol.set(p.id,patrol);
        }
        goal=patrol;
      }
      let route=this.routes.get(p.id);
      if(!route||this.time-route.at>.4||Math.hypot(route.point.x-p.x,route.point.z-p.z)<.3){
        route={at:this.time,point:arena.nextWaypoint(p,goal)};this.routes.set(p.id,route);
      }
      let dest=route.point;
      const distance=enemy?Math.hypot(enemy.x-p.x,enemy.z-p.z):Infinity;
      if(enemy&&distance<Math.min(weapon.range*.55,17)){
        const side=Math.sin(this.time*.9+p.id.length),dx=Math.cos(p.yaw)*side*2,dz=-Math.sin(p.yaw)*side*2;
        const strafe={x:p.x+dx,z:p.z+dz};if(arena.canTraverse(p,strafe))dest=strafe;
      }
      const aim=enemy?Math.atan2(enemy.x-p.x,enemy.z-p.z)+Math.sin(this.time*2.7+p.id.length)*.035:Math.atan2(dest.x-p.x,dest.z-p.z);
      const error=angle(aim-p.yaw),turn=clamp(error,-dt*2.5,dt*2.5),yaw=p.yaw+turn;
      input.setAxis('look',yaw,0);input.setAxis('lookStick',turn/Math.max(dt,1e-5)/2.6,0);
      let wx=dest.x-p.x,wz=dest.z-p.z;const n=Math.max(1,Math.hypot(wx,wz));wx/=n;wz/=n;
      input.setAxis('move',wx*Math.cos(p.yaw)-wz*Math.sin(p.yaw),-(wx*Math.sin(p.yaw)+wz*Math.cos(p.yaw)));
      const firing=!!enemy&&enemy.spawnProtection<=0&&this.time-(memory?.acquired??this.time)>.42&&Math.abs(error)<.12&&distance<weapon.range*.95&&this.time%2.2<1.65;
      this.hold(p.id,'aim',!!enemy&&distance>10&&Math.abs(error)<.2);
      this.hold(p.id,'fire',firing);
      if((p.magazine===0||!enemy&&p.magazine<weapon.magazine*.3)&&this.every(p.id,'reload',.4,.8))this.tap(p.id,'reload');
      if(firing)this.ability(p.id);
    }
  }
}
