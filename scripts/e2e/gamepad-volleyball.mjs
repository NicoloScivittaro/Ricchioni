// PALLAVOLO col controller (M3, gioco 3/3): 3 giocatori MISTI (P1 Xbox, P2 DualSense, P3 telefono).
// Prova: schermata CONTROLLI dopo l'intro e prima del countdown, 8 direzioni, servizio (A), salto (X), colpo a terra, SALTO+COLPO+DIREZIONE
// insieme (multitasto), smash, abilita' (B), rumble, punto + ripartenza, match point + fine partita, pausa e disconnessione con tasti
// tenuti (nessun salto/colpo/servizio fantasma), giocatori misti, transizioni senza riassociazione.
//   node scripts/e2e/gamepad-volleyball.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, stick, tap, rumbleCount, until, phoneText, slots, axisOf, pressedOf, f3Text, watchControls, resetControlsWatch, startGame, finishNow, gameEval } from './padmock.mjs';

const { st, check } = makeCheck();
const G = (page, fn, arg) => gameEval(page, 'volleyball', fn, arg);
const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
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

  // ------------------------------------------------------------ CONTROLLI dopo l'intro, prima del countdown
  await startGame(page, 'volleyball');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await btn(page, 0, 'A', true); // A e X tenuti DURANTE la schermata
  await btn(page, 1, 'X', true);
  await stick(page, 0, 1, 0);
  const samples = [];
  let ax1 = null;
  for (let k = 0; k < 14; k++) {
    const q = await G(page, (g) => ({ ph: g.phase, c: g.countdown, held: g.ball.state, ov: !!document.getElementById('pad-controls') }));
    if (!q.ov) break;
    samples.push(q);
    if (k === 1) ax1 = await axisOf(page, P1);
    await sleep(150);
  }
  check(samples.length >= 3 && samples.every((x) => x.ph === 'intro' && x.held === 'held'), `gioco FERMO durante i CONTROLLI (${samples.length} campioni: fase ${samples[0]?.ph}, palla ${samples[0]?.held})`);
  check(ax1 && ax1.x === 0, 'input ignorato durante i CONTROLLI (stick a fondo: move 0)');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 2500 && dur <= 3100, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/PALLAVOLO DEI DISAGIATI/.test(cc.text) && /LEFT STICK MUOVITI/.test(cc.text) && /X \/ □ SALTA/.test(cc.text) && /A \/ ✕ COLPISCI \/ SMASH/.test(cc.text) && /B \/ ◯ ABILITÀ/.test(cc.text), `mostra: "${cc.text.slice(0, 170)}"`);
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'via');
  await sleep(700);
  const ghost = await G(page, (g, a) => ({ st: g.ball.state, y1: g.players.find((p) => p.id === a[0]).y, y2: g.players.find((p) => p.id === a[1]).y }), [P1, P2]);
  check(ghost.st === 'held' && ghost.y1 === 0 && ghost.y2 === 0, 'A e X tenuti durante i CONTROLLI: nessun servizio, colpo o salto al VIA (bloccati fino al rilascio)');
  await btn(page, 0, 'A', false);
  await btn(page, 1, 'X', false);
  await stick(page, 0, 0, 0);
  await sleep(400);
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /PALLAVOLO/.test(t1), `telefono P1: "${t1.slice(0, 55)}"`);
  check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge') && !!document.querySelector('.arena-joy-base')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK col joystick del telefono');

  const team1 = await G(page, (g, id) => g.players.find((p) => p.id === id).team, P1);
  const sg = team1 === 'red' ? -1 : 1; // la propria meta' campo: red z<0, blue z>0
  const place = (id, x, z) => G(page, (g, a) => { const p = g.players.find((q) => q.id === a.id); p.x = a.x; p.z = a.z; p.vx = 0; p.vz = 0; p.y = 0; p.vy = 0; p.hitCooldown = 0; }, { id, x, z });

  // ------------------------------------------------------------ 8 direzioni (nella propria meta' campo: la rete blocca oltre)
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  let dirOk = 0;
  const snap = () => G(page, (g, id) => { const p = g.players.find((x) => x.id === id); return { x: p.x, z: p.z }; }, P1);
  for (const [sx, sy] of dirs) {
    await place(P1, 0, sg * 6);
    await sleep(150);
    await stick(page, 0, sx, sy);
    let a = { x: 0, z: sg * 6 };
    for (let k = 0; k < 60; k++) {
      await sleep(120);
      a = await snap();
      if (Math.hypot(a.x, a.z - sg * 6) > 0.8) break;
    }
    await stick(page, 0, 0, 0);
    const dx = a.x;
    const dz = a.z - sg * 6;
    const ex = sx / Math.hypot(sx, sy);
    const ez = -sy / Math.hypot(sx, sy);
    const m = Math.hypot(dx, dz);
    const cos = m > 0 ? (dx * ex + dz * ez) / m : 0;
    if (cos > 0.9 && m > 0.3) dirOk++;
    else console.log('   [dir KO]', sx, sy, dx.toFixed(2), dz.toFixed(2), 'cos', cos.toFixed(2));
    await sleep(250);
  }
  check(dirOk === 8, `8 direzioni: il personaggio va dove punta lo stick (${dirOk}/8)`);

  // ------------------------------------------------------------ servizio (A)
  await place(P1, 0, sg * 6);
  await G(page, (g, id) => { g.ball.state = 'held'; g.ball.holderId = id; g.ball.lastTouchId = null; g.ball.vx = g.ball.vy = g.ball.vz = 0; }, P1);
  await sleep(300);
  const r0 = await rumbleCount(page, 0);
  await tap(page, 0, 'A', 400);
  await sleep(400);
  const sv = await G(page, (g) => ({ st: g.ball.state, holder: g.ball.holderId }));
  check(sv.st === 'flying' && sv.holder === null, 'SERVIZIO: A/✕ con la palla in mano batte il servizio');

  // ------------------------------------------------------------ salto (X)
  await place(P1, 0, sg * 6);
  await G(page, (g) => { g.ball.state = 'flying'; g.ball.x = 12; g.ball.z = 12; g.ball.y = 8; g.ball.vx = g.ball.vy = g.ball.vz = 0; g.ball.frozenTimer = 0; });
  let peak = 0;
  await btn(page, 0, 'X', true);
  await sleep(250);
  await btn(page, 0, 'X', false);
  for (let k = 0; k < 40; k++) {
    const y = await G(page, (g, id) => g.players.find((p) => p.id === id).y, P1);
    if (y > peak) peak = y;
    if (peak > 0.5 && y < 0.05) break;
    await sleep(60);
  }
  check(peak > 0.5, `X/□ = SALTA (quota massima ${peak.toFixed(2)})`);

  // ------------------------------------------------------------ colpo a terra (A) con la palla ferma a portata
  // "hover": una palla sospesa a portata (il timer di gioco la farebbe cadere durante il tocco del test)
  const hover = (id, dy) => page.evaluate(async ({ id, dy }) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
    const { game: gm } = await import(url);
    const g = gm.game.scene.getScene('volleyball').game3d;
    clearInterval(window.__hover);
    window.__hover = setInterval(() => {
      const p = g.players.find((q) => q.id === id);
      if (g.ball.lastTouchId === id) return;
      g.ball.state = 'flying'; g.ball.frozenTimer = 0;
      g.ball.x = p.x; g.ball.z = p.z; g.ball.y = p.y + dy; g.ball.vx = g.ball.vy = g.ball.vz = 0;
    }, 20);
  }, { id, dy });
  const unhover = () => page.evaluate(() => clearInterval(window.__hover));
  await place(P1, 0, sg * 5);
  await G(page, (g, id) => { g.ball.lastTouchId = null; g.players.find((p) => p.id === id).receives = 0; g.players.find((p) => p.id === id).smashes = 0; }, P1);
  await hover(P1, 1.0);
  await sleep(300);
  await tap(page, 0, 'A', 400);
  await unhover();
  const hit1 = await G(page, (g, id) => { const p = g.players.find((q) => q.id === id); return { last: g.ball.lastTouchId, rec: p.receives, sm: p.smashes, vy: g.ball.vy }; }, P1);
  check(hit1.last === P1 && hit1.rec === 1 && hit1.sm === 0, `A/✕ = COLPO a terra: ricezione registrata (vy ${hit1.vy.toFixed(1)})`);
  check((await rumbleCount(page, 0)) > r0, 'rumble su servizio/salto/colpo');

  // ------------------------------------------------------------ MULTITASTO: direzione + salto + colpo insieme -> SMASH
  await place(P1, 0, sg * 2.0);
  await G(page, (g, id) => { g.ball.lastTouchId = null; const p = g.players.find((q) => q.id === id); p.receives = 0; p.smashes = 0; p.hitCooldown = 0; }, P1);
  await stick(page, 0, 1, 0); // direzione TENUTA
  await btn(page, 0, 'X', true); // salto
  let smashDone = false;
  let jumped = false;
  for (let k = 0; k < 50 && !smashDone; k++) {
    await sleep(50);
    const y = await G(page, (g, id) => g.players.find((p) => p.id === id).y, P1);
    if (y > 0.6) {
      jumped = true;
      await hover(P1, 1.8); // palla alta sopra la rete, a portata del salto
      await btn(page, 0, 'A', true); // colpo mentre si e' in aria e la direzione e' ancora tenuta
      await sleep(250);
      await btn(page, 0, 'A', false);
      smashDone = true;
    }
  }
  await btn(page, 0, 'X', false);
  await unhover();
  const mv = await axisOf(page, P1);
  const sm = await G(page, (g, id) => { const p = g.players.find((q) => q.id === id); return { sm: p.smashes, rec: p.receives, vy: g.ball.vy, last: g.ball.lastTouchId }; }, P1);
  check(jumped && sm.last === P1 && sm.sm === 1, `DIREZIONE + SALTO + COLPO insieme: SMASH registrato (smash ${sm.sm}, vy ${sm.vy.toFixed(1)}: la palla va verso il basso)`);
  check(mv.x > 0.9, 'la direzione tenuta non e\' stata cancellata da salto e colpo (move.x ' + mv.x.toFixed(2) + ')');
  await stick(page, 0, 0, 0);

  // ------------------------------------------------------------ abilita' (B)
  await tap(page, 0, 'B', 450);
  await sleep(300);
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(600);
  check(/P1[\s\S]*?GIOCO[^\n]*ability [1-9]\d*x/.test(await f3Text(page)), 'B/◯ = ABILITA\': il gioco consuma la pressione');

  // ------------------------------------------------------------ ricezione (colpo del compagno di squadra / avversario) + P3 telefono
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 1, y: 0 } }), P3);
  await sleep(300);
  check((await axisOf(page, P3)).x === 1, 'P3 (telefono): il suo input entra nello stesso InputManager');
  await stick(page, 1, 0, -1);
  await sleep(300);
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'move', x: 0, y: 0 } }), P2);
  await sleep(300);
  check((await axisOf(page, P2)).y === -1, 'P2 (controller): un evento del suo telefono (0,0) NON sovrascrive lo stick');
  await stick(page, 1, 0, 0);

  // ------------------------------------------------------------ pausa con A e X tenuti: nessun salto/colpo/servizio fantasma
  await place(P1, 0, sg * 5);
  await G(page, (g, id) => { g.ball.state = 'held'; g.ball.holderId = id; g.ball.lastTouchId = null; g.ball.vx = g.ball.vy = g.ball.vz = 0; }, P1);
  await hostEval(page, (gm) => gm.setPaused(true));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  await btn(page, 0, 'A', true);
  await btn(page, 0, 'X', true);
  await sleep(700);
  await hostEval(page, (gm) => gm.setPaused(false));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(1000);
  const pz = await G(page, (g, id) => ({ st: g.ball.state, y: g.players.find((p) => p.id === id).y }), P1);
  check(pz.st === 'held' && pz.y === 0, 'A e X tenuti in pausa e oltre la ripresa: nessun servizio ne\' salto fantasma');
  await btn(page, 0, 'A', false);
  await btn(page, 0, 'X', false);
  await sleep(500);

  // ------------------------------------------------------------ disconnessione con direzione + A tenuti
  await stick(page, 0, 0, 1);
  await btn(page, 0, 'A', true);
  await sleep(400);
  const dsv = await G(page, (g) => g.ball.state);
  await remove(page, 0);
  await sleep(900);
  check((await axisOf(page, P1)).y === 0 && (await G(page, (g) => g.ball.state)) === dsv, 'controller caduto: input a zero e nessun colpo/servizio fantasma');
  await until(async () => await phones[0].page.evaluate(() => /FALLBACK/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P1');
  check(/DISCONNESSO|SCOLLEGATO/.test(await page.evaluate(() => document.getElementById('pad-alert')?.innerText ?? '')), 'avviso TV + 📱 MODALITÀ FALLBACK sul telefono di P1');
  await add(page, 0, XBOX);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'il controller torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'telefono torna al controller');

  // ------------------------------------------------------------ PUNTO + ripartenza, poi MATCH POINT e fine partita
  // i punti veri possono capitare durante i test precedenti (la palla del servizio cade): si forza il punto solo a partita in corso
  const forcePoint = async (team) => {
    await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'partita in corso');
    return forcePoint0(team);
  };
  const forcePoint0 = (team) => G(page, (g, t) => {
    // la palla cade nel campo AVVERSARIO di `t`: red segna se cade a z>0, blue se cade a z<0
    g.ball.state = 'flying'; g.ball.frozenTimer = 0; g.ball.holderId = null;
    g.ball.x = 0; g.ball.z = t === 'red' ? 5 : -5; g.ball.y = 0.4; g.ball.vx = 0; g.ball.vz = 0; g.ball.vy = -8;
    g.ball.lastTouchId = g.players.find((p) => p.team === t)?.id ?? null;
  }, team);
  const dumpB = (l) => G(page, (g) => ({ ph: g.phase, r: g.redScore, b: g.blueScore, st: g.ball.state, h: g.ball.holderId?.slice(0, 4), x: +g.ball.x.toFixed(1), y: +g.ball.y.toFixed(1), z: +g.ball.z.toFixed(1), vy: +g.ball.vy.toFixed(1), pt: +g.phaseTime.toFixed(2) })).then((d) => process.env.TRACE && console.log('   [ball]', l, JSON.stringify(d)));
  await dumpB('prima');
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'partita in corso');
  await G(page, (g) => { g.redScore = 0; g.blueScore = 0; });
  await forcePoint('red');
  await dumpB('subito');
  await sleep(400);
  await dumpB('+400ms');
  try {
    await until(async () => (await G(page, (g) => g.redScore)) === 1, 15000, 'punto');
  } catch (e) {
    console.log('   [diag]', JSON.stringify(await G(page, (g) => ({ ph: g.phase, r: g.redScore, b: g.blueScore, ball: { st: g.ball.state, x: +g.ball.x.toFixed(1), y: +g.ball.y.toFixed(1), z: +g.ball.z.toFixed(1), vy: +g.ball.vy.toFixed(1), fr: g.ball.frozenTimer }, hover: !!window.__hover, pt: g.phaseTime }))));
    throw e;
  }
  const rP = await rumbleCount(page, 0);
  check(true, 'PUNTO assegnato');
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 30000, 'ripartenza');
  const rs = await G(page, (g) => ({ st: g.ball.state, h: g.ball.holderId }));
  check(rs.st === 'held', `dopo il punto si riparte col servizio (palla ${rs.st})`);
  await stick(page, 0, 1, 0);
  await sleep(500);
  check((await axisOf(page, P1)).x > 0.9, 'dopo il reset i controller rispondono ancora');
  await stick(page, 0, 0, 0);
  await G(page, (g) => { g.redScore = 4; g.blueScore = 1; });
  const mp = await G(page, (g) => ({ r: g.redScore, b: g.blueScore }));
  await forcePoint('red');
  await until(async () => ['ended'].includes(await G(page, (g) => g.phase)) || (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 40000, 'fine partita');
  check(true, `MATCH POINT (${mp.r}-${mp.b}) -> punto decisivo: partita finita`);
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 90000, 'risultati');
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'fine partita: il controller resta associato');

  // ------------------------------------------------------------ rullo -> di nuovo Pallavolo con A tenuto
  await btn(page, 1, 'A', true);
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 90000, 'rullo');
  await resetControlsWatch(page);
  await startGame(page, 'volleyball');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 60000, 'CONTROLLI 2');
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'via 2');
  await sleep(800);
  const g2 = await G(page, (g) => g.ball.state);
  check(g2 === 'held' && (await pressedOf(page, P2, 'hit')) === false, 'A tenuto da risultati + rullo + CONTROLLI: nessun servizio fantasma nel round dopo');
  await btn(page, 1, 'A', false);
  check((await slots(page)) === pairing0, 'stesse associazioni dopo risultati e rullo (nessuna riassociazione)');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
