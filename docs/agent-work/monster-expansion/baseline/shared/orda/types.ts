import type {Point} from './arena';
export type EnemyKind='infetto'|'corridore'|'colosso'|'assalitore'|'cacciatore'|'macellaio'|'warrok';
export interface OrdaParticipant{id:string;name:string;color:string;bot?:boolean}
export interface OrdaInput{mx:number;my:number;lx:number;ly:number;look?:{yaw:number;pitch:number};fire:boolean;press:number;aim:boolean;reload:number;jump:number;crouch:boolean;dash:number;sensitivity?:number}
export const EMPTY_INPUT:OrdaInput={mx:0,my:0,lx:0,ly:0,fire:false,press:0,aim:false,reload:0,jump:0,crouch:false,dash:0};
export interface Survivor extends OrdaParticipant,Point{
 y:number;vy:number;yaw:number;pitch:number;hp:number;alive:boolean;kills:number;damage:number;deathAt:number;
 weapon:string;ammo:number;reserve:number;reload:number;cooldown:number;ads:number;noise:number;moving:number;
 damageBoost:number;speedBoost:number;shield:number;dash:number;dashCooldown:number;crouch:boolean;lastFire:number;lastReload:number;lastJump:number;lastDash:number;burst:number;burstTimer:number;botThink:number;botTarget:number;botGoal:Point|null;botPath:Point[];botNav:number;
}
export interface Enemy extends Point{
 id:number;kind:EnemyKind;y:number;yaw:number;hp:number;maxHp:number;speed:number;damage:number;radius:number;height:number;
 target:string|null;memory:Point|null;remember:number;path:Point[];think:number;nav:number;attack:number;windup:number;action:'walk'|'melee'|'spit'|'charge'|'slam'|'roar'|'jump'|'punch'|'dead';aim:Point;stuck:number;last:Point;rage:boolean;
 actionAt?:number;impacted?:boolean;roared?:boolean;jumpReady?:number;deathAt?:number;hitAt?:number;
}
export interface Bolt extends Point{id:number;owner:string;hostile:boolean;y:number;dx:number;dy:number;dz:number;life:number;speed:number;damage:number;radius:number}
export interface Supply extends Point{id:number;kind:'ammo'|'health'|'crate';cooldown:number}
export type OrdaEvent={type:'shot'|'hit'|'hurt'|'death'|'reload'|'equip'|'supply'|'wave'|'boss'|'windup'|'blast'|'win';player?:string;enemy?:number;weapon?:string;value?:number;text?:string;x?:number;y?:number;z?:number;tx?:number;ty?:number;tz?:number};
export interface OrdaState{
 time:number;wave:number;phase:'countdown'|'fighting'|'intermission'|'finished';countdown:number;pending:number;
 players:Survivor[];enemies:Enemy[];bolts:Bolt[];supplies:Supply[];winner:string|null;notice:string;
}
export interface OrdaPacket{type:'ordaState';roundId:number;state:OrdaState;events:OrdaEvent[]}
