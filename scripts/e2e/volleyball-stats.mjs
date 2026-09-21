// PALLAVOLO — statistiche di bilanciamento (solo debug): riepilogo a fine partita con durata scambi, colpi/scambio, velocita' massima,
// smash fatti/ricevuti, punti diretti da smash. Non cambia nessun valore di gioco: qui si guida una partita in modo deterministico
// (servizio, smash, ricezione, smash, atterraggio) e si controllano i contatori.
//   node scripts/e2e/volleyball-stats.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser);
  const errs = [];
  const logs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'info') logs.push(m.text()); });
  const phones = [];
  for (let i = 0; i < 2; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'volleyball');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  for (let i = 0; i < 400; i++) {
    if ((await hostEval(page, (gm) => gm.game.scene.getScene('volleyball')?.game3d?.phase)) === 'playing') break;
    await sleep(150);
  }
  const r = await hostEval(page, (gm) => {
    const g = gm.game.scene.getScene('volleyball').game3d;
    const red = g.players.find((p) => p.team === 'red');
    const blue = g.players.find((p) => p.team === 'blue');
    const put = (p, x, z, y) => { p.x = x; p.z = z; p.y = y; p.vx = p.vz = p.vy = 0; p.hitCooldown = 0; };
    const ballAt = (x, y, z, vx = 0, vy = 0, vz = 0) => Object.assign(g.ball, { state: 'flying', x, y, z, vx, vy, vz, frozenTimer: 0 });
    g.redScore = 50; // il prossimo punto chiude la partita
    g.serve(red);
    // smash rosso (in salto vicino alla rete, palla alta)
    put(red, 0, -1.2, 1.2); ballAt(0, 3.2, -1.2);
    g.tryHit(red);
    // ricezione blu (palla bassa) -> lo smash e' "ricevuto"
    put(blue, 0, 4, 0); ballAt(0, 0.9, 4);
    g.tryHit(blue);
    // secondo smash rosso, che nessuno tocca
    put(red, 0, -1.2, 1.2); ballAt(0, 3.2, -1.2);
    g.tryHit(red);
    // la palla cade nel campo blu: punto rosso (e match vinto)
    ballAt(2, 0.05, 5, 0, -6, 0);
    return { touches: g.rally };
  });
  await sleep(1500);
  const stats = await hostEval(page, () => window.__volleyStats);
  console.log('   ', JSON.stringify(stats));
  console.log('   console:', logs.find((l) => /PALLAVOLO/.test(l))?.replace(/\n/g, ' | '));
  check(!!stats, 'a fine partita in debug il riepilogo e\' stato prodotto');
  check(stats?.rallies === 1, `1 scambio registrato (${stats?.rallies})`);
  check(stats?.smashes === 2, `2 smash fatti (${stats?.smashes})`);
  check(stats?.smashesReceived === 1, `1 smash ricevuto (${stats?.smashesReceived})`);
  check(stats?.smashPointsDirect === 1, `1 punto diretto da smash (${stats?.smashPointsDirect})`);
  check(stats?.avgTouches === 4, `colpi nello scambio: servizio + 3 colpi = 4 (${stats?.avgTouches})`);
  check(stats?.maxBallSpeed > 5, `velocita' massima della palla registrata (${stats?.maxBallSpeed?.toFixed(1)} u/s)`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
