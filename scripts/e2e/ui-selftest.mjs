// UI — selftest sulla galleria (?ui=1): ogni schermata con 5 giocatori finti (un nome lungo) a piu' risoluzioni.
//  - nessun testo fuori dalla SAFE AREA (48 px ai lati, 32 sopra/sotto, in coordinate di progetto 1280x720)
//  - nessun testo sotto i 14 px di progetto (leggibilita' da divano)
//  - testi nitidi: risoluzione dei testi Phaser adeguata allo schermo (2 a 1080p, 3 a 4K)
//  - telefono: niente scroll orizzontale, campo di Cultura >= 16 px (niente zoom del browser)
//  - nessun errore di pagina; screenshot di ogni schermata in OUT
//   VIEWPORTS=1280x720,1920x1080 OUT=e2e-shots/ui-gallery node scripts/e2e/ui-selftest.mjs
import puppeteer from 'puppeteer-core';
import { CHROME, HOST_URL, sleep } from './lib.mjs';
import { makeCheck } from './padmock.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { check, st } = makeCheck();
const OUT = path.resolve(process.env.OUT ?? 'e2e-shots/ui-gallery');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = (process.env.VIEWPORTS ?? '1280x720,1366x768,1920x1080,2560x1440,3840x2160').split(',');
const SHOTS = new Set((process.env.SHOT_AT ?? '1366x768,1920x1080,3840x2160').split(','));
const SAFE = { x: 48, y: 32 };
// attese per le schermate animate (rivelazioni, podio)
const WAIT = { roulette: 8000, results: 5600, leaderboard: 2200, podium: 9000, memory: 3600, reaction: 2600, quiz: 3800, cultura: 2600, intro: 1200, room: 1600 };

for (const vp of VIEWPORTS) {
  const [w, h] = vp.split('x').map(Number);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--window-size=${w},${h}`],
    defaultViewport: { width: w, height: h }
  });
  const errs = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.goto(`${HOST_URL}?ui=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__uiGallery, { timeout: 60000 });
    await sleep(1500);
    const ids = await page.evaluate(() => window.__uiGallery.ids());
    await page.evaluate(() => window.__uiGallery.hideBar(true));
    for (const id of ids) {
      await page.evaluate((x) => window.__uiGallery.show(x), id);
      await sleep(WAIT[id] ?? 1500);
      if (SHOTS.has(vp)) await page.screenshot({ path: path.join(OUT, `${id}-${vp}.png`) });
      if (id.startsWith('phone-')) {
        const ph = await page.evaluate(() => {
          const f = document.querySelector('iframe');
          const d = f?.contentDocument;
          if (!d) return null;
          const inp = d.querySelector('input');
          return { overflow: d.documentElement.scrollWidth - d.documentElement.clientWidth, input: inp ? parseFloat(getComputedStyle(inp).fontSize) : null, text: (d.body.innerText || '').slice(0, 60) };
        });
        check(!!ph && ph.overflow <= 1 && (ph.input === null || ph.input >= 16), `[${vp}] ${id}: niente scroll orizzontale${ph?.input ? `, campo ${ph.input}px` : ''} ("${(ph?.text ?? '').replace(/\s+/g, ' ')}")`);
        continue;
      }
      if (id.startsWith('hud-') || id === 'controls' || id === 'controls-phone' || id === 'disconnect' || id === 'error') {
        // DOM/3D: dentro lo schermo, niente elementi tagliati
        const dom = await page.evaluate(() => {
          const els = [...document.querySelectorAll('.ui-card, .ui-alert, .ui-toast')].filter((e) => e.getBoundingClientRect().width > 0);
          return els.map((e) => {
            const r = e.getBoundingClientRect();
            return { cls: e.className, l: r.left, t: r.top, r: r.right, b: r.bottom, W: innerWidth, H: innerHeight };
          });
        });
        const bad = dom.filter((d) => d.l < 0 || d.t < 0 || d.r > d.W || d.b > d.H);
        check(bad.length === 0, `[${vp}] ${id}: pannelli dentro lo schermo (${dom.length})${bad.length ? ' FUORI: ' + JSON.stringify(bad[0]) : ''}`);
        continue;
      }
      const res = await page.evaluate((safe) => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n)) ?? '/src/core/GameManager.ts';
        return import(url).then(({ game: gm }) => {
          const g = gm.game;
          const active = g.scene.getScenes(true);
          const out = [];
          const walk = (o, sc) => {
            if (!o.visible || o.alpha === 0) return;
            if (o.list) for (const c of o.list) walk(c, sc);
            if (o.type !== 'Text' || !o.text || !o.text.trim()) return;
            if (o.depth <= -90) return; // scenografia (insegne del fondale): non e' UI
            const b = o.getBounds();
            let ea = o.alpha;
            for (let c = o.parentContainer; c; c = c.parentContainer) ea *= c.alpha;
            if (ea < 0.35) return; // spento/decorativo (carte del rullo non uscite): non e' testo da leggere
            if (b.right < 0 || b.x > 1280) return; // fuori dallo schermo (es. carte del rullo non visibili): non e' testo mostrato
            const fs = parseFloat(o.style.fontSize) * Math.abs(o.scaleY) * (o.parentContainer ? Math.abs(o.parentContainer.scaleY) : 1);
            out.push({ t: o.text.replace(/\s+/g, ' ').slice(0, 40), x0: b.x, y0: b.y, x1: b.right, y1: b.bottom, fs, res: o.style.resolution, scene: sc });
          };
          for (const s of active) for (const o of s.children.list) walk(o, s.scene.key);
          const outside = out.filter((o) => o.x0 < safe.x - 2 || o.x1 > 1280 - safe.x + 2 || o.y0 < safe.y - 4 || o.y1 > 720 - safe.y + 4);
          const small = out.filter((o) => o.fs < 14);
          return { n: out.length, outside: outside.slice(0, 4), small: small.slice(0, 4), res: Math.min(...out.map((o) => o.res ?? 1)) };
        });
      }, SAFE);
      check(res.n > 0 && res.outside.length === 0, `[${vp}] ${id}: ${res.n} testi dentro la safe area${res.outside.length ? ' — FUORI: ' + res.outside.map((o) => `"${o.t}" [${o.x0.toFixed(0)},${o.y0.toFixed(0)}–${o.x1.toFixed(0)},${o.y1.toFixed(0)}]`).join(' · ') : ''}`);
      check(res.small.length === 0, `[${vp}] ${id}: nessun testo sotto 14px${res.small.length ? ' — PICCOLI: ' + res.small.map((o) => `"${o.t}" ${o.fs.toFixed(0)}px`).join(' · ') : ''}`);
      const want = w >= 3000 ? 3 : w >= 1500 ? 2 : 1;
      check(res.res >= want, `[${vp}] ${id}: testi nitidi (risoluzione ${res.res}, serve ${want})`);
    }
    check(errs.length === 0, `[${vp}] nessun errore di pagina${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  } finally {
    await browser.close();
  }
}
process.exit(st.fails === 0 ? 0 : 1);
