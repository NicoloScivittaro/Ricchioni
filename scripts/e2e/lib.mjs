// Helper E2E: host Phaser + telefoni reali (controller.html) in Chrome headless, contro server locale + vite dev.
import puppeteer from 'puppeteer-core';

export const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const HOST_URL = process.env.HOST_URL ?? 'http://localhost:5173/';
export const CTRL_URL = process.env.CTRL_URL ?? 'http://localhost:5173/controller.html';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1300,760'
    ],
    defaultViewport: (() => {
      const m = /^(\d+)x(\d+)$/.exec(process.env.VIEWPORT ?? '');
      return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1280, height: 720 };
    })()
  });
}

/** Esegue codice nel contesto della pagina host con `gm` (GameManager) a disposizione. */
export async function hostEval(page, fn, arg) {
  return page.evaluate(
    async (fnSrc, a) => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n)) ?? '/src/core/GameManager.ts';
      const { game: gm } = await import(url);
      // eslint-disable-next-line no-new-func
      const f = new Function('gm', 'arg', `return (${fnSrc})(gm, arg);`);
      return await f(gm, a);
    },
    fn.toString(),
    arg
  );
}

export async function hostSnapshot(page) {
  return hostEval(page, (gm) => {
    const g = gm.game;
    const overlays = [...document.querySelectorAll('canvas')].filter((c) => c.style.zIndex === '10000').length;
    return {
      phase: gm.state?.phase ?? null,
      round: gm.state?.round ?? null,
      roundId: gm.state?.roundId ?? null,
      active: g.scene.getScenes(true).map((s) => s.scene.key),
      overlays,
      pending: gm.pendingMinigame?.minigameId ?? null,
      scores: gm.state?.players.map((p) => `${p.displayName}:${p.score}`).join(',') ?? null
    };
  });
}

export async function phoneView(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    return {
      h1: app?.querySelector('h1')?.textContent?.trim() ?? '',
      text: (app?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 90),
      pause: !!document.getElementById('pause-overlay')
    };
  });
}

export async function createRoomOnHost(browser, { targetKeyPresses = 0 } = {}) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [host pageerror]', String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [host console.error]', m.text().slice(0, 200));
  });
  await page.goto(HOST_URL, { waitUntil: 'load' });
  await page.waitForFunction(
    () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
      return !!url;
    },
    { timeout: 30000 }
  );
  await page.waitForFunction(
    async () => {
      try {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
        const { game: gm } = await import(url);
        return !!gm.game && gm.game.scene.getScenes(true).some((s) => s.scene.key === 'LobbyScene');
      } catch {
        return false;
      }
    },
    { timeout: 30000 }
  );
  await sleep(300);
  for (let i = 0; i < targetKeyPresses; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // crea la stanza
  await page.waitForFunction(
    async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n));
      const { game: gm } = await import(url);
      return !!gm.roomCode && gm.game.scene.getScenes(true).some((s) => s.scene.key === 'RoomScene');
    },
    { timeout: 20000 }
  );
  const code = await hostEval(page, (gm) => gm.roomCode);
  return { page, code };
}

export async function addPhone(browser, code, name, charIndex) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log(`  [phone ${name} pageerror]`, String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [phone ${name} console.error]`, m.text().slice(0, 200));
  });
  await page.goto(`${CTRL_URL}?room=${code}`, { waitUntil: 'load' });
  await page.waitForSelector('#name', { timeout: 15000 });
  await page.type('#name', name);
  await page.click('#go');
  await page.waitForSelector('#chars .char', { timeout: 15000 });
  const btns = await page.$$('#chars .char');
  await btns[charIndex].click();
  await page.waitForFunction(() => document.querySelector('#chars .char.mine') && !document.querySelector('#ready')?.disabled, { timeout: 10000 });
  await page.click('#ready');
  await page.waitForFunction(() => /PRONTO ✅/.test(document.getElementById('ready')?.textContent ?? ''), { timeout: 10000 });
  return { page, ctx, name };
}

export function fmt(o) {
  return JSON.stringify(o);
}

/**
 * TRACCIA lato pagina: registra dentro il browser (ogni 20 ms) ogni cambio di fase/scene dell'host o di titolo del telefono.
 * Serve ai test che verificano fasi BREVI (es. MINIGAME_FINISHED dura 1 s): il polling da Node, con un host lento, puo' perderle
 * senza che il gioco abbia alcun difetto. kind: 'host' | 'phone'.
 */
export async function installTrace(page, kind) {
  await page.evaluate(async (k) => {
    window.__trace = [];
    let gm = null;
    if (k === 'host') {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /GameManager.ts/.test(n)) ?? '/src/core/GameManager.ts';
      gm = (await import(url)).game;
    }
    let last = '';
    const t0 = performance.now();
    window.__traceTimer = setInterval(() => {
      let e;
      if (k === 'host') {
        const ov = [...document.querySelectorAll('canvas')].filter((c) => c.style.zIndex === '10000').length;
        e = { ph: gm.state?.phase ?? null, act: gm.game.scene.getScenes(true).map((s) => s.scene.key), ov };
      } else {
        e = { h1: document.getElementById('app')?.querySelector('h1')?.textContent?.trim() ?? '' };
      }
      const key = JSON.stringify(e);
      if (key !== last) {
        last = key;
        window.__trace.push({ t: Math.round(performance.now() - t0), ...e });
      }
    }, 20);
  }, kind);
}

export async function readTrace(page) {
  return page.evaluate(() => window.__trace ?? []);
}
