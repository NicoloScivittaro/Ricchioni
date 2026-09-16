import Phaser from 'phaser';
import type { InputManager } from './InputManager';
import type { PlayerId } from '../../shared/types';

/**
 * Adapter di debug/test: mappa la tastiera a un giocatore.
 * Utile per provare un minigioco senza telefono. In partita reale l'input
 * arriva dal telefono tramite il server (NetworkInputAdapter nel GameManager).
 */
const KC = Phaser.Input.Keyboard.KeyCodes;

export const KEYBOARD_BINDINGS: Record<string, { player: number; controlId: string }> = {
  // P0 (simulazione giocatore 1)
  [KC.A]: { player: 0, controlId: 'answerA' },
  [KC.S]: { player: 0, controlId: 'answerB' },
  [KC.D]: { player: 0, controlId: 'answerC' },
  [KC.F]: { player: 0, controlId: 'answerD' },
  // P1 (simulazione giocatore 2)
  [KC.G]: { player: 1, controlId: 'answerA' },
  [KC.H]: { player: 1, controlId: 'answerB' },
  [KC.J]: { player: 1, controlId: 'answerC' },
  [KC.K]: { player: 1, controlId: 'answerD' }
};

export function installKeyboardAdapter(
  scene: Phaser.Scene,
  input: InputManager,
  playerIds: PlayerId[]
): void {
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    const b = KEYBOARD_BINDINGS[event.keyCode];
    if (!b || !playerIds[b.player]) return;
    input.handle(playerIds[b.player], { kind: 'down', controlId: b.controlId });
  });
  scene.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
    const b = KEYBOARD_BINDINGS[event.keyCode];
    if (!b || !playerIds[b.player]) return;
    input.handle(playerIds[b.player], { kind: 'up', controlId: b.controlId });
  });
}
