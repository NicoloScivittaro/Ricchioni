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
// INPUT: GAMEPAD = si gioca col controller (telefono sul tavolo); PHONE_TEXT = serve il telefono; GAMEPAD_OR_PHONE = telefono come sempre.
// Quiz e Cultura si giocano sul telefono; gli altri giochi GAMEPAD hanno il profilo in src/input/profiles.ts (lo verifica pad-selftest).
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
    // Rete di sicurezza server (10 domande: timer 12-25s + reveal/spiegazione + 3 classifiche = circa 285s al massimo, piu bonus tempo abilita).
    hardCapSec: 480,
    // "tempo_dimezzato" non è più compatibile: dimezzerebbe anche la rete di
    // sicurezza server-side (durationSec), rischiando di troncare un quiz che
    // segue comunque i suoi timer per-domanda fissi (non letti dal modificatore).
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'quiz',

    inputMode: 'PHONE_TEXT',
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
    // Rete di sicurezza server (5 round = circa 72s al massimo).
    hardCapSec: 180,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'reaction',

    inputMode: 'GAMEPAD',
    controllerLayout: {
      type: 'buttons',
      grid: 1,
      controls: [
        { id: 'action', label: 'ASPETTA...', kind: 'button', icon: '⚡' },
        { id: 'ability', label: 'ABILITÀ', kind: 'button', icon: '⭐' }
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
    // Rete di sicurezza server (5 round: osserva+ripeti = circa 100s al massimo, anche con un solo superstite).
    hardCapSec: 240,
    // "tempo_dimezzato" non si applica: il gioco segue i suoi timer per-round
    // (osserva/ripeti) e non legge il modificatore.
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'memory',

    inputMode: 'GAMEPAD',
    // UI dedicata (2x2 tile grandi + abilità) sul telefono: vedi renderMemoryController().
    controllerLayout: { type: 'custom', id: 'memory-tv' }
  },
  {
    id: 'arena',
    icon: '🤼',
    description: "Tocca per spingere, tieni e rilascia per la spallata. Sbilancia i rivali, ma attento allo slancio vicino al bordo!",
    name: 'ARENA DEL DISAGIO',
    category: 'ARENA',
    rarity: 'uncommon',
    minPlayers: 1,
    maxPlayers: 5,
    // Sumo/brawl 3D: countdown + round a eliminazione + eventuale restringimento
    // dell'arena. 45s danno tempo alle eliminazioni; il timer server è solo la
    // rete di sicurezza.
    durationSec: 45,
    // Include sudden death senza vittorie a tempo. Il cap tecnico salta il gioco senza punti se il client si blocca.
    hardCapSec: 300,
    compatibleModifiers: ['controlli_invertiti', 'gravita_bassa', 'punti_doppi'],
    sceneKey: 'arena',

    inputMode: 'GAMEPAD',
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
    // Rete di sicurezza server (countdown + partita (cap durationSec) + festeggiamenti).
    hardCapSec: 240,
    compatibleModifiers: ['controlli_invertiti', 'gravita_bassa', 'punti_doppi'],
    sceneKey: 'dodgeball',

    inputMode: 'GAMEPAD',
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
    // Rete di sicurezza server (60s di partita + golden goal 15s + pause dopo ogni gol).
    hardCapSec: 360,
    compatibleModifiers: ['punti_doppi', 'gravita_bassa'],
    sceneKey: 'soccer',

    inputMode: 'GAMEPAD',
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
    // Rete di sicurezza server (primo a 5 punti: nessun cap di tempo in gioco, scambi lunghi).
    hardCapSec: 720,
    compatibleModifiers: ['gravita_bassa', 'punti_doppi'],
    sceneKey: 'volleyball',

    inputMode: 'GAMEPAD',
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
    // Limite di tempo della GARA (3 giri): con i kart più lenti (vmax 44) serve più margine di 130s.
    durationSec: 170,
    // Rete di sicurezza server (gara con limite di tempo durationSec + countdown/arrivo).
    hardCapSec: 480,
    compatibleModifiers: ['controlli_invertiti', 'punti_doppi'],
    sceneKey: 'kart3d',

    inputMode: 'GAMEPAD',
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
    // Rete di sicurezza server (8 round x circa 60s (bluff 22 + voto 14 + reveal circa 10 + spiegazione 7) + 3 classifiche = circa 490s).
    hardCapSec: 900,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'cultura',

    inputMode: 'PHONE_TEXT',
    // Controller dedicato: scrivi bluff / vota (renderCulturaController()).
    controllerLayout: { type: 'custom', id: 'cultura-tv' }
  },
  {
    id: 'fps',
    icon: '🔫',
    description: 'Tutti contro tutti: mira per la precisione, spara al volo da vicino. Più kill, più punti.',
    name: 'SPARATORIA DEI DISAGIATI',
    category: 'ARENA',
    rarity: 'rare',
    minPlayers: 1,
    maxPlayers: 5,
    // FPS free-for-all: chi ha il controller gioca in split-screen sul PC (Milestone 6); chi non ce l'ha continua
    // dal telefono ESATTAMENTE come prima (rendering 3D privato sul telefono, invariato). 100s di match; il timer
    // server è solo la rete di sicurezza.
    durationSec: 100,
    // Rete di sicurezza server (match di 100s + countdown/risultati).
    hardCapSec: 300,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'fps',

    inputMode: 'GAMEPAD',
    // Controller dedicato: joystick + look touch + MIRA (tenuto) + SPARA + DASH + ABILITÀ (renderFpsController()) — usato da chi
    // NON ha un controller fisico (fallback, badge automatico: vedi src/input/profiles.ts per il profilo pad).
    controllerLayout: { type: 'custom', id: 'fps-tv' }
  },
  {
    id: 'cornicione',
    icon: '🧱',
    description: 'Picchia, schiva e rientra: più danno hai, più voli lontano. Fuori dal tetto = una vita in meno.',
    name: 'BOTTE SUL CORNICIONE',
    category: 'SKILL',
    rarity: 'uncommon',
    minPlayers: 2,
    maxPlayers: 5,
    // Platform fighter 2.5D a vite (3) e percentuale di danno: 150 s di limite + eventuale spareggio rapido (20 s).
    durationSec: 150,
    // Rete di sicurezza server (countdown + 150 s + spareggio 20 s + festeggiamenti). Larga: su un PC lento il tempo di gioco scorre piu' piano dell'orologio.
    hardCapSec: 420,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'cornicione',

    inputMode: 'GAMEPAD',
    // Chi NON ha il controller gioca con la croce + tasti sul telefono (layout generico); col controller il telefono mostra la Companion Card.
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' },
        { id: 'jump', label: 'SALTO', kind: 'hold', icon: '🦘' },
        { id: 'light', label: 'LEGGERO', kind: 'button', icon: '👊' },
        { id: 'heavy', label: 'PESANTE', kind: 'button', icon: '💥' },
        { id: 'dodge', label: 'SCHIVA', kind: 'button', icon: '💨' },
        { id: 'kick', label: 'CALCIO', kind: 'button', icon: '🦶' },
        { id: 'throw', label: 'LANCIO (TIENI)', kind: 'hold', icon: '🎯' },
        { id: 'parry', label: 'PARATA', kind: 'button', icon: '🛡️' },
        { id: 'ability', label: 'ABILITÀ', kind: 'button', icon: '⭐' }
      ]
    }
  },
  {
    id: 'casacarbo',
    icon: '🌧️',
    description: "Il temporale allaga casa di Carbo: tiracqua, secchi e scarichi. Asciugate almeno il 75% e dimostrate chi ha lavorato di più.",
    name: 'CASA CARBO',
    category: 'SKILL',
    rarity: 'uncommon',
    minPlayers: 2,
    maxPlayers: 5,
    // 120 s di temporale + scena finale col vicino (~6,5 s).
    durationSec: 120,
    // Rete di sicurezza server (countdown + 120 s + finale + margine per un PC host lento).
    hardCapSec: 300,
    compatibleModifiers: ['punti_doppi'],
    sceneKey: 'casacarbo',

    inputMode: 'GAMEPAD',
    // Chi NON ha il controller usa croce + tasti sul telefono (layout generico); col controller il telefono mostra la Companion Card.
    controllerLayout: {
      type: 'dpad',
      controls: [
        { id: 'up', label: '▲', kind: 'hold' },
        { id: 'down', label: '▼', kind: 'hold' },
        { id: 'left', label: '◀', kind: 'hold' },
        { id: 'right', label: '▶', kind: 'hold' },
        { id: 'squeegee', label: 'TIRACQUA', kind: 'hold', icon: '🧹' },
        { id: 'bucket', label: 'SECCHIO', kind: 'hold', icon: '🪣' },
        { id: 'dash', label: 'SCATTO', kind: 'button', icon: '💨' },
        { id: 'interact', label: 'INTERAGISCI', kind: 'hold', icon: '✋' },
        { id: 'ability', label: 'ABILITÀ', kind: 'button', icon: '⭐' }
      ]
    }
  },
  {
    id:'minigolf',icon:'⛳',name:'MINIGOLF DEI DISAGIATI',
    description:'Tre buche, tutti insieme. Mira, dosa la forza e boccia gli amici: vince chi usa meno colpi.',
    category:'SPORT',rarity:'uncommon',minPlayers:2,maxPlayers:5,durationSec:180,hardCapSec:360,
    compatibleModifiers:['punti_doppi'],sceneKey:'minigolf',inputMode:'GAMEPAD',
    controllerLayout:{type:'custom',id:'minigolf-tv'}
  }
];

/** Rete di sicurezza server per un minigioco, in secondi (mai sotto durationSec + 20s). */
export function safetyCapSec(def: MinigameDefinition, durationSec: number = def.durationSec): number {
  return Math.max(def.hardCapSec ?? 0, durationSec + 20);
}

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((m) => m.id === id);
}
