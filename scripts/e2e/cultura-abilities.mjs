// CULTURA O CAZZATA: abilita' di personaggio dai telefoni (5 telefoni = goblin, buttafuori, dottore, judoka, ciro).
//   - nella fase di voto ogni telefono mostra il bottone della SUA abilita' (e solo quella)
//   - Buttafuori: una risposta falsa buttata fuori (solo per lui), Dottore: indizio privato, Judoka: piu' tempo, Ciro: voti in vista,
//     Goblin: scommessa; seconda pressione = ESAURITA; chi e' Secchione non puo' usare Goblin/Dottore (avviso, nessun consumo)
//   - a fine round/scena nessuno stato residuo (AbilityHub vuoto)
//   node scripts/e2e/cultura-abilities.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { makeCheck, until, startGame, sceneEval, finishNow } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 }); // 5 giocatori
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const CH = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'];
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await startGame(page, 'cultura');
  const scene = (fn, arg) => sceneEval(page, 'cultura', fn, arg);

  // round 1: bluff di tutti
  await until(async () => (await scene((s) => s.phase)) === 'bluff', 90000, 'cultura bluff');
  for (let i = 0; i < 5; i++) {
    try {
      await phones[i].page.waitForSelector('#cultura-bluff', { timeout: 6000 });
      await phones[i].page.type('#cultura-bluff', `Risposta falsa ${i + 1}`);
      await phones[i].page.click('#cultura-confirm');
    } catch {
      /* il Secchione non scrive bluff */
    }
  }
  await until(async () => (await scene((s) => s.phase)) === 'vote', 90000, 'cultura vote');
  await sleep(600);

  const info = await scene((s) => ({ secchione: s.secchioneId, ends: s.phaseEndsAt, now: s.gameTime }));
  const secIdx = pids.indexOf(info.secchione);

  // ogni telefono mostra il SUO bottone (o, se Secchione senza abilita' utilizzabile, comunque la sua card/riga)
  for (let i = 0; i < 5; i++) {
    const txt = await phones[i].page.evaluate(() => document.getElementById('app')?.innerText ?? '');
    const def = { goblin: "N'CULO", buttafuori: null, dottore: null, judoka: null, ciro: null }[CH[i]];
    const hasBtn = await phones[i].page.evaluate(() => !!document.getElementById('cultura-abtn'));
    const hasOn = /⚡/.test(txt);
    check(hasBtn || hasOn || i === secIdx, `P${i + 1} (${CH[i]}): in fase di voto vede il suo bottone ⚡ abilita'${def ? '' : ''}`);
  }

  // pressioni (con ritentativo: l'host headless e' lento)
  const press = async (i) => {
    const had = await phones[i].page.evaluate(() => !!document.getElementById('cultura-abtn'));
    if (!had) return false;
    await phones[i].page.evaluate(() => document.getElementById('cultura-abtn')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    return true;
  };
  for (let i = 0; i < 5; i++) await press(i);
  await sleep(1200);

  const after = await scene((s, a) => ({
    wager: a.pids.map((id) => s.wager.has(id)),
    hidden: a.pids.map((id) => (s.hidden.has(id) ? s.hidden.get(id) : null)),
    hints: a.pids.map((id) => s.hints.get(id) ?? null),
    peeking: a.pids.map((id) => s.peeking.has(id)),
    used: a.pids.map((id) => s.abilityUsed.has(id)),
    earlyBlocked: s.earlyBlocked,
    ends: s.phaseEndsAt,
    now: s.gameTime,
    correct: s.options.findIndex((o) => o.isCorrect)
  }), { pids });
  if (secIdx !== 0) check(after.wager[0] && after.used[0], 'GOBLIN: la scommessa e\' attiva');
  check(after.hidden[1] !== null && after.hidden[1] !== after.correct, 'BUTTAFUORI: una risposta FALSA e\' buttata fuori (mai la vera)');
  check(after.hidden.filter((h, i) => i !== 1 && h !== null).length === 0, 'BUTTAFUORI: la risposta buttata fuori e\' solo sua (gli altri non hanno nulla di nascosto)');
  if (secIdx !== 2) check(!!after.hints[2] && /INIZIA PER/.test(after.hints[2]), `DOTTORE: indizio privato "${after.hints[2]}"`);
  check(after.hints.filter((h, i) => i !== 2 && h).length === 0, 'DOTTORE: nessun altro riceve l\'indizio');
  check(after.earlyBlocked && after.ends - info.ends > 4, `JUDOKA: piu' tempo (+${(after.ends - info.ends).toFixed(1)} s) e niente chiusura anticipata`);
  check(after.peeking[4], 'CIRO: i voti in vista');

  // il telefono del Buttafuori ha l'opzione buttata fuori marcata, il Dottore vede l'indizio, Ciro i conteggi
  const t1 = await phones[1].page.evaluate(() => document.querySelectorAll('.cultura-opt.out, .cultura-opt[disabled]').length);
  check(t1 >= 1, 'BUTTAFUORI (telefono): la risposta buttata fuori e\' spenta');
  if (secIdx !== 2) {
    const t2 = await phones[2].page.evaluate(() => document.getElementById('app')?.innerText ?? '');
    check(/INIZIA PER/.test(t2), 'DOTTORE (telefono): vede l\'indizio');
  }

  // seconda pressione: ESAURITA (avviso privato), niente doppio effetto
  const hintBefore = after.hints[2];
  await press(2);
  await press(1);
  await sleep(900);
  const toast = await phones[1].page.evaluate(() => document.getElementById('ab-fail-toast')?.textContent ?? '');
  check(/ESAURITA|NON ORA|USATA/.test(toast) || (await phones[1].page.evaluate(() => !document.getElementById('cultura-abtn'))), `seconda pressione: nessun doppio effetto (${toast || 'bottone sparito'})`);
  const after2 = await scene((s, a) => ({ hidden: s.hidden.get(a.p), hint: s.hints.get(a.d) ?? null }), { p: pids[1], d: pids[2] });
  check(after2.hidden === after.hidden[1] && after2.hint === hintBefore, 'seconda pressione: la stessa risposta resta buttata, lo stesso indizio');

  // un voto dal telefono di Ciro e' visibile agli altri solo a lui come conteggio
  try {
    const opt = await phones[0].page.$('.cultura-opt:not([disabled]):not(.mine)');
    if (opt) await opt.click();
  } catch {
    /* ignora */
  }
  await sleep(1500);
  const counts = await scene((s, a) => s.peekCounts(a.c), { c: pids[4] });
  check(Array.isArray(counts) && counts.reduce((a, b) => a + b, 0) >= (secIdx === 0 ? 0 : 1), `CIRO: conteggio live dei voti ${JSON.stringify(counts)}`);

  // fine: nessuno stato residuo
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 30000, 'fine cultura');
  await sleep(500);
  const rows = await page.evaluate(() => window.__abilityHub.rows());
  check(rows.length === 0, 'a fine round AbilityHub e\' vuoto');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} controlli falliti` : '✅ tutto ok');
process.exit(st.fails ? 1 : 0);
