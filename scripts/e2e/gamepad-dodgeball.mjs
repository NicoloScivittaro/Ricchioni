// DODGEBALL col controller (M3, gioco 1/3). 3 giocatori MISTI: P1 Xbox, P2 DualSense, P3 telefono (fallback).
// Prova: schermata CONTROLLI, 8 direzioni + diagonale normalizzata, raccolta automatica, RT (pressed/tenuto/rilasciato), lancio, spam RT,
// schiva, abilita', colpo/eliminazione con rumble, pausa con RT tenuto, disconnessione/riconnessione, giocatori misti, transizioni.
//   node scripts/e2e/gamepad-dodgeball.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, trig, stick, tap, rumbleCount, until, phoneText, slots, axisOf, pressedOf, f3Text, watchControls, resetControlsWatch, startGame, finishNow, gameEval } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    await p.page.evaluate(() => {
      window.__vib = [];
      Object.defineProperty(navigator, 'vibrate', { value: (ms) => (window.__vib.push(ms), true), configurable: true });
    });
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
    for (let t = 0; t < 6 && (await page.evaluate(() => window.__pads.pairedCount())) < k + 1; t++) {
      await tap(page, k, 'A');
      await sleep(500);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox) e P2 (DualSense) col controller, P3 col telefono');
  const pairing0 = await slots(page);
  await watchControls(page);

  // ------------------------------------------------------------ avvio + schermata CONTROLLI
  await startGame(page, 'dodgeball');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 40000, 'schermata CONTROLLI');
  await trig(page, 0, 'RT', 1); // RT tenuto DURANTE la schermata
  await btn(page, 1, 'A', true); // e A tenuto sull'altro controller
  await stick(page, 0, 1, 0);
  await sleep(300);
  // campioni del countdown: contano solo quelli presi MENTRE la schermata e' ancora su (le letture dal test sono lente in headless)
  const samples = [];
  let ax1 = null;
  let thr1 = null;
  for (let k = 0; k < 14; k++) {
    const smp = await gameEval(page, 'dodgeball', (g) => ({ c: g.countdown, t: g.gameTime, ph: g.phase, ov: !!document.getElementById('pad-controls') }));
    if (!smp.ov) break;
    samples.push(smp);
    if (k === 1) {
      ax1 = await axisOf(page, P1);
      thr1 = await pressedOf(page, P1, 'throw');
    }
    await sleep(150);
  }
  const frozen = samples.length >= 3 && samples.every((x) => x.c === samples[0].c && x.t === 0 && x.ph === 'countdown');
  check(frozen, `timer, fisica e countdown FERMI durante i CONTROLLI (${samples.length} campioni, countdown ${samples[0]?.c.toFixed(2)} → ${samples[samples.length - 1]?.c.toFixed(2)})`);
  check(ax1 && ax1.x === 0 && thr1 === false, 'input ignorato durante i CONTROLLI (stick a fondo e RT premuto: move 0, throw non premuto)');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 4700 && dur <= 5700, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/DODGEBALL DEI COGLIONI/.test(cc.text) && /LEFT STICK MUOVITI/.test(cc.text) && /RT \/ R2 LANCIA/.test(cc.text) && /A \/ ✕ SCHIVA/.test(cc.text) && /◯ ⚡ ABILITÀ/.test(cc.text), `mostra: "${cc.text.slice(0, 150)}"`);
  check(/Chi non ha il controller gioca col telefono/.test(cc.text), 'avviso per chi gioca col telefono (P3)');
  await until(async () => (await gameEval(page, 'dodgeball', (g) => g.phase)) === 'playing', 30000, 'via');
  // il test dura piu' dei 45 s di gioco: si allunga il limite di tempo (solo nel test) per non arrivare ai risultati a meta'
  await gameEval(page, 'dodgeball', (g) => { g.durationSec = 100000; });
  await sleep(600);
  // tasti tenuti durante i CONTROLLI: nessun lancio/schiva fantasma al VIA
  const held = await gameEval(page, 'dodgeball', (g, id) => g.players.find((p) => p.id === id[0]).dodgeCooldown + g.players.find((p) => p.id === id[1]).dodgeCooldown, [P1, P2]);
  check((await pressedOf(page, P1, 'throw')) === false && held === 0, 'RT e A tenuti durante i CONTROLLI: nessun lancio e nessuna schiva al VIA (bloccati fino al rilascio)');
  await trig(page, 0, 'RT', 0);
  await btn(page, 1, 'A', false);
  await stick(page, 0, 0, 0);
  await sleep(500);

  // ------------------------------------------------------------ telefoni
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /DODGEBALL/.test(t1), `telefono P1: "${t1.slice(0, 60)}"`);
  check(await phones[0].page.evaluate(() => !document.querySelector('.arena-joy-base') && !document.getElementById('pad-fallback-badge')), 'P1: nessun joystick touch e nessun badge fallback');
  check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge') && !!document.querySelector('.arena-joy-base')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK con il joystick del telefono');

  // ------------------------------------------------------------ 8 direzioni e diagonale normalizzata
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  const accs = [];
  let dirOk = 0;
  const snap = (id) => gameEval(page, 'dodgeball', (g, i) => { const p = g.players.find((x) => x.id === i); return { x: p.x, z: p.z, v: Math.hypot(p.vx, p.vz), t: g.gameTime }; }, id);
  // il rullo puo' estrarre il modificatore "controlli invertiti" (voluto): in quel caso la direzione attesa e' l'opposta
  const inv = (await gameEval(page, 'dodgeball', (g) => g.invert)) ? -1 : 1;
  if (inv < 0) console.log('   [info] modificatore "controlli invertiti" attivo: direzioni attese invertite');
  for (const [sx, sy] of dirs) {
    await gameEval(page, 'dodgeball', (g, id) => {
      const p = g.players.find((x) => x.id === id);
      p.x = 0; p.z = 0; p.vx = 0; p.vz = 0;
    }, P1);
    await sleep(150);
    const s0 = await snap(P1);
    await stick(page, 0, sx, sy);
    let acc = null;
    let a = s0;
    for (let k = 0; k < 60; k++) {
      await sleep(120);
      a = await snap(P1);
      // accelerazione misurata in TEMPO DI GIOCO (l'orologio headless e' lento): v / dt dopo ~0.15 s di gioco
      if (acc === null && a.t - s0.t >= 0.15) acc = a.v / (a.t - s0.t);
      if (Math.hypot(a.x, a.z) > 0.8 && acc !== null) break;
    }
    await stick(page, 0, 0, 0);
    const ex = (inv * sx) / Math.hypot(sx, sy);
    const ez = (inv * -sy) / Math.hypot(sx, sy); // readMove: z = -y
    const m = Math.hypot(a.x, a.z);
    const cos = m > 0 ? (a.x * ex + a.z * ez) / m : 0;
    accs.push(acc ?? 0);
    if (process.env.TRACE) console.log('   [dir]', sx, sy, 'spostamento', a.x.toFixed(2), a.z.toFixed(2), 'cos', cos.toFixed(2), 'accel', (acc ?? 0).toFixed(1));
    if (cos > 0.9 && m > 0.3) dirOk++;
    else console.log('   [dir KO]', sx, sy, 'spostamento', a.x.toFixed(2), a.z.toFixed(2), 'cos', cos.toFixed(2), 'v', a.v?.toFixed(2), 'gameTime', a.t?.toFixed(2));
    await sleep(300);
  }
  check(dirOk === 8, `8 direzioni: il personaggio va dove punta lo stick (${dirOk}/8)`);
  const straight = (accs[0] + accs[2] + accs[4] + accs[6]) / 4;
  const diag = (accs[1] + accs[3] + accs[5] + accs[7]) / 4;
  check(straight > 0 && diag / straight < 1.25, `diagonale normalizzata: accelerazione diag ${diag.toFixed(1)} / dritta ${straight.toFixed(1)} = ${(diag / straight).toFixed(2)} (non 1.41)`);

  // ------------------------------------------------------------ raccolta AUTOMATICA + RT (pressed / tenuto / rilasciato) + lancio + colpo
  await gameEval(page, 'dodgeball', (g, id) => {
    const [a, b] = id;
    const p1 = g.players.find((x) => x.id === a);
    const p2 = g.players.find((x) => x.id === b);
    const ball = g.balls[0];
    // rimette a posto lo stato: durante le 8 direzioni P1 passa dal centro e raccoglie da solo la palla che vi nasce
    for (const b of g.balls) { b.state = 'free'; b.holderId = null; b.throwerId = null; b.vx = 0; b.vz = 0; }
    p1.hasBall = false; p2.hasBall = false;
    p1.x = ball.x + 0.5; p1.z = ball.z; p1.vx = 0; p1.vz = 0; p1.facing = Math.PI / 2; // guarda verso +x
    p2.x = p1.x + 8; p2.z = p1.z; p2.vx = 0; p2.vz = 0; p2.alive = true;
  }, [P1, P2]);
  await sleep(700);
  const picked = await gameEval(page, 'dodgeball', (g, id) => g.players.find((x) => x.id === id).hasBall, P1);
  check(picked === true, 'raccolta AUTOMATICA: avvicinandosi alla palla il giocatore la prende (nessun tasto)');
  const r1a = await rumbleCount(page, 0);
  const rP2a = await rumbleCount(page, 1);
  // RT analogico a meta' corsa NON basta (soglia), a fondo si'
  await trig(page, 0, 'RT', 0.2);
  await sleep(400);
  check((await gameEval(page, 'dodgeball', (g, id) => g.players.find((x) => x.id === id).hasBall, P1)) === true, 'RT a 0.2 (sotto soglia): nessun lancio');
  const dump = (label) => gameEval(page, 'dodgeball', (g, id) => ({ label: id.l, p1: (({ x, z, hasBall, alive, falling, stunTime, dodgeCooldown, facing }) => ({ x: +x.toFixed(1), z: +z.toFixed(1), hasBall, alive, falling, stunTime, dodgeCooldown, facing }))(g.players.find((q) => q.id === id.a)), p2: (({ x, z, alive, falling }) => ({ x: +x.toFixed(1), z: +z.toFixed(1), alive, falling }))(g.players.find((q) => q.id === id.b)), phase: g.phase, alive: g.players.map((q) => q.alive), balls: g.balls.map((b) => `${b.state}@${b.x.toFixed(1)},${b.z.toFixed(1)} holder=${b.holderId?.slice(0, 4)} thrower=${b.throwerId?.slice(0, 4)}`) }), { l: label, a: P1, b: P2 }).then((d) => process.env.TRACE && console.log('   [dump]', JSON.stringify(d)));
  await dump('prima RT');
  await trig(page, 0, 'RT', 1);
  await sleep(150);
  await dump('+150ms RT');
  await sleep(350);
  await dump('+500ms RT');
  const thrown = await gameEval(page, 'dodgeball', (g, id) => ({ has: g.players.find((x) => x.id === id).hasBall, held: g.balls.some((b) => b.holderId === id) }), P1);
  check(thrown.has === false && !thrown.held, 'RT premuto a fondo = LANCIO (la palla parte e P1 non ce l ha piu)');
  const held1 = await pressedOf(page, P1, 'throw');
  check(held1 === true, 'RT tenuto: throw resta premuto (pressed/tenuto)');
  await trig(page, 0, 'RT', 0);
  await sleep(400);
  check((await pressedOf(page, P1, 'throw')) === false, 'RT rilasciato: throw rilasciato');
  await sleep(700);
  const p2 = await gameEval(page, 'dodgeball', (g, id) => { const p = g.players.find((x) => x.id === id); return { alive: p.alive, falling: p.falling }; }, P2);
  check(p2.alive === false || p2.falling, 'la palla colpisce P2: eliminato (una palla = sei fuori, bilanciamento invariato)');
  console.log('   [rumble] P1', r1a, '->', await rumbleCount(page, 0), ' P2', rP2a, '->', await rumbleCount(page, 1));
  check((await rumbleCount(page, 0)) > r1a && (await rumbleCount(page, 1)) > rP2a, 'rumble: il lanciatore (lancio) e chi e\' colpito (colpo/eliminazione) sentono il controller');
  const vib = await Promise.all(phones.map((ph) => ph.page.evaluate(() => window.__vib.length)));
  if (process.env.TRACE) console.log('   [vib]', JSON.stringify(await Promise.all(phones.map((ph) => ph.page.evaluate(() => window.__vib)))));
  check(vib[0] === 0 && vib[2] > 0, `vibrazioni: il telefono di P1 (controller) ne riceve ${vib[0]}, quello di P3 (fallback) ${vib[2]}: il feedback va al controller`);

  // ------------------------------------------------------------ spam RT + RT tenuto = UNA pressione
  const throwCount = async () => {
    const t = await f3Text(page);
    const m = /P1[\s\S]*?GIOCO[^\n]*throw (\d+)x/.exec(t);
    return m ? Number(m[1]) : 0;
  };
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(700);
  const c0 = await throwCount();
  for (let i = 0; i < 6; i++) {
    await trig(page, 0, 'RT', 1);
    await sleep(300);
    await trig(page, 0, 'RT', 0);
    await sleep(200);
  }
  await sleep(500);
  const c1 = await throwCount();
  check(c1 - c0 >= 4 && c1 - c0 <= 6, `spam RT ×6: il gioco consuma ${c1 - c0} pressioni (una per pressione, nessuna perduta o doppia)`);
  await trig(page, 0, 'RT', 1);
  await sleep(1600); // tenuto a lungo
  await trig(page, 0, 'RT', 0);
  await sleep(500);
  const c2 = await throwCount();
  check(c2 - c1 === 1, `RT tenuto 1.6 s = UNA sola pressione (${c2 - c1})`);

  // ------------------------------------------------------------ schiva (A) e abilita' (B) di P1; P2 e' fuori
  await gameEval(page, 'dodgeball', (g, id) => { const p = g.players.find((x) => x.id === id); p.dodgeCooldown = 0; p.stunTime = 0; p.alive = true; }, P1);
  await dump('prima dodge');
  await tap(page, 0, 'A', 450);
  await sleep(300);
  await dump('dopo dodge');
  const dg = await gameEval(page, 'dodgeball', (g, id) => { const p = g.players.find((x) => x.id === id); return { cd: p.dodgeCooldown, x: p.x }; }, P1);
  check(dg.x - 0.5 > 2, `A/✕ = SCHIVA: scatto in avanti di ${(dg.x - 0.5).toFixed(1)} u (cooldown residuo ${dg.cd.toFixed(2)})`);
  await tap(page, 0, 'B', 450);
  await sleep(300);
  const t3 = await f3Text(page);
  check(/P1[\s\S]*?GIOCO[^\n]*ability [1-9]\d*x/.test(t3), 'B/◯ = ABILITA\': il gioco consuma la pressione');

  // la schiva ha fatto raccogliere a P1 una palla: la si rimette a terra, altrimenti gli RT dei test seguenti la lancerebbero
  // (e potrebbe eliminare P3 chiudendo la partita a meta' test)
  await gameEval(page, 'dodgeball', (g, id) => {
    for (const b of g.balls) if (b.holderId === id) { b.state = 'free'; b.holderId = null; b.throwerId = null; b.x = -6; b.z = 6; b.vx = 0; b.vz = 0; }
    g.players.find((x) => x.id === id).hasBall = false;
    g.players.find((x) => x.id === id).x = 8; g.players.find((x) => x.id === id).z = -6; // lontano da ogni palla
  }, P1);
  await sleep(300);

  // ------------------------------------------------------------ pausa con RT tenuto
  await hostEval(page, (gm) => gm.setPaused(true));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  await trig(page, 0, 'RT', 1);
  await stick(page, 0, 1, 0);
  await sleep(700);
  check((await axisOf(page, P1)).x === 0 && (await pressedOf(page, P1, 'throw')) === false, 'in pausa nessun input di gameplay (stick e RT ignorati)');
  await hostEval(page, (gm) => gm.setPaused(false));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(700);
  check((await pressedOf(page, P1, 'throw')) === false, 'RT tenuto durante la pausa e oltre la ripresa: nessun lancio fantasma (serve rilasciare)');
  await trig(page, 0, 'RT', 0);
  await stick(page, 0, 0, 0);
  await sleep(400);
  await trig(page, 0, 'RT', 1);
  await sleep(500);
  check((await pressedOf(page, P1, 'throw')) === true, 'dopo il rilascio RT torna attivo');
  await trig(page, 0, 'RT', 0);

  // ------------------------------------------------------------ giocatori misti: P3 col telefono, P1 non sovrascritto dal telefono
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 1, y: 0 } }), P3);
  await sleep(300);
  check((await axisOf(page, P3)).x === 1, 'P3 (telefono): il suo input entra nello stesso InputManager');
  await stick(page, 0, 0, -1);
  await sleep(400);
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 0, y: 0 } }), P1);
  await sleep(300);
  check((await axisOf(page, P1)).y === -1, 'P1 (controller): un evento del suo telefono (0,0) NON sovrascrive lo stick');
  await stick(page, 0, 0, 0);

  // ------------------------------------------------------------ disconnessione a meta' partita
  await stick(page, 0, 0, 1);
  await sleep(400);
  await remove(page, 0);
  await sleep(900);
  check((await axisOf(page, P1)).y === 0, 'controller di P1 caduto: input a zero');
  check(/DISCONNESSO|SCOLLEGATO/.test(await page.evaluate(() => document.getElementById('pad-alert')?.innerText ?? '')), 'avviso TV: controller scollegato');
  try {
    await until(async () => await phones[0].page.evaluate(() => /CONTROLLER PERSO/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P1');
  } catch (e) {
    console.log('   [diag] telefono P1:', await phoneText(phones[0]));
    console.log('   [diag] pad per giocatore (stato stanza):', JSON.stringify(await hostEval(page, (gm) => gm.state.players.map((p) => [p.displayName, p.pad ?? null, p.connected]))), 'fase', (await hostSnapshot(page)).phase);
    console.log('   [diag] caselle:', await slots(page), 'contesto', await page.evaluate(() => window.__pads.contextNow()));
    throw e;
  }
  check(true, 'il telefono di P1 passa da solo a 📱 CONTROLLER PERSO — USA TEMPORANEAMENTE IL TELEFONO');
  await add(page, 0, XBOX);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'il controller torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'telefono torna al controller');
  check(true, 'il telefono torna a "USA IL CONTROLLER"');

  // ------------------------------------------------------------ risultati, RT tenuto durante le transizioni, secondo giro
  await trig(page, 1, 'RT', 1);
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 60000, 'risultati');
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 90000, 'rullo');
  await resetControlsWatch(page);
  await startGame(page, 'dodgeball');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 40000, 'CONTROLLI 2');
  await until(async () => (await gameEval(page, 'dodgeball', (g) => g.phase)) === 'playing', 30000, 'via 2');
  await sleep(800);
  check((await pressedOf(page, P2, 'throw')) === false, 'RT tenuto da risultati + rullo + CONTROLLI: nessun lancio fantasma nel round dopo');
  await trig(page, 1, 'RT', 0);
  check((await slots(page)) === pairing0, 'stesse associazioni dopo risultati e rullo (nessuna riassociazione)');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;

