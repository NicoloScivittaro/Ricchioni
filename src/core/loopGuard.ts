import { game as gm } from './GameManager';

/**
 * Avvolge un render-loop Babylon: se `step()` lancia, Babylon smette di ripianificare il frame e la
 * scena resta congelata in silenzio. Qui l'errore viene mostrato UNA volta (overlay RIPROVA / SALTA
 * sull'host) e il loop smette di rilanciare ogni frame.
 */
export function guardLoop(fn: () => void): () => void {
  let failed = false;
  return () => {
    if (failed) return;
    try {
      fn();
    } catch (e) {
      failed = true;
      gm.reportMinigameError(e);
    }
  };
}

/** Esegue un passo di cleanup isolando le eccezioni: un dispose che lancia non deve bloccare i successivi. */
export function safely(label: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.warn(`[cleanup] ${label} fallito`, e);
  }
}
