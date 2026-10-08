// GALLERIA PERSONAGGI (?characters=1, solo dev/debug): si apre, mostra i 5 personaggi, cambia vista (COLORI / SILHOUETTE / SQUADRE)
// e stato (IDLE, RUN, JUMP, DASH, HIT, STUN, ABILITY, VICTORY, DEFEAT, BARK) senza errori; screenshot a 1366x768 e 1920x1080 in
// e2e-shots/characters/ (da guardare: in SILHOUETTE i cinque devono distinguersi dalla forma). Senza ?characters=1 non compare.
//   node scripts/e2e/character-gallery.mjs            (SHOTS=0 per non salvare le immagini)
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CHROME, HOST_URL, sleep } from './lib.mjs';

let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const OUT = 'e2e-shots/characters';
const SHOTS = process.env.SHOTS !== '0';
if (SHOTS) mkdirSync(OUT, { recursive: true });

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${w},${h}`],
    defaultViewport: { width: w, height: h }
  });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
    await page.goto(`${HOST_URL}?characters=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gallery?.ready === true, { timeout: 30000 });
    await sleep(1500);
    check((await page.evaluate(() => window.__gallery.count())) === 5, `${w}x${h}: 5 personaggi nella galleria`);
    const shot = async (name) => {
      if (SHOTS) await page.screenshot({ path: `${OUT}/${w}x${h}-${name}.png` });
    };
    for (const mode of ['colors', 'silhouette', 'teams']) {
      await page.evaluate((m) => window.__gallery.setMode(m), mode);
      await sleep(900);
      check((await page.evaluate(() => window.__gallery.count())) === 5, `${w}x${h}: vista ${mode}`);
      await shot(`${mode}-idle`);
    }
    await page.evaluate(() => window.__gallery.setMode('colors'));
    const meshes0 = await page.evaluate(() => window.__gallery.meshes());
    for (const st of ['RUN', 'JUMP', 'DASH', 'HIT', 'STUN', 'ABILITY', 'VICTORY', 'DEFEAT', 'BARK', 'IDLE']) {
      await page.evaluate((s) => window.__gallery.setState(s), st);
      await sleep(st === 'ABILITY' || st === 'BARK' ? 350 : st === 'VICTORY' || st === 'DEFEAT' ? 1300 : 700);
      await shot(`state-${st.toLowerCase()}`);
    }
    // ricostruire le viste non deve accumulare mesh (dispose completo)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__gallery.setMode('silhouette'));
      await page.evaluate(() => window.__gallery.setMode('colors'));
    }
    await sleep(300);
    const meshes1 = await page.evaluate(() => window.__gallery.meshes());
    check(meshes1 <= meshes0, `${w}x${h}: cambiare vista non accumula mesh (${meshes0} → ${meshes1})`);
    // GOBLIN TRIPO (pilota, solo DEV): il selettore OLD/NEW vive nella stessa galleria, stesso posto e stessa luce.
    // Default = OLD (nessuna istanza importata); NEW = modello importato pronto, con la clip run.001 e 65 ossa.
    check(
      await page.evaluate(() => window.__gallery.goblins().every((g) => g === null)),
      `${w}x${h}: GOBLIN OLD di default (modello procedurale, nessuna istanza importata)`
    );
    await page.evaluate(() => window.__gallery.setGoblin('new'));
    await page.waitForFunction(() => {
      const g = window.__gallery.goblins()[0];
      return !!g && (g.state === 'ready' || g.state === 'error');
    }, { timeout: 60000 });
    const gNew = await page.evaluate(() => window.__gallery.goblins()[0]);
    check(gNew?.state === 'ready' && gNew?.bones === 65 && gNew?.clips===36 && gNew?.activeTracks===195 && gNew?.animator?.name==='goblin.idle', `${w}x${h}: GOBLIN NEW importato (65 ossa, 36 clip, idle reale, 195 tracce)`);
    await shot('goblin-new');
    await page.evaluate(() => window.__gallery.setGoblin('old'));
    await sleep(500);
    check(
      await page.evaluate(() => window.__gallery.goblins().every((g) => g === null)),
      `${w}x${h}: GOBLIN torna al procedurale dopo lo switch`
    );
    check(errs.length === 0, `${w}x${h}: nessun errore${errs.length ? ' ' + errs.join(' | ') : ''}`);
    // senza ?characters=1 la galleria non c'e'
    const page2 = await browser.newPage();
    await page2.goto(HOST_URL, { waitUntil: 'load' });
    await sleep(2500);
    check(!(await page2.evaluate(() => !!document.getElementById('char-gallery'))), `${w}x${h}: senza ?characters=1 la galleria non compare`);
  } finally {
    await browser.close();
  }
}
console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
