import { HOOKS } from '../core/hooks';
import type { CharacterDefinition } from './types';

/** Il Judoka — IL JUDOKA ROMPICOGLIONI (judo + controllo + contestazione + granita). */
export const judoka: CharacterDefinition = {
  id: 'judoka',
  name: 'Il Judoka',
  roleTitle: 'IL JUDOKA ROMPICOGLIONI',
  subtitle: 'Granita, Judo e Lamentele | Qui Comando Io!',
  avatar: '🥋',
  image: '/characters/judoka.jpg',
  color: '#f59e0b',
  quote: 'EH?! MA DAI! NON È COSÌ! In realtà secondo il comma 4 del regolamento di casa mia...',
  resourceName: 'Granita',
  resourceMax: 100,
  initialResource: 80,
  passive: {
    name: 'NO, ASPETTA!',
    description: 'Può contestare/ripetere qualcosa consumando Granita.'
  },
  weakness: {
    name: "CRISI D'ASTINENZA DA GRANITA",
    description: 'A Granita zero subisce "Brain Freeze": non può contestare.'
  },
  abilityName: 'CASA MIA, REGOLE MIE',
  abilityDescription:
    'Contesta o modifica una piccola regola: aiuto culturale nei quiz, contrattacco nell\'arena.',
  hooks: {
    CULTURA: [HOOKS.quiz_extra_time],
    ARENA: [HOOKS.arena_recover_grab],
    SPORT: [HOOKS.arena_knockback_resist]
  },
  defaultHooks: [HOOKS.generic_undo_one_error]
};
