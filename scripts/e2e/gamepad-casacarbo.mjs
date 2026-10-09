// CASA CARBO col controller: 3 giocatori MISTI (P1 Xbox = Goblin, P2 DualSense = Boschi, P3 telefono = Victor).
//   - schermata CONTROLLI: nome, comandi, sezione ABILITA', ~5 s, gioco fermo
//   - mappatura vera pad -> gioco: stick, X tiracqua, Y secchio, A scatto, B interagisci, RB/R1 abilita'
//   - il gioco risponde: corsa, tiracqua che sposta l'acqua, secchio che raccoglie e si svuota allo scarico (punti), porta contenuta,
//     abilita' (e avviso privato quando non puo' partire)
//   - Companion Card col controller (niente tasti di gioco), croce + tasti per chi non ha il controller
//   node scripts/e2e/gamepad-casacarbo.mjs
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, btn, stick, tap, until, phoneText, watchControls, startGame, finishNow, pressedOf, axisOf } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [P1, P2, P3] = pids;
  await installMock(page);
  await add(page, 0, XBOX);
  await add(page, 1, DS);
  await sleep(500);
  for (let k = 0; k < 2; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    for (let t = 0; t < 6 && (await page.evaluate(() => window.__pads.pairedCount())) < k + 1; t++) {
      await tap(page, k, 'A');
      await sleep(500);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox) e P2 (DualSense) col controller, P3 col telefono');
  await watchControls(page);
  await page.evaluate(() => {
    window.__lt = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: false });
  });

  // ------------------------------------------------------------ CONTROLLI
  await startGame(page, 'casacarbo');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await sleep(500);
  await page.screenshot({ path: 'e2e-shots/casacarbo/controls-screen.png' });
  const t0 = await page.evaluate(() => window.__casacarbo?.sim.time ?? -1);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 9000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  const lts = await page.evaluate((a) => window.__lt.filter((e) => e[0] + e[1] > a.s && e[0] < a.h), { s: cc.shownAt, h: cc.hiddenAt });
  // in headless (SwiftShader) un frame puo' durare 1 s: il timer da 5 s scatta appena il thread si libera
  const blockedAtDeadline = lts.some(([s, d]) => s <= cc.shownAt + 5000 && s + d >= cc.shownAt + 4950);
  check(dur >= 4700 && (dur <= 5700 || blockedAtDeadline), `durata CONTROLLI ${Math.round(dur)} ms${dur > 5700 ? ' (scadenza dentro un frame lungo del renderer software)' : ''}`);
  check(/CASA CARBO/.test(cc.text) && /LEFT STICK MUOVITI/.test(cc.text) && /X \/ □ TIRACQUA/.test(cc.text) && /Y \/ △ SECCHIO/.test(cc.text) && /A \/ ✕ SCATTO/.test(cc.text) && /B \/ ◯ PORTE/.test(cc.text), `comandi: "${cc.text.slice(0, 220)}"`);
  check(/ABILITÀ/.test(cc.text) && /N'CULO, MO ASCIUGO IO!/.test(cc.text) && /TU QUA NON ENTRI!/.test(cc.text) && /M'HO SVEJATO/.test(cc.text), 'CONTROLLI: una riga per l\'abilita\' di ogni personaggio presente');
  const tAfter = await page.evaluate(() => window.__casacarbo?.sim.time ?? -1);
  check(t0 === 0 && tAfter === 0, `gioco FERMO durante i CONTROLLI (tempo ${t0} -> ${tAfter})`);
  await until(async () => (await page.evaluate(() => window.__casacarbo?.phase)) === 'playing', 40000, 'via');

  // ------------------------------------------------------------ mappatura
  const held = async (idx, pid, name, control) => {
    await btn(page, idx, name, true);
    await sleep(600);
    const v = await pressedOf(page, pid, control);
    await btn(page, idx, name, false);
    await sleep(250);
    return v;
  };
  check(await held(0, P1, 'X', 'squeegee'), 'X/□ = TIRACQUA');
  check(await held(0, P1, 'Y', 'bucket'), 'Y/△ = SECCHIO');
  check(await held(0, P1, 'A', 'dash'), 'A/✕ = SCATTO');
  check(await held(0, P1, 'B', 'interact'), 'B/◯ = INTERAGISCI');
  check(await held(0, P1, 'RB', 'ability'), 'RB = ABILITÀ (Xbox)');
  check(await held(1, P2, 'RB', 'ability'), 'R1 = ABILITÀ (DualSense)');
  await stick(page, 0, 0.9, -0.7);
  await sleep(500);
  const ax = await axisOf(page, P1);
  check(ax.x > 0.6 && ax.y < -0.4, `stick sinistro -> move (${ax.x.toFixed(2)}, ${ax.y.toFixed(2)})`);
  await stick(page, 0, 0, 0);

  // ------------------------------------------------------------ il gioco risponde
  const setup = (i, x, y) => page.evaluate((a) => {
    const w = window.__casacarbo.sim;
    const p = w.players[a.i];
    Object.assign(p, { x: a.x, y: a.y, vx: 0, vy: 0, bucket: 0, slipT: 0, dashT: 0 });
  }, { i, x, y });
  const P = (i) => page.evaluate((k) => { const p = window.__casacarbo.sim.players[k]; return { x: p.x, y: p.y, bucket: p.bucket, drained: p.stats.drainedBucket + p.stats.drainedSqueegee, containing: p.containing, charges: p.ab.charges, windup: p.ab.windupT, cd: p.ab.cooldown }; }, i);
  await setup(0, 540, 370);
  await setup(1, 1150, 600);
  await setup(2, 1250, 300);
  await sleep(200);
  const a = await P(0);
  await stick(page, 0, 1, 0);
  await sleep(800);
  const b = await P(0);
  check(b.x > a.x + 60, `stick destra: il personaggio corre (${a.x.toFixed(0)} -> ${b.x.toFixed(0)} px)`);
  await stick(page, 0, 0, 0);
  // secchio: acqua versata in pagina, Y tenuto raccoglie, poi Y vicino al lavello svuota
  await page.evaluate(() => {
    const w = window.__casacarbo.sim;
    for (let y = 590; y < 640; y += 20) for (let x = 540; x < 660; x += 20) {
      const k = Math.floor((y - 40) / 20) * 68 + Math.floor((x - 60) / 20);
      if (w.grid.floor[k]) w.h[k] += 1.2;
    }
  });
  await setup(0, 600, 615);
  await btn(page, 0, 'Y', true);
  await sleep(1800);
  await btn(page, 0, 'Y', false);
  await sleep(600); // headless: un frame puo' durare ~1 s, rilascio e nuova pressione non devono cadere fra due letture del pad
  const c = await P(0);
  check(c.bucket > 1, `Y tenuto: il secchio raccoglie (${c.bucket.toFixed(2)})`);
  await setup(0, 600, 615);
  await page.evaluate(() => { const p = window.__casacarbo.sim.players[0]; p.bucket = 4; p.x = 600; p.y = 488; });
  await tap(page, 0, 'Y', 900); // pressione lunga: con frame lenti un tocco breve puo' cadere fra due letture del pad
  await sleep(300);
  const d = await P(0);
  check(d.bucket < 0.3 && d.drained >= 3.9, `Y allo scarico del bagno: svuotato e contato (+${d.drained.toFixed(1)})`);
  // tiracqua: X tenuto e stick spingono l'acqua
  // (zona libera fra tavolo e muro di fondo; il baricentro si misura solo li', la pioggia alle porte non conta)
  await page.evaluate(() => {
    const w = window.__casacarbo.sim;
    for (let k = 0; k < w.h.length; k++) {
      const x = (k % 68) * 20 + 70, y = Math.floor(k / 68) * 20 + 50;
      if (x > 530 && x < 790 && y > 600 && y < 700) w.h[k] = w.grid.floor[k] && x > 560 && x < 660 && y > 640 ? 0.8 : 0;
    }
  });
  const centroid = () => page.evaluate(() => {
    const w = window.__casacarbo.sim;
    let s = 0, m = 0;
    for (let k = 0; k < w.h.length; k++) {
      const x = (k % 68) * 20 + 70, y = Math.floor(k / 68) * 20 + 50;
      if (x > 530 && x < 790 && y > 600 && y < 700 && w.h[k] > 0) { s += x * w.h[k]; m += w.h[k]; }
    }
    return m > 0 ? s / m : 0;
  });
  await setup(0, 545, 670);
  const cx0 = await centroid();
  await btn(page, 0, 'X', true);
  await stick(page, 0, 1, 0);
  await sleep(1100);
  await stick(page, 0, 0, 0);
  await btn(page, 0, 'X', false);
  const cx1 = await centroid();
  check(cx1 > cx0 + 10, `X tenuto + stick: il tiracqua sposta l'acqua (${cx0.toFixed(0)} -> ${cx1.toFixed(0)} px)`);
  // B vicino alla porta: contenimento
  await setup(0, 847, 200);
  await btn(page, 0, 'B', true);
  await sleep(700);
  const e = await P(0);
  await btn(page, 0, 'B', false);
  check(e.containing === 'front', 'B tenuto davanti alla porta: la contiene');
  // RB: abilita' del Goblin (spazzata) e di Boschi lontano dalla porta (avviso privato)
  await setup(0, 600, 615);
  await tap(page, 0, 'RB', 400);
  await sleep(200);
  const g = await P(0);
  check(g.charges === 1 || g.windup > 0 || g.cd > 0, 'RB del Goblin: parte la spazzata');
  await setup(1, 1150, 600);
  await tap(page, 1, 'RB', 400);
  await sleep(500);
  const toast = await phones[1].page.evaluate(() => document.getElementById('ab-fail-toast')?.textContent ?? '');
  check(/PORTA/.test(toast), `R1 di Boschi lontano dalle porte: avviso privato "${toast}"`);

  // ------------------------------------------------------------ telefoni
  const p1card = await phoneText(phones[0]);
  check(/CASA CARBO/.test(p1card) && /N'CULO, MO ASCIUGO IO!/.test(p1card) && /RB/.test(p1card), `Companion Card Xbox ("${p1card.slice(0, 120)}")`);
  const p2card = await phoneText(phones[1]);
  check(/TU QUA NON ENTRI!/.test(p2card) && /R1/.test(p2card), `Companion Card DualSense ("${p2card.slice(0, 120)}")`);
  check((await phones[0].page.$$('.ctl-btn, .dpad-grid')).length === 0, 'Companion Card: nessun tasto di gioco sul telefono col controller');
  check((await phones[2].page.$$('.ctl-squeegee, .ctl-bucket, .ctl-interact, .ctl-dash')).length >= 4, 'P3 (senza controller): croce e tasti sul telefono');
  await setup(2, 1250, 300);
  const x0 = (await P(2)).x;
  await hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'down', controlId: 'left' }), P3);
  await sleep(700);
  await hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'up', controlId: 'left' }), P3);
  check((await P(2)).x < x0 - 30, 'P3 (telefono): la croce lo muove');

  await stick(page, 0, 1, 0);
  await sleep(300);
  await page.evaluate(() => window.__padRemove(0));
  await sleep(500);
  check(Math.abs((await axisOf(page, P1)).x) < 0.01, 'controller scollegato: input a zero');

  await finishNow(page);
  await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} controlli falliti` : '✅ tutto ok');
process.exit(st.fails ? 1 : 0);
