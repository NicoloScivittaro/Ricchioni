import { QuizScene } from './QuizScene';
import type { MinigameModule } from '../types';

/**
 * CHI CAZZO LO SA? — quiz generale e sul gruppo.
 * Motore QUIZ: da qui nasceranno vero/falso, prezzi, immagini, ecc.
 */
const quiz: MinigameModule = {
  definition: {
    id: 'quiz',
    name: 'CHI CAZZO LO SA?',
    category: 'CULTURA',
    rarity: 'common',
    minPlayers: 2,
    maxPlayers: 5,
    durationSec: 45,
    compatibleModifiers: ['tempo_dimezzato', 'punti_doppi'],
    sceneKey: 'quiz'
  },
  scene: QuizScene
};

export default quiz;
