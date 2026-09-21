// RICONNESSIONE: il telefono chiude il browser e lo riapre (stessa identità salvata) durante rullo, gioco e risultati;
// e un telefono che cade DURANTE un minigioco non blocca il round.   node scripts/e2e/reconnect.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep, CTRL_URL } from './lib.mjs';

const browser = await launch();
const errs = [];
let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 3; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  const ids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'reaction');
  await sleep(300);
  await page.keyboard.press('Enter');

  /** Chiude la pagina del telefono e riapre un controller NUOVO nello stesso profilo (localStorage = identità). */
  const reopen = async (i) => {
    const old = phones[i];
    await old.page.close();
    await sleep(600);
    const np = await old.ctx.newPage();
    await np.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
    np.on('pageerror', (e) => errs.push(`PHONE${i + 1} ` + String(e).slice(0, 160)));
    await np.goto(`${CTRL_URL}?room=${code}`, { waitUntil: 'load' });
    phones[i] = { ...old, page: np };
    return np;
  };

  // 1) durante il RULLO
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_ROULETTE') await sleep(200);
  await sleep(1500);
  let np = await reopen(0);
  await sleep(2500);
  let v = await phoneView(np);
  check(/PROSSIMO GIOCO|BOTTA AL VOLO|Riconnessione/.test(v.h1), `riaperto nel rullo: "${v.h1}"`);
  let players = await hostEval(page, (gm) => gm.state.players.map((p) => ({ id: p.id, name: p.displayName, connected: p.connected })));
  check(players.length === 3 && new Set(players.map((p) => p.name)).size === 3, `nessun giocatore duplicato (${players.map((p) => p.name).join(', ')})`);
  check(players.every((p) => ids.includes(p.id)), 'stessi playerId di prima');
  check(players.find((p) => p.id === ids[0])?.connected === true, 'P1 risulta di nuovo connesso');

  // 2) durante il GIOCO
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(300);
  await sleep(3000);
  np = await reopen(1);
  await sleep(2500);
  v = await phoneView(np);
  check(/BOTTA AL VOLO/.test(v.h1), `riaperto in gioco: controller giusto ("${v.h1}")`);
  players = await hostEval(page, (gm) => gm.state.players.map((p) => ({ id: p.id, connected: p.connected })));
  check(players.length === 3 && players.every((p) => p.connected), 'tutti e 3 connessi, nessun duplicato');

  // 3) un telefono CADE e NON torna: il round finisce comunque, risultati con tutti e 3 i giocatori
  await phones[2].page.close();
  // il server nota la chiusura del socket quando può (con la macchina carica anche >1s): polling invece di uno sleep fisso
  let st = [];
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    st = await hostEval(page, (gm) => gm.state.players.map((p) => p.connected));
    if (st.filter((x) => !x).length >= 1) break;
  }
  check(st.filter((x) => !x).length === 1, 'un telefono risulta offline');
  await hostEval(page, (gm) => {
    const ctx = gm.minigameContext;
    ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 5 - i })) });
  });
  while ((await hostSnapshot(page)).phase !== 'ROUND_RESULTS') await sleep(300);
  const res = await hostEval(page, (gm) => gm.state.lastResults.results.map((r) => r.placement));
  check(res.length === 3 && new Set(res).size === 3, `il round si chiude con 3 placement unici (${JSON.stringify(res)})`);
  const s = await hostSnapshot(page);
  check(s.active.length === 1 && s.active[0] === 'ResultsScene', 'host sui risultati, una sola scena');

  // 4) riapertura durante i RISULTATI
  np = await reopen(0);
  await sleep(2500);
  v = await phoneView(np);
  check(/ROUND TERMINATO|PROSSIMO/.test(v.h1), `riaperto nei risultati: "${v.h1}"`);
  check(errs.length === 0, `nessun errore ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
