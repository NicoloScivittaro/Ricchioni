// CHI CAZZO LO SA? col controller (M5b... ehm M5c). 3 giocatori MISTI: P1 Xbox (dottore), P2 DualSense (ciro), P3 telefono (buttafuori).
// Prova: schermata CONTROLLI, selezione D-PAD "mentale" (mai in TV ne' sul telefono, wrap A<->D), CONFERMA (A/✕) manda la stessa
// submitAnswer del tocco telefono, RB/R1 = abilita', "private info companion" del telefono per Dottore/Ciro (SOLO PER TE, poi
// torna da solo a USA IL CONTROLLER), privacy in TV (mai quale lettera sta scegliendo ognuno), pausa, disconnessione/fallback,
// reconnect, round 1->10.
//   node scripts/e2e/gamepad-quiz.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, tap, until, phoneText, slots, pressedOf, f3Text, watchControls, startGame, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const G = (page, fn, arg) => sceneEval(page, 'quiz', fn, arg);
const LETTERS = ['A', 'B', 'C', 'D'];
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // CHARACTER_ORDER = ['goblin','buttafuori','dottore','judoka','ciro']. P1=dottore (indizio, immediato), P2=ciro
  // (riepilogo dopo lo scadere del timer normale, "private info companion" con dati), P3=buttafuori/telefono (non
  // e' il fulcro di questo test: serve solo a verificare che il fallback resti giocabile).
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
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox) e P2 (DualSense) col controller, P3 col telefono');
  const pairing0 = await slots(page);
  await watchControls(page);

  const P = (id) => sceneEval(
    page,
    'quiz',
    (g, a) => {
      const p = g.manager.players.get(a);
      return p ? { answerIndex: p.answerIndex, hasAnsweredFinal: p.hasAnsweredFinal, abilityUsed: p.abilityUsed, dottoreHintText: p.dottoreHintText, ciroWaiting: p.ciroWaiting, points: p.points } : null;
    },
    id
  );
  const rowStatus = (id) => sceneEval(page, 'quiz', (g, a) => g.playerRows.get(a)?.status.text ?? '', id);

  // ------------------------------------------------------------ CONTROLLI
  await startGame(page, 'quiz');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await btn(page, 0, 'LEFT', true); // D-PAD tenuto DURANTE la schermata: non deve muovere nulla in anticipo
  const frozenSamples = [];
  for (let k = 0; k < 10; k++) {
    const ov = await page.evaluate(() => !!document.getElementById('pad-controls'));
    if (!ov) break;
    frozenSamples.push(await G(page, (g) => g.manager.phaseTimer));
    await sleep(150);
  }
  check(frozenSamples.length > 1 && frozenSamples.every((v) => v === frozenSamples[0]), `gioco FERMO durante i CONTROLLI (phaseTimer invariato: ${JSON.stringify(frozenSamples)})`);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 2500 && dur <= 3100, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(
    /CHI CAZZO LO SA/.test(cc.text) &&
      /⬅ RISPOSTA PRECEDENTE/.test(cc.text) &&
      /➡ RISPOSTA SUCCESSIVA/.test(cc.text) &&
      /A \/ ✕ CONFERMA RISPOSTA/.test(cc.text) &&
      /RB \/ R1 ABILITÀ/.test(cc.text),
    `mostra: "${cc.text.slice(0, 220)}"`
  );
  await btn(page, 0, 'LEFT', false);
  await sleep(400);
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /CAZZO LO SA/.test(t1), `telefono P1: "${t1.slice(0, 55)}"`);
  check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK');

  await until(async () => (await G(page, (g) => g.manager.phase)) === 'question', 15000, 'domanda 1');
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(300);
  const selectedOf = async (name) => {
    const t = await f3Text(page);
    const m = new RegExp(`${name}: selected (\\S+)`).exec(t);
    return m ? m[1] : null;
  };

  // ------------------------------------------------------------ ABILITÀ (RB) PRIMA di confermare — Dottore (P1): indizio immediato
  const abBefore = await P(P1);
  await tap(page, 0, 'RB', 300);
  await sleep(400);
  const abAfter = await P(P1);
  check(abAfter.abilityUsed === true && abBefore.abilityUsed === false && !!abAfter.dottoreHintText, `RB/R1 = ABILITÀ: indizio del Dottore registrato ("${abAfter.dottoreHintText}")`);

  // "private info companion": il telefono di P1 (in modalita' pad) mostra l'indizio SOLO A LUI, senza nessun bottone di gioco.
  const t2 = await phoneText(phones[0]);
  check(/SOLO PER TE/.test(t2) && t2.includes(abAfter.dottoreHintText), `telefono P1: indizio privato mostrato ("${t2.slice(0, 70)}")`);
  check((await phones[0].page.evaluate(() => document.querySelectorAll('button').length)) === 0, 'schermata privata: nessun bottone di gioco (nessun tocco tocca il gameplay)');

  // ------------------------------------------------------------ D-PAD: selezione "mentale" (mai in TV/telefono), wrap A<->D
  // Prima di qualsiasi mossa non c'e' ancora una voce nella mappa (F3 mostra "—"): equivale ad A solo al momento della
  // CONFERMA (fallback "?? 0" in QuizScene), non e' un valore mostrato finche' non si muove almeno una volta.
  check((await selectedOf('P1')) === '—', `nessuna selezione esplicita prima della prima mossa (equivale ad A alla conferma): ${await selectedOf('P1')}`);
  await tap(page, 0, 'RIGHT', 90);
  await tap(page, 0, 'RIGHT', 90);
  check((await selectedOf('P1')) === 'C', `2x DESTRA: A -> C (${await selectedOf('P1')})`);
  await tap(page, 0, 'RIGHT', 90);
  await tap(page, 0, 'RIGHT', 90);
  check((await selectedOf('P1')) === 'A', `wrap avanti: C -> A dopo altre 2x DESTRA (${await selectedOf('P1')})`);
  await tap(page, 0, 'LEFT', 90);
  check((await selectedOf('P1')) === 'D', `wrap indietro: A -> D con SINISTRA (${await selectedOf('P1')})`);
  const statusBeforeConfirm = await rowStatus(P1);
  check(!/[ABCD]\b/.test(statusBeforeConfirm) && statusBeforeConfirm !== 'D', `la scheda di P1 in TV NON mostra la lettera selezionata: "${statusBeforeConfirm}"`);

  // ------------------------------------------------------------ CONFERMA (A/✕) — manda l'indice mentale, come un tocco sul telefono
  await tap(page, 0, 'A', 120);
  await sleep(300);
  const confirmed = await P(P1);
  check(confirmed.answerIndex === 3 && confirmed.hasAnsweredFinal === true, `CONFERMA: submitAnswer(P1, 3=D) (answerIndex ${confirmed.answerIndex}, locked ${confirmed.hasAnsweredFinal})`);
  const statusAfterConfirm = await rowStatus(P1);
  check(/RISPOSTO|CORRETTO|SBAGLIATO/.test(statusAfterConfirm) && !statusAfterConfirm.includes('D'), `la scheda in TV mostra solo lo stato aggregato dopo la conferma: "${statusAfterConfirm}"`);

  // ------------------------------------------------------------ ABILITÀ (RB) — Ciro (P2): riepilogo A/B/C/D SOLO dopo lo scadere del timer normale
  const ciroBefore = await P(P2);
  await tap(page, 1, 'RB', 300);
  await sleep(400);
  const ciroAfter = await P(P2);
  check(ciroAfter.abilityUsed === true && ciroBefore.abilityUsed === false && ciroAfter.ciroWaiting === true, 'RB/R1 = ABILITÀ: ULTIMO GIORNO UTILE registrata per P2 (Ciro)');
  // Solo per abbreviare il test: porta il tempo trascorso appena oltre il timer normale (resta sotto l'extra di grazia di
  // Ciro, quindi non forza la fine della domanda) invece di aspettare i 12-25s reali del timer per-domanda.
  await G(page, (g) => { g.manager.questionElapsed = g.manager.effectiveDeadline() + 0.1; });
  await sleep(500);
  const t3 = await phoneText(phones[1]);
  const hasBreakdownEl = await phones[1].page.evaluate(() => document.querySelectorAll('.quiz-breakdown-row').length === 4);
  check(/SOLO PER TE/.test(t3) && hasBreakdownEl, `telefono P2: riepilogo privato di Ciro mostrato ("${t3.slice(0, 70)}")`);

  await tap(page, 1, 'A', 90); // conferma con la selezione di default (A, indice 0): chiude ciroWaiting
  await sleep(300);
  const p2Confirmed = await P(P2);
  check(p2Confirmed.answerIndex === 0 && p2Confirmed.hasAnsweredFinal === true && p2Confirmed.ciroWaiting === false, `CONFERMA di Ciro chiude ULTIMO GIORNO UTILE (answerIndex ${p2Confirmed.answerIndex})`);
  await sleep(500);
  const t4 = await phoneText(phones[1]);
  check(/USA IL CONTROLLER/.test(t4) && !/SOLO PER TE/.test(t4), `telefono P2: torna da solo a USA IL CONTROLLER dopo la risposta ("${t4.slice(0, 55)}")`);

  // ------------------------------------------------------------ chiude la domanda 1 (P3 via bot diretto) e passa alla 2
  await G(page, (g, a) => g.manager.submitAnswer(a, 0), P3);
  await until(async () => (await G(page, (g) => g.manager.phase)) !== 'question' || (await G(page, (g) => g.manager.questionIndex)) > 0, 20000, 'chiusura domanda 1');
  // Q1 non e' 3/6/9: niente classifica intermedia, si passa dritti a Q2. Solo per abbreviare: salta i timer fissi (reveal/spiegazione/intro).
  let guardSkip = 0;
  while ((await G(page, (g) => g.manager.questionIndex)) === 0 && guardSkip++ < 60) {
    await G(page, (g) => { g.manager.phaseTimer = -1; });
    await sleep(120);
  }
  await until(async () => (await G(page, (g) => g.manager.phase)) === 'question', 15000, 'domanda 2');
  await sleep(200);

  // ------------------------------------------------------------ nuova domanda: la selezione "mentale" riparte da zero
  check((await selectedOf('P1')) === '—', `nuova domanda: la mappa di selezione e' stata azzerata (equivale di nuovo ad A): ${await selectedOf('P1')}`);
  check((await P(P1)).answerIndex === null, 'nuova domanda: answerIndex azzerato');

  // ------------------------------------------------------------ PAUSA — nessuna mossa/conferma fantasma
  await tap(page, 0, 'RIGHT', 90); // P1 a B, non ancora confermato
  check((await selectedOf('P1')) === 'B', `P1 su B prima della pausa (${await selectedOf('P1')})`);
  await page.keyboard.press('Escape');
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  const qElapsedBefore = await G(page, (g) => g.manager.questionElapsed);
  await btn(page, 0, 'RIGHT', true);
  await btn(page, 0, 'A', true);
  await sleep(600);
  const qElapsedDuring = await G(page, (g) => g.manager.questionElapsed);
  check(qElapsedDuring === qElapsedBefore, `in pausa il tempo della domanda NON avanza (${qElapsedBefore} -> ${qElapsedDuring})`);
  await btn(page, 0, 'RIGHT', false);
  await btn(page, 0, 'A', false);
  await page.keyboard.press('Escape');
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(400);
  const afterPause = await P(P1);
  check(afterPause.answerIndex === null && (await selectedOf('P1')) === 'B', `alla ripresa: nessuna conferma fantasma (answerIndex ${afterPause.answerIndex}), selezione invariata (${await selectedOf('P1')})`);
  await tap(page, 0, 'A', 90); // conferma vera dopo la ripresa
  await sleep(300);
  check((await P(P1)).answerIndex === 1, `conferma vera dopo la pausa: submitAnswer(P1, 1=B) (${(await P(P1)).answerIndex})`);

  // ------------------------------------------------------------ DISCONNESSIONE + fallback sul telefono + reconnect (P2)
  await remove(page, 1);
  await sleep(700);
  check((await pressedOf(page, P2, 'confirm')) === false, 'disconnessione: nessun input residuo su P2');
  await until(async () => await phones[1].page.evaluate(() => /CONTROLLER PERSO/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P2');
  const p2BeforeFallbackAnswer = await P(P2);
  check(p2BeforeFallbackAnswer.answerIndex === null, 'P2 non ha ancora risposto alla domanda 2 quando il controller cade');
  await phones[1].page.click('.quiz-ans-b'); // risponde dal TELEFONO in modalita' fallback (come previsto: l'input passa al telefono)
  await sleep(400);
  const p2AfterFallbackAnswer = await P(P2);
  check(p2AfterFallbackAnswer.answerIndex === 1, `P2 risponde dal telefono in fallback (answerIndex ${p2AfterFallbackAnswer.answerIndex})`);
  await add(page, 1, DS);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P2)) === 'paired', 'il controller di P2 torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[1])), 8000, 'telefono P2 torna al controller');

  // ------------------------------------------------------------ chiude la domanda 2 (P3 via bot) e gioca fino alla fine (bot su tutti)
  await G(page, (g, a) => g.manager.submitAnswer(a, 0), P3);
  let guard = 0;
  while ((await hostSnapshot(page)).phase === 'MINIGAME_PLAYING' && guard++ < 300) {
    await G(page, (g) => {
      const m = g.manager;
      if (m.phase === 'question') {
        for (const p of m.players.values()) {
          if (p.inSecondChanceGrace) { p.inSecondChanceGrace = false; p.hasAnsweredFinal = true; continue; }
          if (!p.hasAnsweredFinal && !p.ciroWaiting) m.submitAnswer(p.playerId, 0);
        }
      } else {
        m.phaseTimer = -1;
      }
    });
    await sleep(100);
  }
  await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 30000, 'fine quiz');
  check(guard < 300, `la partita e' arrivata a conclusione naturale entro le 10 domande (guard ${guard})`);

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
