// BOTTA AL VOLO col controller (M5b — il test più delicato: dipende dal tempo di reazione). 3 giocatori MISTI: P1 Xbox (goblin),
// P2 DualSense (dottore), P3 telefono (buttafuori, fallback). Prova: schermata CONTROLLI, tempi misurati ~100/200/300ms dopo il VIA
// (headless: precisione reale riportata, non dichiarata a priori), falsa partenza, tasto tenuto PRIMA del VIA (non deve dare 0ms),
// fakeout, abilità, pausa (il tempo non deve scorrere durante la pausa), disconnessione/reconnessione, diagnostica F3 GO/PRESS.
//   node scripts/e2e/gamepad-reaction.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, tap, until, phoneText, slots, pressedOf, f3Text, watchControls, startGame, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const G = (page, fn, arg) => sceneEval(page, 'reaction', fn, arg);
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // P1=goblin (0, ability col bottone), P2=dottore (2, ability informativa), P3=buttafuori (1, passiva, sul telefono)
  const CHAR_IDX = [0, 2, 1];
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, CHAR_IDX[i]);
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
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox) e P2 (DualSense) col controller, P3 col telefono');
  const pairing0 = await slots(page);
  await watchControls(page);

  const P = (id) => sceneEval(page, 'reaction', (g, a) => { const p = g.players.find((q) => q.snap.id === a); return p ? { status: p.status, timeMs: p.timeMs, abilityUsed: p.abilityUsed } : null; }, id);

  // ------------------------------------------------------------ CONTROLLI
  await startGame(page, 'reaction');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await btn(page, 0, 'A', true); // action TENUTO durante la schermata: precarico da verificare più sotto
  const frozen0 = await G(page, (g) => g.phase);
  check(frozen0 === 'title', `gioco FERMO durante i CONTROLLI (fase ${frozen0})`);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 2500 && dur <= 3100, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/BOTTA AL VOLO/.test(cc.text) && /A \/ ✕ PREMI SOLO QUANDO VEDI VIA!/.test(cc.text) && /RB \/ R1 ABILITÀ/.test(cc.text), `mostra: "${cc.text.slice(0, 200)}"`);
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /BOTTA AL VOLO/.test(t1), `telefono P1: "${t1.slice(0, 55)}"`);
  check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK');

  // ------------------------------------------------------------ PRESSIONE TENUTA prima del VIA: NON deve dare 0ms
  await until(async () => (await G(page, (g) => g.phase)) === 'waiting', 20000, 'attesa round 1');
  check((await pressedOf(page, P1, 'action')) === false, 'A tenuto da PRIMA della schermata CONTROLLI: resta bloccato in attesa (nessun precarico)');
  const p1DuringWait = await P(P1);
  check(p1DuringWait.status === 'ready', `P1 con A ancora tenuto: nessuna reazione registrata (status ${p1DuringWait.status}, non "pressed" a 0ms)`);
  await until(async () => (await G(page, (g) => g.phase)) === 'via', 15000, 'via round 1 (con A tenuto)');
  await sleep(200);
  const p1AtVia = await P(P1);
  check(p1AtVia.status !== 'pressed' || (p1AtVia.timeMs ?? 999) > 30, `A tenuto attraverso il VIA: NON un tempo a 0ms (status ${p1AtVia.status}, tempo ${p1AtVia.timeMs})`);
  await btn(page, 0, 'A', false);
  await sleep(300);
  // libera A e completa il round (altrimenti resta a metà e blocca i round successivi)
  if ((await P(P1)).status === 'ready') await tap(page, 0, 'A', 120);
  await until(async () => (await G(page, (g) => g.phase)) === 'roundResult' || (await G(page, (g) => g.phase)) === 'intro', 30000, 'fine round 1');

  // ------------------------------------------------------------ FALSA PARTENZA (P2, prima del VIA)
  await until(async () => (await G(page, (g) => g.phase)) === 'waiting', 20000, 'attesa round 2');
  await tap(page, 1, 'A', 150);
  await sleep(300);
  const p2False = await P(P2);
  check(p2False.status === 'falseStart', `A premuto PRIMA del VIA: FALSA PARTENZA affidabile (status ${p2False.status})`);

  // ------------------------------------------------------------ FAKEOUT: forziamo il finto VIA, una pressione durante e' falsa partenza
  await G(page, (g) => { g.fakeAt = g.gameTime + 0.05; g.fakeDone = false; g.viaDeadline = g.gameTime + 3; });
  await until(async () => (await G(page, (g) => g.fakeActive)) === true, 8000, 'fakeout attivo');
  check(true, 'fakeout forzato: il finto VIA è comparso');
  await sleep(120);
  const fakeStillWaiting = await G(page, (g) => g.phase);
  check(fakeStillWaiting === 'waiting', `dopo il fakeout la fase resta ATTESA, non VIA (fase ${fakeStillWaiting})`);

  // ------------------------------------------------------------ ABILITÀ (RB) — goblin (P1), durante l'attesa
  const abBefore = await P(P1);
  await tap(page, 0, 'RB', 300);
  await sleep(300);
  const abAfter = await P(P1);
  check(abAfter.abilityUsed === true && abBefore.abilityUsed === false, 'RB/R1 = ABILITÀ: "NCULO!" registrata durante l\'attesa');
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(500);
  check(/P1[\s\S]*?GIOCO[^\n]*ability [1-9]\d*x/.test(await f3Text(page)), 'F3: il gioco consuma la pressione di RB');

  // ------------------------------------------------------------ TEMPI MISURATI: forza il VIA e premi dopo ~100/200/300ms reali
  const results = [];
  for (const targetMs of [100, 200, 300]) {
    await G(page, (g, id) => { const p = g.players.find((q) => q.snap.id === id); p.status = 'ready'; p.timeMs = null; }, P1);
    // forza un NUOVO ciclo attesa->via: se fossimo gia' in 'via' da un giro precedente, viaDeadline (letto solo durante 'waiting')
    // non avrebbe alcun effetto e triggerVia() non ripartirebbe da un viaTime fresco.
    await G(page, (g) => { g.phase = 'waiting'; g.viaDeadline = g.gameTime + 0.03; g.fakeAt = -1; g.fakeActive = false; g.core.setVisible(true); });
    await until(async () => (await G(page, (g) => g.phase)) === 'via', 8000, `via (bersaglio ${targetMs}ms)`);
    const t0 = Date.now();
    await sleep(targetMs);
    await btn(page, 0, 'A', true);
    await sleep(90);
    await btn(page, 0, 'A', false);
    const realWaited = Date.now() - t0;
    await sleep(150);
    const r = await P(P1);
    results.push({ targetMs, realWaited, status: r.status, timeMs: r.timeMs });
  }
  console.log('   [reaction]', JSON.stringify(results));
  for (const r of results) {
    check(r.status === 'pressed' && r.timeMs !== null, `bersaglio ${r.targetMs}ms: reazione registrata (status ${r.status})`);
  }
  // precisione REALE osservata (headless): il tempo misurato deve seguire l'attesa reale entro una tolleranza larga (frame-quantizzato,
  // non corretto artificialmente) — non si dichiara un errore massimo stretto perché il polling è per fotogramma, come da consegna.
  const errs2 = results.filter((r) => r.timeMs !== null).map((r) => Math.abs(r.timeMs - r.realWaited));
  console.log('   [reaction] scarto tempo-misurato vs attesa-reale (ms):', errs2.map((e) => e.toFixed(0)).join(', '));
  check(errs2.every((e) => e < 250), `scarto tra tempo misurato e attesa reale sempre sotto 250ms (frame-quantizzato, non forzato): ${errs2.map((e) => e.toFixed(0)).join(', ')}`);

  // F3: GO/PRESS nello stesso dominio (performance.now)
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(400);
  const f3 = await f3Text(page);
  check(/REACTION[\s\S]*?performance\.now/.test(f3) && /GO \d+\.\d+/.test(f3) && /PRESS \d+\.\d+/.test(f3) && /DT \d+\.\d+ ms/.test(f3) && /frame ~\d/.test(f3), `F3 mostra GO/PRESS/DT/frame nello stesso dominio: "${(f3.match(/REACTION[^\n]*\n[^\n]*/) ?? [''])[0]}"`);
  await page.keyboard.press('F3');

  // ------------------------------------------------------------ PAUSA: il tempo non deve scorrere, nessuna pressione fantasma
  // Il menu pausa (PauseMenu) e' TUTTO locale: ascolta ESC sulla pagina host e solo APRENDOSI chiama gm.setPaused(true) — chiamare
  // gm.setPaused() direttamente (bypassando il menu) NON ferma il gameTime della scena. Si preme ESC per davvero, come un host vero.
  await G(page, (g, id) => { const p = g.players.find((q) => q.snap.id === id); p.status = 'ready'; p.timeMs = null; }, P1);
  // forza un NUOVO ciclo attesa->via: senza questo, se fossimo ancora nella finestra 'via' della misura precedente (3s di margine,
  // RESPONSE_TIMEOUT_S), una pressione qui verrebbe letta come una reazione VERA a quel VIA vecchio, non come input durante l'attesa.
  await G(page, (g) => { g.phase = 'waiting'; g.viaDeadline = g.gameTime + 3; g.fakeAt = -1; g.fakeActive = false; g.core.setVisible(true); });
  await page.keyboard.press('Escape');
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  const gtBefore = await G(page, (g) => g.gameTime);
  await btn(page, 0, 'A', true);
  await sleep(700);
  const gtDuring = await G(page, (g) => g.gameTime);
  check(gtDuring === gtBefore, `in pausa il tempo di gioco NON avanza (gameTime ${gtBefore.toFixed(2)} -> ${gtDuring.toFixed(2)})`);
  check((await P(P1)).status === 'ready', 'in pausa: nessuna pressione fantasma (A tenuto, status resta ready)');
  await btn(page, 0, 'A', false);
  await page.keyboard.press('Escape');
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(400);
  check((await P(P1)).status === 'ready', 'alla ripresa: ancora nessuna reazione fantasma (serve una pressione vera dopo il VIA)');

  // ------------------------------------------------------------ DISCONNESSIONE durante l'attesa (SENZA aver premuto nulla) + RECONNECT
  // Nota: tenere A premuto DURANTE 'waiting' è di per sé una VERA falsa partenza (comportamento corretto, già provato sopra con P2) —
  // qui si isola l'evento della disconnessione: il pad sparisce senza che P1 abbia mai premuto nulla, e non deve contare come input.
  await G(page, (g, id) => { const p = g.players.find((q) => q.snap.id === id); p.status = 'ready'; p.timeMs = null; }, P1);
  await G(page, (g) => { g.phase = 'waiting'; g.viaDeadline = g.gameTime + 4; g.fakeAt = -1; g.fakeActive = false; g.core.setVisible(true); });
  await sleep(200);
  await remove(page, 0);
  await sleep(700);
  check((await pressedOf(page, P1, 'action')) === false, 'disconnessione: nessun input residuo');
  const p1AfterDisc = await P(P1);
  const phaseAfterDisc = await G(page, (g) => g.phase);
  check(p1AfterDisc.status === 'ready', `la disconnessione da sola (nessuna pressione prima) non conta come input: status ${p1AfterDisc.status}, fase ${phaseAfterDisc}`);
  check(/DISCONNESSO|SCOLLEGATO/.test(await page.evaluate(() => document.getElementById('pad-alert')?.innerText ?? '')), 'avviso TV: controller scollegato');
  await until(async () => await phones[0].page.evaluate(() => /CONTROLLER PERSO/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P1');
  await add(page, 0, XBOX);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'il controller torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'telefono torna al controller (nessun refresh)');

  // ------------------------------------------------------------ finisci la partita a forza di VIA rapidi, poi risultati -> rullo
  // Reaction non ha un'uscita anticipata quando tutti hanno risposto (a differenza di Memoria): ogni round aspetta SEMPRE tutto
  // RESPONSE_TIMEOUT_S (3s) dal VIA, anche a giocatori già premuti — solo per non far durare il test 30s+, si accorcia quell'attesa
  // (viaTime indietro nel tempo) DOPO che P1/P2 hanno gia' premuto: i loro tempi restano quelli calcolati al momento della pressione vera.
  // Il guard e' un budget di ITERAZIONI, non di round: tra un round e l'altro il gioco tiene comunque ~2.2s di roundResult
  // + ~1.1s di intro (fissi, non legati a viaTime: la scorciatoia sopra non li tocca), quindi ogni round costa ~20 iterazioni
  // a prescindere da quanto viene abbreviato il VIA. Con 4 round ancora da chiudere qui serve margine, non solo velocita'.
  let guard = 0;
  const GUARD_MAX = 170;
  let lastPhase = '';
  while ((await hostSnapshot(page)).phase === 'MINIGAME_PLAYING' && guard++ < GUARD_MAX) {
    const st2 = await G(page, (g) => ({ phase: g.phase, round: g.round, gameTime: +g.gameTime.toFixed(2), viaTime: +g.viaTime.toFixed(2) }));
    if (st2.phase !== lastPhase) {
      lastPhase = st2.phase;
      console.log('   [finish]', guard, JSON.stringify(st2));
    }
    const phase = st2.phase;
    if (phase === 'waiting') {
      await G(page, (g) => { g.viaDeadline = g.gameTime + 0.03; g.fakeAt = -1; });
      await sleep(120);
      await tap(page, 0, 'A', 90);
      await tap(page, 1, 'A', 90);
      await sleep(150);
      await G(page, (g) => { g.viaTime -= 999; }); // solo per abbreviare il test: non tocca i tempi già registrati
    }
    await sleep(150);
  }
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 30000, 'fine reaction');
  check(guard < GUARD_MAX, `la partita e' arrivata a conclusione naturale entro i 5 round (guard ${guard})`);
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 30000, 'risultati');
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 60000, 'rullo');
  check((await slots(page)) === pairing0, 'stesse associazioni dopo risultati e rullo (nessuna riassociazione)');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
