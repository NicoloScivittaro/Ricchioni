import type { PlayerId } from '../../../shared/types';

/** Raggio iniziale dell'arena (unità mondo, piano XZ). */
export const ARENA_R = 14;
/** Raggio minimo dopo il restringimento progressivo. */
export const ARENA_R_MIN = 7.5;
/** Raggio di collisione di un personaggio (corpo chibi). */
export const PLAYER_RADIUS = 1.05;

export const ACCEL = 24;
export const MAX_SPEED = 9.5;
/** Smorzamento velocità (per secondo). */
export const FRICTION = 8;

export const DASH_SPEED = 17;
export const DASH_TIME = 0.18;
export const DASH_COOLDOWN = 1.15;

/** Knockback base applicato da un dash/body-check riuscito. */
export const KNOCKBACK_BASE = 10.5;
/** Stordimento breve dopo un colpo subito (input ignorato). */
export const STUN_TIME = 0.42;
/** Gravità per l'arco del knockback (salto in aria). */
export const GRAVITY = 26;

/** Distanza dal bordo (unita') sotto cui scatta l'avviso di pericolo (anello rosso sotto il giocatore + telefono). */
export const EDGE_WARN_DIST = 2.6;

/** Secondi prima che l'arena inizi a restringersi. */
export const SHRINK_DELAY = 8;
/** Durata del restringimento (dopo lo shrink delay), in secondi. */
export const SHRINK_DURATION = 22;

export interface ArenaPlayer {
  id: PlayerId;
  characterId: string | null;
  color: string;
  avatar: string;
  name: string;

  x: number;
  z: number;
  y: number; // altezza (rimbalzo knockback)
  vx: number;
  vz: number;
  vy: number;
  facing: number; // rad nel piano XZ (forward = sin,cos)

  alive: boolean;
  /** true quando è stato eliminato e sta volando via (animazione caduta). */
  falling: boolean;

  dashing: boolean;
  dashTime: number;
  dashCooldown: number;

  stunTime: number;
  hitFlash: number;

  // Abilità (una volta a partita + eventuali buff temporizzati)
  abilityUsed: boolean;
  abilityTimer: number;
  knockbackResist: number; // moltiplicatore knockback SUBITO (0..1; <1 = resiste)
  speedMult: number; // moltiplicatore velocità/accelerazione
  knockMult: number; // moltiplicatore knockback INFLITTO
  deferArmed: boolean; // Ciro: prossima spinta rimandata
  deferredKnock: { x: number; z: number } | null;
  deferTimer: number;

  /** CHI: ultimo giocatore che ti ha spinto e QUANDO (secondi di gioco): decide di chi e' l'eliminazione. */
  lastHitBy: PlayerId | null;
  lastHitAt: number;
  /** Eliminazioni "meritate" (spinte fuori entro 3 s dall'ultimo colpo). */
  eliminations: number;
  /** Ultimo avviso di bordo mandato al telefono (ms, performance.now). */
  edgeWarnAt: number;

  /** spin/scale usati dall'animazione di caduta/vittoria. */
  spin: number;
}

export function createArenaPlayer(
  id: PlayerId,
  characterId: string | null,
  color: string,
  avatar: string,
  name: string
): ArenaPlayer {
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
    dashing: false,
    dashTime: 0,
    dashCooldown: 0,
    stunTime: 0,
    hitFlash: 0,
    abilityUsed: false,
    abilityTimer: 0,
    knockbackResist: 1,
    speedMult: 1,
    knockMult: 1,
    deferArmed: false,
    deferredKnock: null,
    deferTimer: 0,
    lastHitBy: null,
    lastHitAt: -99,
    eliminations: 0,
    edgeWarnAt: 0,
    spin: 0
  };
}
