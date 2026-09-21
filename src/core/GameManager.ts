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
  PlayerDisconnectedEvent,
  RoomCreatedAck,
  TextRelayEvent
} from '../../shared/protocol';
import type {
  ActiveModifier,
  GamePhase,
  MinigameResult,
  ModifierDefinition,
  PlayerId,
  PlayerPublic,
  PlayerResult,
  PlayerSnapshot,
  RoomState
} from '../../shared/types';
import { SocketClient } from '../network/SocketClient';
import { InputManager } from '../network/InputManager';
import type { MinigameContext } from '../minigames/types';
import { preloadMinigame } from '../minigames/preload';
import { showMinigameError, hideMinigameError } from './HostOverlay';

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

  /** Registro dei round della PARTITA in corso (per le statistiche divertenti del finale). Si azzera in lobby. */
  roundLog: { roundId: number; minigameId: string; name: string; results: PlayerResult[]; deltas: Record<string, number> }[] = [];

  private socket: SocketClient | null = null;
  private game: Phaser.Game | null = null;
  private lastPhase: GamePhase = 'LOBBY';
  private loadWatchdog: ReturnType<typeof setTimeout> | null = null;

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
      // Dopo un calo di rete Socket.IO ricrea il socket con un id NUOVO: l'host va
      // ri-registrato ogni volta, altrimenti il server lo ignora per sempre.
      const tok = this.hostToken ?? this.loadHostToken();
      if (tok) this.attemptHostReconnect(tok);
    });

    s.on(EVT.roomState, (payload) => this.onRoomState(payload as RoomState));
    s.on(EVT.minigameSelected, (payload) => this.onMinigameSelected(payload as MinigameSelectedPayload));
    s.on(EVT.inputRelay, (payload) => this.onInputRelay(payload as InputRelayEvent));
    s.on(EVT.textRelay, (payload) => this.onTextRelay(payload as TextRelayEvent));
    s.on(EVT.playerDisconnected, (payload) => {
      this.input.releasePlayer((payload as PlayerDisconnectedEvent).playerId);
    });

    // Riconnessione automatica dell'host con token salvato (ricarica pagina)
    if (this.loadHostToken()) this.reconnecting = true;
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

  /** Fa vibrare il telefono di un singolo giocatore (se il device lo supporta). */
  vibrate(playerId: string, ms = 120): void {
    this.socket?.emit(EVT.hostVibratePlayer, { playerId, ms });
  }

  /** Agganciato dal GamepadManager: vibra il controller del giocatore e ritorna true se lo sta usando (src/input). */
  padRumble: ((playerId: string, ms: number) => boolean) | null = null;
  /** Agganciato dal GamepadManager: true se il giocatore GIOCA col controller (sorgente primaria del gameplay: il telefono non la sovrascrive). */
  padHandles: ((playerId: string) => boolean) | null = null;
  /** Agganciato da src/input: mostra la schermata CONTROLLI (o "PRENDETE I TELEFONI") e risolve alla fine. Senza aggancio: subito. */
  controlsGate: ((minigameId: string) => Promise<void>) | null = null;

  /** Comunica al server quali giocatori hanno un controller fisico collegato (playerId -> nome breve). */
  sendGamepads(pads: Record<string, string>): void {
    this.socket?.emit(EVT.hostGamepads, { pads });
  }

  /** Invia un segnale di gioco a uno (o tutti) i telefoni della stanza. */
  signal(playerId: string | null, signal: Record<string, unknown>): void {
    this.socket?.emit(EVT.hostSignal, { playerId, signal });
  }

  /** Riavvia la partita mantenendo gli stessi giocatori (azzera i punteggi). */
  restartMatch(): void {
    this.socket?.emit(EVT.hostRestartMatch);
  }

  backToLobby(): void {
    this.socket?.emit(EVT.hostBackToLobby);
    this.state = null;
    this.pendingMinigame = null;
    this.minigameContext = null;
    this.lastPhase = 'LOBBY';
    // Abbandona la stanza corrente: il prossimo avvio parte pulito (niente auto-riconnessione).
    this.roomCode = '';
    this.hostToken = null;
    this.clearHostToken();
  }

  finishMinigame(result: MinigameResult, roundId?: number): void {
    this.socket?.emit(EVT.hostMinigameFinished, { results: result.results, roundId });
  }

  /** Pausa/ripresa (ESC): il server ferma la rete di sicurezza e i telefoni mostrano PAUSA. */
  setPaused(paused: boolean): void {
    this.socket?.emit(EVT.hostPause, { paused });
  }

  /** Emergenza: salta il minigioco in corso SENZA punti e torna al rullo. */
  skipMinigame(): void {
    hideMinigameError();
    this.clearLoadWatchdog();
    this.socket?.emit(EVT.hostSkipMinigame);
  }

  /** Errore di caricamento/avvio di un minigioco: mai schermo nero, sempre una via d'uscita. */
  reportMinigameError(err: unknown): void {
    console.error('[minigioco]', err);
    this.clearLoadWatchdog();
    const msg = err instanceof Error ? err.message : String(err);
    showMinigameError(
      msg,
      () => {
        hideMinigameError();
        this.launchMinigame();
      },
      () => this.skipMinigame()
    );
  }

  /** Le scene con caricamento asincrono (3D) segnalano inizio/fine: oltre 25s → recovery. */
  minigameLoadStarted(): void {
    this.clearLoadWatchdog();
    this.loadWatchdog = setTimeout(() => {
      this.loadWatchdog = null;
      this.reportMinigameError('Il caricamento sta impiegando troppo tempo');
    }, 25000);
  }

  minigameLoadFinished(): void {
    this.clearLoadWatchdog();
  }

  private clearLoadWatchdog(): void {
    if (this.loadWatchdog) {
      clearTimeout(this.loadWatchdog);
      this.loadWatchdog = null;
    }
  }

  /** Avvia la scena del minigioco (chiamato dalla RouletteScene a fine animazione). */
  launchMinigame(): void {
    if (!this.pendingMinigame || !this.game) return;
    const def = getMinigame(this.pendingMinigame.minigameId);
    if (!def) {
      this.reportMinigameError(`Minigioco sconosciuto: ${this.pendingMinigame.minigameId}`);
      return;
    }
    try {
      if (!this.game.scene.getScene(def.sceneKey)) throw new Error(`Scena non registrata: ${def.sceneKey}`);
      this.startScene(def.sceneKey, { ctx: this.minigameContext });
    } catch (e) {
      this.reportMinigameError(e);
    }
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

    const roundId = payload.roundId;
    let submitted = false;

    return {
      players: snapshots,
      playerIds: snapshots.map((p) => p.id),
      rng: new Rng(),
      durationSec: payload.durationSec,
      modifier,
      modifiers,
      input: this.input,
      // il minigioco la chiama quando e' PRONTO a mostrarsi (dopo il caricamento) e aspetta la fine prima del proprio countdown
      showControls: () => (this.controlsGate ? this.controlsGate(payload.minigameId) : Promise.resolve()),
      consume: (playerId, hook) => this.consume(modifiers, playerId, hook),
      sendPrivate: (playerId, data) => this.sendPrivate(playerId, data),
      // se il giocatore sta giocando col controller la vibrazione va al controller (il telefono e' sul tavolo)
      vibrate: (playerId, ms) => {
        if (this.padRumble?.(playerId, ms ?? 120)) return;
        this.vibrate(playerId, ms);
      },
      signal: (playerId, signal) => this.signal(playerId, signal),
      // Un contesto può consegnare i risultati UNA volta sola (protezione doppio result).
      finish: (result) => {
        if (submitted) return;
        submitted = true;
        this.finishMinigame(result, roundId);
      }
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
    if (state.phase === 'LOBBY') this.roundLog = [];
    else if (state.phase === 'ROUND_RESULTS' && state.lastResults && !this.roundLog.some((r) => r.roundId === (state.roundId ?? -1))) {
      this.roundLog.push({
        roundId: state.roundId ?? -1,
        minigameId: state.currentMinigame?.minigameId ?? '',
        name: state.currentMinigame?.name ?? '',
        results: state.lastResults.results,
        deltas: state.lastResults.deltas
      });
    }
    this.events.emit('state', state);

    if (this.reconnecting) {
      this.reconnecting = false;
      if (state.phase === 'LOBBY') {
        this.startScene('RoomScene');
        return;
      }
    }

    if (state.phase !== 'MINIGAME_PLAYING') {
      hideMinigameError();
      this.clearLoadWatchdog();
    }

    if (state.phase === prev) {
      // Stesso phase: se una transizione è andata persa (o è rimasta una scena vecchia) lo snapshot
      // successivo deve comunque riportare l'host sulla schermata giusta.
      this.resyncScene(state.phase);
      return;
    }

    // Transizione verso LOBBY: restart (giocatori mantenuti) o back-to-lobby (vuoto)
    if (state.phase === 'LOBBY') {
      this.startScene(state.players.length > 0 ? 'RoomScene' : 'LobbyScene');
      return;
    }

    // Uscendo dal minigioco: azzera gli input per non ereditare tasti premuti.
    if (prev === 'MINIGAME_PLAYING') {
      this.input.reset();
    }

    this.transitionTo(state.phase);
  }

  /**
   * Avvia UNA scena e ferma tutte le altre. `game.scene.start()` di Phaser NON ferma le scene già
   * attive: senza questo ogni scena mai avviata restava in esecuzione, la scena del minigioco
   * (registrata per ultima, quindi in cima al render) copriva Risultati/Classifica e il canvas 3D
   * restava sopra a tutto → "schermo vecchio" fino al refresh manuale.
   * Ogni stop è isolato in try/catch: un cleanup che lancia non deve mai impedire la transizione.
   */
  private startScene(key: string, data?: object): void {
    const game = this.game;
    if (!game) return;
    for (const scene of game.scene.getScenes(false)) {
      const k = scene.sys.settings.key;
      if (k === key) continue;
      const status = scene.sys.settings.status;
      if (status >= Phaser.Scenes.START && status <= Phaser.Scenes.SLEEPING) {
        try {
          game.scene.stop(k);
        } catch (e) {
          console.error(`[scene] stop di ${k} fallito`, e);
        }
      }
    }
    game.scene.start(key, data);
  }

  private expectedSceneKey(phase: GamePhase): string | null {
    switch (phase) {
      case 'MINIGAME_ROULETTE':
        return 'RouletteScene';
      case 'MINIGAME_INTRO':
        return 'IntroScene';
      case 'MINIGAME_FINISHED':
        return 'FinishedScene';
      case 'ROUND_RESULTS':
        return 'ResultsScene';
      case 'GLOBAL_LEADERBOARD':
        return 'LeaderboardScene';
      case 'NEXT_ROUND':
        return 'NextRoundScene';
      case 'GAME_FINISHED':
        return 'GameOverScene';
      case 'MINIGAME_PLAYING':
        return this.pendingMinigame ? (getMinigame(this.pendingMinigame.minigameId)?.sceneKey ?? null) : null;
      default:
        return null; // LOBBY / CHECK_WINNER: nessuna scena dedicata
    }
  }

  private resyncScene(phase: GamePhase): void {
    const game = this.game;
    const key = this.expectedSceneKey(phase);
    if (!game || !key) return;
    const active = game.scene.getScenes(true).map((s) => s.scene.key);
    if (phase === 'MINIGAME_PLAYING') {
      // Il minigioco in corso non si riavvia da solo (gli errori passano dall'overlay RIPROVA/SALTA):
      // si eliminano solo le scene estranee rimaste attive.
      for (const k of active) if (k !== key) game.scene.stop(k);
      return;
    }
    if (!active.includes(key) || active.length > 1) this.transitionTo(phase);
  }

  private transitionTo(phase: GamePhase): void {
    if (!this.game) return;
    switch (phase) {
      case 'MINIGAME_ROULETTE':
        this.startScene('RouletteScene');
        break;
      case 'MINIGAME_INTRO':
        this.startScene('IntroScene');
        break;
      case 'MINIGAME_PLAYING':
        this.launchMinigame();
        break;
      case 'MINIGAME_FINISHED':
        this.startScene('FinishedScene');
        break;
      case 'ROUND_RESULTS':
        this.startScene('ResultsScene');
        break;
      case 'GLOBAL_LEADERBOARD':
        this.startScene('LeaderboardScene');
        break;
      case 'NEXT_ROUND':
        this.startScene('NextRoundScene');
        break;
      case 'GAME_FINISHED':
        this.startScene('GameOverScene');
        break;
      default:
        break;
    }
  }

  private onMinigameSelected(payload: MinigameSelectedPayload): void {
    // Re-invio dopo una riconnessione host a metà round: stesso roundId → tieni il contesto
    // già in uso (ricrearlo azzererebbe gli input e riaprirebbe la consegna dei risultati).
    if (payload.roundId !== undefined && this.pendingMinigame?.roundId === payload.roundId && this.minigameContext) {
      return;
    }
    this.pendingMinigame = payload;
    this.minigameContext = this.buildContext(payload);
    // Il codice del gioco 3D estratto si scarica ora, durante rullo e intro (~10s), non al via.
    preloadMinigame(payload.minigameId);
    this.events.emit('minigame', payload);
  }

  /** Solo debug: chiavi delle scene Phaser attualmente attive (deve essere UNA sola). */
  activeSceneKeys(): string[] {
    return this.game ? this.game.scene.getScenes(true).map((s) => s.scene.key) : [];
  }

  /** Solo debug: round-trip verso il server in ms (null se offline/timeout). */
  async ping(): Promise<number | null> {
    if (!this.socket?.socket.connected) return null;
    const t0 = performance.now();
    const res = await this.socket.emitAck<{ ok?: boolean } | undefined>(EVT.debugPing, undefined, 2000);
    return res && res.ok === false ? null : Math.round(performance.now() - t0);
  }

  private onInputRelay(relay: InputRelayEvent): void {
    // Un giocatore che gioca col CONTROLLER ha quello come unica sorgente del gameplay: un evento del telefono (es. un asse a 0
    // mandato da un joystick residuo) NON deve sovrascrivere gli assi del controller.
    if (this.padHandles?.(relay.playerId)) return;
    this.input.handle(relay.playerId, relay.input);
  }

  private onTextRelay(relay: TextRelayEvent): void {
    this.input.setText(relay.playerId, relay.controlId, relay.text);
  }
}

export const game = new GameManager();
