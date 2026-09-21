// RIBALTATI — segnali di pista: le curve importanti vengono trovate dalla spline, i cartelli compaiono prima di ognuna.
// Teletrasporta i kart (2 viewport) all'avvicinamento delle curve e, con OUT=cartella, salva gli screenshot dell'host.
//   OUT=cartella node scripts/e2e/kart-guides.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const OUT = process.env.OUT ?? '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  for (let i = 0; i < 2; i++) await addPhone(browser, code, `P${i + 1}`, i);
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'kart3d');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(300);
    ready = await hostEval(page, (gm) => !!gm.game.scene.getScene('kart3d')?.game3d);
  }
  const curves = await hostEval(page, async (gm) => {
    const { detectCurves } = await import('/src/minigames/kart-race/trackGuides.ts');
    const g = gm.game.scene.getScene('kart3d').game3d;
    return { L: g.spline.totalLength, curves: detectCurves(g.spline).map((c) => ({ s0: Math.round(c.s0), s1: Math.round(c.s1), dir: c.dir, deg: Math.round((c.angle * 180) / Math.PI) })) };
  });
  console.log(`   giro ${Math.round(curves.L)} m · curve trovate:`, curves.curves.map((c) => `${c.dir > 0 ? 'DX' : 'SX'} ${c.deg}° @${c.s0}-${c.s1}`).join(' | '));
  check(curves.curves.length >= 5, `l'algoritmo trova ${curves.curves.length} curve importanti`);
  check(curves.curves.some((c) => c.deg > 85), 'almeno un tornante (>85°) riconosciuto come "stretta"');
  check(curves.curves.every((c) => c.dir === -1), 'il circuito gira in senso antiorario: tutte le curve importanti sono a sinistra');

  if (OUT) {
    for (let i = 0; i < curves.curves.length; i += 2) {
      const a = curves.curves[i];
      const b = curves.curves[(i + 1) % curves.curves.length];
      await hostEval(
        page,
        (gm, arg) => {
          const g = gm.game.scene.getScene('kart3d').game3d;
          const ks = [...g.karts.values()];
          const put = (k, s) => {
            k.distance = g.spline.wrap(s) + g.spline.totalLength; // resta nel "giro 2": non altera classifica visibile
            k.lateral = 0;
            k.speed = 6;
            k.absHeading = g.trackAngleAt(g.spline.wrap(s));
            k.heading = 0;
          };
          put(ks[0], arg.a - 42);
          put(ks[1], arg.b - 42);
        },
        { a: a.s0, b: b.s0 }
      );
      await sleep(1600);
      await page.screenshot({ path: path.join(OUT, `guide-${i}.png`) });
    }
    console.log('   screenshot in', OUT);
  }
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
