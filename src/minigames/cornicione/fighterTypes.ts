import type { ImpactName, MoveDef } from './fighterData';

/** Input di UN passo di simulazione (gia' tradotto dai controlli: stick + tasti). I "Pressed" sono fronti (valgono per un solo passo). */
export interface FighterInput {
  mx: number; // -1..1, destra +
  my: number; // -1..1, SU +
  jumpPressed: boolean;
  jumpHeld: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  dodgePressed: boolean;
  abilityPressed: boolean;
  kickPressed?: boolean;
  grabPressed?: boolean;
  parryPressed?: boolean;
}

export const NO_INPUT: FighterInput = { kickPressed:false,grabPressed:false,parryPressed:false, mx: 0, my: 0, jumpPressed: false, jumpHeld: false, lightPressed: false, heavyPressed: false, dodgePressed: false, abilityPressed: false };

export type AbilityResult = 'ok' | 'spent' | 'busy' | 'notAir' | 'notOffstage' | 'stunned' | 'notNow' | 'disabled';

export interface FighterStats {
  kos: number;
  deaths: number;
  dmgDealt: number;
  dmgTaken: number;
  deathPercents: number[];
  recoveryAttempts: number;
  recoveriesOk: number;
  edgeKos: number;
  maxCombo: number;
  abilityUses: number;
  abilitySuccess: number;
  abilityFail: number;
  /** metriche specifiche dell'abilita' (vedi fighterAbilities) */
  impact: Record<string, number>;
}

export interface AbilityState {
  /** usi rimasti in QUESTA vita */
  charges: number;
  // Goblin
  burstT: number; // scatto in corso
  returnT: number; // tempo rimasto per rimettere piede sul palco
  followT: number; // finestra dell'attacco speciale
  // Buttafuori
  vanishT: number;
  vanishTotal: number;
  targetX: number;
  targetY: number;
  lockDodge: number;
  // Judoka
  stanceT: number;
  whiffT: number;
  freezeT: number; // pausa del contrattacco (presa) prima del lancio
  throwVictim: string | null;
  throwSpeed: number;
  // Dottore
  weightT: number;
  // Ciro
  windowT: number; // finestra BONIFICO?
  pendingT: number; // PAGAMENTO PENDENTE
  windowSpent: boolean; // la finestra di questo "incrocio" e' gia' stata offerta
  pendingHow: 'side' | 'top' | 'bottom';
  // comune
  wasActive: boolean;
}

export interface AttackState {
  move: MoveDef;
  t: number;
  hit: Set<string>;
  /** fase gia' annunciata: 0 anticipo, 1 attivo, 2 recupero */
  phase: 0 | 1 | 2;
}

export interface DodgeState {
  air: boolean;
  t: number;
  dx: number;
  dy: number;
}

export interface Fighter {
  id: string;
  index: number;
  characterId: string;
  // posizione dei PIEDI e velocita'
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  // stato di vita
  percent: number;
  lives: number;
  /** false = eliminato per sempre */
  inGame: boolean;
  /** true = in pausa di respawn (non simulato, non visibile) */
  dead: boolean;
  respawnT: number;
  eliminatedAt: number;
  // movimento
  grounded: boolean;
  /** 0 = palco principale, 1..3 = piattaforme, -1 = niente */
  support: number;
  coyote: number;
  jumps: number;
  jumpRising: boolean;
  fastFall: boolean;
  dropT: number;
  dropHold: number;
  // buffer
  jumpBuf: number;
  lightBuf: number;
  heavyBuf: number;
  dodgeBuf: number;
  // azioni
  kickBuf: number; grabBuf: number; parryBuf: number;
  parry: {t:number} | null;
  parryCd: number;
  grab: {victim:string;t:number} | null;
  grabbedBy: string | null;
  grabProtect: number;
  attack: AttackState | null;
  dodge: DodgeState | null;
  dodgeCd: number;
  airDodgeUsed: boolean;
  landLag: number;
  recoveryUsed: boolean;
  // parete
  wallCharges: number;
  wallSide: -1 | 0 | 1;
  clingT: number;
  // stordimento e protezioni
  hitstun: number;
  hitstunTotal: number;
  hitFlash: number;
  invuln: number; // respawn
  intang: number; // schivata / abilita'
  hover: number; // sospeso dopo il respawn
  comboCount: number;
  comboT: number;
  comboBreak: boolean;
  lastHitBy: string | null;
  lastHitAt: number;
  lastHitVia: string;
  /** fermo totale (presa del Judoka, finestra del bonifico): nessuna fisica, nessuna azione */
  frozenT: number;
  tieBreak: number;
  /** ultime mosse subite da questo bersaglio (per il calo anti-mash): id mossa + attaccante */
  recentHits: { attacker: string; move: string }[];
  lastStick: { x: number; y: number };
  // meta
  recovering: boolean;
  offstageSince: number;
  ab: AbilityState;
  stats: FighterStats;
}

export type FighterEvent =
  | { t: 'attack'; id: string; move: MoveDef; phase: 'start' | 'active' }
  | { t: 'hit'; attacker: string | null; victim: string; move: string; dmg: number; speed: number; impact: ImpactName; x: number; y: number; dx: number; dy: number; percent: number; combo: number; ko: boolean; via?: string }
  | { t: 'ko'; victim: string; by: string | null; how: 'side' | 'top' | 'bottom'; percent: number; x: number; y: number; lives: number; eliminated: boolean; edge: boolean }
  | { t: 'respawn'; id: string }
  | { t: 'jump'; id: string; double: boolean }
  | { t: 'land'; id: string; hard: boolean }
  | { t: 'dodge'; id: string; air: boolean }
  | { t: 'recoveryAttack'; id: string }
  | { t: 'noRecovery'; id: string }
  | { t: 'wall'; id: string; side: -1 | 1 }
  | { t: 'wallJump'; id: string }
  | { t: 'recovered'; id: string }
  | { t: 'bounce'; id: string }
  | { t: 'ability'; id: string; a: AbilityEventName; x?: number; y?: number; extra?: number }
  | { t: 'abilityPress'; id: string; res: AbilityResult }
  | { t: 'grab'; id:string; victim:string; state:'caught'|'thrown'|'escaped' }
  | { t: 'parry'; id:string; state:'start'|'success'|'miss'; attacker?:string }
  | { t: 'end'; reason: 'lastStanding' | 'timeout' | 'suddenDeath' };

export type AbilityEventName =
  | 'goblin_burst'
  | 'goblin_return'
  | 'goblin_follow'
  | 'goblin_wasted'
  | 'vanish'
  | 'telegraph'
  | 'reappear'
  | 'counter_arm'
  | 'counter_hit'
  | 'counter_whiff'
  | 'weight_on'
  | 'weight_off'
  | 'bonifico_open'
  | 'bonifico_yes'
  | 'bonifico_paid'
  | 'bonifico_fail'
  | 'bonifico_declined';

export type MatchPhase = 'fight' | 'sudden' | 'over';

export function freshAbilityState(): AbilityState {
  return {
    charges: 1,
    burstT: 0,
    returnT: 0,
    followT: 0,
    vanishT: 0,
    vanishTotal: 0,
    targetX: 0,
    targetY: 0,
    lockDodge: 0,
    stanceT: 0,
    whiffT: 0,
    freezeT: 0,
    throwVictim: null,
    throwSpeed: 0,
    weightT: 0,
    windowT: 0,
    pendingT: 0,
    windowSpent: false,
    pendingHow: 'side',
    wasActive: false
  };
}
