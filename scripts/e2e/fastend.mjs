// FINE "ACCELERATA" dei giochi 3D lenti in ambiente headless: forza la condizione di fine REALE del gioco (fine tempo)
// e verifica che il percorso di chiusura (festeggiamenti → risultati → finish → cambio scena) sia corretto.
//   GAME=soccer | kart3d | volleyball
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';
const GAME = process.env.GAME ?? 'soccer';
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: GAME === 'volleyball' ? 1 : 0 });
  page.on('pageerror', (e) => errs.push('HOST pageerror ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('HOST console ' + m.text().slice(0, 200)); });
  const n = GAME === 'volleyball' ? 3 : 2;
  const phones = [];
  for (let i = 0; i < n; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), GAME);
  await sleep(300);
  await page.keyboard.press('Enter');
  await hostEval(page, (gm) => { gm.__f = 0; const o = gm.finishMinigame.bind(gm); gm.finishMinigame = (r, id) => { gm.__f++; gm.__last = r; return o(r, id); }; });
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(300);
  await sleep(3000);
  // aspetta che il gioco sia davvero in fase di gara/partita
  await sleep(GAME === 'kart3d' ? 8000 : 12000);
  const t0 = Date.now();
  await hostEval(page, (gm, id) => {
    const g = gm.game.scene.getScene(id).game3d;
    if (id === 'soccer') { g.goldenTime = 0.05; g.matchTime = 0.05; }          // fine tempo (+golden goal/tiebreak)
    else if (id === 'kart3d') { g.race.raceTime = 1e6; }                        // limite di tempo raggiunto → endRace
    else if (id === 'volleyball') { g.ball.z = 3; g.redScore = 4; g.blueScore = 0; g.scorePoint(); } // 5° punto rosso (palla che cade nel campo blu)
  }, GAME);
  let s;
  while ((s = await hostSnapshot(page)).phase === 'MINIGAME_PLAYING' && Date.now() - t0 < 200000) await sleep(500);
  const calls = await hostEval(page, (gm) => gm.__f);
  const last = await hostEval(page, (gm) => gm.__last);
  await sleep(2000);
  s = await hostSnapshot(page);
  const ph = [];
  for (const p of phones) ph.push((await phoneView(p.page)).h1);
  console.log(`${GAME}: chiuso dopo ${((Date.now() - t0) / 1000).toFixed(0)}s · finish() ${calls} · placement ${JSON.stringify(last?.results?.map((r) => r.placement))} · host ${s.phase} ${JSON.stringify(s.active)} overlays=${s.overlays} · telefoni ${JSON.stringify(ph)}`);
  const ok = calls === 1 && last && new Set(last.results.map((r) => r.placement)).size === n && s.active.length === 1 && s.overlays === 0 && ph.every((h) => /ROUND TERMINATO|PROSSIMO/.test(h)) && errs.length === 0;
  console.log(ok ? '✅ percorso di fine corretto' : `❌ problema ${JSON.stringify(errs.slice(0, 3))}`);
  process.exitCode = ok ? 0 : 1;
} catch (e) { console.error('ERRORE', e); process.exitCode = 2; } finally { await browser.close(); }
