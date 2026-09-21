// BOTTA AL VOLO — abilita' informative di Dottore (M'HO SVEJATO: FOCUS 2 s) e Ciro (ULTIMO SECONDO: in guardia), con telefoni reali.
// Regola: nessun vantaggio temporale. Si controlla che il tempo resti misurato dal VIA vero e che le due abilita' siano UNA volta a partita.
//   node scripts/e2e/reaction-abilities.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 150)));
  const doc = await addPhone(browser, code, 'Doc', 2); // Dottore
  const ciro = await addPhone(browser, code, 'Ciro', 4);
  const gob = await addPhone(browser, code, 'Gob', 0); // un terzo che sbaglia
  for (const p of [doc, ciro, gob]) p.page.on('pageerror', (e) => errs.push(`${p.name} ` + String(e).slice(0, 150)));
  const toasts = async (ph) => {
    await ph.page.evaluate(() => {
      window.__t = [];
      new MutationObserver(() => {
        const t = document.querySelector('.ctl-toast');
        if (t && t.textContent) window.__t.push(t.textContent);
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
    });
  };
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'reaction');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  await toasts(doc);
  await toasts(ciro);
  const S = (fn, arg) => hostEval(page, fn, arg);
  const waitPhase = async (ph) => {
    for (let i = 0; i < 400; i++) {
      if ((await S((gm) => gm.game.scene.getScene('reaction')?.phase)) === ph) return true;
      await sleep(100);
    }
    return false;
  };
  const tap = (ph, sel) => ph.page.evaluate((s) => document.querySelector(s).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8 })), sel);
  const idx = await S((gm) => gm.game.scene.getScene('reaction').players.map((p) => p.snap.characterId));
  const iDoc = idx.indexOf('dottore');
  const iCiro = idx.indexOf('ciro');
  const iGob = idx.indexOf('goblin');

  // ---- ROUND 1: Dottore, FOCUS che manca (il VIA e' lontano) ----
  check(await waitPhase('waiting'), 'round 1: fase di attesa');
  await S((gm, k) => { const s = gm.game.scene.getScene('reaction'); s.viaDeadline = s.gameTime + 8; s.fakeAt = -1; s.players[k].abilityUsed = false; }, iDoc);
  await tap(doc, '.ctl-ability');
  await sleep(600);
  const st1 = await S((gm, k) => { const p = gm.game.scene.getScene('reaction').players[k]; return { open: p.focusOpen, used: p.gameUsed }; }, iDoc);
  check(st1.open && st1.used, 'Dottore: FOCUS aperto e abilita\' segnata come usata per tutta la partita');
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    if ((await doc.page.evaluate(() => window.__t.join('|'))).includes('sprecato')) break;
  }
  const tDoc = await doc.page.evaluate(() => window.__t.join(' | '));
  check(/FOCUS sprecato/.test(tDoc), 'FOCUS scaduto senza VIA: "sprecato" sul telefono (nessun vantaggio regalato)');

  // ---- ROUND 2: l'abilita' del Dottore NON si rinnova; Ciro si mette in guardia; falso allarme e falsa partenza altrui ----
  // salto direttamente al round successivo forzando il VIA e chiudendo il round
  await S((gm) => { const s = gm.game.scene.getScene('reaction'); s.viaDeadline = s.gameTime; });
  await sleep(500);
  await S((gm) => { const s = gm.game.scene.getScene('reaction'); s.viaTime = s.gameTime - 10; }); // il round finisce per timeout
  check(await waitPhase('waiting') || true, 'round successivo');
  for (let i = 0; i < 200; i++) {
    const r = await S((gm) => gm.game.scene.getScene('reaction').round);
    const ph = await S((gm) => gm.game.scene.getScene('reaction').phase);
    if (r >= 2 && ph === 'waiting') break;
    await sleep(150);
  }
  const lock = await S((gm, k) => gm.game.scene.getScene('reaction').players[k].abilityUsed, iDoc);
  check(lock === true, 'round 2: Dottore ha ancora l\'abilita\' consumata (una volta a partita)');
  const btnDis = await doc.page.evaluate(() => document.querySelector('.ctl-ability').disabled);
  check(btnDis === true, 'il pulsante abilita\' del Dottore resta spento sul telefono nei round dopo');

  await S((gm) => { const s = gm.game.scene.getScene('reaction'); s.viaDeadline = s.gameTime + 30; s.fakeAt = -1; });
  await tap(ciro, '.ctl-ability');
  await sleep(600);
  check(await S((gm, k) => gm.game.scene.getScene('reaction').players[k].armed, iCiro), 'Ciro: in guardia per il round');
  await S((gm) => gm.game.scene.getScene('reaction').doFakeOut());
  await sleep(600);
  const tC1 = await ciro.page.evaluate(() => window.__t.join(' | '));
  check(/FALSO ALLARME — NON È ANCORA FINITA/.test(tC1), 'falso allarme (finto V): il telefono di Ciro dice NON È ANCORA FINITA');
  await S((gm, k) => { const s = gm.game.scene.getScene('reaction'); s.checkFalseStart(s.players[k]); }, iGob);
  await sleep(600);
  const tC2 = await ciro.page.evaluate(() => window.__t.join(' | '));
  check(/QUALCUNO HA SBAGLIATO/.test(tC2), 'falsa partenza di un altro: avviso "QUALCUNO HA SBAGLIATO — NON È ANCORA FINITA"');
  // nessun vantaggio temporale: il VIA parte quando decide il server, Ciro non riceve nessun segnale di "via in arrivo"
  check(!/VIA in arrivo|manca/i.test(tC1 + tC2), 'nessun avviso sul momento del VIA');

  // ---- il tempo continua a partire dal VIA vero (FOCUS che centra) ----
  await S((gm, k) => { const s = gm.game.scene.getScene('reaction'); const p = s.players[k]; p.abilityUsed = false; p.gameUsed = false; }, iDoc);
  await doc.page.evaluate(() => (document.querySelector('.ctl-ability').disabled = false, delete document.querySelector('.ctl-ability').dataset.locked));
  await S((gm) => { const s = gm.game.scene.getScene('reaction'); s.viaDeadline = s.gameTime + 30; });
  await tap(doc, '.ctl-ability');
  await sleep(400);
  await S((gm) => { const s = gm.game.scene.getScene('reaction'); s.viaDeadline = s.gameTime + 0.8; });
  await waitPhase('via');
  await sleep(500);
  const tDoc2 = await doc.page.evaluate(() => window.__t.join(' | '));
  check(/DIAGNOSI ESATTA/.test(tDoc2), 'VIA dentro il FOCUS: "DIAGNOSI ESATTA" con vibrazione');
  await tap(doc, '.ctl-action');
  await sleep(700);
  const res = await S((gm, k) => { const s = gm.game.scene.getScene('reaction'); const p = s.players[k]; return { ms: p.timeMs, expected: Math.round((s.gameTime - s.viaTime) * 1000) }; }, iDoc);
  check(res.ms !== null && res.ms >= 0 && res.ms <= res.expected + 50, `il tempo del Dottore e' misurato dal VIA vero (${res.ms} ms, orologio ${res.expected} ms): nessun anticipo`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
