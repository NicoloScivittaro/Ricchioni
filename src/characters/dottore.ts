import { HOOKS } from '../core/hooks';
import type { CharacterDefinition } from './types';

/** Victor — IL DOTTORE SCEMO (identità: rischio/ricompensa). */
export const dottore: CharacterDefinition = {
  id: 'dottore',
  name: 'Victor',
  roleTitle: 'IL DOTTORE SCEMO',
  subtitle: 'Tranquilli, So Quello Che Faccio | 5ml di Idee Brillanti(?)',
  avatar: '🧪',
  image: '/characters/victor.jpg',
  color: '#06b6d4',
  quote: 'Tranquilli, so quello che faccio. Diagnosi: forse tutto bene, o forse ripensiamoci domani.',
  resourceName: 'Provette Sperimentali',
  resourceMax: 5,
  initialResource: 3,
  passive: {
    name: 'TRANQUILLI, SO QUELLO CHE FACCIO',
    description:
      'Prima di alcuni minigiochi riceve un potenziamento con bonus ed effetto collaterale (es. +velocità ma controlli scivolosi).'
  },
  weakness: {
    name: 'LAUREA SU TELEGRAM',
    description: 'Nelle scelte logiche sceglie spesso l\'opzione peggiore con convinzione cieca.'
  },
  abilityName: 'PLACEBO MICIDIALE',
  abilityDescription:
    'Un trattamento a effetto parzialmente sconosciuto: può dargli un vantaggio ma con un contraccolpo.',
  hooks: {
    PUZZLE: [HOOKS.puzzle_one_hint],
    FORTUNA: [HOOKS.luck_reroll],
    MEMORIA: [HOOKS.memory_replay]
  },
  defaultHooks: [HOOKS.generic_undo_one_error]
};
