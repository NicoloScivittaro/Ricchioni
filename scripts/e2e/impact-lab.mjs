// IMPACT LAB (?impact=1, solo dev/debug): per ogni azione (Arena spinta, Dodgeball colpo, Calcio tiro/tackle, Pallavolo smash,
// Kart boost/urto, FPS con tutte le armi) fotografa al rallentatore 0.25x i tre momenti ANTICIPO / IMPATTO / RECUPERO in
// e2e-shots/impact/ (da guardare). Controlla che l'impatto avvenga all'istante previsto, che non ci siano errori e che senza
// ?impact=1 il lab non esista.        node scripts/e2e/impact-lab.mjs        (SHOTS=0 senza immagini)
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CHROME, HOST_URL, sleep } from './lib.mjs';

let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const OUT = 'e2e-shots/impact';
const SHOTS = process.env.SHOTS !== '0';
if (SHOTS) mkdirSync(OUT, { recursive: true });
// istante (tempo del lab) dell'impatto di ogni scenario: deve coincidere con quello che il lab registra
const PLAN = [
  ['arena', 0.52],
  ['dodgeball', 0.62],
  ['soccerShot', 0.9],
  ['soccerTackle', 0.55],
  ['volley', 0.62],
  ['kartBoost', 0.9],
  ['kartCrash', 0.6]
];
const WEAPONS = ['mitraglia', 'spaccatutto', 'laser', 'raffica', 'bombarda', 'sparapiselli'];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1366,768', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1366, height: 768 }
});
try {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack ?? e).slice(0, 300)));
  await page.goto(`${HOST_URL}?impact=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lab?.ready === true, { timeout: 30000 });
  await sleep(800);
  await page.evaluate(() => window.__lab.setSpeed(0.25));
  const waitT = async (target, max = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < max) {
      if ((await page.evaluate(() => window.__lab.time())) >= target) return true;
      await sleep(15);
    }
    return false;
  };
  const shoot = async (name) => SHOTS && page.screenshot({ path: `${OUT}/${name}.png` });

  for (const [scn, imp] of PLAN) {
    await page.evaluate((s) => window.__lab.run(s), scn);
    await waitT(imp - 0.12);
    await shoot(`${scn}-1-anticipo`);
    await waitT(imp + 0.03);
    await shoot(`${scn}-2-impatto`);
    await waitT(imp + 0.4);
    await shoot(`${scn}-3-recupero`);
    const got = await page.evaluate(() => window.__lab.impactAt());
    check(got >= 0 && Math.abs(got - imp) < 0.06, `${scn}: impatto all'istante previsto (${got.toFixed(2)} s, atteso ${imp})`);
  }
  for (const w of WEAPONS) {
    await page.evaluate((x) => {
      window.__lab.setWeapon(x);
      window.__lab.run('fps');
    }, w);
    const first = w === 'bombarda' ? 0.25 + 8 / 14 : 0.25;
    await waitT(0.2);
    await shoot(`fps-${w}-1-anticipo`);
    await waitT(0.29);
    await shoot(`fps-${w}-2-sparo`);
    await waitT(first + 0.04);
    await shoot(`fps-${w}-3-impatto`);
    await waitT(1.75);
    await shoot(`fps-${w}-4-kill`);
    const got = await page.evaluate(() => window.__lab.impactAt());
    check(got > 0, `FPS ${w}: sparo, colpo confermato e kill riprodotti (ultimo impatto ${got.toFixed(2)} s)`);
  }
  check(errs.length === 0, `nessun errore di pagina${errs.length ? ' ' + errs.join(' | ') : ''}`);
  const page2 = await browser.newPage();
  await page2.goto(HOST_URL, { waitUntil: 'load' });
  await sleep(2500);
  check(!(await page2.evaluate(() => !!document.getElementById('impact-lab'))), 'senza ?impact=1 il lab non compare');
} finally {
  await browser.close();
}
console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
