// SPARATORIA DEI DISAGIATI — associazione FUORI ORDINE (M6.1, punto 2). 4 controller associati SCRAMBLED
// (pad0->P3, pad1->P1, pad2->P4, pad3->P2): verifica che "pad index" NON coincida MAI con "player/viewport index".
// Ogni pad deve controllare esattamente il playerId a cui e' stato associato, la sua camera, il suo personaggio
// (posizione), la sua arma (magazine), il suo HUD — indipendentemente dall'ordine fisico dei pad.
//   node scripts/e2e/gamepad-fps-outoforder.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, GENERIC, makeCheck, installMock, add, btn, stick, tap, until, sceneEval, watchControls } from './padmock.mjs';

const { st, check } = makeCheck();
const F = (page, fn, arg) => sceneEval(page, 'fps', fn, arg);
const XBOX2 = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
const FAMILIES = [XBOX, DS, GENERIC, XBOX2];

const browser = await launch();
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 2 }); // 4 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 4; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [P1, P2, P3, P4] = pids;
  await installMock(page);
  await watchControls(page);

  // Associazione SCRAMBLED apposta: pad0->P3, pad1->P1, pad2->P4, pad3->P2. Nessun pad va al player con lo stesso
  // indice (pad0 NON va a P1, ecc.): se il codice usasse per errore "pad index" invece di "playerId assegnato",
  // questo test lo troverebbe subito.
  const SCRAMBLE = [
    { pad: 0, family: FAMILIES[0], player: P3 },
    { pad: 1, family: FAMILIES[1], player: P1 },
    { pad: 2, family: FAMILIES[2], player: P4 },
    { pad: 3, family: FAMILIES[3], player: P2 }
  ];
  for (const s of SCRAMBLE) await add(page, s.pad, s.family);
  await sleep(500);
  for (const s of SCRAMBLE) {
    await page.evaluate((id) => window.__pads.setTarget(id), s.player);
    await tap(page, s.pad, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 4, 'tutti e 4 i controller associati (fuori ordine)');
  for (const s of SCRAMBLE) {
    const slot = await page.evaluate((id) => window.__pads.slotOf(id), s.player);
    check(slot?.padIndex === s.pad, `${s.player.slice(0, 6)}… -> pad${s.pad} (associazione confermata: padIndex ${slot?.padIndex})`);
  }

  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
  await sleep(300);
  await page.keyboard.press('Enter');
  await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 60000, 'fps PLAYING');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 15000, 'CONTROLLI');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  await sleep(300);

  const camInfo = () => F(page, (g) => g.splitScreen.cams.map((c) => ({ playerId: c.playerId, index: c.index })));
  await until(async () => (await camInfo()).length === 4, 20000, '4 camere pronte');
  const cams = await camInfo();

  // ---- SELF BODY (M6.1, punto 9): ogni camera NON deve vedere la propria capsula, ma DEVE vedere quelle degli
  // altri — verifica algebrica del layerMask (proprieta' statica, non serve altro tempo di gioco).
  await sleep(500); // lascia che ensureAvatar() sia stato chiamato per tutti (avviene al primo update() con snapshot)
  const maskInfo = await F(page, (g) => {
    const AVATAR_BIT0 = 10;
    return g.splitScreen.cams.map((c) => {
      const ownBit = 1 << (AVATAR_BIT0 + c.index);
      const seesOwn = (c.camera.layerMask & ownBit) !== 0;
      const othersBits = g.splitScreen.cams.filter((o) => o.index !== c.index).map((o) => 1 << (AVATAR_BIT0 + o.index));
      const seesAllOthers = othersBits.every((b) => (c.camera.layerMask & b) !== 0);
      return { index: c.index, playerId: c.playerId, seesOwn, seesAllOthers };
    });
  });
  check(maskInfo.every((m) => !m.seesOwn), `nessuna camera vede la propria capsula da vicino (M6.1 punto 9): ${JSON.stringify(maskInfo.map((m) => ({ i: m.index, own: m.seesOwn })))}`);
  check(maskInfo.every((m) => m.seesAllOthers), `ogni camera vede le capsule di TUTTI gli altri: ${JSON.stringify(maskInfo.map((m) => ({ i: m.index, others: m.seesAllOthers })))}`);
  // Le camere/viewport seguono l'ORDINE DEI GIOCATORI IN STANZA (P1,P2,P3,P4), non l'ordine di associazione dei pad:
  // e' l'INPUT (quale pad guida quale player) che e' scrambled, non il layout.
  check(cams.map((c) => c.playerId).join(',') === pids.join(','), 'viewport in ordine di stanza (P1,P2,P3,P4), indipendente da come sono stati associati i pad');

  const snap = (id) => F(page, (g, a) => { const p = g.players.find((q) => q.id === a); return { x: p.x, z: p.z, magazine: p.magazine }; }, id);

  // Muove OGNI pad e verifica che SOLO il player assegnato a QUEL pad (per identita', non per indice) si muova.
  for (const s of SCRAMBLE) {
    const before = await Promise.all(pids.map((id) => snap(id)));
    await stick(page, s.pad, 1, 0);
    await sleep(450);
    const after = await Promise.all(pids.map((id) => snap(id)));
    await stick(page, s.pad, 0, 0);
    await sleep(150);
    const moved = pids.map((id, i) => ({ id, d: Math.hypot(after[i].x - before[i].x, after[i].z - before[i].z) }));
    const targetMoved = moved.find((m) => m.id === s.player).d > 0.25;
    const othersStill = moved.filter((m) => m.id !== s.player).every((m) => m.d < 0.05);
    check(targetMoved && othersStill, `pad${s.pad} muove SOLO ${s.player.slice(0, 6)}… (il player assegnato, non "il player con indice ${s.pad}"): assegnato ${targetMoved}, altri fermi ${othersStill}`);
  }

  // Arma: fa sparare pad0 (associato a P3) e verifica che SOLO il caricatore di P3 si consumi (non quello del
  // player in posizione-viewport 0, che e' P1).
  const magBefore = await Promise.all(pids.map((id) => snap(id)));
  await F(page, (g) => { for (const p of g.players) { p.weaponId = 'mitraglia'; p.magazine = 30; p.reloading = false; p.fireCooldown = 0; } });
  const magBefore2 = await Promise.all(pids.map((id) => snap(id)));
  await btn(page, 0, 'RT', true); // pad0 = P3
  await sleep(400);
  await btn(page, 0, 'RT', false);
  const magAfter = await Promise.all(pids.map((id) => snap(id)));
  const p3Consumed = magAfter[2].magazine < magBefore2[2].magazine; // indice 2 = P3 nell'array pids (ordine stanza)
  const othersUnchanged = magAfter.filter((_, i) => i !== 2).every((m, idx) => m.magazine === magBefore2[idx >= 2 ? idx + 1 : idx].magazine);
  check(p3Consumed && othersUnchanged, `pad0 (associato a P3) spara: SOLO il caricatore di P3 si consuma, non quello di chi e' in viewport 0 (P1): P3 ${p3Consumed}, altri invariati ${othersUnchanged}`);

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
process.exitCode = st.fails ? 1 : 0;
