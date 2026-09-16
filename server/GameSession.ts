import { Rng } from '../shared/rng';
import { ScoreManager } from '../shared/scoring';
import { RouletteEngine } from '../shared/roulette';
import type { RouletteHistoryEntry } from '../shared/roulette';
import { AbilitySystem } from '../shared/abilities';
import { getMinigame } from '../shared/minigames';
import { getModifier } from '../shared/modifiers';
import type {
  ActiveModifier,
  CurrentMinigame,
  GamePhase,
  MinigameResult,
  PlayerId,
  PlayerPublic,
  RoomCode,
  RoomState,
  RoundResults
} from '../shared/types';
import type { MinigameSelectedPayload } from '../shared/protocol';
import { PlayerSession } from './PlayerSession';

/**
 * Stanza di gioco autoritativa. Detiene lo stato della partita e decide:
 * rullo, punteggio, vincitore (con tie/sudden death), fasi.
 */
export class GameSession {
  readonly roomCode: RoomCode;
  readonly targetScore: number;
  readonly playerCount: number;
  hostToken: string;
  hostConnectionId: string | null = null;

  phase: GamePhase = 'LOBBY';
  round = 1;
  players: PlayerSession[] = [];
  charactersLocked: string[] = [];
  currentMinigame: CurrentMinigame | null = null;
  lastResults: RoundResults | null = null;
  winner: PlayerId | null = null;
  suddenDeath = false;

  private suddenDeathCandidates: PlayerId[] = [];
  private rng = new Rng();
  private history: RouletteHistoryEntry[] = [];

  constructor(roomCode: RoomCode, playerCount: number, targetScore: number, hostToken: string) {
    this.roomCode = roomCode;
    this.playerCount = playerCount;
    this.targetScore = targetScore;
    this.hostToken = hostToken;
  }

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
    if (!p) return;
    if (this.phase !== 'LOBBY') return;
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
      suddenDeath: this.suddenDeath
    };
  }

  /** Avvia la partita selezionando il primo minigioco. */
  startGame(): MinigameSelectedPayload {
    return this.pickNext();
  }

  /** Registra il risultato del minigioco (dall'host, fidato) e aggiorna i punteggi. */
  finishMinigame(ranking: PlayerId[], stats?: MinigameResult['stats']): void {
    const double = this.currentMinigame?.modifierId === 'punti_doppi';
    const scoresMap = new Map(this.players.map((p) => [p.id, p.score]));
    const deltas = ScoreManager.awardRound(scoresMap, ranking, this.targetScore, double);

    for (const pid of ranking) {
      const p = this.getPlayer(pid);
      if (p) p.score += deltas[pid] ?? 0;
    }

    this.lastResults = { ranking, deltas, double };
    if (this.currentMinigame) {
      this.history.push({
        round: this.round,
        minigameId: this.currentMinigame.minigameId,
        category: this.currentMinigame.category
      });
    }

    // Determina il vincitore (gestione tie → sudden death)
    const reached = this.players.filter((p) => p.score >= this.targetScore);
    if (this.suddenDeath) {
      const cands = this.suddenDeathCandidates;
      const max = Math.max(...cands.map((id) => this.getPlayer(id)?.score ?? -1));
      const tied = cands.filter((id) => (this.getPlayer(id)?.score ?? -1) === max);
      if (tied.length === 1) {
        this.winner = tied[0];
        this.phase = 'GAME_OVER';
        this.suddenDeath = false;
      } else {
        this.suddenDeathCandidates = tied;
        this.phase = 'RESULTS';
      }
    } else if (reached.length === 0) {
      this.phase = 'RESULTS';
    } else {
      const max = Math.max(...reached.map((p) => p.score));
      const tied = reached.filter((p) => p.score === max);
      if (tied.length === 1) {
        this.winner = tied[0].id;
        this.phase = 'GAME_OVER';
      } else {
        this.suddenDeath = true;
        this.suddenDeathCandidates = tied.map((p) => p.id);
        this.phase = 'RESULTS';
      }
    }
  }

  /** Passa al round successivo e seleziona il prossimo minigioco. */
  continueRound(): MinigameSelectedPayload {
    this.round += 1;
    this.lastResults = null;
    return this.pickNext();
  }

  resetToLobby(): void {
    this.phase = 'LOBBY';
    this.round = 1;
    this.players = [];
    this.charactersLocked = [];
    this.currentMinigame = null;
    this.lastResults = null;
    this.winner = null;
    this.suddenDeath = false;
    this.suddenDeathCandidates = [];
    this.history = [];
  }

  private isRepeated(minigameId: string): boolean {
    return this.history.some((h) => h.minigameId === minigameId);
  }

  private pickNext(): MinigameSelectedPayload {
    const pick = RouletteEngine.pick(this.playerCount, this.history, this.rng);
    const def = getMinigame(pick.minigameId);
    if (!def) throw new Error(`Minigioco non trovato: ${pick.minigameId}`);

    const modifier = pick.modifierId ? (getModifier(pick.modifierId) ?? null) : null;
    let duration = def.durationSec;
    if (modifier?.id === 'tempo_dimezzato') duration = Math.max(5, Math.round(duration / 2));

    const activeModifiers = AbilitySystem.resolve(
      this.players.map((p) => ({ id: p.id, characterId: p.characterId })),
      def.category,
      this.isRepeated(def.id),
      this.rng
    );

    this.currentMinigame = {
      minigameId: def.id,
      name: def.name,
      category: def.category,
      modifierId: pick.modifierId,
      durationSec: duration,
      controllerLayout: def.controllerLayout
    };
    this.phase = 'MINIGAME';

    const modMap: Record<PlayerId, ActiveModifier[]> = {};
    activeModifiers.forEach((v, k) => {
      modMap[k] = v;
    });

    return {
      minigameId: def.id,
      name: def.name,
      category: def.category,
      modifierId: pick.modifierId ?? null,
      modifierName: modifier?.name ?? null,
      modifierDescription: modifier?.description ?? null,
      durationSec: duration,
      controllerLayout: def.controllerLayout,
      players: this.playersPublic(),
      activeModifiers: modMap
    };
  }
}
