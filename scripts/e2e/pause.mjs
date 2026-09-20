// PAUSA (ESC host) e RIAVVIO minigioco: timer/gameplay fermi, telefoni in PAUSA, RIPRENDI ok, RICOMINCIA senza toccare
// i punteggi globali e senza listener duplicati.   GAME=reaction|arena node scripts/e2e/pause.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';

const GAME = process.env.GAME ?? 'reaction';
const browser = await launch();
const errs = [];
let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser);
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('HOST console ' + m.text().slice(0, 160));
  });
  const phones = [];
  for (let i = 0; i < 2; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), GAME);
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(300);
  await sleep(GAME === 'reaction' ? 4000 : 9000); // countdown 3D finito

  // tempo di gioco letto dalla scena reale (Phaser: gameTime; 3D: gameTime/matchTime del game3d)
  const clock = () =>
    hostEval(page, (gm, id) => {
      const sc = gm.game.scene.getScene(id);
      const g = sc.game3d;
      return g ? { t: g.gameTime ?? g.race?.raceTime ?? 0, paused: g.paused } : { t: sc.gameTime, paused: null };
    }, GAME);
  const listeners = () => page.evaluate(() => window.__lc ?? 0);
  const before = await hostEval(page, (gm) => ({ roundId: gm.state.roundId, scores: gm.state.players.map((p) => p.score) }));

  // ---- PAUSA ----
  const c0 = await clock();
  await page.keyboard.press('Escape');
  await sleep(1200);
  let snap = await hostSnapshot(page);
  const srvPaused = await hostEval(page, (gm) => gm.state.paused === true);
  check(srvPaused, 'server: stanza in pausa (paused=true)');
  const v = await phoneView(phones[0].page);
  check(v.pause === true, 'telefono: overlay PAUSA visibile');
  const cA = await clock();
  await sleep(2500);
  const cB = await clock();
  check(Math.abs(cB.t - cA.t) < 0.05, `timer di gioco fermo in pausa (${cA.t.toFixed(2)} → ${cB.t.toFixed(2)})`);
  if (cB.paused !== null) check(cB.paused === true, 'gioco 3D: paused=true');

  // ---- RIPRENDI ----
  await page.keyboard.press('Escape');
  await sleep(1200);
  const srvPaused2 = await hostEval(page, (gm) => gm.state.paused === true);
  check(!srvPaused2, 'server: pausa tolta dopo ESC');
  const v2 = await phoneView(phones[0].page);
  check(v2.pause === false, 'telefono: overlay PAUSA sparito');
  const cC = await clock();
  await sleep(2500);
  const cD = await clock();
  check(cD.t - cC.t > 1, `timer di gioco riparte (${cC.t.toFixed(2)} → ${cD.t.toFixed(2)})`);

  // ---- RICOMINCIA (menu: ESC → giù → INVIO → conferma) ----
  if (GAME === 'reaction') {
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.keyboard.press('ArrowDown');
    await sleep(200);
    await page.keyboard.press('Enter'); // RICOMINCIA MINIGIOCO → conferma
    await sleep(300);
    await page.keyboard.press('ArrowDown'); // seleziona RICOMINCIA (2ª voce)
    await sleep(200);
    await page.keyboard.press('Enter');
    await sleep(1500);
    snap = await hostSnapshot(page);
    const after = await hostEval(page, (gm) => ({ roundId: gm.state.roundId, scores: gm.state.players.map((p) => p.score), paused: gm.state.paused === true, phase: gm.state.phase }));
    const rc = await hostEval(page, (gm, id) => gm.game.scene.getScene(id).round, GAME);
    check(after.phase === 'MINIGAME_PLAYING' && snap.active.length === 1 && snap.active[0] === GAME, `dopo RICOMINCIA: ancora ${GAME}, una sola scena (${JSON.stringify(snap.active)})`);
    check(after.roundId === before.roundId, 'stesso round/roundId (nessun round contato in più)');
    check(JSON.stringify(after.scores) === JSON.stringify(before.scores), 'punteggi globali invariati');
    check(!after.paused, 'server: non più in pausa dopo RICOMINCIA');
    check(rc <= 1, `gioco ripartito da capo (round=${rc})`);
  }
  check(errs.length === 0, `nessun errore ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
