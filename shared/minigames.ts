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
    minPlayers: 1,
    maxPlayers: 5,
    // 10 domande a difficoltà crescente (timer 12-25s) + intro/reveal/spiegazione
    // per ognuna + 3 classifiche intermedie: il giro completo richiede molto
    // più dei 45s del vecchio quiz da 5 domande rapide. Vedi QuizRoundManager
    // per il dettaglio dei tempi; 320s lascia margine anche con bonus tempo
    // delle abilità (es. +8s del Dottore) che si accumulano su più domande.
    durationSec: 320,
    // "tempo_dimezzato" non è più compatibile: dimezzerebbe anche la rete di
    // sicurezza server-side (durationSec), rischiando di troncare un quiz che
    // segue comunque i suoi timer per-domanda fissi (non letti dal modificatore).
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'quiz',
    controllerLayout: {
      type: 'buttons',
      grid: 2,
      controls: [
        { id: 'answerA', label: 'A', kind: 'button', icon: '🔴' },
        { id: 'answerB', label: 'B', kind: 'button', icon: '🔵' },
        { id: 'answerC', label: 'C', kind: 'button', icon: '🟢' },
        { id: 'answerD', label: 'D', kind: 'button', icon: '🟡' },
        { id: 'ability', label: 'ABILITÀ', kind: 'button', icon: '⭐' }
      ]
    }
  },
  {
    id: 'reaction',
    name: 'BOTTA AL VOLO',
    category: 'RIFLESSI',
    rarity: 'common',
    minPlayers: 1,
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
    minPlayers: 1,
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
    minPlayers: 1,
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
  },
  {
    id: 'dodgeball',
    name: 'DODGEBALL DEI COGLIONI',
    category: 'ARENA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 45,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'dodgeball',
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' }
      ]
    }
  },
  {
    id: 'soccer',
    name: 'CALCIO DEI DISAGIATI',
    category: 'SPORT',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 45,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'soccer',
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' }
      ]
    }
  },
  {
    id: 'volleyball',
    name: 'PALLAVOLO DEI DISAGIATI',
    category: 'SPORT',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 40,
    compatibleModifiers: ['gravita_bassa', 'punti_doppi'],
    sceneKey: 'volleyball',
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' },
        { id: 'action', label: 'COLPO', kind: 'button', icon: '👊' }
      ]
    }
  },
  {
    id: 'kart',
    name: 'KART DEI COGLIONI',
    category: 'GUIDA',
    rarity: 'rare',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 90,
    compatibleModifiers: ['controlli_invertiti', 'punti_doppi'],
    sceneKey: 'kart',
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' }
      ]
    }
  },
  {
    id: 'pixelrush',
    name: 'PIXEL RUSH',
    category: 'GUIDA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 60,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'pixelrush',
    controllerLayout: {
      type: 'buttons',
      grid: 2,
      controls: [
        { id: 'left', label: '◀', kind: 'button' },
        { id: 'right', label: '▶', kind: 'button' },
        { id: 'action', label: 'OGGETTO', kind: 'button', icon: '🎁' }
      ]
    }
  },
  {
    id: 'kart3d',
    name: 'RIBALTATI — CIRCUITO DEL LITORALE',
    category: 'GUIDA',
    rarity: 'rare',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 130,
    compatibleModifiers: ['controlli_invertiti', 'punti_doppi'],
    sceneKey: 'kart3d',
    controllerLayout: {
      type: 'racing',
      controls: [
        { id: 'up', label: 'ACCELERA', kind: 'hold' },
        { id: 'down', label: 'FRENO', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' },
        { id: 'drift', label: 'DRIFT', kind: 'hold', icon: '💨' },
        { id: 'item', label: 'ITEM', kind: 'button', icon: '🎁' },
        { id: 'ability', label: 'ABILITÀ', kind: 'button', icon: '⭐' }
      ]
    }
  }
];

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((m) => m.id === id);
}
