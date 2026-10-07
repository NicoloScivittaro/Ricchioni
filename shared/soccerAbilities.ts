import { abilityTable } from './abilityCatalog';

/**
 * Abilita' di CALCIO DEI DISAGIATI: FACCIATA sul catalogo unico (shared/abilityCatalog.ts), dove vivono nomi, testi e numeri. Non modificare qui.
 */
export interface SoccerAbility {
  name: string;
  desc: string;
}

export const SOCCER_ABILITIES: Record<string, SoccerAbility> = abilityTable('soccer');
