import { HOOKS } from './hooks';
import type { CharacterDefinition } from './types';

export const CHARACTERS: Record<string, CharacterDefinition> = {
  goblin: {
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
    passive: { name: "L'HO FATTO IO 'STO GIOCO", description: 'Occasionalmente ha informazioni o possibilità che gli altri non hanno.' },
    weakness: { name: 'ROLLBACK ISTINTIVO', description: 'Più perde lucidità, più le sue abilità diventano potenti ma imprevedibili.' },
    abilityName: 'EXPLOIT',
    abilityDescription: 'Vantaggio contestuale: elimina una risposta, rivela un ostacolo, congela lo schermo o fa un reroll.',
    hooks: {
      CULTURA: [HOOKS.quiz_remove_answer],
      MEMORIA: [HOOKS.memory_freeze],
      GUIDA: [HOOKS.race_reveal_obstacle],
      FORTUNA: [HOOKS.luck_reroll],
      PUZZLE: [HOOKS.puzzle_one_hint]
    },
    defaultHooks: [HOOKS.luck_reroll]
  },
  buttafuori: {
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
    passive: { name: 'ASPETTA, FAMME CAPÌ', description: 'Se un minigioco si ripete in partita, ottiene un piccolo vantaggio.' },
    weakness: { name: 'TROPPA ONESTÀ', description: 'Non sa imbrogliare: gioca sempre pulito.' },
    abilityName: "MO M'IMPEGNO",
    abilityDescription: 'Per pochi secondi: più stabilità, migliore recupero, precisione o resistenza.',
    hooks: {
      GUIDA: [HOOKS.race_quick_recover],
      ARENA: [HOOKS.arena_knockback_resist],
      SKILL: [HOOKS.timing_stability],
      RIFLESSI: [HOOKS.timing_stability],
      SPORT: [HOOKS.timing_stability]
    },
    defaultHooks: []
  },
  dottore: {
    id: 'dottore',
    name: 'Victor',
    roleTitle: 'IL DOTTORE SCEMO',
    subtitle: 'Tranquilli, So Quello Che Faccio | 5ml di Idee Brillanti(?)',
    avatar: '🧪',
    image: '/characters/victor.jpg',
    color: '#06b6d4',
    quote: 'Tranquilli, so quello che faccio. Diagnosi: forse tutto bene, o forse ripensiamoci domani.',
    resourceName: 'Provette Sperimentali',
    resourceMax: 5,
    initialResource: 3,
    passive: { name: 'TRANQUILLI, SO QUELLO CHE FACCIO', description: 'Potenziamento con bonus ed effetto collaterale.' },
    weakness: { name: 'LAUREA SU TELEGRAM', description: "Nelle scelte logiche sceglie l'opzione peggiore con convinzione cieca." },
    abilityName: 'PLACEBO MICIDIALE',
    abilityDescription: 'Un trattamento a effetto parzialmente sconosciuto.',
    hooks: {
      PUZZLE: [HOOKS.puzzle_one_hint],
      FORTUNA: [HOOKS.luck_reroll],
      MEMORIA: [HOOKS.memory_replay]
    },
    defaultHooks: [HOOKS.generic_undo_one_error]
  },
  judoka: {
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
    passive: { name: 'NO, ASPETTA!', description: 'Può contestare/ripetere qualcosa consumando Granita.' },
    weakness: { name: "CRISI D'ASTINENZA DA GRANITA", description: 'A Granita zero subisce "Brain Freeze".' },
    abilityName: 'CASA MIA, REGOLE MIE',
    abilityDescription: 'Contesta o modifica una piccola regola: aiuto culturale o contrattacco.',
    hooks: {
      CULTURA: [HOOKS.quiz_extra_time],
      ARENA: [HOOKS.arena_recover_grab],
      SPORT: [HOOKS.arena_knockback_resist]
    },
    defaultHooks: [HOOKS.generic_undo_one_error]
  },
  ciro: {
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
    passive: { name: 'NON TE LI DO', description: 'Piccole meccaniche di risparmio/recupero sulle penalità.' },
    weakness: { name: 'I DUE CAPELLI DEL DESTINO', description: 'I 2 capelli sono consumabili e non tornano.' },
    abilityName: 'È TUTTO REGOLARE',
    abilityDescription: 'Scommette prima del minigioco o spende un capello per un reroll.',
    hooks: {
      FORTUNA: [HOOKS.luck_reroll],
      SOCIALE: [HOOKS.luck_reroll]
    },
    defaultHooks: [HOOKS.generic_undo_one_error]
  }
};

export const CHARACTER_ORDER: string[] = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'];

export function getCharacter(id: string): CharacterDefinition {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`Personaggio sconosciuto: ${id}`);
  return c;
}
