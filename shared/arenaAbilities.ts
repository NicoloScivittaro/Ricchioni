import { abilityTable } from './abilityCatalog';

/**
 * Abilita' di ARENA DEL DISAGIO: FACCIATA sul catalogo unico (shared/abilityCatalog.ts), dove vivono nomi, testi e numeri. Non modificare qui.
 */
export interface ArenaAbility {
  name: string;
  desc: string;
}

export const ARENA_ABILITIES: Record<string, ArenaAbility> = abilityTable('arena');
