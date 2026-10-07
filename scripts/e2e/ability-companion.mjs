// ABILITA' + COMPANION CARD, nel browser vero (controller finti, telefoni veri):
//   - TV: la schermata CONTROLLI mostra il comando speciale ABILITA' e nome/riga di ogni personaggio presente
//   - telefono con controller: card (ritratto, abilita', TASTO VERO per famiglia Xbox/PlayStation, stato), niente bottoni di gioco
//   - stato LIVE autorevole: PRONTA -> ATTIVA -> ESAURITA, lampo di attivazione, avviso privato "NON ORA"/"ESAURITA"
//   - 3 giocatori, 3 personaggi diversi: ognuno riceve SOLO la propria abilita' (nessuna informazione altrui)
//   - pulizia: a fine round la card sparisce, il round dopo parte PRONTA (nessuna abilita' che sopravvive)
//   - Quiz: l'INFO PRIVATA sostituisce la card e poi torna da sola
//   - Sparatoria: RB = abilita' (Dottore: vista a raggi X per gli altri finestra / mai per gli altri)
//   node scripts/e2e/ability-companion.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, btn, tap, until, phoneText, startGame, watchControls, gameEval, sceneEval, finishNow } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const hub = (page, fn, arg) =>
  page.evaluate(
    async (src, a) => {
      // l'istanza vera dell'app (un import() dal test puo' dare un'altra istanza se Vite ha appena invalidato il modulo)
      // eslint-disable-next-line no-new-func
      return new Function('hub', 'arg', `return (${src})(hub, arg);`)(window.__abilityHub, a);
    },
    fn.toString(),
    arg
  );
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // CHARACTER_ORDER = goblin, buttafuori, dottore, judoka, ciro. P1 = dottore (Xbox), P2 = ciro (DualSense), P3 = buttafuori (telefono)
  const CHAR_IDX = [2, 4, 1];
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
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox, Dottore) e P2 (DualSense, Ciro) col controller; P3 (Buttafuori) col telefono');
  await watchControls(page);

  // ---------------------------------------------------------------- ARENA: CONTROLLI sulla TV
  await startGame(page, 'arena');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 15000, 'fine schermata CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  check(/ABILIT/.test(cc.text) && /⚡/.test(cc.text), `TV CONTROLLI: sezione ABILITÀ presente ("${cc.text.slice(0, 80)}...")`);
  check(/M'HO SVEJATO/.test(cc.text) && /PAGO DOMANI/.test(cc.text) && /MO M'IMPEGNO/.test(cc.text), 'TV CONTROLLI: nome di OGNI abilita\' dei 3 personaggi presenti (Dottore, Ciro, Buttafuori)');
  check(/B \/ ◯/.test(cc.text), 'TV CONTROLLI: il tasto abilita\' in entrambe le famiglie (B per Xbox / ◯ per PlayStation)');
  check(/Schiva da sveglio|sveglio/i.test(cc.text) && /bordo/i.test(cc.text), 'TV CONTROLLI: la riga dice COSA FA ("schivi da sveglio...", "il bordo non ti elimina...")');

  await until(async () => (await gameEval(page, 'arena', (g) => g.phase)) === 'playing', 40000, 'arena in gioco');

  // ---------------------------------------------------------------- telefoni: ognuno la SUA card
  const t1 = await phoneText(phones[0]);
  const t2 = await phoneText(phones[1]);
  check(/M'HO SVEJATO/.test(t1) && !/PAGO DOMANI/.test(t1) && !/MO M'IMPEGNO/.test(t1), `P1: card col SUO personaggio (Dottore) e basta ("${t1.slice(0, 70)}")`);
  check(/PAGO DOMANI/.test(t2) && !/M'HO SVEJATO/.test(t2), `P2: card col SUO personaggio (Ciro) e basta ("${t2.slice(0, 70)}")`);
  check(/\bB\b/.test(t1) && /◯/.test(t2), 'tasto vero per famiglia: B (Xbox) sul telefono di P1, ◯ (PlayStation) su quello di P2');
  check(/COMANDI/.test(t1) && /MUOVITI/.test(t1) && /USA IL CONTROLLER/.test(t1), 'la card elenca anche i COMANDI e dice USA IL CONTROLLER');
  check(/PRONTA/.test(t1), 'stato iniziale PRONTA');
  check((await phones[0].page.evaluate(() => document.querySelectorAll('#app button').length)) === 0 && (await phones[0].page.evaluate(() => document.querySelectorAll('canvas').length)) === 0, 'la card e\' solo informativa: nessun bottone di gioco, nessun joystick, nessun canvas');
  check(await phones[2].page.evaluate(() => !document.querySelector('.cc')), 'P3 (senza controller): niente card, usa i controlli del telefono');
  const stOf = (pid) => hub(page, (h, id) => h.statusOf(id), pid);
  check((await stOf(P1))?.state === 'READY' && (await stOf(P2))?.state === 'READY', 'lo stato autorevole pubblicato dal gioco e\' READY per entrambi');

  // ---------------------------------------------------------------- uso: lampo + stato ATTIVA + doppia pressione = avviso privato
  await tap(page, 0, 'B', 300);
  await sleep(250);
  check((await stOf(P1))?.state === 'ACTIVE', 'P1 preme B: lo stato diventa ACTIVE (M\'HO SVEJATO)');
  const flash = await phones[0].page.evaluate(() => document.getElementById('ability-flash')?.innerText ?? '');
  check(/M'HO SVEJATO/.test(flash) || (await phoneText(phones[0])).includes('ATTIVA'), `il telefono mostra subito che e' partita ("${flash || 'ATTIVA'}")`);
  // seconda pressione mentre e' attiva (l'host headless gira a pochi fps: un tocco puo' cadere fra due fotogrammi, si riprova)
  let toast = '';
  for (let k = 0; k < 4 && !toast; k++) {
    await tap(page, 0, 'B', 600);
    await sleep(200);
    toast = await phones[0].page.evaluate(() => document.getElementById('ab-fail-toast')?.innerText ?? '');
  }
  check(/NON ORA/.test(toast), `seconda pressione mentre e' attiva: avviso PRIVATO "NON ORA" ("${toast}")`);
  check(await phones[1].page.evaluate(() => !document.getElementById('ab-fail-toast') && !document.getElementById('ability-flash')), 'l\'avviso e il lampo di P1 NON compaiono sul telefono di P2 (privacy)');
  const rows1 = await hub(page, (h) => h.rows());
  const r1 = rows1.find((r) => r.playerId === P1);
  check(r1 && r1.uses === 1 && r1.failures >= 1, `statistiche F4: P1 usi ${r1?.uses}, fallite ${r1?.failures}`);

  // il Dottore in Arena si riaddormenta se nessuno lo attacca; poi ESAURITA
  await until(async () => (await stOf(P1))?.state === 'SPENT', 20000, 'abilita\' P1 esaurita');
  let toast2 = '';
  for (let k = 0; k < 4 && !toast2; k++) {
    await tap(page, 0, 'B', 600);
    await sleep(200);
    toast2 = await phones[0].page.evaluate(() => document.getElementById('ab-fail-toast')?.innerText ?? '');
  }
  check(/ESAURITA/.test(toast2), `abilita' finita: premere di nuovo dice ESAURITA ("${toast2}")`);
  check(/ESAURITA/.test(await phoneText(phones[0])), 'la card di P1 mostra ESAURITA');

  // Ciro arma PAGO DOMANI
  await tap(page, 1, 'B', 300);
  await sleep(300);
  const c1 = await stOf(P2);
  check(c1?.state === 'ACTIVE' && /ARMATA/.test(c1?.note ?? ''), `P2 (Ciro): ARMATA (${c1?.note})`);
  check(/ARMATA|ATTIVA/.test(await phoneText(phones[1])), 'la card di P2 mostra lo stato live (ARMATA)');

  // ---------------------------------------------------------------- fine round: pulizia
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 20000, 'fine round');
  await sleep(600);
  check(await phones[0].page.evaluate(() => !document.querySelector('.cc') && !document.getElementById('ability-flash') && !document.getElementById('ab-fail-toast')), 'a fine round la card sparisce (niente flash/avvisi residui)');
  const after = await hub(page, (h) => ({ r: h.rows(), s: h.statusOf('x') }));
  check(Array.isArray(after.r) && after.r.length === 0, 'AbilityHub svuotato a fine round (nessuno stato residuo)');

  // ---------------------------------------------------------------- DODGEBALL: il round dopo parte pulito, abilita' diversa per gioco
  await startGame(page, 'dodgeball');
  await until(async () => (await gameEval(page, 'dodgeball', (g) => g.phase)) === 'playing', 90000, 'dodgeball in gioco');
  const d1 = await phoneText(phones[0]);
  check(/TRE MESI DOPO/.test(d1) && /PRONTA/.test(d1) && !/ESAURITA/.test(d1), `Dodgeball: stessa persona, ABILITA' DIVERSA per gioco ("TRE MESI DOPO") e parte PRONTA senza residui ("${d1.slice(0, 80)}")`);
  const d2 = await phoneText(phones[1]);
  check(/PAGO DOMANI/.test(d2) && /PRONTA/.test(d2), 'Dodgeball: Ciro riparte PRONTA (l\'ARMATA dell\'Arena non sopravvive al restart)');
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 20000, 'fine dodgeball');

  // ---------------------------------------------------------------- QUIZ: info privata sostituisce la card e poi torna
  await startGame(page, 'quiz');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 90000, 'CONTROLLI quiz').catch(() => undefined);
  await until(async () => (await sceneEval(page, 'quiz', (g) => g.manager.phase)) === 'question', 60000, 'quiz domanda');
  const q0 = await phoneText(phones[0]);
  check(/M'HO SVEJATO/.test(q0) && /PRONTA/.test(q0), `Quiz: card del Dottore con la SUA abilita' di gioco ("${q0.slice(0, 80)}")`);
  await tap(page, 0, 'RB', 300);
  await sleep(500);
  const q1 = await phoneText(phones[0]);
  check(/SOLO PER TE/.test(q1) && !/COMANDI/.test(q1), `Quiz: l'INFO PRIVATA sostituisce la card ("${q1.slice(0, 60)}")`);
  // sblocca la domanda per passare alla prossima: tutti rispondono
  await sceneEval(page, 'quiz', (g) => {
    for (const pid of g.ctx.playerIds) {
      const p = g.manager.players.get(pid);
      if (p && !p.hasAnsweredFinal) g.manager.submitAnswer(pid, g.manager.currentQuestion().correctAnswerIndex);
    }
  });
  await until(async () => (await sceneEval(page, 'quiz', (g) => g.manager.phase)) === 'question' && /COMANDI/.test(await phoneText(phones[0])), 60000, 'torna la card');
  const q2 = await phoneText(phones[0]);
  check(/COMANDI/.test(q2) && /ESAURITA/.test(q2), `Quiz: finita l'info privata torna da sola la card, con l'abilita' ESAURITA ("${q2.slice(0, 70)}")`);
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 30000, 'fine quiz');

  // ---------------------------------------------------------------- SPARATORIA: RB = abilita' (prima riservato e senza effetto)
  await startGame(page, 'fps');
  await until(async () => await page.evaluate(() => !document.getElementById('pad-controls')), 40000, 'fine CONTROLLI fps');
  await sleep(2500);
  const f0 = await sceneEval(page, 'fps', (g) => g.players.map((p) => ({ id: p.id, wall: p.wallTime, arm: p.armTime })));
  check(f0.every((p) => p.wall === 0 && p.arm === 0), 'FPS: nessuna abilita\' attiva all\'inizio');
  await tap(page, 0, 'RB', 300); // Dottore: M'HO SVEJATO
  await sleep(500);
  const f1 = await sceneEval(page, 'fps', (g) => g.players.map((p) => ({ id: p.id, wall: p.wallTime, cd: p.abCd })));
  const p1f = f1.find((p) => p.id === P1);
  check(p1f.wall > 0 && p1f.cd > 0, `FPS: RB attiva M'HO SVEJATO del Dottore (vista ${p1f.wall.toFixed(1)} s, ricarica ${p1f.cd.toFixed(0)} s)`);
  const ghost = await sceneEval(page, 'fps', (g) => {
    const sp = g.splitScreen;
    if (!sp) return null;
    const out = {};
    for (const [id, rig] of sp.avatars) out[id] = rig.ghost.layerMask;
    return out;
  });
  if (ghost) {
    check(ghost[P2] !== undefined && ghost[P2] !== 0, `FPS: gli avversari di P1 hanno il fantasma a raggi X acceso SOLO per la sua finestra (maschera ${ghost[P2]})`);
    check(ghost[P1] === 0, 'FPS: il proprio fantasma di P1 resta spento (nessuno vede attraverso i muri P1 dagli altri)');
  } else check(true, 'FPS: split-screen non ancora pronto (fantasma non verificato)');
  const fp = await phoneText(phones[0]);
  check(/M'HO SVEJATO/.test(fp), 'FPS: la card del Dottore mostra la SUA abilita\' di Sparatoria');
  await tap(page, 1, 'RB', 300); // Ciro: PAGO DOMANI
  await sleep(400);
  const f2 = await sceneEval(page, 'fps', (g) => g.players.map((p) => ({ id: p.id, arm: p.armTime, ch: p.abCharges })));
  const p2f = f2.find((p) => p.id === P2);
  check(p2f.arm > 0 && p2f.ch === 1, `FPS: RB arma PAGO DOMANI di Ciro (carica 2 -> ${p2f.ch})`);
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 30000, 'fine fps');

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails === 0 ? '\n✅ TUTTO OK' : `\n❌ ${st.fails} controlli falliti`);
process.exitCode = st.fails ? 1 : 0;
