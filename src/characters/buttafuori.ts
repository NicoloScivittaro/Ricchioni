import { HOOKS } from '../core/hooks';
import type { CharacterDefinition } from './types';

/** Christian — IL BUTTAFUORI RIBALTATO (identità: apprendimento). */
export const buttafuori: CharacterDefinition = {
  id: 'buttafuori',
  name: 'Christian',
  roleTitle: 'IL BUTTAFUORI RIBALTATO',
  subtitle: 'Tu Qua Non Entri! | Akatsuki della Sicurezza',
  avatar: '🥊',
  image: '/characters/christian.jpg',
  color: '#ef4444',
  quote: "Tu qua non entri! Aspè... famme capì, mo se te ribalto vinco io? Perfetto!",
  resourceName: 'Comprensione',
  resourceMax: 3,
  initialResource: 0,
  passive: {
    name: "ASPETTA, FAMME CAPÌ",
    description:
      'Se un minigioco viene ripetuto nella stessa partita, ottiene un piccolo vantaggio perché ormai ha capito come funziona.'
  },
  weakness: {
    name: 'TROPPA ONESTÀ',
    description: 'Non sa imbrogliare: gioca sempre pulito, a volte a suo svantaggio.'
  },
  abilityName: "MO M'IMPEGNO",
  abilityDescription:
    'Per pochi secondi ottiene un vantaggio contestuale: più stabilità, migliore recupero, precisione o resistenza.',
  hooks: {
    GUIDA: [HOOKS.race_quick_recover],
    ARENA: [HOOKS.arena_knockback_resist],
    SKILL: [HOOKS.timing_stability],
    RIFLESSI: [HOOKS.timing_stability],
    SPORT: [HOOKS.timing_stability]
  },
  defaultHooks: []
};
