// CASA CARBO — LE 5 ABILITA' nel gioco vero (5 controller simulati = 5 personaggi, i telefoni mostrano la Companion Card):
//   Goblin N'CULO, MO ASCIUGO IO! · Boschi TU QUA NON ENTRI! · Victor M'HO SVEJATO · Carbo NO, ASPETTA! · Ciro PAGO DOMANI
//   per ognuna: attivazione valida, non valida (avviso PRIVATO solo sul proprio telefono), effetto nella simulazione, cariche,
//   stato live sulla Companion Card; l'avviso di Victor (porta e secondi) compare SOLO sulla sua card; pulizia a fine round.
//   node scripts/e2e/casacarbo-abilities.mjs
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { XBOX, makeCheck, installMock, add, tap, until, startGame, finishNow, phoneText } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 }); // 5 giocatori
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // personaggi per indice: 0 goblin, 1 buttafuori (Boschi), 2 dottore (Victor), 3 judoka (Carbo), 4 ciro
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [GOB, BOS, VIC, CAR, CIR] = pids;
  await installMock(page, 5);
  for (let k = 0; k < 5; k++) await add(page, k, XBOX);
  await sleep(500);
  for (let k = 0; k < 5; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    for (let t = 0; t < 6 && (await page.evaluate(() => window.__pads.pairedCount())) < k + 1; t++) {
      await tap(page, k, 'A');
      await sleep(500);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 5, '5 controller abbinati ai 5 personaggi');
  await startGame(page, 'casacarbo');
  await until(async () => (await page.evaluate(() => window.__casacarbo?.phase)) === 'playing', 90000, 'via');
  await sleep(300);
  const chars = await page.evaluate(() => window.__casacarbo.sim.players.map((p) => p.characterId).join(','));
  check(chars === 'goblin,buttafuori,dottore,judoka,ciro', `personaggi: ${chars}`);

  const press = (pid) => hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'action', controlId: 'ability' }), pid);
  /** Premi l'abilita' e leggi lo stato dopo `ms` nella stessa chiamata (l'host headless e' lento: i tempi del gioco sono reali). */
  const pressRead = (pid, i, ms = 200) =>
    hostEval(page, async (gm, a) => {
      gm.input.handle(a.pid, { kind: 'action', controlId: 'ability' });
      await new Promise((r) => setTimeout(r, a.ms));
      const p = window.__casacarbo.sim.players[a.i];
      return { ab: { ...p.ab, damCells: p.ab.damCells.length }, stats: { ...p.stats }, bucket: p.bucket, x: p.x, y: p.y };
    }, { pid, i, ms });
  const S = (i) => page.evaluate((k) => { const p = window.__casacarbo.sim.players[k]; return { ab: { ...p.ab, damCells: p.ab.damCells.length }, stats: { ...p.stats }, bucket: p.bucket, x: p.x, y: p.y }; }, i);
  const place = (specs) =>
    page.evaluate((specs) => {
      const w = window.__casacarbo.sim;
      for (const [i, x, y, fx, fy] of specs) Object.assign(w.players[i], { x, y, vx: 0, vy: 0, fx, fy, slipT: 0, dashT: 0, bucket: 0 });
    }, specs);
  const toast = (i) => phones[i].page.evaluate(() => document.getElementById('ab-fail-toast')?.textContent ?? '');
  const clearToasts = () => Promise.all(phones.map((ph) => ph.page.evaluate(() => document.getElementById('ab-fail-toast')?.remove())));
  const away = [[0, 600, 640, 1, 0], [1, 1150, 600, 1, 0], [2, 1180, 345, 1, 0], [3, 420, 250, 1, 0], [4, 865, 300, 0, 1]];
  await place(away);
  await sleep(300);

  // ============================================================ GOBLIN: spazzata col tiracqua
  await page.evaluate(() => {
    const w = window.__casacarbo.sim;
    for (let k = 0; k < w.h.length; k++) {
      const x = (k % 68) * 20 + 70, y = Math.floor(k / 68) * 20 + 50;
      if (w.grid.floor[k] && x > 620 && x < 760 && y > 610 && y < 680) w.h[k] += 0.9;
    }
  });
  const moved = (x) => x.stats.impact["acqua spostata con l'onda"] ?? 0;
  let g = await pressRead(GOB, 0, 150);
  check(g.ab.charges === 1 && g.ab.windupT > 0, `GOBLIN: RB -> carica (${g.ab.windupT.toFixed(2)} s), cariche 2 -> 1`);
  await sleep(1400);
  g = await S(0);
  check(g.ab.windupT === 0 && g.stats.abilitySuccess + g.stats.abilityFail === 1, `GOBLIN: l'onda parte (esito ${g.stats.abilitySuccess ? 'ONDA' : 'A VUOTO'}, spostata ${moved(g)})`);
  check(moved(g) >= 3 && g.stats.abilitySuccess === 1, `GOBLIN: l'onda sposta l'acqua davanti (${moved(g)} unita')`);
  await clearToasts();
  await press(GOB);
  await sleep(600);
  check(/RICARICA/.test(await toast(0)), `GOBLIN: subito dopo -> avviso privato "${await toast(0)}"`);
  check((await toast(1)) === '' && (await toast(2)) === '', 'PRIVACY: l\'avviso del Goblin non compare sugli altri telefoni');
  const gc = await phoneText(phones[0]);
  check(/N'CULO, MO ASCIUGO IO!/.test(gc) && /RICARICA|PRONTA|⌛|s\b/.test(gc), `GOBLIN: Companion Card con lo stato ("${gc.slice(0, 140)}")`);
  await page.evaluate(() => { const a = window.__casacarbo.sim.players[0].ab; a.cooldown = 0; a.charges = 0; });
  await clearToasts();
  await press(GOB);
  await sleep(600);
  check(/ESAURITA/.test(await toast(0)), 'GOBLIN: cariche finite -> ESAURITA');

  // ============================================================ BOSCHI: porta bloccata
  await place(away);
  await clearToasts();
  await press(BOS);
  await sleep(600);
  check(/PORTA/.test(await toast(1)) && (await S(1)).ab.charges === 1, `BOSCHI: lontano dalle porte non parte ("${await toast(1)}") e non consuma`);
  await place([[1, 847, 205, 0, -1]]);
  let b = await pressRead(BOS, 1, 200);
  check(b.ab.blockT > 0 && b.ab.blockDoor === 'front' && b.ab.charges === 0, `BOSCHI: blocca la PORTA ANTERIORE (${b.ab.blockT.toFixed(1)} s)`);
  await sleep(1800);
  b = await S(1);
  check(b.ab.blocked > 0, `BOSCHI: l'acqua di quella porta resta fuori (${b.ab.blocked.toFixed(2)} unita' trattenute)`);
  const bx = (await S(1)).x;
  await hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'axis', controlId: 'move', x: 1, y: 0 }), BOS);
  await sleep(500);
  await hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'axis', controlId: 'move', x: 0, y: 0 }), BOS);
  check(Math.abs((await S(1)).x - bx) < 2, 'BOSCHI: mentre tiene la porta resta fermo');
  const bc = await phoneText(phones[1]);
  check(/PORTA CHIUSA|ATTIVA/.test(bc), `BOSCHI: la sua card mostra lo stato ("${bc.slice(0, 120)}")`);
  await page.evaluate(() => { window.__casacarbo.sim.players[1].ab.blockT = 0.1; });
  await sleep(700);
  b = await S(1);
  check(b.ab.blockT === 0 && b.ab.blockDoor === null, 'BOSCHI: molla la porta, l\'effetto finisce');

  // ============================================================ VICTOR: soffiata privata
  await place(away);
  const target = await page.evaluate(() => {
    const w = window.__casacarbo.sim;
    const ev = w.schedule.find((e) => e.kind === 'raffica' && !e.started && !e.announced);
    ev.at = w.time + 9;
    ev.door = 'back';
    return ev.at;
  });
  let v = await pressRead(VIC, 2, 400);
  check(v.ab.intelT > 0 && v.ab.intelDoor === 'back' && Math.abs(v.ab.intelAt - target) < 0.01, `VICTOR: sa che la prossima raffica arriva alla PORTA DIETRO (fra ${(target - (await page.evaluate(() => window.__casacarbo.sim.time))).toFixed(1)} s)`);
  await sleep(600);
  const vc = await phoneText(phones[2]);
  check(/RAFFICA: PORTA DIETRO TRA \d+ s/.test(vc), `VICTOR: la SUA card dice porta e secondi ("${(vc.match(/RAFFICA[^·]*/) ?? [''])[0]}")`);
  let leak = '';
  for (const k of [0, 1, 3, 4]) if (/RAFFICA: PORTA|PORTA DIETRO TRA/.test(await phoneText(phones[k]))) leak += `P${k + 1} `;
  check(leak === '', `PRIVACY: nessun altro telefono vede la soffiata ${leak}`);
  const pub = await page.evaluate(() => { const w = window.__casacarbo.sim; return w.abil.status(w.players[2], false).note ?? ''; });
  check(/SOFFIATA/.test(pub) && !/PORTA/.test(pub), `VICTOR: in TV solo "${pub}" (niente porta)`);
  // seconda carica senza raffiche in arrivo: sprecata
  await page.evaluate(() => {
    const w = window.__casacarbo.sim;
    w.players[2].ab.intelT = 0;
    for (const e of w.schedule) if ((e.kind === 'raffica' || e.kind === 'pioggia') && !e.started) e.at = w.time + 200;
  });
  v = await pressRead(VIC, 2, 300);
  check(v.ab.charges === 0 && v.stats.abilityFail >= 1, 'VICTOR: senza raffiche in arrivo la soffiata va sprecata (conta come fallita)');

  // ============================================================ CARBO: diga
  await place(away);
  await place([[3, 600, 686, 0, 1]]); // guarda il muro di fondo: niente pavimento davanti
  await clearToasts();
  await press(CAR);
  await sleep(600);
  check(/NON ORA/.test(await toast(3)) && (await S(3)).ab.charges === 2, `CARBO: contro il muro la diga non si fa ("${await toast(3)}"), carica non consumata`);
  await place([[3, 420, 250, 1, 0]]);
  let c = await pressRead(CAR, 3, 200);
  const blockedN = await page.evaluate(() => window.__casacarbo.sim.blocked.reduce((a, b) => a + b, 0));
  check(c.ab.damT > 0 && c.ab.damCells >= 2 && blockedN >= c.ab.damCells, `CARBO: diga di ${c.ab.damCells} celle davanti a lui (${c.ab.damT.toFixed(1)} s)`);
  const cc = await phoneText(phones[3]);
  check(/DIGA|ATTIVA/.test(cc), `CARBO: la sua card mostra la diga ("${cc.slice(0, 110)}")`);
  await page.evaluate(() => { window.__casacarbo.sim.players[3].ab.damT = 0.1; });
  await sleep(700);
  c = await S(3);
  const blockedAfter = await page.evaluate(() => window.__casacarbo.sim.blocked.reduce((a, b) => a + b, 0));
  check(c.ab.damT === 0 && c.ab.damCells === 0 && blockedAfter < blockedN, 'CARBO: a tempo scaduto la diga sparisce');

  // ============================================================ CIRO: secchio doppio
  await place(away);
  let r = await pressRead(CIR, 4, 200);
  check(r.ab.bigBucket && r.ab.charges === 1, 'CIRO: RB -> secchio doppio');
  const rc = await phoneText(phones[4]);
  check(/SECCHIO DOPPIO|ATTIVA/.test(rc), `CIRO: la sua card lo dice ("${rc.slice(0, 110)}")`);
  // pieno oltre la capienza normale, svuotato in tempo allo scarico del bagno: pagato
  await page.evaluate(() => { const p = window.__casacarbo.sim.players[4]; Object.assign(p, { x: 600, y: 488, vx: 0, vy: 0, bucket: 10 }); });
  await sleep(400);
  const dl = (await S(4)).ab.deadlineT;
  const paid = await hostEval(page, async (gm, id) => {
    gm.input.handle(id, { kind: 'down', controlId: 'bucket' });
    await new Promise((res) => setTimeout(res, 700));
    gm.input.handle(id, { kind: 'up', controlId: 'bucket' });
    const p = window.__casacarbo.sim.players[4];
    return { bucket: p.bucket, big: p.ab.bigBucket, ok: p.stats.abilitySuccess, drained: p.stats.drainedBucket };
  }, CIR);
  check(dl > 0, `CIRO: oltre la capienza normale parte il conto alla rovescia (${dl.toFixed(1)} s)`);
  check(paid.bucket < 0.3 && !paid.big && paid.ok === 1 && paid.drained >= 9.9, `CIRO: svuotato in tempo -> pagato (+${paid.drained.toFixed(1)} unita')`);
  // seconda carica: non svuota in tempo -> perde meta' secchio
  await place([[4, 865, 300, 0, 1]]);
  await press(CIR);
  await sleep(400);
  await page.evaluate(() => { const p = window.__casacarbo.sim.players[4]; p.bucket = 10; });
  await sleep(500);
  await page.evaluate(() => { const p = window.__casacarbo.sim.players[4]; if (p.ab.deadlineT > 0) p.ab.deadlineT = 0.1; });
  await sleep(800);
  r = await S(4);
  check(!r.ab.bigBucket && r.stats.abilityFail === 1 && r.bucket <= 5.1, `CIRO: scadenza mancata -> perde meta' secchio (resta ${r.bucket.toFixed(1)})`);
  await clearToasts();
  await press(CIR);
  await sleep(600);
  check(/ESAURITA/.test(await toast(4)), 'CIRO: due usi, poi ESAURITA');

  // ============================================================ pulizia
  await finishNow(page);
  await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  await sleep(600);
  const rows = await page.evaluate(() => window.__abilityHub.rows().length);
  check(rows === 0, 'a fine round AbilityHub e\' vuoto');
  check(await page.evaluate(() => !window.__casacarbo), 'a fine round la scena di Casa Carbo e\' smontata');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} controlli falliti` : '✅ tutto ok');
process.exit(st.fails ? 1 : 0);
