import type { PlayerId, PlayerResult } from '../../../shared/types';
import type { KartState } from './raceTypes';
import { applyBoost, respawnKart } from './kartPhysics';
import { LAPS } from './track';

const COUNTDOWN_TOTAL = 3.6; // 3,2,1,VIA
const GOOD_START_WINDOW = 0.32; // finestra "buon avvio" dopo il VIA
const EARLY_PRESS_PENALTY_STUN = 0.4;
const START_BOOST_POWER = 15;
const START_BOOST_DURATION = 0.8;
const GRACE_AFTER_FIRST_FINISH = 12;

export type RacePhase = 'countdown' | 'racing' | 'ended';

export interface RaceHudEvent {
  type: 'lap' | 'finish' | 'countdown' | 'checkpoint_clean' | 'overtake';
  playerId?: PlayerId;
  value?: number;
}

/** Countdown, checkpoint/giri, classifica live, condizioni di fine gara. */
export class RaceManager {
  phase: RacePhase = 'countdown';
  countdownRemaining = COUNTDOWN_TOTAL;
  raceTime = 0;
  private graceActive = false;
  private graceTimer = 0;
  private earlyPress = new Map<PlayerId, boolean>();
  private prevPlacement = new Map<PlayerId, number>();

  constructor(
    private checkpoints: number[],
    private totalLength: number,
    private durationCap: number,
    private trackAngleAt: (distance: number) => number,
    private onEvent: (ev: RaceHudEvent) => void
  ) {}

  /** Da chiamare ogni frame ANCHE durante il countdown (per rilevare partenze anticipate/perfette). */
  update(dt: number, karts: KartState[], upPressed: (playerId: PlayerId) => boolean): void {
    if (this.phase === 'countdown') {
      const prevRemaining = this.countdownRemaining;
      this.countdownRemaining -= dt;
      for (const k of karts) {
        if (this.countdownRemaining > GOOD_START_WINDOW && upPressed(k.playerId)) {
          this.earlyPress.set(k.playerId, true);
        }
      }
      const prevCeil = Math.ceil(prevRemaining);
      const nowCeil = Math.ceil(this.countdownRemaining);
      if (nowCeil < prevCeil && nowCeil > 0) this.onEvent({ type: 'countdown', value: nowCeil });

      if (this.countdownRemaining <= 0) {
        this.phase = 'racing';
        this.onEvent({ type: 'countdown', value: 0 });
        for (const k of karts) {
          if (this.earlyPress.get(k.playerId)) {
            k.stunTimer = Math.max(k.stunTimer, EARLY_PRESS_PENALTY_STUN);
          } else if (upPressed(k.playerId)) {
            applyBoost(k, START_BOOST_POWER, START_BOOST_DURATION);
          }
        }
      }
      return;
    }

    this.raceTime += dt;

    for (const k of karts) {
      if (k.finished) continue;
      this.checkCheckpoints(k);
      if (k.respawnTimer > 0.001 && k.respawnTimer - dt <= 0) {
        respawnKart(k, this.trackAngleAt);
      }
    }

    this.computeRanking(karts);

    if (!this.graceActive && karts.some((k) => k.finished)) {
      this.graceActive = true;
      this.graceTimer = GRACE_AFTER_FIRST_FINISH;
    }
    if (this.graceActive) this.graceTimer -= dt;

    const allFinished = karts.every((k) => k.finished);
    const graceExpired = this.graceActive && this.graceTimer <= 0;
    if (allFinished || graceExpired || this.raceTime >= this.durationCap) {
      this.endRace(karts);
    }
  }

  private checkCheckpoints(k: KartState): void {
    const nextThreshold = (): number => {
      if (k.nextCheckpoint < this.checkpoints.length) return k.lap * this.totalLength + this.checkpoints[k.nextCheckpoint];
      return (k.lap + 1) * this.totalLength;
    };
    let threshold = nextThreshold();
    let guard = 0;
    while (k.distance >= threshold && guard < this.checkpoints.length + 1) {
      k.lastValidCheckpointS = threshold;
      if (!k.offRoad) this.onEvent({ type: 'checkpoint_clean', playerId: k.playerId });
      if (k.nextCheckpoint >= this.checkpoints.length) {
        k.lap += 1;
        k.nextCheckpoint = 1;
        this.onEvent({ type: 'lap', playerId: k.playerId, value: k.lap });
        if (k.lap >= LAPS) {
          this.finishKart(k);
          return;
        }
      } else {
        k.nextCheckpoint += 1;
      }
      threshold = nextThreshold();
      guard++;
    }
  }

  private finishKart(k: KartState): void {
    k.finished = true;
    k.finishTime = this.raceTime;
    this.onEvent({ type: 'finish', playerId: k.playerId });
  }

  private computeRanking(karts: KartState[]): void {
    const finishedSorted = karts.filter((k) => k.finished).sort((a, b) => a.finishTime - b.finishTime);
    const activeSorted = karts.filter((k) => !k.finished).sort((a, b) => b.distance - a.distance);
    const ordered = [...finishedSorted, ...activeSorted];
    ordered.forEach((k, i) => {
      k.placement = i + 1;
      const prev = this.prevPlacement.get(k.playerId);
      if (prev !== undefined && k.placement < prev && !k.finished) {
        this.onEvent({ type: 'overtake', playerId: k.playerId });
      }
      this.prevPlacement.set(k.playerId, k.placement);
    });
  }

  rankOf(karts: KartState[], playerId: PlayerId): number {
    return karts.find((k) => k.playerId === playerId)?.placement ?? karts.length;
  }

  private endRace(karts: KartState[]): void {
    if (this.phase === 'ended') return;
    for (const k of karts) {
      if (!k.finished) {
        k.finished = true;
        k.finishTime = this.raceTime;
      }
    }
    this.computeRanking(karts);
    this.phase = 'ended';
  }

  buildResults(karts: KartState[]): PlayerResult[] {
    return [...karts]
      .sort((a, b) => a.placement - b.placement)
      .map((k) => ({
        playerId: k.playerId,
        placement: k.placement,
        score: Math.round(k.finishTime * 1000)
      }));
  }
}
