import type { PlayerId } from '../../../shared/types';

export type Team = 'red' | 'blue';

export const TEAM_COLOR: Record<Team, string> = {
  red: '#ef4444',
  blue: '#3b82f6'
};

export const TEAM_LABEL: Record<Team, string> = {
  red: 'ROSSI',
  blue: 'BLU'
};

/** Campo (lungo X, largo Z); porte sui lati corti (±X). */
export const FIELD_HALF_W = 16; // metà lunghezza (X)
export const FIELD_HALF_D = 10; // metà larghezza (Z)
export const GOAL_HALF_W = 3; // mezza bocca della porta (Z)
export const GOAL_DEPTH = 2.2;

export const PLAYER_RADIUS = 0.95;
export const BALL_RADIUS = 0.55;

export const ACCEL = 24;
export const MAX_SPEED = 9;
export const FRICTION = 8;

export const DASH_SPEED = 15;
export const DASH_TIME = 0.2;
export const DASH_COOLDOWN = 1.0;

export const POSSESSION_RADIUS = 1.9; // palla ferma: corpo (0.95) + palla (0.55) + margine generoso
export const TACKLE_RADIUS = PLAYER_RADIUS + BALL_RADIUS + 0.4;
/** Ricezione assistita: un compagno di chi ha calciato controlla al volo il passaggio entro questo raggio e sotto questa velocita'. */
export const RECEIVE_RADIUS = 2.1;
export const RECEIVE_SPEED = 15;
/** Tackle in scivolata: contatto col portatore DURANTE il dash (oltre al controllo istantaneo alla pressione del tasto). */
export const LUNGE_REACH = PLAYER_RADIUS * 2;
/** Il dash conta come tentativo di tackle solo se un portatore avversario e' entro questa distanza; se il colpo manca: inciampo. */
export const LUNGE_ATTEMPT_RANGE = 6.5;
export const WHIFF_STUN = 0.22;

export const KICK_MIN = 10;
export const KICK_MAX = 24;
export const CHARGE_TIME = 0.8;

export const BALL_FRICTION = 2.2; // decelerazione palla (per secondo)
export const BALL_MAX_SPEED = 30;

export const MATCH_SECONDS = 60;
export const GOLDEN_GOAL_SECONDS = 15;
export const INTRO_SECONDS = 3.2;
export const GOAL_PAUSE_SECONDS = 2.2;

// Abilità
export const AIM_TIME = 5; // Buttafuori
export const AIM_KICK_MULT = 1.3;
export const LIGHT_TIME = 5; // Dottore
export const LIGHT_SPEED = 1.35;
export const CIRO_ARM_WINDOW = 4;
export const CURVE_RATE = 1.6; // Goblin: curvatura (rad/s)
export const JUDOKA_CHARGE_SPEED = 17;
export const JUDOKA_CHARGE_POWER = 11;

/**
 * Handicap della squadra in superiorità numerica (parametrico). Scelto con scripts/soccer-team-balance.ts (bot "umani", 1500 partite):
 * il vecchio malus (-8% velocità, -10% tiro, +15% cooldown dash) ribaltava il match a favore della squadra PICCOLA (2v1: 26% contro 50%;
 * 3v2: 17% contro 58%). Basta un solo malus leggero: dash/tackle più lenti (+30%).
 *   2v1 → grande 46% · pari 23% · piccola 31%      3v2 → grande 35% · pari 30% · piccola 35%     (senza handicap: 47/23/30 e 39/30/32)
 * Ogni malus di movimento (anche -3% di velocità) sposta il 3v2 verso la squadra piccola: per questo la velocità resta 1.
 */
export const HANDICAP = {
  speedMult: 1,
  kickMult: 1,
  dashCooldownMult: 1.3
};

export interface SoccerPlayer {
  id: PlayerId;
  characterId: string | null;
  color: string;
  avatar: string;
  name: string;
  team: Team;

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
  dodgeTime: number;
  dodgeCooldown: number;
  stunTime: number;
  hitFlash: number;

  hasBall: boolean;
  charging: boolean;
  chargeTime: number;

  // Moltiplicatori (handicap + abilità)
  speedMult: number;
  kickMult: number;
  dashCooldownMult: number;
  /** Tackle in scivolata in corso (il dash puo' ancora rubare la palla al contatto). */
  lunge: boolean;
  lungeCharge: boolean;

  // Abilità (una volta a partita)
  abilityUsed: boolean;
  curveNext: boolean; // Goblin: prossimo tiro a effetto
  aimTime: number; // Buttafuori: finestra mira
  aimThrown: boolean;
  lightTime: number; // Dottore: leggero/rapido
  judokaCharge: boolean; // Judoka: carica ruba-palla
  deferArmed: boolean; // Ciro: trattiene la palla al primo contrasto
  armTimer: number;

  // MVP
  goals: number;
  assists: number;
  tackles: number;
  interceptions: number;
  ownGoals: number;
}

export function createSoccerPlayer(
  id: PlayerId,
  characterId: string | null,
  color: string,
  avatar: string,
  name: string,
  team: Team,
  handicapped: boolean
): SoccerPlayer {
  return {
    id,
    characterId,
    color,
    avatar,
    name,
    team,
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
    dodgeTime: 0,
    dodgeCooldown: 0,
    stunTime: 0,
    hitFlash: 0,
    hasBall: false,
    charging: false,
    chargeTime: 0,
    speedMult: handicapped ? HANDICAP.speedMult : 1,
    kickMult: handicapped ? HANDICAP.kickMult : 1,
    dashCooldownMult: handicapped ? HANDICAP.dashCooldownMult : 1,
    lunge: false,
    lungeCharge: false,
    abilityUsed: false,
    curveNext: false,
    aimTime: 0,
    aimThrown: false,
    lightTime: 0,
    judokaCharge: false,
    deferArmed: false,
    armTimer: 0,
    goals: 0,
    assists: 0,
    tackles: 0,
    interceptions: 0,
    ownGoals: 0
  };
}

export interface SoccerBall {
  x: number;
  z: number;
  vx: number;
  vz: number;
  ownerId: PlayerId | null;
  lastKickerId: PlayerId | null;
  prevKickerId: PlayerId | null;
  curve: number; // tasso di curvatura residuo (Goblin)
  freeGrace: number; // dopo un tiro, la palla non è raccoglibile per un attimo
}

export function createBall(): SoccerBall {
  return { x: 0, z: 0, vx: 0, vz: 0, ownerId: null, lastKickerId: null, prevKickerId: null, curve: 0, freeGrace: 0 };
}
