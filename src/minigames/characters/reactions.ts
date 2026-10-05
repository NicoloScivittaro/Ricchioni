import { presentationOf } from '../../../shared/characterPresentation';

/**
 * Piccoli aiuti di PRESENTAZIONE condivisi dai minigiochi 3D: il nome dell'abilita' REALE del gioco (dalla sua tabella, mai una
 * abilita' globale inventata) e la riga del vincitore col soprannome del telecronista. Nessuna logica di gioco.
 */
export function abilityLabel(table: Record<string, { name: string }>, characterId: string | null | undefined): string | undefined {
  return characterId ? table[characterId]?.name : undefined;
}

/** "🏆 IL GOBLIN! 🧟‍♂️ NICO VINCE!" — il soprannome solo qui (una volta per round): il telecronista non parla a vuoto. */
export function winnerFeed(avatar: string, name: string, characterId: string | null | undefined): string {
  const alias = presentationOf(characterId)?.announcerAlias;
  return `🏆 ${alias ? `${alias}! ` : ''}${avatar} ${name.toUpperCase()} VINCE!`;
}
