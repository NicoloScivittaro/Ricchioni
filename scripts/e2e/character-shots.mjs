// IDENTITA' DEI PERSONAGGI in partita: screenshot (da guardare) di lobby, Arena con abilita' attive, Risultati, Sparatoria a 4
// giocatori col controller, Calcio (squadre) e podio finale, con i 5 personaggi. Controlla anche che non ci siano errori, che i
// ritratti esistano e che la riga di personalita' compaia in lobby.
//   VIEWPORT=1366x768 node scripts/e2e/character-shots.mjs     (anche 1920x1080; immagini in e2e-shots/characters/)
import { mkdirSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, installMock, add, tap, until, gameEval, sceneEval } from './padmock.mjs';

let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const VP = process.env.VIEWPORT ?? '1280x720';
const OUT = 'e2e-shots/characters';
mkdirSync(OUT, { recursive: true });

const browser = await launch();
try {
  // RAPIDA (30 punti): 3 vittorie dello stesso giocatore chiudono la partita -> podio
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3, scoreDownPresses: -2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack ?? e).slice(0, 1200)));
  page.on('console', (m) => /ERRSTACK/.test(m.text()) && console.log('  ', m.text().replace(/\s+/g, ' ').slice(0, 900)));
  await page.evaluate(() => {
    window.addEventListener('error', (ev) => console.log('ERRSTACK ' + (ev.error?.stack ?? ev.message)));
    window.addEventListener('unhandledrejection', (ev) => console.log('ERRSTACK ' + (ev.reason?.stack ?? ev.reason)));
  });
  const phones = [];
  const NAMES = ['NICO', 'CHRIS', 'VICTOR', 'CARBO', 'CIRO'];
  for (let i = 0; i < 5; i++) {
    phones.push(await addPhone(browser, code, NAMES[i], i));
    await sleep(250);
    if (i === 3) {
      await sleep(400);
      await page.screenshot({ path: `${OUT}/${VP}-lobby.png` });
    }
  }
  const spot = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
    const { game: gm } = await import(url);
    const s = gm.game.scene.getScene('RoomScene');
    return s?.spotText?.text ?? '';
  });
  check(/CIRO È IL NAPOLETANO STEMPIATO/.test(spot) && /Pagherà/.test(spot), `lobby: riga di personalita' del personaggio appena scelto ("${spot.slice(0, 60)}")`);
  const tex = await hostEval(page, (gm) => ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'].every((id) => gm.game.textures.exists(`portrait_${id}`)));
  check(tex, 'ritratti rotondi dei 5 personaggi creati al boot');
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));

  // 4 controller (Xbox, DualSense, generico, Xbox) sui primi 4, il 5° gioca col telefono
  await installMock(page);
  for (let k = 0; k < 4; k++) await add(page, k, [XBOX, DS, GENERIC, XBOX][k]);
  await sleep(400);
  for (let k = 0; k < 4; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  await page.evaluate(() => {
    const el = document.getElementById('pad-root');
    if (el) el.style.display = 'none';
  });

  const phase = async () => (await hostSnapshot(page)).phase;
  const start = async (id) => {
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    if ((await phase()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phase()) === 'MINIGAME_PLAYING', 120000, `${id} PLAYING`);
  };
  const finish = async (winnerIdx) => {
    await hostEval(page, (gm, w) => {
      const ctx = gm.minigameContext;
      const ids = ctx.players.map((p) => p.id);
      const order = [ids[w], ...ids.filter((_, i) => i !== w)];
      ctx.finish({ results: order.map((id, k) => ({ playerId: id, placement: k + 1, score: 10 - k })) });
    }, winnerIdx);
  };
  const next = async () => {
    await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'GAME_FINISHED'].includes(await phase()), 120000, 'dopo i risultati');
  };

  // ---- ARENA: i 5 in campo, due abilita' attive (nome sopra la testa + simbolo + VFX)
  await start('arena');
  await until(async () => (await gameEval(page, 'arena', (g) => g.phase)) === 'playing', 60000, 'arena via');
  await sleep(1200);
  await gameEval(page, 'arena', (g, ids) => {
    g.entities.get(ids[0])?.playAbility('NCULO!');
    g.entities.get(ids[4])?.playAbility('PAGO DOPO');
    g.entities.get(ids[2])?.react('bigHit', true);
  }, pids);
  await sleep(300);
  await page.screenshot({ path: `${OUT}/${VP}-arena.png` });
  check(true, 'Arena: screenshot con abilita\' e battuta');
  await finish(0);
  await until(async () => (await phase()) === 'ROUND_RESULTS', 60000, 'risultati arena');
  await sleep(6500);
  await page.screenshot({ path: `${OUT}/${VP}-results.png` });
  check(true, 'Risultati: screenshot con ritratti e reazioni');
  await next();

  // ---- CALCIO: squadre rosse/blu, l'identita' resta su testa/accessori/targhetta
  await start('soccer');
  await until(async () => (await gameEval(page, 'soccer', (g) => g.phase)) === 'playing', 90000, 'calcio via');
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/${VP}-soccer.png` });
  check(true, 'Calcio: screenshot squadre');
  await finish(1); // vince un altro: con un "punti doppi" estratto dal rullo la partita non deve chiudersi prima della Sparatoria
  await next();

  // ---- SPARATORIA: 4 finestre (controller) + il 5° dal telefono
  await start('fps');
  await until(async () => (await sceneEval(page, 'fps', (g) => g.controlsDone && (g.splitScreen?.cams.length ?? 0) === 4)) === true, 60000, 'split-screen 4p');
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/${VP}-fps4p.png` });
  check(true, 'Sparatoria: screenshot 4 finestre');
  await finish(0);
  // fino al podio: altri round veloci vinti dallo stesso giocatore (RAPIDA 30 punti)
  for (let guard = 0; guard < 6; guard++) {
    await next();
    if ((await phase()) === 'GAME_FINISHED') break;
    await start('reaction');
    await finish(0);
  }
  await until(async () => (await phase()) === 'GAME_FINISHED', 120000, 'fine partita');
  await sleep(7500);
  await page.screenshot({ path: `${OUT}/${VP}-podium.png` });
  check(true, 'Podio: screenshot finale');
  check(errs.length === 0, `nessun errore di pagina${errs.length ? ' ' + errs.join(' | ') : ''}`);
} finally {
  await browser.close();
}
console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
