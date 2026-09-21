// GAMEPAD sul BUNDLE DI PRODUZIONE (dist/ servito da Express :3001, niente Vite): l'intera catena RAW -> PROFILO -> PLAYER -> GIOCO
// letta dall'overlay F3 (con ?debug=1 anche in produzione). Se qui l'input arriva e nel dev anche, il problema non e' del build.
//   npm run build && npm start   (altro terminale)   ->   node scripts/e2e/gamepad-prod.mjs      (poi: git checkout dist/index.html)
process.env.CTRL_URL = process.env.CTRL_URL ?? 'http://localhost:3001/controller.html';
const { launch, addPhone, sleep } = await import('./lib.mjs');

const HOST = process.env.PROD_HOST ?? 'http://localhost:3001/?debug=1';
const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const DS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const errs = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  let code = null;
  cdp.on('Network.webSocketFrameReceived', ({ response }) => {
    const m = /"roomCode":"([A-Z0-9]{5})"/.exec(response.payloadData ?? '');
    if (m && !code) code = m[1];
  });
  await page.goto(HOST, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 40 && !code; i++) await sleep(250);
  check(!!code, `stanza creata sul bundle di produzione (${code})`);
  const phones = [await addPhone(browser, code, 'P1', 0), await addPhone(browser, code, 'P2', 1)];

  await page.evaluate(() => {
    const mp = (window.__mp = { pads: {}, names: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'] });
    navigator.getGamepads = () => {
      const a = [null, null, null, null];
      for (const k of Object.keys(mp.pads)) {
        const p = mp.pads[k];
        a[p.index] = { index: p.index, id: p.id, connected: true, mapping: 'standard', axes: [...p.axes], buttons: p.buttons.map((b) => ({ pressed: b.v > 0.5, value: b.v })), vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
      }
      return a;
    };
    window.__padAdd = (index, id) => {
      mp.pads[index] = { index, id, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ v: 0 })) };
      const ev = new Event('gamepadconnected');
      ev.gamepad = navigator.getGamepads()[index];
      window.dispatchEvent(ev);
    };
    window.__padBtn = (i, n, d) => (mp.pads[i].buttons[mp.names.indexOf(n)].v = d ? 1 : 0);
    window.__padStick = (i, x, y) => (mp.pads[i].axes = [x, y, 0, 0]);
  });
  const btn = (i, n, d) => page.evaluate((a, b, c) => window.__padBtn(a, b, c), i, n, d);
  const stick = (i, x, y) => page.evaluate((a, b, c) => window.__padStick(a, b, c), i, x, y);
  const tap = async (i, n, hold = 380) => {
    await btn(i, n, true);
    await sleep(hold);
    await btn(i, n, false);
    await sleep(220);
  };
  const f3 = () => page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483000' && d.style.display !== 'none')?.textContent ?? '');
  await page.evaluate((a, b) => (window.__padAdd(0, a), window.__padAdd(1, b)), XBOX, DS);
  await sleep(600);
  // pairing "vero": il cursore (A, A) e' il flusso che usano i giocatori
  await tap(0, 'A');
  await tap(0, 'A');
  await tap(1, 'A');
  await tap(1, 'A');
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'pairing col cursore sul bundle di produzione: 2 controller associati');

  // Arena scelta dalla stanza (frecce), poi START
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await sleep(150);
  }
  await page.keyboard.press('Enter');
  if (!(await f3())) await page.keyboard.press('F3'); // con ?debug=1 l'overlay parte già visibile

  let sawControls = false;
  let ctxText = '';
  for (let i = 0; i < 300; i++) {
    sawControls ||= await page.evaluate(() => !!document.getElementById('pad-controls'));
    ctxText = await f3();
    if (process.env.TRACE && i % 8 === 0) console.log('   [t]', (ctxText.slice(0, 110)), '| controlli:', sawControls);
    if (/contesto MINIGAME/.test(ctxText) && sawControls) break;
    await sleep(250);
  }
  check(sawControls, 'schermata CONTROLLI comparsa sul bundle di produzione');
  check(/contesto MINIGAME · gioco arena · profilo arena/.test(ctxText), 'F3: contesto MINIGAME, profilo arena');
  const phoneT = await phones[0].page.evaluate(() => document.getElementById('app')?.innerText.replace(/\s+/g, ' '));
  check(/USA IL CONTROLLER/.test(phoneT), `telefono: "${phoneT.slice(0, 60)}"`);

  // la catena completa a gioco in corso (aspetta il VIA: le letture del gioco iniziano dal countdown)
  await stick(0, 0.3, -0.9);
  let line = '';
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    line = await f3();
    if (/GIOCO\s+legge move \+0\.\d\d,-0\.\d\d \(\d+ letture/.test(line) && /PLAYER\s+\w+… move \+0\.\d\d,-0\.\d\d/.test(line)) break;
  }
  const grab = (re) => (line.match(re) ?? ['(non trovato)'])[0];
  console.log('   ' + grab(/RAW\s+LX[^\n]*/));
  console.log('   ' + grab(/PROFILO\s+moveX[^\n]*/));
  console.log('   ' + grab(/PLAYER\s+\w+…[^\n]*/));
  console.log('   ' + grab(/GIOCO\s+legge[^\n]*/));
  check(/RAW\s+LX \+0\.30 LY -0\.90/.test(line), 'RAW: valori grezzi del controller nel bundle di produzione');
  check(/PROFILO\s+moveX \+0\.\d\d moveY -0\.\d\d/.test(line), 'PROFILO: dopo deadzone');
  check(/PLAYER\s+\w+… move \+0\.\d\d,-0\.\d\d/.test(line), 'PLAYER: nel PlayerInput');
  check(/GIOCO\s+legge move \+0\.\d\d,-0\.\d\d \(\d+ letture/.test(line), 'GIOCO: Arena legge quei valori');
  await stick(0, 0, 0);
  // il dash: aspetta che il gioco sia in corso (il countdown ignora i tasti)
  let dashOk = false;
  for (let i = 0; i < 20 && !dashOk; i++) {
    await tap(0, 'A', 450);
    await sleep(500);
    dashOk = /dash consumato [1-9]\d*x/.test(await f3());
  }
  check(dashOk, 'A/✕ = dash consumato dal gioco nel bundle di produzione');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);

  // senza ?debug=1 in produzione: nessun hook, nessun overlay F3
  const clean = await browser.newPage();
  await clean.goto('http://localhost:3001/', { waitUntil: 'load' });
  await sleep(1500);
  const leak = await clean.evaluate(() => ({ pads: typeof window.__pads, mp: typeof window.__mp, f3: [...document.querySelectorAll('div')].some((d) => d.style.zIndex === '2147483000') }));
  check(leak.pads === 'undefined' && !leak.f3, 'produzione normale (senza ?debug=1): nessun hook __pads e nessun overlay debug');
} catch (e) {
  console.error('ERRORE', e);
  fails++;
} finally {
  await browser.close();
}
process.exitCode = fails ? 1 : 0;
