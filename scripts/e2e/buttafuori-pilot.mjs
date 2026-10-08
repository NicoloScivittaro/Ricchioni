import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launch, HOST_URL, sleep, hostEval } from './lib.mjs';
const browser = await launch(), report = {};
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${HOST_URL}?characters=1&buttafuori=new&goblin=new&judoka=new`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gallery?.sample().filter(s => s?.state === 'ready').length === 3, { timeout: 60000 });
  report.mixed = await page.evaluate(() => window.__gallery.sample().filter(Boolean));
  assert.ok(report.mixed.some(s => s.character === 'goblin' && s.clips === 36));
  assert.ok(report.mixed.some(s => s.character === 'judoka' && s.clips === 37));
  assert.ok(report.mixed.some(s => s.character === 'buttafuori' && s.clips === 0 && s.procedural));
  await page.evaluate(() => window.__gallery.setButtafuoriLayout('compare'));
  await page.waitForFunction(() => window.__gallery.sample().filter(s => s?.state === 'ready').length === 1);
  await sleep(600); await page.screenshot({ path: 'e2e-shots/detailed-character/legacy-tripo.png' });
  await page.evaluate(() => window.__gallery.setButtafuoriLayout(1));
  await page.waitForFunction(() => window.__gallery.sample()[0]?.state === 'ready');
  report.poses = {};
  for (const state of ['IDLE', 'RUN', 'JUMP', 'DASH', 'ATTACK', 'HIT', 'STUN', 'ABILITY', 'VICTORY', 'DEFEAT']) {
    await page.evaluate(s => window.__gallery.setState(s), state);
    await sleep(400);
    const sample = await page.evaluate(() => window.__gallery.sample()[0]);
    assert.equal(sample.bones, 65); assert.equal(sample.clips, 0); assert.equal(sample.activeTracks, 0);
    assert.equal(sample.animationPlaying, false);
    assert.ok(Object.values(sample.joints).flat().every(Number.isFinite));
    assert.deepEqual(sample.hipsNow, sample.restHips);
    report.poses[state] = sample;
    await page.screenshot({ path: `e2e-shots/detailed-character/gallery-${state.toLowerCase()}.png` });
  }
  assert.notDeepEqual(report.poses.RUN.joints, report.poses.IDLE.joints, 'skin joints actually move');
  await page.evaluate(() => { window.__gallery.setButtafuoriLayout(5); window.__gallery.setState('RUN'); });
  await page.waitForFunction(() => window.__gallery.sample().filter(s => s?.state === 'ready').length === 5);
  await sleep(1200);
  report.five = await page.evaluate(() => ({ samples: window.__gallery.sample(), perf: window.__gallery.perf(), cost: window.__gallery.animationCost() }));
  assert.equal(new Set(report.five.samples.map(s => s.skeletonId)).size, 5);
  assert.equal(new Set(report.five.samples.flatMap(s => s.geometryIds).filter(n => n >= 0)).size, 1);
  await page.evaluate(() => window.__gallery.setButtafuori('old'));
  assert.ok(await page.evaluate(() => window.__gallery.sample().every(s => s === null)));
  await page.goto(`${HOST_URL}?debug=1&buttafuori=new`, { waitUntil: 'load' });
  await hostEval(page, gm => {
    const players = [0, 1].map(i => ({ id: `b${i}`, characterId: 'buttafuori', displayName: i ? 'SCONFITTO' : 'VINCITORE', name: 'Buttafuori', roleTitle: '', avatar: '🥊', color: '#ef4444', quote: '', score: 0 }));
    gm.state = { players, currentMinigame: { minigameId: 'cornicione', name: 'CORNICIONE', category: 'action' }, lastResults: { results: players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 10 - i, stats: ['DEV'] })), ranking: players.map(p => p.id), deltas: { b0: 3, b1: 0 }, double: false } };
    gm.game.scene.stop('LobbyScene'); gm.game.scene.start('ResultsScene');
  });
  await page.waitForFunction(async () => {
    const u = performance.getEntriesByType('resource').find(e => /GameManager\.ts/.test(e.name))?.name;
    if (!u) return false;
    const { game: gm } = await import(u);
    return gm.game.scene.getScene('ResultsScene').children.list.filter(x => x.type === 'Container').flatMap(c => c.list).filter(x => x.texture?.key?.startsWith('goblin-results') && x.visible).length === 2;
  }, { timeout: 60000 });
  await sleep(800); await page.screenshot({ path: 'e2e-shots/detailed-character/results.png' });
  await hostEval(page, gm => gm.game.scene.stop('ResultsScene'));
  report.counters = await page.evaluate(async () => (await import('/src/minigames/characters/goblinVisual.ts')).goblinVisualCounters());
  assert.equal(report.counters.liveInstances, 0);
  assert.equal(errors.length, 0, errors.join(';')); report.errors = errors;
  writeFileSync('docs/agent-work/detailed-character-pilot/integration.json', JSON.stringify(report, null, 2));
  console.log('Buttafuori: 3 mixed assets, 10 procedural states, independent skins/shared geometry, OLD/NEW, results/disposal: PASS');
} finally { await browser.close(); }
