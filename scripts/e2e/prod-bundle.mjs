// BUNDLE DI PRODUZIONE (dist/ servito dal server Express su :3001, niente Vite): host + 2 telefoni, un gioco 3D scelto dalla stanza.
// Verifica: il build parte e crea la stanza, i telefoni entrano, rullo/intro/gioco partono senza errori di pagina, l'overlay
// di debug NON esiste, e il chunk del gioco 3D estratto viene scaricato DURANTE rullo/intro (precarico), non al via.
//   npm run build && npm start   (in un altro terminale)   →   node scripts/e2e/prod-bundle.mjs
//   PROD_PICK=4 (default: 4 = arena; 5 dodgeball, 6 soccer, 7 volleyball, 8 kart3d, 1 quiz, 2 reaction, 3 memory, 0 = rullo)
// Nota: dopo `npm run build` ripristina `git checkout dist/index.html` SOLO dopo il test (l'index committato ha gli hash vecchi).
process.env.CTRL_URL = process.env.CTRL_URL ?? 'http://localhost:3001/controller.html';
const { launch, addPhone, phoneView, sleep } = await import('./lib.mjs');

const HOST = process.env.PROD_HOST ?? 'http://localhost:3001/';
const PICK = Number(process.env.PROD_PICK ?? 4);
const GAME_LABEL = { 4: /ARENA/, 5: /DODGEBALL/, 6: /CALCIO/, 7: /PALLAVOLO/, 8: /RIBALTATI/, 1: /CHI CAZZO/, 2: /BOTTA/, 3: /MEMORIA/ }[PICK];
const browser = await launch();
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const errs = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const t0 = Date.now();
  const chunkReq = []; // richieste dei chunk dei giochi 3D con il tempo
  page.on('request', (r) => {
    const m = /assets\/(Babylon\w+Game)-[\w-]+\.js/.exec(r.url());
    if (m) chunkReq.push({ name: m[1], t: Date.now() - t0 });
  });
  // il codice stanza si legge dai frame WebSocket (in produzione non ci sono hook di test)
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  let code = null;
  cdp.on('Network.webSocketFrameReceived', ({ response }) => {
    const m = /"roomCode":"([A-Z0-9]{5})"/.exec(response.payloadData ?? '');
    if (m && !code) code = m[1];
  });
  await page.goto(HOST, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  check(true, 'host di produzione caricato (canvas Phaser presente)');
  await sleep(1500);
  await page.keyboard.press('Enter'); // crea la stanza (2 giocatori)
  for (let i = 0; i < 40 && !code; i++) await sleep(250);
  check(!!code, `stanza creata (${code})`);

  const phones = [];
  for (let i = 0; i < 2; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  for (const p of phones) p.page.on('pageerror', (e) => errs.push(`${p.name} ` + String(e).slice(0, 160)));
  check(true, '2 telefoni entrati e pronti');

  const debugOverlay = await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => d.style.zIndex === '2147483000'));
  check(!debugOverlay, "l'overlay di debug non esiste in produzione");

  for (let i = 0; i < PICK; i++) {
    await page.keyboard.press('ArrowRight'); // sceglie il gioco dalla stanza (0 = rullo casuale)
    await sleep(120);
  }
  await page.keyboard.press('Enter'); // START
  const tStart = Date.now() - t0;
  const trail = [];
  let last = '';
  let tGame = null;
  const deadline = Date.now() + 80000;
  while (Date.now() < deadline) {
    const v = await phoneView(phones[0].page);
    const label = (v.h1 || v.text).slice(0, 40);
    if (label !== last) {
      last = label;
      trail.push(`${((Date.now() - t0) / 1000).toFixed(0)}s "${label}"`);
      if (GAME_LABEL && GAME_LABEL.test(label) && !/PROSSIMO/.test(label) && tGame === null) tGame = Date.now() - t0;
    }
    if (tGame !== null && Date.now() - t0 > tGame + 4000) break;
    await sleep(400);
  }
  console.log('   fasi viste dal telefono:', trail.join(' → '));
  check(trail.some((x) => /PROSSIMO GIOCO/.test(x)), 'il telefono ha mostrato rullo/preparazione');
  if (GAME_LABEL) check(tGame !== null, `il gioco scelto è partito sui telefoni (${((tGame ?? 0) / 1000).toFixed(0)}s)`);
  console.log('   chunk giochi 3D richiesti:', chunkReq.length ? chunkReq.map((c) => `${c.name}@${(c.t / 1000).toFixed(1)}s`).join(', ') : 'nessuno (gioco 2D o rullo)');
  if (PICK >= 4 && PICK <= 8) {
    check(chunkReq.length > 0, 'il chunk del gioco 3D è stato scaricato');
    if (chunkReq.length > 0 && tGame !== null) {
      const lead = (tGame - chunkReq[0].t) / 1000;
      check(chunkReq[0].t >= tStart && lead >= 5, `precarico: chunk richiesto ${lead.toFixed(1)}s PRIMA che il gioco parta (durante rullo/intro)`);
    }
  }
  check(errs.length === 0, `nessun errore di pagina in produzione ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
