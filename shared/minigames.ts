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
  },
  {
    id: 'reaction',
    name: 'BOTTA AL VOLO',
    category: 'RIFLESSI',
    rarity: 'common',
    minPlayers: 2,
    maxPlayers: 5,
    durationSec: 20,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'reaction',
    controllerLayout: {
      type: 'buttons',
      grid: 1,
      controls: [{ id: 'action', label: 'PREMI!', kind: 'button', icon: '⚡' }]
    }
  },
  {
    id: 'memory',
    name: 'MEMORIA DA UBRIACO',
    category: 'MEMORIA',
    rarity: 'uncommon',
    minPlayers: 2,
    maxPlayers: 5,
    durationSec: 60,
    compatibleModifiers: ['tempo_dimezzato', 'punti_doppi'],
    sceneKey: 'memory',
    controllerLayout: {
      type: 'buttons',
      grid: 2,
      controls: [
        { id: 'c0', label: '🔴', kind: 'button', color: '#ef4444' },
        { id: 'c1', label: '🔵', kind: 'button', color: '#3b82f6' },
        { id: 'c2', label: '🟢', kind: 'button', color: '#22c55e' },
        { id: 'c3', label: '🟡', kind: 'button', color: '#eab308' }
      ]
    }
  },
  {
    id: 'arena',
    name: 'ARENA DEL DISAGIO',
    category: 'ARENA',
    rarity: 'uncommon',
    minPlayers: 2,
    maxPlayers: 5,
    durationSec: 30,
    compatibleModifiers: ['controlli_invertiti', 'punti_doppi'],
    sceneKey: 'arena',
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' }
      ]
    }
  }
];

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((m) => m.id === id);
}
