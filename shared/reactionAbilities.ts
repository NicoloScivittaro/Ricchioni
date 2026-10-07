import { abilityTable } from './abilityCatalog';

/**
 * Abilita' di BOTTA AL VOLO: FACCIATA sul catalogo unico (shared/abilityCatalog.ts), dove vivono nomi, testi e numeri. Non modificare qui.
 */
export interface ReactionAbility {
  name: string;
  desc: string;
}

export const REACTION_ABILITIES: Record<string, ReactionAbility> = abilityTable('reaction');
