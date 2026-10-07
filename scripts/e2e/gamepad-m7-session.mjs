// M7 — SESSIONE COMPLETA "DA CONSOLE", tutti i 10 giochi in ordine forzato, con risultati + rullo fra ogni gioco:
//   Arena, Dodgeball, Calcio, Pallavolo, Kart, Memoria, Botta al Volo, Quiz, Sparatoria, Cultura
// 3 giocatori, TUTTI col controller (Xbox + DualSense + generico: iconografia mista "A / ✕"). Il tasto A di P1 e' TENUTO attraverso
// ogni transizione: in nessun gioco deve produrre un'azione fantasma. Verifica: nessun refresh, pairing persistente, schermata
// CONTROLLI (mai nomi tecnici tipo PRIMARY), telefoni passivi ("USA IL CONTROLLER", nessun canvas 3D), info privata nel Quiz che
// torna da sola, Cultura col telefono e poi "🎮 RIPRENDETE I CONTROLLER", punteggi che crescono, nessun canvas residuo, nessun errore.
//   node scripts/e2e/gamepad-m7-session.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, btn, stick, tap, until, phoneText, slots, watchControls, resetControlsWatch, gameEval, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const FAMILIES = [XBOX, DS, GENERIC];
const browser = await launch();
try {
  // SERATA (120 punti): 10 giochi di fila a 60 punti farebbero finire la partita prima di Cultura
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1, scoreDownPresses: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  const CHAR_IDX = [2, 0, 1]; // P1 = dottore (indizio privato nel Quiz)
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, CHAR_IDX[i]);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  await page.evaluate(() => (window.__smoke = 'host'));
  for (const p of phones) await p.page.evaluate(() => (window.__smoke = 'phone'));
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [P1] = pids;
  await installMock(page);
  for (let k = 0; k < 3; k++) await add(page, k, FAMILIES[k]);
  await sleep(500);
  for (let k = 0; k < 3; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 3, 'lobby: 3 controller associati UNA volta (Xbox + DualSense + generico)');
  const pairing0 = await slots(page);
  await watchControls(page);
  const phaseNow = async () => (await hostSnapshot(page)).phase;
  const canvasCount = () => page.evaluate(() => document.querySelectorAll('canvas').length);
  const canvasBaseline = await canvasCount();
  const scoreSum = () => hostEval(page, (gm) => gm.state.players.reduce((a, p) => a + p.score, 0));

  let roundIdx = 0;
  const finishRound = async () => {
    const order = [0, 1, 2].map((i) => (i + roundIdx) % 3);
    roundIdx++;
    await hostEval(page, (gm, ord) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ord.map((pi, k) => ({ playerId: ctx.players[pi].id, placement: k + 1, score: 5 - k })) });
    }, order);
  };
  const goNext = async (last) => {
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 90000, 'risultati');
    const t = await phoneText(phones[0]);
    check(/RISULTATI SULLA TV/.test(t), `risultati: il telefono dice "RISULTATI SULLA TV" ("${t.slice(0, 40)}")`);
    if (last) return;
    await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes(await phaseNow()), 120000, 'rullo');
  };

  /** Un gioco col controller: id, titolo atteso nei CONTROLLI, "gameplay iniziato", "nessuna azione fantasma" (A tenuto). */
  const padGame = async (id, title, started, ghost, extra) => {
    console.log(`\n--- ${title} ---`);
    const before = await scoreSum();
    await btn(page, 0, 'A', true); // A di P1 TENUTO da prima dell'avvio, per TUTTE le transizioni
    await resetControlsWatch(page);
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    let sawDown = false;
    let sawRoulette = false;
    await until(async () => {
      const ph = await phaseNow();
      if (ph === 'MINIGAME_ROULETTE') sawRoulette ||= /RULLO IN CORSO/.test(await phoneText(phones[1]));
      if (ph === 'MINIGAME_INTRO') sawDown ||= /METTI GIÙ IL TELEFONO/.test(await phoneText(phones[0]));
      return ph === 'MINIGAME_PLAYING';
    }, 120000, `${id} PLAYING`);
    if (roundIdx > 0) check(sawRoulette, 'rullo: il telefono dice "RULLO IN CORSO" (non spoilera il gioco)');
    check(sawDown, 'intro: il telefono di P1 dice "METTI GIÙ IL TELEFONO" (cambio automatico, nessun refresh)');
    await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'CONTROLLI');
    const cc = await page.evaluate(() => window.__cc.text);
    check(new RegExp(title).test(cc) && /CONTROLLI/.test(cc), `CONTROLLI di ${title}`);
    check(!/\b(PRIMARY|SECONDARY|ACTION)\b/.test(cc) && /A \/ ✕/.test(cc), `CONTROLLI: simboli coerenti per Xbox + PlayStation + generico ("A / ✕", mai nomi tecnici): "${cc.slice(0, 110)}"`);
    await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
    const dur = await page.evaluate(() => window.__cc.hiddenAt - window.__cc.shownAt);
    check(dur >= 4700 && dur <= 5700, `durata CONTROLLI uniforme (${Math.round(dur)} ms)`);
    await until(started, 60000, `${id} via`);
    await sleep(900);
    check(await ghost(), `A tenuto da rullo + intro + CONTROLLI: nessuna azione fantasma in ${title}`);
    for (let i = 0; i < 3; i++) {
      const t = await phoneText(phones[i]);
      const cv = await phones[i].page.evaluate(() => document.querySelectorAll('canvas').length);
      check(/USA IL CONTROLLER/.test(t) && cv === 0, `telefono P${i + 1}: passivo ("USA IL CONTROLLER", ${cv} canvas)`);
    }
    check((await page.evaluate(() => window.__pads.contextNow())) === 'MINIGAME', 'contesto del gamepad: MINIGAME');
    await btn(page, 0, 'A', false);
    if (extra) await extra();
    await finishRound();
    await goNext(false);
    check((await scoreSum()) > before, `punteggi globali aggiornati dopo ${title}`);
    await sleep(300);
    check((await canvasCount()) === canvasBaseline, `nessun canvas residuo dopo ${title}`);
    check((await slots(page)) === pairing0, 'associazioni invariate (nessuna riassociazione)');
  };

  const G3 = (id, fn, arg) => gameEval(page, id, fn, arg);
  const S = (id, fn, arg) => sceneEval(page, id, fn, arg);

  await padGame('arena', 'ARENA', async () => (await G3('arena', (g) => g.phase)) === 'playing', async () => (await G3('arena', (g, id) => g.players.find((p) => p.id === id).dashCooldown, P1)) === 0);
  await padGame('dodgeball', 'DODGEBALL', async () => (await G3('dodgeball', (g) => g.phase)) === 'playing', async () => (await G3('dodgeball', (g, id) => g.players.find((p) => p.id === id).dodgeCooldown, P1)) === 0);
  await padGame('soccer', 'CALCIO', async () => (await G3('soccer', (g) => g.phase)) === 'playing', async () => {
    const k = await G3('soccer', (g, id) => ({ k: g.teamKicks.red + g.teamKicks.blue, ch: g.players.find((p) => p.id === id).charging }), P1);
    return k.k === 0 && !k.ch;
  });
  await padGame('volleyball', 'PALLAVOLO', async () => (await G3('volleyball', (g) => g.phase)) === 'playing', async () => (await G3('volleyball', (g) => g.ball.state)) === 'held');
  await padGame('kart3d', 'RIBALTATI', async () => (await G3('kart3d', (g) => g.race?.phase)) === 'racing', async () => {
    const k = await G3('kart3d', (g, id) => { const kk = g.karts.get(id); return { d: kk.drifting, b: kk.boostTimer }; }, P1);
    return k.d === false && k.b === 0;
  });
  await padGame('memory', 'MEMORIA', async () => (await S('memory', (g) => g.phase)) === 'repeat', async () => (await S('memory', (g, id) => g.players.find((p) => p.snap.id === id).inputIndex, P1)) === 0);
  await padGame('reaction', 'BOTTA AL VOLO', async () => (await S('reaction', (g) => g.phase)) === 'waiting', async () => (await S('reaction', (g, id) => g.players.find((p) => p.snap.id === id).status, P1)) === 'ready');

  // QUIZ: oltre al fantasma, l'INFO PRIVATA del Dottore (P1) compare SOLO sul suo telefono e poi torna da sola a "USA IL CONTROLLER"
  await padGame('quiz', 'CHI CAZZO LO SA', async () => (await S('quiz', (g) => g.manager.phase)) === 'question', async () => {
    const p = await S('quiz', (g, id) => { const q = g.manager.players.get(id); return { a: q.answerIndex, f: q.hasAnsweredFinal }; }, P1);
    return p.a === null && p.f === false;
  }, async () => {
    await tap(page, 0, 'RB', 250);
    await until(async () => /INFO PRIVATA/.test(await phoneText(phones[0])), 8000, 'info privata P1');
    check(/INFO PRIVATA/.test(await phoneText(phones[0])) && !/INFO PRIVATA/.test(await phoneText(phones[1])), 'Quiz: "📱 INFO PRIVATA" solo sul telefono del Dottore (P1), non sugli altri');
    // domanda successiva (tutti rispondono, fasi fisse accorciate SOLO nel test): l'indizio scade e il telefono torna passivo
    let guard = 0;
    // (il Buttafuori con risposta sbagliata entra nella finestra di grazia di 4s: si aspetta che scada da sola)
    while ((await S('quiz', (g) => g.manager.questionIndex)) === 0 && guard++ < 150) {
      await S('quiz', (g) => {
        const m = g.manager;
        if (m.phase === 'question') { for (const p of m.players.values()) if (!p.hasAnsweredFinal) m.submitAnswer(p.playerId, 0); }
        else m.phaseTimer = -1;
      });
      await sleep(120);
    }
    await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'P1 torna passivo');
    check(true, 'Quiz: alla domanda successiva il telefono di P1 torna da solo a "USA IL CONTROLLER" (nessun refresh)');
  });

  await padGame('fps', 'SPARATORIA', async () => (await S('fps', (g) => g.controlsDone && (g.splitScreen?.cams.length ?? 0) === 3)) === true, async () => (await S('fps', (g, id) => g.players.find((p) => p.id === id).dashCooldown, P1)) === 0);

  // ---------------------------------------------------------------- CULTURA (telefono), ultimo
  console.log('\n--- CULTURA (telefono) ---');
  await btn(page, 0, 'A', true);
  await resetControlsWatch(page);
  await hostEval(page, (gm, g) => gm.selectMinigame(g), 'cultura');
  let sawTake = false;
  await until(async () => {
    const ph = await phaseNow();
    if (ph === 'MINIGAME_INTRO') sawTake ||= /PRENDI IL TELEFONO/.test(await phoneText(phones[0]));
    return ph === 'MINIGAME_PLAYING';
  }, 120000, 'cultura PLAYING');
  check(sawTake, 'intro di Cultura: il telefono dice "📱 PRENDI IL TELEFONO"');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 30000, 'PRENDETE I TELEFONI');
  check(/PRENDETE I TELEFONI/.test(await page.evaluate(() => window.__cc.text)), 'TV: "📱 PRENDETE I TELEFONI"');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine PRENDETE I TELEFONI');
  check((await page.evaluate(() => window.__pads.contextNow())) === 'PHONE_TEXT', 'contesto del gamepad: PHONE_TEXT (controller ignorato)');
  await stick(page, 0, 1, 0);
  await sleep(500);
  check((await hostEval(page, (gm, id) => gm.input.get(id).peekAxis('move').x, P1)) === 0, 'in Cultura lo stick del controller non produce input');
  await stick(page, 0, 0, 0);
  const tc = await phoneText(phones[0]);
  check(!/USA IL CONTROLLER|METTI GIÙ/.test(tc), `Cultura: il telefono si attiva da solo ("${tc.slice(0, 40)}")`);
  await btn(page, 0, 'A', false);
  await finishRound();
  await until(async () => await page.evaluate(() => /RIPRENDETE I CONTROLLER/.test(document.getElementById('pad-retake')?.innerText ?? '')), 8000, 'RIPRENDETE I CONTROLLER');
  check(true, 'fine Cultura: la TV mostra "🎮 RIPRENDETE I CONTROLLER"');
  await goNext(true);
  await sleep(500);
  const tAfter = await phoneText(phones[0]);
  check(!/SCRIVI|VOTA/.test(tAfter), `dopo Cultura il telefono torna passivo ("${tAfter.slice(0, 40)}")`);

  // ---------------------------------------------------------------- fine sessione
  check((await slots(page)) === pairing0, 'FINE SESSIONE: stesse associazioni dall\'inizio, nessuna riassociazione');
  check((await page.evaluate(() => window.__smoke)) === 'host', 'host mai ricaricato');
  for (let i = 0; i < 3; i++) check((await phones[i].page.evaluate(() => window.__smoke)) === 'phone', `telefono P${i + 1} mai ricaricato`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
