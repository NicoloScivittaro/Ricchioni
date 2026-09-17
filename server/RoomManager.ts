import { Server, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { EVT } from '../shared/protocol';
import type {
  AckResponse,
  CreateRoomPayload,
  InputRelayEvent,
  JoinAck,
  JoinPayload,
  MinigameFinishedPayload,
  MinigameSelectedPayload,
  PrivateDataPayload,
  ReadyPayload,
  RoomCreatedAck,
  SelectCharacterPayload,
  SelectMinigamePayload,
  SignalPayload,
  VibratePlayerPayload
} from '../shared/protocol';
import { MAX_PLAYERS, MIN_PLAYERS, TARGET_SCORE_MAX, TARGET_SCORE_MIN } from '../shared/types';
import type { InputEvent, RoomCode } from '../shared/types';
import { GameSession } from './GameSession';
import { PlayerSession } from './PlayerSession';
import { ReconnectionManager } from './ReconnectionManager';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genRoomCode(len = 5): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? Math.round(v) : fallback;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Instrada gli eventi socket verso le stanze e fa da relay degli input.
 * Solo l'host può eseguire azioni di controllo partita; i telefoni mandano input.
 */
export class RoomManager {
  private rooms = new Map<RoomCode, GameSession>();
  private socketToPlayer = new Map<string, { roomCode: RoomCode; playerId: string }>();
  private hostSockets = new Map<string, RoomCode>();
  private reconn = new ReconnectionManager();
  private lastInputTs = new Map<string, number>();

  constructor(private io: Server) {}

  handleConnection(socket: Socket): void {
    socket.on(EVT.hostCreate, (payload: CreateRoomPayload & { hostToken?: string }, cb) =>
      this.onCreate(socket, payload, cb)
    );
    socket.on(EVT.playerJoin, (payload: JoinPayload, cb) => this.onJoin(socket, payload, cb));
    socket.on(EVT.playerSelectCharacter, (p: SelectCharacterPayload) =>
      this.onSelectCharacter(socket, p.characterId)
    );
    socket.on(EVT.playerReady, (p: ReadyPayload) => this.onReady(socket, p.ready));
    socket.on(EVT.inputDown, (p: { controlId: string }) =>
      this.onInput(socket, { kind: 'down', controlId: p.controlId })
    );
    socket.on(EVT.inputUp, (p: { controlId: string }) =>
      this.onInput(socket, { kind: 'up', controlId: p.controlId })
    );
    socket.on(EVT.inputAction, (p: { controlId: string }) =>
      this.onInput(socket, { kind: 'action', controlId: p.controlId })
    );
    socket.on(EVT.inputAxis, (p: { controlId: string; x: number; y: number }) =>
      this.onInput(socket, { kind: 'axis', controlId: p.controlId, x: p.x, y: p.y })
    );
    socket.on(EVT.hostStart, () => this.onHostStart(socket));
    socket.on(EVT.hostMinigameFinished, (p: MinigameFinishedPayload) =>
      this.onMinigameFinished(socket, p)
    );
    socket.on(EVT.hostSkip, () => this.onSkip(socket));
    socket.on(EVT.hostSelectMinigame, (p: SelectMinigamePayload) =>
      this.onSelectMinigame(socket, p.minigameId)
    );
    socket.on(EVT.hostRestartMinigame, () => this.onRestartMinigame(socket));
    socket.on(EVT.hostPrivateData, (p: PrivateDataPayload) => this.onPrivateData(socket, p));
    socket.on(EVT.hostRestartMatch, () => this.onRestartMatch(socket));
    socket.on(EVT.hostBackToLobby, () => this.onBackToLobby(socket));
    socket.on(EVT.hostVibratePlayer, (p: VibratePlayerPayload) => this.onHostVibratePlayer(socket, p));
    socket.on(EVT.hostSignal, (p: SignalPayload) => this.onSignal(socket, p));
    socket.on('disconnect', () => this.onDisconnect(socket));
  }

  // ---- Host ----

  private onCreate(socket: Socket, payload: CreateRoomPayload & { hostToken?: string }, cb?: (r: AckResponse) => void): void {
    // Riconnessione host
    if (payload?.hostToken) {
      const room = [...this.rooms.values()].find((r) => r.hostToken === payload.hostToken);
      if (room) {
        room.hostConnectionId = socket.id;
        this.hostSockets.set(socket.id, room.roomCode);
        cb?.({ ok: true, roomCode: room.roomCode, hostToken: room.hostToken, playerCount: room.playerCount, targetScore: room.targetScore });
        room.resendSelected(); // se a metà partita, re-invia il minigioco per la ripresa
        this.broadcast(room.roomCode);
        return;
      }
    }

    const playerCount = clampInt(payload?.playerCount, MIN_PLAYERS, MAX_PLAYERS, 2);
    const targetScore = clampInt(payload?.targetScore, TARGET_SCORE_MIN, TARGET_SCORE_MAX, 60);
    const code = this.uniqueRoomCode();
    const hostToken = randomUUID();
    const session = new GameSession(code, playerCount, targetScore, hostToken);
    session.hostConnectionId = socket.id;
    this.rooms.set(code, session);
    this.hostSockets.set(socket.id, code);
    this.wireRoom(session);

    const ack: RoomCreatedAck & AckResponse = { ok: true, roomCode: code, hostToken, playerCount, targetScore };
    cb?.(ack);
    this.broadcast(code);
  }

  // ---- Join giocatore ----

  private onJoin(socket: Socket, payload: JoinPayload, cb?: (r: AckResponse) => void): void {
    // Riconnessione con token
    if (payload?.reconnectToken) {
      const target = this.reconn.resolve(payload.reconnectToken);
      if (target) {
        const room = this.rooms.get(target.roomCode);
        const player = room?.getPlayer(target.playerId);
        if (room && player) {
          player.attach(socket.id);
          this.reconn.cancelExpiry(payload.reconnectToken);
          this.socketToPlayer.set(socket.id, { roomCode: room.roomCode, playerId: player.id });
          const ack: JoinAck & AckResponse = { ok: true, playerId: player.id, reconnectToken: player.reconnectToken };
          cb?.(ack);
          this.broadcast(room.roomCode);
          return;
        }
      }
      cb?.({ ok: false, error: 'Token di riconnessione non valido o scaduto' });
      return;
    }

    const code = (payload.roomCode ?? '').toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) {
      cb?.({ ok: false, error: 'Stanza inesistente' });
      return;
    }
    if (room.phase !== 'LOBBY') {
      cb?.({ ok: false, error: 'La partita è già iniziata' });
      return;
    }
    if (room.isFull()) {
      cb?.({ ok: false, error: 'Stanza piena' });
      return;
    }

    const playerId = randomUUID();
    const reconnectToken = randomUUID();
    const name = (payload.displayName ?? '').trim().slice(0, 20) || 'Giocatore';
    const player = new PlayerSession(playerId, name, reconnectToken);
    player.attach(socket.id);
    room.addPlayer(player);
    this.reconn.register(reconnectToken, room.roomCode, playerId);
    this.socketToPlayer.set(socket.id, { roomCode: room.roomCode, playerId });

    const ack: JoinAck & AckResponse = { ok: true, playerId, reconnectToken };
    cb?.(ack);
    this.broadcast(room.roomCode);
  }

  private onSelectCharacter(socket: Socket, characterId: string): void {
    const loc = this.socketToPlayer.get(socket.id);
    const room = loc ? this.rooms.get(loc.roomCode) : undefined;
    if (!loc || !room) return;
    room.selectCharacter(loc.playerId, characterId);
    this.broadcast(room.roomCode);
  }

  private onReady(socket: Socket, ready: boolean): void {
    const loc = this.socketToPlayer.get(socket.id);
    const room = loc ? this.rooms.get(loc.roomCode) : undefined;
    if (!loc || !room) return;
    room.setReady(loc.playerId, ready);
    this.broadcast(room.roomCode);
  }

  // ---- Input relay (telefono → host) ----

  private onInput(socket: Socket, input: InputEvent): void {
    const loc = this.socketToPlayer.get(socket.id);
    const room = loc ? this.rooms.get(loc.roomCode) : undefined;
    if (!loc || !room || room.phase !== 'MINIGAME_PLAYING' || !room.hostConnectionId) return;

    // rate-limit grossolano anti-flood (max ~1 evento / 4ms per giocatore)
    const now = Date.now();
    const last = this.lastInputTs.get(loc.playerId) ?? 0;
    if (now - last < 4) return;
    this.lastInputTs.set(loc.playerId, now);

    const relay: InputRelayEvent = { playerId: loc.playerId, input };
    this.io.to(room.hostConnectionId).emit(EVT.inputRelay, relay);
  }

  // ---- Controllo partita (solo host) ----

  private onHostStart(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room || !room.allReady()) return;
    room.startGame(); // gli eventi 'pick' e 'changed' gestiscono emit + broadcast
  }

  private onMinigameFinished(socket: Socket, p: MinigameFinishedPayload): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.finishMinigame(p.results);
  }

  private onSkip(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.skip();
  }

  private onSelectMinigame(socket: Socket, minigameId: string | null): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.selectMinigame(minigameId);
    this.broadcast(room.roomCode);
  }

  private onRestartMinigame(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.restartCurrentMinigame(); // emette 'pick' + 'changed' → emit/broadcast
  }

  private onPrivateData(socket: Socket, p: PrivateDataPayload): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    const player = room.getPlayer(p.playerId);
    if (player?.connectionId) this.io.to(player.connectionId).emit(EVT.privateData, p.data);
  }

  private onHostVibratePlayer(socket: Socket, p: VibratePlayerPayload): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    const player = room.getPlayer(p.playerId);
    if (player?.connectionId) this.io.to(player.connectionId).emit(EVT.vibrate, p.ms);
  }

  private onSignal(socket: Socket, p: SignalPayload): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    if (p.playerId) {
      const player = room.getPlayer(p.playerId);
      if (player?.connectionId) this.io.to(player.connectionId).emit(EVT.controllerSignal, p.signal);
    } else {
      for (const pl of room.players) {
        if (pl.connectionId) this.io.to(pl.connectionId).emit(EVT.controllerSignal, p.signal);
      }
    }
  }

  private onBackToLobby(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.resetToLobby(); // emette 'changed' → broadcast
  }

  private onRestartMatch(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.restartMatch(); // emette 'changed' → broadcast
  }

  private emitMinigameSelected(room: GameSession, payload: MinigameSelectedPayload): void {
    if (!room.hostConnectionId) return;
    this.io.to(room.hostConnectionId).emit(EVT.minigameSelected, payload);
    for (const p of room.players) {
      if (p.connectionId) {
        this.io.to(p.connectionId).emit(EVT.controllerLayout, payload.controllerLayout);
      }
    }
  }

  /** Collega gli eventi interni della stanza al socket. */
  private wireRoom(room: GameSession): void {
    room.events.on('pick', (payload) => this.emitMinigameSelected(room, payload as MinigameSelectedPayload));
    room.events.on('changed', () => this.broadcast(room.roomCode));
    room.events.on('vibrate', () => {
      for (const p of room.players) {
        if (p.connectionId) this.io.to(p.connectionId).emit(EVT.vibrate);
      }
    });
  }

  private onDisconnect(socket: Socket): void {
    // Host
    const hostCode = this.hostSockets.get(socket.id);
    if (hostCode) {
      const room = this.rooms.get(hostCode);
      if (room && room.hostConnectionId === socket.id) room.hostConnectionId = null;
      this.hostSockets.delete(socket.id);
      return;
    }

    // Giocatore
    const loc = this.socketToPlayer.get(socket.id);
    if (loc) {
      const room = this.rooms.get(loc.roomCode);
      const player = room?.getPlayer(loc.playerId);
      if (room && player) {
        player.detach();
        this.reconn.scheduleExpiry(player.reconnectToken, () => {
          /* scaduto: il token non è più valido, il giocatore resta in partita senza controllo */
        });
        // Evita kart/personaggi che restano "premuti" per sempre se il telefono
        // sparisce mentre un tasto hold (es. accelera) è ancora giù.
        if (room.hostConnectionId) {
          this.io.to(room.hostConnectionId).emit(EVT.playerDisconnected, { playerId: player.id });
        }
        this.broadcast(room.roomCode);
      }
      this.socketToPlayer.delete(socket.id);
    }
  }

  private roomOfHost(socket: Socket): GameSession | undefined {
    const code = this.hostSockets.get(socket.id);
    return code ? this.rooms.get(code) : undefined;
  }

  private broadcast(roomCode: RoomCode): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const state = room.toRoomState();
    if (room.hostConnectionId) this.io.to(room.hostConnectionId).emit(EVT.roomState, state);
    for (const p of room.players) {
      if (p.connectionId) this.io.to(p.connectionId).emit(EVT.roomState, state);
    }
  }

  private uniqueRoomCode(): string {
    let code = genRoomCode();
    while (this.rooms.has(code)) code = genRoomCode();
    return code;
  }
}
