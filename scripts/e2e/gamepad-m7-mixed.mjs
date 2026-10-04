// M7 — SESSIONE MISTA + DISCONNECT TORTURE: 5 giocatori, P1-P3 col controller, P4-P5 col telefono (fallback).
//   Kart -> Quiz -> Sparatoria -> Cultura -> Arena   (risultati + rullo fra ogni gioco, nessun refresh, nessuna riassociazione)
// In Kart, Quiz, Sparatoria e Arena il controller di P1 viene STACCATO a meta' gioco e poi riattaccato:
//   input a zero, nessuna azione fantasma, telefono in fallback ("CONTROLLER PERSO"), avvisi TV/telefono, stesso playerId al ritorno.
//   node scripts/e2e/gamepad-m7-mixed.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, remove, btn, stick, tap, until, phoneText, slots, axisOf, watchControls, resetControlsWatch, gameEval, sceneEval } from './padmock.mjs';

const { st, check } = makeCheck();
const FAMILIES = [XBOX, DS, GENERIC];
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3, scoreDownPresses: 2 }); // 5 giocatori, SERATA
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  await page.evaluate(() => (window.__smoke = 'host'));
  for (const p of phones) await p.page.evaluate(() => (window.__smoke = 'phone'));
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const P1 = pids[0];
  await installMock(page);
  for (let k = 0; k < 3; k++) await add(page, k, FAMILIES[k]);
  await sleep(500);
  for (let k = 0; k < 3; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 3, 'lobby: 3 controller (P1-P3), P4-P5 col telefono');
  const badge = await page.evaluate(() => document.getElementById('pad-badge')?.textContent ?? '');
  check(/3 🎮 \+ 2 📱/.test(badge), `ready check in lobby leggibile: "${badge}"`);
  const pairing0 = await slots(page);
  await watchControls(page);
  const phaseNow = async () => (await hostSnapshot(page)).phase;
  const canvasCount = () => page.evaluate(() => document.querySelectorAll('canvas').length);
  const canvasBaseline = await canvasCount();
  const toastsText = () => page.evaluate(() => document.getElementById('pad-toasts')?.innerText ?? '');

  let roundIdx = 0;
  const finishRound = async () => {
    const order = [0, 1, 2, 3, 4].map((i) => (i + roundIdx) % 5);
    roundIdx++;
    await hostEval(page, (gm, ord) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ord.map((pi, k) => ({ playerId: ctx.players[pi].id, placement: k + 1, score: 5 - k })) });
    }, order);
  };
  const goNext = async (last) => {
    await until(async () => (await phaseNow()) === 'ROUND_RESULTS', 90000, 'risultati');
    if (last) return;
    await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes(await phaseNow()), 120000, 'rullo');
  };

  const start = async (id) => {
    await resetControlsWatch(page);
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    if ((await phaseNow()) === 'LOBBY') {
      await sleep(300);
      await page.keyboard.press('Enter');
    }
    await until(async () => (await phaseNow()) === 'MINIGAME_PLAYING', 120000, `${id} PLAYING`);
    await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, `CONTROLLI ${id}`);
    await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, `fine CONTROLLI ${id}`);
  };

  /** Telefoni nei giochi col controller: P1-P3 passivi, P4-P5 in fallback con i controlli del telefono. */
  const checkPhones = async (label) => {
    for (let i = 0; i < 3; i++) check(/USA IL CONTROLLER/.test(await phoneText(phones[i])), `${label}: telefono P${i + 1} passivo ("USA IL CONTROLLER")`);
    for (let i = 3; i < 5; i++) {
      const fb = await phones[i].page.evaluate(() => document.getElementById('pad-fallback-badge')?.textContent ?? '');
      const t = await phoneText(phones[i]);
      check(/FALLBACK/.test(fb) && !/USA IL CONTROLLER/.test(t), `${label}: telefono P${i + 1} in fallback, coi controlli del telefono`);
    }
  };

  /** Input di P1 a zero: lo stick del gioco (axisCtl) oppure, per i giochi senza stick, i tasti indicati. */
  const inputZero = async (axisCtl, buttons = []) => {
    if (axisCtl) {
      const ax = await axisOf(page, P1, axisCtl);
      if (ax.x !== 0 || ax.y !== 0) return `${axisCtl} ${ax.x},${ax.y}`;
    }
    for (const b of buttons) if (await hostEval(page, (gm, a) => gm.input.get(a.id).peekPressed(a.c), { id: P1, c: b })) return `${b} premuto`;
    return '';
  };

  /**
   * TORTURE: P1 tiene lo stick (e, nei giochi senza stick, nessun tasto), il controller viene staccato. Poi riattaccato.
   * axisCtl/buttons = cosa deve tornare a zero; ghost = nessuna azione fantasma (ritorna true se ok).
   */
  const torture = async (label, axisCtl, buttons, ghost) => {
    await stick(page, 0, 1, 0);
    await sleep(400);
    await remove(page, 0);
    await sleep(800);
    const z = await inputZero(axisCtl, buttons);
    check(z === '', `${label} DISCONNESSO: input di P1 a zero${z ? ` (${z})` : ''}`);
    check(await ghost(), `${label} DISCONNESSO: nessuna azione fantasma`);
    check(/CONTROLLER DI P1 DISCONNESSO/.test(await toastsText()), `${label}: TV "⚠️ CONTROLLER DI P1 DISCONNESSO"`);
    await until(async () => /CONTROLLER PERSO/.test(await phones[0].page.evaluate(() => document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, `${label} fallback P1`);
    check(true, `${label}: telefono di P1 "📱 CONTROLLER PERSO — USA TEMPORANEAMENTE IL TELEFONO"`);
    await stick(page, 0, 0, 0);
    // gli avvisi di riconnessione durano ~2.5 s: li registra la pagina stessa (ogni 30 ms), perche' con 5 viste 3D in GL software
    // un polling da Node puo' saltarli senza che il gioco abbia alcun difetto
    const record = (pg, sel, re) => pg.evaluate((s, r) => {
      window.__seen = false;
      clearInterval(window.__seenT);
      window.__seenT = setInterval(() => {
        if (new RegExp(r).test(document.querySelector(s)?.textContent ?? '')) { window.__seen = true; clearInterval(window.__seenT); }
      }, 30);
    }, sel, re);
    await record(phones[0].page, '#pad-phone-toast', 'RICONNESSO');
    await record(page, '#pad-toasts', 'CONTROLLER DI P1 RICONNESSO');
    await add(page, 0, FAMILIES[0]);
    let phoneToastSeen = false;
    let tvToastSeen = false;
    const look = async () => {
      phoneToastSeen ||= await phones[0].page.evaluate(() => window.__seen === true);
      tvToastSeen ||= await page.evaluate(() => window.__seen === true);
    };
    await until(async () => {
      await look();
      return (await page.evaluate((id) => window.__pads.slotOf(id)?.state, P1)) === 'paired';
    }, 8000, `${label} riconnessione`);
    await until(async () => {
      await look();
      return phoneToastSeen && tvToastSeen;
    }, 6000, `${label} avvisi di riconnessione`);
    check(tvToastSeen, `${label}: TV "🎮 CONTROLLER DI P1 RICONNESSO"`);
    check(phoneToastSeen, `${label}: telefono di P1 "🎮 CONTROLLER RICONNESSO" (breve)`);
    check((await slots(page)) === pairing0, `${label}: stesso controller sullo stesso playerId (nessuna riassociazione)`);
    await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, `${label} P1 torna passivo`);
    check(true, `${label}: il telefono di P1 torna passivo da solo`);
  };

  // ---------------------------------------------------------------- KART
  console.log('\n--- KART ---');
  await start('kart3d');
  await until(async () => (await gameEval(page, 'kart3d', (g) => g.race?.phase)) === 'racing', 60000, 'via kart');
  await checkPhones('Kart');
  await torture('Kart', 'steer', [], async () => {
    const k = await gameEval(page, 'kart3d', (g, id) => { const kk = g.karts.get(id); return { d: kk.drifting, b: kk.boostTimer }; }, P1);
    return !k.d && k.b === 0;
  });
  await finishRound();
  await goNext(false);
  check((await canvasCount()) === canvasBaseline, 'Kart: nessun canvas residuo');

  // ---------------------------------------------------------------- QUIZ
  console.log('\n--- QUIZ ---');
  await start('quiz');
  await until(async () => (await sceneEval(page, 'quiz', (g) => g.manager.phase)) === 'question', 30000, 'domanda');
  await checkPhones('Quiz');
  await torture('Quiz', null, ['confirm', 'selectNext', 'selectPrev'], async () => (await sceneEval(page, 'quiz', (g, id) => g.manager.players.get(id).answerIndex, P1)) === null);
  await finishRound();
  await goNext(false);

  // ---------------------------------------------------------------- SPARATORIA
  console.log('\n--- SPARATORIA ---');
  await start('fps');
  await until(async () => (await sceneEval(page, 'fps', (g) => g.controlsDone && (g.splitScreen?.cams.length ?? 0) === 3)) === true, 45000, 'split-screen 3p');
  check(true, 'Sparatoria: split-screen con 3 finestre (P1-P3)');
  for (let i = 3; i < 5; i++) {
    // il renderer del telefono si monta in parallelo alle 3 finestre della TV: in GL software puo' metterci qualche secondo
    const ok = await until(async () => (await phones[i].page.evaluate(() => document.querySelectorAll('canvas').length)) >= 1, 20000, `renderer P${i + 1}`).then(() => true, () => false);
    check(ok, `Sparatoria: P${i + 1} gioca col renderer del telefono`);
  }
  for (let i = 0; i < 3; i++) check((await phones[i].page.evaluate(() => document.querySelectorAll('canvas').length)) === 0, `Sparatoria: telefono P${i + 1} senza renderer 3D`);
  const fpsPos = () => sceneEval(page, 'fps', (g, id) => { const p = g.players.find((q) => q.id === id); return { x: p.x, z: p.z, dash: p.dashCooldown }; }, P1);
  let fpsAtDisc = null;
  await torture('Sparatoria', 'move', ['fire', 'dash'], async () => {
    fpsAtDisc = await fpsPos();
    await sleep(500);
    const now = await fpsPos();
    return Math.hypot(now.x - fpsAtDisc.x, now.z - fpsAtDisc.z) < 0.02 && now.dash === 0;
  });
  await sleep(500);
  check((await phones[0].page.evaluate(() => document.querySelectorAll('canvas').length)) === 0, 'Sparatoria: dopo la riconnessione il renderer di emergenza sul telefono di P1 viene chiuso');
  await finishRound();
  await goNext(false);
  check((await canvasCount()) === canvasBaseline, 'Sparatoria: nessun canvas residuo');

  // ---------------------------------------------------------------- CULTURA
  console.log('\n--- CULTURA ---');
  await btn(page, 0, 'A', true);
  await start('cultura');
  check((await page.evaluate(() => window.__pads.contextNow())) === 'PHONE_TEXT', 'Cultura: controller ignorati (PHONE_TEXT)');
  for (let i = 0; i < 5; i++) check(!/USA IL CONTROLLER/.test(await phoneText(phones[i])), `Cultura: telefono P${i + 1} attivo`);
  await btn(page, 0, 'A', false);
  await finishRound();
  await until(async () => await page.evaluate(() => /RIPRENDETE I CONTROLLER/.test(document.getElementById('pad-retake')?.innerText ?? '')), 8000, 'RIPRENDETE');
  check(true, 'fine Cultura: TV "🎮 RIPRENDETE I CONTROLLER"');
  await goNext(false);

  // ---------------------------------------------------------------- ARENA
  console.log('\n--- ARENA ---');
  await start('arena');
  await until(async () => (await gameEval(page, 'arena', (g) => g.phase)) === 'playing', 60000, 'via arena');
  await checkPhones('Arena');
  await torture('Arena', 'move', ['dash'], async () => (await gameEval(page, 'arena', (g, id) => g.players.find((p) => p.id === id).dashCooldown, P1)) === 0);
  await finishRound();
  await goNext(true);

  check((await slots(page)) === pairing0, 'FINE SESSIONE: stesse associazioni dall\'inizio');
  check((await page.evaluate(() => window.__smoke)) === 'host', 'host mai ricaricato');
  for (let i = 0; i < 5; i++) check((await phones[i].page.evaluate(() => window.__smoke)) === 'phone', `telefono P${i + 1} mai ricaricato`);
  const report = await page.evaluate(() => (window.__sessionReport ? window.__sessionReport() : ''));
  check(/=== INPUT ===/.test(report) && /P1: \d+ giochi col controller · \d+ in fallback telefono · disconnessioni [1-9]/.test(report), 'report F4: sezione INPUT con giochi controller/fallback e disconnessioni per giocatore');
  console.log(report.split('=== INPUT ===')[1]?.split('───')[0] ?? '');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
