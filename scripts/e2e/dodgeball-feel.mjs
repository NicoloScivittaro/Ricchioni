// DODGEBALL — game feel con input REALI: lancio dal pulsante del telefono, scia, avviso di pericolo sul telefono del bersaglio,
// "chi ti ha colpito", presa con anello, cooldown della schivata sul pulsante, bug del self-hit (rimbalzo su se stessi).
// Con OUT=cartella salva gli screenshot dell'host.
//   OUT=cartella node scripts/e2e/dodgeball-feel.mjs
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
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'dodgeball');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  const probe = (fn, arg) => hostEval(page, fn, arg);
  const g$ = `(gm) => gm.game.scene.getScene('dodgeball').game3d`;
  // aspetta il VIA (countdown finito)
  for (let i = 0; i < 300; i++) {
    const ph = await probe((gm) => gm.game.scene.getScene('dodgeball')?.game3d?.phase);
    if (ph === 'playing') break;
    await sleep(150);
  }

  // scena controllata: A a sinistra, B a destra, C in fondo; nessuno si muove
  await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    const [a, b, c] = g.players;
    for (const p of g.players) {
      p.vx = p.vz = 0;
      p.stunTime = 0;
      p.invulnTime = 0;
      p.dodgeCooldown = 0;
      p.dodgeTime = 0;
      p.hasBall = false;
      p.eliminations = 0;
    }
    a.x = -10; a.z = 0;
    b.x = 10; b.z = 0; b.facing = -Math.PI / 2; // B guarda verso A (dir = (sin, cos))
    c.x = 0; c.z = 8;
    for (const ball of g.balls) {
      ball.state = 'free'; ball.holderId = null; ball.throwerId = null; ball.vx = ball.vz = 0;
    }
    g.balls[0].x = -6; g.balls[0].z = -6; // lontano da tutti
    g.balls[1].x = 0; g.balls[1].z = -7;
  });

  // ---- PRESA: 1.9 dal centro (corpo tocca l'anello) si raccoglie, 2.4 no ----
  await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    const c = g.players[2];
    g.balls[1].x = c.x + 2.4; g.balls[1].z = c.z - 0; // a 2.4: fuori portata
  });
  await sleep(500);
  let has = await probe((gm) => gm.game.scene.getScene('dodgeball').game3d.players[2].hasBall);
  check(!has, 'palla a 2.4 dal centro: NON viene raccolta (fuori dall\'anello)');
  await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    const c = g.players[2];
    g.balls[1].x = c.x + 1.9; g.balls[1].z = c.z;
  });
  for (let i = 0; i < 20; i++) {
    await sleep(100);
    has = await probe((gm) => gm.game.scene.getScene('dodgeball').game3d.players[2].hasBall);
    if (has) break;
  }
  check(has, 'palla a 1.9 dal centro (corpo che tocca l\'anello): raccolta al volo');
  // C butta via la palla per non disturbare
  await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    const ball = g.balls[1];
    ball.state = 'free'; ball.holderId = null; g.players[2].hasBall = false; ball.x = 12; ball.z = -7;
  });

  // ---- SCHIVATA (finche' sono tutti vivi): B preme SCHIVA, il pulsante mostra il cooldown reale e poi torna pronto ----
  await phones[1].page.evaluate(() => {
    window.__seen = { cooldown: false };
    const btn = document.querySelector('#db-dodge');
    new MutationObserver(() => {
      if (btn.classList.contains('arena-dash-cooldown')) window.__seen.cooldown = true;
    }).observe(btn, { attributes: true, attributeFilter: ['class'] });
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 6 }));
  });
  await sleep(400);
  const cd = await phones[1].page.evaluate(() => ({ seen: window.__seen.cooldown, disabled: document.querySelector('#db-dodge').disabled }));
  check(cd.seen && cd.disabled, 'dopo la schivata il pulsante si spegne (cooldown visibile)');
  await sleep(1300);
  const cd2 = await phones[1].page.evaluate(() => document.querySelector('#db-dodge').disabled);
  check(!cd2, 'dopo il cooldown il pulsante e\' di nuovo pronto');

  // ---- LANCIO reale: B prende la palla 0 e preme LANCIA sul telefono ----
  await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    const [a, b] = g.players;
    const ball = g.balls[0];
    ball.state = 'held'; ball.holderId = b.id; b.hasBall = true;
    a.x = -10; a.z = 0; b.x = 10; b.z = 0; b.facing = -Math.PI / 2;
  });
  await phones[0].page.evaluate(() => {
    window.__seen = { danger: false, cooldown: false, toast: '' };
    const btn = document.querySelector('#db-dodge');
    new MutationObserver(() => {
      if (btn.classList.contains('db-danger')) window.__seen.danger = true;
      if (btn.classList.contains('arena-dash-cooldown')) window.__seen.cooldown = true;
    }).observe(btn, { attributes: true, attributeFilter: ['class'] });
  });
  await phones[1].page.evaluate(() => {
    document.querySelector('#db-throw').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5 }));
  });
  let shot = false;
  let elimBy = '';
  for (let i = 0; i < 60; i++) {
    await sleep(50);
    const st = await probe((gm) => {
      const g = gm.game.scene.getScene('dodgeball').game3d;
      return { flying: g.balls[0].state, alive: g.players[0].alive, x: g.balls[0].x };
    });
    if (OUT && !shot && st.flying === 'flying') {
      await page.screenshot({ path: path.join(OUT, 'dodgeball-lancio.png') });
      shot = true;
    }
    if (!st.alive) break;
  }
  await sleep(400);
  const seenA = await phones[0].page.evaluate(() => ({ ...window.__seen, txt: document.body.innerText }));
  check(seenA.danger, 'il telefono del bersaglio ha ricevuto l\'AVVISO DI PERICOLO (pulsante SCHIVA lampeggiante)');
  const elim = await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    return { aAlive: g.players[0].alive, bElims: g.players[1].eliminations };
  });
  check(!elim.aAlive, 'la palla lanciata dal telefono di B elimina A (nessuna schivata)');
  check(elim.bElims === 1, `B ha 1 eliminazione (${elim.bElims})`);
  check(/ti ha colpito/i.test(seenA.txt), 'il telefono di A dice CHI l\'ha colpito ("… ti ha colpito!")');
  if (OUT) await page.screenshot({ path: path.join(OUT, 'dodgeball-impatto.png') });
  const hs = await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    return { hitStop: g.hitStop, shocks: g.shocks.filter((s) => s.t < 0.4).length };
  });
  console.log('   hitstop residuo', hs.hitStop.toFixed(3), 'onde attive', hs.shocks);

  // ---- SELF-HIT: C viene colpito da una sua palla di rimbalzo: nessuna eliminazione in piu' ----
  await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    const c = g.players[2];
    const ball = g.balls[1];
    c.x = 0; c.z = 0; c.vx = c.vz = 0; c.stunTime = 0; c.invulnTime = 0; c.hasBall = false;
    ball.state = 'flying'; ball.holderId = null; ball.throwerId = c.id; ball.life = 1; ball.bounces = 1;
    ball.x = -3; ball.z = 0; ball.vx = 24; ball.vz = 0;
  });
  await sleep(700);
  const self = await probe((gm) => {
    const g = gm.game.scene.getScene('dodgeball').game3d;
    return { cAlive: g.players[2].alive, cElims: g.players[2].eliminations };
  });
  check(!self.cAlive, 'C colpito dalla propria palla di rimbalzo: eliminato');
  check(self.cElims === 0, `...ma NON conta come eliminazione (${self.cElims}) [bug corretto]`);

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  if (OUT) console.log('   screenshot in', OUT);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
