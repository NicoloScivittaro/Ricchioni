// ============================================================================
// Tipi condivisi tra server, host (Phaser) e controller (smartphone).
// Nessuna dipendenza da Phaser, DOM o Node: pura definizione di dati.
// ============================================================================

export type PlayerId = string;
export type CharacterId = string;
export type RoomCode = string;

export type Category =
  | 'CULTURA'
  | 'SKILL'
  | 'GUIDA'
  | 'MEMORIA'
  | 'FORTUNA'
  | 'ARENA'
  | 'RIFLESSI'
  | 'SOCIALE'
  | 'PUZZLE'
  | 'SPORT'
  | 'SOPRAVVIVENZA';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'special';

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  uncommon: 50,
  rare: 20,
  epic: 5,
  special: 0
};

export type HookId = string;

export type GamePhase =
  | 'LOBBY'
  | 'MINIGAME_ROULETTE'
  | 'MINIGAME_INTRO'
  | 'MINIGAME_PLAYING'
  | 'MINIGAME_FINISHED'
  | 'ROUND_RESULTS'
  | 'GLOBAL_LEADERBOARD'
  | 'CHECK_WINNER'
  | 'NEXT_ROUND'
  | 'GAME_FINISHED';

/** Durate configurabili del flusso (condivise tra server e host per restare in sync). */
export const FLOW_TIMING = {
  revealStepMs: 900,
  revealWinnerDelayMs: 1300,
  revealFinalHoldMs: 2400,
  rouletteMs: 3800,
  introMs: 4200,
  finishedMs: 1200,
  leaderboardMs: 3600,
  nextRoundMs: 3000
} as const;

// ---- Configurazione partita ----

export interface ScorePreset {
  id: string;
  label: string;
  points: number;
}

export const SCORE_PRESETS: ScorePreset[] = [
  { id: 'rapida', label: 'RAPIDA', points: 30 },
  { id: 'breve', label: 'BREVE', points: 40 },
  { id: 'normale', label: 'NORMALE', points: 60 },
  { id: 'lunga', label: 'LUNGA', points: 80 }
];

export const TARGET_SCORE_MIN = 10;
export const TARGET_SCORE_MAX = 200;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 5;

// ---- Personaggio ----

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  roleTitle: string;
  subtitle: string;
  avatar: string;
  image: string;
  color: string;
  quote: string;
  resourceName: string;
  resourceMax: number;
  initialResource: number;
  passive: { name: string; description: string };
  weakness: { name: string; description: string };
  abilityName: string;
  abilityDescription: string;
  hooks: Partial<Record<Category, HookId[]>>;
  defaultHooks: HookId[];
}

// ---- Giocatore (stato lato server) ----

export interface PlayerState {
  /** id stabile, indipendente dal socket (per la riconnessione). */
  id: PlayerId;
  connectionId: string | null;
  reconnectToken: string;
  displayName: string;
  characterId: CharacterId | null;
  ready: boolean;
  connected: boolean;
  score: number;
}

/** Vista pubblica di un giocatore inviata a host e telefoni. */
export interface PlayerPublic {
  id: PlayerId;
  displayName: string;
  characterId: CharacterId | null;
  ready: boolean;
  connected: boolean;
  score: number;
}

/** Snapshot arricchito (con dati del personaggio) usato dai minigiochi sull'host. */
export interface PlayerSnapshot {
  id: PlayerId;
  displayName: string;
  characterId: CharacterId | null;
  name: string;
  roleTitle: string;
  avatar: string;
  color: string;
  quote: string;
  score: number;
}

// ---- Minigioco ----

/** Risultato di un singolo giocatore in un minigioco. */
export interface PlayerResult {
  playerId: PlayerId;
  /** Posizione: 1 = primo. */
  placement: number;
  /** Punteggio interno del minigioco (es. risposte corrette). NON i punti partita. */
  score: number;
}

/** Risultato standardizzato che ogni minigioco restituisce al sistema centrale. */
export interface MinigameResult {
  /** Ordinati dal 1° all'ultimo. */
  results: PlayerResult[];
}

export type ControlKind = 'button' | 'hold' | 'axis';

export interface ControlDef {
  id: string;
  label: string;
  kind: ControlKind;
  icon?: string;
  color?: string;
}

export type ControllerLayout =
  | { type: 'buttons'; grid: number; controls: ControlDef[] }
  | { type: 'dpad'; controls: ControlDef[] }
  | { type: 'joystick'; controls: ControlDef[] }
  | { type: 'custom'; id: string };

export interface MinigameDefinition {
  id: string;
  name: string;
  category: Category;
  rarity: Rarity;
  minPlayers: number;
  maxPlayers: number;
  durationSec: number;
  compatibleModifiers: string[];
  sceneKey: string;
  controllerLayout: ControllerLayout;
}

export interface ModifierDefinition {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface ActiveModifier {
  source: PlayerId;
  hook: HookId;
  label: string;
  uses: number;
  payload?: unknown;
}

// ---- Stato stanza (broadcast a tutti) ----

export interface CurrentMinigame {
  minigameId: string;
  name: string;
  category: Category;
  modifierId: string | null;
  durationSec: number;
  controllerLayout: ControllerLayout;
}

export interface RoundResults {
  /** Risultati del round (placement + punteggio interno). */
  results: PlayerResult[];
  /** Id dei giocatori ordinati dal 1° all'ultimo. */
  ranking: PlayerId[];
  /** Punti partita assegnati a ciascun giocatore. */
  deltas: Record<PlayerId, number>;
  double: boolean;
}

export interface RoomState {
  roomCode: RoomCode;
  phase: GamePhase;
  round: number;
  targetScore: number;
  playerCount: number;
  players: PlayerPublic[];
  charactersLocked: CharacterId[];
  currentMinigame: CurrentMinigame | null;
  lastResults: RoundResults | null;
  winner: PlayerId | null;
  suddenDeath: boolean;
  /** null = rullo (casuale); altrimenti il minigioco scelto manualmente dall'host. */
  selectedMinigameId: string | null;
}

/** Evento di input (telefono → server → host). */
export type InputEvent =
  | { kind: 'down'; controlId: string }
  | { kind: 'up'; controlId: string }
  | { kind: 'action'; controlId: string }
  | { kind: 'axis'; controlId: string; x: number; y: number };
