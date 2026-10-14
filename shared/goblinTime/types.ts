import type { PlayerResult } from '../types';
export type CardType = 'AZIONE' | 'TRAPPOLA' | 'RISPOSTA' | 'CATASTROFE';
export interface Card { id: string; type: CardType; name: string; effect: string; characterId?: string; quote?: string; shortEffect?: string; illustration?: string }
export interface Option { id: string; label: string; cardId?: string }
export interface Choice { id: string; title: string; options: Option[]; min: number; max: number; ordered?: boolean; kind: 'choice' | 'reaction'; eventId?: string; remaining: number }
export interface Seat { id: string; name: string; characterId: string; bot?: boolean }
export interface PublicSeat extends Seat { count: number | null; traps: number; declared: boolean; abilityUsed: boolean; debts: number }
export interface PublicState {
  type: 'goblinPublic'; roundId: number; matchId: string; version: number; mode: 'base' | 'personal';
  phase: 'main' | 'choice' | 'reaction' | 'finished'; turn: string; turnNumber: number;
  remaining: number; matchRemaining: number; deckCount: number; discardCount: number; discardTop: string[];
  players: PublicSeat[]; log: { id: string; text: string; cardId?: string; kind: string; from?: string; to?: string }[];
  resolving: string | null; winner: string | null; endReason: string | null; results: PlayerResult[] | null; paused: boolean;
  waitingFor?: string[]; shortTurn?: boolean;
}
export interface PrivateState {
  type: 'goblinPrivate'; roundId: number; matchId: string; version: number; playerId: string;
  hand: string[]; traps: { cardId: string; suspended: boolean }[]; deposits: string[];
  playable: string[]; armable: string[]; choice: Choice | null; canDraw: boolean; canDeclare: boolean;
  ability: { name: string; full: string; used: boolean; available: boolean };
  information: { title: string; cards: string[] }[]; table: PublicState;
}
export interface Command { roundId: number; matchId: string; version: number; requestId: string; op: 'draw' | 'play' | 'arm' | 'declare' | 'ability' | 'choose'; cardId?: string; choiceId?: string; values?: string[] }
export interface CommandAck { ok: boolean; error?: string; version?: number }
export type EventKind = 'Action' | 'Draw' | 'Discard' | 'Steal' | 'Transfer' | 'Exchange' | 'Arm' | 'Trap' | 'Declare' | 'Start' | 'End' | 'Reveal' | 'Cancel' | 'Extra' | 'Deposit' | 'Return' | 'Status' | 'Response' | 'RandomTarget' | 'DrawChoice' | 'Gain' | 'HandChanged';
export interface GameEvent { id: string; kind: EventKind; actor: string; target: string; card?: string; cards?: string[]; count?: number; source?: string; cancel?: boolean; public?: boolean; redirect?: string; chooseLoss?: boolean; reduced?: number; response?: string; depth: number; copy?: boolean; used: string[]; deferred?: boolean; hide?: boolean; origin?: GameEvent; immune?: string[]; cancelledBy?: string; keepArmedCard?: boolean; lastCard?:boolean; previousCount?:number; newCount?:number; effectActor?:string; cancelNotified?:boolean }
