/**
 * QuizAbilitySystem — una gimmick unica per personaggio, usabile UNA sola
 * volta per partita di "CHI CAZZO LO SA?". Nessuna garantisce la risposta
 * corretta: aiutano o rischiano, la decisione resta al giocatore.
 */
export type DottoreEffect = 'remove_wrong' | 'extra_time' | 'hint' | 'no_effect' | 'faster_timer';

export const DOTTORE_EFFECTS: DottoreEffect[] = ['remove_wrong', 'extra_time', 'hint', 'no_effect', 'faster_timer'];

/** Pesi pensati per non essere mai troppo punitivi (spec: "evita penalità eccessive"). */
const DOTTORE_WEIGHTS: Record<DottoreEffect, number> = {
  remove_wrong: 2.2,
  extra_time: 2,
  hint: 1.6,
  no_effect: 1.4,
  faster_timer: 0.8
};

export function rollDottoreEffect(rand: () => number): DottoreEffect {
  const total = DOTTORE_EFFECTS.reduce((s, e) => s + DOTTORE_WEIGHTS[e], 0);
  let r = rand() * total;
  for (const e of DOTTORE_EFFECTS) {
    r -= DOTTORE_WEIGHTS[e];
    if (r <= 0) return e;
  }
  return 'no_effect';
}

export function abilityNameFor(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'EXPLOIT';
    case 'buttafuori':
      return 'MO HO CAPITO';
    case 'dottore':
      return 'DIAGNOSI SPERIMENTALE';
    case 'judoka':
      return 'NO, ASPETTA!';
    case 'ciro':
      return 'È TUTTO REGOLARE';
    default:
      return '';
  }
}

/** Riga descrittiva mostrata sul telefono. */
export function abilityDescriptionFor(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'EXPLOIT: prima di rispondere, elimina 2 risposte sbagliate (1 sulle domande 7-10).';
    case 'buttafuori':
      return 'MO HO CAPITO: se sbagli, puoi tentare una seconda risposta (vale il 50% dei punti).';
    case 'dottore':
      return 'DIAGNOSI SPERIMENTALE: scegli una siringa anonima, effetto casuale rischio/ricompensa.';
    case 'judoka':
      return 'NO, ASPETTA!: dopo aver risposto, puoi ancora cambiare risposta (+3 secondi).';
    case 'ciro':
      return 'È TUTTO REGOLARE: prima delle risposte, punti raddoppiati se corretto, persi se sbagli.';
    default:
      return '';
  }
}

export function dottoreEffectLabel(effect: DottoreEffect): string {
  switch (effect) {
    case 'remove_wrong':
      return 'Elimina una risposta sbagliata';
    case 'extra_time':
      return '+8 secondi';
    case 'hint':
      return 'Piccolo indizio';
    case 'no_effect':
      return 'Nessun effetto';
    case 'faster_timer':
      return 'Timer un po\' più veloce';
  }
}
