import { hitDirection, BALL_NORMAL_SPEED, BALL_NORMAL_UP, BALL_SMASH_SPEED, BALL_SMASH_DOWN, FIELD_HALF_W, NET_HEIGHT, BALL_RADIUS } from './volleyballTypes';
import type { Team } from './volleyballTypes';
export interface VolleyShot { dx:number; dz:number; speed:number; vy:number; style:'normal'|'lob'|'smash'|'angled'; smash:boolean }

/** Input del pad/telefono: X è la destra TV, Y positivo è giù. Il verso del tiro è SEMPRE il campo avversario.
 * Su = teso / giù = lob in entrambe le squadre, senza invertire i comandi quando cambia il battitore. */
export function volleyShot(ball:{x:number;z:number},team:Team,stick:{x:number;y:number},canSmash:boolean,perfect:boolean,wall=false):VolleyShot {
  const dirZ=team==='red'?1:-1,x=Math.max(-1,Math.min(1,stick.x)),forward=Math.max(-1,Math.min(1,-stick.y));
  const lob=forward<-.35&&!wall,smash=canSmash&&!lob;
  let aim=hitDirection(ball.x,dirZ);
  if(Math.abs(x)>.15){
    const targetX=x*(FIELD_HALF_W-2),depth=Math.max(6,Math.abs(ball.z)+4.5);
    const lateral=Math.max(-.6,Math.min(.6,(targetX-ball.x)/depth)),len=Math.hypot(lateral,1);
    aim={dx:lateral/len,dz:dirZ/len};
  }
  const speed=smash?BALL_SMASH_SPEED*(perfect?1:.9)*(1+Math.max(0,forward)*.08):BALL_NORMAL_SPEED*(lob?.85:1+Math.max(0,forward)*.24);
  const vy=smash?BALL_SMASH_DOWN*(1+Math.max(0,forward)*.3):BALL_NORMAL_UP+(lob?-forward*2.4:-Math.max(0,forward)*1.1);
  return {...aim,speed,vy,smash,style:lob?'lob':smash?'smash':Math.abs(x)>.15?'angled':'normal'};
}

/** Primo contatto della sfera con lo spessore della rete, altezza interpolata al contatto (non a fine frame). */
export function volleyNetContact(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}):{t:number;x:number;y:number;z:number;side:number}|null {
  const side=from.z<0?-1:from.z>0?1:(to.z<0?1:-1),limit=BALL_RADIUS+.06;
  const dz=to.z-from.z;if(dz*side>=0||to.z*side>limit)return null;
  const t=Math.max(0,Math.min(1,(side*limit-from.z)/dz));
  const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
  if(y>=NET_HEIGHT+BALL_RADIUS||Math.abs(x)>FIELD_HALF_W+BALL_RADIUS)return null;
  return {t,x,y,z:side*limit,side};
}
