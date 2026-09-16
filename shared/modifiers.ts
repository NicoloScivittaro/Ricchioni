import type { ModifierDefinition } from './types';

export const MODIFIERS: ModifierDefinition[] = [
  { id: 'tempo_dimezzato', name: 'TEMPO DIMEZZATO', description: 'Il tempo del minigioco è dimezzato.', weight: 30 },
  { id: 'punti_doppi', name: 'PUNTI DOPPI', description: 'Il round vale il doppio dei punti.', weight: 20 },
  { id: 'controlli_invertiti', name: 'CONTROLLI INVERTITI', description: 'I controlli sono invertiti.', weight: 25 },
  { id: 'gravita_bassa', name: 'GRAVITÀ BASSA', description: 'Gravità ridotta nell\'arena.', weight: 15 }
];

export function getModifier(id: string): ModifierDefinition | undefined {
  return MODIFIERS.find((m) => m.id === id);
}
