import { ModifierRegistry } from '../core/ModifierRegistry';
import type { ModifierDefinition } from '../core/types';

export const MODIFIERS: ModifierDefinition[] = [
  {
    id: 'tempo_dimezzato',
    name: 'TEMPO DIMEZZATO',
    description: 'Il tempo del minigioco è dimezzato.',
    weight: 30
  },
  {
    id: 'punti_doppi',
    name: 'PUNTI DOPPI',
    description: 'Il round vale il doppio dei punti.',
    weight: 20
  },
  {
    id: 'controlli_invertiti',
    name: 'CONTROLLI INVERTITI',
    description: 'I controlli sono invertiti. (in arrivo nei giochi fisici)',
    weight: 25
  },
  {
    id: 'gravita_bassa',
    name: 'GRAVITÀ BASSA',
    description: 'Gravità ridotta nell\'arena. (in arrivo nei giochi fisici)',
    weight: 15
  }
];

MODIFIERS.forEach((m) => ModifierRegistry.register(m));
