import { abilityTable } from './abilityCatalog';

/**
 * Abilita' di PALLAVOLO DEI DISAGIATI: FACCIATA sul catalogo unico (shared/abilityCatalog.ts), dove vivono nomi, testi e numeri. Non modificare qui.
 */
export interface VolleyballAbility {
  name: string;
  desc: string;
}

export const VOLLEYBALL_ABILITIES: Record<string, VolleyballAbility> = abilityTable('volleyball');
