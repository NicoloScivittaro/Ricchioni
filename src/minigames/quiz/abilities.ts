/**
 * QuizAbilitySystem — una gimmick unica per personaggio, usabile UNA sola
 * volta per partita di "CHI CAZZO LO SA?". Nessuna garantisce la risposta
 * corretta: aiutano o rischiano, la decisione resta al giocatore.
 */
export function abilityNameFor(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'NCULO!';
    case 'buttafuori':
      return 'MO HO CAPITO';
    case 'dottore':
      return "M'HO SVEJATO";
    case 'judoka':
      return 'NO, ASPETTA!';
    case 'ciro':
      return 'ULTIMO GIORNO UTILE';
    default:
      return '';
  }
}

/** Riga descrittiva mostrata sul telefono. */
export function abilityDescriptionFor(characterId: string | null): string {
  switch (characterId) {
    case 'goblin':
      return 'NCULO!: rifiuta la domanda prima di rispondere. Ne arriva una nuova, stessa difficoltà, per tutti.';
    case 'buttafuori':
      return 'MO HO CAPITO: se sbagli, hai 4 secondi per riprovare (vale metà dei punti se indovini).';
    case 'dottore':
      return "M'HO SVEJATO: chiedi un indizio vero. Se poi indovini, vale il 70% dei punti.";
    case 'judoka':
      return 'NO, ASPETTA!: dopo aver risposto, puoi ancora cambiare risposta (+3 secondi).';
    case 'ciro':
      return "ULTIMO GIORNO UTILE: lascia scadere il timer, vedi quanti hanno scelto A/B/C/D e hai altri 4 secondi.";
    default:
      return '';
  }
}
