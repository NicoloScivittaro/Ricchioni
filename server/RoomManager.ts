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
  PausePayload,
  PrivateDataPayload,
  ReadyPayload,
  RoomCreatedAck,
  SelectCharacterPayload,
  SelectMinigamePayload,
  SignalPayload,
  TextRelayEvent,
  VibratePlayerPayload
} from '../shared/protocol';
import { MAX_PLAYERS, MIN_PLAYERS, TARGET_SCORE_MAX, TARGET_SCORE_MIN } from '../shared/types';
import type { InputEvent, RoomCode } from '../shared/types';
import { GameSession } from './GameSession';
import { PlayerSession } from './PlayerSession';
import { ReconnectionManager } from './ReconnectionManager';
import { log } from './log';

/** Intervallo minimo tra due eventi dello stesso asse (anti-flood); gli eventi intermedi vengono fusi, mai persi. */
const AXIS_MIN_INTERVAL_MS = 4;

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
  private lastInputTs = new Map<string, number>(); // "playerId:controlId" → ultimo asse inoltrato
  private pendingAxis = new Map<string, InputEvent>(); // ultimo asse fuso in attesa di consegna

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
    socket.on(EVT.inputText, (p: { controlId: string; text: string }) => {
      const loc = this.socketToPlayer.get(socket.id);
      const room = loc ? this.rooms.get(loc.roomCode) : undefined;
      if (!loc || !room || room.phase !== 'MINIGAME_PLAYING' || !room.hostConnectionId) return;
      const relay: TextRelayEvent = { playerId: loc.playerId, controlId: p.controlId, text: (p.text ?? '').slice(0, 60) };
      this.io.to(room.hostConnectionId).emit(EVT.textRelay, relay);
    });
    socket.on(EVT.hostStart, () => this.onHostStart(socket));
    socket.on(EVT.hostMinigameFinished, (p: MinigameFinishedPayload) =>
      this.onMinigameFinished(socket, p)
    );
    socket.on(EVT.hostSkip, () => this.onSkip(socket));
    socket.on(EVT.hostSkipMinigame, () => this.onSkipMinigame(socket));
    socket.on(EVT.hostPause, (p: PausePayload) => this.onPause(socket, p));
    socket.on(EVT.hostSelectMinigame, (p: SelectMinigamePayload) =>
      this.onSelectMinigame(socket, p.minigameId)
    );
    socket.on(EVT.hostPrivateData, (p: PrivateDataPayload) => this.onPrivateData(socket, p));
    socket.on(EVT.hostRestartMatch, () => this.onRestartMatch(socket));
    socket.on(EVT.hostBackToLobby, () => this.onBackToLobby(socket));
    socket.on(EVT.hostVibratePlayer, (p: VibratePlayerPayload) => this.onHostVibratePlayer(socket, p));
    socket.on(EVT.hostSignal, (p: SignalPayload) => this.onSignal(socket, p));
    socket.on(EVT.debugPing, (_p: unknown, cb?: () => void) => cb?.());
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
        log('RECONNECT', room.roomCode, `host tornato (fase ${room.phase})`);
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
    log('ROOM', code, `creata: ${playerCount} giocatori, target ${targetScore} (stanze attive ${this.rooms.size})`);

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
          // Il vecchio socket (telefono in standby / tab fantasma) non deve più pilotare.
          if (player.connectionId && player.connectionId !== socket.id) {
            this.socketToPlayer.delete(player.connectionId);
          }
          player.attach(socket.id);
          this.reconn.cancelExpiry(payload.reconnectToken);
          this.socketToPlayer.set(socket.id, { roomCode: room.roomCode, playerId: player.id });
          log('RECONNECT', room.roomCode, `${player.displayName} tornato (fase ${room.phase})`);
          const ack: JoinAck & AckResponse = { ok: true, playerId: player.id, reconnectToken: player.reconnectToken };
          cb?.(ack);
          this.broadcast(room.roomCode);
          return;
        }
      }
      cb?.({ ok: false, error: 'Token di riconnessione non valido o scaduto' });
      return;
    }

    // Stesso socket che rifà join (doppio tap / doppio emit): restituisci l'identità già creata,
    // niente giocatore duplicato.
    const existing = this.socketToPlayer.get(socket.id);
    if (existing && existing.roomCode === (payload.roomCode ?? '').toUpperCase().trim()) {
      const exRoom = this.rooms.get(existing.roomCode);
      const exPlayer = exRoom?.getPlayer(existing.playerId);
      if (exRoom && exPlayer && exPlayer.connectionId === socket.id) {
        cb?.({ ok: true, playerId: exPlayer.id, reconnectToken: exPlayer.reconnectToken } as JoinAck & AckResponse);
        return;
      }
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
    const name = (payload.displayName ?? '').replace(/[<>&"'`]/g, '').trim().slice(0, 20) || 'Giocatore';
    const player = new PlayerSession(playerId, name, reconnectToken);
    player.attach(socket.id);
    room.addPlayer(player);
    this.reconn.register(reconnectToken, room.roomCode, playerId);
    this.socketToPlayer.set(socket.id, { roomCode: room.roomCode, playerId });
    log('ROOM', room.roomCode, `entra ${name} (${room.players.length}/${room.playerCount})`);

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

    // Anti-flood SOLO sugli assi (max ~1 evento / 4ms per giocatore e per controllo). Un asse troppo ravvicinato NON si
    // scarta: si fonde con l'ultimo valore e viene consegnato appena scade l'intervallo, così l'ultimo stato (es. la
    // visuale impostata all'inizio, o la fine di uno swipe) arriva sempre. Down/up/action non hanno alcun limite:
    // perdere un "up" lascia un tasto incastrato (kart che accelera per sempre), perdere un "down" è un tocco ignorato;
    // capita con due pollici insieme o quando il Wi-Fi consegna più pacchetti nello stesso istante. Il rilascio del
    // joystick (0,0) passa sempre e cancella eventuali valori in attesa: se si perdesse, il personaggio correrebbe da solo.
    if (input.kind === 'axis') {
      const key = `${loc.playerId}:${input.controlId}`;
      const release = input.x === 0 && input.y === 0;
      const now = Date.now();
      const last = this.lastInputTs.get(key) ?? 0;
      if (!release && now - last < AXIS_MIN_INTERVAL_MS) {
        const waiting = this.pendingAxis.has(key);
        this.pendingAxis.set(key, input);
        if (!waiting) {
          const roomCode = room.roomCode;
          const playerId = loc.playerId;
          setTimeout(() => {
            const pending = this.pendingAxis.get(key);
            this.pendingAxis.delete(key);
            const r = this.rooms.get(roomCode);
            if (!pending || !r || r.phase !== 'MINIGAME_PLAYING' || !r.hostConnectionId) return;
            this.lastInputTs.set(key, Date.now());
            this.io.to(r.hostConnectionId).emit(EVT.inputRelay, { playerId, input: pending } as InputRelayEvent);
          }, Math.max(1, AXIS_MIN_INTERVAL_MS - (now - last)));
        }
        return;
      }
      this.pendingAxis.delete(key); // un valore più vecchio in attesa sarebbe consegnato DOPO questo: superato
      this.lastInputTs.set(key, now);
    }

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
    room.finishMinigame(p?.results ?? [], typeof p?.roundId === 'number' ? p.roundId : undefined);
  }

  private onSkip(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.skip();
  }

  private onSkipMinigame(socket: Socket): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.skipMinigame();
  }

  private onPause(socket: Socket, p: PausePayload): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.setPaused(Boolean(p?.paused));
  }

  private onSelectMinigame(socket: Socket, minigameId: string | null): void {
    const room = this.roomOfHost(socket);
    if (!room) return;
    room.selectMinigame(minigameId);
    this.broadcast(room.roomCode);
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
      if (room && room.hostConnectionId === socket.id) {
        room.hostConnectionId = null;
        log('RECONNECT', hostCode, `host disconnesso (fase ${room.phase})`);
      }
      this.hostSockets.delete(socket.id);
      return;
    }

    // Giocatore
    const loc = this.socketToPlayer.get(socket.id);
    if (loc) {
      const room = this.rooms.get(loc.roomCode);
      const player = room?.getPlayer(loc.playerId);
      if (room && player && player.connectionId === socket.id) {
        log('RECONNECT', room.roomCode, `${player.displayName} disconnesso (fase ${room.phase})`);
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
