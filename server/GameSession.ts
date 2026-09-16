import { Emitter } from '../shared/events';
import { Rng } from '../shared/rng';
import { ScoreManager } from '../shared/scoring';
import { RouletteEngine } from '../shared/roulette';
import type { RouletteHistoryEntry } from '../shared/roulette';
import { AbilitySystem } from '../shared/abilities';
import { getMinigame } from '../shared/minigames';
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

  private suddenDeathCandidates: PlayerId[] = [];
  private rng = new Rng();
  private history: RouletteHistoryEntry[] = [];
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

  allReady(): boolean {
    return this.players.length >= 2 && this.players.every((p) => p.ready && p.characterId);
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
      selectedMinigameId: this.manualMinigameId
    };
  }

  // ---- Controllo partita ----

  startGame(): void {
    this.round = 1;
    this.pickAndEnterRoulette();
  }

  /** Il minigioco (via host) restituisce i risultati; qui si assegnano i punti. */
  finishMinigame(results: PlayerResult[]): void {
    if (this.phase !== 'MINIGAME_PLAYING') return;
    const ordered = [...results].sort((a, b) => a.placement - b.placement);
    const ranking = ordered.map((r) => r.playerId);
    const double = this.currentMinigame?.modifierId === 'punti_doppi';
    const scoresMap = new Map(this.players.map((p) => [p.id, p.score]));
    const deltas = ScoreManager.awardRound(scoresMap, ranking, this.targetScore, double);

    for (const pid of ranking) {
      const p = this.getPlayer(pid);
      if (p) p.score += deltas[pid] ?? 0;
    }

    this.lastResults = { results: ordered, ranking, deltas, double };
    if (this.currentMinigame) {
      this.history.push({
        round: this.round,
        minigameId: this.currentMinigame.minigameId,
        category: this.currentMinigame.category
      });
    }
    this.setPhase('MINIGAME_FINISHED');
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
    this.clearTimer();
    this.players = [];
    this.charactersLocked = [];
    this.currentMinigame = null;
    this.lastResults = null;
    this.winner = null;
    this.suddenDeath = false;
    this.suddenDeathCandidates = [];
    this.history = [];
    this.round = 1;
    this.setPhase('LOBBY');
  }

  // ---- FSM ----

  private pickAndEnterRoulette(): void {
    let minigameId: string;
    let modifierId: string | null;

    if (this.manualMinigameId) {
      const forced = getMinigame(this.manualMinigameId);
      if (forced && this.playerCount >= forced.minPlayers && this.playerCount <= forced.maxPlayers) {
        minigameId = forced.id;
        modifierId = this.pickModifier(forced);
      } else {
        const pick = RouletteEngine.pick(this.playerCount, this.history, this.rng);
        minigameId = pick.minigameId;
        modifierId = pick.modifierId;
      }
    } else {
      const pick = RouletteEngine.pick(this.playerCount, this.history, this.rng);
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

    const payload: MinigameSelectedPayload = {
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
    this.events.emit('changed');
    this.schedule(next);
  }

  private schedule(phase: GamePhase): void {
    this.clearTimer();
    if (phase === 'LOBBY' || phase === 'GAME_FINISHED') return;
    if (phase === 'CHECK_WINNER') {
      this.checkWinner();
      return;
    }
    if (phase === 'MINIGAME_PLAYING') {
      // Safety net: se il minigioco non restituisce un risultato, chiudi comunque.
      const dur = (this.currentMinigame?.durationSec ?? 30) * 1000 + 15000;
      this.timer = setTimeout(() => this.fallbackFinish(), dur);
      return;
    }
    this.timer = setTimeout(() => this.advanceFrom(phase), this.phaseDuration(phase));
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
        this.suddenDeath = true;
        this.suddenDeathCandidates = tied.map((p) => p.id);
        this.setPhase('NEXT_ROUND');
      }
    }
  }

  private fallbackFinish(): void {
    if (this.phase !== 'MINIGAME_PLAYING') return;
    const ranking = [...this.players].sort((a, b) => b.score - a.score).map((p) => p.id);
    this.finishMinigame(ranking.map((pid, i) => ({ playerId: pid, placement: i + 1, score: 0 })));
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
