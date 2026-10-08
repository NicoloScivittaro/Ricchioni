// BOTTE SUL CORNICIONE — fotografie dei momenti chiave nel laboratorio (?fighter=1): stage, HUD, KO, indicatori fuori quadro,
// le 5 abilita', hitbox. Serve a GUARDARE il gioco (e2e-shots/fighter/lab-*.png).  node scripts/e2e/fighter-lab-shots.mjs
import { launch, HOST_URL, sleep } from './lib.mjs';
import { makeCheck } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
const OUT = 'e2e-shots/fighter';
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push(String(e.stack ?? e).slice(0, 300)));
  await page.goto(`${HOST_URL}?fighter=1&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__fighterLab && window.__fighterLab.game()?.phase === 'countdown', { timeout: 60000 });
  const L = (fn, ...a) => page.evaluate(fn, ...a);
  const lab = (code) => page.evaluate(code);
  const waitPlaying = () => page.waitForFunction(() => window.__fighterLab.game()?.phase === 'playing', { timeout: 30000 });
  const shot = async (name) => page.screenshot({ path: `${OUT}/lab-${name}.png` });
  const key = async (code, ms = 120) => {
    await page.keyboard.down(code);
    await sleep(ms);
    await page.keyboard.up(code);
  };
  const restart = async (n, c) => {
    await L((n, c) => window.__fighterLab.restart(n, c), n, c);
    await page.waitForFunction(() => window.__fighterLab.game()?.phase === 'countdown', { timeout: 30000 });
    await waitPlaying();
    await sleep(400);
  };

  // 1. cinque personaggi allo spawn, HUD completo
  await restart(5, 'goblin');
  await shot('01-spawn-5p');
  // 2. hitbox/hurtbox/limiti KO
  await L(() => window.__fighterLab.game().setShowBoxes(true));
  await L(() => { const f = window.__fighterLab.game().sim.fighters; f[1].x = -8.8; f[0].x = -10; f[0].facing = 1; });
  await page.keyboard.down('ArrowRight');
  await key('KeyX', 200);
  await page.keyboard.up('ArrowRight');
  await sleep(120);
  await shot('02-hitbox');
  await L(() => window.__fighterLab.game().setShowBoxes(false));
  // 3. KO a destra dal limite + indicatore fuori quadro
  await restart(3, 'judoka');
  await L(() => window.__fighterLab.launch(1, 38, 8));
  await sleep(500);
  await shot('03-fuori-quadro-indicatore');
  await L(() => window.__fighterLab.koEdge(1));
  await sleep(220);
  await shot('04-ko');
  // 4. Goblin: rimonta (fuori dal palco, RB-equivalente = tasto B)
  await restart(3, 'goblin');
  await L(() => window.__fighterLab.forceOffstage(0));
  await page.keyboard.down('ArrowLeft');
  await key('KeyB', 160);
  await sleep(220);
  await shot('05-goblin-rimonta');
  await page.keyboard.up('ArrowLeft');
  // 5. Buttafuori: sparisce + marker di ritorno
  await restart(3, 'buttafuori');
  await page.keyboard.down('ArrowRight');
  await key('KeyB', 160);
  await sleep(700);
  await shot('06-buttafuori-telegraph');
  await page.keyboard.up('ArrowRight');
  // 6. Judoka: postura e counter
  await restart(3, 'judoka');
  await L(() => { const f = window.__fighterLab.game().sim.fighters; f[1].x = f[0].x + 1.6; f[1].facing = -1; });
  await key('KeyB', 160);
  await L(() => { const w = window.__fighterLab.game().sim; const a = w.fighters[1]; a.facing = -1; a.attack = { move: { id: 'sH', kind: 'heavy', air: false, dir: 's', startup: 0.02, active: 0.2, recovery: 0.4, dmg: 13, bkb: 11, kbs: 0.21, angle: 36, hit: { x: 1.9, y: 1.25, w: 2.4, h: 1.5 }, impact: 'HEAVY', anim: 'smash' }, t: 0.03, hit: new Set(), phase: 1 }; });
  await sleep(160);
  await shot('07-judoka-counter');
  // 7. Dottore: peso tagliato
  await restart(3, 'dottore');
  await key('KeyB', 160);
  await sleep(300);
  await shot('08-dottore-peso');
  // 8. Ciro: BONIFICO?
  await restart(3, 'ciro');
  await L(() => window.__fighterLab.koEdge(0));
  await sleep(260);
  await shot('09-ciro-bonifico-finestra');
  await key('KeyB', 160);
  await sleep(500);
  await shot('10-ciro-pagamento-pendente');
  // 9. alta percentuale
  await restart(2, 'goblin');
  await L(() => { window.__fighterLab.setPercent(0, 165); window.__fighterLab.setPercent(1, 112); });
  await sleep(500);
  await shot('11-percentuali-alte');
  check(errs.length === 0, `nessun errore di pagina ${errs.join(' | ')}`);
} catch (e) {
  console.log('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails ? `❌ ${st.fails} falliti` : '✅ foto scattate in e2e-shots/fighter/lab-*.png');
process.exit(st.fails ? 1 : 0);
