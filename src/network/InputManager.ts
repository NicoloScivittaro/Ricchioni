import { PlayerInput } from './PlayerInput';
import type { InputEvent, PlayerId } from '../../shared/types';

/**
 * Punto di raccolta unico degli input di tutti i giocatori.
 * Gli adapter (network, tastiera, gamepad) scrivono qui; i minigiochi leggono.
 */
export class InputManager {
  private inputs = new Map<PlayerId, PlayerInput>();

  get(playerId: PlayerId): PlayerInput {
    let p = this.inputs.get(playerId);
    if (!p) {
      p = new PlayerInput(playerId);
      this.inputs.set(playerId, p);
    }
    return p;
  }

  has(playerId: PlayerId): boolean {
    return this.inputs.has(playerId);
  }

  /** Inietta un input proveniente da un qualsiasi device. */
  handle(playerId: PlayerId, ev: InputEvent): void {
    const p = this.get(playerId);
    switch (ev.kind) {
      case 'down':
        p.setDown(ev.controlId);
        break;
      case 'up':
        p.setUp(ev.controlId);
        break;
      case 'action':
        p.tap(ev.controlId);
        break;
      case 'axis':
        p.setAxis(ev.controlId, ev.x, ev.y);
        break;
    }
  }

  /** Testo libero da un giocatore (es. bluff). */
  setText(playerId: PlayerId, controlId: string, text: string): void {
    this.get(playerId).setText(controlId, text);
  }

  /** Azzera gli edge di frame per tutti (chiamare ogni frame). */
  update(): void {
    for (const p of this.inputs.values()) p.clearFrame();
  }

  /** Rilascia tutti i tasti di un giocatore (es. disconnessione a metà pressione). */
  releasePlayer(playerId: PlayerId): void {
    this.inputs.get(playerId)?.releaseAll();
  }

  reset(): void {
    this.inputs.clear();
  }
}
