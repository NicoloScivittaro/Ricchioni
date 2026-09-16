import Phaser from 'phaser';
import { Emitter } from '../../shared/events';
import { Rng } from '../../shared/rng';
import { getCharacter } from '../../shared/characters';
import { getMinigame } from '../../shared/minigames';
import { getModifier } from '../../shared/modifiers';
import { EVT } from '../../shared/protocol';
import type {
  AckResponse,
  InputRelayEvent,
  MinigameSelectedPayload,
  RoomCreatedAck
} from '../../shared/protocol';
import type {
  ActiveModifier,
  GamePhase,
  MinigameResult,
  ModifierDefinition,
  PlayerId,
  PlayerPublic,
  PlayerSnapshot,
  RoomState
} from '../../shared/types';
import { SocketClient } from '../network/SocketClient';
import { InputManager } from '../network/InputManager';
import type { MinigameContext } from '../minigames/types';

/**
 * View-model lato HOST: rispecchia lo stato autoritativo del server e guida
 * le transizioni delle scene Phaser. L'host esegue il minigioco (è la
 * "console") e riferisce solo il ranking finale al server.
 */
export class GameManager {
  readonly events = new Emitter();
  readonly input = new InputManager();

  state: RoomState | null = null;
  roomCode = '';
  hostToken: string | null = null;
  connectionError: string | null = null;
  private reconnecting = false;

  pendingMinigame: MinigameSelectedPayload | null = null;
  minigameContext: MinigameContext | null = null;

  private socket: SocketClient | null = null;
  private game: Phaser.Game | null = null;
  private lastPhase: GamePhase = 'LOBBY';

  attach(game: Phaser.Game): void {
    this.game = game;
  }

  connect(url?: string): void {
    if (this.socket) this.socket.socket.disconnect();
    this.socket = new SocketClient(url);
    const s = this.socket;

    this.socket.socket.on('connect_error', (err: Error) => {
      this.connectionError = err.message;
      this.events.emit('connection', 'error');
    });
    this.socket.socket.on('connect', () => {
      this.connectionError = null;
      this.events.emit('connection', 'ok');
    });

    s.on(EVT.roomState, (payload) => this.onRoomState(payload as RoomState));
    s.on(EVT.minigameSelected, (payload) => this.onMinigameSelected(payload as MinigameSelectedPayload));
    s.on(EVT.inputRelay, (payload) => this.onInputRelay(payload as InputRelayEvent));

    // Riconnessione automatica dell'host con token salvato
    const saved = this.loadHostToken();
    if (saved) {
      this.reconnecting = true;
      const doReconnect = (): void => this.attemptHostReconnect(saved);
      if (this.socket.socket.connected) doReconnect();
      else this.socket.socket.once('connect', doReconnect);
    }
  }

  get connected(): boolean {
    return this.socket?.socket.connected ?? false;
  }

  // ---- Azioni host ----

  async createRoom(playerCount: number, targetScore: number): Promise<RoomCreatedAck & AckResponse> {
    const ack = await this.socket!.emitAck<RoomCreatedAck & AckResponse>(EVT.hostCreate, {
      playerCount,
      targetScore
    });
    if (ack.ok && ack.roomCode) {
      this.roomCode = ack.roomCode;
      this.hostToken = (ack as { hostToken?: string }).hostToken ?? null;
      if (this.hostToken) this.saveHostToken(this.hostToken);
    }
    return ack;
  }

  startGame(): void {
    this.socket?.emit(EVT.hostStart);
  }

  /** L'host salta le animazioni (non il calcolo punti né il controllo vittoria). */
  skip(): void {
    this.socket?.emit(EVT.hostSkip);
  }

  /** L'host sceglie manualmente il minigioco (null = rullo). */
  selectMinigame(minigameId: string | null): void {
    this.socket?.emit(EVT.hostSelectMinigame, { minigameId });
  }

  /** Invia dati privati a un singolo telefono (es. carte segrete, ruoli, obiettivi). */
  sendPrivate(playerId: string, data: unknown): void {
    this.socket?.emit(EVT.hostPrivateData, { playerId, data });
  }

  backToLobby(): void {
    this.socket?.emit(EVT.hostBackToLobby);
    this.state = null;
    this.pendingMinigame = null;
    this.minigameContext = null;
    this.lastPhase = 'LOBBY';
  }

  finishMinigame(result: MinigameResult): void {
    this.socket?.emit(EVT.hostMinigameFinished, { results: result.results });
  }

  /** Avvia la scena del minigioco (chiamato dalla RouletteScene a fine animazione). */
  launchMinigame(): void {
    if (!this.pendingMinigame || !this.game) return;
    const def = getMinigame(this.pendingMinigame.minigameId);
    if (!def) return;
    this.game.scene.start(def.sceneKey, { ctx: this.minigameContext });
  }

  // ---- Costruzione contesto minigioco ----

  private buildContext(payload: MinigameSelectedPayload): MinigameContext {
    const snapshots = payload.players.map((p) => this.toSnapshot(p));
    const modifiers = new Map<PlayerId, ActiveModifier[]>(
      Object.entries(payload.activeModifiers).map(([k, v]) => [k, v])
    );
    const modifier: ModifierDefinition | null = payload.modifierId
      ? (getModifier(payload.modifierId) ?? null)
      : null;

    this.input.reset();

    return {
      players: snapshots,
      playerIds: snapshots.map((p) => p.id),
      rng: new Rng(),
      durationSec: payload.durationSec,
      modifier,
      modifiers,
      input: this.input,
      consume: (playerId, hook) => this.consume(modifiers, playerId, hook),
      sendPrivate: (playerId, data) => this.sendPrivate(playerId, data),
      finish: (result) => this.finishMinigame(result)
    };
  }

  private toSnapshot(p: PlayerPublic): PlayerSnapshot {
    const c = p.characterId ? getCharacter(p.characterId) : null;
    return {
      id: p.id,
      displayName: p.displayName,
      characterId: p.characterId,
      name: c?.name ?? p.displayName,
      roleTitle: c?.roleTitle ?? '',
      avatar: c?.avatar ?? '🎮',
      color: c?.color ?? '#ffffff',
      quote: c?.quote ?? '',
      score: p.score
    };
  }

  private consume(map: Map<PlayerId, ActiveModifier[]>, pid: PlayerId, hook: string): boolean {
    const list = map.get(pid);
    if (!list) return false;
    const m = list.find((x) => x.hook === hook && x.uses > 0);
    if (!m) return false;
    m.uses -= 1;
    return true;
  }

  // ---- Handler eventi server ----

  private attemptHostReconnect(token: string): void {
    this.socket!.emit(EVT.hostCreate, { hostToken: token }, (res: unknown) => {
      const ack = res as AckResponse & { roomCode?: string; hostToken?: string };
      if (ack.ok && ack.roomCode) {
        this.roomCode = ack.roomCode;
        this.hostToken = ack.hostToken ?? token;
        this.saveHostToken(this.hostToken);
      } else {
        this.clearHostToken();
        this.reconnecting = false;
      }
    });
  }

  private saveHostToken(t: string): void {
    try {
      localStorage.setItem('ricchioni.hostToken', t);
    } catch {
      /* ignore */
    }
  }

  private loadHostToken(): string | null {
    try {
      return localStorage.getItem('ricchioni.hostToken');
    } catch {
      return null;
    }
  }

  private clearHostToken(): void {
    try {
      localStorage.removeItem('ricchioni.hostToken');
    } catch {
      /* ignore */
    }
  }

  private onRoomState(state: RoomState): void {
    const prev = this.lastPhase;
    this.lastPhase = state.phase;
    this.state = state;
    this.events.emit('state', state);

    if (this.reconnecting) {
      this.reconnecting = false;
      if (state.phase === 'LOBBY') {
        this.game?.scene.start('RoomScene');
        return;
      }
    }

    if (state.phase === prev) return;

    // Uscendo dal minigioco: azzera gli input per non ereditare tasti premuti.
    if (prev === 'MINIGAME_PLAYING') {
      this.input.reset();
    }

    this.transitionTo(state.phase);
  }

  private transitionTo(phase: GamePhase): void {
    if (!this.game) return;
    switch (phase) {
      case 'MINIGAME_ROULETTE':
        this.game.scene.start('RouletteScene');
        break;
      case 'MINIGAME_INTRO':
        this.game.scene.start('IntroScene');
        break;
      case 'MINIGAME_PLAYING':
        this.launchMinigame();
        break;
      case 'MINIGAME_FINISHED':
        this.game.scene.start('FinishedScene');
        break;
      case 'ROUND_RESULTS':
        this.game.scene.start('ResultsScene');
        break;
      case 'GLOBAL_LEADERBOARD':
        this.game.scene.start('LeaderboardScene');
        break;
      case 'NEXT_ROUND':
        this.game.scene.start('NextRoundScene');
        break;
      case 'GAME_FINISHED':
        this.game.scene.start('GameOverScene');
        break;
      default:
        break;
    }
  }

  private onMinigameSelected(payload: MinigameSelectedPayload): void {
    this.pendingMinigame = payload;
    this.minigameContext = this.buildContext(payload);
    this.events.emit('minigame', payload);
  }

  private onInputRelay(relay: InputRelayEvent): void {
    this.input.handle(relay.playerId, relay.input);
  }
}

export const game = new GameManager();
