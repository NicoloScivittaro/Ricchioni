// CALCIO col controller (M3, gioco 2/3): 1v1 (2 controller) e 2v1 (2 controller + 1 telefono, squadra dispari con handicap).
// Prova: schermata CONTROLLI dopo l'intro e prima del countdown, 8 direzioni, possesso, tiro debole vs caricato (RT), passaggio A/✕ (una
// sola pressione anche se il tasto resta giu'), tackle X/□, abilita' Y/△, goal + reset, rumble, pausa/disconnessione con RT in carica
// (nessun tiro fantasma), transizioni, nessun input incastrato.
//   node scripts/e2e/gamepad-soccer.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, trig, stick, tap, rumbleCount, until, phoneText, slots, axisOf, pressedOf, f3Text, watchControls, resetControlsWatch, startGame, finishNow, gameEval } from './padmock.mjs';

const { st, check } = makeCheck();
const N_LIST = (process.env.N ?? '2,3').split(',').map(Number);
const G = (page, fn, arg) => gameEval(page, 'soccer', fn, arg);

async function run(browser, n) {
  console.log(`\n=== CALCIO ${n === 2 ? '1v1' : '2v1'} (${n} giocatori) ===`);
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: n - 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < n; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [P1, P2] = pids;
  await installMock(page);
  await add(page, 0, XBOX);
  await add(page, 1, DS);
  await sleep(500);
  for (let k = 0; k < 2; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, `P1 (Xbox) e P2 (DualSense) col controller${n === 3 ? ', P3 col telefono' : ''}`);
  const pairing0 = await slots(page);
  await watchControls(page);

  // ------------------------------------------------------------ intro di gioco -> CONTROLLI -> countdown
  await startGame(page, 'soccer');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await trig(page, 0, 'RT', 1);
  await btn(page, 1, 'LEFT', true); // X/□ tenuto
  await stick(page, 0, 1, 0);
  const samples = [];
  let ax1 = null;
  for (let k = 0; k < 14; k++) {
    const q = await G(page, (g) => ({ c: g.countdown, ph: g.phase, mt: g.matchTime, ov: !!document.getElementById('pad-controls') }));
    if (!q.ov) break;
    samples.push(q);
    if (k === 1) ax1 = await axisOf(page, P1);
    await sleep(150);
  }
  check(samples.length >= 3 && samples.every((x) => x.ph === 'intro' && x.mt === samples[0].mt), `gioco FERMO durante i CONTROLLI (${samples.length} campioni: fase ${samples[0]?.ph}, tempo partita ${samples[0]?.mt})`);
  check(ax1 && ax1.x === 0, 'input ignorato durante i CONTROLLI (stick a fondo: move 0)');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 4700 && dur <= 5700, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/CALCIO DEI DISAGIATI/.test(cc.text) && /LEFT STICK MUOVITI/.test(cc.text) && /RT \/ R2 CARICA E TIRA/.test(cc.text) && /A \/ ✕ PASSA/.test(cc.text) && /X \/ □ DASH \/ TACKLE/.test(cc.text) && /Y \/ △ ⚡ ABILITÀ/.test(cc.text), `mostra: "${cc.text.slice(0, 170)}"`);
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'via');
  await G(page, (g) => { g.matchTime = 1e6; }); // il test dura piu' di 60 s di gioco
  await sleep(500);
  const gh = await G(page, (g, id) => g.players.find((p) => p.id === id).dodgeCooldown + g.players.find((p) => p.id === id).chargeTime + (g.players.find((p) => p.id === id).charging ? 1 : 0), P1);
  check(gh === 0 && (await pressedOf(page, P1, 'shoot')) === false, 'RT e X tenuti durante i CONTROLLI: nessuna carica e nessun dash al VIA (bloccati fino al rilascio)');
  await trig(page, 0, 'RT', 0);
  await btn(page, 1, 'LEFT', false);
  await stick(page, 0, 0, 0);
  await sleep(400);
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /CALCIO/.test(t1), `telefono P1: "${t1.slice(0, 55)}"`);
  if (n === 3) check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge') && !!document.querySelector('.arena-joy-base')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK col joystick del telefono');
  if (n === 3) {
    const hcap = await G(page, (g) => g.handicappedTeam);
    check(hcap !== null, `squadra dispari: handicap attivo sulla squadra numerosa (${hcap}) come da bilanciamento esistente`);
  }

  // ------------------------------------------------------------ 8 direzioni
  await G(page, (g) => { g.ball.x = -14; g.ball.z = -8; g.ball.vx = 0; g.ball.vz = 0; g.ball.ownerId = null; });
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  let dirOk = 0;
  const snap = () => G(page, (g, id) => { const p = g.players.find((x) => x.id === id); return { x: p.x, z: p.z }; }, P1);
  for (const [sx, sy] of dirs) {
    await G(page, (g, id) => { const p = g.players.find((x) => x.id === id); p.x = 0; p.z = 0; p.vx = 0; p.vz = 0; }, P1);
    await sleep(150);
    await stick(page, 0, sx, sy);
    let a = { x: 0, z: 0 };
    for (let k = 0; k < 60; k++) {
      await sleep(120);
      a = await snap();
      if (Math.hypot(a.x, a.z) > 0.8) break;
    }
    await stick(page, 0, 0, 0);
    const ex = sx / Math.hypot(sx, sy);
    const ez = -sy / Math.hypot(sx, sy);
    const m = Math.hypot(a.x, a.z);
    const cos = m > 0 ? (a.x * ex + a.z * ez) / m : 0;
    if (cos > 0.9 && m > 0.3) dirOk++;
    else console.log('   [dir KO]', sx, sy, a.x.toFixed(2), a.z.toFixed(2), 'cos', cos.toFixed(2));
    await sleep(250);
  }
  check(dirOk === 8, `8 direzioni: il personaggio va dove punta lo stick (${dirOk}/8)`);

  // ------------------------------------------------------------ possesso + tiro debole / caricato (RT) + passaggio (A)
  const giveBall = (pid, x = 0, z = 0, face = Math.PI / 2) =>
    G(page, (g, a) => {
      for (const p of g.players) { p.hasBall = false; p.charging = false; p.chargeTime = 0; p.vx = 0; p.vz = 0; }
      const p = g.players.find((q) => q.id === a.pid);
      p.x = a.x; p.z = a.z; p.facing = a.face;
      g.ball.x = a.x + 0.6 * Math.sin(a.face); g.ball.z = a.z + 0.6 * Math.cos(a.face); g.ball.vx = 0; g.ball.vz = 0; g.ball.ownerId = null; g.ball.freeGrace = 0;
    }, { pid, x, z, face });
  const ownsBall = () => G(page, (g, id) => g.players.find((p) => p.id === id).hasBall, P1);
  const kicks = () => G(page, (g) => g.teamKicks.red + g.teamKicks.blue);
  const maxBallSpeed = async (ms) => {
    let mx = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const v = await G(page, (g) => Math.hypot(g.ball.vx, g.ball.vz));
      if (v > mx) mx = v;
      await sleep(40);
    }
    return mx;
  };
  await giveBall(P1);
  await until(ownsBall, 8000, 'possesso');
  check(true, 'possesso automatico: avvicinandosi alla palla il giocatore la prende');
  const r0 = await rumbleCount(page, 0);
  const k0 = await kicks();
  await trig(page, 0, 'RT', 1);
  await sleep(120);
  await trig(page, 0, 'RT', 0); // tocco breve
  const weak = await maxBallSpeed(700);
  check((await kicks()) === k0 + 1, 'RT: tocco breve = UN tiro debole (passaggio)');
  await giveBall(P1);
  await until(ownsBall, 8000, 'possesso 2');
  await trig(page, 0, 'RT', 1); // tenuto: la barra di carica del gioco sale
  await until(async () => (await G(page, (g, id) => g.players.find((p) => p.id === id).chargeTime, P1)) >= 0.78, 15000, 'carica piena');
  check(true, 'RT tenuto: la carica del gioco sale fino al massimo');
  await trig(page, 0, 'RT', 0);
  const strong = await maxBallSpeed(700);
  check(weak > 5 && strong > weak * 1.4, `tiro caricato piu' forte del debole (debole ${weak.toFixed(1)} u/s, caricato ${strong.toFixed(1)} u/s; curva di potenza del gioco invariata)`);
  check((await rumbleCount(page, 0)) > r0, 'rumble sul tiro');
  // passaggio A/✕: una sola pressione anche se il tasto resta premuto
  await giveBall(P1);
  await until(ownsBall, 8000, 'possesso 3');
  const k1 = await kicks();
  await btn(page, 0, 'A', true);
  await sleep(1500);
  await btn(page, 0, 'A', false);
  await sleep(600);
  check((await kicks()) === k1 + 1, 'A/✕ tenuto 1.5 s: UN solo passaggio (nessun doppio tiro)');

  // ------------------------------------------------------------ tackle X/□ (P1 contro il portatore P2)
  await G(page, (g, a) => {
    for (const p of g.players) { p.hasBall = false; p.charging = false; p.vx = 0; p.vz = 0; p.dodgeCooldown = 0; p.stunTime = 0; }
    const [a1, b1] = a;
    const p1 = g.players.find((p) => p.id === a1);
    const p2 = g.players.find((p) => p.id === b1);
    p2.x = 0; p2.z = 0; p1.x = -1.7; p1.z = 0; p1.facing = Math.PI / 2;
    g.ball.x = 0.2; g.ball.z = 0; g.ball.vx = 0; g.ball.vz = 0; g.ball.ownerId = null; g.ball.freeGrace = 0;
  }, [P1, P2]);
  await until(async () => (await G(page, (g, id) => g.players.find((p) => p.id === id).hasBall, P2)), 8000, 'P2 col pallone');
  const rA = await rumbleCount(page, 0);
  const rB = await rumbleCount(page, 1);
  await tap(page, 0, 'X', 450);
  await sleep(500);
  const tk = await G(page, (g, a) => ({ p2has: g.players.find((p) => p.id === a[1]).hasBall, cd: g.players.find((p) => p.id === a[0]).dodgeCooldown, x: g.players.find((p) => p.id === a[0]).x }), [P1, P2]);
  check(tk.p2has === false && tk.x > -1.7, `X/□ = DASH/TACKLE: P1 scatta e ruba la palla al portatore (cooldown ${tk.cd.toFixed(2)})`);
  check((await rumbleCount(page, 0)) > rA && (await rumbleCount(page, 1)) > rB, 'rumble: tackle riuscito (chi lo fa) e subito (chi lo subisce)');
  // ability Y/△
  await tap(page, 0, 'Y', 450);
  await sleep(300);
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(600);
  check(/P1[\s\S]*?GIOCO[^\n]*ability [1-9]\d*x/.test(await f3Text(page)), 'Y/△ = ABILITA\': il gioco consuma la pressione');

  // ------------------------------------------------------------ pausa con RT in carica: nessun tiro fantasma
  await giveBall(P1, -4, 0);
  await until(ownsBall, 8000, 'possesso pausa');
  await trig(page, 0, 'RT', 1);
  await sleep(500);
  const kp0 = await kicks();
  await hostEval(page, (gm) => gm.setPaused(true));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  await sleep(600);
  await hostEval(page, (gm) => gm.setPaused(false));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(1000);
  check((await kicks()) === kp0, 'RT tenuto (in carica) durante pausa e ripresa: nessun tiro fantasma');
  await trig(page, 0, 'RT', 0);
  await sleep(800);
  check((await kicks()) === kp0, 'rilasciando RT dopo la ripresa non parte un tiro dalla carica interrotta');

  // ------------------------------------------------------------ disconnessione con RT in carica
  await giveBall(P1, -4, 0);
  await until(ownsBall, 8000, 'possesso disconnessione');
  await trig(page, 0, 'RT', 1);
  await stick(page, 0, 0, 1);
  await sleep(500);
  const kd0 = await kicks();
  await remove(page, 0);
  await sleep(900);
  check((await axisOf(page, P1)).y === 0, 'controller caduto: input a zero');
  check((await kicks()) === kd0, 'controller caduto mentre RT e\' in carica: nessun tiro fantasma');
  await until(async () => await phones[0].page.evaluate(() => /CONTROLLER PERSO/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P1');
  check(/DISCONNESSO|SCOLLEGATO/.test(await page.evaluate(() => document.getElementById('pad-alert')?.innerText ?? '')), 'avviso TV + 📱 MODALITÀ FALLBACK sul telefono di P1');
  await add(page, 0, XBOX);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'il controller torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'telefono torna al controller');

  // ------------------------------------------------------------ goal + reset
  await giveBall(P1, 9, 0);
  await until(ownsBall, 8000, 'possesso goal');
  const sc0 = await G(page, (g) => g.redScore + g.blueScore);
  const rG = await rumbleCount(page, 0);
  await trig(page, 0, 'RT', 1);
  await until(async () => (await G(page, (g, id) => g.players.find((p) => p.id === id).chargeTime, P1)) >= 0.78, 15000, 'carica goal');
  await trig(page, 0, 'RT', 0);
  await until(async () => (await G(page, (g) => g.redScore + g.blueScore)) === sc0 + 1, 15000, 'goal');
  check(true, 'tiro caricato verso la porta: GOAL');
  check((await rumbleCount(page, 0)) > rG, 'rumble sul goal');
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 30000, 'ripartenza');
  const rs = await G(page, (g, id) => ({ bx: g.ball.x, bz: g.ball.z, ch: g.players.find((p) => p.id === id).charging, hb: g.players.find((p) => p.id === id).hasBall }), P1);
  check(Math.abs(rs.bx) < 1.5 && Math.abs(rs.bz) < 1.5 && !rs.ch, `dopo il goal la palla torna al centro e nessun input e' incastrato (palla ${rs.bx.toFixed(1)},${rs.bz.toFixed(1)})`);
  await stick(page, 0, 1, 0);
  await sleep(500);
  check((await axisOf(page, P1)).x > 0.9, 'dopo il reset i controller rispondono ancora');
  await stick(page, 0, 0, 0);

  if (n === 3) {
    await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 1, y: 0 } }), pids[2]);
    await sleep(300);
    check((await axisOf(page, pids[2])).x === 1, 'P3 (telefono): il suo input entra nello stesso InputManager');
    await stick(page, 1, 0, -1);
    await sleep(300);
    await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 0, y: 0 } }), P2);
    await sleep(300);
    check((await axisOf(page, P2)).y === -1, 'P2 (controller): l\'evento del suo telefono (0,0) non sovrascrive lo stick');
    await stick(page, 1, 0, 0);
  }

  // ------------------------------------------------------------ risultati -> rullo -> di nuovo Calcio con RT tenuto
  await trig(page, 1, 'RT', 1);
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 60000, 'risultati');
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 90000, 'rullo');
  await resetControlsWatch(page);
  await startGame(page, 'soccer');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 60000, 'CONTROLLI 2');
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'via 2');
  await G(page, (g) => { g.matchTime = 1e6; });
  await sleep(800);
  const gp = await G(page, (g, id) => ({ ch: g.players.find((p) => p.id === id).charging, k: g.teamKicks.red + g.teamKicks.blue }), P2);
  check(!gp.ch && gp.k === 0 && (await pressedOf(page, P2, 'shoot')) === false, 'RT tenuto da risultati + rullo + CONTROLLI: nessuna carica ne\' tiro fantasma nel round dopo');
  await trig(page, 1, 'RT', 0);
  check((await slots(page)) === pairing0, 'stesse associazioni dopo risultati e rullo (nessuna riassociazione)');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  await page.close();
  for (const p of phones) await p.ctx.close().catch(() => {});
}

let browser = null;
try {
  for (const n of N_LIST) {
    if (browser) await browser.close().catch(() => {});
    browser = await launch();
    await run(browser, n);
  }
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser?.close().catch(() => {});
}
process.exitCode = st.fails ? 1 : 0;
