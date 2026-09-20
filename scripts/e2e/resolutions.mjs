// LEGGIBILITÀ DELL'HOST A RISOLUZIONI DIVERSE (PC/TV): screenshot di rullo e di un gioco 3D con HUD a 1366x768, 1920x1080, 2560x1440.
// Verifica automatica: il canvas 3D copre tutto il viewport e l'HUD ha un'altezza del testo proporzionale allo schermo.
//   node scripts/e2e/resolutions.mjs            GAME=arena|soccer|kart3d|dodgeball|volleyball   OUT=cartella
import path from 'node:path';
import fs from 'node:fs';

const GAME = process.env.GAME ?? 'arena';
const OUT = process.env.OUT ?? path.resolve('e2e-shots/resolutions');
fs.mkdirSync(OUT, { recursive: true });
const IS_3D = ['arena', 'dodgeball', 'soccer', 'volleyball', 'kart3d'].includes(GAME);
const PLAYERS = Number(process.env.PLAYERS ?? 2);
const SIZES = (process.env.SIZES ?? '1366x768,1920x1080,2560x1440').split(',');
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};

for (const size of SIZES) {
  process.env.VIEWPORT = size;
  const { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } = await import('./lib.mjs');
  const browser = await launch();
  try {
    const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: Math.max(0, PLAYERS - 2) });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    for (let i = 0; i < PLAYERS; i++) await addPhone(browser, code, `P${i + 1}`, i);
    await hostEval(page, (gm, id) => gm.selectMinigame(id), GAME);
    await sleep(300);
    await page.keyboard.press('Enter');
    while ((await hostSnapshot(page)).phase !== 'MINIGAME_ROULETTE') await sleep(200);
    await sleep(2800);
    await page.screenshot({ path: path.join(OUT, `${size}-roulette.png`) });
    while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
    let g = null;
    for (let i = 0; IS_3D && i < 120 && !g; i++) {
      await sleep(300);
      g = await hostEval(page, (gm, id) => {
        const s = gm.game.scene.getScene(id)?.game3d;
        return s ? { w: s.engine.getRenderWidth(), h: s.engine.getRenderHeight(), scaling: s.engine.getHardwareScalingLevel() } : null;
      }, GAME);
    }
    await sleep(IS_3D ? 6000 : 4500); // fine del countdown: HUD di gioco visibile
    await page.screenshot({ path: path.join(OUT, `${size}-${GAME}${PLAYERS !== 2 ? '-' + PLAYERS + 'p' : ''}.png`) });
    const [vw, vh] = size.split('x').map(Number);
    const box = await page.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')].find((x) => x.style.zIndex === '10000');
      const r = c?.getBoundingClientRect();
      return r ? { w: Math.round(r.width), h: Math.round(r.height), sx: document.documentElement.scrollWidth - innerWidth, sy: document.documentElement.scrollHeight - innerHeight } : null;
    });
    console.log(`   ${size}: render ${g?.w}x${g?.h} (scala ${g?.scaling}), canvas CSS ${box?.w}x${box?.h}`);
    if (IS_3D) check(!!box && box.w === vw && box.h === vh, `${size}: il canvas 3D copre tutto lo schermo`);
    check(box === null ? !IS_3D : box.sx <= 1 && box.sy <= 1, `${size}: nessuno scroll della pagina`);
    check(errs.length === 0, `${size}: nessun errore di pagina`);
  } catch (e) {
    fails++;
    console.log(`❌ ${size}: ${String(e).slice(0, 200)}`);
  } finally {
    await browser.close();
  }
}
console.log(fails ? `\n${fails} problemi (screenshot in ${OUT})` : `\n✅ ok (screenshot in ${OUT})`);
process.exitCode = fails ? 1 : 0;
