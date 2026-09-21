// TELEMETRIA DI SESSIONE (solo debug): gioco 1 finito con risultati (durata, giocatori, vincitore, FPS, metriche), gioco 2 con un telefono
// che cade e poi SALTATO. Controlla il SESSION REPORT e che in produzione non esista nulla.
//   node scripts/e2e/telemetry.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 150)));
  const phones = [];
  for (let i = 0; i < 3; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  const until = async (fn, ms, what) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await fn()) return true;
      await sleep(200);
    }
    throw new Error('timeout: ' + what);
  };
  // ---- gioco 1: dodgeball, finito con risultati ----
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'dodgeball');
  await sleep(300);
  await page.keyboard.press('Enter');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 40000, 'PLAYING 1');
  await until(async () => (await hostEval(page, (gm) => gm.game.scene.getScene('dodgeball')?.game3d?.phase)) === 'playing', 30000, 'via dodgeball');
  await sleep(4000); // qualche secondo di FPS
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 3 - i })) });
  });
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 30000, 'RESULTS 1');
  await sleep(1500);
  const s1 = await hostEval(page, () => JSON.parse(JSON.stringify(window.__session ?? null)));
  check(!!s1 && s1.records.length === 1, 'la telemetria e\' attiva in debug e ha registrato il primo gioco');
  const r1 = s1?.records[0];
  check(r1?.game === 'dodgeball' && r1.players === 3, `gioco 1: ${r1?.name}, ${r1?.players} giocatori`);
  check(r1?.durationSec > 3, `durata registrata (${r1?.durationSec?.toFixed(1)} s)`);
  check(r1?.placements.length === 3 && !!r1.winner, `piazzamenti e vincitore (${r1?.winner})`);
  check(r1?.fps.length >= 2 && r1.fps.every((f) => f >= 0), `FPS dell'host campionati (${r1?.fps.join(',')})`);
  check(typeof r1?.metrics === 'object', "campo metriche presente (con finish forzato e' vuoto: le metriche vere le produce buildResults, vedi volleyball-stats.mjs)");

  // ---- gioco 2: un telefono cade, poi skip ----
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 40000, 'prossimo round');
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'reaction');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 60000, 'PLAYING 2');
  await sleep(1500);
  await phones[2].ctx.close(); // il telefono 3 sparisce
  await until(async () => (await hostEval(page, () => window.__session.totals.disconnects)) >= 1, 30000, 'disconnessione vista');
  await hostEval(page, (gm) => gm.skipMinigame());
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_ROULETTE' || (await hostSnapshot(page)).phase === 'NEXT_ROUND', 30000, 'dopo lo skip');
  await sleep(1200);
  const report = await hostEval(page, () => window.__sessionReport());
  console.log(report.split('\n').map((l) => '   ' + l).join('\n'));
  check(/SESSION REPORT/.test(report) && /dodgeball|DODGEBALL/i.test(report), 'SESSION REPORT stampabile con i giochi');
  check(/SALTATO/.test(report), 'il gioco saltato e\' segnato SALTATO');
  const s2 = await hostEval(page, () => JSON.parse(JSON.stringify(window.__session)));
  check(s2.totals.skips === 1 && s2.totals.disconnects >= 1, `totali: skip ${s2.totals.skips}, disconnessioni ${s2.totals.disconnects}`);
  check(s2.records[1]?.disconnects.length >= 1, 'la disconnessione e\' attribuita al gioco in corso');
  // F4: pannello a schermo
  await page.keyboard.press('F4');
  await sleep(400);
  const shown = await page.evaluate(() => [...document.querySelectorAll('pre')].some((p) => /SESSION REPORT/.test(p.textContent ?? '') && p.style.display !== 'none'));
  check(shown, 'F4 mostra il SESSION REPORT sull\'host');
  check(errs.length === 0, `nessun errore di pagina sull'host ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
