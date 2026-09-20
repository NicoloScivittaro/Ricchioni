/**
 * Simulazione in TEMPO REALE, indipendente dagli FPS.
 *
 * Prima ogni gioco 3D faceva `dt = min(delta, 0.05)` e un solo passo per frame: sotto i 20 FPS il tempo di
 * gioco scorreva più piano dell'orologio (countdown, durata partita, limiti di tempo si allungavano in
 * proporzione: a 4 FPS una partita da 45s durava ~225s). Ora un frame lungo viene spezzato in sotto-passi
 * da ≤ MAX_STEP_DT: la fisica resta stabile e il tempo di gioco segue l'orologio fino a MAX_FRAME_DT per frame
 * (~4 FPS); oltre (tab in background, blocchi lunghi) si rallenta invece di "saltare" avanti.
 * A 30 o a 120 FPS non cambia nulla: un solo passo con il dt reale.
 */
export const MAX_STEP_DT = 0.05;
export const MAX_FRAME_DT = 0.25;

/** Spezza un delta (secondi) in passi ≤ MAX_STEP_DT; la somma è min(delta, MAX_FRAME_DT). */
export function splitFrameDelta(deltaSec: number): number[] {
  const total = Math.min(Number.isFinite(deltaSec) && deltaSec > 0 ? deltaSec : 0.016, MAX_FRAME_DT);
  const n = Math.max(1, Math.ceil(total / MAX_STEP_DT - 1e-9));
  const dt = total / n;
  return Array.from({ length: n }, () => dt);
}

/** Esegue `step` per ogni sotto-passo del frame (delta del motore in ms). */
export function runSteps(engineDeltaMs: number, step: (dt: number) => void): void {
  for (const dt of splitFrameDelta(engineDeltaMs / 1000)) step(dt);
}
