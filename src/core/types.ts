/** Identificatore stabile di un giocatore (coincide con l'id del personaggio). */
export type PlayerId = string;

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
  special: 0 // mai pescato per peso: esce solo tramite trigger speciali
};

/** Hook generico che un minigioco può implementare e un'abilità può attivare. */
export type HookId = string;

/** Istantanea immutabile di un giocatore passata ai minigiochi. */
export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  roleTitle: string;
  avatar: string;
  image: string;
  color: string;
  quote: string;
  resourceName: string;
  resourceValue: number;
  resourceMax: number;
  score: number;
}

export interface PlayerState extends PlayerSnapshot {
  stats: Record<string, number>;
  flags: Record<string, boolean>;
}

/** Effetto attivo risolto dall'AbilitySystem per un giocatore in un minigioco. */
export interface ActiveModifier {
  source: PlayerId;
  hook: HookId;
  label: string;
  uses: number;
  payload?: unknown;
}

export interface MinigameResult {
  /** Giocatori ordinati dal 1° all'ultimo. */
  ranking: PlayerId[];
  stats?: Record<PlayerId, Record<string, number>>;
}

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
}

export interface ModifierDefinition {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface RouletteHistoryEntry {
  round: number;
  minigameId: string;
  category: Category;
}

export interface RoulettePick {
  category: Category;
  minigameId: string;
  modifierId: string | null;
}

export type GamePhase =
  | 'LOBBY'
  | 'SELECT'
  | 'ROULETTE'
  | 'MINIGAME'
  | 'RESULTS'
  | 'GAME_OVER';

export type GameMode = 'VELOCE' | 'NORMALE' | 'LUNGA';
