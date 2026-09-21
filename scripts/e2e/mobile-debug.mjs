// MOBILE — modalita' test sul telefono (?debug=1), sblocco audio al primo tap, vibrazione con feature detection.
//   - con ?debug=1 il riquadro mostra FPS, ping, qualita', latenza del tocco, vibrazione, audio; senza, NON esiste
//   - telefono SENZA navigator.vibrate (iOS Safari): nessun errore quando l'host chiede una vibrazione
//   - il primo tap sblocca l'AudioContext (prima del tap: "non creato")
//   node scripts/e2e/mobile-debug.mjs
import { launch, createRoomOnHost, hostEval, sleep, CTRL_URL } from './lib.mjs';

const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const overlayText = (page) =>
  page.evaluate(() => [...document.querySelectorAll('div')].map((d) => d.textContent ?? '').find((t) => /^FPS \d+/.test(t)) ?? null);

async function openPhone(url, { noVibrate = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (noVibrate) {
    await page.evaluateOnNewDocument(() => {
      try {
        delete Navigator.prototype.vibrate; // come Safari iOS: la funzione proprio non c'e'
      } catch {
        /* ignora */
      }
    });
  }
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#name', { timeout: 15000 });
  return { page, errs };
}

try {
  const { page: host, code } = await createRoomOnHost(browser);
  const dbg = await openPhone(`${CTRL_URL}?debug=1&room=${code}`, { noVibrate: true });
  const plain = await openPhone(`${CTRL_URL}?room=${code}`);

  // 1. il riquadro esiste solo con ?debug=1
  await sleep(1200);
  const t0 = await overlayText(dbg.page);
  check(!!t0, 'con ?debug=1 il riquadro di debug e\' presente sul telefono');
  check((await overlayText(plain.page)) === null, 'senza ?debug=1 il riquadro NON esiste (produzione pulita)');
  check(/vibrazione NO/.test(t0 ?? ''), 'rileva che questo telefono NON supporta la vibrazione');
  check(/audio non creato/.test(t0 ?? ''), 'prima del primo tap l\'audio risulta "non creato"');
  check(/qualita' \w+ \((auto|manuale)\)/.test(t0 ?? ''), `mostra il livello di qualita' (${(t0 ?? '').split('\n')[3]})`);

  // 2. il PRIMO tap sblocca l'audio
  await dbg.page.touchscreen.tap(195, 400);
  await sleep(900);
  const t1 = await overlayText(dbg.page);
  check(/audio attivo/.test(t1 ?? ''), `dopo il primo tap l'audio e' sbloccato (${(t1 ?? '').split('\n')[5]})`);

  // 3. entra in stanza, poi l'host chiede vibrazioni: senza navigator.vibrate non deve esserci nessun errore
  await dbg.page.type('#name', 'Dbg');
  await dbg.page.click('#go');
  await dbg.page.waitForSelector('#chars .char', { timeout: 15000 });
  await sleep(500);
  const pid = await hostEval(host, (gm) => gm.state?.players?.[0]?.id);
  await hostEval(host, (gm, id) => { gm.vibrate(id, 60); gm.vibrate(id, 120); }, pid);
  await sleep(700);
  const noVib = await dbg.page.evaluate(() => typeof navigator.vibrate);
  check(noVib === 'undefined', `navigator.vibrate assente nel telefono di prova (${noVib})`);
  check(dbg.errs.length === 0, `nessun errore di pagina anche senza vibrazione ${dbg.errs.length ? JSON.stringify(dbg.errs.slice(0, 3)) : ''}`);

  // 4. ping e latenza del tocco compaiono
  await dbg.page.touchscreen.tap(100, 300);
  await sleep(3000);
  const t2 = await overlayText(dbg.page);
  check(/ping \d+ ms/.test(t2 ?? ''), `ping misurato (${(t2 ?? '').split('\n')[2]})`);
  check(/tocco \d+ ms/.test(t2 ?? ''), `latenza del tocco misurata (${(t2 ?? '').split('\n')[4]})`);

  // 5. DEVICE TEST: pagina di prova completa
  const openBtn = await dbg.page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'DEVICE TEST'));
  check(!!openBtn.asElement(), "con ?debug=1 c'e' il pulsante DEVICE TEST");
  await dbg.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'DEVICE TEST').click());
  await dbg.page.waitForSelector('#device-test', { timeout: 10000 });
  await dbg.page.evaluate(() => document.querySelector('#dt-audio').click());
  await sleep(900);
  const audioTxt = await dbg.page.evaluate(() => document.querySelector('#dt-audio-out').textContent);
  check(/AUDIO UNLOCKED ✅/.test(audioTxt), `TEST AUDIO: ${audioTxt}`);
  await dbg.page.evaluate(() => document.querySelector('#dt-vib').click());
  const vibTxt = await dbg.page.evaluate(() => document.querySelector('#dt-vib-out').textContent);
  check(/UNSUPPORTED/.test(vibTxt), `TEST VIBRAZIONE su telefono senza vibrate: ${vibTxt}`);
  await dbg.page.evaluate(() => document.querySelector('#dt-3d').click());
  await sleep(2500);
  const info = await dbg.page.evaluate(() => document.querySelector('#dt-info').textContent);
  check(/3D grezzo\s+\d+ fps/.test(info) && /GPU\s+\S+/.test(info), 'TEST 3D: FPS e GPU mostrati');
  check(/orientamento\s+\S+/.test(info) && /latenza tocco/.test(info) && /AudioContext\s+attivo/.test(info), 'orientamento, latenza tocco e AudioContext nel pannello');
  // multitouch reale (CDP): un dito sul PAD e un dito su A insieme
  const rects = await dbg.page.evaluate(() => ['dt-pad', 'dt-a'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  await dbg.page.evaluate(() => document.getElementById('dt-pad').scrollIntoView());
  const rects2 = await dbg.page.evaluate(() => ['dt-pad', 'dt-a'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  const cdp = await dbg.page.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rects2[0].x, y: rects2[0].y, id: 1 }, { x: rects2[1].x, y: rects2[1].y, id: 2 }] });
  await sleep(400);
  const touchTxt = await dbg.page.evaluate(() => document.querySelector('#dt-touch').textContent);
  check(/touch attivi 2/.test(touchTxt) && /MULTITOUCH OK/.test(touchTxt), `multitouch joystick + pulsante insieme: ${touchTxt.split(String.fromCharCode(10)).filter((l) => /attivi|MULTI/.test(l)).join(' | ')}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  void rects;
  await dbg.page.evaluate(() => document.querySelector('#dt-close').click());
  await sleep(300);
  check(!(await dbg.page.evaluate(() => !!document.getElementById('device-test'))), 'CHIUDI rimuove la pagina di prova');
  check(dbg.errs.length === 0, `nessun errore di pagina dopo il DEVICE TEST ${dbg.errs.length ? JSON.stringify(dbg.errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
