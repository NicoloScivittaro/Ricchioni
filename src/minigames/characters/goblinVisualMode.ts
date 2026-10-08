/** Lightweight selection; importing this module never loads Babylon or a model. */
export type GoblinVisualMode = 'old' | 'new';
const MODE_QUERY = 'goblin';
const STORE_KEY = 'ricchioni.goblinVisual';

function queryMode(): GoblinVisualMode | null {
  try {
    const v = new URLSearchParams(location.search).get(MODE_QUERY);
    if (v === 'new' || v === 'old') return v;
  } catch {
    /* nessun URL (test/SSR) */
  }
  return null;
}

function storedMode(): GoblinVisualMode | null {
  try {
    const v = sessionStorage.getItem(STORE_KEY);
    if (v === 'new' || v === 'old') return v;
  } catch {
    /* sessionStorage negato (privacy): si resta sul default */
  }
  return null;
}

/**
 * Scelta fatta A RUNTIME (pulsanti della galleria, console, `setGoblinVisualMode`). Ha la precedenza su tutto:
 * senza di essa un `?goblin=new` nell'URL renderebbe impossibile tornare a OLD dalla UI (e viceversa il pulsante
 * NEW non farebbe nulla partendo da `?goblin=old`). Prima di qualsiasi scelta a runtime vale `URL > sessione > new`.
 */
let runtimeMode: GoblinVisualMode | null = null;

/** Modalità richiesta: runtime > URL > sessione > `new`. Il selettore sopravvive ai cambi scena del gioco. */
export function goblinVisualMode(): GoblinVisualMode {
  return runtimeMode ?? queryMode() ?? storedMode() ?? 'new';
}

/**
 * Cambia la modalità a runtime (pulsanti della galleria, console, test) e la ricorda per la sessione del tab.
 * L'override resta valido finché la pagina vive: è una scelta dell'utente, non un valore derivato dall'URL.
 */
export function setGoblinVisualMode(mode: GoblinVisualMode): void {
  runtimeMode = mode;
  try {
    sessionStorage.setItem(STORE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** The verified imported renderer is available during normal games, with Legacy on load failure. */
export function goblinNewEnabled(): boolean {
  return goblinVisualMode() === 'new';
}

