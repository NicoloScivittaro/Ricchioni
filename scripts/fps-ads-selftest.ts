import assert from 'node:assert/strict';
import { FPS_ADS, aimBlend, aimFov, aimMovement, aimSensitivity, aimSpread, aimGap, aimKick } from '../shared/fpsAim';
import { WEAPONS } from '../shared/fpsWeapons';
import { PAD_PROFILES } from '../src/input/profiles';
import { PlayerInput } from '../src/network/PlayerInput';

for (const fps of [30, 60, 120]) {
  let blend = 0;
  for (let i = 0; i < fps; i++) blend = aimBlend(blend, true, 1 / fps);
  assert.equal(blend, 1);
  for (let i = 0; i < fps; i++) blend = aimBlend(blend, false, 1 / fps);
  assert.equal(blend, 0);
}
assert.equal(aimBlend(0, true, FPS_ADS.transition), 1);
assert.equal(aimBlend(1, false, FPS_ADS.transition), 0);
assert.equal(aimMovement(0), 1); assert.equal(aimMovement(1), 0.75);
assert.equal(aimSensitivity(0), 1); assert.equal(aimSensitivity(1), 0.65);
for (const base of [0.8, 1.05]) {
  assert.ok(Math.abs(Math.tan(base / 2) / Math.tan(aimFov(base, 1) / 2) - 1.3) < 1e-12);
}
for (const w of WEAPONS) {
  const hip = aimSpread(w.spread, 0, 0, 0), ads = aimSpread(w.spread, 1, 0, 0);
  assert.ok(ads < hip);
  if (w.spread > 0) assert.ok(Math.abs(hip / ads - 1.35) < 1e-12);
  assert.ok(aimSpread(w.spread, 0, 1, 1) > hip);
  assert.ok(aimGap(hip, 0) > aimGap(ads, 1));
  for (const rand of [0, 0.5, 1]) {
    const h = aimKick(w.id, 0, rand), a = aimKick(w.id, 1, rand);
    assert.ok(a.pitch > 0 && a.pitch < h.pitch);
    assert.ok(Math.abs(a.yaw) <= Math.abs(h.yaw));
  }
  // At 3m hipfire's maximum base error still fits the existing 0.8m target
  // (shotgun has pellets); ADS adds no damage or cadence advantage.
  assert.ok(Math.tan(hip) * 3 < 0.4);
}
const bindings = PAD_PROFILES.fps.controls;
assert.equal(bindings.find(c => c.control === 'aim')?.binding, 'LT');
assert.equal(bindings.find(c => c.control === 'fire')?.binding, 'RT');
assert.equal(new Set(bindings.map(c => c.binding)).size, bindings.length);
const input = new PlayerInput();
input.setDown('aim'); input.setDown('fire'); input.setAxis('look', 2, 0.5);
input.cancelAll();
assert.ok(!input.pressed('aim') && !input.pressed('fire') && !input.hasAxis('look'));
assert.ok(!input.justReleased('aim'));
console.log('PASS: ADS timing, FOV, movement, sensitivity, six weapon spreads/recoils, close-range cone and cancellation/bindings');
