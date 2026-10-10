import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
process.env.CTRL_URL = process.env.PROD_CTRL ?? 'http://127.0.0.1:3001/controller.html';
const { launch, addPhone, sleep } = await import('./lib.mjs');
const browser = await launch(), report = { errors: [], accelerated: false, adsStates: [] };
async function until(fn, label, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await sleep(150); }
  throw Error(`Timeout ${label}`);
}
async function observe(page, callback) {
  page.on('pageerror', e => report.errors.push(String(e)));
  const c = await page.createCDPSession(); await c.send('Network.enable');
  c.on('Network.webSocketFrameReceived', ({ response }) => {
    if (!response.payloadData.startsWith('42')) return;
    try { callback(...JSON.parse(response.payloadData.slice(2))); } catch {}
  }); return c;
}
try {
  const host = await browser.newPage(); let state, latest;
  await observe(host, (event, data) => { if (event === 'room:state') state = data; });
  await host.goto('http://127.0.0.1:3001/', { waitUntil: 'load' });
  await host.waitForSelector('#app canvas'); await sleep(1500);
  for (let i = 0; i < 3; i++) { await host.keyboard.press('ArrowRight'); await sleep(180); }
  await host.keyboard.press('Enter'); await until(() => state?.roomCode, 'room');
  const phone = await addPhone(browser, state.roomCode, 'Niko ADS', 4);
  const cd = await observe(phone.page, (event, data) => {
    if (event === 'controller:signal' && data.type === 'fpsState') {
      latest = data;
      const me = data.players.find(p => !state?.players.find(q => q.id === p.id)?.bot);
      if (me?.ads > 0 && report.adsStates.length < 12) report.adsStates.push({ ads: me.ads, firing: me.firing, alive: me.alive, recoilPitch: me.recoilPitch });
    }
  });
  await until(() => state.players.length === 1 && state.players[0].ready, 'ready');
  for (let i = 0; i < 10; i++) { await host.keyboard.press('ArrowRight'); await sleep(180); }
  await host.keyboard.press('Enter');
  await until(() => state.phase === 'MINIGAME_PLAYING' && state.currentMinigame?.minigameId === 'fps', 'FPS');
  assert.equal(state.players.length, 5); assert.equal(state.players.filter(p => p.bot).length, 4);
  const selfId = state.players.find(p => !p.bot).id;
  await phone.page.waitForSelector('#fps-aim'); await sleep(2000);
  await cd.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 3 });
  const boxes = await phone.page.evaluate(() => {
    const center = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    return { aim: center('#fps-aim'), fire: center('#fps-fire') };
  });
  const a = { ...boxes.aim, id: 1 }, f = { ...boxes.fire, id: 2 };
  let simultaneous = false;
  for (let i = 0; i < 5 && !simultaneous; i++) {
    await cd.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, f] });
    for (let n = 0; n < 12; n++) {
      await sleep(100); const me = latest?.players.find(p => p.id === selfId);
      if (me?.ads === 1 && me.firing && me.alive) { simultaneous = true; break; }
    }
    if (simultaneous) await phone.page.screenshot({ path: 'docs/agent-work/fps-ads/production-phone-ads.png' });
    await cd.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (!simultaneous) await sleep(2600);
  }
  assert.ok(simultaneous, 'production phone simultaneous ADS + fire acknowledged');
  await until(() => { const me = latest?.players.find(p => p.id === selfId); return me?.ads === 0 && !me.firing; }, 'ADS release', 8000);
  assert.ok(latest.players.some(p => state.players.find(q => q.id === p.id)?.bot && p.alive));
  report.simultaneous = true;
  console.log('PASS: production bundle, actual phone ADS + fire and release, four bots');
  await until(() => state.phase === 'ROUND_RESULTS' || state.phase === 'MATCH_END', 'natural results', 150000);
  report.results = state.lastResults.results;
  assert.equal(report.results.length, 5); assert.ok(report.results.every(r => r.placement >= 1 && r.placement <= 5));
  assert.deepEqual(report.errors, []);
  report.assets = await host.evaluate(() => performance.getEntriesByType('resource').map(e => new URL(e.name).pathname).filter(p => /\/assets\/(main|FpsScene)-/.test(p)));
  console.log('PASS: production real-time 100s match, five results, no page errors or debug intervention');
} catch (error) { report.failure = String(error); throw error; }
finally { writeFileSync('docs/agent-work/fps-ads/production.json', JSON.stringify(report, null, 2)); await browser.close(); }
