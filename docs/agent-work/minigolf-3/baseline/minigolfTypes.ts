import {GOLF_TOURNAMENT} from '../../../shared/minigolfTournament';
export const GOLF = { radius: .28, step: 1/120, chargeTime: 1.25, minSpeed: 1.8, maxSpeed: 19,
  readySpeed: .18, maxVelocity: 28, gravity: 14, drag: 1.65, restitution: .78,
  holeSeconds: GOLF_TOURNAMENT.holeSeconds, aimSeconds: GOLF_TOURNAMENT.aimSeconds, rollSeconds: 20, maxStrokes: GOLF_TOURNAMENT.maxStrokes, incomplete: 14, intro: 4, transition: .22, captureSpeed: 3.4, cupRadius: .5, cupDropTime: .45, cupLipAccel: 5.5, surfaceSnap: .06, verticalRestitution: .22 } as const;
export interface Point {x:number;z:number}
export interface Motion {axis:'x'|'z';amplitude:number;speed:number;phase?:number}
export interface Floor extends Point {w:number;d:number;y:number;slopeX?:number;slopeZ?:number;surface?:'turf'|'sand'|'ice';motion?:Motion}
export interface Wall {a:Point;b:Point;y:number;radius:number;rotation?:{center:Point;speed:number;phase:number}}
export interface Bumper extends Point {radius:number;y:number;power:number;expires?:number;owner?:string}
export interface Course {id:string;name:string;difficulty:'easy'|'medium'|'hard';par:number;maxStrokes:number;tip:string;floors:Floor[];walls:Wall[];bumpers:Bumper[];spawn:Point;hole:Point;holeY:number;waypoints:Point[];color:string}
export interface GolfBall extends Point {id:string;y:number;vx:number;vy:number;vz:number;grounded:boolean;done:boolean;safe:Point;safeY:number;tee:Point;teeY:number;
  readyFor:number;stuckFor:number;bounceBoost:number;bounceCount:number;lastContact:string|null;contacts:Set<string>;lastMotion:Point;travel:number}
export interface GolfPlayer {id:string;characterId:string|null;name:string;color:string;bot:boolean;ball:GolfBall;
  aim:Point;charge:number;charging:boolean;blocked:boolean;cancelVersion:number;strokes:number;penalties:number;total:number;totalPenalties:number;
  finished:boolean;completed:number;ones:number;completionTime:number;holeTime:number;holeShots:number;used:boolean;armed:'bounce'|'power'|null;prediction:number;debt:number;specialShot:boolean;
  records:{course:string;strokes:number;penalties:number;completed:boolean;seconds:number}[]}
export interface GolfEvent {type:'wall'|'ball'|'bumper'|'fall'|'hole'|'shot'|'penalty'|'stuck'|'ability'|'limit'|'last';id:string;x:number;z:number;other?:string;value?:number}
