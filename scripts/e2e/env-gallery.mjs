// GALLERIA AMBIENTI (?environments=1): screenshot di ogni ambiente (vista di gioco, panoramica, scala di grigi) + conteggi.
//   OUT=e2e-shots/gallery VIEWPORT=1920x1080 IDS=arena,kart1 VIEWS=game,overview GRAY=1 node scripts/e2e/env-gallery.mjs
import { launch, HOST_URL, sleep } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.env.OUT ?? 'e2e-shots/gallery');
const VIEWS = (process.env.VIEWS ?? 'game').split(',');
const QUALITY = process.env.QUALITY ?? 'medium';
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const errs = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 300));
  });
  await page.goto(`${HOST_URL}?environments=1&quality=${QUALITY}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__envGallery, { timeout: 60000 });
  const ids = process.env.IDS ? process.env.IDS.split(',') : await page.evaluate(() => window.__envGallery.ids());
  const all = {};
  for (const id of ids) {
    for (const v of VIEWS) {
      await page.evaluate((a, b) => window.__envGallery.show(a, b), id, v);
      await sleep(1600);
      const st = await page.evaluate(() => window.__envGallery.stats());
      all[`${id}-${v}`] = st;
      await page.screenshot({ path: path.join(OUT, `${id}-${v}.png`) });
      if (process.env.GRAY) {
        await page.evaluate(() => window.__envGallery.gray(true));
        await sleep(400);
        await page.screenshot({ path: path.join(OUT, `${id}-${v}-gray.png`) });
        await page.evaluate(() => window.__envGallery.gray(false));
      }
      console.log(id, v, JSON.stringify(st));
    }
  }
  fs.writeFileSync(path.join(OUT, `stats-${QUALITY}.json`), JSON.stringify(all, null, 2));
} finally {
  await browser.close();
}
console.log(errs.length ? `ERRORI:\n${errs.join('\n')}` : 'nessun errore');
process.exit(errs.length ? 1 : 0);
