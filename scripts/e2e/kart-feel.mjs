// RIBALTATI — game feel con input REALI dai telefoni (pulsanti del controller): accelera, deriva, carica il mini-turbo,
// rilascia (boost). Verifica che la derapata carichi i livelli e il boost parta; con OUT=cartella salva gli screenshot
// dell'host (minimappa, scintille colorate, barra di carica, kart che scivola, FOV del boost).
//   OUT=cartella node scripts/e2e/kart-feel.mjs
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
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 2; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'kart3d');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  const probe = (fn, arg) => hostEval(page, fn, arg);
  const state = () =>
    probe((gm) => {
      const g = gm.game.scene.getScene('kart3d')?.game3d;
      if (!g) return null;
      const k = [...g.karts.values()][0];
      return { phase: g.race.phase, t: g.race.raceTime, speed: k.speed, drifting: k.drifting, charge: k.driftCharge, boost: k.boostTimer, dir: k.driftDir };
    });
  const waitRace = async (sec) => {
    const t0 = (await state())?.t ?? 0;
    for (let i = 0; i < 400; i++) {
      await sleep(120);
      const s = await state();
      if (s && s.t - t0 >= sec) return s;
    }
    return state();
  };
  const press = (name, down) =>
    phones[0].page.evaluate(
      (n, d) => {
        const el = document.querySelector(`.ctl-${n}`);
        el?.dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 3 }));
        return !!el;
      },
      name,
      down
    );
  // aspetta la partenza
  for (let i = 0; i < 200; i++) {
    const s0 = await state();
    if (s0 && s0.phase === 'racing') break;
    await sleep(150);
  }
  // porta il kart all'ingresso di una curva a sinistra vera (~322 m) a velocita' di crociera
  await probe((gm) => {
    const g = gm.game.scene.getScene('kart3d').game3d;
    const k = [...g.karts.values()][0];
    k.distance = g.spline.wrap(322);
    k.lateral = 0;
    k.speed = 36;
    k.absHeading = g.trackAngleAt(k.distance);
    // "pilota automatico" ad alta frequenza (30 ms, dentro la pagina): tiene il kart in pista e in velocita' mentre i pulsanti
    // REALI dei telefoni (sinistra + DRIFT) restano premuti; la fisica della derapata (carica, livelli, boost) gira vera.
    window.__auto = setInterval(() => {
      k.lateral = 0;
      k.speed = Math.max(k.speed, 34);
      k.absHeading = g.trackAngleAt(k.distance) + (k.drifting ? -0.25 : 0);
    }, 30);
  });
  const found = await press('up', true);
  check(found, 'pulsante ACCELERA presente sul telefono');
  await waitRace(0.5);
  let s = await state();
  check(s.speed > 25, `il kart va veloce con l'input reale del telefono (${s.speed.toFixed(1)} u/s)`);
  if (OUT) await page.screenshot({ path: path.join(OUT, 'kart-corsa.png') });

  // deriva a SINISTRA (la curva e' a sinistra): DRIFT + sterzo, carica il mini-turbo
  await press('left', true);
  await press('drift', true);
  let maxCharge = 0;
  let sawDrift = false;
  let shot = false;
  for (let i = 0; i < 70; i++) {
    await sleep(140);
    s = await state();
    if (s.drifting) sawDrift = true;
    maxCharge = Math.max(maxCharge, s.charge);
    if (OUT && !shot && s.drifting && s.charge > 1.25) {
      await page.screenshot({ path: path.join(OUT, 'kart-drift.png') });
      shot = true;
    }
    if (shot) break;
  }
  check(sawDrift, 'DRIFT + sterzo: il kart deriva (input reali)');
  check(maxCharge >= 0.55, `la derapata carica il mini-turbo (carica ${maxCharge.toFixed(2)}s, livello 1 a 0.55s)`);
  // rilascia: parte il boost
  await press('drift', false);
  await press('left', false);
  let maxBoost = 0;
  let boostShot = false;
  for (let i = 0; i < 20; i++) {
    await sleep(100);
    s = await state();
    maxBoost = Math.max(maxBoost, s.boost);
    if (OUT && !boostShot && s.boost > 0) {
      await page.screenshot({ path: path.join(OUT, 'kart-boost.png') });
      boostShot = true;
    }
  }
  check(maxBoost > 0, `al rilascio parte il boost del mini-turbo (${maxBoost.toFixed(2)}s)`);
  await press('up', false);
  await probe(() => clearInterval(window.__auto));
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  if (OUT) console.log('   screenshot in', OUT);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
