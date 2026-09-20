// FINE NATURALE di un minigioco (nessuna iniezione di finish): il gioco deve terminare DA SOLO, chiamare finish() UNA volta,
// non lanciare errori (host + telefoni) e riportare host/telefoni al flusso (risultati → rullo). GAME=arena|dodgeball|soccer|fps|kart3d|...
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';

const GAME = process.env.GAME ?? 'arena';
const MAX_MS = Number(process.env.MAX_MS ?? 300000);
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser);
  page.on('pageerror', (e) => errs.push('HOST pageerror ' + String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('HOST console ' + m.text().slice(0, 200));
  });
  const phones = [];
  for (let i = 0; i < 2; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`PHONE${i + 1} pageerror ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), GAME);
  await sleep(300);
  await page.keyboard.press('Enter');
  await hostEval(page, (gm) => {
    gm.__origFinish = gm.finishMinigame.bind(gm);
    gm.__finishCalls = 0;
    gm.finishMinigame = (r, id) => {
      gm.__finishCalls++;
      gm.__lastResults = r;
      return gm.__origFinish(r, id);
    };
  });
  const t0 = Date.now();
  let started = null;
  let ended = null;
  let phase = '';
  while (Date.now() - t0 < MAX_MS) {
    const s = await hostSnapshot(page);
    if (s.phase !== phase) {
      phase = s.phase;
      console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${phase} scene=${JSON.stringify(s.active)}`);
    }
    if (s.phase === 'MINIGAME_PLAYING' && started === null) started = Date.now();
    if (started && s.phase !== 'MINIGAME_PLAYING' && s.phase !== 'MINIGAME_INTRO' && s.phase !== 'MINIGAME_ROULETTE') {
      ended = Date.now();
      break;
    }
    await sleep(500);
  }
  const calls = await hostEval(page, (gm) => gm.__finishCalls);
  const last = await hostEval(page, (gm) => gm.__lastResults);
  await sleep(1500);
  const s2 = await hostSnapshot(page);
  const ph = [];
  for (const p of phones) ph.push((await phoneView(p.page)).h1);
  console.log(`\n${GAME}: fine naturale dopo ${started && ended ? ((ended - started) / 1000).toFixed(0) : 'NON TERMINATO'}s · finish() ${calls} volta/e · risultati ${JSON.stringify(last?.results?.map((r) => r.placement))}`);
  console.log(`host: ${s2.phase} ${JSON.stringify(s2.active)} · telefoni: ${JSON.stringify(ph)}`);
  const okEnd = !!ended;
  const okCalls = calls === 1;
  const okPlac = !!last && new Set(last.results.map((r) => r.placement)).size === last.results.length;
  const okScene = s2.active.length === 1 && s2.overlays === 0;
  const okPhones = ph.every((h) => /ROUND TERMINATO|PROSSIMO/.test(h));
  console.log(`${okEnd ? '✅' : '❌'} termina da solo · ${okCalls ? '✅' : '❌'} finish una volta · ${okPlac ? '✅' : '❌'} placement unici · ${okScene ? '✅' : '❌'} una sola scena/nessun overlay · ${okPhones ? '✅' : '❌'} telefoni fuori dal controller · ${errs.length === 0 ? '✅ nessun errore' : '❌ errori: ' + JSON.stringify(errs.slice(0, 3))}`);
  process.exitCode = okEnd && okCalls && okPlac && okScene && okPhones && errs.length === 0 ? 0 : 1;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
