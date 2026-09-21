import type { PadControl } from './padTypes';

/**
 * PROFILI DI INPUT PER MINIGIOCO. Traducono i controlli FISICI astratti (posizione: PRIMARY = tasto in basso...) nei controlId che il
 * minigioco legge gia' dal proprio layout (ctx.input.get(id).axis('move') / justPressed('dash')): lo stesso identico percorso del
 * telefono, quindi nessun minigioco legge mai navigator.getGamepads() e non esiste una "seconda verita'" di gameplay.
 *
 * Un minigioco compare qui solo quando il suo profilo e' stato implementato E provato: il registry (shared/minigames.ts,
 * inputMode) e questo file devono restare allineati (lo verifica scripts/pad-selftest.ts).
 */
export interface PadProfile {
  minigameId: string;
  /** Stick analogici -> asse del minigioco (x/y gia' con deadzone radiale e clamp). */
  sticks: { stick: 'LEFT' | 'RIGHT'; control: string }[];
  /** Tasti fisici -> tasto del minigioco (down/up veri: i bordi arrivano a justPressed/justReleased). */
  buttons: { from: PadControl; control: string }[];
  /** Grilletti analogici -> asse 0..1 del minigioco (x = valore). */
  triggers?: { from: 'LT' | 'RT'; control: string }[];
  /** Testo d'aiuto per la TV / il telefono: cosa fa ciascun controllo del minigioco. */
  hints: { from: PadControl | 'LEFT_STICK' | 'RIGHT_STICK'; label: string }[];
}

export const PAD_PROFILES: Record<string, PadProfile> = {
  arena: {
    minigameId: 'arena',
    sticks: [{ stick: 'LEFT', control: 'move' }],
    buttons: [
      { from: 'PRIMARY', control: 'dash' },
      { from: 'SECONDARY', control: 'ability' }
    ],
    hints: [
      { from: 'LEFT_STICK', label: 'MUOVITI' },
      { from: 'PRIMARY', label: 'SCATTO' },
      { from: 'SECONDARY', label: 'ABILITÀ' }
    ]
  }
};

export function profileFor(minigameId: string | null | undefined): PadProfile | null {
  return (minigameId && PAD_PROFILES[minigameId]) || null;
}
