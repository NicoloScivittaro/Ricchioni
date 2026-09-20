// CULTURA O CAZZATA con giocatori "veri" (bluff scritti e voti dai telefoni): 8 round, ritmo (~5-7 min) e fine anticipata.
// Un telefono NON risponde mai al round 3 (deve contare come bluff di riserva/nessun voto, non riusare il round 2).
//   node scripts/e2e/cultura.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const browser = await launch();
const errs = [];
let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 3; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'cultura');
  await sleep(300);
  await page.keyboard.press('Enter');
  await hostEval(page, (gm) => {
    gm.__f = 0;
    const o = gm.finishMinigame.bind(gm);
    gm.finishMinigame = (r, id) => {
      gm.__f++;
      return o(r, id);
    };
  });
  const probe = () => hostEval(page, (gm) => {
    const sc = gm.game.scene.getScene('cultura');
    return sc?.sys.isActive() ? { round: sc.round, phase: sc.phase, finished: sc.finished, bluffs: sc.bluffs ? [...sc.bluffs.values()] : [] } : null;
  });
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(300);
  const t0 = Date.now();
  const doneBluff = new Set();
  const doneVote = new Set();
  const roundStart = {};
  const bluffTexts = {}; // round -> bluff finali
  let lastP = null;
  while (Date.now() - t0 < 600000) {
    const p = await probe();
    if ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') break;
    if (p) {
      lastP = p;
      if (roundStart[p.round] === undefined) roundStart[p.round] = Date.now();
      if (p.phase === 'bluff' && !doneBluff.has(p.round)) {
        doneBluff.add(p.round);
        await Promise.all(
          phones.map(async (ph, i) => {
            if (p.round === 2 && i === 2) return; // P3 non risponde al round 3
            try {
              await ph.page.waitForSelector('#cultura-bluff', { timeout: 4000 });
              await ph.page.type('#cultura-bluff', `Risposta falsa ${p.round + 1}-${i + 1}`);
              await ph.page.click('#cultura-confirm');
            } catch {
              /* il telefono potrebbe non essere ancora sulla schermata */
            }
          })
        );
      }
      if (p.phase === 'options' && p.round === 2) bluffTexts[p.round] = await hostEval(page, (gm) => [...gm.game.scene.getScene('cultura').bluffs.values()]);
      if (p.phase === 'vote' && !doneVote.has(p.round)) {
        doneVote.add(p.round);
        await sleep(400);
        await Promise.all(
          phones.map(async (ph, i) => {
            if (p.round === 2 && i === 2) return; // niente voto al round 3
            try {
              await ph.page.waitForSelector('.cultura-opt:not([disabled]):not(.mine)', { timeout: 4000 });
              const opts = await ph.page.$$('.cultura-opt:not([disabled]):not(.mine)');
              await opts[Math.min(i, opts.length - 1)].click();
            } catch {
              /* ignora */
            }
          })
        );
      }
    }
    await sleep(350);
  }
  const total = (Date.now() - t0) / 1000;
  const calls = await hostEval(page, (gm) => gm.__f);
  console.log(`\nCultura: ${total.toFixed(0)}s (${(total / 60).toFixed(1)} min) · round visti fino a ${lastP?.round + 1} · finish() ${calls}`);
  check(lastP && lastP.round === 7, 'tutti gli 8 round eseguiti (ultimo round visto: ' + (lastP ? lastP.round + 1 : '?') + ')');
  check(calls === 1, 'risultato inviato UNA volta');
  check(total < 7 * 60, `durata sotto i 7 minuti (${(total / 60).toFixed(1)} min con giocatori che rispondono)`);
  const r3 = bluffTexts[2] ?? [];
  check(r3.length === 3 && !r3.some((t) => /risposta falsa 2-3/.test(String(t).toLowerCase())), `round 3: P3 non ha riusato il bluff del round 2 (${JSON.stringify(r3)})`);
  check(errs.length === 0, `nessun errore ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
