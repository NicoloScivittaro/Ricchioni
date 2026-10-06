/**
 * DESIGN SYSTEM — TOKEN (un solo posto, nessuna dipendenza: li usano Phaser, Babylon GUI, DOM della TV e telefono).
 *
 * Tutte le misure sono in pixel "di progetto" a 1280x720: Phaser scala il canvas, Babylon GUI usa idealHeight=720, il DOM
 * li converte con `vmin`/clamp. Regola: niente testo sotto UI.size.S su TV (distanza da divano), niente testo fuori dalla
 * SAFE AREA, una sola cosa grande per schermata.
 */

/** Font: nessun asset esterno. DISPLAY = titoli/annunci (stesso carattere dei cartelli 3D), BODY = testo corrente pulito. */
export const FONT_DISPLAY = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif';
export const FONT_BODY = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';

export const UI = {
  font: { display: FONT_DISPLAY, body: FONT_BODY },
  /** scala tipografica (px a 1280x720) */
  size: {
    XXL: 132, // 3-2-1, VIA!, GOOOL, KO (annunci a schermo pieno)
    XL: 64, // titolo di schermata, nome del gioco
    L: 40, // punteggi, domanda del quiz, numeri importanti
    M: 28, // nomi, voci di elenco, risposte
    S: 20, // stato, spiegazioni, controlli secondari (MINIMO su TV)
    XS: 16 // solo etichette di supporto (mai informazioni necessarie)
  },
  /** spaziatura a passi di 8 */
  space: { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48 },
  radius: { s: 8, m: 14, l: 22, pill: 999 },
  /** SAFE AREA per TV: niente testo nei 48 px laterali / 32 px verticali (overscan e cornici) */
  safe: { x: 48, y: 32 },
  /** colori di stato (uguali ovunque) */
  color: {
    bg: '#0b0b14',
    panel: '#111426',
    panelStrong: '#1a1f36',
    panelAlpha: 0.88,
    line: '#2b3050',
    text: '#ffffff',
    textDim: '#d1d5db',
    muted: '#9ca3af',
    accent: '#fbbf24', // oro: cio' che conta adesso
    info: '#93c5fd',
    success: '#4ade80',
    warning: '#f59e0b', // ambra: avviso / attenzione
    danger: '#f87171', // rosso: errore / eliminato
    teamRed: '#ef4444',
    teamBlue: '#3b82f6'
  },
  /** contorno e ombra del testo sopra il 3D (leggibile su qualsiasi sfondo, senza esagerare) */
  outline: { color: '#000000', thin: 3, thick: 6 },
  shadow: { color: 'rgba(0,0,0,0.65)', blur: 8, y: 3 },
  /** linguaggio del movimento (ms): scatti da game-show, mai animazioni "da dashboard" */
  motion: { enter: 220, exit: 160, success: 280, warning: 200, reveal: 320, winner: 350, pulse: 420 },
  /** squadre: colore + PAROLA + SIMBOLO (si legge anche senza distinguere rosso/blu) */
  team: {
    red: { label: 'ROSSI', symbol: '▲', color: '#ef4444' },
    blue: { label: 'BLU', symbol: '●', color: '#3b82f6' }
  }
} as const;

export type UiColor = keyof typeof UI.color;

/** "#rrggbb" -> 0xRRGGBB */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Variabili CSS (DOM della TV e telefono): stessi token, un solo foglio. */
export function cssVars(): string {
  const c = UI.color;
  return `:root{--ui-display:${FONT_DISPLAY};--ui-body:${FONT_BODY};--ui-bg:${c.bg};--ui-panel:${c.panel};--ui-panel-strong:${c.panelStrong};--ui-line:${c.line};--ui-text:${c.text};--ui-dim:${c.textDim};--ui-muted:${c.muted};--ui-accent:${c.accent};--ui-info:${c.info};--ui-success:${c.success};--ui-warning:${c.warning};--ui-danger:${c.danger};--ui-r-s:${UI.radius.s}px;--ui-r-m:${UI.radius.m}px;--ui-r-l:${UI.radius.l}px}`;
}
