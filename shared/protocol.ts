import type {
  ActiveModifier,
  Category,
  ControllerLayout,
  PlayerId,
  PlayerPublic,
  PlayerResult
} from './types';

/**
 * Nomi degli eventi Socket.IO (tipizzati).
 * Il payload di ogni evento è definito dalle interfacce qui sotto;
 * server, host e controller usano queste stesse stringhe.
 */
export const EVT = {
  // ---- Client → Server ----
  hostCreate: 'host:create',
  playerJoin: 'player:join',
  playerSelectCharacter: 'player:selectCharacter',
  playerReady: 'player:ready',
  inputDown: 'input:down',
  inputUp: 'input:up',
  inputAction: 'input:action',
  inputAxis: 'input:axis',
  /** Testo libero dal telefono (es. bluff di CULTURA O CAZZATA). */
  inputText: 'input:text',
  hostStart: 'host:start',
  hostMinigameFinished: 'host:minigameFinished',
  hostSkip: 'host:skip',
  /** Emergenza: salta il minigioco in corso SENZA punti e torna al rullo. */
  hostSkipMinigame: 'host:skipMinigame',
  /** Pausa/ripresa del minigioco (ESC host): ferma la rete di sicurezza server. */
  hostPause: 'host:pause',
  hostSelectMinigame: 'host:selectMinigame',
  hostPrivateData: 'host:privateData',
  hostRestartMatch: 'host:restartMatch',
  hostBackToLobby: 'host:backToLobby',
  /** L'host chiede di far vibrare il telefono di UN giocatore specifico. */
  hostVibratePlayer: 'host:vibratePlayer',
  /** L'host invia un segnale di gioco a uno (o tutti) i telefoni della stanza. */
  hostSignal: 'host:signal',
  /** L'host comunica quali giocatori hanno un controller fisico collegato (playerId -> nome breve). */
  hostGamepads: 'host:gamepads',
  /** Solo debug: il server risponde subito all'ack → misura del ping (overlay F3 / ?debug=1). */
  debugPing: 'debug:ping',

  // ---- Server → Client ----
  roomState: 'room:state',
  hostRoomCreated: 'host:roomCreated',
  playerJoined: 'player:joined',
  minigameSelected: 'minigame:selected',
  error: 'error',
  controllerLayout: 'controller:layout',
  privateData: 'private:data',
  vibrate: 'controller:vibrate',
  controllerSignal: 'controller:signal',

  // ---- Server → Host (relay input) ----
  inputRelay: 'input:relay',
  /** Testo libero relayed dal telefono all'host. */
  textRelay: 'text:relay',
  /** Un giocatore si è disconnesso: l'host deve rilasciare i suoi input tenuti premuti. */
  playerDisconnected: 'player:disconnected'
} as const;

export interface CreateRoomPayload {
  playerCount: number;
  targetScore: number;
}

export interface RoomCreatedAck {
  roomCode: string;
  targetScore: number;
  playerCount: number;
}

export interface JoinPayload {
  roomCode: string;
  displayName: string;
  reconnectToken?: string;
}

export interface JoinAck {
  playerId: PlayerId;
  reconnectToken: string;
}

export interface SelectCharacterPayload {
  characterId: string;
}

export interface ReadyPayload {
  ready: boolean;
}

export interface MinigameFinishedPayload {
  results: PlayerResult[];
  /** roundId del minigioco che ha prodotto il risultato (eventi tardivi vengono ignorati). */
  roundId?: number;
}

export interface PausePayload {
  paused: boolean;
}

export interface SelectMinigamePayload {
  /** null = torna al rullo casuale. */
  minigameId: string | null;
}

export interface PrivateDataPayload {
  playerId: PlayerId;
  data: unknown;
}

export interface InputRelayEvent {
  playerId: PlayerId;
  input: import('./types').InputEvent;
}

export interface InputTextPayload {
  controlId: string;
  text: string;
}

export interface TextRelayEvent {
  playerId: PlayerId;
  controlId: string;
  text: string;
}

export interface PlayerDisconnectedEvent {
  playerId: PlayerId;
}

export interface VibratePlayerPayload {
  playerId: PlayerId;
  ms?: number;
}

export interface SignalPayload {
  /** null = tutti i telefoni della stanza. */
  playerId: PlayerId | null;
  signal: { type: string; [key: string]: unknown };
}

export interface GamepadsPayload {
  /** Solo i giocatori con un controller collegato ADESSO. */
  pads: Record<PlayerId, string>;
}

/** Payload inviato al solo HOST quando parte un minigioco. */
export interface MinigameSelectedPayload {
  /** Id incrementale del minigioco (round): il risultato deve riportarlo indietro. */
  roundId?: number;
  minigameId: string;
  name: string;
  category: Category;
  modifierId: string | null;
  modifierName: string | null;
  modifierDescription: string | null;
  durationSec: number;
  controllerLayout: ControllerLayout;
  players: PlayerPublic[];
  activeModifiers: Record<PlayerId, ActiveModifier[]>;
}

export interface AckResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}
