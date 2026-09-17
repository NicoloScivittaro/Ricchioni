import type { PlayerId } from '../../../shared/types';

/** Campo rettangolare (metà dimensioni, il campo è simmetrico attorno all'origine). */
export const ARENA_HALF_W = 14; // metà larghezza (asse X)
export const ARENA_HALF_D = 9; // metà profondità (asse Z)

export const PLAYER_RADIUS = 1.0;
export const BALL_RADIUS = 0.5;

export const ACCEL = 24;
export const MAX_SPEED = 9;
export const FRICTION = 8;

export const DODGE_SPEED = 16;
export const DODGE_TIME = 0.22;
export const DODGE_COOLDOWN = 1.0;
export const DODGE_INVULN = 0.3;

export const THROW_SPEED = 24;
export const BALL_BOUNCE_DAMP = 0.82;
export const BALL_MAX_BOUNCES = 3;
export const BALL_MAX_LIFE = 4; // secondi in volo prima di cadere
export const PICKUP_RADIUS = 1.6;

export const KNOCKBACK_HIT = 8;
export const STUN_TIME = 0.4;
export const GRAVITY = 26;

export const BALL_COUNT_MAX = 3;

export type BallState = 'free' | 'held' | 'flying';

export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  state: BallState;
  holderId: PlayerId | null;
  throwerId: PlayerId | null;
  bounces: number;
  life: number;
}

export interface DodgeballPlayer {
  id: PlayerId;
  characterId: string | null;
  color: string;
  avatar: string;
  name: string;

  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;

  alive: boolean;
  falling: boolean;
  spin: number;
  dashing: boolean;

  hasBall: boolean;
  dodgeTime: number;
  dodgeCooldown: number;
  invulnTime: number;
  stunTime: number;
  hitFlash: number;
  eliminations: number;

  // Abilità (una volta a partita)
  abilityUsed: boolean;
  abilityTimer: number;
  knockbackResist: number; // moltiplicatore knockback SUBITO
  speedMult: number;
  knockMult: number;
  deferArmed: boolean; // Ciro
}

export function createDodgeballPlayer(
  id: PlayerId,
  characterId: string | null,
  color: string,
  avatar: string,
  name: string
): DodgeballPlayer {
  return {
    id,
    characterId,
    color,
    avatar,
    name,
    x: 0,
    z: 0,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    facing: 0,
    alive: true,
    falling: false,
    spin: 0,
    dashing: false,
    hasBall: false,
    dodgeTime: 0,
    dodgeCooldown: 0,
    invulnTime: 0,
    stunTime: 0,
    hitFlash: 0,
    eliminations: 0,
    abilityUsed: false,
    abilityTimer: 0,
    knockbackResist: 1,
    speedMult: 1,
    knockMult: 1,
    deferArmed: false
  };
}

export function createBall(): Ball {
  return { x: 0, z: 0, vx: 0, vz: 0, state: 'free', holderId: null, throwerId: null, bounces: 0, life: 0 };
}
