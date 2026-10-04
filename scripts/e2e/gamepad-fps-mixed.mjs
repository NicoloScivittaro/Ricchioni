// SPARATORIA DEI DISAGIATI — 4 CONTROLLER + 1 TELEFONO (M6.1, punto 3: il setup reale piu' probabile se il
// browser/OS espone solo 4 slot gamepad). P1-P4 col controller in split-screen sul PC, P5 dal telefono col
// renderer 3D di sempre (fpsClient, invariato) — TUTTI nella STESSA simulazione FpsScene: si vedono a vicenda, si
// colpiscono a vicenda, un solo scoreboard, un solo timer, nessuna doppia simulazione. Verifica anche che il
// telefono di chi ha il controller NON crei il renderer 3D (nessun canvas, nessun render loop, nessun fpsClient).
//   node scripts/e2e/gamepad-fps-mixed.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, tap, until, sceneEval, watchControls, phoneText } from './padmock.mjs';

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
  const [P1, P2, P3, P4, P5] = pids;
  await installMock(page);
  await watchControls(page);

  // Solo P1-P4 hanno un controller: P5 resta col telefono (il caso reale piu' probabile: browser/OS con solo 4 slot).
  for (let k = 0; k < 4; k++) await add(page, k, FAMILIES[k]);
  await sleep(500);
  for (let k = 0; k < 4; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 4, '4 controller associati (P1-P4), P5 resta col telefono');

  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
  await sleep(300);
  await page.keyboard.press('Enter');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 60000, 'fps PLAYING');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 15000, 'CONTROLLI');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  await until(async () => (await F(page, (g) => g.splitScreen?.cams.length ?? 0)) === 4, 20000, '4 camere split-screen pronte');
  await sleep(400);

  // ---- UNA SOLA SIMULAZIONE: una sola scena 'fps' attiva sull'host, un solo array giocatori con tutti e 5
  const activeScenes = await hostEval(page, (gm) => gm.activeSceneKeys());
  check(activeScenes.filter((k) => k === 'fps').length === 1, `una sola scena 'fps' attiva sull'host (${JSON.stringify(activeScenes)})`);
  const allPlayers = await F(page, (g) => g.players.map((p) => p.id));
  check(allPlayers.length === 5 && new Set(allPlayers).size === 5, `tutti e 5 i giocatori nella STESSA simulazione, nessun duplicato (${allPlayers.length})`);

  // ---- SPLIT-SCREEN: 4 camere (P1-P4), P5 NON ha una camera qui ma esiste come avatar (lo vedono P1-P4)
  const info = await F(page, (g, a) => ({
    camCount: g.splitScreen.cams.length,
    camPlayers: g.splitScreen.cams.map((c) => c.playerId),
    p5HasCamera: g.splitScreen.cams.some((c) => c.playerId === a.p5),
    p5AvatarExists: g.splitScreen.avatars.has(a.p5) // creato al primo update() con lo snapshot di P5
  }), { p5: P5 });
  check(info.camCount === 4, `split-screen: 4 camere (solo chi ha il controller), P5 nessuna camera qui (${info.camCount})`);
  check(!info.p5HasCamera, 'P5 (telefono) NON ha una camera nello split-screen (corretto: gioca dal telefono)');
  check(info.camPlayers.join(',') === [P1, P2, P3, P4].join(','), 'le 4 camere sono esattamente P1-P4, in ordine di stanza');

  // ---- P1-P4 VEDONO P5: la sua capsula esiste nella scena split-screen (aggiornata ogni frame dallo snapshot)
  await sleep(400); // un altro update() per essere sicuri che l'avatar di P5 sia stato creato
  const p5Avatar = await F(page, (g, a) => g.splitScreen.avatars.has(a.p5), { p5: P5 });
  check(p5Avatar, 'P1-P4 vedono P5: la sua capsula esiste nella scena split-screen (aggiornata dallo stato condiviso)');

  // ---- IL TELEFONO DI CHI HA IL CONTROLLER (P1-P4): NESSUN renderer 3D, NESSUN canvas, NESSUN fpsClient
  for (let i = 0; i < 4; i++) {
    const t = await phoneText(phones[i]);
    check(/USA IL CONTROLLER/.test(t) && /GUARDA LA TUA FINESTRA SULLA TV/.test(t), `telefono P${i + 1} (ha il controller): "USA IL CONTROLLER" + "GUARDA LA TUA FINESTRA SULLA TV" ("${t.slice(0, 70)}")`);
    const hasFpsCanvasHost = await phones[i].page.evaluate(() => !!document.getElementById('fps-canvas'));
    check(!hasFpsCanvasHost, `telefono P${i + 1}: nessun contenitore #fps-canvas (renderFpsController mai chiamato)`);
    const canvasCountOnPhone = await phones[i].page.evaluate(() => document.querySelectorAll('canvas').length);
    check(canvasCountOnPhone === 0, `telefono P${i + 1}: nessun <canvas> (nessun render loop Babylon, nessun consumo GPU inutile): ${canvasCountOnPhone}`);
  }

  // ---- IL TELEFONO DI P5 (senza controller): renderer 3D di sempre, invariato
  const p5Text = await phoneText(phones[4]);
  check(!/USA IL CONTROLLER/.test(p5Text), `telefono P5 (nessun controller): NON mostra "USA IL CONTROLLER" ("${p5Text.slice(0, 40)}")`);
  const p5CanvasCount = await phones[4].page.evaluate(() => document.querySelectorAll('canvas').length);
  check(p5CanvasCount >= 1, `telefono P5: renderer 3D presente come sempre (${p5CanvasCount} canvas)`);

  // ---- HIT RECIPROCI: P5 colpisce P1, P1 colpisce P5 — stessa simulazione, stessa applyDamage per entrambi
  await F(page, (g, a) => {
    const p1 = g.players.find((p) => p.id === a.p1);
    const p5 = g.players.find((p) => p.id === a.p5);
    p1.x = 6; p1.z = 6; p1.hp = 100; p1.alive = true; p1.spawnProtection = 0; p1.deaths = 0; p1.kills = 0;
    p5.x = 6; p5.z = 6; p5.hp = 100; p5.alive = true; p5.spawnProtection = 0; p5.deaths = 0; p5.kills = 0;
  }, { p1: P1, p5: P5 });
  const p5HitsP1 = await F(page, (g, a) => {
    const p1 = g.players.find((p) => p.id === a.p1);
    const p5 = g.players.find((p) => p.id === a.p5);
    return g.applyDamage(p1, 30, p5);
  }, { p1: P1, p5: P5 });
  const p1AfterP5Hit = await F(page, (g, a) => g.players.find((p) => p.id === a.p1).hp, { p1: P1 });
  check(p5HitsP1 === true && p1AfterP5Hit === 70, `P5 (telefono) colpisce P1 (controller): danno applicato (HP ${p1AfterP5Hit})`);
  const p1HitsP5 = await F(page, (g, a) => {
    const p1 = g.players.find((p) => p.id === a.p1);
    const p5 = g.players.find((p) => p.id === a.p5);
    return g.applyDamage(p5, 1000, p1);
  }, { p1: P1, p5: P5 });
  const p5AfterKill = await F(page, (g, a) => { const p5 = g.players.find((p) => p.id === a.p5); return { alive: p5.alive, deaths: p5.deaths }; }, { p5: P5 });
  const p1AfterKill = await F(page, (g, a) => g.players.find((p) => p.id === a.p1).kills, { p1: P1 });
  check(p1HitsP5 === true && p5AfterKill.alive === false && p5AfterKill.deaths === 1, `P1 (controller) colpisce/uccide P5 (telefono): morte contata una volta sola (viva ${p5AfterKill.alive}, morti ${p5AfterKill.deaths})`);
  check(p1AfterKill === 1, `kill attribution corretta anche verso un player col telefono: P1 +1 kill (${p1AfterKill})`);
  await until(async () => (await F(page, (g, a) => g.players.find((p) => p.id === a.p5).alive, { p5: P5 })), 8000, 'respawn P5');
  const p5Respawned = await F(page, (g, a) => { const p5 = g.players.find((p) => p.id === a.p5); return { hp: p5.hp, alive: p5.alive }; }, { p5: P5 });
  check(p5Respawned.hp === 100 && p5Respawned.alive, `respawn corretto anche per il player col telefono (HP ${p5Respawned.hp})`);

  // ---- SCOREBOARD/TIMER UNICI: un solo matchTime, i kill di P1 sono visibili nel radar/classifica condivisi
  const shared = await F(page, (g) => ({ matchTime: g.matchTime, playersInBoard: g.players.length }));
  check(typeof shared.matchTime === 'number' && shared.playersInBoard === 5, `timer e classifica condivisi da tutti e 5 (matchTime ${shared.matchTime.toFixed(1)}, giocatori in classifica ${shared.playersInBoard})`);

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
