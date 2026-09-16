import { HOOKS } from '../core/hooks';
import type { CharacterDefinition } from './types';

/** Ciro — IL NAPOLETANO STEMPIATO (denaro + scommesse + tirchieria + i 2 capelli). */
export const ciro: CharacterDefinition = {
  id: 'ciro',
  name: 'Ciro',
  roleTitle: 'IL NAPOLETANO STEMPIATO',
  subtitle: "Non C'ho Spicci... Ma Ho Soluzioni! | Te Ne Do Meno",
  avatar: '👨‍🦲',
  image: '/characters/ciro.jpg',
  color: '#8b5cf6',
  quote: "Non c'ho spicci... ma ho soluzioni! Facciamo 50 e 50: 80 a me e 20 a te!",
  resourceName: 'Capelli del Destino',
  resourceMax: 2,
  initialResource: 2,
  passive: {
    name: 'NON TE LI DO',
    description: 'Piccole meccaniche di risparmio/recupero sulle penalità.'
  },
  weakness: {
    name: 'I DUE CAPELLI DEL DESTINO',
    description:
      'I 2 capelli sono consumabili e non tornano: una volta persi, è ufficialmente pelato.'
  },
  abilityName: 'È TUTTO REGOLARE',
  abilityDescription:
    'Può scommettere prima del minigioco (punti extra se centra la condizione) o spendere un capello per un reroll.',
  hooks: {
    FORTUNA: [HOOKS.luck_reroll],
    SOCIALE: [HOOKS.luck_reroll]
  },
  defaultHooks: [HOOKS.generic_undo_one_error]
};
