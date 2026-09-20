// SPARATORIA: ogni giocatore deve nascere girato verso il centro della mappa (spawn equo), non verso il muro.
//   node scripts/e2e/fps-spawn.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const browser = await launch();
let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 4; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);

  const probe = () =>
    hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('fps');
      return (sc?.players ?? []).map((p) => ({ name: p.name, x: p.x, z: p.z, yaw: p.yaw }));
    });
  let ps = [];
  for (let i = 0; i < 40; i++) {
    await sleep(1000); // il telefono carica il motore 3D (lento in headless), riceve il primo stato e allinea la visuale
    ps = await probe();
    if (ps.length && ps.every((p) => Math.abs(p.yaw) > 1e-6)) break;
  }
  for (const ph of phones) console.log('   telefono', ph.name, JSON.stringify(await ph.page.evaluate(() => ({ canvas: document.querySelectorAll('canvas').length, txt: (document.getElementById('app')?.innerText ?? '').replace(/s+/g, ' ').slice(0, 60) }))));
  const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const rows = ps.map((p) => ({ ...p, want: Math.atan2(-p.x, -p.z), off: angDiff(p.yaw, Math.atan2(-p.x, -p.z)) }));
  for (const r of rows) console.log(`   ${r.name}: spawn (${r.x.toFixed(0)}, ${r.z.toFixed(0)}) yaw ${r.yaw.toFixed(2)} atteso ${r.want.toFixed(2)} (scarto ${r.off.toFixed(2)} rad)`);
  check(rows.length === 4, '4 giocatori in gioco');
  check(rows.every((r) => r.off < 0.1), 'tutti nascono girati verso il centro della mappa');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
