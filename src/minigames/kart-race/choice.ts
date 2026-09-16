import type { PlayerId } from '../../../shared/types';
import type { MinigameContext } from '../types';

export interface ChoiceOption {
  id: string;
  label: string;
  icon?: string;
}

interface PendingChoice {
  playerId: PlayerId;
  optionIds: string[];
  timer: number;
  defaultId: string;
  resolve: (chosenId: string) => void;
}

/**
 * Presenta una scelta temporanea a UN giocatore (es. Goblin: 2 item; Dottore:
 * 3 siringhe) riusando ctx.sendPrivate esistente per mostrare i pulsanti sul
 * telefono, e ctx.input per leggere la risposta (ogni opzione è un controlId
 * temporaneo che il telefono invia come normale input "action").
 */
export class ChoiceManager {
  private pending: PendingChoice[] = [];

  ask(ctx: MinigameContext, playerId: PlayerId, title: string, options: ChoiceOption[], timeoutSec: number, resolve: (chosenId: string) => void): void {
    // Pulisce eventuali scelte precedenti in sospeso per lo stesso giocatore.
    this.pending = this.pending.filter((p) => p.playerId !== playerId);
    ctx.sendPrivate(playerId, { type: 'choice', title, options, timeoutMs: Math.round(timeoutSec * 1000) });
    this.pending.push({ playerId, optionIds: options.map((o) => o.id), timer: timeoutSec, defaultId: options[0].id, resolve });
  }

  update(dt: number, ctx: MinigameContext): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      const pin = ctx.input.get(p.playerId);
      let chosen: string | null = null;
      for (const id of p.optionIds) {
        if (pin.justPressed(id)) {
          chosen = id;
          break;
        }
      }
      p.timer -= dt;
      if (!chosen && p.timer <= 0) chosen = p.defaultId;
      if (chosen) {
        this.pending.splice(i, 1);
        p.resolve(chosen);
      }
    }
  }

  isPending(playerId: PlayerId): boolean {
    return this.pending.some((p) => p.playerId === playerId);
  }
}
