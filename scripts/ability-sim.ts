/**
 * ABILITY SIM (Quiz) — abilita' ON contro abilita' OFF, con bot:  npx tsx scripts/ability-sim.ts   (GAMES=1500 SEED=... per cambiare)
 *
 * Gli unici giochi con un motore di regole PURO (senza Babylon/Phaser) sono Quiz e le classi delle abilita' degli altri giochi (queste
 * ultime verificate da scripts/ability-selftest.ts e kart-abilities-selftest.ts). Qui si simula il Quiz con 5 bot di PARI abilita'
 * (stessa probabilita' di indovinare), uno per personaggio, che usano la propria abilita' con una regola semplice:
 *   Goblin    rifiuta la domanda se e' difficile (7+)          Buttafuori  ritenta dopo un errore (riga di grazia)
 *   Dottore   chiede l'indizio dal livello 6 (poi indovina il 80%, per il 70% dei punti)
 *   Judoka    ripensa la risposta (nessuna informazione in piu': per costruzione ~0)
 *   Ciro      aspetta, vede quanti hanno scelto cosa e segue la maggioranza dal livello 6
 * Obiettivo (dichiarato nel brief): NESSUNA abilita' palesemente dominante. Non si cerca la parita' perfetta: la soglia e' che nessun
 * personaggio superi del 35% il punteggio medio e che l'abilita' non peggiori troppo il proprio personaggio rispetto allo stesso senza.
 */
import { InputManager } from '../src/network/InputManager';
import { Rng } from '../shared/rng';
import { QuizRoundManager } from '../src/minigames/quiz/QuizRoundManager';
import { resetQuizHistory } from '../src/minigames/quiz/selection';
import type { MinigameContext } from '../src/minigames/types';
import type { PlayerId, PlayerSnapshot } from '../shared/types';

const GAMES = Number(process.env.GAMES ?? 1500);
const seed = process.env.SEED ? Number(process.env.SEED) : Math.floor(Math.random() * 0xffffffff);
const CHARS = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'] as const;
// probabilita' base di indovinare, per difficolta' 1..10 (decresce: 4 opzioni = 25% a caso)
const ACC = [0, 0.93, 0.9, 0.85, 0.78, 0.7, 0.6, 0.52, 0.45, 0.38, 0.32];

function makePlayers(): PlayerSnapshot[] {
  return CHARS.map((c, i) => ({ id: `p${i}` as PlayerId, displayName: c, characterId: c, name: c, roleTitle: '', avatar: '🎮', color: '#fff', quote: '', score: 0 }));
}

function playGame(rng: Rng, abilitiesOn: boolean): number[] {
  resetQuizHistory();
  const players = makePlayers();
  const ctx = {
    players,
    playerIds: players.map((p) => p.id),
    rng: new Rng(Math.floor(rng.next() * 0xffffffff)),
    durationSec: 320,
    modifier: null,
    modifiers: new Map(),
    input: new InputManager(),
    consume: () => false,
    sendPrivate: () => undefined,
    vibrate: () => undefined,
    signal: () => undefined,
    finish: () => undefined
  } as unknown as MinigameContext;
  const mgr = new QuizRoundManager(ctx, () => undefined);
  const decided = new Map<string, number>(); // risposta gia' scelta in questa domanda (per non rifare la stessa cosa a ogni tick)
  let lastQ = '';
  let t = 0;
  while (!mgr.finished && t < 500) {
    const q = mgr.currentQuestion();
    const key = `${mgr.questionIndex}:${q.id}`;
    if (key !== lastQ) {
      lastQ = key;
      decided.clear();
    }
    if (mgr.phase === 'question' || mgr.phase === 'intro') {
      for (const pid of ctx.playerIds) {
        const p = mgr.players.get(pid)!;
        const d = q.difficulty;
        const acc = ACC[d];
        const guess = (a: number): number => (rng.next() < a ? q.correctAnswerIndex : [0, 1, 2, 3].filter((i) => i !== q.correctAnswerIndex)[Math.floor(rng.next() * 3)]);
        if (p.hasAnsweredFinal && !p.inSecondChanceGrace) {
          // JUDOKA: ripensa solo dalle domande difficili e solo una volta; senza informazioni nuove e' un altro tiro con la stessa probabilita'
          if (abilitiesOn && p.characterId === 'judoka' && !p.abilityUsed && d >= 8 && mgr.phase === 'question' && rng.next() < 0.3) {
            if (mgr.useAbility(pid) === null) mgr.submitAnswer(pid, guess(acc));
          }
          continue;
        }
        if (mgr.phase !== 'question') {
          // GOBLIN: rifiuta le domande difficili PRIMA di rispondere
          if (abilitiesOn && p.characterId === 'goblin' && !p.abilityUsed && d >= 7) mgr.useAbility(pid);
          continue;
        }
        if (p.inSecondChanceGrace) {
          // BUTTAFUORI: premi ABILITA' e ritenta (una risposta diversa dalla prima: tra le altre tre, un po' meglio del caso)
          if (!p.secondChanceArmed) {
            if (abilitiesOn) mgr.useAbility(pid);
          } else {
            const others = [0, 1, 2, 3].filter((i) => i !== p.firstWrongIndex);
            mgr.submitAnswer(pid, rng.next() < Math.min(0.55, acc * 0.6 + 0.12) ? q.correctAnswerIndex : others[Math.floor(rng.next() * others.length)]);
          }
          continue;
        }
        if (decided.has(pid)) continue;
        if (abilitiesOn && p.characterId === 'dottore' && !p.abilityUsed && d >= 6) {
          mgr.useAbility(pid); // indizio vero: poi indovina l'80% (ma vale il 70% dei punti)
          decided.set(pid, 1);
          mgr.submitAnswer(pid, guess(0.8));
          continue;
        }
        if (abilitiesOn && p.characterId === 'ciro' && (p.ciroWaiting || (!p.abilityUsed && d >= 6))) {
          if (!p.ciroWaiting) mgr.useAbility(pid);
          const br = mgr.ciroBreakdown(pid);
          if (br) {
            // dopo il tempo: segue la maggioranza degli altri (se c'e' un pareggio, il piu' alto; altrimenti ripiega sulla sua stima)
            const max = Math.max(...br);
            const best = br.indexOf(max);
            mgr.submitAnswer(pid, max >= 2 ? best : guess(acc));
            decided.set(pid, 1);
          }
          continue;
        }
        decided.set(pid, 1);
        mgr.submitAnswer(pid, guess(acc));
      }
    }
    mgr.update(0.25);
    t += 0.25;
  }
  const res = mgr.buildResults();
  const out = [0, 0, 0, 0, 0];
  for (const r of res) out[Number(r.playerId.slice(1))] = r.score;
  return out;
}

const rng = new Rng(seed);
const sum = (on: boolean): { avg: number[]; wins: number[] } => {
  const tot = [0, 0, 0, 0, 0];
  const wins = [0, 0, 0, 0, 0];
  for (let g = 0; g < GAMES; g++) {
    const s = playGame(rng, on);
    s.forEach((v, i) => (tot[i] += v));
    const best = Math.max(...s);
    const leaders = s.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    for (const i of leaders) wins[i] += 1 / leaders.length;
  }
  return { avg: tot.map((v) => v / GAMES), wins: wins.map((w) => (w / GAMES) * 100) };
};

const off = sum(false);
const on = sum(true);
const meanOn = on.avg.reduce((a, b) => a + b, 0) / 5;
console.log(`QUIZ — ${GAMES} partite per modalita' (seed ${seed}), 5 bot di pari abilita'`);
console.log('personaggio     punti medi OFF → ON      vittorie OFF → ON');
let fails = 0;
CHARS.forEach((c, i) => {
  const delta = ((on.avg[i] - off.avg[i]) / off.avg[i]) * 100;
  console.log(`  ${c.padEnd(12)} ${off.avg[i].toFixed(1).padStart(6)} → ${on.avg[i].toFixed(1).padStart(6)} (${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%)   ${off.wins[i].toFixed(1).padStart(5)}% → ${on.wins[i].toFixed(1).padStart(5)}%`);
  if (on.avg[i] > meanOn * 1.35) {
    console.log(`  ❌ ${c}: ${((on.avg[i] / meanOn - 1) * 100).toFixed(0)}% sopra la media: abilita' dominante`);
    fails++;
  }
  if (on.avg[i] < off.avg[i] * 0.7) {
    console.log(`  ❌ ${c}: usare l'abilita' lo peggiora di oltre il 30% (${delta.toFixed(0)}%): costo troppo alto`);
    fails++;
  }
});
const spread = Math.max(...on.wins) - Math.min(...on.wins);
console.log(`vittorie ON: scarto fra il piu' e il meno vincente ${spread.toFixed(1)} punti (parita' = 20% ciascuno)`);
if (spread > 14) {
  console.log('  ❌ scarto troppo grande');
  fails++;
}
console.log(fails ? `\n❌ ${fails} segnalazioni` : '\n✅ nessuna abilita\' dominante nel Quiz con questi bot');
process.exitCode = fails ? 1 : 0;
