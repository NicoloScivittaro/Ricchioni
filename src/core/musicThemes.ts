/**
 * TEMI MUSICALI PROCEDURALI (solo dati + funzioni pure: testabili senza browser, vedi scripts/audio-selftest.ts).
 * Niente brani esterni: ogni tema e' tempo + scala + progressione + pattern di batteria/basso + motivo, suonati da
 * core/music.ts con sintetizzatori WebAudio. Ogni minigioco ha la SUA identita' (tempo, modo, groove, timbri), ma tutti
 * usano gli stessi strumenti e lo stesso arrangiamento: suonano come parti dello stesso party game.
 *
 * ARRANGIAMENTO (16 battute, poi ricomincia): 1-4 base · 5-8 + motivo · 9-12 variazione ritmica + contromelodia ·
 * 13-16 motivo variato + rullata a fine giro. Il loop vero dura 16 battute (30-40 s), non 3 secondi.
 * LIVELLI: 0 = sotto (schermata CONTROLLI, intro: solo pad e basso), 1 = normale, 2 = finale (ultimi secondi, match point,
 * ultimo round: hi-hat fitti, motivo all'ottava, percussioni in piu'). Il livello non tocca MAI tempi o regole del gioco.
 */

export type ThemeId =
  | 'lobby'
  | 'roulette'
  | 'arena'
  | 'dodgeball'
  | 'soccer'
  | 'volleyball'
  | 'kart3d'
  | 'cornicione'
  | 'casacarbo'
  | 'minigolf'
  | 'fps'
  | 'memory'
  | 'reaction'
  | 'quiz'
  | 'cultura'
  | 'results'
  | 'podium';

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface Theme {
  id: ThemeId;
  bpm: number;
  /** 0 = dritto, 0.15-0.3 = swing (le semicrome pari arrivano in ritardo) */
  swing: number;
  /** nota MIDI della tonica */
  root: number;
  /** intervalli della scala (semitoni) */
  scale: number[];
  /** grado della scala per ciascuna delle 8 battute (si ripete 2 volte nelle 16) */
  progression: number[];
  /** pattern di 16 semicrome: x = colpo, o = colpo leggero, . = silenzio */
  kick: string;
  snare: string;
  hat: string;
  /** variazione ritmica delle battute 9-12 */
  kickB: string;
  /** percussione caratteristica del gioco (tom, clap, shaker, rimshot...) e il suo pattern */
  perc: { kind: 'tom' | 'clap' | 'shaker' | 'rim' | 'brush' | 'stomp'; pattern: string };
  /** basso: 1 tonica, 5 quinta, 8 ottava, 3 terza, . pausa */
  bass: { pattern: string; wave: Wave; octave: number };
  /** accordi: timbro e ritmo (pad = lungo una battuta, stab = colpi sugli step indicati) */
  chords: { wave: Wave; style: 'pad' | 'stab'; stabs?: string; octave: number };
  /** motivo: 16 step x 2 battute, gradi della scala (null = pausa) */
  motif: (number | null)[];
  lead: { wave: Wave; octave: number };
  /** volume generale del tema (alcuni giochi hanno motori/effetti forti: Kart e Sparatoria piu' bassi) */
  gain: number;
  /** niente melodia (Memoria: le note delle tessere sono gameplay e non vanno mascherate) */
  noMelody?: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

const _ = null;

export const THEMES: Record<ThemeId, Theme> = {
  minigolf:{id:'minigolf',bpm:110,swing:.16,root:55,scale:MIXO,progression:[0,3,4,0,0,3,5,4],
    kick:'x.......x.......',snare:'....x.......x...',hat:'..o...o...o...o.',kickB:'x.......x.x.....',
    perc:{kind:'rim',pattern:'..x...x...x...x.'},bass:{pattern:'1...5...1...8...',wave:'triangle',octave:-2},
    chords:{wave:'sine',style:'stab',stabs:'x.......x.......',octave:0},
    motif:[0,_,2,4,_,2,_,0,_,_,4,_,5,4,_,_,0,_,3,_,4,_,7,_,5,_,4,_,2,_,0,_],lead:{wave:'triangle',octave:1},gain:.55},
  // menu: rilassato, maggiore, poco ritmo
  lobby: {
    id: 'lobby', bpm: 98, swing: 0.12, root: 60, scale: MAJOR, progression: [0, 5, 3, 4, 0, 5, 1, 4],
    kick: 'x.......x.......', snare: '........x.......', hat: '..o...o...o...o.', kickB: 'x.....x.x.......',
    perc: { kind: 'shaker', pattern: 'o.o.o.o.o.o.o.o.' },
    bass: { pattern: '1.......5...8...', wave: 'sine', octave: -2 },
    chords: { wave: 'triangle', style: 'pad', octave: 0 },
    motif: [4, _, _, 2, _, _, 4, _, 5, _, 4, _, 2, _, _, _, 0, _, _, 2, _, _, 1, _, 0, _, _, _, _, _, _, _],
    lead: { wave: 'sine', octave: 1 }, gain: 0.8
  },
  // rullo: tensione che cresce, minore, cassa dritta
  roulette: {
    id: 'roulette', bpm: 128, swing: 0, root: 57, scale: MINOR, progression: [0, 0, 5, 5, 3, 3, 4, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', kickB: 'x...x...x...x.x.',
    perc: { kind: 'clap', pattern: '....x.......x...' },
    bass: { pattern: '1.1.1.1.1.1.8.1.', wave: 'sawtooth', octave: -2 },
    chords: { wave: 'square', style: 'stab', stabs: '..x...x...x...x.', octave: 0 },
    motif: [0, _, 2, _, 4, _, 7, _, 6, _, 4, _, 2, _, 4, _, 0, _, 2, _, 4, _, 7, _, 9, _, 7, _, 6, _, 4, _],
    lead: { wave: 'square', octave: 1 }, gain: 0.75
  },
  // ARENA: brawler da stadio, frigio scuro, tamburi tribali
  arena: {
    id: 'arena', bpm: 116, swing: 0, root: 45, scale: PHRYGIAN, progression: [0, 0, 1, 0, 6, 5, 1, 0],
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', kickB: 'x.xx..x.x..x.xx.',
    perc: { kind: 'tom', pattern: '..........x.x.xx' },
    bass: { pattern: '1..1..1.1..8..5.', wave: 'sawtooth', octave: -1 },
    chords: { wave: 'sawtooth', style: 'stab', stabs: 'x.....x...x.....', octave: 0 },
    motif: [7, _, _, 7, _, 8, 7, _, 5, _, _, 4, _, _, 3, _, 7, _, _, 7, _, 8, 10, _, 8, _, 7, _, 5, _, _, _],
    lead: { wave: 'sawtooth', octave: 1 }, gain: 0.85
  },
  // DODGEBALL: sport arcade rapido, misolidio, hi-hat a sedicesimi
  dodgeball: {
    id: 'dodgeball', bpm: 142, swing: 0, root: 50, scale: MIXO, progression: [0, 0, 6, 6, 3, 3, 4, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', kickB: 'x..xx...x..xx...',
    perc: { kind: 'rim', pattern: '..x...x...x..x..' },
    bass: { pattern: '1.8.1.8.1.8.5.8.', wave: 'square', octave: -2 },
    chords: { wave: 'square', style: 'stab', stabs: '..x...x...x...x.', octave: 0 },
    motif: [0, 2, 4, _, 4, _, 7, _, 6, 4, 2, _, 4, _, _, _, 0, 2, 4, _, 7, _, 9, _, 8, 7, 6, _, 4, _, _, _],
    lead: { wave: 'square', octave: 1 }, gain: 0.75
  },
  // CALCIO: campetto/stadio, maggiore, stomp-clap, coro "oh oh"
  soccer: {
    id: 'soccer', bpm: 124, swing: 0, root: 53, scale: MAJOR, progression: [0, 3, 4, 0, 0, 3, 4, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..o...o...o...o.', kickB: 'x...x...x.x.x...',
    perc: { kind: 'stomp', pattern: 'x.x...x.x.x...x.' },
    bass: { pattern: '1...5...1...5...', wave: 'triangle', octave: -2 },
    chords: { wave: 'triangle', style: 'stab', stabs: 'x.......x.......', octave: 0 },
    motif: [4, _, _, 4, _, _, 4, _, 5, _, 4, _, 2, _, _, _, 2, _, _, 2, _, _, 2, _, 4, _, 2, _, 0, _, _, _],
    lead: { wave: 'triangle', octave: 1 }, gain: 0.7
  },
  // PALLAVOLO: spiaggia/estate, maggiore pentatonico, groove "dembow", marimba
  volleyball: {
    id: 'volleyball', bpm: 104, swing: 0, root: 55, scale: MAJOR, progression: [0, 4, 5, 3, 0, 4, 3, 4],
    kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'o.o.o.o.o.o.o.o.', kickB: 'x..xx...x..xx...',
    perc: { kind: 'shaker', pattern: 'xoxoxoxoxoxoxoxo' },
    bass: { pattern: '1..1..5.1..1..5.', wave: 'sine', octave: -2 },
    chords: { wave: 'triangle', style: 'stab', stabs: '..x..x....x..x..', octave: 0 },
    motif: [4, _, 2, _, 4, _, 7, _, 4, _, 2, _, 0, _, _, _, 2, _, 4, _, 5, _, 4, _, 2, _, 0, _, 4, _, _, _],
    lead: { wave: 'sine', octave: 2 }, gain: 0.75
  },
  // KART: rock da guida, misolidio, ottavi di basso; basso volume (i motori sono gia' tanti)
  kart3d: {
    id: 'kart3d', bpm: 150, swing: 0, root: 52, scale: MIXO, progression: [0, 0, 6, 3, 0, 0, 6, 4],
    kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', kickB: 'x.x.x.xxx.x.x.xx',
    perc: { kind: 'clap', pattern: '....x.......x..x' },
    bass: { pattern: '1.1.1.1.5.5.6.6.', wave: 'sawtooth', octave: -2 },
    chords: { wave: 'sawtooth', style: 'stab', stabs: 'x..x..x.........', octave: 0 },
    motif: [0, _, 4, _, 7, _, 4, _, 9, _, 7, _, 4, _, _, _, 0, _, 4, _, 7, _, 11, _, 9, _, 7, _, 6, _, _, _],
    lead: { wave: 'sawtooth', octave: 1 }, gain: 0.5
  },
  // BOTTE SUL CORNICIONE: tetto al tramonto, dorico funky e nervoso (platform fighter: ritmo spezzato, basso a ottavi, stab di chitarra sintetica)
  cornicione: {
    id: 'cornicione', bpm: 138, swing: 0.08, root: 50, scale: DORIAN, progression: [0, 0, 3, 3, 4, 4, 3, 5],
    kick: 'x..x..x...x.x...', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.xx', kickB: 'x..x.xx...x.x.x.',
    perc: { kind: 'rim', pattern: '..x..x..x..x..x.' },
    bass: { pattern: '1.1.8.1.1.1.8.5.', wave: 'sawtooth', octave: -2 },
    chords: { wave: 'square', style: 'stab', stabs: 'x..x..x...x..x..', octave: 0 },
    motif: [0, _, 2, _, 4, _, 7, _, 6, _, 4, _, 2, _, _, _, 0, _, 3, _, 4, _, 7, _, 9, _, 7, _, 4, _, _, _],
    lead: { wave: 'square', octave: 1 }, gain: 0.7
  },
  // CASA CARBO: temporale in casa, minore con un passo da comica (pizzicato), basso che "sgocciola"
  casacarbo: {
    id: 'casacarbo', bpm: 118, swing: 0.12, root: 45, scale: MINOR, progression: [0, 0, 5, 5, 3, 3, 4, 4],
    kick: 'x...x..x..x.x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', kickB: 'x...x..xx.x.x...',
    perc: { kind: 'shaker', pattern: 'xoxoxoxoxoxoxoxo' },
    bass: { pattern: '1.5.1.5.1.5.8.5.', wave: 'triangle', octave: -2 },
    chords: { wave: 'triangle', style: 'stab', stabs: '..x...x...x...x.', octave: 0 },
    motif: [0, _, 2, _, 3, _, 5, _, 3, _, 2, _, 0, _, _, _, 7, _, 5, _, 3, _, 2, _, 3, _, 2, _, 0, _, _, _],
    lead: { wave: 'triangle', octave: 1 }, gain: 0.7
  },
  // SPARATORIA: synth scuro, minore armonico, basso pulsante; basso volume (le armi vengono prima)
  fps: {
    id: 'fps', bpm: 132, swing: 0, root: 50, scale: HARMONIC, progression: [0, 0, 5, 5, 3, 3, 4, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', kickB: 'x...x..xx...x...',
    perc: { kind: 'rim', pattern: '.x...x...x...x..' },
    bass: { pattern: '1111111111115555', wave: 'sawtooth', octave: -2 },
    chords: { wave: 'square', style: 'pad', octave: 0 },
    motif: [0, _, _, 2, _, _, 4, _, 6, _, _, 4, _, 2, _, _, 0, _, _, 2, _, _, 4, _, 7, _, 6, _, 4, _, _, _],
    lead: { wave: 'square', octave: 1 }, gain: 0.5
  },
  // MEMORIA: misterioso e quasi fermo, SENZA melodia (le note delle tessere sono il gioco)
  memory: {
    id: 'memory', bpm: 84, swing: 0, root: 38, scale: DORIAN, progression: [0, 0, 3, 3, 5, 5, 4, 4],
    kick: 'x...............', snare: '................', hat: '....o.......o...', kickB: 'x.......x.......',
    perc: { kind: 'brush', pattern: 'o...o...o...o...' },
    bass: { pattern: '1...............', wave: 'sine', octave: -1 },
    chords: { wave: 'sine', style: 'pad', octave: -1 },
    motif: new Array(32).fill(null), lead: { wave: 'sine', octave: 0 }, gain: 0.45, noMelody: true
  },
  // BOTTA AL VOLO: pulsazione tesa e COSTANTE (nessun cambio legato al VIA: la musica non deve dare indizi)
  reaction: {
    id: 'reaction', bpm: 100, swing: 0, root: 41, scale: MINOR, progression: [0, 0, 0, 0, 5, 5, 4, 4],
    kick: 'x.......x.......', snare: '................', hat: 'x.x.x.x.x.x.x.x.', kickB: 'x.......x.......',
    perc: { kind: 'rim', pattern: '................' },
    bass: { pattern: '1.......1.......', wave: 'sine', octave: -1 },
    chords: { wave: 'sine', style: 'pad', octave: -1 },
    motif: new Array(32).fill(null), lead: { wave: 'sine', octave: 0 }, gain: 0.45, noMelody: true
  },
  // QUIZ: game show, maggiore brillante, fiati a colpi
  quiz: {
    id: 'quiz', bpm: 120, swing: 0.1, root: 58, scale: MAJOR, progression: [0, 5, 1, 4, 0, 5, 1, 4],
    kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.', kickB: 'x.....x.x.x.....',
    perc: { kind: 'shaker', pattern: 'xoxoxoxoxoxoxoxo' },
    bass: { pattern: '1...3...5...3...', wave: 'square', octave: -2 },
    chords: { wave: 'square', style: 'stab', stabs: '..x...x...x...x.', octave: 0 },
    motif: [4, _, 4, 5, 4, _, 2, _, 0, _, 2, _, 4, _, _, _, 5, _, 5, 7, 5, _, 4, _, 2, _, 4, _, 5, _, _, _],
    lead: { wave: 'triangle', octave: 1 }, gain: 0.6
  },
  // CULTURA O CAZZATA: bar jazzato, dorico in swing, basso camminato, spazzole: diverso dal Quiz
  cultura: {
    id: 'cultura', bpm: 92, swing: 0.28, root: 50, scale: DORIAN, progression: [0, 3, 6, 2, 0, 3, 4, 4],
    kick: 'x.......x.......', snare: '....o.......o...', hat: 'x..ox..ox..ox..o', kickB: 'x.....x.x.......',
    perc: { kind: 'brush', pattern: 'o.o.o.o.o.o.o.o.' },
    bass: { pattern: '1...3...5...6...', wave: 'triangle', octave: -2 },
    chords: { wave: 'sine', style: 'stab', stabs: '...x......x.....', octave: 0 },
    motif: [4, _, _, 6, _, 7, _, _, 6, _, 4, _, 2, _, _, _, 2, _, _, 4, _, 6, _, _, 7, _, 6, _, 4, _, _, _],
    lead: { wave: 'triangle', octave: 1 }, gain: 0.55
  },
  // risultati: leggero, maggiore
  results: {
    id: 'results', bpm: 108, swing: 0.05, root: 60, scale: MAJOR, progression: [0, 3, 4, 0, 5, 3, 4, 4],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..o...o...o...o.', kickB: 'x.....x.x.......',
    perc: { kind: 'shaker', pattern: 'o.o.o.o.o.o.o.o.' },
    bass: { pattern: '1.......5.......', wave: 'triangle', octave: -2 },
    chords: { wave: 'triangle', style: 'pad', octave: 0 },
    motif: [0, _, 2, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, _, _, 5, _, 4, _, 2, _, _, _],
    lead: { wave: 'triangle', octave: 1 }, gain: 0.55
  },
  // podio finale: trionfale, fiati pieni
  podium: {
    id: 'podium', bpm: 112, swing: 0, root: 60, scale: MAJOR, progression: [0, 4, 5, 3, 0, 4, 3, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', kickB: 'x...x...x.x.x...',
    perc: { kind: 'tom', pattern: '............x.xx' },
    bass: { pattern: '1...1...5...5...', wave: 'sawtooth', octave: -2 },
    chords: { wave: 'sawtooth', style: 'pad', octave: 0 },
    motif: [0, _, 4, _, 7, _, _, 7, 9, _, 7, _, 4, _, _, _, 5, _, 4, _, 2, _, 4, _, 7, _, _, _, _, _, _, _],
    lead: { wave: 'triangle', octave: 1 }, gain: 0.7
  }
};

/** Tema di un minigioco (id del registry); i giochi senza tema dedicato usano quello dei risultati. */
export function themeForGame(gameId: string | null | undefined): ThemeId {
  return gameId && gameId in THEMES ? (gameId as ThemeId) : 'results';
}

/** Nota MIDI del grado `deg` della scala del tema, nell'ottava `octave` (0 = quella della tonica). */
export function degreeToMidi(theme: Theme, deg: number, octave = 0): number {
  const n = theme.scale.length;
  const o = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return theme.root + theme.scale[i] + 12 * (o + octave);
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Cosa suona in uno step (battuta 0..15 del giro, step 0..15 della battuta, livello 0..2): pura, per lo scheduler e i test. */
export interface StepEvents {
  kick: boolean;
  snare: boolean;
  hat: 0 | 1 | 2; // 0 niente, 1 leggero, 2 pieno
  perc: boolean;
  bass: number | null; // nota MIDI
  chord: number[] | null; // note MIDI (attacco)
  lead: number | null;
  fill: boolean;
}

export function stepEvents(theme: Theme, bar: number, step: number, level: 0 | 1 | 2): StepEvents {
  const b = ((bar % 16) + 16) % 16;
  const ch = (pat: string): string => pat[step] ?? '.';
  const kickPat = b >= 8 && b < 12 ? theme.kickB : theme.kick;
  const last = b === 15 && step >= 12; // rullata a fine giro
  const drums = level >= 1;
  const deg = theme.progression[b % 8];
  const bassCh = ch(theme.bass.pattern);
  const bassDeg = bassCh === '1' ? deg : bassCh === '5' ? deg + 4 : bassCh === '8' ? deg + 7 : bassCh === '3' ? deg + 2 : bassCh === '6' ? deg + 5 : null;
  let chord: number[] | null = null;
  if (theme.chords.style === 'pad' ? step === 0 : ch(theme.chords.stabs ?? '') === 'x' && level >= 1) {
    chord = [deg, deg + 2, deg + 4].map((d) => degreeToMidi(theme, d, theme.chords.octave));
  }
  // motivo: battute 5-8 e 13-16 (variato all'ottava sopra nel secondo giro a livello 2)
  let lead: number | null = null;
  if (!theme.noMelody && level >= 1 && ((b >= 4 && b < 8) || b >= 12)) {
    const m = theme.motif[(b % 2) * 16 + step];
    if (m !== null && m !== undefined) lead = degreeToMidi(theme, m + (b >= 12 && b % 4 === 3 ? 2 : 0), theme.lead.octave + (level >= 2 ? 1 : 0));
  }
  // contromelodia (battute 9-12): arpeggio sparso dell'accordo
  if (!theme.noMelody && level >= 1 && b >= 8 && b < 12 && step % 4 === 2) lead = degreeToMidi(theme, deg + [0, 2, 4, 7][(step >> 2) % 4], theme.lead.octave);
  const hatCh = ch(theme.hat);
  return {
    kick: drums && (ch(kickPat) === 'x' || ch(kickPat) === 'o'),
    snare: drums && (ch(theme.snare) !== '.' || (last && step % 2 === 0)),
    hat: !drums ? 0 : level >= 2 ? (hatCh === '.' ? 1 : 2) : hatCh === 'x' ? 2 : hatCh === 'o' ? 1 : 0,
    perc: (drums || theme.perc.kind === 'brush') && ch(theme.perc.pattern) !== '.' && (level >= 2 || b % 2 === 1 || theme.perc.kind === 'brush' || theme.perc.kind === 'shaker'),
    bass: bassDeg === null ? null : degreeToMidi(theme, bassDeg, theme.bass.octave),
    chord,
    lead,
    fill: last
  };
}
