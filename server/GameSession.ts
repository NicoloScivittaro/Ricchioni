import { Emitter } from '../shared/events';
import { Rng } from '../shared/rng';
import { ScoreManager } from '../shared/scoring';
import { RouletteEngine } from '../shared/roulette';
import type { RouletteHistoryEntry } from '../shared/roulette';
import { AbilitySystem } from '../shared/abilities';
import { getMinigame, safetyCapSec } from '../shared/minigames';
import { getModifier } from '../shared/modifiers';
import { FLOW_TIMING } from '../shared/types';
import type {
  ActiveModifier,
  CurrentMinigame,
  GamePhase,
  MinigameDefinition,
  PlayerId,
  PlayerPublic,
  PlayerResult,
  RoomCode,
  RoomState,
  RoundResults
} from '../shared/types';
import type { MinigameSelectedPayload } from '../shared/protocol';
import { PlayerSession } from './PlayerSession';
import { log } from './log';

/**
 * Stanza di gioco autoritativa, implementata come macchina a stati:
 *
 *   LOBBY → MINIGAME_ROULETTE → MINIGAME_INTRO → MINIGAME_PLAYING
 *   → MINIGAME_FINISHED → ROUND_RESULTS → GLOBAL_LEADERBOARD → CHECK_WINNER
 *   → NEXT_ROUND → MINIGAME_ROULETTE ...  oppure  GAME_FINISHED
 *
 * L'avanzamento è automatico (un solo timer per fase). Il calcolo dei punti
 * avviene UNA volta in finishMinigame(); il controllo vittoria avviene dopo,
 * in CHECK_WINNER, su tutti i punteggi già aggiornati.
 */
export class GameSession {
  readonly roomCode: RoomCode;
  readonly targetScore: number;
  readonly playerCount: number;
  hostToken: string;
  hostConnectionId: string | null = null;

  /** Eventi interni: 'pick' (nuovo minigioco scelto) e 'changed' (fase cambiata). */
  readonly events = new Emitter();

  phase: GamePhase = 'LOBBY';
  round = 1;
  players: PlayerSession[] = [];
  charactersLocked: string[] = [];
  currentMinigame: CurrentMinigame | null = null;
  lastResults: RoundResults | null = null;
  winner: PlayerId | null = null;
  suddenDeath = false;
  /** null = rullo casuale; altrimenti il minigioco scelto manualmente dall'host. */
  manualMinigameId: string | null = null;
  /** Ultimo payload "minigame:selected" (per la ripresa dell'host dopo una riconnessione). */
  lastSelectedPayload: MinigameSelectedPayload | null = null;

  /** Id incrementale del minigioco in corso (incrementa a ogni estrazione del rullo). */
  minigameSeq = 0;
  /** Host in pausa durante MINIGAME_PLAYING. */
  paused = false;

  private suddenDeathCandidates: PlayerId[] = [];
  private rng = new Rng();
  private history: RouletteHistoryEntry[] = [];
  /** Ultimo minigioco concluso con risultati: lo mostra il rullo (lastResults viene azzerato a NEXT_ROUND). */
  private lastRound: RoomState['lastRound'] = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(roomCode: RoomCode, playerCount: number, targetScore: number, hostToken: string) {
    this.roomCode = roomCode;
    this.playerCount = playerCount;
    this.targetScore = targetScore;
    this.hostToken = hostToken;
  }

  // ---- Giocatori ----

  addPlayer(p: PlayerSession): void {
    this.players.push(p);
  }

  playersPublic(): PlayerPublic[] {
    return this.players.map((p) => p.toPublic());
  }

  getPlayer(id: PlayerId): PlayerSession | undefined {
    return this.players.find((p) => p.id === id);
  }

  isFull(): boolean {
    return this.players.length >= this.playerCount;
  }

  /** Minimo di giocatori per iniziare una partita vera. */
  static readonly MIN_TO_START = 2;

  allReady(): boolean {
    return (
      this.players.length >= GameSession.MIN_TO_START && this.players.every((p) => p.ready && p.characterId)
    );
  }

  selectCharacter(playerId: PlayerId, characterId: string): void {
    const p = this.getPlayer(playerId);
    if (!p || this.phase !== 'LOBBY') return;
    if (this.charactersLocked.includes(characterId) && p.characterId !== characterId) return;
    if (p.characterId && p.characterId !== characterId) {
      this.charactersLocked = this.charactersLocked.filter((c) => c !== p.characterId);
    }
    p.characterId = characterId;
    if (!this.charactersLocked.includes(characterId)) this.charactersLocked.push(characterId);
  }

  setReady(playerId: PlayerId, ready: boolean): void {
    const p = this.getPlayer(playerId);
    if (p) p.ready = ready;
  }

  toRoomState(): RoomState {
    return {
      roomCode: this.roomCode,
      phase: this.phase,
      round: this.round,
      targetScore: this.targetScore,
      playerCount: this.playerCount,
      players: this.playersPublic(),
      charactersLocked: [...this.charactersLocked],
      currentMinigame: this.currentMinigame,
      lastResults: this.lastResults,
      winner: this.winner,
      suddenDeath: this.suddenDeath,
      selectedMinigameId: this.manualMinigameId,
      paused: this.paused,
      roundId: this.minigameSeq,
      lastPlayedMinigameId: this.history.length > 0 ? this.history[this.history.length - 1].minigameId : null,
      lastRound: this.lastRound
    };
  }

  // ---- Controllo partita ----

  startGame(): void {
    // Guard anti doppio START (tasto tenuto premuto / doppio click): solo dalla LOBBY.
    if (this.phase !== 'LOBBY' || !this.allReady()) return;
    this.round = 1;
    this.pickAndEnterRoulette();
  }

  /**
   * Risultati di un minigioco sanificati: solo giocatori veri, nessun duplicato,
   * placement finiti; chi manca (disconnesso/non piazzato) va in coda. Restituisce
   * SEMPRE una classifica completa 1..N, mai placement undefined.
   */
  private normalizeResults(results: PlayerResult[]): PlayerResult[] {
    const known = new Set(this.players.map((p) => p.id));
    const seen = new Set<PlayerId>();
    const valid: PlayerResult[] = [];
    (Array.isArray(results) ? results : []).forEach((r, i) => {
      if (!r || !known.has(r.playerId) || seen.has(r.playerId)) return;
      seen.add(r.playerId);
      const placement = Number.isFinite(r.placement) ? r.placement : 1e6 + i;
      const score = Number.isFinite(r.score) ? r.score : 0;
      // statistiche brevi (solo testo, max 3 righe da 40 caratteri): il resto viene scartato
      const stats = Array.isArray(r.stats)
        ? r.stats.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 3).map((x) => x.slice(0, 40))
        : undefined;
      valid.push(stats && stats.length > 0 ? { playerId: r.playerId, placement, score, stats } : { playerId: r.playerId, placement, score });
    });
    valid.sort((a, b) => a.placement - b.placement);
    for (const p of this.players) {
      if (!seen.has(p.id)) valid.push({ playerId: p.id, placement: 1e7, score: 0 });
    }
    return valid.map((r, i) => ({ ...r, placement: i + 1 }));
  }

  /** Il minigioco (via host) restituisce i risultati; qui si assegnano i punti. */
  finishMinigame(results: PlayerResult[], roundId?: number): void {
    if (this.phase !== 'MINIGAME_PLAYING') return;
    // Evento tardivo di un round vecchio (ctx di un minigioco precedente): ignora.
    if (roundId !== undefined && roundId !== this.minigameSeq) {
      log('RESULT', this.roomCode, `ignorato: risultato del round ${roundId}, in corso il ${this.minigameSeq}`);
      return;
    }
    const ordered = this.normalizeResults(results);
    const ranking = ordered.map((r) => r.playerId);
    const double = this.currentMinigame?.modifierId === 'punti_doppi';
    const scoresMap = new Map(this.players.map((p) => [p.id, p.score]));
    const deltas = ScoreManager.awardRound(scoresMap, ranking, this.targetScore, double);

    for (const pid of ranking) {
      const p = this.getPlayer(pid);
      if (p) p.score += deltas[pid] ?? 0;
    }

    log(
      'RESULT',
      this.roomCode,
      `${this.currentMinigame?.minigameId ?? '?'} · ${ranking
        .map((pid) => `${this.getPlayer(pid)?.displayName ?? pid.slice(0, 4)} +${deltas[pid] ?? 0}`)
        .join(', ')}${double ? ' (punti doppi)' : ''}`
    );
    this.lastResults = { results: ordered, ranking, deltas, double };
    this.lastRound = { minigameId: this.currentMinigame?.minigameId ?? '', winnerId: ranking[0] ?? null, deltas };
    if (this.currentMinigame) {
      this.history.push({
        round: this.round,
        minigameId: this.currentMinigame.minigameId,
        category: this.currentMinigame.category
      });
    }
    this.setPhase('MINIGAME_FINISHED');
  }

  /**
   * EMERGENZA (menu host): salta il minigioco in corso SENZA assegnare punti e
   * torna al rullo. Il gioco saltato conta come "appena giocato" per il rullo.
   */
  skipMinigame(): void {
    if (
      this.phase !== 'MINIGAME_PLAYING' &&
      this.phase !== 'MINIGAME_INTRO' &&
      this.phase !== 'MINIGAME_ROULETTE'
    ) {
      return;
    }
    if (this.currentMinigame) {
      log('MINIGAME', this.roomCode, `${this.currentMinigame.minigameId} saltato senza punti (fase ${this.phase})`);
      this.history.push({
        round: this.round,
        minigameId: this.currentMinigame.minigameId,
        category: this.currentMinigame.category
      });
    }
    this.manualMinigameId = null; // niente loop sul gioco forzato che sto saltando
    this.lastResults = null;
    this.pickAndEnterRoulette();
  }

  /** Pausa/ripresa (ESC host): la rete di sicurezza non deve scattare mentre si è in pausa. */
  setPaused(paused: boolean): void {
    if (this.phase !== 'MINIGAME_PLAYING') return;
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) this.clearTimer();
    else this.armPlayingSafetyNet();
    this.events.emit('changed');
  }

  /** L'host sceglie manualmente il prossimo minigioco (null = torna al rullo). */
  selectMinigame(minigameId: string | null): void {
    if (this.phase !== 'LOBBY') return;
    if (minigameId && !getMinigame(minigameId)) return;
    this.manualMinigameId = minigameId;
  }

  /** L'host salta le animazioni (non il calcolo punti né il controllo vittoria). */
  skip(): void {
    if (
      this.phase === 'MINIGAME_PLAYING' ||
      this.phase === 'LOBBY' ||
      this.phase === 'GAME_FINISHED' ||
      this.phase === 'CHECK_WINNER'
    ) {
      return;
    }
    this.clearTimer();
    this.advanceFrom(this.phase);
  }

  resetToLobby(): void {
    log('ROOM', this.roomCode, 'reset alla lobby');
    this.clearTimer();
    this.players = [];
    this.charactersLocked = [];
    this.currentMinigame = null;
    this.lastResults = null;
    this.winner = null;
    this.suddenDeath = false;
    this.suddenDeathCandidates = [];
    this.history = [];
    this.lastRound = null;
    this.round = 1;
    this.manualMinigameId = null;
    this.setPhase('LOBBY');
  }

  /** Riavvia la partita mantenendo gli stessi giocatori (azzera punteggi e stato). */
  restartMatch(): void {
    log('ROOM', this.roomCode, 'nuova partita: punteggi azzerati, stessi giocatori');
    this.clearTimer();
    for (const p of this.players) {
      p.score = 0;
      p.ready = false;
    }
    this.currentMinigame = null;
    this.lastResults = null;
    this.winner = null;
    this.suddenDeath = false;
    this.suddenDeathCandidates = [];
    this.history = [];
    this.lastRound = null;
    this.lastSelectedPayload = null;
    this.round = 1;
    this.manualMinigameId = null;
    this.setPhase('LOBBY');
  }

  // ---- FSM ----

  private pickAndEnterRoulette(): void {
    let minigameId: string;
    let modifierId: string | null;

    // Conta reale dei giocatori in stanza (non quella dichiarata alla creazione).
    const count = Math.max(1, this.players.length);

    if (this.manualMinigameId) {
      const forced = getMinigame(this.manualMinigameId);
      // Il gioco forzato vale UNA sola volta (poi si torna al rullo) e solo se valido.
      this.manualMinigameId = null;
      if (forced && forced.enabled !== false && count >= forced.minPlayers && count <= forced.maxPlayers) {
        minigameId = forced.id;
        modifierId = this.pickModifier(forced);
      } else {
        const pick = RouletteEngine.pick(count, this.history, this.rng);
        minigameId = pick.minigameId;
        modifierId = pick.modifierId;
      }
    } else {
      const pick = RouletteEngine.pick(count, this.history, this.rng);
      minigameId = pick.minigameId;
      modifierId = pick.modifierId;
    }

    const def = getMinigame(minigameId);
    if (!def) throw new Error(`Minigioco non trovato: ${minigameId}`);

    const modifier = modifierId ? (getModifier(modifierId) ?? null) : null;
    let duration = def.durationSec;
    if (modifier?.id === 'tempo_dimezzato') duration = Math.max(5, Math.round(duration / 2));

    const activeModifiers = AbilitySystem.resolve(
      this.players.map((p) => ({ id: p.id, characterId: p.characterId })),
      def.category,
      this.history.some((h) => h.minigameId === def.id),
      this.rng
    );

    this.currentMinigame = {
      minigameId: def.id,
      name: def.name,
      category: def.category,
      modifierId,
      durationSec: duration,
      controllerLayout: def.controllerLayout
    };

    const modMap: Record<PlayerId, ActiveModifier[]> = {};
    activeModifiers.forEach((v, k) => {
      modMap[k] = v;
    });

    this.minigameSeq += 1;
    const payload: MinigameSelectedPayload = {
      roundId: this.minigameSeq,
      minigameId: def.id,
      name: def.name,
      category: def.category,
      modifierId: modifierId ?? null,
      modifierName: modifier?.name ?? null,
      modifierDescription: modifier?.description ?? null,
      durationSec: duration,
      controllerLayout: def.controllerLayout,
      players: this.playersPublic(),
      activeModifiers: modMap
    };

    this.lastSelectedPayload = payload;
    log(
      'ROUND',
      this.roomCode,
      `#${this.round} (id ${payload.roundId}) → ${def.id}${modifier ? ` [${modifier.id}]` : ''} · ${count} giocatori`
    );
    this.events.emit('pick', payload);
    this.setPhase('MINIGAME_ROULETTE');
  }

  private pickModifier(def: MinigameDefinition): string | null {
    if (def.compatibleModifiers.length === 0 || !this.rng.chance(0.25)) return null;
    const mods = def.compatibleModifiers
      .map((id) => getModifier(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    if (mods.length === 0) return null;
    return this.rng.weighted(mods.map((m) => ({ item: m.id, weight: m.weight })));
  }

  private setPhase(next: GamePhase): void {
    this.phase = next;
    this.paused = false; // ogni cambio fase esce dalla pausa
    if (next === 'MINIGAME_PLAYING') log('MINIGAME', this.roomCode, `${this.currentMinigame?.minigameId ?? '?'} via (id ${this.minigameSeq})`);
    else if (next === 'GAME_FINISHED') {
      log('ROOM', this.roomCode, `partita finita al round ${this.round}: vince ${this.getPlayer(this.winner ?? '')?.displayName ?? '?'}`);
    }
    this.events.emit('changed');
    if (next === 'MINIGAME_PLAYING' || next === 'MINIGAME_FINISHED' || next === 'GAME_FINISHED') {
      this.events.emit('vibrate');
    }
    this.schedule(next);
  }

  /** Re-invia il minigioco selezionato all'host (dopo una riconnessione a metà partita). */
  resendSelected(): void {
    if (this.lastSelectedPayload && this.isMinigamePhase()) {
      this.events.emit('pick', this.lastSelectedPayload);
    }
  }

  private isMinigamePhase(): boolean {
    return (
      this.phase === 'MINIGAME_ROULETTE' ||
      this.phase === 'MINIGAME_INTRO' ||
      this.phase === 'MINIGAME_PLAYING'
    );
  }

  private schedule(phase: GamePhase): void {
    this.clearTimer();
    if (phase === 'LOBBY' || phase === 'GAME_FINISHED') return;
    if (phase === 'CHECK_WINNER') {
      this.checkWinner();
      return;
    }
    if (phase === 'MINIGAME_PLAYING') {
      this.armPlayingSafetyNet();
      return;
    }
    this.timer = setTimeout(() => this.advanceFrom(phase), this.phaseDuration(phase));
  }

  /** Safety net: se il minigioco non restituisce un risultato, non lasciare la serata bloccata. */
  private armPlayingSafetyNet(): void {
    this.clearTimer();
    // durationSec è la durata di GIOCO di alcuni minigiochi (arena, fps, kart…), non la loro durata
    // reale massima: la rete di sicurezza usa hardCapSec, così non tronca partite ancora valide.
    const def = this.currentMinigame ? getMinigame(this.currentMinigame.minigameId) : undefined;
    const base = this.currentMinigame?.durationSec ?? 30;
    const capSec = def ? safetyCapSec(def, base) : base + 20;
    this.timer = setTimeout(() => this.fallbackFinish(), capSec * 1000);
  }

  private advanceFrom(phase: GamePhase): void {
    switch (phase) {
      case 'MINIGAME_ROULETTE':
        this.setPhase('MINIGAME_INTRO');
        break;
      case 'MINIGAME_INTRO':
        this.setPhase('MINIGAME_PLAYING');
        break;
      case 'MINIGAME_FINISHED':
        this.setPhase('ROUND_RESULTS');
        break;
      case 'ROUND_RESULTS':
        this.setPhase('GLOBAL_LEADERBOARD');
        break;
      case 'GLOBAL_LEADERBOARD':
        this.setPhase('CHECK_WINNER');
        break;
      case 'NEXT_ROUND':
        this.round += 1;
        this.lastResults = null;
        this.pickAndEnterRoulette();
        break;
      default:
        break;
    }
  }

  private checkWinner(): void {
    const reached = this.players.filter((p) => p.score >= this.targetScore);
    if (this.suddenDeath) {
      const cands = this.suddenDeathCandidates;
      const max = Math.max(...cands.map((id) => this.getPlayer(id)?.score ?? -1));
      const tied = cands.filter((id) => (this.getPlayer(id)?.score ?? -1) === max);
      if (tied.length === 1) {
        this.winner = tied[0];
        this.suddenDeath = false;
        this.setPhase('GAME_FINISHED');
      } else {
        this.suddenDeathCandidates = tied;
        this.setPhase('NEXT_ROUND');
      }
    } else if (reached.length === 0) {
      this.setPhase('NEXT_ROUND');
    } else {
      const max = Math.max(...reached.map((p) => p.score));
      const tied = reached.filter((p) => p.score === max);
      if (tied.length === 1) {
        this.winner = tied[0].id;
        this.setPhase('GAME_FINISHED');
      } else {
        // Pari al vertice: vince il miglior piazzamento nell'ultimo minigioco
        // (i placement sono unici e completi, quindi il pari si risolve sempre).
        const order = this.lastResults?.ranking ?? [];
        const best = [...tied].sort((a, b) => {
          const ia = order.indexOf(a.id);
          const ib = order.indexOf(b.id);
          return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
        })[0];
        this.winner = best.id;
        this.setPhase('GAME_FINISHED');
      }
    }
  }

  /**
   * Minigioco che non ha mai risposto: NON si assegnano punti inventati (prima
   * premiava chi era già in testa). Si salta e si torna al rullo.
   */
  private fallbackFinish(): void {
    if (this.phase !== 'MINIGAME_PLAYING') return;
    log('ERROR', this.roomCode, `rete di sicurezza: ${this.currentMinigame?.minigameId ?? '?'} non ha risposto in tempo`);
    this.skipMinigame();
  }

  private phaseDuration(phase: GamePhase): number {
    switch (phase) {
      case 'MINIGAME_ROULETTE':
        return FLOW_TIMING.rouletteMs;
      case 'MINIGAME_INTRO':
        return FLOW_TIMING.introMs;
      case 'MINIGAME_FINISHED':
        return FLOW_TIMING.finishedMs;
      case 'ROUND_RESULTS':
        return (
          FLOW_TIMING.revealStepMs * Math.max(0, this.players.length - 1) +
          FLOW_TIMING.revealWinnerDelayMs +
          FLOW_TIMING.revealFinalHoldMs +
          300
        );
      case 'GLOBAL_LEADERBOARD':
        return FLOW_TIMING.leaderboardMs;
      case 'NEXT_ROUND':
        return FLOW_TIMING.nextRoundMs;
      default:
        return 0;
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
