// GAMEPAD — schermata CONTROLLI, diagnostica F3, robustezza del ciclo di polling, precedenza gamepad/telefono, giochi non migrati.
// Controller simulati (navigator.getGamepads sostituito nella pagina host). 2 giocatori con famiglie DIVERSE (Xbox + PlayStation).
//   node scripts/e2e/gamepad-controls.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const DS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';

async function installMock(page) {
  await page.evaluate(() => {
    const mp = (window.__mp = { pads: {}, rumbles: [], throwOnce: false, names: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'] });
    navigator.getGamepads = () => {
      if (mp.throwOnce) {
        mp.throwOnce = false;
        // un gamepad malformato (buttons/axes nulli): l'errore nasce DENTRO poll(), non in getGamepads()
        return [{ index: 0, id: 'Gamepad rotto', connected: true, mapping: 'standard', axes: null, buttons: null }, null, null, null];
      }
      const a = [null, null, null, null];
      for (const k of Object.keys(mp.pads)) {
        const p = mp.pads[k];
        a[p.index] = {
          index: p.index,
          id: p.id,
          connected: true,
          mapping: 'standard',
          axes: [...p.axes],
          buttons: p.buttons.map((b) => ({ pressed: b.v > 0.5, value: b.v })),
          vibrationActuator: { playEffect: (t, o) => (mp.rumbles.push({ index: p.index, ...o }), Promise.resolve('complete')) }
        };
      }
      return a;
    };
    window.__padAdd = (index, id) => {
      mp.pads[index] = { index, id, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ v: 0 })) };
      const ev = new Event('gamepadconnected');
      ev.gamepad = navigator.getGamepads()[index];
      window.dispatchEvent(ev);
    };
    window.__padBtn = (index, name, down) => {
      if (mp.pads[index]) mp.pads[index].buttons[mp.names.indexOf(name)].v = down ? 1 : 0;
    };
    window.__padStick = (index, lx, ly) => {
      if (mp.pads[index]) mp.pads[index].axes = [lx, ly, 0, 0];
    };
  });
}
const add = (page, i, id) => page.evaluate((a, b) => window.__padAdd(a, b), i, id);
const btn = (page, i, n, d) => page.evaluate((a, b, c) => window.__padBtn(a, b, c), i, n, d);
const stick = (page, i, x, y) => page.evaluate((a, b, c) => window.__padStick(a, b, c), i, x, y);
async function tap(page, i, n, hold = 380) {
  await btn(page, i, n, true);
  await sleep(hold);
  await btn(page, i, n, false);
  await sleep(220);
}
const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(150);
  }
  throw new Error('timeout: ' + what);
};
const phoneText = (ph) => ph.page.evaluate(() => (document.getElementById('app')?.innerText ?? '').replace(/\s+/g, ' '));
const axisOf = (page, pid) => hostEval(page, (gm, id) => gm.input.get(id).peekAxis('move'), pid);
const arenaState = (page, pid) =>
  hostEval(page, (gm, id) => {
    const g = gm.game.scene.getScene('arena')?.game3d;
    const p = g?.players?.find((x) => x.id === id);
    return g ? { phase: g.phase, countdown: g.countdown, gameTime: g.gameTime, dashCooldown: p?.dashCooldown ?? 0, dashing: !!p?.dashing, x: p?.x, z: p?.z } : null;
  }, pid);

const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 0 }); // 2 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [await addPhone(browser, code, 'P1', 0), await addPhone(browser, code, 'P2', 1)];
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page);
  await add(page, 0, XBOX);
  await add(page, 1, DS);
  await sleep(500);
  for (let k = 0; k < 2; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, '2 controller associati (Xbox Wireless + DualSense)');
  const fams = await page.evaluate(() => window.__pads.views().map((v) => v.family));
  check(fams[0] === 'xbox' && fams[1] === 'playstation', `"Xbox Wireless Controller" e' Xbox e non PlayStation (${fams.join(', ')})`);
  await sleep(500);

  // osservatore: quando compare/sparisce la schermata CONTROLLI e cosa contiene
  await page.evaluate(() => {
    window.__cc = { shownAt: null, hiddenAt: null, text: '', samples: [] };
    new MutationObserver(() => {
      const el = document.getElementById('pad-controls');
      const now = performance.now();
      if (el && window.__cc.shownAt === null) {
        window.__cc.shownAt = now;
        window.__cc.text = el.innerText.replace(/\s+/g, ' ');
      }
      if (!el && window.__cc.shownAt !== null && window.__cc.hiddenAt === null) window.__cc.hiddenAt = now;
    }).observe(document.body, { childList: true });
  });

  // ---------------------------------------------------------------- ARENA: schermata CONTROLLI
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'arena');
  await sleep(300);
  await page.keyboard.press('Enter');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 60000, 'arena PLAYING');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 40000, 'schermata CONTROLLI');
  // durante la schermata: A tenuto sul pad 0, stick a destra sul pad 1, e si campiona lo stato del gioco
  await btn(page, 0, 'A', true);
  await stick(page, 1, 1, 0);
  await sleep(600);
  const s1 = await arenaState(page, pids[0]);
  const ax1 = await axisOf(page, pids[1]);
  const ctxNow = await page.evaluate(() => window.__pads.contextNow());
  await sleep(1300);
  const s2 = await arenaState(page, pids[0]);
  check(ctxNow === 'CONTROLS', `contesto durante la schermata: ${ctxNow}`);
  check(s1 && s2 && s1.countdown === s2.countdown && s2.gameTime === 0, `timer e countdown FERMI durante la schermata (countdown ${s1?.countdown?.toFixed(2)} → ${s2?.countdown?.toFixed(2)}, gameTime ${s2?.gameTime})`);
  check(ax1.x === 0 && ax1.y === 0, `input di gameplay ignorato durante la schermata (stick a fondo → move ${ax1.x},${ax1.y})`);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine schermata CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 2500 && dur <= 3100, `durata della schermata: ${Math.round(dur)} ms (default 2700)`);
  check(/CONTROLLI/.test(cc.text) && /LEFT STICK/.test(cc.text) && /MUOVITI/.test(cc.text), `mostra i CONTROLLI reali: "${cc.text.slice(0, 120)}"`);
  check(/A \/ ✕/.test(cc.text) && /DASH \/ SPINTA/.test(cc.text) && /B \/ ◯/.test(cc.text) && /ABILITÀ/.test(cc.text), 'famiglie MISTE: A / ✕ per il dash, B / ◯ per l\'abilità (Xbox + PlayStation)');
  // dopo la schermata parte il countdown 3-2-1-VIA e A TENUTO non fa dash
  const cd = await arenaState(page, pids[0]);
  check(cd && (cd.phase === 'countdown' || cd.phase === 'playing'), `dopo la schermata parte il countdown (${cd?.phase})`);
  await until(async () => (await arenaState(page, pids[0]))?.phase === 'playing', 30000, 'via');
  await sleep(900);
  const st = await arenaState(page, pids[0]);
  check(st.dashCooldown === 0 && !st.dashing, 'A tenuto durante la schermata: NESSUN dash quando compare VIA');
  await btn(page, 0, 'A', false);
  // lo stick della schermata (ancora tenuto) ora muove il giocatore giusto
  await sleep(700);
  const st2 = await arenaState(page, pids[1]);
  const ax2 = await axisOf(page, pids[1]);
  check(ax2.x > 0.9, `a gioco iniziato lo stick tenuto funziona (move ${ax2.x.toFixed(2)},${ax2.y.toFixed(2)})`);
  await stick(page, 1, 0, 0);

  // ---------------------------------------------------------------- F3: GAMEPAD end-to-end
  await stick(page, 0, 0, -0.9); // su
  await page.keyboard.press('F3');
  await sleep(900);
  const f3 = await page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483000' && d.style.display !== 'none')?.textContent ?? '');
  check(/GAMEPAD · contesto MINIGAME · gioco arena · profilo arena/.test(f3), 'F3: contesto MINIGAME, gioco e profilo');
  check(/focus SI/.test(f3) || /focus NO/.test(f3), `F3: focus/visibilita' della pagina (${(f3.match(/focus \w+ · \w+/) ?? [''])[0]})`);
  check(/loop \d+\/s/.test(f3), `F3: il ciclo di polling e' vivo (${(f3.match(/loop \d+\/s/) ?? [''])[0]})`);
  check(/RAW\s+LX \+0\.00 LY -0\.90/.test(f3), 'F3 RAW: valori grezzi dello stick (LY -0.90)');
  check(/PROFILO\s+moveX \+0\.00 moveY -0\.8\d/.test(f3), 'F3 PROFILO: valore dopo la deadzone (moveY -0.8x)');
  check(/PLAYER\s+\w+… move \+0\.00,-0\.8\d/.test(f3), 'F3 PLAYER: cio\' che sta nel PlayerInput');
  check(/GIOCO\s+legge move \+0\.00,-0\.8\d \(\d+ letture/.test(f3), 'F3 GIOCO: cio\' che Arena legge davvero (letture > 0)');
  await tap(page, 0, 'A', 450);
  await sleep(500);
  const f3b = await page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483000' && d.style.display !== 'none')?.textContent ?? '');
  check(/dash consumato [1-9]\d*x/.test(f3b), 'F3 GIOCO: il dash e\' stato consumato da Arena');
  await page.keyboard.press('F3');
  await stick(page, 0, 0, 0);

  // ---------------------------------------------------------------- precedenza: il telefono NON sovrascrive il controller
  await stick(page, 1, 1, 0);
  await sleep(500);
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 0, y: 0 } }), pids[1]);
  await sleep(300);
  const ax3 = await axisOf(page, pids[1]);
  check(ax3.x > 0.9, `un evento del telefono (move 0,0) NON sovrascrive lo stick del controller (${ax3.x.toFixed(2)})`);
  await stick(page, 1, 0, 0);

  // ---------------------------------------------------------------- il ciclo di polling sopravvive a un'eccezione
  const errBefore = await page.evaluate(() => window.__pads.loop.errors);
  await page.evaluate(() => (window.__mp.throwOnce = true));
  await sleep(500);
  const pollsA = await page.evaluate(() => window.__pads.loop.polls);
  await sleep(600);
  const pollsB = await page.evaluate(() => window.__pads.loop.polls);
  const errAfter = await page.evaluate(() => window.__pads.loop.errors);
  check(errAfter === errBefore + 1 && pollsB > pollsA, `un gamepad malformato che fa lanciare poll() UNA volta non ferma il ciclo (errori ${errBefore}→${errAfter}, poll ${pollsA}→${pollsB})`);
  await stick(page, 1, 1, 0);
  await sleep(500);
  check((await axisOf(page, pids[1])).x > 0.9, 'dopo l\'eccezione i controller rispondono ancora');
  await stick(page, 1, 0, 0);

  // ---------------------------------------------------------------- giochi NON migrati: telefono, nessuna schermata CONTROLLI
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 5 - i })) });
  });
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 60000, 'rullo');
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'quiz');
  await page.evaluate(() => (window.__cc = { shownAt: null, hiddenAt: null, text: '' }));
  let sawUsaTelefono = false;
  let quizPlaying = false;
  await until(async () => {
    const ph = (await hostSnapshot(page)).phase;
    if (ph === 'MINIGAME_INTRO') sawUsaTelefono ||= /USA IL TELEFONO/.test(await phoneText(phones[0]));
    if (ph === 'MINIGAME_PLAYING') quizPlaying = true;
    return quizPlaying;
  }, 90000, 'quiz PLAYING');
  await sleep(3200);
  check(sawUsaTelefono, 'Quiz (non migrato): il telefono all\'intro dice "📱 USA IL TELEFONO", non "USA IL CONTROLLER"');
  check(!(await page.evaluate(() => !!document.getElementById('pad-controls') || window.__cc.shownAt !== null)), 'Quiz: nessuna schermata CONTROLLI (il gioco non usa il gamepad)');
  check(!/USA IL CONTROLLER/.test(await phoneText(phones[0])), 'Quiz: il telefono mostra il suo controller');
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((pl, i) => ({ playerId: pl.id, placement: i + 1, score: 5 - i })) });
  });
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 90000, 'rullo dopo quiz');

  // ---------------------------------------------------------------- CULTURA: PRENDETE I TELEFONI
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'cultura');
  await page.evaluate(() => (window.__cc = { shownAt: null, hiddenAt: null, text: '' }));
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 90000, 'cultura PLAYING');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 30000, 'schermata PRENDETE I TELEFONI');
  const t0 = await hostEval(page, (gm) => gm.game.scene.getScene('cultura')?.gameTime);
  await sleep(1200);
  const t1 = await hostEval(page, (gm) => gm.game.scene.getScene('cultura')?.gameTime);
  check(t0 === 0 && t1 === 0, `Cultura: il gioco non parte finche' la schermata e' su (gameTime ${t0} → ${t1})`);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine PRENDETE I TELEFONI');
  const c2 = await page.evaluate(() => window.__cc);
  check(/PRENDETE I TELEFONI/.test(c2.text) && !/CONTROLLI|STICK/.test(c2.text), `Cultura: "${c2.text.slice(0, 80)}" (nessun comando del gamepad)`);
  const d2 = c2.hiddenAt - c2.shownAt;
  check(d2 >= 2500 && d2 <= 3100, `Cultura: durata ${Math.round(d2)} ms`);
  await sleep(1500);
  const t2 = await hostEval(page, (gm) => gm.game.scene.getScene('cultura')?.gameTime);
  check(t2 > 0.5, `Cultura: dopo la schermata il gioco parte (gameTime ${t2?.toFixed(2)})`);

  check(errs.length === 0, `nessun errore di pagina sull'host ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  fails++;
} finally {
  await browser.close();
}
process.exitCode = fails ? 1 : 0;
