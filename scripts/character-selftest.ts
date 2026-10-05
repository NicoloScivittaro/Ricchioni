/**
 * SELFTEST DELL'IDENTITA' DEI PERSONAGGI (parte pura, senza browser):  npx tsx scripts/character-selftest.ts
 * Config di presentazione completa e coerente (id unici, nomi, icone, colori = colore del giocatore, ritratti dentro
 * l'immagine, accessori e proporzioni DIVERSI tra personaggi, battute per ogni reazione), battute rare e senza ripetizioni,
 * e la regola d'oro: la presentazione non tocca il gameplay (nessun file di gioco/abilita' la importa per decidere qualcosa).
 * Il modello 3D e la galleria li prova scripts/e2e/character-gallery.mjs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CHARACTERS, CHARACTER_ORDER } from '../shared/characters';
import { CHARACTER_PRESENTATION, REACTION_KINDS, bark, presentationOf, resetBarks, validatePresentation } from '../shared/characterPresentation';

let fails = 0;
const ok = (c: boolean, m: string): void => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};

const errs = validatePresentation();
for (const e of errs) console.log(`   ${e}`);
ok(errs.length === 0, `config di presentazione valida per ${CHARACTER_ORDER.length} personaggi (${errs.length} problemi)`);
ok(CHARACTER_ORDER.length === 5 && CHARACTER_ORDER.every((id) => !!CHARACTERS[id] && !!CHARACTER_PRESENTATION[id]), 'i 5 personaggi ufficiali hanno tutti una presentazione');
ok(presentationOf(null) === null && presentationOf('nessuno') === null, 'id assente/sconosciuto = null (fallback neutro, nessun crash)');

// ritratti: il ritaglio della testa sta dentro l'immagine (dimensioni lette dall'intestazione JPEG)
function jpegSize(file: string): { w: number; h: number } | null {
  const d = readFileSync(file);
  let i = 2;
  while (i < d.length) {
    const m = d[i + 1];
    const len = d.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) return { h: d.readUInt16BE(i + 5), w: d.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
for (const id of CHARACTER_ORDER) {
  const p = CHARACTER_PRESENTATION[id];
  const size = jpegSize(join('public', p.portrait.image));
  const { cx, cy, r } = p.portrait;
  ok(!!size && cx - r >= 0 && cy - r >= 0 && cx + r <= size.w && cy + r <= size.h, `${id}: ritratto ${p.portrait.image} (${size?.w}x${size?.h}) con ritaglio testa ${cx},${cy} r${r} dentro l'immagine`);
}

// battute: ogni reazione ha frasi, la vittoria/sconfitta passano sempre, le altre sono rare e non si ripetono di fila
resetBarks();
for (const id of CHARACTER_ORDER) for (const k of REACTION_KINDS) ok(CHARACTER_PRESENTATION[id].barks[k].length > 0, `${id}: battute per "${k}"`);
resetBarks();
const t0 = 1_000_000;
const first = bark('goblin', 'hit', { now: t0 });
ok(first !== null, 'prima battuta concessa');
ok(bark('ciro', 'hit', { now: t0 + 500 }) === null, 'una seconda battuta subito dopo (altro personaggio) viene scartata: mai due bolle insieme');
ok(bark('goblin', 'hit', { now: t0 + 5000 }) === null, 'lo stesso personaggio non parla di nuovo prima di 9 s');
ok(bark('ciro', 'hit', { now: t0 + 5000 }) !== null, 'dopo il distacco globale un altro personaggio puo\' parlare');
ok(bark('goblin', 'victory', { now: t0 + 5100 }) !== null, 'la vittoria passa sempre (succede una volta per round)');
resetBarks();
let repeats = 0;
let prev: string | null = null;
for (let i = 0; i < 40; i++) {
  const l = bark('goblin', 'victory', { now: t0 + i * 20000 });
  if (l === prev) repeats++;
  prev = l;
}
ok(repeats === 0, 'mai la stessa battuta due volte di fila');
ok(bark(null, 'hit') === null && bark('nessuno', 'victory') === null, 'nessuna battuta per giocatori senza personaggio');

// regola d'oro: la presentazione non entra nel gameplay. I file di simulazione/abilita' non devono importarla.
const GAMEPLAY = ['shared/arenaAbilities.ts', 'shared/dodgeballAbilities.ts', 'shared/soccerAbilities.ts', 'shared/volleyballAbilities.ts', 'shared/memoryAbilities.ts', 'shared/reactionAbilities.ts', 'shared/abilities.ts', 'shared/scoring.ts', 'shared/fpsWeapons.ts', 'src/minigames/kart-race/kartPhysics.ts', 'src/minigames/arena/arenaAbilities.ts', 'src/minigames/dodgeball/dodgeballAbilities.ts', 'src/minigames/soccer/soccerAbilities.ts', 'src/minigames/volleyball/volleyballAbilities.ts', 'src/minigames/kart-race/abilities.ts'];
const leaking = GAMEPLAY.filter((f) => /characterPresentation|minigames\/characters\//.test(readFileSync(f, 'utf8')));
ok(leaking.length === 0, `nessun file di gameplay/abilita' importa la presentazione${leaking.length ? ` (${leaking.join(', ')})` : ''}`);
// e nel server non c'e' (la presentazione e' solo client)
const serverFiles = readdirSync('server').filter((f) => f.endsWith('.ts') && statSync(join('server', f)).isFile());
ok(!serverFiles.some((f) => /characterPresentation/.test(readFileSync(join('server', f), 'utf8'))), 'il server non usa la presentazione (nessun effetto su regole/punteggi)');

console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
