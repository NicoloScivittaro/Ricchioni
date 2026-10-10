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

  charging: boolean;
  chargeTime: number;
  attackCooldown: number;
  attackBlocked: boolean;
  cancelVersion: number;
  shoulderTime: number;
  shoulderPower: number;
  recoveryTime: number;
  momentumTime: number;
  instability: number;
  lastImpactAt: number;
  prevX: number;
  prevZ: number;

  stunTime: number;
  hitFlash: number;

  // Abilità (cariche, ricarica e stato dell'effetto: la logica e' in arenaAbilities.ts, i numeri in shared/abilityCatalog.ts)
  abCharges: number;
  abCooldown: number;
  parryTime: number; // Goblin: finestra di parata
  whiffTime: number; // Goblin: fuori equilibrio dopo una parata a vuoto
  stanceTime: number; // Buttafuori: postura
  stored: number; // Buttafuori: spinta assorbita, da restituire
  awareTime: number; // Dottore: finestra "sveglio"
  drowsyTime: number; // Dottore: riaddormentato (lento)
  armTime: number; // Ciro: postura armata
  debtTime: number; // Ciro: debito in corso
  knockbackResist: number; // moltiplicatore knockback SUBITO (0..1; <1 = resiste)
  speedMult: number; // moltiplicatore velocita'/accelerazione
  knockMult: number; // moltiplicatore knockback INFLITTO

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
    charging: false, chargeTime: 0, attackCooldown: 0, attackBlocked: false, cancelVersion: 0,
    shoulderTime: 0, shoulderPower: 0, recoveryTime: 0, momentumTime: 0,
    instability: 0, lastImpactAt: -99, prevX: 0, prevZ: 0,
    stunTime: 0,
    hitFlash: 0,
    abCharges: 0,
    abCooldown: 0,
    parryTime: 0,
    whiffTime: 0,
    stanceTime: 0,
    stored: 0,
    awareTime: 0,
    drowsyTime: 0,
    armTime: 0,
    debtTime: 0,
    knockbackResist: 1,
    speedMult: 1,
    knockMult: 1,
    lastHitBy: null,
    lastHitAt: -99,
    eliminations: 0,
    edgeWarnAt: 0,
    spin: 0
  };
}
