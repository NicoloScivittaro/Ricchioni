// AUDIT UI a screenshot (PRIMA/DOPO): lobby, stanza, controlli, countdown, HUD dei giochi (Kart e Sparatoria a 5 finestre),
// Memoria/Botta al Volo/Quiz/Cultura, risultati, classifica, rullo (giro e stop), podio, telefono (passivo, ripiego,
// Cultura), controller scollegato. 5 giocatori, 5 controller, un nome lungo (stress).
//   VIEWPORT=1920x1080 OUT=e2e-shots/ui TAG=after node scripts/e2e/ui-shots.mjs
//   GAMES=arena,kart3d (sottoinsieme)   SHORT=1 (solo lobby, stanza, kart, fps, risultati: per il 4K)
import { launch, HOST_URL, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, installMock, add, remove, tap, until } from './padmock.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.env.OUT ?? 'e2e-shots/ui');
const TAG = process.env.TAG ?? 'after';
const VP = process.env.VIEWPORT ?? '1366x768';
const SHORT = !!process.env.SHORT;
const GAMES = (process.env.GAMES ?? (SHORT ? 'kart3d,fps' : 'arena,soccer,volleyball,dodgeball,kart3d,fps,memory,reaction,quiz,cultura')).split(',');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${VP}.png`) });
  console.log('📸', name);
};
const phase = async (page) => (await hostSnapshot(page)).phase;
const browser = await launch();
try {
  // ---- LOBBY (prima della stanza)
  {
    const p = await browser.newPage();
    await p.goto(HOST_URL, { waitUntil: 'load' });
    await sleep(3500);
    await shot(p, 'lobby');
    await p.close();
  }
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3, scoreDownPresses: 2 });
  const names = ['Nicolò', 'Christian', 'Carbo', 'Victor', 'Massimiliano Esposito'];
  const phones = [];
  for (let i = 0; i < 5; i++) phones.push(await addPhone(browser, code, names[i], i));
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page);
  const ids = [XBOX, DS, GENERIC, XBOX + ' B', DS + ' B'];
  for (let k = 0; k < 5; k++) await add(page, k, ids[k]);
  await sleep(800);
  for (let k = 0; k < 4; k++) {
    for (let t = 0; t < 3 && (await page.evaluate((id) => window.__pads.slotOf(id)?.state, pids[k])) !== 'paired'; t++) {
      await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
      await tap(page, k, 'A');
      await sleep(200);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  await sleep(1200);
  await shot(page, 'room-4pad-1phone');
  await phones[4].page.screenshot({ path: path.join(OUT, `${TAG}-phone-room-${VP}.png`) });
  // quinto controller (Kart e Sparatoria a 5 finestre)
  for (let t = 0; t < 3 && (await page.evaluate((id) => window.__pads.slotOf(id)?.state, pids[4])) !== 'paired'; t++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[4]);
    await tap(page, 4, 'A');
    await sleep(200);
  }
  await page.evaluate(() => window.__pads.setTarget(null));

  let gi = 0;
  for (const id of GAMES) {
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    if ((await phase(page)) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phase(page)) === 'MINIGAME_INTRO', 60000, 'intro').catch(() => {});
    if (gi === 0) {
      await sleep(900);
      await shot(page, 'intro');
    }
    await until(async () => (await phase(page)) === 'MINIGAME_PLAYING', 120000, `${id} PLAYING`);
    const ctrl = () => page.evaluate(() => !!document.getElementById('pad-controls'));
    await until(ctrl, 15000, 'controlli').catch(() => {});
    if (gi === 0 || id === 'quiz') {
      await sleep(400);
      await shot(page, `controls-${id}`);
    }
    await until(async () => !(await ctrl()), 30000, 'controlli giu').catch(() => {});
    if (gi === 0) {
      await sleep(250);
      await shot(page, `countdown-${id}`);
    }
    await sleep(id === 'kart3d' ? 5000 : 3600);
    await shot(page, `hud-${id}`);
    if (id === 'arena') {
      await phones[0].page.screenshot({ path: path.join(OUT, `${TAG}-phone-passive-${VP}.png`) });
      // controller scollegato a meta' partita: avviso + il telefono diventa il controller
      await remove(page, 3);
      await sleep(1200);
      await shot(page, 'pad-disconnected');
      await phones[3].page.screenshot({ path: path.join(OUT, `${TAG}-phone-fallback-${VP}.png`) });
      await add(page, 3, ids[3]);
      await sleep(800);
      await tap(page, 3, 'A'); // riconnessione: il controller torna a Victor (Sparatoria di nuovo a 5 finestre)
      await sleep(1200);
      await shot(page, 'pad-reconnected');
    }
    if (id === 'cultura') {
      await sleep(1500);
      await phones[0].page.screenshot({ path: path.join(OUT, `${TAG}-phone-cultura-${VP}.png`) });
    }
    // vincitore a rotazione: la serata non finisce prima del rullo
    await hostEval(page, (gm, k) => {
      const ctx = gm.minigameContext;
      const n = ctx.players.length;
      ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: ((i + k) % n) + 1, score: 10 - ((i + k) % n), stats: ['7 colpi a segno', 'miglior tempo 0.31s'] })) });
    }, gi);
    await until(async () => (await phase(page)) === 'ROUND_RESULTS', 30000, 'risultati');
    if (gi === 0) {
      await sleep(5200);
      await shot(page, 'results');
      await until(async () => (await phase(page)) === 'GLOBAL_LEADERBOARD', 30000, 'classifica').catch(() => {});
      await sleep(1600);
      await shot(page, 'leaderboard');
    }
    await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'GLOBAL_LEADERBOARD'].includes(await phase(page)), 30000, 'dopo').catch(() => {});
    await sleep(400);
    gi++;
  }
  // ---- RULLO: in giro e allo stop
  await until(async () => (await phase(page)) === 'MINIGAME_ROULETTE', 90000, 'rullo').catch(() => {});
  await sleep(1100);
  await shot(page, 'roulette-spin');
  // stop: il rullo mostra il gioco uscito (testo "PROSSIMO GIOCO" o "PREPARATEVI")
  await until(() => hostEval(page, (gm) => (gm.game.scene.getScene('RouletteScene')?.children?.list ?? []).some((o) => typeof o.text === 'string' && /PROSSIMO GIOCO|PREPARATEVI/.test(o.text))), 20000, 'stop').catch(() => {});
  await sleep(700);
  await shot(page, 'roulette-stop');

  // ---- PODIO: si chiude la serata con un vincitore chiaro
  if (!SHORT) {
    for (let g = 0; g < 25 && (await phase(page)) !== 'GAME_FINISHED'; g++) {
      const ph = await phase(page);
      if (ph === 'MINIGAME_PLAYING') {
        await hostEval(page, (gm) => {
          const ctx = gm.minigameContext;
          ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 10 - i })) });
        });
      } else if (['NEXT_ROUND', 'LOBBY', 'ROUND_RESULTS', 'GLOBAL_LEADERBOARD', 'MINIGAME_ROULETTE', 'MINIGAME_INTRO'].includes(ph)) {
        await hostEval(page, (gm) => gm.skip());
      }
      await sleep(900);
    }
    await sleep(4500);
    await shot(page, 'podium');
  }
} finally {
  await browser.close();
}
