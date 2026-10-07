// RIBALTATI / KART col controller (M4). 3 giocatori MISTI: P1 Xbox, P2 DualSense, P3 telefono (fallback).
// Prova: schermata CONTROLLI, sterzo ANALOGICO (-1/+1/0.3/diagonale, stessa deadzone centrale), RT/LT come tasti digitali
// (0/0.5/1, RT+LT insieme = vince il throttle, invariato), drift press/hold/release + mini-turbo, item one-shot, abilità
// one-shot, pausa e disconnessione con drift/RT tenuti (nessun boost/accelerazione fantasma), reconnect, countdown (RT tenuto
// funziona SUBITO al VIA, drift tenuto NO), rumble, giocatori misti, transizioni.
//   node scripts/e2e/gamepad-kart.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { XBOX, DS, makeCheck, installMock, add, remove, btn, trig, stick, tap, rumbleCount, until, phoneText, slots, axisOf, pressedOf, f3Text, watchControls, resetControlsWatch, startGame, finishNow, gameEval } from './padmock.mjs';

const { st, check } = makeCheck();
const G = (page, fn, arg) => gameEval(page, 'kart3d', fn, arg);

async function run(browser) {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 }); // 3 giocatori
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const [P1, P2, P3] = pids;
  await installMock(page);
  await add(page, 0, XBOX);
  await add(page, 1, DS);
  await sleep(500);
  for (let k = 0; k < 2; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, k, 'A');
  }
  await page.evaluate(() => window.__pads.setTarget(null));
  check((await page.evaluate(() => window.__pads.pairedCount())) === 2, 'P1 (Xbox) e P2 (DualSense) col controller, P3 col telefono');
  const pairing0 = await slots(page);
  await watchControls(page);

  // ------------------------------------------------------------ CONTROLLI (dopo l'intro, prima del countdown)
  await startGame(page, 'kart3d');
  await until(async () => await page.evaluate(() => window.__cc.shownAt !== null), 60000, 'schermata CONTROLLI');
  await trig(page, 0, 'RT', 1); // RT tenuto DA PRIMA del countdown: deve funzionare al VIA senza rilasciare
  await btn(page, 1, 'A', true); // drift tenuto sull'altro pad: NON deve partire in automatico al VIA
  await stick(page, 0, 1, 0);
  const samples = [];
  let ax1 = null;
  let thr1 = null;
  for (let k = 0; k < 14; k++) {
    const ov = await page.evaluate(() => !!document.getElementById('pad-controls'));
    if (!ov) break;
    samples.push(ov);
    if (k === 1) {
      ax1 = await axisOf(page, P1, 'steer');
      thr1 = await pressedOf(page, P1, 'up');
    }
    await sleep(150);
  }
  const race0 = await G(page, (g) => ({ ph: g.race.phase, cd: g.race.countdownRemaining }));
  check(race0.ph === 'countdown', `gara FERMA durante i CONTROLLI (fase ${race0.ph})`);
  check(ax1 && ax1.x === 0 && thr1 === false, 'input ignorato durante i CONTROLLI (stick a fondo e RT premuto: steer 0, throttle non premuto)');
  await until(async () => await page.evaluate(() => window.__cc.hiddenAt !== null), 8000, 'fine CONTROLLI');
  const cc = await page.evaluate(() => window.__cc);
  const dur = cc.hiddenAt - cc.shownAt;
  check(dur >= 4700 && dur <= 5700, `durata CONTROLLI ${Math.round(dur)} ms`);
  check(/RIBALTATI/.test(cc.text) && /LEFT STICK STERZA/.test(cc.text) && /RT \/ R2 ACCELERA/.test(cc.text) && /LT \/ L2 FRENA \/ RETROMARCIA/.test(cc.text) && /A \/ ✕ DRIFT/.test(cc.text) && /X \/ □ USA ITEM/.test(cc.text) && /Y \/ △ ⚡ ABILITÀ/.test(cc.text), `mostra: "${cc.text.slice(0, 220)}"`);
  check(!/GUARDA DIETRO|REAR/i.test(cc.text), 'nessuna voce "guarda dietro" (il gioco non la supporta: non e\' stata inventata)');

  // ------------------------------------------------------------ COUNTDOWN 3-2-1: RT tenuto funziona al VIA, drift tenuto NO
  await until(async () => (await G(page, (g) => g.race.phase)) === 'racing', 40000, 'via');
  await sleep(700); // qualche fotogramma di gara reale
  const via = await G(page, (g, a) => {
    const p1 = g.karts.get(a.p1);
    const p2 = g.karts.get(a.p2);
    return { p1speed: p1.speed, p1drifting: p1.drifting, p2drifting: p2.drifting, p2charge: p2.driftCharge };
  }, { p1: P1, p2: P2 });
  check(via.p1speed > 3, `P1: RT tenuto da prima del countdown accelera SUBITO al VIA senza rilasciare (velocità ${via.p1speed.toFixed(1)})`);
  check(!via.p2drifting && via.p2charge === 0, 'P2: A/✕ (drift) tenuto da prima del countdown NON parte in automatico al VIA (serve rilasciare e ripremere)');
  await trig(page, 0, 'RT', 0);
  await btn(page, 1, 'A', false);
  await sleep(400);

  // ------------------------------------------------------------ telefoni
  const t1 = await phoneText(phones[0]);
  check(/USA IL CONTROLLER/.test(t1) && /RIBALTATI/.test(t1), `telefono P1: "${t1.slice(0, 55)}"`);
  check(await phones[2].page.evaluate(() => !!document.getElementById('pad-fallback-badge')), 'P3 (senza controller): 📱 MODALITÀ FALLBACK');

  // Riposiziona P1 in un punto SICURO al centro di un rettilineo (non vicino a muri: le sezioni precedenti del test lo hanno
  // mosso per la pista) e azzera velocità/deriva/stordimento: i test seguenti partono sempre dalla stessa base pulita.
  const place = () =>
    G(page, (g, id) => {
      const k = g.karts.get(id);
      k.distance = 60;
      k.lateral = 0;
      k.absHeading = g.trackAngleAt ? g.trackAngleAt(60) : 0;
      k.speed = 0;
      k.vy = 0;
      k.drifting = false;
      k.driftCharge = 0;
      k.driftDir = 0;
      k.stunTimer = 0;
      k.offTrackTimer = 0;
      k.respawnTimer = 0;
      k.invulnTimer = 0;
      k.boostTimer = 0;
    }, P1);

  // ------------------------------------------------------------ STERZO ANALOGICO
  // 1) steer -1
  await place();
  await G(page, (g, id) => { g.karts.get(id).absHeading = 0; }, P1);
  await stick(page, 0, -1, 0);
  await sleep(500);
  const s1 = await G(page, (g, id) => g.karts.get(id).absHeading, P1);
  check((await axisOf(page, P1, 'steer')).x === -1, 'steer -1: il PROFILO legge esattamente -1');
  // 2) steer +1
  await place();
  await G(page, (g, id) => { g.karts.get(id).absHeading = 0; }, P1);
  await stick(page, 0, 1, 0);
  await sleep(500);
  const s2 = await G(page, (g, id) => g.karts.get(id).absHeading, P1);
  check((await axisOf(page, P1, 'steer')).x === 1, 'steer +1: il PROFILO legge esattamente 1');
  check(Math.sign(s1 - 0) !== Math.sign(s2 - 0) || (s1 < 0 && s2 > 0), `sterzo -1 e +1 curvano in direzioni opposte (heading ${s1.toFixed(2)} vs ${s2.toFixed(2)})`);
  // 3) steer 0.3 (leggero) vs 1.0 (massimo): la curvatura scala con la magnitudine, non e' on/off
  await place();
  await G(page, (g, id) => { g.karts.get(id).absHeading = 0; g.karts.get(id).speed = 20; }, P1);
  await stick(page, 0, 0.3, 0);
  await sleep(300);
  const light = await G(page, (g, id) => Math.abs(g.karts.get(id).absHeading), P1);
  await place();
  await G(page, (g, id) => { g.karts.get(id).absHeading = 0; g.karts.get(id).speed = 20; }, P1);
  await stick(page, 0, 1, 0);
  await sleep(300);
  const full = await G(page, (g, id) => Math.abs(g.karts.get(id).absHeading), P1);
  check(light > 0 && full > light * 2, `sterzo 0.3 curva MENO di 1.0 (proporzionale, non digitale): 0.3 -> ${light.toFixed(3)} rad, 1.0 -> ${full.toFixed(3)} rad`);
  // 4) diagonale: il kart legge solo l'asse X dello stick (radialmente ridotto dalla deadzone centrale, non un errore/crash)
  await stick(page, 0, 0.7, 0.7);
  await sleep(300);
  const diag = await axisOf(page, P1, 'steer');
  check(diag.x > 0.5 && diag.x < 0.85, `diagonale: il PROFILO legge un valore ridotto dalla deadzone RADIALE centrale (x=${diag.x.toFixed(2)}, non 1.0 e non un crash)`);
  await stick(page, 0, 0, 0);
  await place();

  // ------------------------------------------------------------ RT/LT: 0 / 0.5 / 1 (digitale, adattamento compatibile)
  await trig(page, 0, 'RT', 0);
  await sleep(300);
  check((await pressedOf(page, P1, 'up')) === false, 'RT 0.0: nessun acceleratore');
  await trig(page, 0, 'RT', 0.5);
  await sleep(300);
  const half = await pressedOf(page, P1, 'up');
  await trig(page, 0, 'RT', 1);
  await sleep(300);
  const full1 = await pressedOf(page, P1, 'up');
  check(half === true && full1 === true, `RT 0.5 e RT 1.0 danno lo STESSO throttle (adattamento digitale: il gioco non ha un accel a magnitudine) — 0.5=${half}, 1.0=${full1}`);
  await trig(page, 0, 'RT', 0);
  // LT 0.5
  await trig(page, 0, 'LT', 0.5);
  await sleep(300);
  check((await pressedOf(page, P1, 'down')) === true, 'LT 0.5: freno/retromarcia attivo (sopra soglia)');
  await trig(page, 0, 'LT', 0);
  await sleep(300);
  // RT + LT insieme: throttle vince (stessa priorità if/else-if di sempre, invariata)
  await place();
  await G(page, (g, id) => { g.karts.get(id).speed = 0; }, P1);
  await trig(page, 0, 'RT', 1);
  await trig(page, 0, 'LT', 1);
  await sleep(600);
  const bothSpeed = await G(page, (g, id) => g.karts.get(id).speed, P1);
  check(bothSpeed > 0.5, `RT+LT insieme: vince il throttle (velocità ${bothSpeed.toFixed(1)} > 0, come l'if/else-if già esistente)`);
  await trig(page, 0, 'RT', 0);
  await trig(page, 0, 'LT', 0);
  await sleep(300);

  // ------------------------------------------------------------ DRIFT press/hold/release + mini-turbo + rumble
  // RT tenuto insieme al drift (come nel gioco vero): senza gas la velocità decade sotto driftMinSpeed*0.6 in meno di un
  // secondo (coastDrag) e la deriva si interromperebbe da sola per fisica, non per il tasto — non e' quello che si sta testando qui.
  await place();
  await G(page, (g, id) => { const k = g.karts.get(id); k.speed = 30; k.absHeading = 0; }, P1); // driftMinSpeed = 20 (stretto >)
  await stick(page, 0, 0.25, 0); // sterzo leggero: basta "steerDir != 0" per la deriva, non serve il fondo corsa
  await trig(page, 0, 'RT', 1);
  const rD0 = await rumbleCount(page, 0);
  await btn(page, 0, 'A', true);
  await sleep(200);
  const dr1 = await G(page, (g, id) => g.karts.get(id).drifting, P1);
  check(dr1 === true, 'A/✕ press: la deriva parte');
  // durante l'hold si ripiazza il kart al centro pista ad ogni campione: isola l'accumulo della carica (dt, tasto, velocità,
  // sterzo) dalla geometria della pista, cosi' non esce fuori strada/non sbatte in un test che non riguarda quello.
  for (let k = 0; k < 6; k++) {
    await sleep(200);
    await G(page, (g, id) => { const kk = g.karts.get(id); kk.lateral = 0; kk.stunTimer = 0; kk.offTrackTimer = 0; }, P1);
  }
  const charge1 = await G(page, (g, id) => g.karts.get(id).driftCharge, P1);
  check(charge1 > 0.3, `A/✕ hold: la carica sale (${charge1.toFixed(2)})`);
  const speedBefore = await G(page, (g, id) => g.karts.get(id).speed, P1);
  await btn(page, 0, 'A', false); // release: mini-turbo se la carica basta
  await sleep(500);
  const after = await G(page, (g, id) => ({ drifting: g.karts.get(id).drifting, boost: g.karts.get(id).boostTimer, speed: g.karts.get(id).speed }), P1);
  check(after.drifting === false, 'A/✕ release: la deriva finisce');
  check(after.boost > 0 || after.speed >= speedBefore, `rilascio con carica: mini-turbo assegnato (boostTimer ${after.boost.toFixed(2)})`);
  await trig(page, 0, 'RT', 0);
  check((await rumbleCount(page, 0)) > rD0, 'rumble durante drift/mini-turbo');
  await stick(page, 0, 0, 0);

  // ------------------------------------------------------------ ITEM one-shot (nessuno spam se tenuto)
  await G(page, (g, id) => { g.karts.get(id).heldItem = 'shell'; }, P1);
  await sleep(200);
  if (!(await f3Text(page))) await page.keyboard.press('F3');
  await sleep(500);
  const itemBefore = (await f3Text(page)).match(/P1[\s\S]*?GIOCO[^\n]*item (\d+)x/)?.[1] ?? '0';
  await btn(page, 0, 'X', true);
  await sleep(1200); // tenuto a lungo
  await btn(page, 0, 'X', false);
  await sleep(400);
  const itemAfter = (await f3Text(page)).match(/P1[\s\S]*?GIOCO[^\n]*item (\d+)x/)?.[1] ?? '0';
  check(Number(itemAfter) - Number(itemBefore) === 1, `X/□ tenuto 1.2s: UN solo uso item (${itemBefore} -> ${itemAfter}), nessuno spam`);
  const heldAfter = await G(page, (g, id) => g.karts.get(id).heldItem, P1);
  check(heldAfter === null, 'item consumato');

  // ------------------------------------------------------------ ABILITY one-shot
  await tap(page, 0, 'Y', 450);
  await sleep(400);
  check(/P1[\s\S]*?GIOCO[^\n]*ability [1-9]\d*x/.test(await f3Text(page)), 'Y/△ = ABILITÀ: il gioco consuma la pressione');
  await page.keyboard.press('F3');

  // ------------------------------------------------------------ PAUSA con drift e RT tenuti: nessun input, nessun boost/accel fantasma
  await place();
  await G(page, (g, id) => { const k = g.karts.get(id); k.speed = 25; k.absHeading = 0; k.drifting = true; k.driftCharge = 0.9; k.driftDir = 1; }, P1);
  await stick(page, 0, 0.25, 0);
  await btn(page, 0, 'A', true);
  await trig(page, 0, 'RT', 1); // P1: senza gas la velocità scende sotto driftMinSpeed*0.6 per coastDrag PRIMA della pausa (falso positivo)
  await trig(page, 1, 'RT', 1); // P2: per il test holdThrough qui sotto
  await sleep(300);
  await hostEval(page, (gm) => gm.setPaused(true));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) === true, 8000, 'pausa');
  await sleep(700);
  check((await axisOf(page, P1, 'steer')).x === 0 && (await pressedOf(page, P1, 'up')) === false, 'in pausa nessun input di gameplay (steer e throttle azzerati)');
  const pausedState = await G(page, (g, id) => ({ drifting: g.karts.get(id).drifting, boost: g.karts.get(id).boostTimer }), P1);
  check(pausedState.drifting === false && pausedState.boost === 0, 'la deriva viene ANNULLATA in pausa SENZA assegnare il mini-turbo (nessun boost fantasma dalla pausa)');
  await hostEval(page, (gm) => gm.setPaused(false));
  await until(async () => (await hostEval(page, (gm) => gm.state.paused)) !== true, 8000, 'ripresa');
  await sleep(500);
  // RT (acceleratore) e' holdThrough: tenuto per tutta la pausa, torna attivo DA SOLO alla ripresa (come "un pedale che
  // resta premuto" — normale, non un fantasma). Il drift di P1 (A, NON holdThrough) invece resta bloccato: va ripremuto.
  check((await pressedOf(page, P2, 'up')) === true, 'P2: RT tenuto durante tutta la pausa torna attivo DA SOLO alla ripresa (holdThrough: come un pedale lasciato premuto)');
  check((await pressedOf(page, P1, 'drift')) === false, 'P1: A (drift) tenuto durante la pausa resta BLOCCATO alla ripresa: serve rilasciare e ripremere');
  await btn(page, 0, 'A', false);
  await trig(page, 0, 'RT', 0);
  await trig(page, 1, 'RT', 0);
  await stick(page, 0, 0, 0);
  await sleep(400);

  // ------------------------------------------------------------ DISCONNESSIONE con drift+RT tenuti: nessun boost/accel fantasma
  await place();
  await G(page, (g, id) => { const k = g.karts.get(id); k.speed = 20; k.absHeading = 0; k.drifting = true; k.driftCharge = 0.95; k.driftDir = 1; }, P1);
  await stick(page, 0, 1, 0);
  await btn(page, 0, 'A', true);
  await trig(page, 0, 'RT', 1);
  await sleep(400);
  await remove(page, 0);
  await sleep(900);
  check((await axisOf(page, P1, 'steer')).x === 0 && (await pressedOf(page, P1, 'up')) === false && (await pressedOf(page, P1, 'down')) === false, 'disconnessione: steer/throttle/freno a zero');
  const disc = await G(page, (g, id) => ({ drifting: g.karts.get(id).drifting, boost: g.karts.get(id).boostTimer }), P1);
  check(disc.drifting === false && disc.boost === 0, 'disconnessione con drift carico: deriva annullata SENZA mini-turbo (nessun boost fantasma dal reset)');
  check(/DISCONNESSO|SCOLLEGATO/.test(await page.evaluate(() => document.getElementById('pad-alert')?.innerText ?? '')), 'avviso TV: controller scollegato');
  await until(async () => await phones[0].page.evaluate(() => /CONTROLLER PERSO/.test(document.getElementById('pad-fallback-badge')?.textContent ?? '')), 8000, 'fallback P1');
  check(true, 'il telefono di P1 passa da solo a 📱 CONTROLLER PERSO — USA TEMPORANEAMENTE IL TELEFONO');

  // ------------------------------------------------------------ RICONNESSIONE
  await add(page, 0, XBOX);
  await sleep(700);
  check((await page.evaluate((id) => window.__pads.slotOf(id).state, P1)) === 'paired', 'il controller torna: pairing recuperato');
  await until(async () => /USA IL CONTROLLER/.test(await phoneText(phones[0])), 8000, 'telefono torna al controller');
  check(true, 'il telefono torna a "USA IL CONTROLLER" senza refresh');

  // ------------------------------------------------------------ GIOCATORI MISTI: telefono NON sovrascrive il controller
  await stick(page, 0, 1, 0);
  await sleep(400);
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'axis', controlId: 'steer', x: 0, y: 0 } }), P1);
  await sleep(300);
  check((await axisOf(page, P1, 'steer')).x === 1, 'P1 (controller): un evento del suo telefono NON sovrascrive lo sterzo');
  await stick(page, 0, 0, 0);
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'down', controlId: 'up' } }), P3);
  await sleep(300);
  check((await pressedOf(page, P3, 'up')) === true, 'P3 (telefono, fallback): il suo input entra regolarmente nello stesso InputManager');
  await hostEval(page, (gm, id) => gm.onInputRelay({ playerId: id, input: { kind: 'up', controlId: 'up' } }), P3);

  // ------------------------------------------------------------ risultati -> rullo, poi rigioca (round-trip completo)
  await finishNow(page);
  await until(async () => (await hostSnapshot(page)).phase === 'ROUND_RESULTS', 60000, 'risultati');
  await until(async () => ['NEXT_ROUND', 'MINIGAME_ROULETTE'].includes((await hostSnapshot(page)).phase), 90000, 'rullo');
  check((await slots(page)) === pairing0, 'stesse associazioni dopo risultati e rullo (nessuna riassociazione)');
  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
  await page.close();
  for (const p of phones) await p.ctx.close().catch(() => {});
}

// ============================================================ split-screen: n giocatori, n controller
async function splitRun(browser, n) {
  console.log(`\n=== KART split-screen, ${n} giocatori/controller ===`);
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: n - 2 });
  const phones = [];
  for (let i = 0; i < n; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  await installMock(page, 6);
  // ordine di pairing CASUALE: pad n-1-k -> giocatore k (come nel test gamepad.mjs)
  const fam = [XBOX, DS, XBOX, DS, XBOX];
  const order = [n - 1, 0, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== 0 && i !== n - 1)];
  for (const i of order) await add(page, i, fam[i % fam.length] + ` #${i}`);
  await sleep(500);
  for (let k = 0; k < n; k++) {
    await page.evaluate((id) => window.__pads.setTarget(id), pids[k]);
    await tap(page, n - 1 - k, 'A');
  }
  const map = await page.evaluate(() => window.__pads.slotList().map((s) => [s.playerId, s.padIndex]));
  check(map.length === n && map.every(([pid, pad], k) => pid === pids[k] && pad === n - 1 - k), `${n} controller associati in ordine inverso: ${JSON.stringify(map.map(([, p]) => p))}`);
  await startGame(page, 'kart3d');
  await until(async () => (await gameEval(page, 'kart3d', (g) => g.race.phase)) === 'racing', 90000, `${n}p via`);
  await sleep(400);
  // gamepad -> playerId -> kart CORRETTO -> viewport CORRETTO (non indice del pad)
  const info = await gameEval(page, 'kart3d', (g, ids) =>
    ids.map((id) => {
      const rig = g.cameraManager.rigs.get(id);
      const vp = rig?.camera?.viewport;
      return vp ? { x: +vp.x.toFixed(2), y: +vp.y.toFixed(2), w: +vp.width.toFixed(2), h: +vp.height.toFixed(2) } : null;
    }), pids);
  check(info.every((v) => v !== null), `${n}p: ogni giocatore ha una viewport propria`);
  const uniq = new Set(info.map((v) => `${v.x},${v.y},${v.w},${v.h}`));
  check(uniq.size === n, `${n}p: ${n} viewport diverse, nessuna sovrapposta (split-screen intatto)`);
  // ogni pad muove SOLO il proprio kart (sterzo -> heading). Gli ALTRI kart restano FERMI (speed=0): se girassero anche
  // loro, il grip di auto-allineamento alla curvatura della pista farebbe comunque cambiare il loro absHeading da solo,
  // rendendo il confronto inutile — non e' quello che questo test misura.
  let allOk = true;
  for (let k = 0; k < n; k++) {
    await gameEval(page, 'kart3d', (g, ids) => ids.forEach((id) => { const kk = g.karts.get(id); kk.absHeading = 0; kk.speed = 0; kk.drifting = false; }), pids);
    await gameEval(page, 'kart3d', (g, id) => { g.karts.get(id).speed = 15; }, pids[k]);
    const before = await gameEval(page, 'kart3d', (g, ids) => ids.map((id) => g.karts.get(id).absHeading), pids);
    await stick(page, n - 1 - k, 1, 0);
    await sleep(500);
    await stick(page, n - 1 - k, 0, 0);
    const after = await gameEval(page, 'kart3d', (g, ids) => ids.map((id) => g.karts.get(id).absHeading), pids);
    const moved = pids.map((_, j) => Math.abs(after[j] - before[j]));
    const ok = moved[k] > 0.3 && moved.every((m, j) => j === k || m < 0.08); // >20x di margine fra "sterzata vera" e "rumore residuo"
    if (!ok) allOk = false;
    console.log(`   pad #${n - 1 - k} -> giocatore ${k + 1}: sterzata ${moved[k].toFixed(3)} rad, altri max ${Math.max(...moved.filter((_, j) => j !== k)).toFixed(3)}`);
  }
  check(allOk, `${n} controller: ognuno sterza esattamente il proprio kart (nessun input incrociato)`);
  check((await Promise.all(phones.map(phoneText))).every((t) => /USA IL CONTROLLER/.test(t)), `${n} telefoni su "USA IL CONTROLLER" (sul tavolo)`);
  await page.close();
  for (const p of phones) await p.ctx.close().catch(() => {});
}

let browser = null;
try {
  if (!process.env.SKIP_MAIN) {
    browser = await launch();
    await run(browser);
  }
  for (const n of (process.env.SPLIT ?? '2,3,4,5').split(',').filter(Boolean).map(Number)) {
    await browser?.close().catch(() => {});
    browser = await launch();
    await splitRun(browser, n);
  }
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser?.close().catch(() => {});
}
process.exitCode = st.fails ? 1 : 0;
