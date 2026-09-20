// RESYNC: se un client "perde" una transizione (scena sbagliata sull'host / DOM vecchio sul telefono),
// lo snapshot successivo del server lo deve riallineare SENZA refresh.
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';

const browser = await launch();
const errs = [];
let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser);
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 2; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'reaction');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(300);
  await sleep(1500);
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 1 })) });
  });
  while ((await hostSnapshot(page)).phase !== 'GLOBAL_LEADERBOARD') await sleep(300);
  await sleep(500);
  let s = await hostSnapshot(page);
  check(s.active.length === 1 && s.active[0] === 'LeaderboardScene', `partenza pulita: scena attiva ${JSON.stringify(s.active)}`);

  // --- 1) HOST: scena vecchia "resuscitata" sopra (transizione persa) ---
  await hostEval(page, (gm) => {
    gm.game.scene.start('reaction', { ctx: gm.minigameContext });
  });
  await sleep(300);
  s = await hostSnapshot(page);
  check(s.active.includes('reaction') && s.active.includes('LeaderboardScene'), `guasto simulato sull'host: ${JSON.stringify(s.active)}`);
  // il telefono torna in primo piano → join idempotente → il server rimanda lo snapshot a tutti
  await phones[0].page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(1500);
  s = await hostSnapshot(page);
  check(s.active.length === 1 && s.active[0] === 'LeaderboardScene', `dopo lo snapshot l'host è riallineato: ${JSON.stringify(s.active)}`);

  // --- 2) TELEFONO: DOM vecchio (evento di transizione perso) ---
  await phones[1].page.evaluate(() => {
    document.getElementById('app').innerHTML = '<div class="screen"><h1>VECCHIA SCHERMATA</h1></div>';
  });
  let v = await phoneView(phones[1].page);
  check(v.h1 === 'VECCHIA SCHERMATA', 'guasto simulato sul telefono (DOM vecchio)');
  await phones[1].page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(1200);
  v = await phoneView(phones[1].page);
  check(v.h1 === 'ROUND TERMINATO' || v.h1 === 'PROSSIMO MINIGIOCO...', `dopo lo snapshot il telefono si riallinea: "${v.h1}"`);

  // --- 3) il flusso poi prosegue da solo fino al rullo successivo ---
  const t0 = Date.now();
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_ROULETTE' && Date.now() - t0 < 30000) await sleep(400);
  s = await hostSnapshot(page);
  check(s.phase === 'MINIGAME_ROULETTE' && s.active.length === 1 && s.active[0] === 'RouletteScene', `il flusso arriva al rullo: ${s.phase} ${JSON.stringify(s.active)}`);
  const vv = await phoneView(phones[0].page);
  check(vv.h1 === 'PROSSIMO GIOCO...', `telefono nel rullo: "${vv.h1}"`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
