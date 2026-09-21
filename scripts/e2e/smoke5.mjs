// SMOKE FINALE A 5 GIOCATORI, senza refresh:
//   Rullo → Pallavola → risultati → Rullo → Ribaltati → risultati → Rullo → Quiz → risultati → Rullo → FPS → risultati → Rullo → Memoria → risultati
// Rullo, intro, risultati e classifica girano con i tempi NATURALI; solo la fine del minigioco viene consegnata subito
// (le partite vere sono coperte da natural/fastend/rounds/cultura). Controlla a ogni fase: una sola scena Phaser attiva,
// nessun canvas 3D residuo, telefoni allineati, nessun errore di pagina, e che NESSUNA pagina sia stata ricaricata.
//   node scripts/e2e/smoke5.mjs        SEQ=volleyball,kart3d,quiz,fps,memory
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';

const SEQ = (process.env.SEQ ?? 'volleyball,kart3d,quiz,fps,memory').split(',');
const browser = await launch();
let fails = 0;
let crashed = false;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const errs = [];
const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(200);
  }
  throw new Error(`timeout: ${what}`);
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 });
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 140)));
  const phones = [];
  const names = ['Nicolò', 'Christian', 'Victor', 'Judoka', 'Ciro'];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, names[i], i);
    p.page.on('pageerror', (e) => errs.push(`${names[i]} ` + String(e).slice(0, 140)));
    phones.push(p);
  }
  // marcatori: se una pagina venisse ricaricata sparirebbero
  await page.evaluate(() => (window.__smoke = 'host'));
  for (const p of phones) await p.page.evaluate(() => (window.__smoke = 'phone'));
  console.log(`stanza ${code}, 5 telefoni pronti`);

  await hostEval(page, (gm, id) => gm.selectMinigame(id), SEQ[0]);
  await sleep(300);
  await page.keyboard.press('Enter');

  for (let i = 0; i < SEQ.length; i++) {
    const id = SEQ[i];
    // rullo + intro naturali
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_ROULETTE', 60000, `rullo ${id}`);
    let s = await hostSnapshot(page);
    check(s.active.length === 1 && s.active[0] === 'RouletteScene', `[${i + 1}/${SEQ.length}] rullo: una sola scena (${s.active.join(',')}), estratto ${s.pending}`);
    check(s.pending === id, `[${i + 1}] il rullo ha estratto ${id}`);
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 40000, `PLAYING ${id}`);
    await sleep(id === 'fps' || id === 'kart3d' ? 5000 : 3500);
    s = await hostSnapshot(page);
    check(s.active.length === 1 && s.active[0] === id, `[${i + 1}] ${id} in gioco: scena attiva ${s.active.join(',')}`);
    const views = [];
    for (const p of phones) views.push((await phoneView(p.page)).h1 || '(canvas/gioco)');
    check(!views.some((h) => /Attendi|Riconnessione|PROSSIMO|TERMINATO/.test(h)), `[${i + 1}] i 5 telefoni mostrano il controller di ${id}`);
    // fine del minigioco
    await hostEval(page, (gm) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ctx.players.map((p, k) => ({ playerId: p.id, placement: k + 1, score: 10 - k })) });
    });
    // il gioco successivo si sceglie tra un round e l'altro (vale UN round); risultati → classifica → rullo sono NATURALI
    await until(async () => ['MINIGAME_FINISHED', 'ROUND_RESULTS'].includes((await hostSnapshot(page)).phase), 10000, 'fine gioco');
    if (i + 1 < SEQ.length) await hostEval(page, (gm, nid) => gm.selectMinigame(nid), SEQ[i + 1]);
    const seen = [];
    let last = '';
    await until(async () => {
      const sn = await hostSnapshot(page);
      if (sn.phase !== last) {
        last = sn.phase;
        seen.push(`${sn.phase}(${sn.active.join('+')})`);
      }
      return i + 1 < SEQ.length ? sn.phase === 'MINIGAME_ROULETTE' : sn.phase === 'LEADERBOARD' || sn.phase === 'GLOBAL_LEADERBOARD';
    }, 60000, `dopo ${id}`);
    const badScene = seen.filter((x) => x.split('(')[1].replace(')', '').split('+').length !== 1);
    check(badScene.length === 0, `[${i + 1}] dopo ${id}: sempre una sola scena → ${seen.join(' > ')}`);
    const overlays = (await hostSnapshot(page)).overlays;
    check(overlays === 0, `[${i + 1}] nessun canvas 3D residuo`);
  }

  // nessuna pagina ricaricata
  check((await page.evaluate(() => window.__smoke)) === 'host', 'host mai ricaricato');
  for (const p of phones) check((await p.page.evaluate(() => window.__smoke)) === 'phone', `telefono ${p.name} mai ricaricato`);
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  crashed = true;
  process.exitCode = 2;
} finally {
  await browser.close();
}
console.log(crashed ? '\n❌ SMOKE INTERROTTO (errore sopra)' : fails ? `\n❌ ${fails} controlli falliti` : '\n✅ SMOKE 5 GIOCATORI OK');
