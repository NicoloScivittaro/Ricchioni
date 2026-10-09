// Quiz sul telefono anche con Xbox/DualSense associati: UI, risposta, abilità private, pausa e cambio domanda.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { XBOX, DS, installMock, add, tap, until, slots, phoneText, watchControls, startGame, sceneEval } from './padmock.mjs';

const out = 'docs/agent-work/morning-playtest/quiz-phone';
mkdirSync(out, { recursive: true });
const browser = await launch();
const errors = [];
const G = (page, fn, arg) => sceneEval(page, 'quiz', fn, arg);
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  page.on('pageerror', e => errors.push(String(e)));
  const phones = [];
  for (const [name, char] of [['Dottore', 2], ['Ciro', 4], ['BOSCHI', 1]]) {
    const p = await addPhone(browser, code, name, char);
    p.page.on('pageerror', e => errors.push(String(e)));
    phones.push(p);
  }
  const ids = await hostEval(page, gm => gm.state.players.map(p => p.id));
  await installMock(page);
  await add(page, 0, XBOX);
  await add(page, 1, DS);
  await sleep(500);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(id => window.__pads.setTarget(id), ids[i]);
    await tap(page, i, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  assert.equal(await page.evaluate(() => window.__pads.pairedCount()), 2);
  const pairing = await slots(page);
  await watchControls(page);
  await startGame(page, 'quiz');
  await until(async () => (await page.evaluate(() => window.__cc.shownAt)) !== null, 15000, 'istruzioni telefono');
  const help = await page.evaluate(() => window.__cc.text);
  assert.match(help, /PRENDETE I TELEFONI/);
  assert.match(help, /LEGGETE LA DOMANDA E TOCCATE LA RISPOSTA/);
  await until(async () => await G(page, g => g.manager.phase === 'question'), 20000, 'domanda attiva');
  const q = await G(page, g => g.manager.currentQuestion());
  for (const p of phones) {
    await p.page.waitForFunction(text => document.querySelector('#quiz-question')?.textContent === text, {}, q.question);
    assert.deepEqual(await p.page.$$eval('.quiz-answer-text', es => es.map(e => e.textContent)), q.answers);
    assert.equal(await p.page.$('#pad-fallback-badge'), null);
    assert.doesNotMatch(await phoneText(p), /USA IL CONTROLLER/);
    assert.equal(await p.page.$('.quiz-answer.correct'), null, 'nessuna soluzione prima del reveal');
  }
  console.log('PASS: tutti e tre leggono domanda/risposte sul telefono, anche con due gamepad associati');
  // Il gamepad non può scegliere o attivare un'abilità nel Quiz.
  await tap(page, 0, 'RIGHT', 90);
  await tap(page, 0, 'A', 90);
  await tap(page, 0, 'RB', 90);
  assert.deepEqual(await G(page, (g, id) => {
    const p = g.manager.players.get(id); return [p.answerIndex, p.abilityUsed];
  }, ids[0]), [null, false]);
  // Pulsanti raggiungibili anche nei telefoni piccoli o orizzontali.
  for (const [name, width, height] of [['portrait', 390, 800], ['landscape', 800, 390], ['small', 360, 640]]) {
    await phones[0].page.setViewport({ width, height, isMobile: true, hasTouch: true });
    await sleep(180);
    for (const sel of ['.quiz-ans-a', '.quiz-ans-b', '.quiz-ans-c', '.quiz-ans-d', '#quiz-ability-btn']) {
      const r = await phones[0].page.$eval(sel, el => {
        el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
      });
      assert.ok(r.w >= 44 && r.h >= 44 && r.x >= 0 && r.x + r.w <= r.vw + 1 && r.y >= -1 && r.y + r.h <= r.vh + 1, `${name} ${sel}: ${JSON.stringify(r)}`);
    }
    await phones[0].page.$eval('.quiz-shell', el => { el.scrollTop = 0; });
    await phones[0].page.screenshot({ path: `${out}/${name}.png` });
  }
  await phones[0].page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  await phones[0].page.click('#quiz-ability-btn');
  await until(async () => await G(page, (g, id) => !!g.manager.players.get(id).dottoreHintText, ids[0]), 5000, 'indizio Dottore');
  const hint = await G(page, (g, id) => g.manager.players.get(id).dottoreHintText, ids[0]);
  await until(async () => (await phoneText(phones[0])).includes(hint), 5000, 'indizio nel quiz');
  assert.ok(await phones[0].page.$('.quiz-answers'), 'indizio non sostituisce le risposte');
  assert.equal(await phones[1].page.$eval('#quiz-hint', el => el.textContent), '', 'indizio resta privato');
  await phones[0].page.click(`.quiz-ans-${'abcd'[q.correctAnswerIndex]}`);
  await until(async () => await G(page, (g, id) => g.manager.players.get(id).answerIndex === g.manager.currentQuestion().correctAnswerIndex, ids[0]), 5000, 'risposta da telefono');
  await phones[2].page.click(`.quiz-ans-${'abcd'[q.correctAnswerIndex]}`);
  await phones[1].page.click('#quiz-ability-btn');
  await until(async () => await G(page, (g, id) => g.manager.players.get(id).ciroWaiting, ids[1]), 5000, 'abilità Ciro');
  await G(page, g => { g.manager.questionElapsed = g.manager.effectiveDeadline() + 0.1; });
  await until(async () => await phones[1].page.$$('.quiz-breakdown-row').then(es => es.length === 4), 5000, 'riepilogo privato Ciro');
  assert.ok(await phones[1].page.$('.quiz-answers'));
  await phones[1].page.click(`.quiz-ans-${'abcd'[q.correctAnswerIndex]}`);
  await until(async () => await G(page, g => g.manager.phase === 'reveal'), 10000, 'reveal');
  await phones[0].page.waitForFunction(() => document.querySelectorAll('.quiz-answer:disabled').length === 4 && !!document.querySelector('.quiz-answer.correct'));
  console.log('PASS: gamepad esclusi, risposte/abilità sul telefono, indizio Dottore e riepilogo Ciro privati');
  while (await G(page, g => g.manager.questionIndex === 0)) {
    await G(page, g => { g.manager.phaseTimer = -1; });
    await sleep(160);
  }
  await until(async () => await G(page, g => g.manager.phase === 'question'), 10000, 'seconda domanda');
  await phones[0].page.waitForFunction(() => document.querySelector('#quiz-qnum')?.textContent === 'Domanda 2/10' && document.querySelectorAll('.quiz-answer:disabled').length === 0);
  assert.equal(await phones[0].page.$('.quiz-answer.selected'), null);
  await page.keyboard.press('Escape');
  await phones[0].page.waitForSelector('#pause-overlay');
  const elapsed = await G(page, g => g.manager.questionElapsed);
  await sleep(500);
  assert.equal(await G(page, g => g.manager.questionElapsed), elapsed);
  await page.keyboard.press('Escape');
  await phones[0].page.waitForFunction(() => !document.querySelector('#pause-overlay'));
  const answer = await G(page, g => g.manager.currentQuestion().correctAnswerIndex);
  await phones[0].page.click(`.quiz-ans-${'abcd'[answer]}`);
  await until(async () => await G(page, (g, id) => g.manager.players.get(id).answerIndex !== null, ids[0]), 5000, 'risposta dopo pausa');
  assert.equal(await slots(page), pairing, 'associazioni gamepad conservate per gli altri giochi');
  assert.deepEqual(errors, []);
  console.log('PASS: tre dimensioni schermo, domanda successiva, pausa/ripresa e pairing conservato; nessun errore pagina');
} finally {
  await browser.close();
}
