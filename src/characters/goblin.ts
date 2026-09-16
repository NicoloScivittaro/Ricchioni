import { HOOKS } from '../core/hooks';
import type { CharacterDefinition } from './types';

/** Nicolò — GOBLIN MBRIACONE (il creatore del gioco). */
export const goblin: CharacterDefinition = {
  id: 'goblin',
  name: 'Nicolò',
  roleTitle: 'GOBLIN MBRIACONE',
  subtitle: 'Small Drinks, Big Troubles | Il Creatore del Gioco',
  avatar: '🧟‍♂️',
  image: '/characters/nicolo.jpg',
  color: '#10b981',
  quote: "Party first, quest later. Nel codice sorgente c'è scritto che non posso morire!",
  resourceName: 'Lucidità',
  resourceMax: 100,
  initialResource: 25,
  passive: {
    name: "L'HO FATTO IO 'STO GIOCO",
    description: 'Occasionalmente ha informazioni o possibilità che gli altri non hanno.'
  },
  weakness: {
    name: 'ROLLBACK ISTINTIVO',
    description: 'Più perde lucidità, più le sue abilità diventano potenti ma imprevedibili.'
  },
  abilityName: 'EXPLOIT',
  abilityDescription:
    'Un piccolo vantaggio contestuale per il minigioco: elimina una risposta, rivela un ostacolo, congela lo schermo o fa un reroll.',
  hooks: {
    CULTURA: [HOOKS.quiz_remove_answer],
    MEMORIA: [HOOKS.memory_freeze],
    GUIDA: [HOOKS.race_reveal_obstacle],
    FORTUNA: [HOOKS.luck_reroll],
    PUZZLE: [HOOKS.puzzle_one_hint]
  },
  defaultHooks: [HOOKS.luck_reroll]
};
