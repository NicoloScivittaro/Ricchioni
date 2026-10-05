import { CHARACTERS, CHARACTER_ORDER } from './characters';

/**
 * CHARACTER DNA — solo PRESENTAZIONE. Qui c'e' come un personaggio si VEDE e si SENTE (silhouette, postura, andatura,
 * accessori, stili di vittoria/sconfitta/abilita', VFX, battute, alias del telecronista, ritratto). NIENTE gameplay:
 * velocita', hitbox, cooldown, danni e abilita' restano dove sono (minigiochi + shared/*Abilities.ts) e non leggono mai
 * questo file. Lo stesso DNA attraversa tutti i minigiochi: il modello 3D (src/minigames/characters), i risultati, il
 * podio, la lobby e il telefono leggono da qui.
 *
 * Le differenze di corpo sono SOLO del modello disegnato: il collider di ogni gioco resta identico per tutti.
 */

export type ReactionKind = 'hit' | 'bigHit' | 'ability' | 'elimination' | 'victory' | 'defeat';
export const REACTION_KINDS: ReactionKind[] = ['hit', 'bigHit', 'ability', 'elimination', 'victory', 'defeat'];

export type IdleStyle = 'impatient' | 'guard' | 'belt' | 'relaxed' | 'pockets';
export type VictoryStyle = 'football' | 'gotIt' | 'ippon' | 'toldYou' | 'dodgedPayment';
export type DefeatStyle = 'nculo' | 'confused' | 'protest' | 'shrug' | 'clause';
export type AbilityStyle = 'burst' | 'focus' | 'wait' | 'lightbulb' | 'timer';
export type HitStyle = 'flinch' | 'absorb' | 'stagger' | 'wobble' | 'dodge';

export type AccessoryId =
  | 'goblinEars'
  | 'curlyHair'
  | 'tankard'
  | 'wristband'
  | 'buzzCut'
  | 'shades'
  | 'earpiece'
  | 'boxingGloves'
  | 'longCoat'
  | 'giLapels'
  | 'beltEnds'
  | 'glasses'
  | 'shortHair'
  | 'granita'
  | 'hazardPlate'
  | 'messyHair'
  | 'roundGlasses'
  | 'cigarette'
  | 'dottBadge'
  | 'belly'
  | 'twoHairs'
  | 'beard'
  | 'goldChain'
  | 'coin';

export interface CharacterPresentation {
  id: string;
  /** nome del ruolo, per esteso (lobby, galleria) */
  displayName: string;
  /** nome corto per spazi piccoli (HUD, bolle) */
  shortName: string;
  /** come lo chiama il telecronista (raramente: vittorie, risultati) */
  announcerAlias: string;
  /** una riga di personalita' (lobby/telefono): rara, quindi deve colpire */
  tagline: string;
  /** colore principale (= colore del giocatore su TV/telefono/classifica) */
  accent: string;
  /** colore secondario (dettagli, VFX, bordi) */
  secondaryAccent: string;
  /** icona emoji (lobby, risultati, feed, notifiche) */
  icon: string;
  /** simbolo che compare sopra la testa quando usa l'abilita' */
  symbol: string;
  /** ritratto: file + ritaglio circolare della testa (pixel del file) */
  portrait: { image: string; cx: number; cy: number; r: number };
  /** pelle del modello 3D */
  skin: string;
  /** colore pantaloni/parti scure */
  dark: string;
  /** proporzioni del MODELLO (1 = base): mai del collider */
  body: { height: number; width: number; head: number; shoulders: number; stance: number; crouch: number; lean: number };
  /** andatura: frequenza passo, ampiezza oscillazione, rimbalzo, nervosismo, ancheggiamento */
  gait: { step: number; swing: number; bob: number; jitter: number; sway: number };
  /**
   * "Peso" delle pose: le articolazioni sono molle (rigidezza, smorzamento). Rigida e poco smorzata = scattante con un filo di
   * rimbalzo (Goblin, Ciro); morbida = lenta e convinta (Dottore); tanto smorzamento = pesante, niente rimbalzo (Buttafuori).
   */
  motion: { stiffness: number; damping: number };
  accessories: AccessoryId[];
  idleStyle: IdleStyle;
  victoryStyle: VictoryStyle;
  defeatStyle: DefeatStyle;
  abilityStyle: AbilityStyle;
  hitStyle: HitStyle;
  /** colore della scia (dash) e delle particelle dell'abilita' */
  trail: string;
  /** "sting" sonoro breve dell'abilita': semitoni rispetto a La 440 + forma d'onda (nessun file audio) */
  sting: { notes: number[]; wave: 'square' | 'triangle' | 'sawtooth' | 'sine' };
  barks: Record<ReactionKind, string[]>;
}

export const CHARACTER_PRESENTATION: Record<string, CharacterPresentation> = {
  goblin: {
    id: 'goblin',
    displayName: 'GOBLIN MBRIACONE',
    shortName: 'GOBLIN',
    announcerAlias: 'IL GOBLIN',
    tagline: 'Competitivo. Poco sobrio. Sempre convinto.',
    accent: '#10b981',
    secondaryAccent: '#a3e635',
    icon: '🧟‍♂️',
    symbol: '⚡',
    portrait: { image: '/characters/nicolo.jpg', cx: 252, cy: 100, r: 92 },
    skin: '#9cc45a',
    dark: '#4a3424',
    body: { height: 0.9, width: 0.86, head: 1.14, shoulders: 0.9, stance: 1, crouch: 0.04, lean: 0.2 },
    gait: { step: 1.35, swing: 1.15, bob: 1.2, jitter: 1, sway: 0 },
    motion: { stiffness: 420, damping: 24 },
    accessories: ['goblinEars', 'curlyHair', 'tankard', 'wristband'],
    idleStyle: 'impatient',
    victoryStyle: 'football',
    defeatStyle: 'nculo',
    abilityStyle: 'burst',
    hitStyle: 'flinch',
    trail: '#a3e635',
    sting: { notes: [7, 12, 19], wave: 'square' },
    barks: {
      hit: ['MA CHE È?'],
      bigHit: ["N'CULO!", 'MA CHE È?'],
      ability: ['ANNAMO.', "N'CULO!"],
      elimination: ['FACILE.', 'ANNAMO.'],
      victory: ['FACILE.', 'ANNAMO!', 'TROPPO FORTE.'],
      defeat: ["MA N'CULO...", 'MA CHE È?', 'RIGIOCHIAMO.']
    }
  },
  buttafuori: {
    id: 'buttafuori',
    displayName: 'IL BUTTAFUORI RIBALTATO',
    shortName: 'BUTTAFUORI',
    announcerAlias: 'IL BUTTAFUORI',
    tagline: "Prima non capisce. Poi so' cazzi.",
    accent: '#ef4444',
    secondaryAccent: '#111827',
    icon: '🥊',
    symbol: '💥',
    portrait: { image: '/characters/christian.jpg', cx: 216, cy: 138, r: 82 },
    skin: '#e8b896',
    dark: '#15151c',
    body: { height: 0.8, width: 1.32, head: 0.98, shoulders: 1.3, stance: 1.12, crouch: 0.06, lean: 0.06 },
    gait: { step: 0.82, swing: 0.75, bob: 1.5, jitter: 0, sway: 0.25 },
    motion: { stiffness: 170, damping: 26 },
    accessories: ['buzzCut', 'shades', 'earpiece', 'boxingGloves', 'longCoat'],
    idleStyle: 'guard',
    victoryStyle: 'gotIt',
    defeatStyle: 'confused',
    abilityStyle: 'focus',
    hitStyle: 'absorb',
    trail: '#f87171',
    sting: { notes: [-12, -5, 0], wave: 'sawtooth' },
    barks: {
      hit: ['MA COME?'],
      bigHit: ['ADESSO SÌ.', 'MA COME?'],
      ability: ['MO HO CAPITO.'],
      elimination: ['TU QUA NON ENTRI.', 'ADESSO SÌ.'],
      victory: ['MO HO CAPITO.', 'ADESSO SÌ.'],
      defeat: ['MA COME?', 'ASPÈ... FAMME CAPÌ.']
    }
  },
  judoka: {
    id: 'judoka',
    displayName: 'IL JUDOKA ROMPICOGLIONI',
    shortName: 'JUDOKA',
    announcerAlias: 'IL JUDOKA',
    tagline: "Se perde, probabilmente c'è una regola sbagliata.",
    accent: '#f59e0b',
    secondaryAccent: '#fde047',
    icon: '🥋',
    symbol: '⚠️',
    portrait: { image: '/characters/judoka.jpg', cx: 204, cy: 82, r: 80 },
    skin: '#e3b08c',
    dark: '#1f2937',
    body: { height: 0.86, width: 1.05, head: 0.98, shoulders: 1.05, stance: 1.45, crouch: 0.16, lean: 0.1 },
    gait: { step: 1.05, swing: 0.7, bob: 0.6, jitter: 0, sway: 0.1 },
    motion: { stiffness: 300, damping: 33 },
    accessories: ['shortHair', 'giLapels', 'beltEnds', 'glasses', 'granita', 'hazardPlate'],
    idleStyle: 'belt',
    victoryStyle: 'ippon',
    defeatStyle: 'protest',
    abilityStyle: 'wait',
    hitStyle: 'stagger',
    trail: '#fde047',
    sting: { notes: [12, 12, 12], wave: 'square' },
    barks: {
      hit: ['NO, ASPETTA!'],
      bigHit: ['QUESTO NON VALE.', 'NO, ASPETTA!'],
      ability: ['ASPETTA, ASPETTA!'],
      elimination: ['IPPON!'],
      victory: ['IPPON!', 'QUI COMANDO IO.'],
      defeat: ['QUESTO NON VALE.', 'NO, ASPETTA! LA REGOLA DICE...']
    }
  },
  dottore: {
    id: 'dottore',
    displayName: 'IL DOTTORE SCEMO',
    shortName: 'DOTTORE',
    announcerAlias: 'IL DOTTORE',
    tagline: 'Ogni tanto si sveglia.',
    accent: '#06b6d4',
    secondaryAccent: '#fde68a',
    icon: '💡',
    symbol: '💡',
    portrait: { image: '/characters/victor.jpg', cx: 226, cy: 112, r: 84 },
    skin: '#eab48f',
    dark: '#1e3a5f',
    body: { height: 1.08, width: 1.2, head: 1.02, shoulders: 1.08, stance: 1.05, crouch: 0, lean: -0.08 },
    gait: { step: 0.78, swing: 0.6, bob: 0.7, jitter: 0, sway: 0.35 },
    motion: { stiffness: 115, damping: 13 },
    accessories: ['messyHair', 'roundGlasses', 'cigarette', 'dottBadge', 'belly'],
    idleStyle: 'relaxed',
    victoryStyle: 'toldYou',
    defeatStyle: 'shrug',
    abilityStyle: 'lightbulb',
    hitStyle: 'wobble',
    trail: '#67e8f9',
    sting: { notes: [0, 4, 7, 24], wave: 'sine' },
    barks: {
      hit: ['TUTTO CALCOLATO.'],
      bigHit: ["M'HO SVEJATO.", 'TUTTO CALCOLATO.'],
      ability: ["M'HO SVEJATO."],
      elimination: ["TE L'AVEVO DETTO."],
      victory: ["TE L'AVEVO DETTO.", 'FACILE.', '20 KG IN UN MESE.'],
      defeat: ['ERA TUTTO CALCOLATO.', 'TRANQUILLI, SO QUELLO CHE FACCIO.']
    }
  },
  ciro: {
    id: 'ciro',
    displayName: 'IL NAPOLETANO STEMPIATO',
    shortName: 'CIRO',
    announcerAlias: 'CIRO',
    tagline: 'Pagherà. Prima o poi.',
    accent: '#8b5cf6',
    secondaryAccent: '#fbbf24',
    icon: '👨‍🦲',
    symbol: '💰',
    portrait: { image: '/characters/ciro.jpg', cx: 196, cy: 82, r: 80 },
    skin: '#e6b48e',
    dark: '#18181b',
    body: { height: 0.96, width: 0.9, head: 1, shoulders: 0.92, stance: 0.92, crouch: 0.03, lean: 0.04 },
    gait: { step: 1.1, swing: 0.55, bob: 0.8, jitter: 0, sway: 0.7 },
    motion: { stiffness: 260, damping: 15 },
    accessories: ['twoHairs', 'beard', 'goldChain', 'coin'],
    idleStyle: 'pockets',
    victoryStyle: 'dodgedPayment',
    defeatStyle: 'clause',
    abilityStyle: 'timer',
    hitStyle: 'dodge',
    trail: '#fbbf24',
    sting: { notes: [12, 7, 12, 19], wave: 'triangle' },
    barks: {
      hit: ['SORRY.'],
      bigHit: ['MA STAMO A SCHERZÀ?', 'SORRY.'],
      ability: ['PAGO DOMANI.'],
      elimination: ['A RATE.'],
      victory: ['E PURE STAVOLTA NON PAGO.', 'ULTIMO GIORNO UTILE.'],
      defeat: ["C'È UNA CLAUSOLA.", 'PAGO DOMANI.', 'SORRY.']
    }
  }
};

/**
 * Stile CSS di un <div> rotondo col ritratto (telefono, pannello controller): stesso ritaglio della testa delle texture della
 * TV (core/portraits). Solo testo: nessuna dipendenza da Phaser/DOM, usabile ovunque.
 */
export function portraitCss(characterId: string | null | undefined, d: number): string {
  const p = presentationOf(characterId);
  if (!p) return '';
  const { image, cx, cy, r } = p.portrait;
  const k = d / (2 * r);
  // ritratti larghi 520 px: background-size sulla sola larghezza, l'altezza segue
  return `width:${d}px;height:${d}px;border-radius:50%;border:3px solid ${p.accent};background:#1f2937 url(${image}) no-repeat;background-size:${Math.round(520 * k)}px auto;background-position:${-Math.round((cx - r) * k)}px ${-Math.round((cy - r) * k)}px;flex:none`;
}

/** Presentazione di un personaggio; null per id sconosciuti/assenti (i chiamanti mostrano un fallback neutro). */
export function presentationOf(id: string | null | undefined): CharacterPresentation | null {
  return id ? CHARACTER_PRESENTATION[id] ?? null : null;
}

// ---- Battute (barks): RARE per costruzione ----
// Una battuta funziona perche' e' rara: al massimo una ogni GLOBAL_GAP_MS in tutta la TV, la stessa persona non piu' di una ogni
// PER_CHAR_GAP_MS, mai la stessa frase due volte di fila. Vittoria/sconfitta di fine round passano sempre (succedono una volta).
const GLOBAL_GAP_MS = 3500;
const PER_CHAR_GAP_MS = 9000;
let lastGlobalAt = -Infinity;
const lastByChar = new Map<string, number>();
const lastLine = new Map<string, string>();

export function bark(characterId: string | null | undefined, kind: ReactionKind, opts: { force?: boolean; now?: number } = {}): string | null {
  const p = presentationOf(characterId);
  if (!p) return null;
  const now = opts.now ?? Date.now();
  const always = opts.force || kind === 'victory' || kind === 'defeat';
  if (!always) {
    if (now - lastGlobalAt < GLOBAL_GAP_MS) return null;
    if (now - (lastByChar.get(p.id) ?? -Infinity) < PER_CHAR_GAP_MS) return null;
  }
  const pool = p.barks[kind];
  const key = `${p.id}:${kind}`;
  const options = pool.length > 1 ? pool.filter((l) => l !== lastLine.get(key)) : pool;
  const line = options[Math.floor(Math.random() * options.length)];
  lastLine.set(key, line);
  lastByChar.set(p.id, now);
  lastGlobalAt = now;
  return line;
}

/** Solo per i test: azzera i limiti delle battute. */
export function resetBarks(): void {
  lastGlobalAt = -Infinity;
  lastByChar.clear();
  lastLine.clear();
}

/** Problemi della configurazione (vuoto = tutto a posto). Usato da scripts/character-selftest.ts. */
export function validatePresentation(): string[] {
  const errs: string[] = [];
  const seen = { id: new Set<string>(), short: new Set<string>(), icon: new Set<string>(), accent: new Set<string>(), alias: new Set<string>() };
  const uniq = (set: Set<string>, v: string, what: string, id: string): void => {
    if (set.has(v)) errs.push(`${id}: ${what} "${v}" duplicato`);
    set.add(v);
  };
  for (const cid of CHARACTER_ORDER) {
    const p = CHARACTER_PRESENTATION[cid];
    if (!p) {
      errs.push(`${cid}: presentazione mancante`);
      continue;
    }
    if (p.id !== cid) errs.push(`${cid}: id interno "${p.id}" diverso`);
    for (const k of ['displayName', 'shortName', 'announcerAlias', 'tagline', 'icon', 'symbol', 'accent', 'secondaryAccent', 'skin', 'dark', 'trail'] as const) {
      if (!p[k] || !String(p[k]).trim()) errs.push(`${cid}: campo "${k}" vuoto`);
    }
    for (const k of ['accent', 'secondaryAccent', 'skin', 'dark', 'trail'] as const) {
      if (!/^#[0-9a-f]{6}$/i.test(p[k])) errs.push(`${cid}: colore "${k}" non valido (${p[k]})`);
    }
    for (const k of ['idleStyle', 'victoryStyle', 'defeatStyle', 'abilityStyle', 'hitStyle'] as const) if (!p[k]) errs.push(`${cid}: stile "${k}" mancante`);
    if (CHARACTERS[cid]?.color.toLowerCase() !== p.accent.toLowerCase()) errs.push(`${cid}: accent ${p.accent} diverso dal colore del giocatore ${CHARACTERS[cid]?.color}`);
    if (CHARACTERS[cid]?.avatar !== p.icon) errs.push(`${cid}: icona ${p.icon} diversa dall'avatar ${CHARACTERS[cid]?.avatar}`);
    if (!p.portrait.image || p.portrait.r <= 0) errs.push(`${cid}: ritratto non valido`);
    if (p.accessories.length < 3) errs.push(`${cid}: servono almeno 3 accessori per una silhouette riconoscibile`);
    for (const k of REACTION_KINDS) if (!p.barks[k]?.length) errs.push(`${cid}: nessuna battuta per "${k}"`);
    if (!p.sting.notes.length) errs.push(`${cid}: sting vuoto`);
    const b = p.body;
    for (const [k, v] of Object.entries(b)) if (!Number.isFinite(v)) errs.push(`${cid}: body.${k} non numerico`);
    if (b.height < 0.75 || b.height > 1.15 || b.width < 0.8 || b.width > 1.4) errs.push(`${cid}: proporzioni fuori scala (il modello deve restare leggibile e non ingannare sul collider)`);
    uniq(seen.id, p.id, 'id', cid);
    uniq(seen.short, p.shortName, 'shortName', cid);
    uniq(seen.icon, p.icon, 'icona', cid);
    uniq(seen.accent, p.accent.toLowerCase(), 'accent', cid);
    uniq(seen.alias, p.announcerAlias, 'alias', cid);
  }
  for (const id of Object.keys(CHARACTER_PRESENTATION)) if (!CHARACTER_ORDER.includes(id)) errs.push(`${id}: presentazione per un personaggio che non esiste`);
  // silhouette diverse: due personaggi con le stesse proporzioni E gli stessi accessori sarebbero indistinguibili
  for (let i = 0; i < CHARACTER_ORDER.length; i++) {
    for (let j = i + 1; j < CHARACTER_ORDER.length; j++) {
      const a = CHARACTER_PRESENTATION[CHARACTER_ORDER[i]];
      const c = CHARACTER_PRESENTATION[CHARACTER_ORDER[j]];
      if (!a || !c) continue;
      const shared = a.accessories.filter((x) => c.accessories.includes(x));
      if (shared.length > 0) errs.push(`${a.id}/${c.id}: accessori in comune (${shared.join(', ')})`);
      const db = Math.abs(a.body.height - c.body.height) + Math.abs(a.body.width - c.body.width) + Math.abs(a.body.stance - c.body.stance);
      if (db < 0.12) errs.push(`${a.id}/${c.id}: proporzioni troppo simili (${db.toFixed(2)})`);
    }
  }
  return errs;
}
