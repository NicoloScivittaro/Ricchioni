// AMBIENTI — selftest (galleria ?environments=1 + un minigioco vero):
//  - ogni ambiente 3D e ogni scenografia 2D si costruisce senza errori, a MEDIUM e a LOW
//  - nessuna mesh decorativa collidibile, al massimo 3 luci, la scena disegna davvero qualcosa
//  - il cielo/le nuvole/i profili NON entrano nel bagliore (cielo bianco a HIGH: bug storico)
//  - OCCLUSIONE: nei 4 giochi "da arena" nessun oggetto di scena sta fra la camera di gioco e i personaggi
//  - in partita: validatore (window.__envStats) e scala di grigi (G) funzionano
//   node scripts/e2e/environment-selftest.mjs
import { launch, HOST_URL, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { makeCheck, until } from './padmock.mjs';

const { check, st } = makeCheck();
const browser = await launch();
try {
  for (const quality of ['medium', 'low', 'high']) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
    await page.goto(`${HOST_URL}?environments=1&quality=${quality}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__envGallery, { timeout: 60000 });
    const ids = await page.evaluate(() => window.__envGallery.ids());
    const only = quality === 'high' ? ['arena', 'soccer', 'volleyball', 'kart1', 'fps-center'] : ids;
    for (const id of only) {
      await page.evaluate((a) => window.__envGallery.show(a, 'game'), id);
      await sleep(id.startsWith('2d-') ? 900 : 1300);
      if (id.startsWith('2d-')) continue;
      const r = await page.evaluate(() => {
        const sc = window.__envGallery.scene();
        const s = window.__envGallery.stats();
        // bagliore: niente cielo / nuvole / profili lontani dentro il GlowLayer
        const glow = (sc.effectLayers ?? []).find((l) => l.getClassName() === 'GlowLayer');
        const ex = glow ? glow._thinEffectLayer?._excludedMeshes ?? glow._excludedMeshes ?? [] : [];
        const needEx = sc.meshes.filter((m) => /^skyDome$|^clouds$|^skyline_/.test(m.name)).map((m) => m.uniqueId);
        const missing = glow ? needEx.filter((u) => !ex.includes(u)).length : 0;
        return { s, glow: !!glow, missing, nSky: needEx.length };
      });
      const s = r.s;
      check(!!s && s.collidable === 0 && s.lights <= 3 && s.activeMeshes > 10, `[${quality}] ${id}: mesh ${s?.meshes} attive ${s?.activeMeshes} · luci ${s?.lights} · collidibili ${s?.collidable}`);
      if (r.glow) check(r.missing === 0, `[${quality}] ${id}: cielo/nuvole/profili fuori dal bagliore (${r.nSky} mesh, mancanti ${r.missing})`);
      if (quality === 'medium' && ['arena', 'dodgeball', 'soccer', 'volleyball'].includes(id)) {
        // OCCLUSIONE: raggio camera -> petto di ogni personaggio; nessuna DECORAZIONE in mezzo (la rete della pallavolo e' gioco)
        const occ = await page.evaluate(() => {
          const sc = window.__envGallery.scene();
          const cam = sc.activeCamera;
          const B = cam.position.constructor; // Vector3
          const roots = sc.transformNodes.filter((t) => t.name === 'arenaChar');
          const bad = [];
          for (const r of roots) {
            const target = r.getAbsolutePosition().add(new B(0, 1, 0));
            const dir = target.subtract(cam.position);
            const dist = dir.length();
            const ray = new (sc.constructor.Ray ?? cam.getForwardRay().constructor)(cam.position, dir.normalize(), dist - 0.6);
            const hits = sc.multiPickWithRay(ray, (m) => m.isEnabled() && m.isVisible && !m.isDescendantOf?.(r) && !/char|Char|name|label|ring|trail|shadow|ball|edgeRing|marker|^net/i.test(m.name));
            for (const h of hits ?? []) if (h.hit && h.distance < dist - 0.6) bad.push(`${h.pickedMesh.name}@${h.distance.toFixed(1)}`);
          }
          return { n: roots.length, bad };
        });
        check(occ.n > 0 && occ.bad.length === 0, `${id}: nessuna decorazione fra camera e personaggi (${occ.n} controllati${occ.bad.length ? ': ' + occ.bad.join(', ') : ''})`);
      }
    }
    // test dei valori in galleria
    await page.evaluate(() => window.__envGallery.show('soccer', 'game'));
    await sleep(800);
    await page.evaluate(() => window.__envGallery.gray(true));
    await sleep(500);
    await page.evaluate(() => window.__envGallery.gray(false));
    check(errs.length === 0, `[${quality}] galleria senza errori${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }

  // ---- in partita: validatore e scala di grigi
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 0 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  for (let i = 0; i < 2; i++) await addPhone(browser, code, `P${i + 1}`, i);
  await hostEval(page, (gm) => gm.selectMinigame('arena'));
  if ((await hostSnapshot(page)).phase === 'LOBBY') {
    await sleep(300);
    await page.keyboard.press('Enter');
  }
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 120000, 'arena PLAYING');
  await sleep(1500);
  const live = await page.evaluate(() => window.__envStats?.());
  check(!!live && live.collidable === 0 && live.meshes > 50, `in partita: validatore attivo (mesh ${live?.meshes}, materiali ${live?.materials}, luci ${live?.lights}, collidibili ${live?.collidable})`);
  await page.evaluate(() => window.__envGray?.(true));
  await sleep(600);
  await page.evaluate(() => window.__envGray?.(false));
  await sleep(300);
  check(errs.length === 0, `in partita: scala di grigi ON/OFF senza errori${errs.length ? ': ' + errs.join(' | ') : ''}`);
} finally {
  await browser.close();
}
process.exit(st.fails === 0 ? 0 : 1);
