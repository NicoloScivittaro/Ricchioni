/**
 * MATRICE DELLE ABILITA' (5 personaggi x 12 minigiochi):  npx tsx scripts/ability-matrix.ts          (stampa)
 *                                                          npx tsx scripts/ability-matrix.ts --write  (scrive docs/ABILITY_MATRIX.md)
 *
 * La colonna DOPO e' GENERATA dal catalogo (shared/abilityCatalog.ts): nome, effetto, limite, tipo e impatto non possono divergere dal
 * gioco. La colonna PRIMA e' l'audit dello stato precedente (scritto a mano, fotografia fissa). I voti 1-5 sono giudizi di design
 * (significativita' / skill richiesta / counterplay / chiarezza): servono a decidere dove intervenire, non sono misure.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { ABILITY_CATALOG, ABILITY_KIND_LABEL, abilityFor } from '../shared/abilityCatalog';
import type { AbilityGameId } from '../shared/abilityCatalog';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';
import { PAD_PROFILES } from '../src/input/profiles';
import { bindingLabel } from '../src/input/padTypes';

type Score = [number, number, number, number]; // significativa, skill, counterplay, chiarezza
interface Before {
  name: string;
  what: string;
  score: Score;
}

const GAMES: { id: AbilityGameId; title: string }[] = [
  { id: 'arena', title: 'ARENA DEL DISAGIO' },
  { id: 'dodgeball', title: 'DODGEBALL DEI COGLIONI' },
  { id: 'soccer', title: 'CALCIO DEI DISAGIATI' },
  { id: 'volleyball', title: 'PALLAVOLO DEI DISAGIATI' },
  { id: 'kart3d', title: 'RIBALTATI (KART)' },
  { id: 'fps', title: 'SPARATORIA DEI DISAGIATI' },
  { id: 'memory', title: 'MEMORIA DA UBRIACO' },
  { id: 'reaction', title: 'BOTTA AL VOLO' },
  { id: 'quiz', title: 'CHI CAZZO LO SA?' },
  { id: 'cultura', title: 'CULTURA O CAZZATA?' },
  { id: 'cornicione', title: 'BOTTE SUL CORNICIONE' },
  { id: 'casacarbo', title: 'CASA CARBO' }
];
const CHARS = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'] as const;
const CHAR_LABEL: Record<(typeof CHARS)[number], string> = { goblin: 'GOBLIN', buttafuori: 'BUTTAFUORI', judoka: 'JUDOKA', dottore: 'DOTTORE', ciro: 'CIRO' };

const NONE: Before = { name: '—', what: 'nessuna abilità di personaggio (RB riservato e senza effetto)', score: [1, 1, 1, 1] };
const NEWGAME: Before = { name: '—', what: 'gioco nuovo: nessuna versione precedente', score: [1, 1, 1, 1] };
const CULT: Before = { name: '—', what: 'nessuna abilità di personaggio: solo TE CONOSCO (uguale per tutti) e i ruoli a caso Secchione / Avvocato', score: [1, 1, 1, 2] };

/** PRIMA: foto dell'audit (nome · effetto · trigger · usi · feedback) e voti [significativa, skill, counterplay, chiarezza]. */
const BEFORE: Record<AbilityGameId, Record<(typeof CHARS)[number], Before>> = {
  arena: {
    goblin: { name: 'NCULO!', what: 'dash sporco con direzione CASUALE e spinta ×1,85 · tasto · 1 uso/round · nome sopra la testa', score: [3, 1, 2, 3] },
    buttafuori: { name: "MO M'IMPEGNO", what: '5 s di resistenza (spinte al 30%) · tasto · 1 uso · effetto invisibile (solo il nome)', score: [3, 1, 3, 3] },
    judoka: { name: 'IPPON', what: "onda d'urto AUTOMATICA attorno (5,5 m, forza 15) · tasto · 1 uso", score: [3, 1, 2, 4] },
    dottore: { name: '20 KG IN UN MESE', what: '5 s più veloce ma spinte ×2 · tasto · 1 uso · il nome non c\'entra col DNA del personaggio', score: [2, 1, 3, 2] },
    ciro: { name: 'PAGO DOPO', what: 'arma 4 s: la prossima spinta subita arriva 2 s dopo più debole · tasto · 1 uso', score: [3, 2, 3, 3] }
  },
  dodgeball: {
    goblin: { name: "N'CULO, RIPIGLIATELA!", what: 'parata a tempo (0,42 s): rimanda la palla più veloce; a vuoto vieni colpito · 1 uso', score: [4, 4, 3, 4] },
    buttafuori: { name: 'OCCHIO DA POLIGONO', what: '5 s di linea di mira + primo tiro ×1,4 · 1 uso', score: [3, 3, 3, 3] },
    judoka: { name: 'CARICO E SCARICO', what: 'camion: bip, scatto che raccoglie 2 palle, le scarichi · 1 uso', score: [4, 3, 3, 4] },
    dottore: { name: 'TRE MESI DOPO', what: '6 s di traiettorie in arrivo visibili · solo informazione · 1 uso', score: [2, 2, 2, 3] },
    ciro: { name: 'PAGO DOMANI', what: 'il colpo che elimina diventa debito di 4 s: colpisci qualcuno o sei fuori · 1 uso', score: [4, 3, 3, 4] }
  },
  soccer: {
    goblin: { name: 'TRIVELA DEL GOBLIN', what: 'il prossimo tiro curva (automatico: nessuna skill) · 1 uso', score: [3, 1, 2, 3] },
    buttafuori: { name: 'OCCHIO DA POLIGONO', what: '5 s di linea di mira + primo tiro ×1,3 (la linea la vedono già tutti) · copia del Dodgeball', score: [2, 1, 1, 3] },
    judoka: { name: 'CARICO E SCARICO', what: 'il prossimo scatto ruba con una spinta più forte · 1 uso', score: [3, 2, 3, 2] },
    dottore: { name: '20 KG IN UN MESE', what: '5 s più veloce ma contrasti deboli · copia di Arena/Pallavolo/Kart', score: [2, 1, 3, 2] },
    ciro: { name: 'PAGO DOMANI', what: '4 s: il primo contrasto subito non ti toglie la palla · 1 uso', score: [3, 1, 2, 3] }
  },
  volleyball: {
    goblin: { name: 'JÄGER BOMB', what: 'prossimo smash "perfetto" ×1,55; se sbagli, sprecata (senza scadenza) · 1 uso', score: [3, 3, 2, 3] },
    buttafuori: { name: 'MURO DEL POLIGONO', what: '6 s di "alzata più stabile" (+10%) · effetto quasi invisibile', score: [1, 1, 1, 2] },
    judoka: { name: 'CARICO E SCARICO', what: '6 s di accelerazione laterale ×2,6 + colpo ×1,4 · copia di Dodgeball/Calcio', score: [3, 2, 2, 2] },
    dottore: { name: '20 KG IN UN MESE', what: '6 s di salto e corsa ×1,3 · copia', score: [2, 1, 2, 2] },
    ciro: { name: 'PAGO DOMANI', what: 'palla a terra vicino a te: si ferma 1 s per un salvataggio disperato · 1 uso', score: [3, 3, 3, 3] }
  },
  kart3d: {
    goblin: { name: 'SO GUIDARE IO', what: 'barra piena → 6 s di mini-turbo ×1,6; si perde se sbatti · tasto', score: [4, 4, 4, 4] },
    buttafuori: { name: 'RIBALTATO MA NON MORTO', what: 'dopo uno schianto grave torni in pista da SOLO con un boost · automatica · 1 uso', score: [3, 1, 1, 2] },
    judoka: { name: "MI SO' CADUTI GLI OCCHIALI!", what: 'barra piena → rallenta i rivali vicini davanti; se non ne superi uno, penalità', score: [3, 2, 3, 3] },
    dottore: { name: '20 KG IN UN MESE', what: 'barra piena → 6 s leggerissimo (accelera/derapa) ma voli se ti urtano', score: [4, 3, 4, 4] },
    ciro: { name: 'PAGO DOPO', what: 'premi ENTRO 0,5 s PRIMA del colpo per rimandarlo di 4 s: bisogna indovinare · 1 uso', score: [3, 3, 3, 2] }
  },
  fps: { goblin: NONE, buttafuori: NONE, judoka: NONE, dottore: NONE, ciro: NONE },
  memory: {
    goblin: { name: 'ANCORA UN GIRO', what: 'rivedi la sequenza una seconda volta, solo tu · 1 uso/partita', score: [3, 2, 1, 4] },
    buttafuori: { name: 'MO HO CAPITO', what: 'passiva: il primo errore è perdonato (+1,2 s) · invisibile e automatica', score: [3, 1, 1, 2] },
    judoka: { name: 'NO, ASPETTA!', what: 'ferma il tuo tempo 2 s · 1 uso', score: [3, 2, 1, 4] },
    dottore: { name: "M'HO SVEJATO", what: 'sbirci la prossima casella giusta (−0,8 s) · 1 uso', score: [3, 2, 1, 4] },
    ciro: { name: 'A RATE', what: 'pausa di 2 s a metà sequenza, −1,5 s dal tempo · 1 uso', score: [3, 2, 1, 3] }
  },
  reaction: {
    goblin: { name: "N'CULO!", what: 'annulla il finto VIA (finestra di ~0,2 s) e riparte l\'attesa; troppo presto = ubriaco · 1 uso/round', score: [3, 4, 2, 3] },
    buttafuori: { name: 'MO HO CAPITO', what: 'passiva: falsa partenza → seconda chance (+120 ms) · automatica', score: [3, 1, 1, 2] },
    judoka: { name: 'ASPETTA UN ATTIMO!', what: 'finto reset di 1 s per tutti, poi nuovo timer · 1 uso/round', score: [3, 2, 3, 4] },
    dottore: { name: "M'HO SVEJATO", what: 'focus di 2 s: se il VIA cade dentro lo senti (senza anticipo) · 1 uso/partita', score: [2, 3, 1, 3] },
    ciro: { name: 'ULTIMO SECONDO', what: 'in guardia: ti avvisa se parte un falso allarme o qualcuno sbaglia · 1 uso/partita', score: [2, 2, 1, 3] }
  },
  quiz: {
    goblin: { name: "N'CULO!", what: 'rifiuta la domanda: ne arriva una nuova per tutti · 1 uso', score: [3, 2, 2, 4] },
    buttafuori: { name: 'MO HO CAPITO', what: 'dopo un errore hai 4 s per riprovare, metà punti · 1 uso', score: [4, 2, 2, 4] },
    judoka: { name: 'NO, ASPETTA!', what: 'dopo aver risposto puoi cambiare (+3 s) · 1 uso', score: [3, 2, 1, 4] },
    dottore: { name: "M'HO SVEJATO", what: 'indizio vero in privato, valgono il 70% dei punti · 1 uso', score: [4, 2, 1, 4] },
    ciro: { name: 'ULTIMO GIORNO UTILE', what: 'aspetti la fine del tempo e vedi come hanno risposto (+4 s) · 1 uso', score: [4, 3, 2, 4] }
  },
  cultura: { goblin: CULT, buttafuori: CULT, judoka: CULT, dottore: CULT, ciro: CULT },
  cornicione: { goblin: NEWGAME, buttafuori: NEWGAME, judoka: NEWGAME, dottore: NEWGAME, ciro: NEWGAME },
  casacarbo: { goblin: NEWGAME, buttafuori: NEWGAME, judoka: NEWGAME, dottore: NEWGAME, ciro: NEWGAME }
};

/** DOPO: voti di progetto (da confermare col playtest). Chiave `${gioco}/${personaggio}`; default sotto. */
const AFTER_SCORE: Record<string, Score> = {
  'arena/goblin': [4, 5, 4, 4],
  'arena/buttafuori': [4, 3, 4, 4],
  'arena/judoka': [4, 4, 4, 4],
  'arena/dottore': [3, 3, 4, 4],
  'arena/ciro': [4, 3, 4, 4],
  'dodgeball/goblin': [4, 4, 3, 4],
  'dodgeball/buttafuori': [4, 3, 4, 4],
  'dodgeball/judoka': [4, 3, 3, 4],
  'dodgeball/dottore': [3, 3, 3, 4],
  'dodgeball/ciro': [4, 3, 3, 4],
  'soccer/goblin': [4, 5, 3, 4],
  'soccer/buttafuori': [3, 2, 4, 4],
  'soccer/judoka': [4, 4, 4, 4],
  'soccer/dottore': [4, 3, 3, 4],
  'soccer/ciro': [4, 3, 4, 4],
  'volleyball/goblin': [4, 4, 2, 4],
  'volleyball/buttafuori': [3, 3, 4, 4],
  'volleyball/judoka': [4, 4, 3, 4],
  'volleyball/dottore': [3, 3, 3, 4],
  'volleyball/ciro': [4, 3, 3, 4],
  'kart3d/goblin': [4, 4, 4, 5],
  'kart3d/buttafuori': [4, 3, 3, 4],
  'kart3d/judoka': [4, 3, 4, 4],
  'kart3d/dottore': [4, 3, 4, 4],
  'kart3d/ciro': [4, 3, 3, 4],
  'cornicione/goblin': [5, 4, 4, 4],
  'cornicione/buttafuori': [4, 4, 4, 4],
  'cornicione/judoka': [5, 5, 4, 4],
  'cornicione/dottore': [4, 4, 4, 4],
  'cornicione/ciro': [5, 3, 5, 4],
  'casacarbo/goblin': [4, 4, 3, 4],
  'casacarbo/buttafuori': [4, 3, 3, 4],
  'casacarbo/judoka': [4, 4, 3, 4],
  'casacarbo/dottore': [3, 3, 2, 4],
  'casacarbo/ciro': [4, 4, 3, 4]
};
const AFTER_DEFAULT: Score = [4, 3, 3, 4];

function fmt(s: Score): string {
  return `${s[0]}/${s[1]}/${s[2]}/${s[3]}`;
}
const avg = (rows: Score[]): string => {
  const a = [0, 1, 2, 3].map((i) => (rows.reduce((t, r) => t + r[i], 0) / Math.max(1, rows.length)).toFixed(1));
  return a.join('/');
};

function keyOf(gameId: AbilityGameId): string {
  const prof = PAD_PROFILES[gameId];
  const b = prof?.controls.find((c) => c.action === 'ABILITY');
  if (b) return `${bindingLabel(b.binding, 'xbox')} / ${bindingLabel(b.binding, 'playstation')}`;
  return gameId === 'cultura' ? 'telefono, quando si vota' : '—';
}

let md = '';
const out = (l = ''): void => void (md += l + '\n');

out('# MATRICE DELLE ABILITÀ — 5 personaggi × 12 minigiochi');
out();
out('> Generata da `scripts/ability-matrix.ts`. La colonna **DOPO** viene dal catalogo (`shared/abilityCatalog.ts`), la stessa fonte di TV, telefono e HUD: non può divergere dal gioco. La colonna **PRIMA** è l\'audit dello stato precedente.');
out('> Voti **S/Sk/C/Cl** = significativa / skill richiesta / counterplay / chiarezza, da 1 a 5 (giudizi di design, da confermare con le persone: non sono misure).');
out('> Tipo: ' + Object.values(ABILITY_KIND_LABEL).join(' · ') + '. Impatto: BASSO / MEDIO / ALTO (le ALTE hanno pochi usi, una ricarica, una barra da riempire o un rischio).');
out();

const high = ABILITY_CATALOG.filter((d) => d.impact === 'HIGH').length;
const med = ABILITY_CATALOG.filter((d) => d.impact === 'MEDIUM').length;
out(`**60 combinazioni · ${high} impatto ALTO · ${med} MEDIO · 0 BASSO.**`);
out();

const allBefore: Score[] = [];
const allAfter: Score[] = [];
for (const g of GAMES) {
  const def = MINIGAME_DEFINITIONS.find((m) => m.id === g.id);
  out(`## ${def?.icon ?? ''} ${g.title}`);
  out();
  out(`Tasto abilità: **${keyOf(g.id)}** (profilo di input).`);
  out();
  out('| | PRIMA | DOPO | tipo · impatto · limite |');
  out('|---|---|---|---|');
  for (const c of CHARS) {
    const b = BEFORE[g.id][c];
    const a = abilityFor(g.id, c)!;
    const as = AFTER_SCORE[`${g.id}/${c}`] ?? AFTER_DEFAULT;
    allBefore.push(b.score);
    allAfter.push(as);
    const keep = b.name === a.name && g.id !== 'arena' ? ' *(mantenuta)*' : '';
    out(`| **${CHAR_LABEL[c]}** | **${b.name}** — ${b.what}<br>S/Sk/C/Cl ${fmt(b.score)} | **${a.name}**${keep} — ${a.full}<br>S/Sk/C/Cl ${fmt(as)} | ${ABILITY_KIND_LABEL[a.kind]} · **${a.impact === 'HIGH' ? 'ALTO' : a.impact === 'MEDIUM' ? 'MEDIO' : 'BASSO'}** · ${a.limit} |`);
  }
  out();
}
out('## Riepilogo');
out();
out(`Media S/Sk/C/Cl: **prima ${avg(allBefore)}** → **dopo ${avg(allAfter)}**.`);
out();
out('Cambiamenti principali: FPS e Cultura passano da nessuna abilità a una per personaggio; le abilità passive o automatiche (Buttafuori in Kart, Memoria e Botta al Volo, Ciro in Kart) restano tali solo dove la passività È il punto (Memoria, Botta al Volo) e diventano reattive con un tasto dove prima scattavano da sole (Kart); Calcio e Pallavolo non copiano più Arena/Dodgeball.');
out();

if (process.argv.includes('--write')) {
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/ABILITY_MATRIX.md', md, 'utf8');
  console.log(`scritto docs/ABILITY_MATRIX.md (${md.length} caratteri)`);
} else console.log(md);
