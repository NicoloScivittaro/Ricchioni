import type { CharacterId, PlayerId, PlayerPublic } from '../shared/types';

/**
 * Sessione di un giocatore nella stanza.
 * playerId e reconnectToken sono STABILI e indipendenti dal socketId,
 * così il giocatore può riconnettersi senza perdere personaggio/punteggio/stato.
 */
export class PlayerSession {
  id: PlayerId;
  displayName: string;
  reconnectToken: string;
  characterId: CharacterId | null = null;
  ready = false;
  connected = true;
  score = 0;
  connectionId: string | null = null;

  constructor(id: PlayerId, displayName: string, reconnectToken: string) {
    this.id = id;
    this.displayName = displayName;
    this.reconnectToken = reconnectToken;
  }

  attach(connectionId: string): void {
    this.connectionId = connectionId;
    this.connected = true;
  }

  detach(): void {
    this.connected = false;
  }

  toPublic(): PlayerPublic {
    return {
      id: this.id,
      displayName: this.displayName,
      characterId: this.characterId,
      ready: this.ready,
      connected: this.connected,
      score: this.score
    };
  }
}
