/**
 * SELFTEST AUDIO (parte pura, senza browser):  npx tsx scripts/audio-selftest.ts
 * Temi musicali: uno per minigioco, tutti diversi, loop lunghi (16 battute, mai 3 secondi), livello 0 senza batteria
 * (schermata CONTROLLI), livello 2 con piu' strati, NESSUNA melodia dove l'audio e' gameplay (Memoria, Botta al Volo),
 * Botta al Volo senza cambi legati al tempo (nessun indizio del VIA). Note di Memoria fisse e ben distinguibili.
 * Il comportamento nel browser (mixer, limiter, budget, ducking, fasi, leak) lo prova scripts/e2e/audio.mjs.
 */
import { THEMES, themeForGame, stepEvents, degreeToMidi } from '../src/core/musicThemes';
import type { ThemeId } from '../src/core/musicThemes';
import { TILE_FREQS } from '../src/core/AudioManager';
import { MINIGAME_DEFINITIONS } from '../shared/minigames';

let fails = 0;
const ok = (c: boolean, m: string): void => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};

// 1. un tema per ogni minigioco del registry, mai quello generico
for (const def of MINIGAME_DEFINITIONS) {
  const t = themeForGame(def.id);
  ok(t !== 'results' && THEMES[t]?.id === t, `${def.id}: tema musicale dedicato (${t})`);
}

// 2. identita' diverse: nessuna coppia di temi di gioco con stesso tempo + stessa scala + stessa cassa + stesso basso
const games = MINIGAME_DEFINITIONS.map((d) => themeForGame(d.id));
const sig = (id: ThemeId): string => {
  const t = THEMES[id];
  return `${t.bpm}|${t.scale.join(',')}|${t.kick}|${t.bass.pattern}|${t.bass.wave}`;
};
const sigs = new Set(games.map(sig));
ok(sigs.size === games.length, `i ${games.length} temi dei giochi sono tutti diversi (${sigs.size} firme distinte)`);
const bpms = games.map((g) => THEMES[g].bpm);
ok(Math.max(...bpms) - Math.min(...bpms) >= 40, `tempi molto diversi tra i giochi (${Math.min(...bpms)}–${Math.max(...bpms)} bpm)`);
ok(THEMES.dodgeball.bpm > THEMES.arena.bpm, 'Dodgeball piu\' veloce dell\'Arena (sport arcade rapido vs brawler)');
ok(THEMES.cultura.swing > 0.2 && THEMES.quiz.swing < 0.2 && THEMES.cultura.bpm !== THEMES.quiz.bpm, 'Cultura (bar, swing) suona diversa dal Quiz (game show)');

// 3. loop lunghi: 16 battute, mai un giro di 3 secondi
for (const id of Object.keys(THEMES) as ThemeId[]) {
  const t = THEMES[id];
  const sec = (16 * 4 * 60) / t.bpm;
  ok(sec >= 25 && t.progression.length === 8 && t.motif.length === 32, `${id}: giro di 16 battute = ${sec.toFixed(0)} s (variazioni a 4/8/12/16)`);
}

// 4. livelli: 0 = niente batteria ne' melodia (CONTROLLI), 2 = piu' strati di 1
for (const id of Object.keys(THEMES) as ThemeId[]) {
  const t = THEMES[id];
  let drums0 = 0;
  let lead0 = 0;
  let ev1 = 0;
  let ev2 = 0;
  for (let bar = 0; bar < 16; bar++) {
    for (let st = 0; st < 16; st++) {
      const e0 = stepEvents(t, bar, st, 0);
      const e1 = stepEvents(t, bar, st, 1);
      const e2 = stepEvents(t, bar, st, 2);
      if (e0.kick || e0.snare || e0.hat) drums0++;
      if (e0.lead !== null) lead0++;
      const n = (e: typeof e1): number => +e.kick + +e.snare + e.hat + +e.perc + +(e.lead !== null) + +(e.bass !== null) + (e.chord?.length ?? 0);
      ev1 += n(e1);
      ev2 += n(e2);
    }
  }
  ok(drums0 === 0 && lead0 === 0, `${id}: livello 0 senza batteria ne' melodia (musica "sotto" la schermata CONTROLLI)`);
  ok(ev2 >= ev1, `${id}: livello 2 ha almeno gli strati del livello 1 (${ev1} → ${ev2} eventi per giro)`);
}

// 5. dove l'audio e' gameplay, la musica non deve interferire
for (const id of ['memory', 'reaction'] as ThemeId[]) {
  let leads = 0;
  for (let lvl = 0 as 0 | 1 | 2; lvl <= 2; lvl = (lvl + 1) as 0 | 1 | 2) {
    for (let bar = 0; bar < 16; bar++) for (let st = 0; st < 16; st++) if (stepEvents(THEMES[id], bar, st, lvl).lead !== null) leads++;
    if (lvl === 2) break;
  }
  ok(leads === 0, `${id}: nessuna melodia (le note di Memoria / il VIA di Botta al Volo sono gameplay)`);
}
ok(THEMES.memory.gain <= 0.5 && THEMES.reaction.gain <= 0.5, 'Memoria e Botta al Volo: musica bassa');

// 6. note di Memoria: 4, fisse, ben distanti (almeno 3 semitoni), sotto il registro della musica di Memoria? no: distinte tra loro
const semis = TILE_FREQS.map((f) => 12 * Math.log2(f / 440));
let minGap = Infinity;
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minGap = Math.min(minGap, Math.abs(semis[i] - semis[j]));
ok(TILE_FREQS.length === 4 && new Set(TILE_FREQS).size === 4 && minGap >= 3, `4 note di Memoria distinte (distanza minima ${minGap.toFixed(1)} semitoni)`);
const memRoot = degreeToMidi(THEMES.memory, 0, THEMES.memory.bass.octave);
ok(memRoot < 50, 'il pad di Memoria resta grave, lontano dalle note delle tessere');

console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
