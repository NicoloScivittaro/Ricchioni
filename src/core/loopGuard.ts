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
