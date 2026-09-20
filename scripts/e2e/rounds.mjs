// BUG 4: un gioco configurato per N round deve eseguire ESATTAMENTE N round (run NATURALE, nessuna iniezione).
//   MODE=reaction | memory | memory-elim | quiz | cultura
// memory-elim: 3 telefoni, P2 sbaglia al round 3 e P3 al round 2 → il gioco DEVE arrivare comunque al round 5.
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const MODE = process.env.MODE ?? 'reaction';
const gameId = MODE.startsWith('memory') ? 'memory' : MODE;
const PHONES = MODE === 'memory-elim' ? 3 : 2;
const MAX_MS = { reaction: 150000, memory: 240000, 'memory-elim': 240000, quiz: 420000, cultura: 700000 }[MODE];

const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: Math.max(0, PHONES - 2) });
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < PHONES; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`PHONE${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), gameId);
  await sleep(300);
  await page.keyboard.press('Enter');

  const probe = () =>
    hostEval(page, (gm, id) => {
      const sc = gm.game.scene.getScene(id);
      if (!sc || !sc.sys.isActive()) return { active: false };
      if (id === 'reaction') return { active: true, round: sc.round, phase: sc.phase, finished: sc.finished };
      if (id === 'memory') return { active: true, round: sc.round, phase: sc.phase, finished: sc.finished, alive: sc.players.map((p) => p.alive), seqLen: sc.sequences?.[sc.round]?.length ?? 0 };
      if (id === 'quiz') return { active: true, round: sc.manager.questionIndex, phase: sc.manager.phase, finished: sc.manager.finished };
      if (id === 'cultura') return { active: true, round: sc.round, phase: sc.phase, finished: sc.finished };
      return { active: true };
    }, gameId);

  const seenRounds = new Set();
  const phasesSeen = new Set();
  let t0 = null;
  let finishCalls = 0;
  await hostEval(page, (gm) => {
    if (gm.__origFinish) return;
    gm.__origFinish = gm.finishMinigame.bind(gm);
    gm.__finishCalls = 0;
    gm.finishMinigame = (r, id) => {
      gm.__finishCalls++;
      return gm.__origFinish(r, id);
    };
  });

  // ---- pilota Memory: risposte dei telefoni ----
  let lastRoundAnswered = -1;
  const answer = async (roundIdx) => {
    lastRoundAnswered = roundIdx;
    const seq = await hostEval(page, (gm) => gm.game.scene.getScene('memory').sequences[gm.game.scene.getScene('memory').round]);
    const alive = await hostEval(page, (gm) => gm.game.scene.getScene('memory').players.map((p) => p.alive));
    await Promise.all(
      phones.map(async (ph, pi) => {
        if (!alive[pi]) return;
        for (let i = 0; i < seq.length; i++) {
          let tile = seq[i];
          // scenari di errore: MODE memory-elim → P2 (indice 1) sbaglia al round 3 (idx 2); P3 (indice 2) al round 2 (idx 1)
          const wrongNow = MODE === 'memory-elim' && ((pi === 1 && roundIdx === 2) || (pi === 2 && roundIdx === 1)) && i === 0;
          if (wrongNow) tile = (tile + 1) % 4;
          await ph.page.click(`.mem-tile[data-index="${tile}"]`).catch(() => {});
          await sleep(140);
        }
      })
    );
  };

  const start = Date.now();
  let finishedAt = null;
  let phaseServer = '';
  while (Date.now() - start < MAX_MS) {
    const p = await probe();
    const snap = await hostSnapshot(page);
    if (snap.phase !== phaseServer) {
      phaseServer = snap.phase;
      console.log(`[${((Date.now() - start) / 1000).toFixed(0)}s] fase server ${phaseServer}`);
    }
    if (snap.phase === 'MINIGAME_PLAYING' && p.active) {
      if (t0 === null) t0 = Date.now();
      if (!(gameId === 'reaction' && p.phase === 'title')) seenRounds.add(p.round);
      phasesSeen.add(p.phase);
      if (MODE.startsWith('memory') && p.phase === 'repeat' && lastRoundAnswered !== p.round) await answer(p.round);
    }
    if (snap.phase === 'MINIGAME_FINISHED' || snap.phase === 'MINIGAME_ROULETTE' && t0 !== null) {
      finishedAt = Date.now();
      break;
    }
    await sleep(MODE.startsWith('memory') ? 120 : 400);
  }
  finishCalls = await hostEval(page, (gm) => gm.__finishCalls);
  const rounds = [...seenRounds].sort((a, b) => a - b);
  console.log(`\nGIOCO ${gameId}: round visti = ${JSON.stringify(rounds)} · durata ${(t0 && finishedAt ? (finishedAt - t0) / 1000 : NaN).toFixed(0)}s · finish() chiamata ${finishCalls} volta/e · fasi ${[...phasesSeen].join(',')}`);
  const expected = { reaction: [1, 2, 3, 4, 5], memory: [0, 1, 2, 3, 4], 'memory-elim': [0, 1, 2, 3, 4], quiz: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], cultura: [0, 1, 2, 3, 4, 5, 6, 7] }[MODE];
  const okRounds = JSON.stringify(rounds) === JSON.stringify(expected);
  const okFinish = finishCalls === 1;
  console.log(okRounds ? `✅ eseguiti esattamente ${expected.length} round` : `❌ round attesi ${JSON.stringify(expected)}`);
  console.log(okFinish ? '✅ risultato inviato UNA volta' : `❌ finish chiamata ${finishCalls} volte`);
  if (errs.length) console.log('❌ pageerror:', errs.slice(0, 3));
  process.exitCode = okRounds && okFinish && !errs.length ? 0 : 1;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
