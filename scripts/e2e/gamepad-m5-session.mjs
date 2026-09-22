// SESSIONE COMPLETA M5, senza refresh e senza riassociazioni:
//   RULLO -> KART (controller) -> risultati -> RULLO -> MEMORIA (controller) -> risultati -> RULLO -> BOTTA AL VOLO (controller)
//   -> risultati -> RULLO -> QUIZ (controller) -> risultati -> RULLO -> CULTURA (telefono) -> risultati -> RULLO -> ARENA (controller)
// 3 giocatori: P1 Xbox, P2 DualSense, P3 telefono. Il tasto A di P1 e' TENUTO per tutte le transizioni: in nessun gioco deve produrre
// azioni fantasma (drift+boost / tessera / reazione / conferma risposta / dash). Controlla: schermata CONTROLLI (o PRENDETE I
// TELEFONI), telefono che cambia da solo, contesto del gamepad, associazioni identiche, nessuna pagina ricaricata, nessun errore.
//   node scripts/e2e/gamepad-m5-session.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, btn, stick, tap, until, phoneText, slots, watchControls, resetControlsWatch, startGame, gameEval, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  await page.evaluate(() => (window.__smoke = 'host'));
  for (const p of phones) await p.page.evaluate(() => (window.__smoke = 'phone'));
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
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'lobby: P1 (Xbox) e P2 (DualSense) associati, P3 col telefono');
  const pairing0 = await slots(page);
  await watchControls(page);
  const phaseNow = async () => (await hostSnapshot(page)).phase;
  const goNext = async (last = false) => {
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 90000, 'risultati');
    if (last) return; // dopo l'ultimo gioco la partita puo' finire (punteggio obiettivo): esito valido, non un blocco
    try {
      await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE', 'GAME_FINISHED'].includes(await phaseNow()), 120000, 'rullo');
    } catch (e) {
      const snap = await hostEval(page, (gm) => ({ phase: gm.state.phase, scores: gm.state.players.map((p) => [p.displayName, p.score]) }));
      console.log('   [diag]', JSON.stringify(snap));
      throw e;
    }
    const ph = await phaseNow();
    if (ph === 'GAME_FINISHED') {
      const snap = await hostEval(page, (gm) => gm.state.players.map((p) => [p.displayName, p.score]));
      console.log(`   [info] partita conclusa in anticipo (punteggio obiettivo): ${JSON.stringify(snap)}`);
      return 'finished';
    }
  };
  const texts = async () => Promise.all(phones.map(phoneText));

  // Sessione da 6 giochi (piu' del M3/M4): se lo stesso giocatore vincesse SEMPRE (come farebbe finishNow), con
  // target 60 e tabella 10/6/3 basta un modificatore "punti doppi" su un round per chiudere la partita in anticipo
  // (esito comunque valido, ma impedirebbe di provare ARENA a fine sessione). Si ruota chi arriva 1°/2°/3° ad ogni
  // round: nessun bug, solo una scelta del bot per coprire l'intera sequenza richiesta.
  let roundIdx = 0;
  const finishRound = async () => {
    const order = [0, 1, 2].map((i) => (i + roundIdx) % 3);
    roundIdx++;
    await hostEval(page, (gm, ord) => {
      const ctx = gm.minigameContext;
      const ps = ctx.players;
      const results = ord.map((playerIdx, placementIdx) => ({ playerId: ps[playerIdx].id, placement: placementIdx + 1, score: 5 - placementIdx }));
      ctx.finish({ results });
    }, order);
  };

  const padGame = async (id, title, reachedPlaying, ghostOk, last = false) => {
    console.log(`\n--- ${title} ---`);
    await btn(page, 0, 'A', true); // A di P1 TENUTO da prima dell'avvio, per TUTTE le transizioni
    await resetControlsWatch(page);
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter'); // il primo gioco parte dalla lobby; i successivi partono dal rullo da soli
    }
    let sawDown = false;
    await until(async () => {
      const ph = await phaseNow();
      if (ph === 'MINIGAME_INTRO') sawDown ||= /METTI GIÙ IL TELEFONO/.test(await phoneText(phones[0]));
      return ph === 'MINIGAME_PLAYING';
    }, 120000, `${id} PLAYING`);
    check(sawDown, 'all\'intro il telefono di P1 dice "🎮 METTI GIÙ IL TELEFONO" (cambio automatico, nessun refresh)');
    await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'CONTROLLI');
    const cc1 = await page.evaluate(() => window.__cc.text);
    check(new RegExp(title).test(cc1) && /CONTROLLI/.test(cc1), `schermata CONTROLLI di ${title}`);
    await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
    await until(reachedPlaying, 60000, 'via');
    await sleep(900);
    check(await ghostOk(), `A tenuto da rullo + intro + CONTROLLI: nessuna azione fantasma in ${title}`);
    const t = await texts();
    check(/USA IL CONTROLLER/.test(t[0]) && /USA IL CONTROLLER/.test(t[1]), `telefoni di P1 e P2: "🎮 USA IL CONTROLLER"`);
    check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge')), 'telefono di P3: 📱 MODALITÀ FALLBACK');
    check((await page.evaluate(() => window.__pads.contextNow())) === 'MINIGAME', 'contesto del gamepad: MINIGAME');
    await btn(page, 0, 'A', false);
    await finishRound();
    await goNext(last);
    check((await slots(page)) === pairing0, 'associazioni invariate dopo i risultati');
  };

  // KART — invariato da M4: A = DRIFT, tenuto dal rullo non deve ne' avviare il drift ne' lasciare un mini-turbo.
  await padGame(
    'kart3d',
    'RIBALTATI',
    async () => (await gameEval(page, 'kart3d', (g) => g.race?.phase)) === 'racing',
    async () => {
      const k = await gameEval(page, 'kart3d', (g, id) => { const kk = g.karts.get(id); return { drifting: kk.drifting, boost: kk.boostTimer }; }, P1);
      return k.drifting === false && k.boost === 0;
    }
  );

  // MEMORIA — A = PRIMARY = tessera in BASSO: tenuto dal rullo non deve avanzare la sequenza di P1.
  await padGame(
    'memory',
    'MEMORIA',
    async () => (await sceneEval(page, 'memory', (g) => g.phase)) === 'repeat',
    async () => (await sceneEval(page, 'memory', (g, id) => g.players.find((p) => p.snap.id === id).inputIndex, P1)) === 0
  );

  // BOTTA AL VOLO — A = reazione: tenuto dal rullo non deve registrare una reazione a 0ms ne' una falsa partenza fantasma.
  await padGame(
    'reaction',
    'BOTTA AL VOLO',
    async () => (await sceneEval(page, 'reaction', (g) => g.phase)) === 'waiting',
    async () => (await sceneEval(page, 'reaction', (g, id) => g.players.find((p) => p.snap.id === id).status, P1)) === 'ready'
  );

  // QUIZ — A = PRIMARY = conferma risposta: tenuto dal rullo non deve confermare la selezione di default (A) da solo.
  await padGame(
    'quiz',
    'CHI CAZZO LO SA',
    async () => (await sceneEval(page, 'quiz', (g) => g.manager.phase)) === 'question',
    async () => {
      const p = await sceneEval(page, 'quiz', (g, id) => g.manager.players.get(id), P1);
      return p.answerIndex === null && p.hasAnsweredFinal === false;
    }
  );

  // ---------------------------------------------------------------- CULTURA: telefono
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
  check(sawTake, 'all\'intro di Cultura il telefono di P1 dice "📱 PRENDI IL TELEFONO"');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 30000, 'PRENDETE I TELEFONI');
  check(/PRENDETE I TELEFONI/.test(await page.evaluate(() => window.__cc.text)), 'la TV mostra "📱 PRENDETE I TELEFONI"');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine PRENDETE I TELEFONI');
  check((await page.evaluate(() => window.__pads.contextNow())) === 'PHONE_TEXT', 'contesto del gamepad: PHONE_TEXT (il controller e\' ignorato)');
  await stick(page, 0, 1, 0);
  await sleep(600);
  check((await hostEval(page, (gm, id) => gm.input.get(id).peekAxis('move').x, P1)) === 0, 'in Cultura lo stick del controller non produce input');
  await stick(page, 0, 0, 0);
  const tc = await phoneText(phones[0]);
  check(!/USA IL CONTROLLER|METTI GIÙ/.test(tc), `Cultura: il telefono di P1 mostra il gioco da telefono ("${tc.slice(0, 50)}")`);
  await btn(page, 0, 'A', false);
  await finishRound();
  await goNext();
  check((await slots(page)) === pairing0, 'associazioni invariate dopo Cultura');

  // ARENA (M2): deve ancora funzionare dopo tutta la sessione M5 — A = DASH.
  await padGame(
    'arena',
    'ARENA',
    async () => (await gameEval(page, 'arena', (g) => g.phase)) === 'playing',
    async () => (await gameEval(page, 'arena', (g, id) => g.players.find((p) => p.id === id).dashCooldown, P1)) === 0,
    true
  );

  // ---------------------------------------------------------------- fine sessione
  check((await slots(page)) === pairing0, 'FINE SESSIONE: stesse associazioni, nessun controller riassegnato');
  check((await page.evaluate(() => window.__smoke)) === 'host', 'la pagina dell\'host non e\' mai stata ricaricata');
  for (let i = 0; i < 3; i++) check((await phones[i].page.evaluate(() => window.__smoke)) === 'phone', `il telefono P${i + 1} non e\' mai stato ricaricato`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
