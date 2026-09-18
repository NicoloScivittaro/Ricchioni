import type { PlayerId } from '../../../shared/types';

export type Team = 'red' | 'blue';

export const TEAM_COLOR: Record<Team, string> = { red: '#ef4444', blue: '#3b82f6' };
export const TEAM_LABEL: Record<Team, string> = { red: 'ROSSI', blue: 'BLU' };

/** Campo: rete lungo X (z=0), rossi a -Z, blu a +Z. */
export const FIELD_HALF_W = 12; // metà larghezza (X)
export const FIELD_HALF_D = 8; // metà profondità per squadra (Z)
export const NET_HEIGHT = 2.3;

export const PLAYER_RADIUS = 0.95;
export const BALL_RADIUS = 0.5;

export const ACCEL = 22;
export const MAX_SPEED = 8;
export const FRICTION = 8;

export const JUMP_VY = 9.5;
export const GRAVITY = 22;

export const HIT_RADIUS = 2.5;
export const HIT_REACH = 2.9;
export const HIT_COOLDOWN = 0.35;

// Ricezione / palleggio
export const RECEIVE_UP = 9;
export const RECEIVE_SPEED = 8;
// Smash
export const SMASH_DOWN = -7.5;
export const SMASH_SPEED = 15;
// Servizio
export const SERVE_UP = 10;
export const SERVE_SPEED = 9;

export const WIN_SCORE = 5;
export const MATCH_POINT_AT = WIN_SCORE - 1;

/** Handicap squadra in superiorità numerica (parametrico). */
export const HANDICAP = {
  speedMult: 0.93,
  jumpMult: 0.9,
  hitCooldownMult: 1.1
};

export interface VolleyballPlayer {
  id: PlayerId;
  characterId: string | null;
  color: string;
  avatar: string;
  name: string;
  team: Team;

  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;

  alive: boolean;
  falling: boolean;
  spin: number;
  dashing: boolean;
  hitCooldown: number;
  stunTime: number;
  hitFlash: number;

  // Moltiplicatori (handicap + abilità)
  speedMult: number;
  jumpMult: number;
  hitCooldownMult: number;

  // Abilità (una volta a partita)
  abilityUsed: boolean;
  jagerBomb: boolean; // Goblin: prossimo smash perfetto potenziato
  muroTime: number; // Buttafuori: zona di caduta precisa
  lightTime: number; // Dottore: salto+velocità
  judokaCharge: boolean; // Judoka: accelerazione laterale
  judokaTime: number; // Judoka: finestra della carica
  deferArmed: boolean; // Ciro: salvataggio disperato
  armTimer: number;
  muroStableDone: boolean; // Buttafuori: prima ricezione stabile usata

  // MVP
  points: number;
  smashes: number;
  receives: number;
  saves: number;
  errors: number;
}

export function createVolleyballPlayer(
  id: PlayerId,
  characterId: string | null,
  color: string,
  avatar: string,
  name: string,
  team: Team,
  handicapped: boolean
): VolleyballPlayer {
  return {
    id,
    characterId,
    color,
    avatar,
    name,
    team,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    facing: 0,
    alive: true,
    falling: false,
    spin: 0,
    dashing: false,
    hitCooldown: 0,
    stunTime: 0,
    hitFlash: 0,
    speedMult: handicapped ? HANDICAP.speedMult : 1,
    jumpMult: handicapped ? HANDICAP.jumpMult : 1,
    hitCooldownMult: handicapped ? HANDICAP.hitCooldownMult : 1,
    abilityUsed: false,
    jagerBomb: false,
    muroTime: 0,
    lightTime: 0,
    judokaCharge: false,
    judokaTime: 0,
    deferArmed: false,
    armTimer: 0,
    muroStableDone: false,
    points: 0,
    smashes: 0,
    receives: 0,
    saves: 0,
    errors: 0
  };
}

export interface VolleyballBall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: 'held' | 'flying';
  holderId: PlayerId | null; // battitore
  lastTouchId: PlayerId | null;
  teamTouches: number; // tocchi consecutivi della squadra (per MVP, non fault)
  crossedNet: boolean;
  frozenTimer: number; // Ciro: salvataggio disperato
}

export function createBall(): VolleyballBall {
  return {
    x: 0,
    y: 2,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    state: 'held',
    holderId: null,
    lastTouchId: null,
    teamTouches: 0,
    crossedNet: false,
    frozenTimer: 0
  };
}
