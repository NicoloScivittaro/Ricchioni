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

// ---- Palla: TUTTO il bilanciamento in un posto solo (m/s, m/s²) ----
// (scripts/volleyball-balance.ts simula gli scambi con questi stessi valori)

/**
 * Gravità della PALLA (prima 22, come i giocatori). Più bassa = palla più leggibile: il tempo che un
 * difensore ha per reagire cresce come 1/√g (lo smash passa da 0,28s a ~0,6s dal colpo all'atterraggio).
 * I giocatori continuano a saltare con GRAVITY.
 */
export const BALL_GRAVITY = 12;
/** Colpo normale / ricezione: spinta verso l'alto e velocità orizzontale verso la metà campo avversaria. (prima 9 / 8) */
export const BALL_NORMAL_UP = 8;
export const BALL_NORMAL_SPEED = 5.8;
/** Smash: verso il basso (negativo) e velocità orizzontale. Resta ~2× più veloce del colpo normale. (prima -7.5 / 15) */
export const BALL_SMASH_DOWN = -1.5;
export const BALL_SMASH_SPEED = 12;
/** Servizio. (prima 10 / 9) */
export const BALL_SERVE_UP = 8.5;
export const BALL_SERVE_SPEED = 6.5;
/** Limiti di sicurezza: nessuna combinazione di colpi/abilità/collisioni può superarli. */
export const BALL_MAX_SPEED = 18; // velocità totale
export const BALL_MAX_HSPEED = 15; // componente orizzontale (XZ)

/** Assist di mira verso il centro campo: laterale = -x · BALL_AIM_ASSIST, limitato a ±BALL_AIM_MAX (rapporto laterale/avanti). */
export const BALL_AIM_ASSIST = 0.06; // prima 0.12
export const BALL_AIM_MAX = 0.5;

/**
 * Direzione ORIZZONTALE UNITARIA di un colpo: avanti (dirZ = ±1) + lieve assist laterale verso il centro.
 * Normalizzata: la velocità orizzontale del colpo è sempre quella nominale del tipo di colpo. Prima
 * era vx = -x·0.12·speed, quindi ai bordi campo la componente orizzontale cresceva fino a +75%
 * (uno smash da 15 m/s diventava ~21 m/s): il difensore non poteva reagire.
 */
export function hitDirection(
  ballX: number,
  dirZ: number,
  assist = BALL_AIM_ASSIST,
  max = BALL_AIM_MAX
): { dx: number; dz: number } {
  const lateral = Math.max(-max, Math.min(max, -ballX * assist));
  const len = Math.hypot(lateral, 1);
  return { dx: lateral / len, dz: dirZ / len };
}

/** Clamp separato di componente orizzontale e velocità totale: le velocità non si accumulano oltre il tetto. */
export function clampBallSpeed(
  b: { vx: number; vy: number; vz: number },
  maxTotal = BALL_MAX_SPEED,
  maxHorizontal = BALL_MAX_HSPEED
): void {
  const h = Math.hypot(b.vx, b.vz);
  if (h > maxHorizontal) {
    const k = maxHorizontal / h;
    b.vx *= k;
    b.vz *= k;
  }
  const t = Math.hypot(b.vx, b.vy, b.vz);
  if (t > maxTotal) {
    const k = maxTotal / t;
    b.vx *= k;
    b.vy *= k;
    b.vz *= k;
  }
}

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
