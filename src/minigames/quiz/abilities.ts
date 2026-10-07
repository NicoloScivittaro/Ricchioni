import { abilityFor } from '../../../shared/abilityCatalog';

/**
 * Abilita' di CHI CAZZO LO SA? (una per personaggio, UNA volta per partita). Nessuna garantisce la risposta corretta: aiutano o
 * rischiano, la decisione resta al giocatore. Nomi, testi e numeri vengono dal catalogo unico (shared/abilityCatalog.ts, AB.quiz):
 * qui restano solo due funzioni di comodo per la scena e per il telefono.
 */
export function abilityNameFor(characterId: string | null): string {
  return abilityFor('quiz', characterId)?.name ?? '';
}

/** Riga descrittiva mostrata sul telefono (stesso testo della Companion Card e della schermata CONTROLLI). */
export function abilityDescriptionFor(characterId: string | null): string {
  const a = abilityFor('quiz', characterId);
  return a ? `${a.name}: ${a.full}` : '';
}
