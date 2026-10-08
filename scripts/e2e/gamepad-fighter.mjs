// BOTTE SUL CORNICIONE col controller: 3 giocatori MISTI (P1 Xbox, P2 DualSense, P3 telefono con croce+tasti).
//   - schermata CONTROLLI: nome, comandi, sezione ABILITA' di ogni personaggio presente, i 3 consigli della prima volta, ~5 s, gioco fermo
//   - mappatura vera pad -> gioco: stick, A salto, X leggero, Y pesante, B schivata, RB abilita' (Xbox) / R1 (PlayStation)
//   - il gioco risponde: corsa, salto + doppio salto, schivata con cooldown, attacchi direzionali (danno giusto), abilita' e avviso privato
//   - Companion Card sul telefono col controller (niente tasti di gioco), croce + tasti per chi non ha il controller
//   node scripts/e2e/gamepad-fighter.mjs
import { launch, createRoomOnHost, addPhone, hostEval, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, btn, stick, tap, until, phoneText, watchControls, startGame, finishNow, gameEval, pressedOf, axisOf } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
const G = (page, fn, arg) => gameEval(page, 'cornicione', fn, arg);
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  // personaggi: goblin, buttafuori, dottore (CHARACTER_ORDER). P1 = goblin (Xbox), P2 = buttafuori (DualSense), P3 = dottore (telefono)
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
    for (let t = 0; t < 6 && (await page.evaluate(() => window.__pads.pairedCount())) < k + 1; t++) {
      await tap(page, k, 'A');
      await sleep(500);
    }
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox) e P2 (DualSense) col controller, P3 col telefono');
  await watchControls(page);

  // ------------------------------------------------------------ CONTROLLI
  await startGame(page, 'cornicione');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await sleep(500);
  await page.screenshot({ path: 'e2e-shots/fighter/controls-screen.png' });
  const t0 = await G(page, (g) => g.sim.time);
  await btn(page, 0, 'A', true);
  await stick(page, 0, 1, 0);
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 9000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 4700 && dur <= 5700, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/BOTTE SUL CORNICIONE/.test(cc.text) && /LEFT STICK MUOVITI/.test(cc.text) && /A \/ ✕ SALTO/.test(cc.text) && /X \/ □ ATTACCO LEGGERO/.test(cc.text) && /Y \/ △ ATTACCO PESANTE/.test(cc.text) && /B \/ ◯ SCHIVATA/.test(cc.text), `comandi base: "${cc.text.slice(0, 200)}"`);
  check(/ABILITÀ/.test(cc.text) && /RIMONTA AL 90°/.test(cc.text) && /ULTIMO ACCESSO: 3 SETTIMANE FA/.test(cc.text) && /TAGLIO PESO EXPRESS/.test(cc.text), 'CONTROLLI: sezione ABILITÀ con la riga di ogni personaggio presente');
  check(/PIÙ % HAI, PIÙ LONTANO VOLI/.test(cc.text) && /CADI FUORI = PERDI UNA VITA/.test(cc.text) && /SALTI \+ SCHIVATA \+ RECOVERY/.test(cc.text), 'CONTROLLI: i tre consigli della prima volta');
  await sleep(300);
  const tAfter = await G(page, (g) => g.sim.time);
  check(tAfter === t0 && t0 === 0, `gioco FERMO durante i CONTROLLI (tempo di gioco ${t0} -> ${tAfter})`);
  await btn(page, 0, 'A', false);
  await stick(page, 0, 0, 0);
  await sleep(300);
  await until(async () => (await G(page, (g) => g.phase)) === 'playing', 40000, 'via');

  // ------------------------------------------------------------ mappatura vera pad -> controlId letti dal gioco
  const held = async (idx, pid, name, control) => {
    await btn(page, idx, name, true);
    await sleep(600);
    const v = await pressedOf(page, pid, control);
    await btn(page, idx, name, false);
    await sleep(250);
    return v;
  };
  check(await held(0, P1, 'A', 'jump'), 'A/✕ = SALTO');
  check(await held(0, P1, 'X', 'light'), 'X/□ = ATTACCO LEGGERO');
  check(await held(0, P1, 'Y', 'heavy'), 'Y/△ = ATTACCO PESANTE');
  check(await held(0, P1, 'B', 'dodge'), 'B/◯ = SCHIVATA');
  check(await held(0, P1, 'RB', 'ability'), 'RB = ABILITÀ (Xbox)');
  check(await held(1, P2, 'RB', 'ability'), 'R1 = ABILITÀ (DualSense)');
  await stick(page, 0, 0.9, -0.8);
  await sleep(500);
  const ax = await axisOf(page, P1);
  check(ax.x > 0.7 && ax.y < -0.5, `stick sinistro -> asse move (${ax.x.toFixed(2)}, ${ax.y.toFixed(2)})`);
  await stick(page, 0, 0, 0);

  // ------------------------------------------------------------ il gioco risponde
  const setup = (specs) =>
    page.evaluate((specs) => {
      const w = window.__fighter.sim;
      for (const [i, x, y, support] of specs) {
        const f = w.fighters[i];
        Object.assign(f, { x, y, vx: 0, vy: 0, grounded: support >= 0, support, hitstun: 0, invuln: 0, intang: 0, attack: null, dodge: null, hover: 0, percent: 0, landLag: 0, dodgeCd: 0, comboCount: 0, recentHits: [], jumps: 2, airDodgeUsed: false, frozenT: 0, lives: 3, dead: false, inGame: true });
        f.ab.charges = f.characterId === 'judoka' ? 2 : 1;
        f.ab.stanceT = f.ab.whiffT = f.ab.vanishT = f.ab.weightT = 0;
      }
    }, specs);
  const F = (i) => G(page, (g, k) => ({ x: g.sim.fighters[k].x, y: g.sim.fighters[k].y, vx: g.sim.fighters[k].vx, jumps: g.sim.fighters[k].jumps, pct: g.sim.fighters[k].percent, cd: g.sim.fighters[k].dodgeCd, grounded: g.sim.fighters[k].grounded, vanish: g.sim.fighters[k].ab.vanishT, charges: g.sim.fighters[k].ab.charges }), i);
  await setup([[0, -8, 0, 0], [1, 9, 0, 0], [2, 0, 7.2, 3]]);
  await sleep(300);
  let a = await F(0);
  await stick(page, 0, 1, 0);
  await sleep(900);
  let b = await F(0);
  check(b.x > a.x + 2, `stick destra: il personaggio corre (${a.x.toFixed(1)} -> ${b.x.toFixed(1)})`);
  await stick(page, 0, -1, 0);
  await sleep(900);
  const c = await F(0);
  check(c.x < b.x - 2, 'stick sinistra: corre a sinistra');
  await stick(page, 0, 0, 0);
  await setup([[0, -8, 0, 0], [1, 9, 0, 0], [2, 0, 7.2, 3]]);
  await sleep(200);
  // salto + doppio salto
  let maxY = 0;
  await btn(page, 0, 'A', true);
  for (let i = 0; i < 6; i++) {
    await sleep(120);
    maxY = Math.max(maxY, (await F(0)).y);
  }
  await btn(page, 0, 'A', false);
  check(maxY > 1.2, `A: salta (quota massima ${maxY.toFixed(1)})`);
  await setup([[0, -8, 0, 0]]);
  await sleep(150);
  await tap(page, 0, 'A', 200);
  await tap(page, 0, 'A', 200);
  const dj = await F(0);
  check(dj.jumps === 0 || dj.y > 3.3, `doppio salto: due pressioni in aria (salti rimasti ${dj.jumps}, y ${dj.y.toFixed(1)})`);
  // schivata con cooldown
  await setup([[0, -8, 0, 0]]);
  await sleep(200);
  await btn(page, 0, 'B', true);
  await sleep(250);
  await btn(page, 0, 'B', false);
  const d1 = await F(0);
  check(d1.cd > 0.2, `B: schivata (cooldown ${d1.cd.toFixed(2)} s: niente spam)`);
  // attacchi: neutro leggero (2.8), laterale leggero (4.5), laterale pesante (13)
  const hitWith = async (buttons, sx, sy, expectDmg, label) => {
    await setup([[0, -8, 0, 0], [1, -6.6, 0, 0]]);
    await page.evaluate(() => (window.__fighter.sim.fighters[0].facing = 1));
    await sleep(250);
    await stick(page, 0, sx, sy);
    await sleep(120);
    for (const n of buttons) await btn(page, 0, n, true);
    await sleep(380);
    for (const n of buttons) await btn(page, 0, n, false);
    await stick(page, 0, 0, 0);
    await sleep(700);
    const v = await F(1);
    check(Math.abs(v.pct - expectDmg) < 0.6, `${label}: danno ${v.pct.toFixed(1)} (atteso ${expectDmg})`);
  };
  await hitWith(['X'], 0, 0, 2.8, 'X neutro = leggero neutro');
  await hitWith(['X'], 1, 0, 4.5, 'X + stick destra = leggero laterale');
  await hitWith(['Y'], 1, 0, 13, 'Y + stick destra = pesante laterale');
  // abilita': Goblin a terra -> NON partita con avviso PRIVATO; Buttafuori sparisce
  await setup([[0, -8, 0, 0], [1, 9, 0, 0], [2, 0, 7.2, 3]]);
  await sleep(300);
  await tap(page, 0, 'RB', 500);
  await sleep(500);
  const toast = await phones[0].page.evaluate(() => document.getElementById('ab-fail-toast')?.textContent ?? '');
  check(/SOLO IN ARIA/.test(toast), `RB del Goblin a terra: avviso privato "${toast}"`);
  check((await F(0)).charges === 1, 'RB non partita: l\'abilità non si consuma');
  await tap(page, 1, 'RB', 500);
  await sleep(300);
  const bt = await F(1);
  check(bt.vanish > 0 || bt.charges === 0, 'RB/R1 del Buttafuori: ULTIMO ACCESSO parte');
  const p2card = await phoneText(phones[1]);
  check(/ULTIMO ACCESSO: 3 SETTIMANE FA/.test(p2card) && /R1/.test(p2card), `Companion Card DualSense: nome abilità e tasto R1 ("${p2card.slice(0, 120)}")`);

  // ------------------------------------------------------------ Companion Card e fallback telefono
  const p1card = await phoneText(phones[0]);
  check(/BOTTE SUL CORNICIONE/.test(p1card) && /RIMONTA AL 90°/.test(p1card) && /RB/.test(p1card), `Companion Card Xbox: gioco, abilità e tasto RB ("${p1card.slice(0, 120)}")`);
  check((await phones[0].page.$$('.ctl-btn, .dpad-grid')).length === 0, 'Companion Card: nessun tasto di gioco sul telefono col controller');
  check(/USA IL CONTROLLER/.test(p1card) || /CONTROLLER/.test(p1card), 'Companion Card: indica che si gioca col controller');
  const p3card = await phoneText(phones[2]);
  check((await phones[2].page.$$('.ctl-light, .ctl-heavy, .ctl-dodge, .ctl-jump')).length >= 3, `P3 (senza controller): croce e tasti sul telefono ("${p3card.slice(0, 80)}")`);
  // il telefono di P3 entra nello stesso InputManager: croce destra + tasto leggero
  await setup([[0, -9, 0, 0], [1, 10, 0, 0], [2, 0, 0, 0]]);
  await sleep(200);
  const x0 = (await F(2)).x;
  await hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'down', controlId: 'right' }), P3);
  await sleep(700);
  await hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'up', controlId: 'right' }), P3);
  check((await F(2)).x > x0 + 1.5, 'P3 (telefono): la croce destra lo muove');

  // controller scollegato: input a zero
  await stick(page, 0, 1, 0);
  await sleep(300);
  await page.evaluate(() => window.__padRemove(0));
  await sleep(500);
  const gone = await axisOf(page, P1);
  check(Math.abs(gone.x) < 0.01, 'controller scollegato: input a zero (nessun movimento fantasma)');

  await finishNow(page);
  await until(async () => (await hostEval(page, (gm) => gm.state?.phase)) !== 'MINIGAME_PLAYING', 30000, 'fine');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} controlli falliti` : '✅ tutto ok');
process.exit(st.fails ? 1 : 0);
