// BOTTE SUL CORNICIONE — LE 5 ABILITA' nel gioco vero (5 telefoni = 5 personaggi, input iniettato come dal controller):
//   Goblin RIMONTA AL 90° · Buttafuori ULTIMO ACCESSO · Judoka ANGORA CHE DICI? · Dottore TAGLIO PESO EXPRESS · Ciro BONIFICO
//   per ognuna: attivazione valida, non valida (avviso PRIVATO sul telefono), effetto nella scena, un uso per vita, stato live sulla
//   Companion Card (e SOLO la propria), pulizia a fine round.     node scripts/e2e/fighter-abilities.mjs
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { XBOX, makeCheck, installMock, add, tap, until, startGame, gameEval, finishNow, phoneText } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
const G = (page, fn, arg) => gameEval(page, 'cornicione', fn, arg);
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 }); // 5 giocatori
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // personaggi per indice: 0 goblin, 1 buttafuori, 2 dottore, 3 judoka, 4 ciro
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [GOB, BUT, DOT, JUD, CIR] = pids;
  // controller veri (finti) per tutti: i telefoni mostrano la Companion Card (solo informativa) invece dei tasti
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
  await startGame(page, 'cornicione');
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 90000, 'via');
  await sleep(300);

  const press = (pid) => hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'action', controlId: 'ability' }), pid);
  const stickOf = (pid, x, y) => hostEval(page, (gm, a) => gm.input.handle(a.id, { kind: 'axis', controlId: 'move', x: a.x, y: a.y }), { id: pid, x, y });
  const act = (pid, kind, controlId) => hostEval(page, (gm, a) => gm.input.handle(a.id, { kind: a.kind, controlId: a.c }), { id: pid, kind, c: controlId });
  const setup = (specs) =>
    page.evaluate((specs) => {
      const w = window.__fighter.sim;
      for (const [i, x, y, support] of specs) {
        const f = w.fighters[i];
        Object.assign(f, { x, y, vx: 0, vy: 0, grounded: support >= 0, support, hitstun: 0, invuln: 0, intang: 0, attack: null, dodge: null, hover: 0, percent: 0, landLag: 0, dodgeCd: 0, comboCount: 0, recentHits: [], jumps: 2, airDodgeUsed: false, frozenT: 0, lives: 3, dead: false, inGame: true, recoveryUsed: false, wallCharges: 2, wallSide: 0, lastHitBy: null });
        f.ab.charges = f.characterId === 'judoka' ? 2 : 1;
        f.ab.stanceT = f.ab.whiffT = f.ab.vanishT = f.ab.weightT = f.ab.windowT = f.ab.pendingT = f.ab.burstT = f.ab.returnT = f.ab.followT = f.ab.freezeT = 0;
        f.ab.windowSpent = false;
      }
    }, specs);
  const S = (i) =>
    G(page, (g, k) => {
      const f = g.sim.fighters[k];
      return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, pct: f.percent, lives: f.lives, dead: f.dead, grounded: f.grounded, hitstun: f.hitstun, ab: { ...f.ab }, via: f.lastHitVia, frozen: f.frozenT };
    }, i);
  /** Premi l'abilita' di pid e leggi lo stato di i dopo `ms` (tutto nella stessa chiamata: l'host headless e' lento, i tempi del gioco sono reali). */
  const pressRead = (pid, i, ms = 150) =>
    hostEval(page, async (gm, a) => {
      gm.input.handle(a.pid, { kind: 'action', controlId: 'ability' });
      await new Promise((r) => setTimeout(r, a.ms));
      const f = window.__fighter.sim.fighters[a.i];
      return { x: f.x, y: f.y, pct: f.percent, lives: f.lives, dead: f.dead, grounded: f.grounded, ab: { ...f.ab } };
    }, { pid, i, ms });
  const toast = (i) => phones[i].page.evaluate(() => document.getElementById('ab-fail-toast')?.textContent ?? '');
  const away = [[0, -11, 0, 0], [1, 11, 0, 0], [2, -5, 0, 0], [3, 5, 0, 0], [4, 0, 7.2, 3]];
  await setup(away);
  await sleep(300);

  // ============================================================ GOBLIN
  await act(GOB, 'action', 'ability');
  await sleep(700);
  check(/SOLO IN ARIA/.test(await toast(0)), `GOBLIN: a terra RB non parte, avviso privato "${await toast(0)}"`);
  check((await S(0)).ab.charges === 1, 'GOBLIN: non consumata');
  await setup([[0, 17, -2, -1], ...away.slice(1)]);
  await page.evaluate(() => { const f = window.__fighter.sim.fighters[0]; f.jumps = 0; });
  await stickOf(GOB, -1, -0.5);
  await sleep(250);
  await setup([[0, 17, -2, -1], ...away.slice(1)]);
  await page.evaluate(() => { const f = window.__fighter.sim.fighters[0]; f.jumps = 0; });
  let g = await pressRead(GOB, 0, 450);
  check(g.ab.charges === 0 && (g.ab.burstT > 0 || g.ab.returnT > 0 || g.ab.followT > 0), `GOBLIN: la rimonta parte (burst ${g.ab.burstT.toFixed(2)}, rientro ${g.ab.returnT.toFixed(2)}, speciale ${g.ab.followT.toFixed(2)})`);
  const gc = await phoneText(phones[0]);
  check(/RIMONTA|RIENTRA|ATTIVA|SPECIALE|ESAURITA/.test(gc), `GOBLIN: Companion Card mostra lo stato live ("${gc.slice(0, 140)}")`);
  await sleep(1500);
  await stickOf(GOB, 0, 0);
  g = await S(0);
  check(g.grounded || g.ab.followT > 0 || g.x < 15, `GOBLIN: e' tornato verso il palco (x ${g.x.toFixed(1)}, grounded ${g.grounded})`);
  await press(GOB);
  await sleep(600);
  check(/ESAURITA|SOLO IN ARIA|NON ORA/.test(await toast(0)), 'GOBLIN: un solo uso per vita (seconda pressione: avviso)');

  // ============================================================ BUTTAFUORI
  await setup(away);
  await sleep(300);
  await stickOf(BUT, -1, 0);
  let b = await pressRead(BUT, 1, 150);
  check(b.ab.vanishT > 0 && b.ab.charges === 0, `BUTTAFUORI: sparisce (${b.ab.vanishT.toFixed(2)} s)`);
  const bc = await phoneText(phones[1]);
  check(/ASSENTE|ATTIVA|ESAURITA/.test(bc), `BUTTAFUORI: la sua card mostra lo stato ("${bc.slice(0, 120)}")`);
  const gc2 = await phoneText(phones[0]);
  check(!/ULTIMO ACCESSO/.test(gc2) && !/ASSENTE/.test(gc2), 'PRIVACY: la card del Goblin non mostra l\'abilita\' del Buttafuori');
  // intoccabile
  await page.evaluate(() => {
    const w = window.__fighter.sim;
    const a = w.fighters[4];
    const v = w.fighters[1];
    a.x = v.x - 1.4; a.y = v.y; a.grounded = true; a.support = 0; a.facing = 1;
    a.attack = { move: { id: 'sL', kind: 'light', air: false, dir: 's', startup: 0.02, active: 0.3, recovery: 0.2, dmg: 4.5, bkb: 5.5, kbs: 0.05, angle: 32, hit: { x: 1.6, y: 1.2, w: 1.9, h: 1.1 }, impact: 'LIGHT', anim: 'side' }, t: 0.03, hit: new Set(), phase: 1 };
  });
  await sleep(500);
  check((await S(1)).pct === 0, 'BUTTAFUORI: non puo\' essere colpito mentre e\' sparito');
  await sleep(1100);
  b = await S(1);
  check(b.ab.vanishT === 0 && Math.abs(b.x - 11) > 2, `BUTTAFUORI: riappare altrove (da 11.0 a ${b.x.toFixed(1)})`);
  await stickOf(BUT, 0, 0);
  await press(BUT);
  await sleep(500);
  check(/ESAURITA/.test(await toast(1)), 'BUTTAFUORI: un solo uso per vita');

  // ============================================================ JUDOKA
  await setup([[0, -11, 0, 0], [1, 11, 0, 0], [2, -5, 0, 0], [3, 2, 0, 0], [4, 3.6, 0, 0]]);
  await sleep(300);
  await press(JUD);
  await sleep(250);
  check((await S(3)).ab.stanceT > 0, 'JUDOKA: entra in postura di contrattacco');
  await stickOf(JUD, 1, 0);
  await page.evaluate(() => {
    const w = window.__fighter.sim;
    const a = w.fighters[4];
    const v = w.fighters[3];
    a.x = v.x + 1.9; a.facing = -1;
    a.attack = { move: { id: 'sH', kind: 'heavy', air: false, dir: 's', startup: 0.02, active: 0.3, recovery: 0.4, dmg: 13, bkb: 11, kbs: 0.21, angle: 36, hit: { x: 1.9, y: 1.25, w: 2.4, h: 1.5 }, impact: 'HEAVY', anim: 'smash' }, t: 0.03, hit: new Set(), phase: 1 };
  });
  await sleep(1200);
  const j = await S(3);
  const c = await S(4);
  check(j.pct === 0, 'JUDOKA: il colpo normale e\' annullato (nessun danno)');
  check(c.via === 'counter' && c.pct > 5, `JUDOKA: l'attaccante viene proiettato (via ${c.via}, danno ${c.pct.toFixed(1)}%)`);
  await stickOf(JUD, 0, 0);
  // a vuoto: scoperto
  await setup([[0, -11, 0, 0], [1, 11, 0, 0], [2, -5, 0, 0], [3, 2, 0, 0], [4, 12, 0, 0]]);
  await press(JUD);
  await sleep(900);
  const w0 = await S(3);
  check(w0.ab.whiffT > 0 || w0.ab.charges < 2, 'JUDOKA: counter a vuoto -> resta scoperto');
  const jc = await phoneText(phones[3]);
  check(/SCOPERTO|PRONTA|ESAURITA|POSTURA|ATTIVA/.test(jc), `JUDOKA: card con lo stato ("${jc.slice(0, 110)}")`);

  // ============================================================ DOTTORE
  await setup(away);
  await sleep(300);
  const d = await pressRead(DOT, 2, 150);
  check(d.ab.weightT > 0 && d.ab.charges === 0, `DOTTORE: peso tagliato (${d.ab.weightT.toFixed(1)} s)`);
  const dc = await phoneText(phones[2]);
  check(/ATTIVA/.test(dc), `DOTTORE: la card mostra ATTIVA ("${dc.slice(0, 110)}")`);
  await press(DOT);
  await sleep(500);
  check(/ESAURITA/.test(await toast(2)), 'DOTTORE: un solo uso per vita');
  await page.evaluate(() => { window.__fighter.sim.fighters[2].ab.weightT = 0.15; });
  await sleep(700);
  check((await S(2)).ab.weightT === 0, 'DOTTORE: l\'effetto finisce da solo');

  // ============================================================ CIRO
  await setup(away);
  // tutto in una chiamata: porta Ciro al limite, aspetta che si apra la finestra e preme subito
  const flow = await hostEval(page, async (gm, a) => {
    const w = window.__fighter.sim;
    const f = w.fighters[4];
    Object.assign(f, { x: 33, y: 4, vx: 12, vy: 0, grounded: false, support: -1, hover: 0 });
    const t0 = performance.now();
    while (f.ab.windowT <= 0 && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 20));
    const opened = f.ab.windowT > 0;
    if (opened) gm.input.handle(a.cir, { kind: 'action', controlId: 'ability' });
    await new Promise((r) => setTimeout(r, 300));
    return { opened, pendingT: f.ab.pendingT, dead: f.dead, lives: f.lives, x: f.x };
  }, { cir: CIR });
  check(flow.opened, 'CIRO: un KO imminente apre la finestra BONIFICO?');
  check(flow.pendingT > 0 && !flow.dead && flow.lives === 3, `CIRO: RB nella finestra rinvia il KO (pagamento pendente ${flow.pendingT.toFixed(1)} s)`);
  const cd = await phoneText(phones[4]);
  check(/DEBITO|ATTIVA/.test(cd), `CIRO: la card mostra il debito ("${cd.slice(0, 110)}")`);
  // rientro: cade sul palco dall'alto -> atterra -> paga
  const paid = await hostEval(page, async () => {
    const f = window.__fighter.sim.fighters[4];
    Object.assign(f, { x: 8, y: 3, vx: 0, vy: -4, grounded: false, support: -1 });
    const t0 = performance.now();
    while (f.ab.pendingT > 0 && performance.now() - t0 < 2500) await new Promise((r) => setTimeout(r, 30));
    return { pct: f.percent, pending: f.ab.pendingT, lives: f.lives };
  });
  check(paid.pct >= 24 && paid.pending === 0 && paid.lives === 3, `CIRO: rientrato sul palco paga il debito (+25%, ora ${paid.pct.toFixed(0)}%)`);
  // pulizia
  await finishNow(page);
  await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  await sleep(600);
  const rows = await page.evaluate(() => window.__abilityHub.rows().length);
  check(rows === 0, 'a fine round AbilityHub e\' vuoto');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} controlli falliti` : '✅ tutto ok');
process.exit(st.fails ? 1 : 0);
