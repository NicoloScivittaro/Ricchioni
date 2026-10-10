import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { installMock, add, remove, btn, tap, XBOX, DS, GENERIC, sceneEval, startGame, until, watchControls } from './padmock.mjs';
import { visualCounters } from './tripo-counters.mjs';
const dir = 'docs/agent-work/fps-ads', report = { errors: [] };
const browser = await launch();
const F = (page, fn, arg) => sceneEval(page, 'fps', fn, arg);
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3 });
  page.on('pageerror', e => report.errors.push('HOST ' + String(e)));
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const ph = await addPhone(browser, code, `ADS${i}`, i);
    ph.page.on('pageerror', e => report.errors.push(`PHONE${i} ${e}`)); phones.push(ph);
  }
  const ids = await hostEval(page, gm => gm.state.players.map(p => p.id));
  await installMock(page, 5); await watchControls(page);
  const families = [XBOX, DS, GENERIC, XBOX + ' second', DS + ' second'];
  for (let i = 0; i < 5; i++) {
    await add(page, i, families[i]); await sleep(250);
    await page.evaluate(id => window.__pads.setTarget(id), ids[i]); await tap(page, i, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  await startGame(page, 'fps');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 30000, 'controls visible');
  await page.screenshot({ path: `${dir}/controls.png` });
  await until(async () => await F(page, g => g.controlsDone && g.splitScreen?.cams.length === 5), 60000, 'five cameras and controls');
  assert.ok(await page.evaluate(() => /MIRA.*TIENI/.test(window.__cc.text) && /RICARICA/.test(window.__cc.text)));
  await F(page, g => { g.matchTime = 250; });
  await btn(page, 0, 'LT', true); await sleep(500);
  report.five = await F(page, g => g.players.map((p, i) => ({ ads: p.ads, fov: g.splitScreen.cams[i].camera.fov, vm: g.splitScreen.cams[i].vm.ads })));
  assert.equal(report.five[0].ads, 1); assert.ok(report.five.slice(1).every(p => p.ads === 0));
  assert.ok(report.five[0].fov < report.five[1].fov); assert.equal(report.five[0].vm, 1);
  await page.screenshot({ path: `${dir}/five-split-ads.png` });
  await btn(page, 0, 'LT', false); await sleep(300);
  assert.equal(await F(page, g => g.players[0].ads), 0);
  await btn(page, 1, 'LT', true); await btn(page, 2, 'LT', true);
  await until(async () => await F(page, g => g.players[1].ads === 1 && g.players[2].ads === 1), 5000, 'DualSense and generic ADS');
  assert.ok(await F(page, g => g.players.filter((p, i) => i !== 1 && i !== 2).every(p => p.ads === 0)));
  await btn(page, 1, 'LT', false); await btn(page, 2, 'LT', false); await sleep(350); report.mixedBindings = true;
  console.log('PASS: five split-screen cameras; ADS belongs to its player and LT controls help');

  report.core = await hostEval(page, async gm => {
    const { getWeapon } = await import('/shared/fpsWeapons.ts');
    const g = gm.game.scene.getScene('fps'), [p, target] = g.players, input = g.ctx.input.get(p.id);
    const originalSignal = g.ctx.signal, originalRng = g.ctx.rng.next;
    const signals = []; g.ctx.signal = (id, msg) => signals.push({ id, ...msg });
    const saved = g.players.map(p => ({ ...p, bag: [...p.bag] }));
    try {
      let seed = 1;
      g.ctx.rng.next = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const prepare = () => {
        g.resetAim(p); input.cancelAll(); p.cancelVersion = input.cancellationVersion;
        Object.assign(p, { x: 12, z: -14, yaw: 0, pitch: 0, alive: true, hp: 100, stunTime: 0, lockTime: 0, dashTime: 0, reloading: false, fireCooldown: 999, burstLeft: 0, weaponId: 'mitraglia', magazine: 10000 });
        Object.assign(target, { x: 12, z: -11, alive: true, hp: 100000, spawnProtection: 0 });
        for (const other of g.players.slice(2)) { other.x = -20; other.z = 20; }
      };
      prepare(); input.setAxis('move', 0, -1);
      for (let i = 0; i < 20; i++) g.stepPlayer(p, 0.01);
      const hipMove = p.z + 14;
      prepare(); p.ads = 1; input.setDown('aim'); input.setAxis('move', 0, -1);
      for (let i = 0; i < 20; i++) g.stepPlayer(p, 0.01);
      const adsMove = p.z + 14;
      prepare(); input.setAxis('lookStick', 1, 0); g.stepPlayer(p, 0.1); const hipLook = p.yaw;
      prepare(); p.ads = 1; input.setDown('aim'); input.setAxis('lookStick', 1, 0); g.stepPlayer(p, 0.1); const adsLook = p.yaw;
      const precision = [];
      for (const dist of [3, 28]) for (const ads of [0, 1]) {
        prepare(); target.z = p.z + dist; p.ads = ads; seed = 1;
        let hits = 0;
        for (let i = 0; i < 300; i++) {
          p.recoilPitch = p.recoilYaw = p.heat = 0;
          const hp = target.hp; g.fireShot(p, getWeapon('mitraglia')); if (target.hp < hp) hits++;
        }
        precision.push({ dist, ads, hits, samples: 300 });
      }
      prepare(); p.ads = 1; g.fireShot(p, getWeapon('mitraglia'));
      const recoil = { pitch: p.recoilPitch, yaw: p.recoilYaw };
      prepare(); target.spawnProtection = 1; const from = signals.length;
      g.fireShot(p, getWeapon('mitraglia')); const protectedHits = signals.slice(from).filter(s => s.type === 'hit').length;
      prepare(); p.ads = 1; p.recoilPitch = 0.1; p.burstLeft = 2; const yaw = p.yaw = 1;
      input.cancelAll(); g.stepPlayer(p, 0.01);
      const cancelled = { ads: p.ads, recoil: p.recoilPitch, burst: p.burstLeft, yaw: p.yaw, originalYaw: yaw };
      prepare(); target.yaw = Math.PI / 2; target.recoilYaw = 0; const n = signals.length;
      g.applyDamage(target, 1, p, { x: target.x + 3, z: target.z });
      const damageDirection = signals.slice(n).find(s => s.type === 'damaged').direction;
      prepare(); p.ads = 1; input.setDown('aim'); g.startReload(p, getWeapon('mitraglia'));
      const reloadAds = p.ads;
      return { hipMove, adsMove, hipLook, adsLook, precision, recoil, protectedHits, cancelled, damageDirection, reloadAds };
    } finally {
      g.ctx.signal = originalSignal; g.ctx.rng.next = originalRng;
      g.players.forEach((p, i) => { Object.assign(p, saved[i]); g.ctx.input.cancelPlayer(p.id); });
    }
  });
  const c = report.core;
  assert.ok(Math.abs(c.adsMove / c.hipMove - 0.75) < 1e-8);
  assert.ok(Math.abs(c.adsLook / c.hipLook - 0.65) < 1e-8);
  assert.equal(c.precision[0].hits, 300); assert.equal(c.precision[1].hits, 300);
  assert.ok(c.precision[3].hits > c.precision[2].hits);
  assert.ok(c.recoil.pitch > 0); assert.equal(c.protectedHits, 0);
  assert.equal(c.cancelled.ads, 0); assert.equal(c.cancelled.burst, 0); assert.equal(c.cancelled.yaw, c.cancelled.originalYaw);
  assert.equal(c.reloadAds, 0); assert.ok(Math.abs(c.damageDirection) < 1e-8);
  console.log('PASS: authoritative movement/look penalties, short/long range hits, actual recoil, protected hit filtering, cancellation and blast direction', JSON.stringify(c.precision));

  await btn(page, 0, 'LT', true); await sleep(300); await page.keyboard.press('Escape');
  await sleep(400); const time = await F(page, g => g.clock); await btn(page, 0, 'LT', false); await sleep(300);
  assert.equal(await F(page, g => g.clock), time); assert.equal(await F(page, g => g.players[0].ads), 0);
  await page.keyboard.press('Escape'); await sleep(400); assert.equal(await F(page, g => g.players[0].ads), 0);
  report.pause = true;
  await remove(page, 4); const phone = phones[4].page;
  await phone.waitForSelector('#fps-aim', { timeout: 30000 });
  await sleep(2500);
  const client = await phone.createCDPSession(); await client.send('Network.enable');
  const signals = []; client.on('Network.webSocketFrameReceived', ({ response }) => {
    if (response.payloadData.startsWith('42')) try {
      const [event, msg] = JSON.parse(response.payloadData.slice(2));
      if (event === 'controller:signal' && ['hit', 'damaged'].includes(msg.type)) signals.push(msg);
    } catch {}
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 4 });
  const boxes = await phone.evaluate(() => {
    const center = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    return { joy: center('.arena-joy-base'), aim: center('#fps-aim'), fire: center('#fps-fire'), look: { x: 145, y: 340 } };
  });
  const touch = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const a = { ...boxes.aim, id: 1 }, f = { ...boxes.fire, id: 2 }, l = { ...boxes.look, id: 3 };
  await touch('touchStart', [a]); await sleep(400);
  await until(async () => (await F(page, (g, id) => g.players.find(p => p.id === id).ads, ids[4])) === 1, 5000, 'phone ADS complete');
  const before = await F(page, (g, id) => g.players.find(p => p.id === id).yaw, ids[4]);
  await touch('touchStart', [a, f, l]); await touch('touchMove', [a, f, { ...l, x: l.x + 35 }]); await sleep(600);
  const during = await F(page, (g, id) => { const p = g.players.find(p => p.id === id); return { ads: p.ads, shots: p.shotsFired, yaw: p.yaw, firing: g.ctx.input.get(id).pressed('fire') }; }, ids[4]);
  assert.equal(during.ads, 1); assert.ok(during.firing && during.shots > 0 && Math.abs(during.yaw - before) > 0.02);
  await touch('touchMove', [{ ...a, x: a.x - 50 }, f, l]);
  assert.equal(await phone.$eval('#fps-aim', el => el.getAttribute('aria-pressed')), 'true');
  const phoneCamera = () => phone.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(n => /@babylonjs_core.js/.test(n));
    const { Engine } = await import(url);
    const engine = Engine.Instances.at(-1), camera = engine.scenes[0].activeCamera;
    return { fov: camera.fov, zoom: Math.tan(0.8 / 2) / Math.tan(camera.fov / 2) };
  });
  await until(async () => { report.phoneCamera = await phoneCamera(); return Math.abs(report.phoneCamera.zoom - 1.3) < 0.001; }, 10000, 'phone ADS camera settled');
  const beforeMove = await F(page, (g, id) => { const p = g.players.find(p => p.id === id); return { x: p.x, z: p.z }; }, ids[4]);
  const j = { ...boxes.joy, id: 4 };
  await touch('touchStart', [a, f, l, j]);
  await touch('touchMove', [a, f, l, { ...j, y: j.y - 35 }]);
  await until(async () => await F(page, (g, id) => g.ctx.input.get(id).axis('move').y < -0.1, ids[4]), 5000, 'fourth-finger movement');
  await sleep(400);
  const moving = await F(page, (g, id) => { const p = g.players.find(p => p.id === id); return { x: p.x, z: p.z, ads: p.ads, fire: g.ctx.input.get(id).pressed('fire') }; }, ids[4]);
  assert.equal(moving.ads, 1); assert.ok(moving.fire && Math.hypot(moving.x - beforeMove.x, moving.z - beforeMove.z) > 0.1);
  report.phoneFourFingers = moving;
  await phone.screenshot({ path: `${dir}/phone-ads-touch.png` });
  await touch('touchEnd', []); await sleep(400);
  await until(async () => (await F(page, (g, id) => g.players.find(p => p.id === id).ads, ids[4])) === 0, 5000, 'phone ADS released');
  report.phoneMultitouch = during;
  // Cancellation removes pointer ownership, not just the network button state.
  await touch('touchStart', [a]); await sleep(300); await phone.evaluate(() => window.dispatchEvent(new Event('blur'))); await sleep(300);
  await until(async () => (await F(page, (g, id) => g.players.find(p => p.id === id).ads, ids[4])) === 0, 5000, 'phone ADS released');
  assert.equal(await phone.$eval('#fps-aim', el => el.getAttribute('aria-pressed')), 'false');
  await touch('touchEnd', []);
  await touch('touchStart', [a]); await sleep(300);
  await until(async () => (await F(page, (g, id) => g.players.find(p => p.id === id).ads, ids[4])) === 1, 5000, 'phone ADS complete');
  await touch('touchEnd', []); report.phoneCancelRearm = true;
  console.log('PASS: real three-finger touch ADS + fire + look; capture outside button; blur cancel/rearm');

  // Host confirmed hit reaches phone; capture its native weapon sight for all six weapons.
  await F(page, (g, id) => {
    const p = g.players.find(p => p.id === id), target = g.players[0];
    p.x = 12; p.z = -14; p.spawnProtection = 0;
    target.x = 12; target.z = -11; target.hp = 100; target.alive = true; target.spawnProtection = 0;
    p.yaw = 0; p.pitch = 0; g.ctx.input.get(id).setAxis('look', 0, 0);
    p.weaponId = 'laser'; p.magazine = 5; p.reloading = false; p.fireCooldown = 0; p.ads = 1;
    g.fireShot(p, { ...{ id: 'laser', damage: 55, fireRate: 1.05, range: 60, spread: 0, magazine: 5, reload: 2.2, projectileSpeed: 0, splashRadius: 0, movementModifier: 0.94, difficulty: 'ALTA' } });
  }, ids[4]);
  await until(() => signals.some(s => s.type === 'hit'), 3000, 'phone confirmed hit'); report.confirmedHit = true;
  const weapons = ['mitraglia', 'spaccatutto', 'laser', 'raffica', 'bombarda', 'sparapiselli'];
  for (const weapon of weapons) {
    await F(page, (g, arg) => {
      const p = g.players.find(p => p.id === arg.id); g.resetAim(p); p.weaponId = arg.weapon; p.magazine = 5; p.reloading = false; p.alive = true;
      g.ctx.input.get(p.id).setDown('aim'); g.broadcastState();
    }, { id: ids[4], weapon });
    await sleep(850); await phone.screenshot({ path: `${dir}/phone-${weapon}-ads.png` });
  }
  const samples = [];
  for (let i = 0; i < 5; i++) { await sleep(1000); samples.push(await F(page, g => ({ fps: g.splitScreen.engine.getFps(), meshes: g.splitScreen.scene.meshes.length }))); }
  report.renderSamples = samples;
  // Natural scene end, accelerated simulation time only; no fabricated result.
  await F(page, g => { g.matchTime = 0.01; });
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 15000, 'natural results');
  report.results = await hostEval(page, gm => gm.state.lastResults.results);
  await hostEval(page, gm => gm.restartMatch());
  await until(async () => (await hostSnapshot(page)).phase === 'LOBBY', 10000, 'lobby');
  await sleep(600); report.cleanup = { counters: await visualCounters(page), canvases: await page.evaluate(() => document.querySelectorAll('canvas').length) };
  assert.equal(report.cleanup.counters.liveInstances, 0); assert.equal(report.cleanup.canvases, 1);
  assert.deepEqual(report.errors, []);
  console.log('PASS: all six sights; confirmed hit; natural round end and zero residual character instances');
} finally {
  writeFileSync(`${dir}/browser.json`, JSON.stringify(report, null, 2)); await browser.close();
}
