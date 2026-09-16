import { getCharacter } from '../characters';
import type { PlayerId, PlayerSnapshot, PlayerState } from './types';

/** Gestisce lo stato dei giocatori in partita (risorse, punteggio, stats). */
export class PlayerManager {
  players: PlayerState[] = [];

  set(ids: PlayerId[]): void {
    this.players = ids.map((id) => {
      const c = getCharacter(id);
      return {
        id,
        name: c.name,
        roleTitle: c.roleTitle,
        avatar: c.avatar,
        image: c.image,
        color: c.color,
        quote: c.quote,
        resourceName: c.resourceName,
        resourceValue: c.initialResource,
        resourceMax: c.resourceMax,
        score: 0,
        stats: {},
        flags: {}
      };
    });
  }

  get(id: PlayerId): PlayerState {
    const p = this.players.find((x) => x.id === id);
    if (!p) throw new Error(`Giocatore non trovato: ${id}`);
    return p;
  }

  ids(): PlayerId[] {
    return this.players.map((p) => p.id);
  }

  snapshots(): PlayerSnapshot[] {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      roleTitle: p.roleTitle,
      avatar: p.avatar,
      image: p.image,
      color: p.color,
      quote: p.quote,
      resourceName: p.resourceName,
      resourceValue: p.resourceValue,
      resourceMax: p.resourceMax,
      score: p.score
    }));
  }

  syncScores(scores: Map<PlayerId, number>): void {
    for (const p of this.players) p.score = scores.get(p.id) ?? 0;
  }
}
