// GOBLIN TRIPO (pilota, solo DEV): alternativa di RENDER al Goblin procedurale.
//
//   node scripts/e2e/goblin-tripo.mjs              → galleria ?characters=1: OLD/NEW, fallback, switch, indipendenza
//   VIEWPORT=1600x900 node scripts/e2e/goblin-tripo.mjs
//   FLOW=1 node scripts/e2e/goblin-tripo.mjs       → contesti di gioco reali (arena, cornicione, kart, sparatoria)
//   PROBE=1 ...                                    → stampa i numeri grezzi (bounds, ossa, frame) senza asserzioni
//
// Serve solo vite in dev (http://localhost:5173) per la galleria; con FLOW=1 serve anche il server (npm start) e
// due telefoni headless. Gli screenshot finiscono in e2e-shots/goblin/ (SHOTS=0 per non salvarli).
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CHROME, CTRL_URL, HOST_URL, createRoomOnHost, hostEval, hostSnapshot, launch, sleep } from './lib.mjs';
import { XBOX, DS, add as padAdd, installMock, sceneEval, stick, tap } from './padmock.mjs';

const OUT = 'e2e-shots/goblin';
const SHOTS = process.env.SHOTS !== '0';
const PROBE = process.env.PROBE === '1';
/** FLOW=1 (tutti i contesti) oppure FLOW=lab|arena|kart3d|fps per uno solo (pratico in headless, che è lento). */
const FLOW = process.env.FLOW === '1' ? 'all' : (process.env.FLOW ?? null);
const VIEW = process.env.VIEWPORT ?? '1600x900';
const [VW, VH] = VIEW.split('x').map(Number);
if (SHOTS) mkdirSync(OUT, { recursive: true });

let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
const info = (m) => console.log(`   ${m}`);

/** Media di FPS su qualche campione (in headless il GL è software: serve solo a confrontare OLD e NEW). */
async function avgFps(page, samples = 4, gap = 400) {
  const out = [];
  for (let i = 0; i < samples; i++) {
    out.push(await page.evaluate(() => window.__gallery.fps()));
    await sleep(gap);
  }
  return out.reduce((a, b) => a + b, 0) / out.length;
}

const ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  `--window-size=${VW},${VH}`
];

async function open(url) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ARGS,
    defaultViewport: { width: VW, height: VH }
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 300));
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gallery?.ready === true, { timeout: 60000 });
  return { browser, page, errs };
}

const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.screenshot({ path: `${OUT}/${VIEW}-${name}.png` });
  info(`screenshot ${OUT}/${VIEW}-${name}.png`);
};

/**
 * Viste deterministiche della galleria: il Goblin è la PRIMA entità (x = -2 * 3.1), quindi la camera lo
 * inquadra da fronte/lato/retro con la stessa luce e lo stesso posto. `wide` tiene tutti e cinque.
 */
const GOBLIN_X = -6.2;
const ANGLES = [
  ['wide', -Math.PI / 2, 1.32, 13.5, 0],
  ['front', -Math.PI / 2, 1.32, 5, GOBLIN_X],
  ['side', Math.PI, 1.32, 5, GOBLIN_X],
  ['back', Math.PI / 2, 1.32, 5, GOBLIN_X],
  ['closeup', -Math.PI / 2, 1.42, 3.2, GOBLIN_X]
];

async function staticShots(page, tag) {
  await page.evaluate(() => window.__gallery.setState('IDLE'));
  await sleep(700);
  for (const [name, alpha, beta, radius, tx] of ANGLES) {
    await page.evaluate((a, b, r, x) => window.__gallery.setCamera(a, b, r, x), alpha, beta, radius, tx);
    await sleep(450);
    await shot(page, `${tag}-idle-${name}`);
  }
  await page.evaluate((x) => window.__gallery.setCamera(-Math.PI / 2, 1.32, 5, x), GOBLIN_X);
  await sleep(300);
}

/** Corsa campionata a intervalli: la posa cambia, il posto/luce no. */
async function runShots(page, tag) {
  await page.evaluate(() => window.__gallery.setState('RUN'));
  await sleep(500);
  for (let i = 0; i < 4; i++) {
    await shot(page, `${tag}-run-${i}`);
    await sleep(320);
  }
  await page.evaluate(() => window.__gallery.setState('IDLE'));
}

/** Aspetta che la prima entità Goblin abbia finito il caricamento (ready o errore). */
async function waitGoblin(page, index = 0, timeout = 40000) {
  await page.waitForFunction(
    (i) => {
      const g = window.__gallery.goblins()[i];
      return !!g && (g.state === 'ready' || g.state === 'error');
    },
    { timeout },
    index
  );
}

async function galleryPart() {
  console.log('\n— GALLERIA (?characters=1): OLD vs NEW —');
  const base = `${HOST_URL}?characters=1`;
  let oldStats = null;
  let oldFps = 0;
  let newStats = null;

  // ---------- OLD (default)
  const old = await open(base);
  try {
    const n = await old.page.evaluate(() => window.__gallery.count());
    check(n === 5, `OLD: 5 personaggi (${n})`);
    const modes = await old.page.evaluate(() => window.__gallery.goblins());
    check(modes.every((g) => g === null), 'OLD: nessuna istanza importata (modello procedurale, default)');
    check((await old.page.evaluate(() => window.__gallery.goblin().mode)) === 'old', 'OLD: modalità = old');
    await staticShots(old.page, 'old');
    await runShots(old.page, 'old');
    oldStats = await old.page.evaluate(() => window.__gallery.stats());
    oldFps = await avgFps(old.page);
    info(`PERF OLD (5 personaggi, ${VIEW}, GL software): fps medio ${oldFps.toFixed(1)} · ${JSON.stringify(oldStats)}`);
    check(old.errs.length === 0, `OLD: nessun errore${old.errs.length ? ' ' + old.errs.join(' | ') : ''}`);
  } finally {
    await old.browser.close();
  }

  // ---------- NEW (query ?goblin=new)
  const neu = await open(`${base}&goblin=new`);
  try {
    await waitGoblin(neu.page);
    const g0 = await neu.page.evaluate(() => window.__gallery.goblins()[0]);
    if (PROBE) info(`NEW debug: ${JSON.stringify(g0)}`);
    check(g0?.state === 'ready', `NEW: caricamento completato (stato ${g0?.state}${g0?.error ? ' · ' + g0.error : ''})`);
    check(g0?.bones === 65, `NEW: scheletro con 65 ossa (${g0?.bones})`);
    check(!!g0?.animation?.startsWith('run.001'), `NEW: clip run.001 selezionata (${g0?.animation})`);
    check(g0?.animationSpeed === 0, `NEW: nessun autoplay al caricamento (velocità ${g0?.animationSpeed})`);
    check(Math.abs((g0?.animationFrame ?? 0) - (g0?.holdFrame ?? -1)) < 0.6, `NEW: posa FERMA su un fotogramma reale della clip (frame ${g0?.animationFrame} ≈ ${g0?.holdFrame})`);
    // la clip del GLB è "sul posto" ma con le anche ~0,45 unità davanti alla posa di riposo: la correzione
    // deve riportarle lì, altrimenti il modello corre davanti al proprio root (vedi PILOT-REPORT)
    check(Math.abs(g0?.clipHipsOffset?.[2] ?? 0) > 0.3, `NEW: scostamento costante delle anche misurato dalla clip (${JSON.stringify(g0?.clipHipsOffset)})`);
    check(Math.abs((g0?.hipsNow?.[2] ?? 0) - (g0?.restHips?.[2] ?? 0)) < 0.05, `NEW: clip riportata "sul posto" (anche z ${g0?.hipsNow?.[2]} ≈ riposo ${g0?.restHips?.[2]})`);
    check((g0?.height ?? 0) > 1.5 && (g0?.height ?? 0) < 2.6, `NEW: altezza normalizzata sul rig procedurale (${g0?.height?.toFixed?.(3)})`);
    const stats = await neu.page.evaluate(() => window.__gallery.stats());
    newStats = stats;
    if (PROBE) info(`NEW stats: ${JSON.stringify(stats)}`);
    const newFps = await avgFps(neu.page);
    const loadMs = await neu.page.evaluate(() => window.__gallery.goblin().assets[0]?.loadMs ?? null);
    info(`PERF NEW (5 personaggi, ${VIEW}, GL software): fps medio ${newFps.toFixed(1)} · load GLB ${loadMs === null ? 'n/d' : Math.round(loadMs) + ' ms'} · ${JSON.stringify(stats)}`);
    info(`PERF delta: mesh +${stats.meshes - oldStats.meshes} · materiali +${stats.materials - oldStats.materials} · texture +${stats.textures - oldStats.textures} · geometrie +${stats.geometries - oldStats.geometries} · fps ${oldFps.toFixed(1)} → ${newFps.toFixed(1)}`);

    // confronto nello STESSO posto: camera, luci, facing e root sono quelli della galleria
    await staticShots(neu.page, 'new');
    await runShots(neu.page, 'new');
    // la lettura della corsa va fatta MENTRE corre (`runShots` chiude in IDLE): si rientra in RUN e si aspetta un frame
    await neu.page.evaluate(() => window.__gallery.setState('RUN'));
    await sleep(700);
    const running = await neu.page.evaluate(() => window.__gallery.goblins()[0]);
    check((running?.animationSpeed ?? 0) > 0.5, `NEW: in corsa la clip avanza (velocità ${running?.animationSpeed?.toFixed?.(2)})`);
    await neu.page.evaluate(() => window.__gallery.setState('HIT'));
    await sleep(500);
    await shot(neu.page, 'new-hit');
    const hit = await neu.page.evaluate(() => window.__gallery.goblins()[0]);
    check(hit?.animationSpeed === 0, `NEW: negli stati non coperti la clip è FERMA (velocità ${hit?.animationSpeed})`);
    check(Math.abs((hit?.animationFrame ?? 0) - (hit?.holdFrame ?? -1)) < 0.6, 'NEW: la posa ferma è un fotogramma della clip, non la bind pose');
    await neu.page.evaluate(() => window.__gallery.setState('VICTORY'));
    await sleep(900);
    await shot(neu.page, 'new-victory');
    check(neu.errs.length === 0, `NEW: nessun errore${neu.errs.length ? ' ' + neu.errs.join(' | ') : ''}`);
  } finally {
    await neu.browser.close();
  }

  // ---------- fallback su asset mancante
  const bad = await open(`${base}&goblin=new&goblinUrl=/models/goblin-tripo/does-not-exist.glb`);
  try {
    await waitGoblin(bad.page);
    const g = await bad.page.evaluate(() => window.__gallery.goblins()[0]);
    check(g?.state === 'error', `FALLBACK: asset mancante → stato error (${g?.state})`);
    check((await bad.page.evaluate(() => window.__gallery.count())) === 5, 'FALLBACK: la galleria resta viva con il rig procedurale');
    await bad.page.evaluate(() => window.__gallery.setState('RUN'));
    await sleep(900);
    await shot(bad.page, 'fallback-missing-asset');
    const errs = bad.errs.filter((e) => !/404|Failed to load resource/i.test(e));
    check(errs.length === 0, `FALLBACK: nessun errore non gestito${errs.length ? ' ' + errs.join(' | ') : ''}`);
  } finally {
    await bad.browser.close();
  }

  // ---------- switch ripetuti OLD/NEW (nessuna risorsa accumulata)
  const sw = await open(`${base}&goblin=new`);
  try {
    await waitGoblin(sw.page);
    await sleep(400);
    const before = await sw.page.evaluate(() => window.__gallery.stats());
    for (let i = 0; i < 3; i++) {
      await sw.page.evaluate(() => window.__gallery.setGoblin('old'));
      await sleep(250);
      await sw.page.evaluate(() => window.__gallery.setGoblin('new'));
      await sleep(250);
      await waitGoblin(sw.page);
    }
    await sleep(600);
    const after = await sw.page.evaluate(() => window.__gallery.stats());
    info(`switch: prima ${JSON.stringify(before)} · dopo ${JSON.stringify(after)}`);
    check(after.meshes <= before.meshes + 1, `SWITCH: mesh stabili (${before.meshes} → ${after.meshes})`);
    check(after.materials <= before.materials + 1, `SWITCH: materiali stabili (${before.materials} → ${after.materials})`);
    check(after.textures <= before.textures + 1, `SWITCH: texture stabili (${before.textures} → ${after.textures})`);
    check(after.skeletons <= 6, `SWITCH: scheletri stabili (${after.skeletons})`);
    check(after.animationGroups <= 6, `SWITCH: gruppi di animazione stabili (${after.animationGroups})`);
    check(sw.errs.length === 0, `SWITCH: nessun errore${sw.errs.length ? ' ' + sw.errs.join(' | ') : ''}`);
  } finally {
    await sw.browser.close();
  }

  // ---------- più Goblin: scheletri/clip indipendenti
  const multi = await open(`${base}&goblin=new`);
  try {
    await waitGoblin(multi.page);
    await multi.page.evaluate(() => window.__gallery.spawnGoblins(2));
    await multi.page.waitForFunction(
      () => window.__gallery.goblins().filter((g) => g && g.state === 'ready').length === 3,
      { timeout: 60000 }
    );
    const gs = await multi.page.evaluate(() => window.__gallery.goblins().filter((g) => g));
    info(`multi: ${JSON.stringify(gs.map((g) => ({ s: g.skeletonId, a: g.animation, f: g.animationFrame?.toFixed?.(1) })))}`);
    check(new Set(gs.map((g) => g.skeletonId)).size === 3, 'MULTI: 3 scheletri distinti (uno per Goblin)');
    check(new Set(gs.map((g) => g.animation)).size === 3, 'MULTI: 3 gruppi di animazione distinti');
    const mstats = await multi.page.evaluate(() => window.__gallery.stats());
    check(mstats.skeletons === 3 && mstats.animationGroups === 3, `MULTI: in scena 3 scheletri e 3 clip (${mstats.skeletons}/${mstats.animationGroups})`);
    // le geometrie delle MESH IMPORTATE sono condivise (una sola per tutti); il conteggio di scena cresce solo
    // perché ogni ArenaEntity costruisce comunque il proprio rig procedurale, che viene nascosto ma resta vivo.
    const geoIds = new Set(gs.flatMap((g) => g.geometryIds ?? []).filter((id) => id >= 0));
    check(geoIds.size === 1, `MULTI: una sola geometria condivisa fra le mesh importate dei 3 Goblin (${[...geoIds].join(', ')})`);
    info(`MULTI: geometrie di scena ${newStats?.geometries} con 1 Goblin → ${mstats.geometries} con 3 (le mesh importate non aggiungono geometrie)`);
    await multi.page.evaluate(() => window.__gallery.setState('RUN'));
    // velocità DIVERSE e basse: le tre clip devono avanzare di quantità diverse e trovarsi in fasi diverse.
    // In headless il GL software gira a ~4 fps: la finestra deve contenere qualche render, e la clip (1,25 s)
    // può girare più di una volta → si confrontano le fasi, non il tempo assoluto.
    await multi.page.evaluate(() => window.__gallery.goblinDrive([0.2, 0.45, 0.9]));
    const f0 = await multi.page.evaluate(() => window.__gallery.goblins().filter((g) => g).map((g) => g.animationFrame));
    await sleep(1500);
    const f1 = await multi.page.evaluate(() => window.__gallery.goblins().filter((g) => g).map((g) => g.animationFrame));
    info(`frame: ${JSON.stringify(f0.map((v) => v?.toFixed?.(1)))} → ${JSON.stringify(f1.map((v) => v?.toFixed?.(1)))}`);
    check(f1.every((v, i) => Math.abs((v ?? 0) - (f0[i] ?? 0)) > 0.5), `MULTI: tutte le clip si muovono (${f1.map((v) => v?.toFixed?.(1)).join(', ')})`);
    check(new Set(f1.map((v) => (v ?? 0).toFixed(1))).size >= 2, `MULTI: le tre clip sono in fasi diverse (${f1.map((v) => v?.toFixed?.(1)).join(', ')})`);
    await shot(multi.page, 'multi-goblins');
    check(multi.errs.length === 0, `MULTI: nessun errore${multi.errs.length ? ' ' + multi.errs.join(' | ') : ''}`);
  } finally {
    await multi.browser.close();
  }

  // ---------- uscita dalla scena DURANTE il caricamento
  // ---------- selettore e taratura: casi limite del parsing (in ambiente vero, come in partita)
  const sel = await open(`${base}&goblin=new&goblinYaw=abc&goblinScale=-3`);
  try {
    await waitGoblin(sel.page);
    const g = await sel.page.evaluate(() => window.__gallery.goblins()[0]);
    check(g?.state === 'ready' && (g?.height ?? 0) > 1.5 && (g?.height ?? 0) < 2.6, `SELETTORE: taratura non valida ignorata, modello comunque pronto (h ${g?.height?.toFixed?.(2)})`);
  } finally {
    await sel.browser.close();
  }
  const off = await open(`${base}&goblin=old&goblinUrl=/models/goblin-tripo/does-not-exist.glb`);
  try {
    check((await off.page.evaluate(() => window.__gallery.goblin().mode)) === 'old', 'SELETTORE: ?goblin=old vince su un URL asset rotto (nessun caricamento)');
    check((await off.page.evaluate(() => window.__gallery.goblins().every((x) => x === null))), 'SELETTORE: OLD non crea nessuna istanza importata');
    check(off.errs.length === 0, `SELETTORE: nessun errore con URL rotto in modalità OLD${off.errs.length ? ' ' + off.errs.join(' | ') : ''}`);
  } finally {
    await off.browser.close();
  }

  // ---------- PULSANTI della galleria: click veri, partendo da ENTRAMBE le modalità esplicite nell'URL
  for (const start of ['old', 'new']) {
    const sw = await open(`${base}&goblin=${start}`);
    try {
      check((await sw.page.evaluate(() => window.__gallery.goblin().mode)) === start, `PULSANTI: partenza da ?goblin=${start}`);
      if (start === 'old') {
        await sw.page.click('#goblin-new');
        await waitGoblin(sw.page);
        check((await sw.page.evaluate(() => window.__gallery.goblins()[0]?.state)) === 'ready', 'PULSANTI: da ?goblin=old il pulsante NEW attiva il modello importato');
      } else {
        await sw.page.click('#goblin-old');
        await sleep(500);
        check(await sw.page.evaluate(() => window.__gallery.goblins().every((x) => x === null)), 'PULSANTI: da ?goblin=new il pulsante OLD sovrascrive la query (modello procedurale)');
        check((await sw.page.evaluate(() => window.__gallery.goblin().mode)) === 'old', 'PULSANTI: la scelta a runtime ha precedenza sulla query');
        await sw.page.click('#goblin-new');
        await waitGoblin(sw.page);
        check((await sw.page.evaluate(() => window.__gallery.goblins()[0]?.state)) === 'ready', 'PULSANTI: il pulsante NEW riporta il modello importato');
      }
      await shot(sw.page, `buttons-from-${start}`);
      check(sw.errs.length === 0, `PULSANTI (?goblin=${start}): nessun errore${sw.errs.length ? ' ' + sw.errs.join(' | ') : ''}`);
    } finally {
      await sw.browser.close();
    }
  }

  // ---------- DISPOSAL: caricamento ritardato + entità chiusa durante il load (?goblinDelay, solo test)
  const late = await open(`${base}&goblin=new&goblinDelay=1500`);
  try {
    check((await late.page.evaluate(() => window.__gallery.goblinCounters().liveInstances)) >= 1, 'DISPOSAL: istanza viva mentre il load è in corso');
    await late.page.evaluate(() => window.__gallery.setGoblin('old'));
    await sleep(400);
    check((await late.page.evaluate(() => window.__gallery.goblinCounters().liveInstances)) === 0, 'DISPOSAL: nessuna istanza viva dopo lo switch a OLD');
    const before = await late.page.evaluate(() => window.__gallery.stats());
    await sleep(5500); // oltre il ritardo + il tempo di load reale
    const after = await late.page.evaluate(() => window.__gallery.stats());
    const counters = await late.page.evaluate(() => window.__gallery.goblinCounters());
    check(counters.liveInstances === 0, `DISPOSAL: nessuna istanza creata dal load tardivo (${counters.liveInstances})`);
    check(after.meshes === before.meshes && after.skeletons === before.skeletons, `DISPOSAL: nessuna mesh/scheletro arrivato dopo (mesh ${before.meshes} → ${after.meshes}, scheletri ${before.skeletons} → ${after.skeletons})`);
    check(late.errs.length === 0, `DISPOSAL: nessun errore${late.errs.length ? ' ' + late.errs.join(' | ') : ''}`);
  } finally {
    await late.browser.close();
  }

  // ---------- DISPOSAL: scena smontata MENTRE il GLB sta arrivando (il container tardivo va buttato subito)
  const kill = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS, defaultViewport: { width: VW, height: VH } });
  try {
    const page = await kill.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 250)));
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text().slice(0, 250));
    });
    // caso A: il GLB sta arrivando quando la scena muore (load in volo)
    await page.goto(`${base}&goblin=new&goblinDelay=400`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gallery?.ready === true, { timeout: 60000 });
    await sleep(900); // il caricamento è partito e non è ancora finito
    const before = await page.evaluate(() => window.__gallery.goblinCounters());
    await page.evaluate(() => document.querySelector('#char-gallery button:last-child')?.click());
    await sleep(6000);
    const after = await page.evaluate(() => window.__gallery.goblinCounters());
    info(`disposal scena (load in volo): container tardivi ${before.lateDisposedContainers} → ${after.lateDisposedContainers}, abortiti ${before.abortedLoads} → ${after.abortedLoads}, ultimo errore ${JSON.stringify(after.lastLoadError)}, istanze ${after.liveInstances}`);
    check(after.liveInstances === 0, `DISPOSAL (scena): nessuna istanza viva dopo la chiusura (${after.liveInstances})`);
    check(
      after.lateDisposedContainers > before.lateDisposedContainers || after.abortedLoads > before.abortedLoads || !!after.lastLoadError,
      'DISPOSAL (scena): il caricamento in volo non lascia nulla dietro (container tardivo buttato o load abortito)'
    );
    const real = errs.filter((e) => !/404|Failed to load resource/i.test(e));
    check(real.length === 0, `DISPOSAL (scena): nessun errore${real.length ? ' ' + real.join(' | ') : ''}`);
  } finally {
    await kill.close();
  }

  // caso B: la scena muore PRIMA che il caricamento vero parta (il guard deve impedire di istanziare il loader
  // e di creare un container orfano in una scena già smontata)
  const early = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS, defaultViewport: { width: VW, height: VH } });
  try {
    const page = await early.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 250)));
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text().slice(0, 250));
    });
    await page.goto(`${base}&goblin=new&goblinDelay=4000`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gallery?.ready === true, { timeout: 60000 });
    const before = await page.evaluate(() => window.__gallery.goblinCounters());
    await page.evaluate(() => document.querySelector('#char-gallery button:last-child')?.click());
    await sleep(7000); // oltre il ritardo: il caricamento non deve nemmeno partire
    const after = await page.evaluate(() => window.__gallery.goblinCounters());
    info(`disposal scena (prima del load): abortiti ${before.abortedLoads} → ${after.abortedLoads}, ultimo errore ${JSON.stringify(after.lastLoadError)}, istanze ${after.liveInstances}`);
    check(after.abortedLoads > before.abortedLoads, 'DISPOSAL (scena): il guard blocca il caricamento se la scena è già morta');
    check(after.liveInstances === 0, `DISPOSAL (scena): nessuna istanza viva (${after.liveInstances})`);
    const real = errs.filter((e) => !/404|Failed to load resource/i.test(e));
    check(real.length === 0, `DISPOSAL (scena, pre-load): nessun errore${real.length ? ' ' + real.join(' | ') : ''}`);
  } finally {
    await early.close();
  }

  const exit = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS, defaultViewport: { width: VW, height: VH } });
  try {
    const page = await exit.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text().slice(0, 300));
    });
    await page.goto(`${base}&goblin=new`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gallery?.ready === true, { timeout: 60000 });
    // chiudi la galleria subito: la scena Babylon viene distrutta mentre il GLB sta ancora arrivando
    await page.evaluate(() => document.querySelector('#char-gallery button:last-child')?.click());
    await sleep(4000);
    check(!(await page.evaluate(() => !!document.getElementById('char-gallery'))), 'EXIT: galleria chiusa durante il caricamento');
    const real = errs.filter((e) => !/404|Failed to load resource/i.test(e));
    check(real.length === 0, `EXIT: nessun errore dopo la chiusura${real.length ? ' ' + real.join(' | ') : ''}`);
  } finally {
    await exit.close();
  }
}

// ---------------------------------------------------------------- contesti di gioco reali

async function flowPart() {
  console.log('\n— CONTESTI DI GIOCO (host ?goblin=new, telefoni con il Goblin) —');
  // 1. Cornicione: laboratorio con il VERO gioco (BabylonCornicioneGame) e bot
  if (FLOW === 'all' || FLOW === 'lab') await labPart();
  // 2. Arena / Kart / Sparatoria: flusso di gioco vero (host + 2 telefoni), un gioco per volta
  for (const [game, sceneKey] of [
    ['arena', 'arena'],
    ['kart3d', 'kart3d'],
    ['fps', 'fps']
  ]) {
    if (FLOW !== 'all' && FLOW !== game) continue;
    // la Sparatoria dell'host è SPLIT-SCREEN solo con i controller: nel browser headless vanno simulati (padmock)
    if (game === 'fps') await fpsPart();
    else await gamePart(game, sceneKey);
  }
}

async function labPart() {
  const lab = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS, defaultViewport: { width: VW, height: VH } });
  try {
    const page = await lab.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
    for (const mode of ['old', 'new']) {
      await page.goto(`${HOST_URL}?fighter=1&goblin=${mode}`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.__fighterLab?.game?.(), { timeout: 60000 });
      if (mode === 'new') {
        await page.waitForFunction(() => window.__fighterLab.game()?.entities?.get('lab1')?.goblinDebug?.()?.state === 'ready', { timeout: 60000 });
        const d = await page.evaluate(() => window.__fighterLab.game().entities.get('lab1').goblinDebug());
        check(d?.bones === 65 && !!d?.animation?.startsWith('run.001'), `CORNICIONE: Goblin importato nel gioco reale (ossa ${d?.bones}, clip ${d?.animation})`);
        info(`cornicione: ${JSON.stringify({ speed: d?.animationSpeed, frame: d?.animationFrame, hold: d?.holdFrame, offset: d?.clipHipsOffset })}`);
      }
      await sleep(2500);
      await shot(page, `cornicione-${mode}`);
    }
    check(errs.length === 0, `CORNICIONE: nessun errore${errs.length ? ' ' + errs.join(' | ') : ''}`);

    // IMPACT LAB, scenario Sparatoria: la finestra di A ha davanti l'avversario B — lo stesso percorso di render
    // degli avversari in partita (ensureAvatar su uno snapshot). Confronto OLD/NEW nella STESSA posa e stessa scena.
    for (const mode of ['old', 'new']) {
      await page.goto(`${HOST_URL}?impact=1&goblin=${mode}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__lab?.ready === true, { timeout: 60000 });
      await page.evaluate(() => {
        window.__lab.setChars('buttafuori', 'goblin');
        window.__lab.run('fps');
        window.__lab.setSpeed(1);
      });
      await sleep(6000);
      await shot(page, `impact-fps-${mode}`);
    }
    check(errs.length === 0, `SPARATORIA (lab): nessun errore${errs.length ? ' ' + errs.join(' | ') : ''}`);

    // KART (lab): la camera di gioco insegue da dietro, quindi per vedere ginocchia/mani del pilota seduto servono
    // viste ravvicinate deterministiche (kart fermo: `setSpeed(0)` congela il laboratorio).
    await page.goto(`${HOST_URL}?impact=1&goblin=new`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__lab?.ready === true, { timeout: 60000 });
    await page.evaluate(() => {
      window.__lab.setChars('goblin', 'goblin');
      window.__lab.run('kartBoost');
      window.__lab.setSpeed(0);
    });
    await sleep(6000);
    for (const [name, alpha, beta, radius] of [
      ['side', 0, 1.35, 4.2],
      ['front', Math.PI / 2, 1.3, 4.2],
      ['three-quarter', Math.PI / 2 - 0.7, 1.15, 4.6]
    ]) {
      await page.evaluate((a, b, r) => window.__lab.setCamera(a, b, r, 14, 1, 0), alpha, beta, radius);
      await sleep(900);
      await shot(page, `kart-lab-${name}`);
    }
    check(errs.length === 0, `KART (lab): nessun errore${errs.length ? ' ' + errs.join(' | ') : ''}`);
  } finally {
    await lab.close();
  }
}

async function gamePart(game, sceneKey) {
    const browser = await launch();
    const errs = [];
    try {
      const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: game === 'fps' ? 1 : 0 });
      page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 200)));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('HOST ' + m.text().slice(0, 200));
      });
      // ?goblin=new anche sul flusso di gioco: il selettore è di sessione e sopravvive ai cambi scena
      await page.evaluate(() => {
        const u = new URL(location.href);
        u.searchParams.set('goblin', 'new');
        history.replaceState(null, '', u);
      });
      for (let i = 0; i < 2; i++) {
        let tries = 0;
        // personaggi DIVERSI (come fanno gli altri E2E): il secondo telefono non può scegliere lo stesso
        // personaggio del primo, altrimenti la selezione non viene confermata e la stanza resta "piena"
        await withRetry(() => addPhoneSlow(browser, code, `P${i + 1}${tries++ ? 'b' : ''}`, i), `${game}: telefono ${i + 1}`);
      }
      await hostEval(page, (gm, id) => gm.selectMinigame(id), game);
      await sleep(300);
      await page.keyboard.press('Enter');
      while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(400);
      await sleep(game === 'fps' ? 9000 : 12000);
      const stats = await page.evaluate(async (key) => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n)) ?? '/src/core/GameManager.ts';
        const { game: gm } = await import(url);
        const g = gm.game.scene.getScene(key)?.game3d;
        if (!g) return null;
        const b = g.scene;
        const entities = g.entities ? [...g.entities.values()] : [];
        return {
          importedMeshes: b.meshes.filter((m) => /~g\d+/.test(m.name)).length,
          skeletons: b.skeletons.length,
          animationGroups: b.animationGroups.length,
          goblins: entities.map((e) => e.goblinDebug?.() ?? null).filter(Boolean),
          avatars: g.avatars ? [...g.avatars.values()].map((r) => ({ goblin: !!r.goblin, ready: r.goblin?.ready ?? false })) : null
        };
      }, sceneKey);
      info(`${game}: ${JSON.stringify(stats)}`);
      check(!!stats, `${game.toUpperCase()}: scena ${sceneKey} raggiunta`);
      if (stats) {
        const loaded = stats.importedMeshes > 0 || (stats.avatars ?? []).some((a) => a.ready);
        check(loaded, `${game.toUpperCase()}: modello importato presente nel render (mesh ${stats.importedMeshes}, avatar ${JSON.stringify(stats.avatars)})`);
      }
      await shot(page, `${game}-new`);
      if (game === 'kart3d') await kartSeatedChecks(page);
      check(errs.length === 0, `${game.toUpperCase()}: nessun errore${errs.length ? ' ' + errs.slice(0, 2).join(' | ') : ''}`);
    } finally {
      await browser.close();
    }
}

const kartRead = (page) =>
  page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager\.ts/.test(n)) ?? '/src/core/GameManager.ts';
    const { game: gm } = await import(url);
    const g = gm.game.scene.getScene('kart3d')?.game3d;
    if (!g) return null;
    for (const e of g.entities.values()) {
      const d = e.goblinDebug?.();
      if (d) return d;
    }
    return null;
  });

/** Il pilota del Kart deve essere SEDUTO e la posa non deve essere riscritta dallo scheletro a ogni frame. */
async function kartSeatedChecks(page) {
  const k1 = await kartRead(page);
  await sleep(1300);
  const k2 = await kartRead(page);
  if (PROBE) info(`kart joints: ${JSON.stringify(k1?.joints)}`);
  check(k1?.seated === true && k1?.seatedApplied === true, `KART: posa seduta applicata (${k1?.seated}/${k1?.seatedApplied})`);
  const j1 = k1?.joints ?? {};
  const j2 = k2?.joints ?? {};
  const keys = Object.keys(j1);
  const drift = keys.length ? Math.max(...keys.map((k) => Math.max(...j1[k].map((v, i) => Math.abs(v - (j2[k]?.[i] ?? v)))))) : Infinity;
  check(keys.length >= 8 && drift < 0.02, `KART: la posa resta identica dopo più frame (deriva max ${drift.toFixed(4)}, ${keys.length} articolazioni)`);
  const hips = j1.Hips;
  const knee = j1.LeftLeg;
  const foot = j1.LeftFoot;
  const head = j1.Head;
  const hand = j1.LeftHand;
  if (hips && knee && foot && head && hand) {
    info(`kart: hips ${JSON.stringify(hips)} · ginocchio ${JSON.stringify(knee)} · piede ${JSON.stringify(foot)} · mano ${JSON.stringify(hand)} · testa ${JSON.stringify(head)}`);
    check(knee[2] - hips[2] > 0.1 && foot[2] - hips[2] > 0.05, `KART: ginocchio e piede AVANTI rispetto al bacino (Δz ${(knee[2] - hips[2]).toFixed(3)} / ${(foot[2] - hips[2]).toFixed(3)})`);
    check(foot[1] < hips[1] - 0.05, `KART: i piedi stanno SOTTO il bacino (Δy ${(foot[1] - hips[1]).toFixed(3)})`);
    check(head[1] - hips[1] > 0.2 && hand[2] - hips[2] > 0.05, `KART: busto sopra il bacino e mani avanti (Δy testa ${(head[1] - hips[1]).toFixed(3)}, Δz mano ${(hand[2] - hips[2]).toFixed(3)})`);
    check(Math.abs(knee[0]) < 0.15 && Math.abs(hand[0]) < 0.15, `KART: gambe/mani verso il centro del kart (x ginocchio ${knee[0]}, x mano ${hand[0]})`);
  } else {
    check(false, 'KART: articolazioni chiave presenti nel probe');
  }
}

async function withRetry(fn, label) {
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      info(`${label}: tentativo ${attempt} fallito (${String(e).slice(0, 80)})`);
      await sleep(1500);
    }
  }
  throw last;
}

/**
 * SPARATORIA: l'host disegna lo split-screen Babylon SOLO per i giocatori con un controller (FpsScene crea
 * `BabylonFpsGame` con i "locals"). Nel browser headless i controller vanno simulati (padmock): due pad finti
 * associati in lobby a due giocatori, uno dei quali è il Goblin. Le finestre degli ALTRI devono mostrare il
 * Goblin importato; la finestra del Goblin NON deve mostrare il proprio corpo (stessa maschera di layer di prima).
 */
async function fpsPart() {
  const browser = await launch();
  const errs = [];
  try {
    const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
    page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 200)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('HOST ' + m.text().slice(0, 200));
    });
    for (let i = 0; i < 2; i++) {
      let tries = 0;
      await withRetry(() => addPhoneSlow(browser, code, `P${i + 1}${tries++ ? 'b' : ''}`, i), `fps: telefono ${i + 1}`);
    }
    const players = await hostEval(page, (gm) => gm.state.players.map((p) => ({ id: p.id, characterId: p.characterId, name: p.displayName })));
    const goblin = players.find((p) => p.characterId === 'goblin');
    const other = players.find((p) => p.id !== goblin?.id);
    check(!!goblin && !!other, `FPS: Goblin e avversario in partita (${JSON.stringify(players.map((p) => p.characterId))})`);
    // controller finti: il primo prende il Goblin (la sua finestra non deve mostrare il proprio corpo)
    await installMock(page, 4);
    await padAdd(page, 0, XBOX);
    await padAdd(page, 1, DS);
    await sleep(600);
    for (const [k, pid] of [
      [0, goblin?.id],
      [1, other?.id]
    ]) {
      if (!pid) continue;
      await page.evaluate((id) => window.__pads.setTarget(id), pid);
      await tap(page, k, 'A');
    }
    await page.evaluate(() => window.__pads.setTarget(null));
    await page.evaluate(() => {
      const u = new URL(location.href);
      u.searchParams.set('goblin', 'new');
      history.replaceState(null, '', u);
    });
    await hostEval(page, (gm) => gm.selectMinigame('fps'));
    await sleep(300);
    await page.keyboard.press('Enter');
    while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(400);
    await sleep(9000);
    const infoFps = await sceneEval(page, 'fps', (g, arg) => {
      const ss = g.splitScreen;
      if (!ss) return { splitScreen: false };
      const camOf = (pid) => ss.cams.find((c) => c.playerId === pid);
      const bit = (i) => 1 << (10 + i);
      const avatars = [...ss.avatars.entries()].map(([id, r]) => ({
        id,
        isGoblinPlayer: id === arg.goblinId,
        goblin: r.goblin ? r.goblin.debug() : null,
        masks: r.goblin ? r.goblin.handle().meshes.map((m) => m.layerMask) : null,
        capsuleVisible: r.body.isVisible
      }));
      const camInfo = ss.cams.map((c) => ({ pid: c.playerId, index: c.index, mask: c.camera.layerMask }));
      const gcam = camOf(arg.goblinId);
      return {
        splitScreen: true,
        cams: camInfo,
        avatars,
        goblinBit: gcam ? bit(gcam.index) : null,
        // la camera del Goblin NON deve avere il bit del proprio avatar; le altre sì
        ownSeesOwn: gcam ? (gcam.camera.layerMask & bit(gcam.index)) !== 0 : null,
        othersSeeGoblin: ss.cams.filter((c) => c.playerId !== arg.goblinId).map((c) => (c.camera.layerMask & (gcam ? bit(gcam.index) : 0)) !== 0)
      };
    }, { goblinId: goblin?.id });
    if (PROBE) info(`fps: ${JSON.stringify(infoFps)}`);
    check(infoFps?.splitScreen === true, `FPS: split-screen a ${infoFps?.cams?.length ?? 0} finestre`);
    const gAvatar = infoFps?.avatars?.find((a) => a.isGoblinPlayer);
    check(gAvatar?.goblin?.state === 'ready' && gAvatar?.goblin?.bones === 65, `FPS: Goblin importato sugli avversari (${gAvatar?.goblin?.state}, ossa ${gAvatar?.goblin?.bones})`);
    check(infoFps?.ownSeesOwn === false, 'FPS: la finestra del Goblin NON vede il proprio corpo (maschera di layer)');
    check((infoFps?.othersSeeGoblin ?? []).every((v) => v === true) && (infoFps?.othersSeeGoblin ?? []).length > 0, `FPS: le altre finestre vedono il Goblin (${JSON.stringify(infoFps?.othersSeeGoblin)})`);
    check((gAvatar?.masks ?? []).every((m) => m === infoFps?.goblinBit), `FPS: mesh importate con la stessa maschera della capsula (${JSON.stringify(gAvatar?.masks)})`);
    await shot(page, 'fps-new');

    // LOCOMOZIONE: la clip del Goblin deve AVANZARE mentre si muove e FERMARSI da fermo (prima non veniva
    // aggiornata: gli avversari scivolavano in una posa fissa).
    const gRead = () =>
      sceneEval(
        page,
        'fps',
        (g, arg) => {
          const r = g.splitScreen?.avatars?.get(arg.id);
          return r?.goblin?.debug() ?? null;
        },
        { id: goblin?.id }
      );
    const s0 = await gRead();
    await stick(page, 0, 0, -1); // spinge il Goblin in avanti (solo input, nessuna modifica di gioco)
    await sleep(1100);
    const s1 = await gRead();
    await sleep(800);
    const s2 = await gRead();
    await stick(page, 0, 0, 0);
    await sleep(900);
    const s3 = await gRead();
    await sleep(800);
    const s4 = await gRead();
    info(`fps clip: fermo ${s0?.animationSpeed}/${s0?.animationFrame} → corsa ${s1?.animationSpeed}/${s1?.animationFrame} → ${s2?.animationFrame} → fermo ${s3?.animationSpeed}/${s3?.animationFrame} → ${s4?.animationFrame}`);
    check(s0?.animationSpeed === 0, `FPS: da fermo la clip è ferma (velocità ${s0?.animationSpeed})`);
    check((s1?.animationSpeed ?? 0) > 0.5, `FPS: in movimento la clip avanza (velocità ${s1?.animationSpeed?.toFixed?.(2)})`);
    check(Math.abs((s2?.animationFrame ?? 0) - (s1?.animationFrame ?? 0)) > 0.5, `FPS: il fotogramma cambia mentre si muove (${s1?.animationFrame} → ${s2?.animationFrame})`);
    check(s3?.animationSpeed === 0, `FPS: tornato fermo la clip si ferma (velocità ${s3?.animationSpeed})`);
    check(Math.abs((s4?.animationFrame ?? 0) - (s3?.animationFrame ?? 0)) < 0.05, `FPS: da fermo il fotogramma non scivola (${s3?.animationFrame} → ${s4?.animationFrame})`);

    // avvicina i due giocatori per avere anche la PROVA A VISTA: il Goblin deve comparire nella finestra dell'altro
    await stick(page, 0, 0, -1);
    await stick(page, 1, 0, -1);
    for (let i = 0; i < 4; i++) {
      await sleep(1400);
      await shot(page, `fps-new-approach-${i}`);
    }
    await stick(page, 0, 0, 0);
    await stick(page, 1, 0, 0);
    check(errs.length === 0, `FPS: nessun errore${errs.length ? ' ' + errs.slice(0, 2).join(' | ') : ''}`);
  } finally {
    await browser.close();
  }
}

/**
 * Come `addPhone` di lib.mjs, con attese più larghe: in headless con GL software questo PC impiega più dei 10-15 s
 * previsti perché il telefono riceva l'elenco personaggi dal server.
 */
async function addPhoneSlow(browser, code, name, charIndex) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log(`  [phone ${name} pageerror]`, String(e).slice(0, 200)));
  try {
    await page.goto(`${CTRL_URL}?room=${code}`, { waitUntil: 'load' });
    await page.waitForSelector('#name', { timeout: 30000 });
    await page.type('#name', name);
    await page.click('#go');
    await page.waitForSelector('#chars .char', { timeout: 45000 });
    const btns = await page.$$('#chars .char');
    await btns[charIndex].click();
    await page.waitForFunction(() => document.querySelector('#chars .char.mine') && !document.querySelector('#ready')?.disabled, { timeout: 30000 });
    await page.click('#ready');
    await page.waitForFunction(() => /PRONTO ✅/.test(document.getElementById('ready')?.textContent ?? ''), { timeout: 30000 });
    return { page, ctx, name };
  } catch (e) {
    const state = await page
      .evaluate(() => ({
        chars: document.querySelectorAll('#chars .char').length,
        mine: document.querySelectorAll('#chars .char.mine').length,
        ready: document.getElementById('ready')?.textContent ?? null,
        text: (document.getElementById('app')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160)
      }))
      .catch(() => null);
    console.log(`  [phone ${name}] stato al fallimento: ${JSON.stringify(state)}`);
    throw e;
  }
}

if (FLOW) await flowPart();
else await galleryPart();

console.log(fails === 0 ? '\nTUTTO OK' : `\n${fails} FALLITI`);
process.exit(fails === 0 ? 0 : 1);
