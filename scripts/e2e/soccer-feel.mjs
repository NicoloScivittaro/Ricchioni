// CALCIO — game feel con input REALI dei telefoni: ricezione assistita dei passaggi, intercetti veri (niente farming MVP),
// linea di carica del tiro + pulsante che si riempie, tackle in scivolata, palla che resta in rete al gol + festa.
// Con OUT=cartella salva gli screenshot dell'host (carica del tiro, gol).   OUT=cartella node scripts/e2e/soccer-feel.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const OUT = process.env.OUT ?? '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 2 }); // 4 giocatori: 2 contro 2, nessun handicap
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 4; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'soccer');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  const probe = (fn, arg) => hostEval(page, fn, arg);
  for (let i = 0; i < 400; i++) {
    if ((await probe((gm) => gm.game.scene.getScene('soccer')?.game3d?.phase)) === 'playing') break;
    await sleep(150);
  }
  const roster = await probe((gm) => gm.game.scene.getScene('soccer').game3d.players.map((p, i) => ({ i, team: p.team })));
  const reds = roster.filter((r) => r.team === 'red').map((r) => r.i);
  const blues = roster.filter((r) => r.team === 'blue').map((r) => r.i);
  check(reds.length === 2 && blues.length === 2, `squadre 2 contro 2 (rossi ${reds}, blu ${blues})`);
  const [R1, R2] = reds;
  const [B1, B2] = blues;

  // Scena base: R1 e R2 compagni sulla stessa linea, i blu lontani in un angolo. Ogni chiamata azzera palla e statistiche.
  const setup = (ballState) =>
    probe(
      (gm, st) => {
        const g = gm.game.scene.getScene('soccer').game3d;
        const P = g.players;
        for (const p of P) {
          p.vx = p.vz = 0; p.stunTime = 0; p.dodgeTime = 0; p.dodgeCooldown = 0; p.hasBall = false; p.charging = false; p.lunge = false;
          p.goals = 0; p.assists = 0; p.tackles = 0; p.interceptions = 0; p.ownGoals = 0;
        }
        P[st.R1].x = -8; P[st.R1].z = 0; P[st.R1].facing = Math.PI / 2;
        P[st.R2].x = 0; P[st.R2].z = 0; P[st.R2].facing = -Math.PI / 2;
        P[st.B1].x = 12; P[st.B1].z = 8; P[st.B2].x = 12; P[st.B2].z = -8;
        const b = g.ball;
        Object.assign(b, { ownerId: null, vx: 0, vz: 0, curve: 0, freeGrace: 0, prevKickerId: null, lastKickerId: null }, st.ball);
        if (st.ball.lastKick !== undefined) b.lastKickerId = st.ball.lastKick === null ? null : P[st.ball.lastKick].id;
      },
      { R1, R2, B1, B2, ball: ballState }
    );
  const clock = () => probe((gm) => gm.game.scene.getScene('soccer').game3d.matchTime);
  const waitGame = async (sec) => {
    const t0 = await clock();
    for (let i = 0; i < 300; i++) {
      await sleep(100);
      if (t0 - (await clock()) >= sec) return;
    }
  };
  const stateOf = (i) => probe((gm, k) => { const g = gm.game.scene.getScene('soccer').game3d; const p = g.players[k]; return { has: p.hasBall, int: p.interceptions, tk: p.tackles }; }, i);

  // ---- 1. RICEZIONE ASSISTITA: passaggio compagno a 13 u/s (sopra 8: prima veniva respinto) ----
  await setup({ x: -3.5, z: 0, vx: 16, vz: 0, lastKick: R1 });
  await waitGame(0.6);
  let s2 = await stateOf(R2);
  check(s2.has, 'passaggio del compagno (16 u/s: sopra la presa normale): R2 lo controlla al volo (ricezione assistita)');
  check(s2.int === 0, `...e non conta come intercetto (${s2.int})`);

  // ---- 2. i tiri forti restano tiri: a 22 u/s il compagno lo respinge ----
  await setup({ x: -3.5, z: 0, vx: 22, vz: 0, lastKick: R1 });
  await waitGame(0.6);
  s2 = await stateOf(R2);
  check(!s2.has, 'tiro fortissimo (22 u/s): NON viene incollato al compagno (resta un tiro)');

  // ---- 3. la palla di un AVVERSARIO non si "riceve" al volo: si respinge ----
  await setup({ x: -3.5, z: 0, vx: 16, vz: 0, lastKick: B1 });
  await waitGame(0.6);
  s2 = await stateOf(R2);
  check(!s2.has, 'palla calciata da un avversario a 16 u/s: nessuna ricezione gratuita (si respinge)');

  // ---- 4. INTERCETTI: riprendere la propria palla NON e' un contrasto; prendere quella di un avversario si' ----
  await setup({ x: -6.4, z: 0, lastKick: R1 }); // ferma ai piedi di R1, calciata da lui stesso
  await waitGame(0.5);
  let s1 = await stateOf(R1);
  check(s1.has && s1.int === 0, `R1 riprende la propria palla: presa (${s1.has}) ma 0 intercetti (${s1.int}) — niente farming MVP`);
  await setup({ x: -0.6, z: 0, lastKick: B1 }); // ferma ai piedi di R2, era di un blu
  await waitGame(0.5);
  s2 = await stateOf(R2);
  check(s2.has && s2.int === 1, `R2 prende una palla avversaria: intercetto contato (${s2.int})`);

  // ---- 5. CARICA DEL TIRO sul telefono reale: linea di mira sulla TV + pulsante che si riempie ----
  await setup({ x: -6.4, z: 0, lastKick: R1 });
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    if ((await stateOf(R1)).has) break;
  }
  await sleep(300); // il telefono riceve 'gotBall'
  const ph = phones[R1].page;
  await ph.evaluate(() => document.querySelector('#soccer-shoot').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11 })));
  await sleep(250);
  const cls1 = await ph.evaluate(() => document.querySelector('#soccer-shoot').className);
  check(/soccer-charging/.test(cls1), `il pulsante si sta riempiendo mentre tieni premuto (${cls1})`);
  let chargeShot = false;
  let dotsMid = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(120);
    const st = await probe((gm, k) => {
      const g = gm.game.scene.getScene('soccer').game3d;
      return { ct: g.players[k].chargeTime, dots: g.aimDots.filter((d) => d.isVisible).length, mat: g.aimDots.find((d) => d.isVisible)?.material?.name };
    }, R1);
    if (st.ct > 0.3 && !dotsMid) dotsMid = st.dots;
    if (OUT && !chargeShot && st.ct > 0.55) {
      await page.screenshot({ path: path.join(OUT, 'calcio-carica.png') });
      chargeShot = true;
    }
    if (st.ct >= 0.79) break;
  }
  check(dotsMid > 3, `la TV mostra la linea di carica lunga quanto il tiro (${dotsMid} pallini a carica media)`);
  await sleep(300);
  const cls2 = await ph.evaluate(() => document.querySelector('#soccer-shoot').className);
  check(/soccer-full/.test(cls2), `a carica massima il pulsante pulsa (${cls2})`);
  const dotsFull = await probe((gm) => {
    const g = gm.game.scene.getScene('soccer').game3d;
    return { n: g.aimDots.filter((d) => d.isVisible).length, mat: g.aimDots.find((d) => d.isVisible)?.material?.name };
  });
  check(dotsFull.n >= dotsMid && dotsFull.mat === 'chargeFull', `a carica massima la linea diventa arancione (${JSON.stringify(dotsFull)})`);
  await ph.evaluate(() => document.querySelector('#soccer-shoot').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11 })));
  await sleep(500);
  const cls3 = await ph.evaluate(() => document.querySelector('#soccer-shoot').className);
  check(!/soccer-charging|soccer-full/.test(cls3), 'dopo il tiro il pulsante torna normale');
  const ballAfter = await probe((gm) => { const b = gm.game.scene.getScene('soccer').game3d.ball; return { own: b.ownerId, sp: Math.hypot(b.vx, b.vz), x: b.x }; });
  check(ballAfter.own === null && ballAfter.x > -6, `il tiro e' partito verso l'attacco (x=${ballAfter.x.toFixed(1)})`);

  // ---- 6. TACKLE IN SCIVOLATA: B1 a 4.5 dal portatore preme TACKLE, scivola e ruba al contatto ----
  await setup({ x: 0, z: 0 });
  await probe((gm, st) => {
    const g = gm.game.scene.getScene('soccer').game3d;
    const P = g.players;
    P[st.R2].hasBall = true; g.ball.ownerId = P[st.R2].id; g.ball.lastKickerId = P[st.R2].id;
    P[st.R2].x = 0; P[st.R2].z = 0; P[st.R2].facing = -Math.PI / 2;
    P[st.B1].x = -4.5; P[st.B1].z = 0; P[st.B1].facing = Math.PI / 2; // guarda il portatore (+x)
  }, { R2, B1 });
  await phones[B1].page.evaluate(() => document.querySelector('#soccer-tackle').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 12 })));
  let cd = { dis: false, cls: '' };
  for (let i = 0; i < 40 && !cd.dis; i++) {
    await sleep(100);
    cd = await phones[B1].page.evaluate(() => ({ dis: document.querySelector('#soccer-tackle').disabled, cls: document.querySelector('#soccer-tackle').className }));
  }
  check(cd.dis && /arena-dash-cooldown/.test(cd.cls), `il pulsante TACKLE mostra il cooldown reale (${cd.cls})`);
  await waitGame(0.6);
  const sb = await stateOf(B1);
  const sr = await stateOf(R2);
  check(sb.has && sb.tk === 1 && !sr.has, `B1 ruba la palla scivolando da 4.5 unita' (ha palla ${sb.has}, contrasti ${sb.tk}, R2 ha ancora palla ${sr.has})`);

  // ---- 7. GOL: la palla resta in rete (non si teletrasporta al centro), GOOOL + coriandoli ----
  await setup({ x: 15.2, z: 0.8, vx: 20, vz: 0, lastKick: R1 });
  let phase = '';
  for (let i = 0; i < 30; i++) {
    await sleep(80);
    phase = await probe((gm) => gm.game.scene.getScene('soccer').game3d.phase);
    if (phase === 'goalPause') break;
  }
  await sleep(200);
  if (OUT) await page.screenshot({ path: path.join(OUT, 'calcio-gol.png') });
  const goal = await probe((gm) => {
    const g = gm.game.scene.getScene('soccer').game3d;
    return { phase: g.phase, bx: g.ball.x, bz: g.ball.z, red: g.redScore, txt: g.hud.countdownText.text, confetti: g.confetti.getActiveCount() };
  });
  check(goal.phase === 'goalPause' && goal.red === 1, `gol: fase goalPause, punteggio rossi ${goal.red}`);
  check(Math.abs(goal.bx) > 16, `la palla resta nella rete (x=${goal.bx.toFixed(1)}), non si teletrasporta al centro`);
  check(goal.txt === 'GOOOL!', `scritta a tutto schermo "${goal.txt}"`);
  check(goal.confetti > 10, `coriandoli in volo (${goal.confetti} particelle)`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  if (OUT) console.log('   screenshot in', OUT);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
