// Overlay di debug (?debug=1 / F3), preset qualità 3D e precarico del gioco estratto durante il rullo.
//   node scripts/e2e/debug.mjs            (gioco 3D di prova: soccer; GAME=kart3d per cambiarlo)
process.env.HOST_URL = (process.env.HOST_URL ?? 'http://localhost:5173/') + '?debug=1';
const { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } = await import('./lib.mjs');

const GAME = process.env.GAME ?? 'soccer';
const CHUNK = { soccer: 'BabylonSoccerGame', kart3d: 'BabylonKartGame', arena: 'BabylonArenaGame', dodgeball: 'BabylonDodgeballGame', volleyball: 'BabylonVolleyballGame' }[GAME];

const browser = await launch();
let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};
const overlayText = (page) =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483000');
    return el ? { text: el.textContent, shown: el.style.display !== 'none' } : null;
  });
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 0 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 2; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));

  await hostEval(page, (gm, id) => gm.selectMinigame(id), GAME);
  await sleep(300);
  await page.keyboard.press('Enter'); // start

  // --- ROULETTE: il codice del gioco estratto deve già essere in download/caricato ---
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_ROULETTE') await sleep(150);
  await sleep(1500);
  const preloaded = await page.evaluate((chunk) => performance.getEntriesByType('resource').some((e) => e.name.includes(chunk)), CHUNK);
  const phaseNow = (await hostSnapshot(page)).phase;
  check(preloaded && phaseNow === 'MINIGAME_ROULETTE', `${CHUNK} precaricato durante il rullo (fase ${phaseNow})`);

  // --- overlay ---
  const ov = await overlayText(page);
  check(!!ov && ov.shown, 'overlay debug visibile con ?debug=1');
  console.log((ov?.text ?? '').split('\n').map((l) => '   | ' + l).join('\n'));
  check(/FPS \d+/.test(ov?.text ?? ''), 'mostra FPS/frame time');
  check(/fase MINIGAME_ROULETTE/.test(ov?.text ?? ''), 'mostra la fase');
  check(new RegExp(`gioco ${GAME}`).test(ov?.text ?? ''), 'mostra il minigioco');
  check(/ping \d+ms/.test(ov?.text ?? ''), 'mostra il ping');
  check(/giocatori 2/.test(ov?.text ?? ''), 'mostra i giocatori');
  check(/scene 1 /.test(ov?.text ?? ''), 'una sola scena attiva');

  // --- PLAYING: preset qualità applicato al motore ---
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  let q = null;
  for (let i = 0; i < 100 && !q; i++) {
    await sleep(300);
    q = await hostEval(page, (gm, id) => {
      const g = gm.game.scene.getScene(id)?.game3d;
      return g
        ? { scaling: g.engine.getHardwareScalingLevel(), shadows: g.scene.shadowsEnabled, particles: g.scene.particlesEnabled, glow: (g.scene.effectLayers ?? []).map((l) => l.isEnabled) }
        : null;
    }, GAME);
  }
  console.log('   qualità applicata:', JSON.stringify(q));
  check(!!q, 'motore 3D in esecuzione');
  const ov2 = await overlayText(page);
  const level = /qualità (\w+)/.exec(ov2?.text ?? '')?.[1];
  console.log('   livello:', level);
  if (level === 'low') check(q && q.scaling >= 1.5 && q.shadows === false && q.particles === false && q.glow.every((g) => g === false), 'LOW: risoluzione ridotta, niente ombre/particelle/glow');
  else if (level === 'medium') check(q && q.shadows === true && q.glow.every((g) => g === false), 'MEDIUM: ombre sì, glow no');
  else check(q && q.scaling >= 1 && q.shadows === true, 'HIGH: qualità piena');

  // --- F3 nasconde/mostra ---
  await page.keyboard.press('F3');
  await sleep(200);
  check((await overlayText(page))?.shown === false, 'F3 nasconde l’overlay');
  await page.keyboard.press('F3');
  await sleep(1300);
  check((await overlayText(page))?.shown === true, 'F3 lo rimostra');

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
