import Phaser from 'phaser';
import { GAME_CONFIG } from '../app/config';
import { Emitter } from './events';
import { Rng } from './Rng';
import { PlayerManager } from './PlayerManager';
import { ScoreManager } from './ScoreManager';
import { RouletteEngine } from './RouletteEngine';
import { AbilitySystem } from './AbilitySystem';
import { MinigameRegistry } from './MinigameRegistry';
import { ModifierRegistry } from './ModifierRegistry';
import { CHARACTER_ORDER } from '../characters';
import type {
  ActiveModifier,
  GameMode,
  GamePhase,
  MinigameDefinition,
  MinigameResult,
  ModifierDefinition,
  PlayerId,
  RouletteHistoryEntry,
  RoulettePick
} from './types';
import type { MinigameContext } from '../minigames/types';

export interface RoundOutcome {
  ranking: PlayerId[];
  deltas: Record<PlayerId, number>;
  stats?: Record<PlayerId, Record<string, number>>;
  double: boolean;
}

/**
 * Macchina a stati della partita:
 * LOBBY → SELECT → ROULETTE → MINIGAME → RESULTS → (ROULETTE | GAME_OVER)
 *
 * È la single source of truth della logica. Le scene Phaser renderizzano e
 * raccolgono input; il GameManager decide e guida le transizioni.
 */
export class GameManager {
  phase: GamePhase = 'LOBBY';
  mode: GameMode = 'NORMALE';
  target: number = GAME_CONFIG.defaultTarget;
  round = 0;
  playerCount = 2;

  readonly players = new PlayerManager();
  scores = new Map<PlayerId, number>();
  history: RouletteHistoryEntry[] = [];
  currentPick: RoulettePick | null = null;
  lastOutcome: RoundOutcome | null = null;

  readonly events = new Emitter();
  private rng: Rng = new Rng();
  private game: Phaser.Game | null = null;

  attach(game: Phaser.Game): void {
    this.game = game;
  }

  setLobby(playerCount: number, mode: GameMode): void {
    this.playerCount = playerCount;
    this.mode = mode;
    this.target = GAME_CONFIG.winTargets[mode];
    this.players.set(CHARACTER_ORDER.slice(0, playerCount));
    this.phase = 'SELECT';
  }

  startMatch(): void {
    this.scores = new Map(this.players.ids().map((id) => [id, 0]));
    this.players.syncScores(this.scores);
    this.round = 0;
    this.history = [];
    this.currentPick = null;
    this.lastOutcome = null;
    this.rng = new Rng();
    this.phase = 'ROULETTE';
  }

  /** Calcola la scelta del rullo: la roulette animata è solo la cosmesi di questo risultato. */
  spinRoulette(): RoulettePick {
    const pick = RouletteEngine.pick(this.playerCount, this.history, this.rng);
    this.currentPick = pick;
    return pick;
  }

  isRepeated(minigameId: string): boolean {
    return this.history.some((h) => h.minigameId === minigameId);
  }

  /** Avvia il minigioco selezionato (chiamato dalla RouletteScene a fine animazione). */
  beginMinigame(): void {
    if (!this.currentPick) throw new Error('Nessuna scelta del rullo attiva');
    const def = MinigameRegistry.byId(this.currentPick.minigameId);
    if (!def) throw new Error(`Minigioco non registrato: ${this.currentPick.minigameId}`);
    const modifier = this.currentPick.modifierId
      ? (ModifierRegistry.byId(this.currentPick.modifierId) ?? null)
      : null;
    const ctx = this.buildContext(def, modifier);
    this.phase = 'MINIGAME';
    this.events.emit('phase', this.phase);
    if (!this.game) throw new Error('GameManager.attach() non chiamato');
    this.game.scene.start(def.sceneKey, { ctx });
  }

  private buildContext(def: MinigameDefinition, modifier: ModifierDefinition | null): MinigameContext {
    const snapshots = this.players.snapshots();
    const modifiers = AbilitySystem.resolve(
      this.players.players,
      def.category,
      this.isRepeated(def.id),
      this.rng
    );
    let duration = def.durationSec;
    if (modifier?.id === 'tempo_dimezzato') duration = Math.max(5, Math.round(duration / 2));

    return {
      players: snapshots,
      playerIds: snapshots.map((p) => p.id),
      rng: this.rng,
      durationSec: duration,
      modifier,
      modifiers,
      consume: (pid, hook) => this.consume(modifiers, pid, hook),
      finish: (result) => this.submitResult(result)
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

  submitResult(result: MinigameResult): void {
    if (!this.currentPick) return;
    const double = this.currentPick.modifierId === 'punti_doppi';
    const deltas = ScoreManager.awardRound(this.scores, result.ranking, double);
    for (const pid of result.ranking) {
      this.scores.set(pid, (this.scores.get(pid) ?? 0) + (deltas[pid] ?? 0));
    }
    this.players.syncScores(this.scores);
    this.history.push({
      round: this.round,
      minigameId: this.currentPick.minigameId,
      category: this.currentPick.category
    });
    this.lastOutcome = { ranking: result.ranking, deltas, stats: result.stats, double };

    const winner = this.winnerId();
    this.phase = winner ? 'GAME_OVER' : 'RESULTS';
    this.events.emit('phase', this.phase);

    if (this.game) {
      this.game.scene.start(winner ? 'GameOverScene' : 'ResultsScene');
    }
  }

  /** Torna il giocatore che ha raggiunto il target, o null. */
  winnerId(): PlayerId | null {
    let best: PlayerId | null = null;
    let bestScore = this.target - 1;
    for (const [id, s] of this.scores) {
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    }
    return best;
  }

  nextRound(): void {
    this.round += 1;
    this.currentPick = null;
    this.lastOutcome = null;
    this.phase = 'ROULETTE';
    this.events.emit('phase', this.phase);
    if (this.game) this.game.scene.start('RouletteScene');
  }

  resetToLobby(): void {
    this.phase = 'LOBBY';
    this.scores = new Map();
    this.history = [];
    this.currentPick = null;
    this.lastOutcome = null;
    this.events.emit('phase', this.phase);
    if (this.game) this.game.scene.start('LobbyScene');
  }
}

export const game = new GameManager();
