// ABILITA' DEI GIOCHI D'AZIONE dentro le scene vere (5 telefoni = 5 personaggi diversi, input iniettato come dal telefono):
//   1. ogni gioco: l'input 'ability' di OGNI personaggio arriva alla logica e pubblica lo stato (AbilityHub) senza errori
//   2. meccaniche chiave via oggetti reali della scena (parata, salvataggio dal bordo, presa, tiro perfetto, muro, palla ferma,
//      debito, giubbotto, spinta...): provano il COLLEGAMENTO fra abilita' e gioco, non solo la classe isolata
//   3. a fine round nessuno stato residuo
//   node scripts/e2e/ability-actions.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';
import { makeCheck, until, startGame, gameEval, sceneEval, finishNow } from './padmock.mjs';

const { st, check } = makeCheck();
const browser = await launch();
const errs = [];
const hub = (page, fn, arg) =>
  page.evaluate(
    (src, a) => {
      // eslint-disable-next-line no-new-func
      return new Function('hub', 'arg', `return (${src})(hub, arg);`)(window.__abilityHub, a);
    },
    fn.toString(),
    arg
  );
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 3, scoreDownPresses: 2 }); // 5 giocatori, partita lunga (10 round: la partita normale finirebbe prima della Sparatoria)
  page.on('pageerror', (e) => errs.push('HOST ' + String(e.stack ?? e).replace(/\s+/g, ' ').slice(0, 300)));
  const CH = ['goblin', 'buttafuori', 'dottore', 'judoka', 'ciro'];
  const phones = [];
  for (let i = 0; i < 5; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 200)));
    phones.push(p);
  }
  const pids = await hostEval(page, (gm) => gm.state.players.map((p) => p.id));
  const byChar = Object.fromEntries(CH.map((c, i) => [c, pids[i]]));
  const press = (pid) => hostEval(page, (gm, id) => gm.input.handle(id, { kind: 'action', controlId: 'ability' }), pid);
  const statuses = () => hub(page, (h, ids) => ids.map((id) => h.statusOf(id)), pids);

  const allPress = async (label) => {
    await sleep(700);
    for (const pid of pids) await press(pid);
    await sleep(600);
    const s = await statuses();
    const ok = s.every((x) => x && typeof x.state === 'string');
    check(ok, `${label}: ognuno dei 5 personaggi pubblica uno stato (${s.map((x) => x?.state ?? '?').join(' ')})`);
    const rows = await hub(page, (h) => h.rows());
    check(rows.length === 5 && rows.every((r) => r.uses + r.failures >= 1 || (label === 'KART' && r.characterId === 'ciro')), // il Ciro del Kart "arma" senza contare un uso: lo conta solo quando rimanda un colpo
     `${label}: ogni abilita' e' stata premuta e contata (usi o rifiuti): ${rows.map((r) => `${r.characterId}:${r.uses}u/${r.failures}f`).join(' ')}`);
  };
  const endRound = async (label) => {
    await finishNow(page);
    await until(async () => (await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING', 30000, `fine ${label}`);
    await sleep(500);
    const rows = await hub(page, (h) => h.rows());
    check(rows.length === 0, `${label}: a fine round AbilityHub e' vuoto (nessuno stato residuo)`);
  };
  const G = (key, fn, arg) => gameEval(page, key, fn, arg);

  // ================================================================== ARENA
  await startGame(page, 'arena');
  await until(async () => (await G('arena', (g) => g.phase)) === 'playing', 90000, 'arena in gioco');
  await allPress('ARENA');
  // reset pulito dello stato per le prove dirette
  const arenaOk = await G('arena', (g) => {
    const P = (c) => g.players.find((p) => p.characterId === c);
    const reset = (p, x, z) => {
      Object.assign(p, { x, z, vx: 0, vz: 0, y: 0, vy: 0, alive: true, falling: false, stunTime: 0, parryTime: 0, whiffTime: 0, stanceTime: 0, stored: 0, awareTime: 0, drowsyTime: 0, armTime: 0, debtTime: 0, abCharges: 2, abCooldown: 0, knockbackResist: 1, speedMult: 1, dashing: false });
    };
    const out = {};
    // GOBLIN: parata
    const gob = P('goblin');
    const atk = P('buttafuori');
    reset(gob, 0, 0);
    reset(atk, 2, 0);
    atk.dashing = true;
    g.abilities.onAbilityPress(gob, g.players, () => {});
    g.applyKnockback(gob, -1, 0, 10, atk);
    out.parryGoblinStill = Math.abs(gob.vx) < 0.01;
    out.parryAttackerThrown = atk.vx > 8 && atk.stunTime > 0;
    // CIRO: il bordo non elimina
    const ciro = P('ciro');
    reset(ciro, 0, 0);
    ciro.abCharges = 1;
    g.abilities.onAbilityPress(ciro, g.players, () => {});
    ciro.x = g.currentRadius + 2;
    ciro.z = 0;
    g.checkEliminations();
    out.ciroSaved = ciro.alive && !ciro.falling && ciro.debtTime > 0 && Math.hypot(ciro.x, ciro.z) < g.currentRadius;
    // ...e pagare il debito spingendo qualcuno
    const victim = P('dottore');
    reset(victim, 3, 0);
    g.applyKnockback(victim, 1, 0, 10, ciro);
    out.ciroPaid = ciro.debtTime === 0;
    // JUDOKA: presa
    const jud = P('judoka');
    reset(jud, -5, 0);
    jud.facing = Math.PI / 2; // verso +X
    reset(victim, -3.6, 0);
    g.abilities.onAbilityPress(jud, g.players, () => {});
    out.judokaThrow = victim.vx > 10 && victim.stunTime > 0.5;
    return out;
  });
  check(arenaOk?.parryGoblinStill && arenaOk?.parryAttackerThrown, `ARENA: la parata del Goblin annulla la spinta e scaraventa chi attacca (${JSON.stringify([arenaOk?.parryGoblinStill, arenaOk?.parryAttackerThrown])})`);
  check(arenaOk?.ciroSaved, 'ARENA: Ciro armato non cade (rimesso dentro, debito aperto)');
  check(arenaOk?.ciroPaid, 'ARENA: spingere qualcuno salda il debito di Ciro');
  check(arenaOk?.judokaThrow, 'ARENA: IPPON afferra e scaraventa chi e\' a portata');
  await endRound('ARENA');

  // ================================================================== DODGEBALL
  await startGame(page, 'dodgeball');
  await until(async () => (await G('dodgeball', (g) => g.phase)) === 'playing', 90000, 'dodgeball in gioco');
  await allPress('DODGEBALL');
  await endRound('DODGEBALL');

  // ================================================================== CALCIO
  await startGame(page, 'soccer');
  await until(async () => (await G('soccer', (g) => g.phase)) === 'playing', 90000, 'calcio in gioco');
  await allPress('CALCIO');
  const soc = await G('soccer', (g) => {
    const P = (c) => g.players.find((p) => p.characterId === c);
    const reset = (p, team) => Object.assign(p, { team, hasBall: false, stunTime: 0, perfectTime: 0, stanceTime: 0, lucidTime: 0, slowTime: 0, armTime: 0, debtTime: 0, abCharges: 2, abCooldown: 0, dodgeTime: 0, charging: false });
    const out = {};
    // GOBLIN: tiro nella zona verde = bomba a giro; fuori = moscio
    const gob = P('goblin');
    reset(gob, 'red');
    gob.x = 0;
    gob.z = 0;
    gob.hasBall = true;
    g.ball.ownerId = gob.id;
    g.abilities.onAbilityPress(gob, null, () => {});
    gob.facing = Math.PI / 2;
    g.kick(gob, 0.8 * 0.8); // carica 0.8 (zona verde 0.72-0.95)
    const perfectSpeed = Math.hypot(g.ball.vx, g.ball.vz);
    out.perfect = g.ball.abilityKickerId === gob.id && Math.abs(g.ball.curve) > 0.5;
    reset(gob, 'red');
    gob.hasBall = true;
    g.ball.ownerId = gob.id;
    g.abilities.onAbilityPress(gob, null, () => {});
    g.kick(gob, 0.8 * 0.4); // carica troppo bassa: moscio
    const wobbleSpeed = Math.hypot(g.ball.vx, g.ball.vz);
    out.wobble = g.ball.abilityKickerId === null && wobbleSpeed < perfectSpeed;
    // BUTTAFUORI: il contrasto rimbalza
    const bf = P('buttafuori');
    const att = P('dottore');
    reset(bf, 'blue');
    reset(att, 'red');
    bf.hasBall = true;
    bf.x = 5;
    bf.z = 0;
    att.x = 4;
    att.z = 0;
    g.abilities.onAbilityPress(bf, null, () => {});
    const hit = g.tryTackle(att);
    out.wall = hit === true && bf.hasBall === true && att.stunTime > 0;
    // JUDOKA: IPPON sul portatore a portata
    const jud = P('judoka');
    reset(jud, 'red');
    const carrier = P('ciro');
    reset(carrier, 'blue');
    carrier.hasBall = true;
    g.ball.ownerId = carrier.id;
    jud.x = -5;
    jud.z = 0;
    carrier.x = -3.8;
    carrier.z = 0;
    const car = g.nearestEnemyCarrier(jud);
    g.abilities.onAbilityPress(jud, car, () => {});
    g.resolveJudoka(jud, car);
    out.ippon = jud.hasBall === true && carrier.hasBall === false && carrier.stunTime > 1;
    // CIRO: il primo contrasto e' rimandato, poi debito
    const ci = P('ciro');
    reset(ci, 'blue');
    ci.hasBall = true;
    jud.hasBall = false;
    bf.hasBall = false;
    g.ball.ownerId = ci.id;
    ci.x = 8;
    ci.z = 0;
    const att2 = P('dottore');
    reset(att2, 'red');
    att2.x = 7;
    att2.z = 0;
    g.abilities.onAbilityPress(ci, null, () => {});
    g.tryTackle(att2);
    out.ciroHold = ci.hasBall === true && ci.debtTime > 0 && att2.stunTime > 0;
    return out;
  });
  check(soc?.perfect, 'CALCIO: Goblin — il tiro caricato nella zona verde diventa un tiro a giro (palla marcata come "da abilita\'")');
  check(soc?.wobble, 'CALCIO: Goblin — fuori dalla zona verde il tiro esce moscio (piu\' lento del perfetto)');
  check(soc?.wall, 'CALCIO: Buttafuori in postura — il contrasto rimbalza, tiene la palla e chi attacca resta fermo');
  check(soc?.ippon, 'CALCIO: Judoka — IPPON strappa la palla e butta a terra il portatore');
  check(soc?.ciroHold, 'CALCIO: Ciro — il primo contrasto e\' rimandato (tiene la palla, parte il debito, chi attacca inciampa)');
  await endRound('CALCIO');

  // ================================================================== PALLAVOLO
  await startGame(page, 'volleyball');
  await until(async () => (await G('volleyball', (g) => g.phase)) === 'playing', 90000, 'pallavolo in gioco');
  await allPress('PALLAVOLO');
  const vol = await G('volleyball', (g) => {
    const P = (c) => g.players.find((p) => p.characterId === c);
    const out = {};
    // JUDOKA: la palla si ferma in aria, riparte con la sua velocita'
    const jud = P('judoka');
    Object.assign(jud, { abCharges: 1, jagerTime: 0, muroTime: 0, lucidTime: 0, dizzyTime: 0, armTime: 0 });
    g.freeze = null;
    Object.assign(g.ball, { state: 'flying', x: 0, y: 5, z: 4, vx: 1, vy: 2, vz: 3, holderId: null });
    g.abilities.onAbilityPress(jud, true, (f) => g.onAbilityFeedback(jud, f));
    out.frozen = !!g.freeze && g.freeze.vz === 3;
    const y0 = g.ball.y;
    g.updateBall(0.5);
    out.hanging = g.ball.y === y0;
    g.updateBall(2);
    out.resumed = g.freeze === null && g.ball.vz === 3;
    // CIRO: la prima palla a terra nel suo campo rimbalza e apre il debito
    const ciro = P('ciro');
    Object.assign(ciro, { abCharges: 1, armTime: 0 });
    g.abilities.onAbilityPress(ciro, true, () => {});
    const team = ciro.team;
    Object.assign(g.ball, { state: 'flying', x: 0, y: 0.1, z: team === 'red' ? -4 : 4, vx: 0, vy: -3, vz: 0 });
    g.updateBall(0.05);
    out.ciroBounce = g.ball.vy > 0 && g.debtTeam === team;
    return out;
  });
  check(vol?.frozen && vol?.hanging && vol?.resumed, `PALLAVOLO: NO, ASPETTA! ferma la palla in aria e poi la fa ripartire con la velocita' di prima (${JSON.stringify(vol)})`);
  check(vol?.ciroBounce, 'PALLAVOLO: PAGO DOMANI — la prima palla a terra rimbalza e apre il debito della squadra');
  await endRound('PALLAVOLO');

  // ================================================================== KART
  await startGame(page, 'kart3d');
  await until(async () => (await G('kart3d', (g) => g.race.phase)) === 'racing', 90000, 'kart in gara');
  await allPress('KART');
  const kart = await G('kart3d', (g) => {
    const out = {};
    // BUTTAFUORI: lo schianto apre la finestra, premere recupera
    const bf = [...g.karts.values()].find((k) => k.characterId === 'buttafuori');
    bf.abilityCharges = 1;
    bf.recoverWindow = 0;
    g.abilities.reactToCrash(bf, true, true, g.trackAngleAt, () => {});
    out.window = bf.recoverWindow > 0;
    const r = g.abilities.onAbilityPress(bf, [...g.karts.values()], () => {}, g.trackAngleAt);
    out.recovered = r === 'ok' && bf.abilityCharges === 0 && bf.boostTimer > 0;
    // JUDOKA: il camion spinge via chi tocca
    const jud = [...g.karts.values()].find((k) => k.characterId === 'judoka');
    const other = [...g.karts.values()].find((k) => k.characterId === 'ciro');
    jud.abilityMeter = 1;
    g.abilities.onAbilityPress(jud, [...g.karts.values()], () => {});
    out.truck = jud.truckMode && jud.steerMultiplier < 1;
    const lat0 = other.lateral;
    jud.distance = other.distance;
    jud.lateral = other.lateral + 0.4;
    g.resolveKartCollisions();
    out.shoved = Math.abs(other.lateral - lat0) > 0.3 && other.speedCapMultiplier < 1;
    return out;
  });
  check(kart?.window && kart?.recovered, 'KART: Buttafuori — lo schianto apre la finestra e premere ABILITA\' lo rimette in pista col boost (non piu\' automatico)');
  check(kart?.truck && kart?.shoved, 'KART: Judoka — il camion sterza peggio e spinge via/rallenta chi tocca');
  await endRound('KART');

  // ================================================================== FPS (chi non ha il controller gioca dal telefono: stessa autorita')
  await startGame(page, 'fps');
  await until(async () => (await sceneEval(page, 'fps', (g) => g.players.length)) === 5, 90000, 'fps in gioco');
  await sleep(2500);
  await allPress('FPS');
  const fps = await sceneEval(page, 'fps', (g) => {
    const P = (c) => g.players.find((p) => p.characterId === c);
    const reset = (p, x, z) => Object.assign(p, { x, z, hp: 100, alive: true, spawnProtection: 0, abCd: 0, abCharges: 2, buffShots: 0, guardTime: 0, guardAbsorbed: 0, wallTime: 0, drowsyTime: 0, armTime: 0, debtTime: 0, lockTime: 0, stunTime: 0, reloading: false, burstLeft: 0 });
    const out = {};
    // CIRO: il colpo mortale lascia a 1 di vita, una kill salda
    const ciro = P('ciro');
    const src = P('dottore');
    reset(ciro, 0, 0);
    reset(src, 6, 0);
    g.fpsAb.onAbilityPress(ciro, { reload: 1.5, magazine: 30 }, g.players, () => {});
    g.applyDamage(ciro, 500, src);
    out.ciroAlive = ciro.alive && ciro.hp === 1 && ciro.debtTime > 0;
    const prey = P('goblin');
    reset(prey, 10, 0);
    prey.hp = 5;
    g.applyDamage(prey, 50, ciro);
    out.ciroPaid = ciro.debtTime === 0 && ciro.hp > 1;
    // BUTTAFUORI: giubbotto = meno danno
    const bf = P('buttafuori');
    reset(bf, -6, 0);
    g.fpsAb.onAbilityPress(bf, { reload: 1.5, magazine: 30 }, g.players, () => {});
    g.applyDamage(bf, 50, src);
    out.guard = bf.hp > 50 && bf.guardAbsorbed > 0;
    // JUDOKA: la spinta blocca chi e' davanti
    const jud = P('judoka');
    const tgt = P('goblin');
    reset(jud, 0, -8);
    jud.yaw = 0; // guarda +Z
    reset(tgt, 0, -6.5);
    g.fpsAb.onAbilityPress(jud, { reload: 1.5, magazine: 30 }, g.players, () => {});
    out.shove = tgt.lockTime > 0 && tgt.stunTime > 0;
    return out;
  });
  check(fps?.ciroAlive, 'FPS: Ciro armato — il colpo che lo uccide lo lascia a 1 di vita con un debito');
  check(fps?.ciroPaid, 'FPS: una kill entro il debito lo salda e lo cura');
  check(fps?.guard, 'FPS: Buttafuori — il giubbotto riduce il danno subito');
  check(fps?.shove, 'FPS: Judoka — la spinta blocca (e da vicino atterra) chi sta davanti');
  await endRound('FPS');

  check(errs.length === 0, `nessun errore di pagina ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
} catch (e) {
  console.error('ERRORE', e);
  st.fails++;
} finally {
  await browser.close();
}
console.log(st.fails === 0 ? '\n✅ TUTTO OK' : `\n❌ ${st.fails} controlli falliti`);
process.exitCode = st.fails ? 1 : 0;
