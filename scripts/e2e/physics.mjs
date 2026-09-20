// Smoke runtime dei valori di bilanciamento NEL GIOCO REALE (Babylon in Chrome headless):
//   GAME=kart3d     → tasto ACCELERA tenuto premuto sui telefoni: la velocità massima osservata deve essere ≈ KART_CONFIG.maxSpeed
//   GAME=volleyball → il battitore serve: velocità della palla = valori di config; il punto viene assegnato; nessun errore
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const GAME = process.env.GAME ?? 'kart3d';
const browser = await launch();
const errs = [];
try {
  const { page, code } = await createRoomOnHost(browser);
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 2; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`PHONE${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), GAME);
  await sleep(300);
  await page.keyboard.press('Enter');
  const t0 = Date.now();
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') {
    if (Date.now() - t0 > 40000) throw new Error('PLAYING non raggiunto');
    await sleep(300);
  }
  console.log(`${GAME}: partita iniziata`);

  if (GAME === 'kart3d') {
    // aspetta la gara vera (countdown finito)
    const g = () => hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('kart3d');
      const k = sc?.game3d;
      if (!k) return null;
      return { racing: k.race.phase, speeds: [...k.karts.values()].map((s) => s.speed), boosting: [...k.karts.values()].map((s) => s.boostTimer > 0) };
    });
    let st = null;
    const w0 = Date.now();
    while (!(st = await g()) || st.racing !== 'racing') {
      if (Date.now() - w0 > 60000) throw new Error('gara non partita');
      await sleep(300);
    }
    console.log('gara partita — tengo premuto ACCELERA sui 2 telefoni');
    for (const ph of phones) {
      const btn = await ph.page.$('[data-control="up"], button');
      const handles = await ph.page.$$('#ctl button, #app button');
      // trova il bottone "ACCELERA"
      let target = null;
      for (const h of handles) {
        const t = await h.evaluate((el) => el.textContent ?? '');
        if (/ACCELERA/.test(t)) target = h;
      }
      if (!target) throw new Error('bottone ACCELERA non trovato');
      const box = await target.boundingBox();
      await ph.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await ph.page.mouse.down();
    }
    let maxSpeed = 0;
    let maxBoost = 0;
    for (let i = 0; i < 40; i++) {
      const s = await g();
      if (s) {
        maxSpeed = Math.max(maxSpeed, ...s.speeds);
      }
      await sleep(500);
    }
    const cfg = await hostEval(page, () => import('/src/minigames/kart-race/kartPhysics.ts').then((m) => ({ max: m.KART_CONFIG.maxSpeed, accel: m.KART_CONFIG.accel })).catch(() => null));
    console.log(`velocità massima osservata: ${maxSpeed.toFixed(1)} u/s (config: ${JSON.stringify(cfg)})`);
    const ok = maxSpeed > 30 && maxSpeed <= 44.5 * 1.3;
    console.log(ok ? '✅ i kart accelerano e restano entro il tetto configurato' : '❌ velocità fuori attesa');
    process.exitCode = ok && !errs.length ? 0 : 1;
  } else {
    const g = () => hostEval(page, (gm) => {
      const k = gm.game.scene.getScene('volleyball')?.game3d;
      if (!k) return null;
      const b = k.ball;
      return { phase: k.phase, state: b.state, holder: b.holderId, vx: b.vx, vy: b.vy, vz: b.vz, red: k.redScore, blue: k.blueScore, ids: k.players.map((p) => p.id) };
    });
    let st = null;
    const w0 = Date.now();
    while (!(st = await g()) || st.phase !== 'playing') {
      if (Date.now() - w0 > 60000) throw new Error('partita non in gioco');
      await sleep(300);
    }
    // il battitore preme COLPISCI
    const holderIdx = st.ids.indexOf(st.holder);
    const ph = phones[holderIdx];
    if (!ph) throw new Error('battitore non trovato');
    const handles = await ph.page.$$('#app button');
    let hit = null;
    for (const h of handles) {
      const t = await h.evaluate((el) => el.textContent ?? '');
      if (/COLPISCI|SERVI|HIT/i.test(t)) hit = h;
    }
    if (!hit) throw new Error('bottone COLPISCI non trovato');
    await hit.click();
    await sleep(120);
    const after = await g();
    const hSpeed = Math.hypot(after.vx, after.vz);
    console.log(`dopo il servizio: stato=${after.state} vel. orizzontale=${hSpeed.toFixed(2)} verticale=${after.vy.toFixed(2)}`);
    // aspetta il punto
    const p0 = Date.now();
    let s2 = after;
    while (s2.red + s2.blue === 0 && Date.now() - p0 < 30000) {
      await sleep(300);
      s2 = await g();
    }
    console.log(`punteggio dopo lo scambio: ${s2.red}-${s2.blue}`);
    const ok = after.state === 'flying' && hSpeed > 4 && hSpeed < 9 && s2.red + s2.blue >= 1;
    console.log(ok ? '✅ servizio con i valori di config e punto assegnato' : '❌ comportamento inatteso');
    process.exitCode = ok && !errs.length ? 0 : 1;
  }
  if (errs.length) console.log('❌ pageerror:', errs.slice(0, 3));
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
