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
  hostStart: 'host:start',
  hostMinigameFinished: 'host:minigameFinished',
  hostSkip: 'host:skip',
  hostSelectMinigame: 'host:selectMinigame',
  /** L'host riavvia da capo il minigioco in corso (stesso id), senza tornare al rullo. */
  hostRestartMinigame: 'host:restartMinigame',
  hostPrivateData: 'host:privateData',
  hostRestartMatch: 'host:restartMatch',
  hostBackToLobby: 'host:backToLobby',
  /** L'host chiede di far vibrare il telefono di UN giocatore specifico. */
  hostVibratePlayer: 'host:vibratePlayer',

  // ---- Server → Client ----
  roomState: 'room:state',
  hostRoomCreated: 'host:roomCreated',
  playerJoined: 'player:joined',
  minigameSelected: 'minigame:selected',
  error: 'error',
  controllerLayout: 'controller:layout',
  privateData: 'private:data',
  vibrate: 'controller:vibrate',

  // ---- Server → Host (relay input) ----
  inputRelay: 'input:relay',
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

export interface PlayerDisconnectedEvent {
  playerId: PlayerId;
}

export interface VibratePlayerPayload {
  playerId: PlayerId;
  ms?: number;
}

/** Payload inviato al solo HOST quando parte un minigioco. */
export interface MinigameSelectedPayload {
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
