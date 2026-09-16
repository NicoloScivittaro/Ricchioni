import type { MinigameDefinition } from './types';

/**
 * SINGLE SOURCE OF TRUTH delle definizioni dei minigiochi (metadata puro, no Phaser).
 * Il server le usa per il rullo e per inviare il controllerLayout ai telefoni;
 * l'host le usa per mappare sceneKey → scena Phaser.
 *
 * Per aggiungere un minigioco:
 * 1. aggiungi qui la definizione (con minPlayers/maxPlayers e controllerLayout);
 * 2. crea la cartella src/minigames/<id>/ con la scena Phaser.
 */
export const MINIGAME_DEFINITIONS: MinigameDefinition[] = [
  {
    id: 'quiz',
    name: 'CHI CAZZO LO SA?',
    category: 'CULTURA',
    rarity: 'common',
    minPlayers: 2,
    maxPlayers: 5,
    durationSec: 45,
    compatibleModifiers: ['tempo_dimezzato', 'punti_doppi'],
    sceneKey: 'quiz',
    controllerLayout: {
      type: 'buttons',
      grid: 2,
      controls: [
        { id: 'answerA', label: 'A', kind: 'button', icon: '🔴' },
        { id: 'answerB', label: 'B', kind: 'button', icon: '🔵' },
        { id: 'answerC', label: 'C', kind: 'button', icon: '🟢' },
        { id: 'answerD', label: 'D', kind: 'button', icon: '🟡' }
      ]
    }
  }
];

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((m) => m.id === id);
}
