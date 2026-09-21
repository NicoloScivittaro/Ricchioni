import type { PadBinding, PadControl } from './padTypes';

/**
 * PROFILI DI INPUT PER MINIGIOCO. UNA SOLA FONTE per due usi: l'input vero e la schermata CONTROLLI. Ogni voce di `controls` dice
 * "questo controllo fisico fa questa azione", e da QUELLA lista si ricavano sia i binding che il gioco riceve (sticks/buttons/triggers)
 * sia le righe della schermata comandi: non puo' succedere che la TV dica "A = dash" mentre il codice usa B.
 *
 * `control` e' il controlId che il minigioco legge GIA' dal layout del telefono (ctx.input.get(id).axis('move') / justPressed('dash')):
 * stesso identico percorso, nessun nome nuovo, nessun minigioco legge mai navigator.getGamepads().
 *
 * Un minigioco compare qui solo quando il suo profilo e' stato implementato E provato: il registry (shared/minigames.ts, inputMode)
 * e questo file devono restare allineati (lo verifica scripts/pad-selftest.ts).
 */
export interface PadBindingDef {
  /** Azione logica (MOVE, DASH, ABILITY...). */
  action: string;
  /** Controllo fisico astratto o stick. */
  binding: PadBinding;
  /** controlId letto dal minigioco. */
  control: string;
  /** Testo mostrato nella schermata CONTROLLI. */
  label: string;
  /** Solo per LT/RT: il minigioco vuole il valore analogico 0..1 (asse) invece di un tasto. */
  analog?: boolean;
}

export interface PadProfile {
  minigameId: string;
  /** Fonte unica (input + schermata comandi). */
  controls: PadBindingDef[];
  /** Ricavati da `controls`: stick analogici -> asse del minigioco (x/y con deadzone radiale e clamp). */
  sticks: { stick: 'LEFT' | 'RIGHT'; control: string }[];
  /** Ricavati da `controls`: tasti fisici -> tasto del minigioco (down/up veri: i bordi arrivano a justPressed/justReleased). */
  buttons: { from: PadControl; control: string }[];
  /** Ricavati da `controls`: grilletti analogici -> asse 0..1 (x = valore). */
  triggers: { from: 'LT' | 'RT'; control: string }[];
}

export function defineProfile(minigameId: string, controls: PadBindingDef[]): PadProfile {
  const sticks: PadProfile['sticks'] = [];
  const buttons: PadProfile['buttons'] = [];
  const triggers: PadProfile['triggers'] = [];
  for (const c of controls) {
    if (c.binding === 'LEFT_STICK') sticks.push({ stick: 'LEFT', control: c.control });
    else if (c.binding === 'RIGHT_STICK') sticks.push({ stick: 'RIGHT', control: c.control });
    else if (c.analog && (c.binding === 'LT' || c.binding === 'RT')) triggers.push({ from: c.binding, control: c.control });
    else buttons.push({ from: c.binding, control: c.control });
  }
  return { minigameId, controls, sticks, buttons, triggers };
}

export const PAD_PROFILES: Record<string, PadProfile> = {
  arena: defineProfile('arena', [
    { action: 'MOVE', binding: 'LEFT_STICK', control: 'move', label: 'MUOVITI' },
    { action: 'DASH', binding: 'PRIMARY', control: 'dash', label: 'DASH / SPINTA' },
    { action: 'ABILITY', binding: 'SECONDARY', control: 'ability', label: 'ABILITÀ' }
  ])
};

export function profileFor(minigameId: string | null | undefined): PadProfile | null {
  return (minigameId && PAD_PROFILES[minigameId]) || null;
}
