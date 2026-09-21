import type { Team } from './volleyballTypes';

/**
 * STATISTICHE DI BILANCIAMENTO della pallavolo (solo debug: `?debug=1` o `npm run dev`; in produzione non viene nemmeno creata).
 * Non tocca nessun valore di gioco: osserva soltanto. A fine partita stampa in console un riepilogo conciso:
 * durata degli scambi, colpi per scambio, velocita' massima della palla, smash fatti / ricevuti, punti diretti da smash.
 */
export class VolleyStats {
  private t = 0;
  private rallyT0 = 0;
  private touches = 0;
  /** squadra dell'ultimo colpo, se era uno smash non ancora toccato dagli avversari */
  private openSmash: Team | null = null;
  private rallies: { dur: number; touches: number }[] = [];
  private maxBallSpeed = 0;
  private maxSmashSpeed = 0;
  private smashesMade = new Map<string, number>();
  private smashesReceived = 0;
  private smashPointsDirect = 0;

  tick(dt: number): void {
    this.t += dt;
  }

  rallyStart(): void {
    this.rallyT0 = this.t;
    this.touches = 1; // il servizio e' il primo colpo (come `rally` nel gioco)
    this.openSmash = null;
  }

  /** `speedAfter` = velocita' 3D della palla subito dopo il colpo. */
  hit(team: Team, playerId: string, isSmash: boolean, speedAfter: number): void {
    this.touches++;
    if (this.openSmash && this.openSmash !== team) this.smashesReceived++; // smash raggiunto dagli avversari = ricevuto
    if (isSmash) {
      this.smashesMade.set(playerId, (this.smashesMade.get(playerId) ?? 0) + 1);
      this.maxSmashSpeed = Math.max(this.maxSmashSpeed, speedAfter);
      this.openSmash = team;
    } else {
      this.openSmash = null;
    }
    this.ball(speedAfter);
  }

  ball(speed: number): void {
    if (speed > this.maxBallSpeed) this.maxBallSpeed = speed;
  }

  point(scoringTeam: Team): void {
    this.rallies.push({ dur: this.t - this.rallyT0, touches: this.touches });
    if (this.openSmash === scoringTeam) this.smashPointsDirect++; // smash che nessuno ha toccato: punto diretto
    this.openSmash = null;
  }

  summary(): Record<string, unknown> {
    const n = this.rallies.length;
    const durs = this.rallies.map((r) => r.dur);
    const smashes = [...this.smashesMade.values()].reduce((a, b) => a + b, 0);
    return {
      rallies: n,
      avgRallySec: n ? durs.reduce((a, b) => a + b, 0) / n : 0,
      minRallySec: n ? Math.min(...durs) : 0,
      maxRallySec: n ? Math.max(...durs) : 0,
      avgTouches: n ? this.rallies.reduce((a, r) => a + r.touches, 0) / n : 0,
      maxBallSpeed: this.maxBallSpeed,
      maxSmashSpeed: this.maxSmashSpeed,
      smashes,
      smashesReceived: this.smashesReceived,
      smashPointsDirect: this.smashPointsDirect
    };
  }

  /** Riepilogo di fine partita (console + window.__volleyStats per i test automatici). */
  report(names: Map<string, string>): void {
    const s = this.summary() as Record<string, number>;
    const who = [...this.smashesMade.entries()].map(([id, k]) => `${names.get(id) ?? id} ${k}`).join(', ');
    console.info(
      `[PALLAVOLO · debug] ${s.rallies} scambi · durata media ${s.avgRallySec.toFixed(1)}s (min ${s.minRallySec.toFixed(1)} · max ${s.maxRallySec.toFixed(1)}) · ` +
        `colpi/scambio ${s.avgTouches.toFixed(1)} · palla max ${s.maxBallSpeed.toFixed(1)} u/s (smash max ${s.maxSmashSpeed.toFixed(1)})\n` +
        `   smash ${s.smashes} (ricevuti ${s.smashesReceived} · punti diretti ${s.smashPointsDirect})${who ? ` · ${who}` : ''}`
    );
    (window as unknown as { __volleyStats?: unknown }).__volleyStats = s;
  }
}
