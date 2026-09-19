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
    icon: '🧠',
    description: 'Rispondi prima e meglio degli altri. Cultura generale, zero pietà.',
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
    // UI "TV quiz show" bespoke (timer circolare, card domanda, risposte colorate,
    // footer con avatar/punteggio/abilità): vedi QuizScene.sendQuizState() per il
    // payload live e src/controller/main.ts renderQuizController() per il render.
    controllerLayout: { type: 'custom', id: 'quiz-tv' }
  },
  {
    id: 'reaction',
    icon: '⚡',
    description: 'Premi appena scatta il segnale. Chi anticipa paga.',
    name: 'BOTTA AL VOLO',
    category: 'RIFLESSI',
    rarity: 'common',
    minPlayers: 1,
    maxPlayers: 5,
    durationSec: 90,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'reaction',
    controllerLayout: {
      type: 'buttons',
      grid: 1,
      controls: [
        { id: 'action', label: 'ASPETTA...', kind: 'button', icon: '⚡' },
        { id: 'ability', label: '⭐ ABILITÀ', kind: 'button', icon: '⭐' }
      ]
    }
  },
  {
    id: 'memory',
    icon: '🍺',
    description: 'Guarda la sequenza e ripetila. Più si beve, meno si ricorda.',
    name: 'MEMORIA DA UBRIACO',
    category: 'MEMORIA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // 5 round a sequenze 3-4-5-6-7 (eliminazione) + fasi OSSERVA/RIPETI:
    // 100s danno ampio margine; il timer server è solo una rete di sicurezza.
    durationSec: 100,
    // "tempo_dimezzato" non si applica: il gioco segue i suoi timer per-round
    // (osserva/ripeti) e non legge il modificatore.
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'memory',
    // UI dedicata (2x2 tile grandi + abilità) sul telefono: vedi renderMemoryController().
    controllerLayout: { type: 'custom', id: 'memory-tv' }
  },
  {
    id: 'arena',
    icon: '🤼',
    description: "Spingi gli altri fuori dall'arena. L'ultimo in piedi vince.",
    name: 'ARENA DEL DISAGIO',
    category: 'ARENA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // Sumo/brawl 3D: countdown + round a eliminazione + eventuale restringimento
    // dell'arena. 45s danno tempo alle eliminazioni; il timer server è solo la
    // rete di sicurezza.
    durationSec: 45,
    compatibleModifiers: ['controlli_invertiti', 'gravita_bassa', 'punti_doppi'],
    sceneKey: 'arena',
    // Controller dedicato: joystick virtuale + DASH + ABILITÀ (vedi renderArenaController()).
    controllerLayout: { type: 'custom', id: 'arena-tv' }
  },
  {
    id: 'dodgeball',
    icon: '🏐',
    description: 'Schiva. Tira. Non farti prendere in faccia.',
    name: 'DODGEBALL DEI COGLIONI',
    category: 'ARENA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // Dodgeball arcade 3D: countdown + round a eliminazione (una palla = sei fuori).
    // 45s danno tempo; il timer server è solo la rete di sicurezza.
    durationSec: 45,
    compatibleModifiers: ['controlli_invertiti', 'gravita_bassa', 'punti_doppi'],
    sceneKey: 'dodgeball',
    // Controller dedicato: joystick + LANCIA + SCHIVA + ABILITÀ (renderDodgeballController()).
    controllerLayout: { type: 'custom', id: 'dodgeball-tv' }
  },
  {
    id: 'soccer',
    icon: '⚽',
    description: 'Calcio a squadre: segna un gol in più degli avversari.',
    name: 'CALCIO DEI DISAGIATI',
    category: 'SPORT',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // Partita a squadre 3D: intro squadre + countdown + match 60s + eventuale
    // golden goal. 100s lasciano margine per tutto; il timer server è solo la
    // rete di sicurezza.
    durationSec: 100,
    compatibleModifiers: ['punti_doppi', 'gravita_bassa'],
    sceneKey: 'soccer',
    // Controller dedicato: joystick + TIRO/PASSA (hold = più forte) + TACKLE + ABILITÀ.
    controllerLayout: { type: 'custom', id: 'soccer-tv' }
  },
  {
    id: 'volleyball',
    icon: '🏖️',
    description: 'Beach volley a squadre: chi arriva a 5 punti vince.',
    name: 'PALLAVOLO DEI DISAGIATI',
    category: 'SPORT',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // Beach volley 3D a squadre: intro + countdown + match primo a 5 punti.
    // 120s di margine per una partita completa; il timer server è solo la rete
    // di sicurezza.
    durationSec: 120,
    compatibleModifiers: ['gravita_bassa', 'punti_doppi'],
    sceneKey: 'volleyball',
    // Controller dedicato: joystick + SALTA + COLPISCI + ABILITÀ (renderVolleyballController()).
    controllerLayout: { type: 'custom', id: 'volleyball-tv' }
  },
  {
    id: 'kart3d',
    icon: '🏎️',
    description: 'Corri sul circuito e taglia il traguardo per primo.',
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
  },
  {
    id: 'cultura',
    icon: '🎭',
    description: 'Inventa bugie credibili e smaschera quelle degli altri.',
    name: 'CULTURA O CAZZATA?',
    category: 'CULTURA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // Bluff culturale a round (8 default): domanda → bluff telefono → voto →
    // reveal → spiegazione. 300s lasciano margine; il timer server è solo la
    // rete di sicurezza.
    durationSec: 300,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'cultura',
    // Controller dedicato: scrivi bluff / vota (renderCulturaController()).
    controllerLayout: { type: 'custom', id: 'cultura-tv' }
  },
  {
    id: 'fps',
    icon: '🔫',
    description: 'Tutti contro tutti in prima persona. Più kill, più punti.',
    name: 'SPARATORIA DEI DISAGIATI',
    category: 'ARENA',
    rarity: 'rare',
    minPlayers: 1,
    maxPlayers: 5,
    // FPS free-for-all: ogni telefono renderizza la propria visuale, il PC è
    // radar/regia. 100s di match; il timer server è solo la rete di sicurezza.
    durationSec: 100,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'fps',
    // Controller dedicato: joystick + look touch + SPARA + DASH + ABILITÀ (renderFpsController()).
    controllerLayout: { type: 'custom', id: 'fps-tv' }
  }
];

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((m) => m.id === id);
}
