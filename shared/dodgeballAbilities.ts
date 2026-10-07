import { abilityTable } from './abilityCatalog';

/**
 * Abilita' di DODGEBALL DEI COGLIONI: FACCIATA sul catalogo unico (shared/abilityCatalog.ts), dove vivono nomi, testi e numeri. Non modificare qui.
 */
export interface DodgeballAbility {
  name: string;
  desc: string;
}

export const DODGEBALL_ABILITIES: Record<string, DodgeballAbility> = abilityTable('dodgeball');
