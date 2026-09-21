// VISIVO — nitidezza del testo Phaser (risoluzione del Text in base a DPR e dimensione a schermo), rullo, distintivi di squadra.
//   OUT=cartella node scripts/e2e/visual-polish.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep, HOST_URL } from './lib.mjs';

const OUT = process.env.OUT ?? '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};

async function textRes(width, height, dpr, query = '') {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  await page.goto(HOST_URL + query, { waitUntil: 'load' });
  await page.waitForFunction(
    async () => {
      try {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
        const { game: gm } = await import(url);
        const sc = gm.game?.scene.getScene('LobbyScene');
        return !!sc && sc.scene.isActive() && sc.children.list.some((o) => o.type === 'Text');
      } catch {
        return false;
      }
    },
    { timeout: 30000 }
  );
  await sleep(500);
  const res = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
    const { game: gm } = await import(url);
    const texts = gm.game.scene.getScene('LobbyScene').children.list.filter((o) => o.type === 'Text');
    const c = document.querySelector('#app canvas').getBoundingClientRect();
    return { resolutions: [...new Set(texts.map((t) => t.style.resolution))], n: texts.length, shown: Math.round(c.width) };
  });
  if (OUT) await page.screenshot({ path: path.join(OUT, `lobby-${width}x${height}-dpr${dpr}${query ? '-textres' : ''}.png`) });
  await page.close();
  return res;
}

try {
  // 1. risoluzione del testo: 720p normale = 1 (nessun costo); 1080p, 4K e schermi HiDPI = 2
  let r = await textRes(1280, 720, 1);
  check(r.resolutions.length === 1 && r.resolutions[0] === 1, `monitor 720p (canvas ${r.shown}px, dpr 1): testo a risoluzione 1, nessun costo (${JSON.stringify(r.resolutions)}, ${r.n} testi)`);
  r = await textRes(1920, 1080, 1);
  check(r.resolutions.length === 1 && r.resolutions[0] === 2, `TV 1080p (canvas ${r.shown}px): testo a risoluzione 2 (${JSON.stringify(r.resolutions)})`);
  r = await textRes(1280, 720, 2);
  check(r.resolutions.length === 1 && r.resolutions[0] === 2, `schermo HiDPI (dpr 2): testo a risoluzione 2 (${JSON.stringify(r.resolutions)})`);
  r = await textRes(1920, 1080, 2);
  check(r.resolutions.length === 1 && r.resolutions[0] === 2, `4K/HiDPI (dpr 2, 1080 css): tetto a 2 (${JSON.stringify(r.resolutions)})`);
  r = await textRes(1920, 1080, 1, '?textres=1');
  check(r.resolutions[0] === 1, 'override ?textres=1 per confronto');

  // 2. rullo: schermata mentre gira e dopo il reveal
  const { page, code } = await createRoomOnHost(browser);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await addPhone(browser, code, 'P1', 0);
  await addPhone(browser, code, 'P2', 1);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 100; i++) {
    const on = await hostEval(page, (gm) => gm.game.scene.getScene('RouletteScene')?.scene.isActive());
    if (on) break;
    await sleep(150);
  }
  await sleep(1400);
  if (OUT) await page.screenshot({ path: path.join(OUT, 'rullo-giro.png') });
  let revealed = false;
  for (let i = 0; i < 400 && !revealed; i++) {
    await sleep(40);
    revealed = await hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('RouletteScene');
      return !!sc && sc.children.list.some((o) => o.type === 'Text' && /PROSSIMO GIOCO/.test(o.text));
    });
  }
  if (OUT) await page.screenshot({ path: path.join(OUT, 'rullo-reveal.png') });
  check(revealed, 'il rullo arriva al reveal ("IL PROSSIMO GIOCO E\'...")');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  if (OUT) console.log('   screenshot in', OUT);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
