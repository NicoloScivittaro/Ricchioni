// SPARATORIA DEI DISAGIATI — sessione con 4 controller + 1 telefono (M6.1, punto 12B):
//   FPS -> Results -> Roulette -> FPS
// Nessun refresh, nessuna riassociazione, nessun doppio renderer, split-screen 4p stabile in entrambi gli ingressi,
// P5 (telefono) resta nella stessa simulazione in entrambi i round.
//   node scripts/e2e/gamepad-fps-session-mixed.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, tap, until, slots, watchControls, resetControlsWatch, sceneEval, phoneText } from './padmock.mjs';

const { st, check } = makeCheck();
const F = (page, fn, arg) => sceneEval(page, 'fps', fn, arg);
const XBOX2 = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
const FAMILIES = [XBOX, DS, GENERIC, XBOX2];

const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 }); // 5 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page);
  await watchControls(page);

  for (let k = 0; k < 4; k++) await add(page, k, FAMILIES[k]);
  await sleep(500);
  for (let k = 0; k < 4; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 4, '4 controller associati (P1-P4), P5 resta col telefono per tutta la sessione');
  const pairing0 = await slots(page);
  const canvasCount = () => page.evaluate(() => document.querySelectorAll('canvas').length);
  const phaseNow = async () => (await hostSnapshot(page)).phase;
  const canvasBaseline = await canvasCount();

  let roundIdx = 0;
  async function finishRound() {
    const order = [0, 1, 2, 3, 4].map((i) => (i + roundIdx) % 5);
    roundIdx++;
    await hostEval(page, (gm, ord) => {
      const ctx = gm.minigameContext;
      const ps = ctx.players;
      const results = ord.map((playerIdx, placementIdx) => ({ playerId: ps[playerIdx].id, placement: placementIdx + 1, score: 5 - placementIdx }));
      ctx.finish({ results });
    }, order);
  }

  async function playFps(label, last) {
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
    await until(async () => (await F(page, (g) => g.splitScreen?.cams.length ?? 0)) === 4, 20000, '4 camere pronte');
    check((await F(page, (g) => g.splitScreen.cams.length)) === 4, `${label}: split-screen 4 camere (P1-P4)`);
    const players = await F(page, (g) => g.players.length);
    check(players === 5, `${label}: tutti e 5 i giocatori nella simulazione (P5 dal telefono incluso)`);
    const t5 = await phoneText(phones[4]);
    check(!/USA IL CONTROLLER/.test(t5), `${label}: telefono P5 mostra ancora il proprio renderer (non "USA IL CONTROLLER")`);
    const activeScenes = await hostEval(page, (gm) => gm.activeSceneKeys());
    check(activeScenes.filter((k) => k === 'fps').length === 1, `${label}: una sola scena 'fps' (nessun doppio renderer)`);
    await sleep(400);
    await finishRound();
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 90000, 'risultati');
    await until(async () => (last ? ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'GAME_FINISHED'] : ['NEXT_ROUND', 'MINIGAME_ROULETTE']).includes(await phaseNow()), 120000, 'rullo');
    await sleep(300);
    const cc = await canvasCount();
    check(cc === canvasBaseline, `${label}: nessun canvas residuo dopo l'uscita (${cc} attesi ${canvasBaseline})`);
  }

  await playFps('1° ingresso', false);
  check((await slots(page)) === pairing0, 'associazioni invariate dopo il 1° FPS (nessuna riassociazione)');
  await playFps('2° ingresso, via rullo', true);
  check((await slots(page)) === pairing0, 'associazioni invariate dopo il 2° FPS');
  check((await page.evaluate(() => window.__pads.pairedCount())) === 4, 'ancora 4 controller associati a fine sessione');

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
