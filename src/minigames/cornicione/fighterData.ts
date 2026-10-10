/**
 * BOTTE SUL CORNICIONE — DATI (nessuna logica, nessun Babylon): fisica, palco, tabella delle mosse. Un solo posto da toccare per il
 * bilanciamento. Unita': metri e secondi. Origine: centro del palco principale, y = 0 sul piano di calpestio, x a destra.
 * Tutti i personaggi hanno ESATTAMENTE gli stessi valori: l'unica differenza e' l'abilita' (shared/abilityCatalog.ts, game 'cornicione').
 */

// ------------------------------------------------------------------ fisica del personaggio (uguale per tutti)
export const PHYS = {
  /** mezza larghezza del corpo (hurtbox e collisione) e altezza */
  halfW: 0.62,
  height: 2.3,
  gravity: 40,
  maxFall: 21,
  fastFall: 34,
  /** corsa */
  runSpeed: 9.2,
  groundAccel: 75,
  groundFriction: 60,
  /** controllo in aria: inferiore a quello a terra */
  airSpeed: 7.4,
  airAccel: 30,
  /** attrito in aria quando si supera la velocita' di controllo (lascia sopravvivere lo slancio di un colpo, non per sempre) */
  airDrag: 2.2,
  jumpV: 18,
  doubleJumpV: 16.5,
  /** salto corto: rilasciando il tasto mentre sale */
  shortHopCut: 0.55,
  coyote: 0.08,
  buffer: 0.12,
  /** salti totali (a terra + in aria) */
  jumps: 2
} as const;

// ------------------------------------------------------------------ schivata
export const DODGE = {
  ground: { time: 0.3, intangible: 0.22, speed: 11, cooldown: 0.9, end: 0.08 },
  air: { time: 0.26, intangible: 0.26, speed: 13, cooldown: 1.1 }
} as const;

// ------------------------------------------------------------------ pareti (recovery)
export const WALL = {
  /** quanti attacchi alla parete per ogni "volo" (si ricaricano a terra) */
  charges: 2,
  /** secondi massimi attaccati prima di scivolare giu' */
  clingTime: 0.7,
  slideSpeed: 3,
  jumpV: 16,
  jumpAway: 5.2,
  /** vicinanza alla parete (m) entro cui si "tocca" */
  reach: 0.12
} as const;

// ------------------------------------------------------------------ recovery attack (↑ + pesante in aria)
export const RECOVERY = { boost: 19 } as const;

// ------------------------------------------------------------------ danno / knockback / stordimento
export const DMG = {
  /** moltiplicatore del danno inflitto da mosse ripetute sullo stesso bersaglio (anti-mash): 1, .94, .88 ... */
  staleStep: 0.06,
  staleMin: 0.6,
  staleMemory: 5,
  /** tempo di stordimento = base + velocita' di lancio * k, poi scalato dalla combo */
  hitstunBase: 0.1,
  hitstunPerSpeed: 0.0125,
  hitstunMin: 0.1,
  hitstunMax: 0.95,
  /** dopo il 1° colpo di una combo ogni colpo successivo dura meno (anti combo infinite) */
  comboHitstunDecay: 0.17,
  comboHitstunFloor: 0.35,
  /** finestra entro cui un colpo "continua" la combo */
  comboWindow: 0.45,
  /** dopo questo numero di colpi di fila chi subisce, a fine stordimento, e' intangibile un attimo */
  comboBreakHits: 6,
  comboBreakIntangible: 0.5,
  /** resistenza dell'aria al lancio durante lo stordimento */
  launchDrag: 0.9,
  launchGravity: 0.55,
  /** DI: quanto la direzione dello stick devia il lancio (frazione della velocita'); NON basta ad annullare il colpo */
  di: 0.14,
  diDuring: 5,
  /** un lancio verso il basso che tocca terra rimbalza cosi' */
  bounce: 0.38
} as const;

// ------------------------------------------------------------------ KO e respawn
export const KO = {
  /** limiti oltre cui si perde una vita: MOLTO piu' lontani dell'inquadratura */
  minX: -34,
  maxX: 34,
  minY: -22,
  maxY: 27,
  respawnDelay: 1.8,
  /** il respawn gira sospeso un attimo sopra il centro */
  respawnHover: 0.9,
  respawnY: 12,
  respawnInvuln: 2.0,
  lives: 3,
  /** chi ti ha colpito per ultimo negli ultimi N secondi si prende il KO */
  creditWindow: 4
} as const;

// ------------------------------------------------------------------ partita
export const MATCH = {
  timeLimit: 150,
  suddenDeathMax: 20,
  suddenDeathPercent: 150
} as const;

// ------------------------------------------------------------------ palco: TETTO DEL DISAGIO
export interface OneWay {
  id: number;
  x0: number;
  x1: number;
  y: number;
}
export const STAGE = {
  /** blocco principale: la palazzina. Piano a y=0, pareti verticali infinite verso il basso (recovery sulla parete) */
  mainX: 13,
  /** piattaforme one-way (si attraversano dal basso e con ↓) */
  platforms: [
    { id: 1, x0: -11.5, x1: -6.5, y: 3.6 },
    { id: 2, x0: 6.5, x1: 11.5, y: 3.6 },
    { id: 3, x0: -3, x1: 3, y: 7.2 }
  ] as OneWay[]
} as const;

/** Punti di partenza (x, y) per 2..5 giocatori: simmetrici, nessuno vicino al bordo. */
export function spawnPoints(n: number): { x: number; y: number }[] {
  switch (n) {
    case 1:
      return [{ x: 0, y: 0 }];
    case 2:
      return [{ x: -7, y: 0 }, { x: 7, y: 0 }];
    case 3:
      return [{ x: -8, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 7.2 }];
    case 4:
      return [{ x: -10, y: 0 }, { x: -3.5, y: 0 }, { x: 3.5, y: 0 }, { x: 10, y: 0 }];
    default:
      return [{ x: -10, y: 0 }, { x: 10, y: 0 }, { x: -4, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 7.2 }];
  }
}

// ------------------------------------------------------------------ mosse
export type MoveDir = 'n' | 's' | 'u' | 'd';
export type MoveKind = 'light' | 'heavy' | 'recovery' | 'follow' | 'kick' | 'grab';
export type ImpactName = 'LIGHT' | 'MEDIUM' | 'HEAVY';
export type MoveAnim = 'jab' | 'side' | 'up' | 'down' | 'smash' | 'upHeavy' | 'sweepHeavy' | 'air' | 'spike' | 'recovery' | 'follow' | 'kick' | 'grab';

export interface MoveDef {
  id: string;
  kind: MoveKind;
  air: boolean;
  dir: MoveDir;
  /** anticipo (nessun colpo), fase attiva (il colpo c'e'), recupero (scoperto) — secondi */
  startup: number;
  active: number;
  recovery: number;
  /** Extra recovery if the new spacing move misses. Original moves are unchanged. */
  whiffRecovery?: number;
  dmg: number;
  /** knockback = bkb + percentuale_vittima * kbs (m/s) */
  bkb: number;
  kbs: number;
  /** gradi: 0 = avanti, 90 = su, negativo = giu' (relativo a dove guarda chi colpisce) */
  angle: number;
  /** hitbox: centro avanti/altezza dai piedi, larghezza, altezza */
  hit: { x: number; y: number; w: number; h: number };
  /** colpisce anche dietro (spazzata) */
  twoSided?: boolean;
  /** moltiplicatore dello stordimento */
  stun?: number;
  /** velocita' in avanti durante anticipo+attivo */
  lunge?: number;
  /** blocco all'atterraggio se la mossa non e' finita (aeree) */
  landLag?: number;
  impact: ImpactName;
  anim: MoveAnim;
}

const m = (d: MoveDef): MoveDef => d;

/** A TERRA. Le leggere sono veloci e poco forti; le pesanti sono lente, forti e punibili. */
export const GROUND_MOVES: Record<string, MoveDef> = {
  nL: m({ id: 'nL', kind: 'light', air: false, dir: 'n', startup: 0.05, active: 0.06, recovery: 0.12, dmg: 2.8, bkb: 4, kbs: 0.03, angle: 30, hit: { x: 1.2, y: 1.3, w: 1.4, h: 1.0 }, impact: 'LIGHT', anim: 'jab' }),
  sL: m({ id: 'sL', kind: 'light', air: false, dir: 's', startup: 0.07, active: 0.07, recovery: 0.17, dmg: 4.5, bkb: 5.5, kbs: 0.05, angle: 32, hit: { x: 1.6, y: 1.2, w: 1.9, h: 1.1 }, lunge: 3, impact: 'LIGHT', anim: 'side' }),
  uL: m({ id: 'uL', kind: 'light', air: false, dir: 'u', startup: 0.06, active: 0.09, recovery: 0.16, dmg: 4, bkb: 5.5, kbs: 0.05, angle: 88, hit: { x: 0.3, y: 2.5, w: 1.9, h: 1.4 }, impact: 'LIGHT', anim: 'up' }),
  dL: m({ id: 'dL', kind: 'light', air: false, dir: 'd', startup: 0.06, active: 0.07, recovery: 0.17, dmg: 3.5, bkb: 4.5, kbs: 0.04, angle: 60, hit: { x: 1.4, y: 0.4, w: 2.0, h: 0.8 }, impact: 'LIGHT', anim: 'down' }),
  sH: m({ id: 'sH', kind: 'heavy', air: false, dir: 's', startup: 0.3, active: 0.09, recovery: 0.45, dmg: 13, bkb: 11, kbs: 0.21, angle: 36, hit: { x: 1.9, y: 1.25, w: 2.4, h: 1.5 }, lunge: 4, impact: 'HEAVY', anim: 'smash' }),
  uH: m({ id: 'uH', kind: 'heavy', air: false, dir: 'u', startup: 0.26, active: 0.11, recovery: 0.46, dmg: 12, bkb: 12, kbs: 0.23, angle: 88, hit: { x: 0.2, y: 2.7, w: 2.3, h: 1.9 }, impact: 'HEAVY', anim: 'upHeavy' }),
  dH: m({ id: 'dH', kind: 'heavy', air: false, dir: 'd', startup: 0.28, active: 0.12, recovery: 0.5, dmg: 11, bkb: 9.5, kbs: 0.19, angle: 25, hit: { x: 0, y: 0.6, w: 4.4, h: 1.1 }, twoSided: true, impact: 'HEAVY', anim: 'sweepHeavy' })
};

/** IN ARIA. Il pesante in alto e' il RECOVERY ATTACK (sale e colpisce). */
export const AIR_MOVES: Record<string, MoveDef> = {
  nAL: m({ id: 'nAL', kind: 'light', air: true, dir: 'n', startup: 0.04, active: 0.1, recovery: 0.1, dmg: 3.2, bkb: 4.5, kbs: 0.035, angle: 45, hit: { x: 0.9, y: 1.2, w: 2.4, h: 1.6 }, twoSided: true, landLag: 0.08, impact: 'LIGHT', anim: 'air' }),
  sAL: m({ id: 'sAL', kind: 'light', air: true, dir: 's', startup: 0.06, active: 0.08, recovery: 0.14, dmg: 4.5, bkb: 5.5, kbs: 0.05, angle: 35, hit: { x: 1.7, y: 1.2, w: 2.0, h: 1.1 }, landLag: 0.1, impact: 'LIGHT', anim: 'side' }),
  uAL: m({ id: 'uAL', kind: 'light', air: true, dir: 'u', startup: 0.05, active: 0.09, recovery: 0.13, dmg: 4, bkb: 5.5, kbs: 0.05, angle: 85, hit: { x: 0, y: 2.7, w: 2.0, h: 1.3 }, landLag: 0.09, impact: 'LIGHT', anim: 'up' }),
  dAL: m({ id: 'dAL', kind: 'light', air: true, dir: 'd', startup: 0.06, active: 0.08, recovery: 0.14, dmg: 3.5, bkb: 4, kbs: 0.04, angle: -50, hit: { x: 0.5, y: -0.2, w: 1.6, h: 1.2 }, landLag: 0.1, impact: 'LIGHT', anim: 'down' }),
  sAH: m({ id: 'sAH', kind: 'heavy', air: true, dir: 's', startup: 0.26, active: 0.1, recovery: 0.38, dmg: 12, bkb: 10.5, kbs: 0.2, angle: 40, hit: { x: 1.9, y: 1.3, w: 2.3, h: 1.5 }, landLag: 0.26, impact: 'HEAVY', anim: 'smash' }),
  dAH: m({ id: 'dAH', kind: 'heavy', air: true, dir: 'd', startup: 0.3, active: 0.12, recovery: 0.4, dmg: 10, bkb: 9, kbs: 0.16, angle: -75, hit: { x: 0.3, y: -0.3, w: 1.8, h: 1.5 }, landLag: 0.3, impact: 'HEAVY', anim: 'spike' }),
  uAH: m({ id: 'uAH', kind: 'recovery', air: true, dir: 'u', startup: 0.06, active: 0.2, recovery: 0.3, dmg: 7, bkb: 7, kbs: 0.09, angle: 85, hit: { x: 0.2, y: 2.6, w: 2.2, h: 1.8 }, landLag: 0.12, impact: 'MEDIUM', anim: 'recovery' })
};

/** Mossa speciale del Goblin dopo RIMONTA AL 90° (il danno viene dal catalogo). */
export function followMove(dmg: number): MoveDef {
  return m({ id: 'follow', kind: 'follow', air: true, dir: 's', startup: 0.04, active: 0.12, recovery: 0.2, dmg, bkb: 9, kbs: 0.12, angle: 55, hit: { x: 1.4, y: 1.3, w: 3.0, h: 2.0 }, landLag: 0.1, impact: 'MEDIUM', anim: 'follow' });
}

/** Scelta della mossa da (aria?, tasto, direzione dello stick). Le pesanti neutre sono laterali. */
export function pickMove(air: boolean, kind: 'light' | 'heavy', dir: MoveDir): MoveDef {
  if (!air) {
    if (kind === 'light') return GROUND_MOVES[`${dir}L`];
    return GROUND_MOVES[dir === 'n' ? 'sH' : `${dir}H`];
  }
  if (kind === 'light') return AIR_MOVES[`${dir}AL`];
  return AIR_MOVES[dir === 'u' ? 'uAH' : dir === 'd' ? 'dAH' : 'sAH'];
}

export const ALL_MOVES: MoveDef[] = [...Object.values(GROUND_MOVES), ...Object.values(AIR_MOVES)];

/** Soglie di lettura dello stick. */
export const STICK = { dead: 0.2, dir: 0.55, side: 0.45, drop: 0.7, fastFall: 0.6 } as const;


/** New options: same data for all five characters. No changes to the fourteen original moves. */
export const STRATEGY = {
 parry:{startup:.025,active:.12,recovery:.28,cooldown:.95,punish:.28},
 grab:{hold:.22,protect:1.0,maxSpeed:30}
} as const;
export const STRATEGY_MOVES = {
 kick:m({id:'kick',kind:'kick',air:false,dir:'s',startup:.18,active:.10,recovery:.30,whiffRecovery:.18,dmg:4.5,bkb:6,kbs:.055,angle:30,hit:{x:2.35,y:1.1,w:2.3,h:1.0},impact:'LIGHT',anim:'kick'}),
 airKick:m({id:'airKick',kind:'kick',air:true,dir:'s',startup:.14,active:.12,recovery:.28,whiffRecovery:.15,dmg:4.5,bkb:6,kbs:.055,angle:35,hit:{x:2.1,y:1.1,w:2.4,h:1.1},landLag:.22,impact:'LIGHT',anim:'kick'}),
 airDownKick:m({id:'airDownKick',kind:'kick',air:true,dir:'d',startup:.16,active:.11,recovery:.32,whiffRecovery:.15,dmg:4,bkb:6,kbs:.05,angle:-55,hit:{x:.85,y:-.3,w:2.1,h:1.6},landLag:.28,impact:'LIGHT',anim:'kick'}),
 grab:m({id:'grab',kind:'grab',air:false,dir:'s',startup:.16,active:.05,recovery:.43,dmg:3,bkb:8,kbs:.10,angle:28,hit:{x:.9,y:1.1,w:.8,h:1.6},impact:'MEDIUM',anim:'grab'})
};
export function pickKick(air:boolean,down:boolean):MoveDef {return air?(down?STRATEGY_MOVES.airDownKick:STRATEGY_MOVES.airKick):STRATEGY_MOVES.kick;}
