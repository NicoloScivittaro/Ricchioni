import type{WeaponReload}from '../fpsReload';
import type {Point} from './arena';
export type EnemyKind='infetto'|'corridore'|'colosso'|'assalitore'|'cacciatore'|'macellaio'|'warrok'|'zombiegirl'|'yaku'|'pumpkinhulk';
export interface OrdaParticipant{id:string;name:string;color:string;bot?:boolean}
export interface OrdaInput{mx:number;my:number;lx:number;ly:number;look?:{yaw:number;pitch:number};fire:boolean;press:number;aim:boolean;reload:number;jump:number;crouch:boolean;dash:number;interact?:number;sensitivity?:number}
export const EMPTY_INPUT:OrdaInput={mx:0,my:0,lx:0,ly:0,fire:false,press:0,aim:false,reload:0,jump:0,crouch:false,dash:0};
export interface Survivor extends OrdaParticipant,Point{
 y:number;vy:number;yaw:number;pitch:number;hp:number;alive:boolean;kills:number;damage:number;deathAt:number;
 points:number;pointsEarned:number;hitsTaken:number;lastDamageAt:number;lastInteract:number;
 weaponReload?:WeaponReload;weapon:string;ammo:number;reserve:number;reload:number;cooldown:number;ads:number;noise:number;moving:number;
 damageBoost:number;speedBoost:number;shield:number;dash:number;dashCooldown:number;crouch:boolean;lastFire:number;lastReload:number;lastJump:number;lastDash:number;burst:number;burstTimer:number;botThink:number;botTarget:number;botGoal:Point|null;botPath:Point[];botNav:number;
}
export interface Enemy extends Point{
 id:number;kind:EnemyKind;y:number;yaw:number;hp:number;maxHp:number;speed:number;damage:number;radius:number;height:number;
 target:string|null;memory:Point|null;remember:number;path:Point[];think:number;nav:number;attack:number;windup:number;action:'walk'|'melee'|'spit'|'charge'|'slam'|'roar'|'jump'|'punch'|'dead'|'swipe'|'heavy'|'jumpAttack'|'taunt';aim:Point;stuck:number;last:Point;rage:boolean;
 actionAt?:number;impacted?:boolean;roared?:boolean;jumpReady?:number;deathAt?:number;hitAt?:number;
 actionRate?:number;actionOrigin?:Point;attackCount?:number;sprintUntil?:number;sprintReady?:number;
}
export interface Bolt extends Point{id:number;owner:string;hostile:boolean;y:number;dx:number;dy:number;dz:number;life:number;speed:number;damage:number;radius:number}
export interface Supply extends Point{id:number;kind:'ammo'|'health'|'crate';cooldown:number}
export type OrdaEvent={type:'shot'|'hit'|'hurt'|'death'|'reload'|'equip'|'supply'|'wave'|'boss'|'windup'|'blast'|'win'|'points'|'box';player?:string;enemy?:number;weapon?:string;value?:number;text?:string;x?:number;y?:number;z?:number;tx?:number;ty?:number;tz?:number};
export interface MysteryBoxState{phase:'idle'|'rolling'|'ready'|'closing';owner:string|null;weapon:string|null;started:number;until:number;serial:number}
export interface OrdaState{
 time:number;wave:number;phase:'countdown'|'fighting'|'intermission'|'finished';countdown:number;pending:number;
 players:Survivor[];enemies:Enemy[];bolts:Bolt[];supplies:Supply[];box:MysteryBoxState;winner:string|null;notice:string;
}
export interface OrdaPacket{type:'ordaState';roundId:number;state:OrdaState;events:OrdaEvent[]}
