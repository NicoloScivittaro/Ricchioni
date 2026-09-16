import type Phaser from 'phaser';
import type {
  ActiveModifier,
  MinigameResult,
  ModifierDefinition,
  PlayerId,
  PlayerSnapshot
} from '../../shared/types';
import type { Rng } from '../../shared/rng';
import type { InputManager } from '../network/InputManager';

/**
 * Contesto consegnato a un minigioco sull'host.
 * Il minigioco NON conosce i personaggi né il trasporto di rete: legge gli
 * input tramite ctx.input (InputManager) e termina con ctx.finish(ranking).
 */
export interface MinigameContext {
  players: PlayerSnapshot[];
  playerIds: PlayerId[];
  rng: Rng;
  durationSec: number;
  modifier: ModifierDefinition | null;
  modifiers: Map<PlayerId, ActiveModifier[]>;
  input: InputManager;
  consume(playerId: PlayerId, hook: string): boolean;
  /** Invia dati privati a un singolo telefono (host → server → telefono). */
  sendPrivate(playerId: PlayerId, data: unknown): void;
  finish(result: MinigameResult): void;
}

/** Modulo esportato da ogni cartella minigames/<id>/index.ts (lato host). */
export interface MinigameSceneModule {
  sceneKey: string;
  scene: typeof Phaser.Scene;
}
