// ARENA — CHI / COME / PERCHE' con input REALI: A preme DASH sul telefono e butta B fuori dal bordo; B deve sapere chi e' stato,
// A riceve la conferma; avviso di bordo sul telefono; poi C cade perche' il bordo si stringe (nessuno l'ha toccato).
// Con OUT=cartella salva gli screenshot dell'host (anello rosso di bordo, impatto).
//   OUT=cartella node scripts/e2e/arena-feel.mjs
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
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'arena');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  const probe = (fn, arg) => hostEval(page, fn, arg);
  for (let i = 0; i < 300; i++) {
    if ((await probe((gm) => gm.game.scene.getScene('arena')?.game3d?.phase)) === 'playing') break;
    await sleep(150);
  }
  // Osservatori sui telefoni: stato "bordo vicino", toast di conferma
  for (const ph of phones) {
    await ph.page.evaluate(() => {
      window.__log = [];
      const st = document.querySelector('#arena-status');
      new MutationObserver(() => window.__log.push(st.textContent)).observe(st, { childList: true, characterData: true, subtree: true });
      // il toast viene creato al primo uso: osservo tutto il body e registro il suo testo
      new MutationObserver(() => {
        const t = document.querySelector('.ctl-toast');
        if (t && t.textContent) window.__log.push('TOAST ' + t.textContent);
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
    });
  }

  // Scena: A (spinge) a x=10.7 guarda +x; B sul bordo a x=13 (raggio 14: dentro la zona di avviso); C al centro.
  await probe((gm) => {
    const g = gm.game.scene.getScene('arena').game3d;
    const [a, b, c] = g.players;
    g.gameTime = 1; // prima del restringimento
    for (const p of g.players) { p.vx = p.vz = 0; p.stunTime = 0; p.dashCooldown = 0; p.dashing = false; p.lastHitBy = null; p.eliminations = 0; }
    a.x = 10.7; a.z = 0; a.facing = Math.PI / 2; // dir = (sin, cos) -> +x
    b.x = 13; b.z = 0;
    c.x = -3; c.z = 4;
  });
  await sleep(700);
  if (OUT) await page.screenshot({ path: path.join(OUT, 'arena-bordo.png') });
  const warnB = await phones[1].page.evaluate(() => window.__log.slice());
  check(warnB.some((t) => /BORDO VICINO/.test(t)), `il telefono di B (sul bordo) riceve l'avviso "BORDO VICINO" (${JSON.stringify(warnB.slice(-3))})`);
  const marker = await probe((gm) => {
    const g = gm.game.scene.getScene('arena').game3d;
    return g.edgeMarkers.meshes.map((m) => m.isVisible);
  });
  check(marker[1] === true && marker[0] === false && marker[2] === false, `anello rosso a terra solo sotto B (${JSON.stringify(marker)})`);

  // A preme DASH (verso +x) con il pulsante reale
  await phones[0].page.evaluate(() => {
    document.querySelector('#arena-dash').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
  });
  let bAlive = true;
  for (let i = 0; i < 60 && bAlive; i++) {
    await sleep(60);
    bAlive = await probe((gm) => gm.game.scene.getScene('arena').game3d.players[1].alive);
  }
  await sleep(500);
  if (OUT) await page.screenshot({ path: path.join(OUT, 'arena-fuori.png') });
  check(!bAlive, 'B viene buttato fuori dal dash di A');
  const st = await probe((gm) => {
    const g = gm.game.scene.getScene('arena').game3d;
    return { aElims: g.players[0].eliminations, hitBy: g.players[1].lastHitBy === g.players[0].id };
  });
  check(st.hitBy, 'la caduta di B e\' attribuita ad A (lastHitBy)');
  check(st.aElims === 1, `A ha 1 eliminazione (${st.aElims})`);
  const bTxt = await phones[1].page.evaluate(() => document.querySelector('#arena-overlay')?.innerText ?? '');
  check(/SEI FUORI/.test(bTxt) && /ti ha buttato fuori/i.test(bTxt), `B legge CHI l'ha buttato fuori: "${bTxt.replace(/\s+/g, ' ')}"`);
  const aLog = await phones[0].page.evaluate(() => window.__log.slice());
  check(aLog.some((t) => /Hai buttato fuori/.test(t)), `A riceve la conferma "Hai buttato fuori ..." (${JSON.stringify(aLog.slice(-2))})`);

  // C cade perche' il bordo si stringe: nessuno l'ha toccato
  await probe((gm) => {
    const g = gm.game.scene.getScene('arena').game3d;
    g.gameTime = 20; // restringimento in corso: raggio ~10.4
    const c = g.players[2];
    c.lastHitBy = null;
    c.x = 12; c.z = 0;
  });
  let cAlive = true;
  for (let i = 0; i < 40 && cAlive; i++) {
    await sleep(80);
    cAlive = await probe((gm) => gm.game.scene.getScene('arena').game3d.players[2].alive);
  }
  check(!cAlive, 'C oltre il bordo che si stringe: eliminato');
  await sleep(300);
  const cTxt = await phones[2].page.evaluate(() => document.querySelector('#arena-overlay')?.innerText ?? '');
  check(/bordo si stringe/i.test(cTxt), `C legge il PERCHE' (bordo): "${cTxt.replace(/\s+/g, ' ')}"`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  if (OUT) console.log('   screenshot in', OUT);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
