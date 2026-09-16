import type { PlayerId, RoomCode } from '../shared/types';

const GRACE_MS = 30_000;

interface TokenTarget {
  roomCode: RoomCode;
  playerId: PlayerId;
}

/**
 * Associa reconnectToken → (stanza, giocatore) e gestisce la finestra di grazia.
 * Il token è un secret: chi lo possiede può riprendere il controllo del giocatore.
 */
export class ReconnectionManager {
  private tokens = new Map<string, TokenTarget>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  register(token: string, roomCode: RoomCode, playerId: PlayerId): void {
    this.tokens.set(token, { roomCode, playerId });
  }

  resolve(token: string): TokenTarget | undefined {
    return this.tokens.get(token);
  }

  /** Avvia il countdown di grazia; alla scadenza il token non è più valido. */
  scheduleExpiry(token: string, onExpire: () => void): void {
    this.cancelExpiry(token);
    const t = setTimeout(() => {
      this.tokens.delete(token);
      this.timers.delete(token);
      onExpire();
    }, GRACE_MS);
    this.timers.set(token, t);
  }

  cancelExpiry(token: string): void {
    const t = this.timers.get(token);
    if (t) {
      clearTimeout(t);
      this.timers.delete(token);
    }
  }
}
