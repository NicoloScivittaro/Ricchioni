/** CASA CARBO — tipi del simulatore (puro). Coordinate in PIXEL della planimetria (vedi mapData.ts), tempi in secondi. */

export interface CCInput {
  mx: number; // -1..1 destra +
  my: number; // -1..1 SU (verso il giardino anteriore) +
  squeegeeHeld: boolean;
  bucketPressed: boolean;
  bucketHeld: boolean;
  dashPressed: boolean;
  interactHeld: boolean;
  abilityPressed: boolean;
}
export const CC_NO_INPUT: CCInput = { mx: 0, my: 0, squeegeeHeld: false, bucketPressed: false, bucketHeld: false, dashPressed: false, interactHeld: false, abilityPressed: false };

export type CCAbilityResult = 'ok' | 'spent' | 'cooldown' | 'notNear' | 'busy' | 'notNow' | 'disabled';

export interface CCStats {
  drainedBucket: number;
  drainedSqueegee: number;
  drainedAbility: number;
  /** acqua fermata alle porte (unita', prima del tetto dei punti) */
  stopped: number;
  spilled: number;
  tvSaved: number;
  unclogged: number;
  slips: number;
  abilityUses: number;
  abilitySuccess: number;
  abilityFail: number;
  impact: Record<string, number>;
}

export interface CCAbilityState {
  charges: number;
  cooldown: number;
  // Goblin
  windupT: number;
  // Boschi
  blockT: number;
  blockDoor: 'front' | 'back' | null;
  blocked: number;
  // Victor
  intelT: number;
  intelDoor: 'front' | 'back' | null;
  intelAt: number;
  intelEvent: number;
  // Carbo
  damT: number;
  damCells: number[];
  damHeldMax: number;
  // Ciro
  bigBucket: boolean;
  deadlineT: number;
}

export interface CCPlayer {
  id: string;
  index: number;
  characterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** direzione in cui guarda (vettore unitario nel piano del disegno, y verso il basso) */
  fx: number;
  fy: number;
  bucket: number;
  dashT: number;
  dashCd: number;
  slipT: number;
  /** quanto tempo sta tenendo premuto "interagisci" sullo stesso obiettivo */
  holdT: number;
  holdKey: string;
  squeegee: boolean;
  scooping: boolean;
  containing: 'front' | 'back' | null;
  tieBreak: number;
  ab: CCAbilityState;
  stats: CCStats;
}

export type CCEventKind = 'pioggia' | 'raffica' | 'tappeto' | 'intasato' | 'tv';

export interface CCScheduled {
  kind: CCEventKind;
  at: number;
  /** solo raffica */
  door?: 'front' | 'back';
  /** solo intasato */
  drain?: 'bagno' | 'lavello' | 'tombino';
  /** solo tappeto (indice di RUG_SPOTS) */
  rug?: number;
  announced: boolean;
  started: boolean;
  ended: boolean;
}

export type CCEvent =
  | { t: 'announce'; kind: CCEventKind; door?: 'front' | 'back'; at: number }
  | { t: 'eventStart'; kind: CCEventKind; door?: 'front' | 'back'; drain?: string; rug?: number }
  | { t: 'eventEnd'; kind: CCEventKind; door?: 'front' | 'back'; drain?: string; rug?: number }
  | { t: 'phase'; name: 'moderata' | 'forte' | 'raffiche' | 'picco' | 'calma' }
  | { t: 'drain'; id: string; drain: string; amount: number; via: 'bucket' | 'squeegee' | 'ability' }
  | { t: 'drainFull'; id: string; drain: string }
  | { t: 'spill'; id: string; amount: number; why: 'dash' | 'slip' | 'bump' | 'deadline' }
  | { t: 'slip'; id: string }
  | { t: 'dash'; id: string }
  | { t: 'contain'; id: string; door: 'front' | 'back'; on: boolean }
  | { t: 'unclog'; id: string; drain: string }
  | { t: 'tv'; state: 'danger' | 'saved' | 'ruined'; by?: string }
  | { t: 'rugCleared'; id: string }
  | { t: 'abilityPress'; id: string; res: CCAbilityResult }
  | { t: 'ability'; id: string; a: CCAbilityEvent; door?: 'front' | 'back'; at?: number; amount?: number }
  | { t: 'end'; dry: number; saved: boolean };

export type CCAbilityEvent =
  | 'goblin_windup'
  | 'goblin_wave'
  | 'boschi_block'
  | 'boschi_release'
  | 'victor_intel'
  | 'victor_wasted'
  | 'victor_right'
  | 'carbo_dam'
  | 'carbo_break'
  | 'carbo_end'
  | 'ciro_arm'
  | 'ciro_paid'
  | 'ciro_lost';

export function freshCCStats(): CCStats {
  return { drainedBucket: 0, drainedSqueegee: 0, drainedAbility: 0, stopped: 0, spilled: 0, tvSaved: 0, unclogged: 0, slips: 0, abilityUses: 0, abilitySuccess: 0, abilityFail: 0, impact: {} };
}

export function freshCCAbility(): CCAbilityState {
  return { charges: 0, cooldown: 0, windupT: 0, blockT: 0, blockDoor: null, blocked: 0, intelT: 0, intelDoor: null, intelAt: 0, intelEvent: -1, damT: 0, damCells: [], damHeldMax: 0, bigBucket: false, deadlineT: 0 };
}
