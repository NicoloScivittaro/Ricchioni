// Build di produzione, nessun debug: domanda/risposte su tre telefoni e risposta confermata dallo stato dell'host.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
process.env.CTRL_URL = process.env.PROD_CTRL ?? 'http://localhost:3001/controller.html';
const { launch, addPhone, sleep } = await import('./lib.mjs');
const origin = process.env.PROD_HOST ?? 'http://localhost:3001/';
const browser = await launch();
const report = { errors: [], phones: [] };
const until = async (fn, what, ms = 60000) => {
  const start = Date.now();
  while (Date.now() - start < ms) { if (await fn()) return; await sleep(120); }
  throw new Error(`Timeout: ${what}`);
};
async function observe(page, onEvent) {
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameReceived', ({ response }) => {
    const raw = response.payloadData ?? '';
    if (!raw.startsWith('42')) return;
    try { const [event, data] = JSON.parse(raw.slice(2)); onEvent(event, data); } catch {}
  });
  page.on('pageerror', e => report.errors.push(String(e)));
}
try {
  const host = await browser.newPage();
  let state = null;
  await observe(host, (event, data) => { if (event === 'room:state') state = data; });
  await host.goto(origin, { waitUntil: 'load' });
  await host.waitForSelector('#app canvas'); await sleep(1700);
  await host.keyboard.press('ArrowRight'); await sleep(160); await host.keyboard.press('Enter');
  await until(() => state?.roomCode, 'stanza');
  const phones = [];
  for (const [name, char] of [['Nicolò', 0], ['Christian', 1], ['Carbo', 3]]) {
    const p = await addPhone(browser, state.roomCode, name, char);
    p.quizState = null;
    await observe(p.page, (event, data) => { if (event === 'private:data' && data.type === 'quizState') p.quizState = data; });
    phones.push(p);
  }
  await until(() => state.players.length === 3 && state.players.every(p => p.ready), 'tre pronti');
  await host.keyboard.press('ArrowRight'); await sleep(180); await host.keyboard.press('Enter');
  await until(() => state.phase === 'MINIGAME_PLAYING' && state.currentMinigame?.minigameId === 'quiz', 'Quiz');
  for (const p of phones) {
    await until(() => p.quizState?.phase === 'question', `${p.name}: domanda`);
    const q = p.quizState;
    assert.equal(await p.page.$eval('#quiz-question', el => el.textContent), q.question);
    assert.deepEqual(await p.page.$$eval('.quiz-answer-text', es => es.map(e => e.textContent)), q.answers);
    assert.equal(q.correctIndex, null);
    assert.equal(await p.page.$('#pad-fallback-badge'), null);
    await p.page.click('.quiz-ans-b');
  await p.page.click('#quiz-confirm');
    await until(() => p.quizState.myAnswerIndex === 1, `${p.name}: risposta ricevuta dall'host`, 5000);
    report.phones.push({ name: p.name, question: q.question, answers: q.answers, answerIndex: p.quizState.myAnswerIndex });
  }
  await phones[0].page.screenshot({ path: 'docs/agent-work/morning-playtest/quiz-phone/production.png' });
  assert.deepEqual(report.errors, []);
  writeFileSync('docs/agent-work/morning-playtest/quiz-phone-production.json', JSON.stringify(report, null, 2));
  console.log('PASS produzione: tre telefoni, domanda e risposte visibili, tocco confermato dall’host; nessun errore pagina');
} finally { await browser.close(); }
