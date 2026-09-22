// MEMORIA DA UBRIACO col controller (M5a). 3 giocatori MISTI: P1 Xbox, P2 DualSense, P3 telefono (fallback).
// Prova: schermata CONTROLLI (diamante TOP/RIGHT/BOTTOM/LEFT), le 4 tessere per POSIZIONE fisica (non lettera), pressione
// singola = una tessera (no spam se tenuto), rapida in sequenza, RB/R1 = abilità, errore, completamento, eliminazione,
// round 1→5, ultimo superstite, privacy (la TV non mostra QUALE tasto preme ognuno), pausa, disconnessione, reconnect.
//   node scripts/e2e/gamepad-memory.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, tap, until, phoneText, slots, pressedOf, f3Text, watchControls, resetControlsWatch, startGame, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const G = (page, fn, arg) => sceneEval(page, 'memory', fn, arg);
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // Personaggi scelti apposta: P1=goblin (abilita' in fase OBSERVE), P2=dottore (abilita' in fase REPEAT, elimina normalmente
  // su tasto sbagliato), P3=buttafuori (abilita' PASSIVA — seconda chance automatica, non serve al test del bottone RB).
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

  const P = (id) => sceneEval(page, 'memory', (g, a) => { const p = g.players.find((q) => q.snap.id === a); return p ? { alive: p.alive, resolved: p.resolved, inputIndex: p.inputIndex, completedRounds: p.completedRounds, abilityUsed: p.abilityUsed, totalCorrect: p.totalCorrect } : null; }, id);

  // ------------------------------------------------------------ CONTROLLI
  await startGame(page, 'memory');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await btn(page, 0, 'Y', true); // TOP tenuto DURANTE la schermata: non deve contare come pressione
  const samples = [];
  for (let k = 0; k < 14; k++) {
    const ov = await page.evaluate(() => !!document.getElementById('pad-controls'));
    if (!ov) break;
    samples.push(ov);
    await sleep(150);
  }
  const frozen0 = await G(page, (g) => ({ phase: g.phase, round: g.round }));
  check(frozen0.phase === 'title', `gioco FERMO durante i CONTROLLI (fase ${frozen0.phase})`);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 2500 && dur <= 3100, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/MEMORIA DA UBRIACO/.test(cc.text) && /Y \/ △ TESSERA IN ALTO/.test(cc.text) && /B \/ ◯ TESSERA A DESTRA/.test(cc.text) && /A \/ ✕ TESSERA IN BASSO/.test(cc.text) && /X \/ □ TESSERA A SINISTRA/.test(cc.text) && /RB \/ R1 ABILITÀ/.test(cc.text), `mostra: "${cc.text.slice(0, 220)}"`);
  await btn(page, 0, 'Y', false);
  await sleep(400);
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /MEMORIA/.test(t1), `telefono P1: "${t1.slice(0, 55)}"`);
  check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK');

  // Aspetta la fase 'repeat' di un round NUOVO (round > afterRound): 'repeat' resta vera per un istante anche appena un round
  // e' stato risolto, quindi un semplice "aspetta che phase===repeat" a volte intercetta il round GIA' finito, non quello dopo.
  const waitRepeat = async (afterRound) => {
    await until(async () => {
      const s = await G(page, (g) => ({ phase: g.phase, round: g.round }));
      return s.phase === 'repeat' && s.round > afterRound;
    }, 40000, `repeat round > ${afterRound}`);
    await sleep(200); // lascia che il primo poll del gamepad dopo il cambio fase si stabilizzi prima del primo tap
    return G(page, (g) => g.round);
  };
  const waitObserve = async (afterRound) => {
    await until(async () => {
      const s = await G(page, (g) => ({ phase: g.phase, round: g.round }));
      return s.phase === 'observe' && s.round > afterRound;
    }, 40000, `observe round > ${afterRound}`);
    await sleep(200);
    return G(page, (g) => g.round);
  };

  // ------------------------------------------------------------ TOP/RIGHT/BOTTOM/LEFT — una pressione ciascuna sulla sequenza vera
  let curRound = await waitRepeat(-1);
  const seq = await G(page, (g) => g.sequences[g.round]);
  const BTN = ['Y', 'B', 'A', 'X']; // TOP, RIGHT, BOTTOM, LEFT
  console.log('   [seq]', JSON.stringify(seq), 'buttons', seq.map((t) => BTN[t]));
  for (let i = 0; i < seq.length; i++) {
    const before = await P(P1);
    await tap(page, 0, BTN[seq[i]], 220);
    await sleep(150);
    const after = await P(P1);
    check(after.inputIndex === before.inputIndex + 1 || after.resolved, `mossa ${i + 1}/${seq.length}: tessera ${['ALTO', 'DESTRA', 'BASSO', 'SINISTRA'][seq[i]]} (${BTN[seq[i]]}) avanza la sequenza (${before.inputIndex} -> ${after.inputIndex}, resolved ${after.resolved})`);
  }
  const doneP1 = await P(P1);
  check(doneP1.resolved === true && doneP1.completedRounds === 1, `round 1 completato dal controller (${doneP1.completedRounds} round)`);

  // privacy: la scheda del giocatore sulla TV mostra solo lo stato AGGREGATO (es. "2/5", "FATTO"), mai QUALE tessera/tasto ha premuto
  const cardText = await sceneEval(page, 'memory', (g, id) => g.players.find((p) => p.snap.id === id)?.card.text ?? '', P1);
  check(/\d\/\d|FATTO|OSSERVA/i.test(cardText) && !/ALTO|DESTRA|BASSO|SINISTRA|ROSSO|BLU|VERDE|GIALLO|⬆|➡|⬇|⬅/.test(cardText), `la scheda di P1 mostra solo lo stato aggregato, non la tessera premuta: "${cardText.replace(/\n/g, ' | ')}"`);

  // ------------------------------------------------------------ ABILITÀ (RB) — goblin (P1): fase OBSERVE, come da bilanciamento
  const obsRound = await waitObserve(curRound);
  const abBefore = await P(P1);
  await tap(page, 0, 'RB', 300);
  await sleep(300);
  const abAfter = await P(P1);
  check(abAfter.abilityUsed === true && abBefore.abilityUsed === false, `RB/R1 = ABILITÀ in fase OSSERVA (round ${obsRound}): "ANCORA UN GIRO" registrata`);
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(500);
  check(/P1[\s\S]*?GIOCO[^\n]*ability [1-9]\d*x/.test(await f3Text(page)), 'F3: il gioco consuma la pressione di RB');
  await page.keyboard.press('F3');

  // ------------------------------------------------------------ pressione singola: tenuto 300ms = UNA sola scelta, non spam (STESSO round dell'osserva appena testato)
  await until(async () => (await G(page, (g) => ({ phase: g.phase, round: g.round }))).phase === 'repeat', 30000, 'repeat dopo observe');
  await sleep(200);
  curRound = await G(page, (g) => g.round);
  check(curRound === obsRound, `stesso round tra osserva (${obsRound}) e ripeti (${curRound})`);
  const seq2 = await G(page, (g) => g.sequences[g.round]);
  const before2 = await P(P1);
  await btn(page, 0, BTN[seq2[0]], true);
  await sleep(300);
  await btn(page, 0, BTN[seq2[0]], false);
  await sleep(200);
  const after2 = await P(P1);
  check(after2.inputIndex === before2.inputIndex + 1, `tasto tenuto 300ms: UNA sola mossa registrata (${before2.inputIndex} -> ${after2.inputIndex}, non ${before2.inputIndex + 2}+)`);

  // pressione rapida in sequenza (senza pause artificiali)
  for (let i = 1; i < seq2.length; i++) {
    await tap(page, 0, BTN[seq2[i]], 90);
  }
  await sleep(300);
  const afterFast = await P(P1);
  check(afterFast.resolved === true, 'pressioni rapide in sequenza: il round si completa comunque (nessun input perso)');

  // ------------------------------------------------------------ ERRORE / ELIMINAZIONE (P2 = dottore: nessuna seconda chance, tasto sbagliato elimina)
  curRound = await waitRepeat(curRound);
  const seq3 = await G(page, (g) => g.sequences[g.round]);
  const wrong = (seq3[0] + 1) % 4;
  await tap(page, 1, BTN[wrong], 220);
  await sleep(300);
  const p2AfterWrong = await P(P2);
  check(p2AfterWrong.alive === false, `tasto sbagliato: P2 (dottore) eliminato subito (vivo ${p2AfterWrong.alive}, mossa ${p2AfterWrong.inputIndex})`);
  // P1 deve completare la SUA sequenza in questo stesso round, altrimenti scade per timeout: con P2 appena eliminato P1
  // resterebbe l'unico in gara e non deve morire per un dettaglio del test, altrimenti la partita finisce qui per errore.
  for (const t of seq3) await tap(page, 0, BTN[t], 100);
  await sleep(300);
  check((await P(P1)).resolved === true, 'P1 completa comunque la sua sequenza nello stesso round (resta in gara)');

  // ------------------------------------------------------------ pausa: nessuna tessera fantasma
  curRound = await waitRepeat(curRound);
  // pausa+disconnessione+reconnessione richiedono diversi round-trip reali: si allunga la scadenza di P1 SOLO nel test, altrimenti
  // rischia di scadere per timeout mentre e' fermo ad aspettare (il tempo di gioco continua a scorrere durante questi controlli).
  await G(page, (g, id) => { g.players.find((p) => p.snap.id === id).deadline += 60; }, P1);
  const pauseBefore = await P(P1);
  await hostEval(page, (gm) => gm.setPaused(true));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  await btn(page, 0, 'Y', true);
  await sleep(600);
  const pauseDuring = await P(P1);
  check(pauseDuring.inputIndex === pauseBefore.inputIndex, 'in pausa: nessuna tessera fantasma (inputIndex invariato con Y tenuto)');
  await btn(page, 0, 'Y', false);
  await hostEval(page, (gm) => gm.setPaused(false));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(500);
  const pauseAfter = await P(P1);
  check(pauseAfter.inputIndex === pauseBefore.inputIndex, 'alla ripresa: ancora nessuna tessera fantasma (serve ripremere)');

  // ------------------------------------------------------------ disconnessione + reconnect
  await btn(page, 0, 'Y', true);
  await sleep(300);
  await remove(page, 0);
  await sleep(700);
  check((await pressedOf(page, P1, 'c0')) === false, 'disconnessione: nessun input residuo (tessera ALTO rilasciata)');
  check(/DISCONNESSO|SCOLLEGATO/.test(await page.evaluate(() => document.getElementById('pad-alert')?.innerText ?? '')), 'avviso TV: controller scollegato');
  await until(async () => await phones[0].page.evaluate(() => /FALLBACK/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P1');
  await add(page, 0, XBOX);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'il controller torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'telefono torna al controller');

  // ------------------------------------------------------------ round 1→5: gioca fino alla fine (bot rapido su tutti i pad vivi)
  let guard = 0;
  while ((await hostSnapshot(page)).phase === 'MINIGAME_PLAYING' && guard++ < 40) {
    const phase = await G(page, (g) => g.phase);
    if (phase === 'repeat') {
      const seqNow = await G(page, (g) => g.sequences[g.round]);
      const alivePads = [];
      if ((await P(P1))?.alive) alivePads.push([0, P1]);
      if ((await P(P2))?.alive) alivePads.push([1, P2]);
      for (const step of seqNow) {
        for (const [padIdx] of alivePads) await tap(page, padIdx, BTN[step], 80);
        await sleep(60);
      }
    }
    await sleep(250);
  }
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 60000, 'fine memoria');
  check(guard < 40, `la partita e' arrivata a conclusione naturale entro i 5 round (guard ${guard})`);

  // ------------------------------------------------------------ risultati -> rullo, associazioni invariate
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
