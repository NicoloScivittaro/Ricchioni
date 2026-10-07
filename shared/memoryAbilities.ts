import { abilityTable } from './abilityCatalog';

/**
 * Abilità di MEMORIA DA UBRIACO (una per personaggio, UNA volta per partita). Nome e descrizione vengono dal catalogo unico
 * (shared/abilityCatalog.ts): qui resta solo la FASE in cui ciascuna si può attivare, che è una regola del gioco, non un testo.
 */
export interface MemoryAbility {
  name: string;
  desc: string;
  /** In quale fase è attivabile: 'observe' | 'repeat' | 'passive'. */
  phase: 'observe' | 'repeat' | 'passive';
}

const PHASE: Record<string, MemoryAbility['phase']> = {
  goblin: 'observe',
  buttafuori: 'passive',
  dottore: 'repeat',
  judoka: 'repeat',
  ciro: 'repeat'
};

export const MEMORY_ABILITIES: Record<string, MemoryAbility> = Object.fromEntries(
  Object.entries(abilityTable('memory')).map(([cid, a]) => [cid, { ...a, phase: PHASE[cid] }])
);
