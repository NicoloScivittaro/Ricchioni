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
export const BALL_MAX_LIFE = 4;
/** Distanza centro-centro per raccogliere una palla libera: corpo (1.0) + 1.0 = "il corpo tocca l'anello" disegnato sotto la palla. */
export const PICKUP_RADIUS = 2.0;

export const KNOCKBACK_HIT = 8;
export const STUN_TIME = 0.4;
export const GRAVITY = 26;

export const BALL_COUNT_MAX = 3;

// Goblin "N'CULO, RIPIGLIATELA!"
export const PARRY_TIME = 0.42;
export const PARRY_RADIUS = 1.9;
export const REFLECT_SPEED_MULT = 1.45;

// Buttafuori "OCCHIO DA POLIGONO"
export const AIM_TIME = 5;
export const AIM_THROW_SPEED_MULT = 1.4;
export const AIM_BOUNCE_DAMP = 0.93;

// Dottore "TRE MESI DOPO"
export const VISION_TIME = 6;

// Judoka "CARICO E SCARICO"
export const TRUCK_BEEP_TIME = 0.9;
export const TRUCK_TIME = 1.4;
export const TRUCK_SPEED = 11;
export const TRUCK_PICKUP_RADIUS = 2.3;
export const TRUCK_MAX_BALLS = 2;
export const TRUCK_WALL_STUN = 0.5;
export const TRUCK_PUSH_POWER = 6;

// Ciro "PAGO DOMANI"
export const CIRO_ARM_WINDOW = 4;
export const CIRO_DEBT_TIME = 4;

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
  /** Bounce damping personalizzato (Buttafuori con OCCHIO DA POLIGONO tira "più teso"). */
  bounceDamp: number;
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
  knockbackResist: number; // moltiplicatore knockback SUBITO (<1 = resiste)

  // Goblin: finestra di parata
  parryTime: number;

  // Buttafuori: finestra di mira + primo tiro potenziato
  aimTime: number;
  aimThrown: boolean;

  // Dottore: visione delle traiettorie in arrivo
  visionTime: number;

  // Judoka: modalità camion
  truckTime: number;
  truckBeepTimer: number;
  truckDirX: number;
  truckDirZ: number;
  truckBalls: number[]; // indici nella lista palloni del gioco

  // Ciro: debito
  deferArmed: boolean;
  armTimer: number;
  debtActive: boolean;
  debtTimer: number;
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
    knockbackResist: 1,
    parryTime: 0,
    aimTime: 0,
    aimThrown: false,
    visionTime: 0,
    truckTime: 0,
    truckBeepTimer: 0,
    truckDirX: 0,
    truckDirZ: 0,
    truckBalls: [],
    deferArmed: false,
    armTimer: 0,
    debtActive: false,
    debtTimer: 0
  };
}

export function createBall(): Ball {
  return {
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    state: 'free',
    holderId: null,
    throwerId: null,
    bounces: 0,
    life: 0,
    bounceDamp: BALL_BOUNCE_DAMP
  };
}
