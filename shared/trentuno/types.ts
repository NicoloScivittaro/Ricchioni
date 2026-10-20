import type { PlayerResult } from '../types';
export interface Seat { id:string; name:string; characterId:string; bot?:boolean }
export type Phase='draw'|'discard'|'peek'|'knockWindow'|'handResult'|'finished';
export interface HandResult { number:number; reason:'31'|'bussata'; rows:{playerId:string;cards:string[];score:number;placement:number;points:number}[] }
export interface PublicState {
  type:'trentunoPublic';roundId:number;matchId:string;version:number;phase:Phase;handNumber:number;turn:string;turnNumber:number;
  remaining:null;handRemaining:null;matchRemaining:null;paused:boolean;deckCount:number;discardTop:string;
  knocker:string|null;finalTurns:number|null;blockedFor:string|null;
  players:(Seat&{count:number;abilityUsed:boolean;points:number})[];
  history:HandResult[];results:PlayerResult[]|null;
  log:{id:number;kind:string;playerId?:string;cardId?:string;text:string}[];
}
export interface PrivateState {
  type:'trentunoPrivate';roundId:number;matchId:string;version:number;playerId:string;hand:string[];score:number;table:PublicState;
  canDraw:boolean;canTake:boolean;canKnock:boolean;discardable:string[];peek:string[];
  ability:{name:string;full:string;used:boolean;available:boolean};
}
export interface Command {roundId:number;matchId:string;version:number;requestId:string;op:'draw'|'take'|'discard'|'knock'|'ability'|'order';cardId?:string;targetId?:string;reverse?:boolean}
export interface Ack {ok:boolean;error?:string;version?:number}
