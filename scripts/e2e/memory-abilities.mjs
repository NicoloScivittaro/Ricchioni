// MEMORIA — abilita' rifatte, con telefoni reali:
//  - M'HO SVEJATO (Dottore): la casella si vede SOLO sul telefono del Dottore, per poco, e costa +0,8 s sul suo tempo
//  - NO, ASPETTA! (Judoka): il proprio tempo si ferma 2 s (tasti bloccati, spareggio senza la pausa), poi si riprende SUBITO senza replay
//   node scripts/e2e/memory-abilities.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser); // 2 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const doc = await addPhone(browser, code, 'Doc', 2); // Dottore
  const jud = await addPhone(browser, code, 'Jud', 3); // Judoka
  for (const p of [doc, jud]) p.page.on('pageerror', (e) => errs.push(`${p.name} ` + String(e).slice(0, 160)));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'memory');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  const probe = (fn, arg) => hostEval(page, fn, arg);
  const M = `gm.game.scene.getScene('memory')`;
  // aspetta la fase RIPETI del primo round
  for (let i = 0; i < 400; i++) {
    const ph = await probe((gm) => gm.game.scene.getScene('memory')?.phase);
    if (ph === 'repeat') break;
    await sleep(120);
  }
  const info = await probe((gm) => {
    const s = gm.game.scene.getScene('memory');
    return { round: s.round, seq: s.sequences[s.round], chars: s.players.map((p) => p.snap.characterId), phase: s.phase };
  });
  check(info.phase === 'repeat', `fase RIPETI raggiunta (sequenza ${JSON.stringify(info.seq)}, personaggi ${info.chars})`);
  const iDoc = info.chars.indexOf('dottore');
  const iJud = info.chars.indexOf('judoka');
  check(iDoc >= 0 && iJud >= 0, 'Dottore e Judoka in partita');

  // ---- M'HO SVEJATO: sbirciata privata, costo 0.8 s ----
  await doc.page.evaluate(() => {
    window.__flash = [];
    const btns = [...document.querySelectorAll('#mem-grid .mem-tile')];
    const obs = new MutationObserver((recs) => {
      for (const r of recs) {
        const el = r.target;
        if (el.classList?.contains('mem-flash')) window.__flash.push(btns.indexOf(el));
      }
    });
    btns.forEach((b) => obs.observe(b, { attributes: true, attributeFilter: ['class'] }));
    window.__btns = btns.length;
  });
  const hostFlashBefore = await probe((gm) => gm.game.scene.getScene('memory').tileHalos.map((h) => h.alpha));
  await doc.page.evaluate(() => document.querySelector('#mem-ability').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4 })));
  await sleep(700);
  const docFlash = await doc.page.evaluate(() => ({ flash: window.__flash, n: window.__btns }));
  const hostHalo = await probe((gm) => gm.game.scene.getScene('memory').tileHalos.map((h) => h.alpha));
  const pen = await probe((gm, k) => gm.game.scene.getScene('memory').players[k].penaltyMs, iDoc);
  check(docFlash.flash.includes(info.seq[0]), `sul telefono del Dottore lampeggia la casella giusta (${info.seq[0]}); flash visti: ${JSON.stringify(docFlash.flash)}`);
  check(hostHalo.every((a) => a === hostFlashBefore[0] || a === 0), `sulla TV NON si illumina nessuna casella (aloni ${JSON.stringify(hostHalo)})`);
  check(pen === 800, `costo sul tempo del Dottore: +800 ms (${pen})`);

  // ---- NO, ASPETTA!: pausa vera ----
  const t0 = await probe((gm, k) => { const s = gm.game.scene.getScene('memory'); return { t: s.gameTime, dl: s.players[k].deadline }; }, iJud);
  await jud.page.evaluate(() => document.querySelector('#mem-ability').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5 })));
  await sleep(500);
  const during = await jud.page.evaluate(() => ({ locked: document.querySelectorAll('#mem-grid .mem-locked').length, txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200) }));
  check(during.locked >= 4, `durante la pausa i tasti del Judoka sono bloccati (${during.locked} tasti) — "${during.txt.slice(0, 70)}"`);
  // un tocco "forzato" sul canale input dell'host durante la pausa non conta
  const seqJ = info.seq;
  await probe((gm, k) => {
    const s = gm.game.scene.getScene('memory');
    s.ctx.input.get(s.players[k].snap.id).tap('c' + s.sequences[s.round][0]);
  }, iJud);
  await sleep(300);
  const idxDuring = await probe((gm, k) => gm.game.scene.getScene('memory').players[k].inputIndex, iJud);
  check(idxDuring === 0, `un tocco durante il tempo fermo non conta (inputIndex ${idxDuring})`);
  // attesa fine pausa sul tempo di GIOCO
  for (let i = 0; i < 100; i++) {
    const t = await probe((gm) => gm.game.scene.getScene('memory').gameTime);
    if (t - t0.t > 2.3) break;
    await sleep(100);
  }
  await sleep(300);
  const after = await jud.page.evaluate(() => document.querySelectorAll('#mem-grid .mem-locked').length);
  check(after === 0, `finita la pausa i tasti si sbloccano subito (${after} bloccati)`);
  const dl = await probe((gm, k) => gm.game.scene.getScene('memory').players[k].deadline, iJud);
  check(Math.abs(dl - t0.dl - 2) < 0.05, `la scadenza slitta di 2 s (${(dl - t0.dl).toFixed(2)})`);
  // ora completa la sequenza dal telefono: il tempo di spareggio NON conta i 2 s di pausa
  for (const tile of seqJ) {
    await jud.page.evaluate((i) => {
      const tiles = [...document.querySelectorAll('#mem-grid .mem-tile')];
      tiles[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 6 }));
    }, tile);
    await sleep(350);
  }
  await sleep(500);
  const done = await probe((gm, k) => { const s = gm.game.scene.getScene('memory'); const p = s.players[k]; return { done: p.completedRounds, ms: p.totalTimeMs, elapsed: (s.gameTime - s.repeatStartTime) * 1000 }; }, iJud);
  check(done.done >= 1, `il Judoka completa la sequenza dopo la pausa (round completati ${done.done})`);
  check(done.ms > 0 && done.ms < done.elapsed - 1700, `tempo di spareggio senza la pausa: ${Math.round(done.ms)} ms contro ${Math.round(done.elapsed)} ms di orologio`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
