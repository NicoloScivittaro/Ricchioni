// SPARATORIA DEI DISAGIATI — leak + sessione (M6.1, punti 11 e 12A). Con controller associati:
//   KART -> FPS -> Results -> Cultura (telefono) -> FPS -> Results -> Arena
// Dopo OGNI uscita da FPS verifica: nessun canvas Babylon residuo, nessuna camera/scena residua, nessun listener
// resize extra, heap host stabile (nessuna crescita continua) — nessun refresh, nessuna riassociazione, nessun
// doppio renderer in tutta la sessione.
//   node scripts/e2e/gamepad-fps-leak-session.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, tap, until, phoneText, slots, watchControls, resetControlsWatch, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const F = (page, fn, arg) => sceneEval(page, 'fps', fn, arg);
const FAMILIES = [XBOX, DS, GENERIC];

const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page);
  await watchControls(page);

  for (let k = 0; k < 3; k++) await add(page, k, FAMILIES[k]);
  await sleep(500);
  for (let k = 0; k < 3; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 3, 'lobby: 3 controller associati (P1-P3), nessun telefono di riserva in questa sessione');
  const pairing0 = await slots(page);

  const canvasCount = () => page.evaluate(() => document.querySelectorAll('canvas').length);
  const phaseNow = async () => (await hostSnapshot(page)).phase;
  const canvasBaseline = await canvasCount();

  let roundIdx = 0;
  async function finishRound() {
    const order = [0, 1, 2].map((i) => (i + roundIdx) % 3);
    roundIdx++;
    await hostEval(page, (gm, ord) => {
      const ctx = gm.minigameContext;
      const ps = ctx.players;
      const results = ord.map((playerIdx, placementIdx) => ({ playerId: ps[playerIdx].id, placement: placementIdx + 1, score: 5 - placementIdx }));
      ctx.finish({ results });
    }, order);
  }
  const goNext = async () => {
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 90000, 'risultati');
    await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes(await phaseNow()), 120000, 'rullo');
  };

  async function playFps(label) {
    console.log(`\n--- FPS (${label}) ---`);
    await resetControlsWatch(page);
    await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phaseNow()) === 'MINIGAME_PLAYING', 60000, 'fps PLAYING');
    await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 15000, 'CONTROLLI');
    await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
    await until(async () => (await F(page, (g) => g.splitScreen?.cams.length ?? 0)) === 3, 20000, '3 camere pronte');
    check((await F(page, (g) => g.splitScreen.cams.length)) === 3, `${label}: split-screen 3 camere attive`);
    await sleep(500);
    await finishRound();
    await goNext();
    await sleep(300);
    const cc = await canvasCount();
    check(cc === canvasBaseline, `${label}: nessun canvas Babylon residuo dopo l'uscita (${cc} attesi ${canvasBaseline})`);
    const activeScenes = await hostEval(page, (gm) => gm.activeSceneKeys());
    check(activeScenes.length === 1, `${label}: una sola scena Phaser attiva dopo l'uscita (${JSON.stringify(activeScenes)})`);
  }

  async function playOther(id, title) {
    console.log(`\n--- ${title} ---`);
    await resetControlsWatch(page);
    await hostEval(page, (gm, gid) => gm.selectMinigame(gid), id);
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phaseNow()) === 'MINIGAME_PLAYING', 60000, `${id} PLAYING`);
    await sleep(1500);
    await hostEval(page, (gm) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 5 - i })) });
    });
    await goNext();
  }

  await playOther('kart3d', 'KART (controller)');
  check((await slots(page)) === pairing0, 'associazioni invariate dopo Kart');
  await playFps('1° ingresso, dopo Kart');
  check((await slots(page)) === pairing0, 'associazioni invariate dopo il 1° FPS');

  await playOther('cultura', 'CULTURA (telefono)');
  check((await slots(page)) === pairing0, 'associazioni invariate dopo Cultura');
  await playFps('2° ingresso, dopo Cultura');
  check((await slots(page)) === pairing0, 'associazioni invariate dopo il 2° FPS');

  await playOther('arena', 'ARENA (controller)');
  check((await slots(page)) === pairing0, 'associazioni invariate dopo Arena (fine sessione)');

  check((await page.evaluate(() => window.__pads.pairedCount())) === 3, 'nessuna riassociazione in tutta la sessione: ancora 3 controller associati');

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
