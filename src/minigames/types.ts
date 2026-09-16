import Phaser from 'phaser';
import type {
  ActiveModifier,
  MinigameDefinition,
  MinigameResult,
  ModifierDefinition,
  PlayerId,
  PlayerSnapshot
} from '../core/types';
import type { Rng } from '../core/Rng';

/**
 * Contesto consegnato a un minigioco al lancio.
 * Il minigioco NON conosce i personaggi: riceve snapshot + hook già risolti
 * e termina chiamando finish() con la classifica.
 */
export interface MinigameContext {
  players: PlayerSnapshot[];
  playerIds: PlayerId[];
  rng: Rng;
  durationSec: number;
  modifier: ModifierDefinition | null;
  modifiers: Map<PlayerId, ActiveModifier[]>;
  /** Consuma un uso di un hook; true se era disponibile. */
  consume(playerId: PlayerId, hook: string): boolean;
  /** Termina il minigioco consegnando la classifica (1°..ultimo). */
  finish(result: MinigameResult): void;
}

/**
 * Un modulo minigioco = definizione (metadata) + classe Phaser.Scene che lo implementa.
 * La cartella minigames/<nome>/index.ts esporta questo come default.
 */
export interface MinigameModule {
  definition: MinigameDefinition;
  scene: typeof Phaser.Scene;
}
