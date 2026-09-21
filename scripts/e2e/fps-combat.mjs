// SPARATORIA — combattimento reale nel browser (host Phaser + telefoni veri):
//  · spaccatutto: 8 pallini per colpo, forte da vicino e debole da lontano
//  · raffica: 3 colpi ravvicinati per pressione del grilletto, poi pausa
//  · bombarda: proiettile lento con splash (danno diretto pieno, cala al bordo), niente danno a se stessi
//  · ricarica manuale e automatica; sacchetto armi (ogni 6 vite le hai usate tutte, mai due uguali di fila)
//  · l'hit al tiratore arriva SOLO se il danno e' stato davvero inflitto (bersaglio con protezione = nessun hit)
//  · screenshot del viewmodel di ogni arma sul telefono (SHOTS=cartella)
//   node scripts/e2e/fps-combat.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const SHOTS = process.env.SHOTS ?? '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const browser = await launch();
const gameClock = (page) => hostEval(page, (gm) => gm.game.scene.getScene('fps').clock);
const waitGame = async (page, sec) => {
  const t0 = await gameClock(page);
  for (let i = 0; i < 400; i++) {
    await sleep(100);
    if ((await gameClock(page)) - t0 >= sec) return;
  }
};
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};
try {
  const { page, code } = await createRoomOnHost(browser, { targetKeyPresses: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const p = await addPhone(browser, code, `P${i + 1}`, i);
    p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 160)));
    phones.push(p);
  }
  await hostEval(page, (gm, id) => gm.selectMinigame(id), 'fps');
  await sleep(300);
  await page.keyboard.press('Enter');
  while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') await sleep(200);
  await sleep(2500);

  // ---- 1) sacchetto armi: 12 pescate = due giri completi, mai due uguali di fila
  const bag = await hostEval(page, async (gm) => {
    const { WEAPONS } = await import('/shared/fpsWeapons.ts');
    const sc = gm.game.scene.getScene('fps');
    const p = sc.players[0];
    p.bag = [];
    const seq = [];
    for (let i = 0; i < 12; i++) {
      sc.equipNext(p);
      seq.push(p.weaponId);
    }
    return { seq, n: WEAPONS.length };
  });
  const uniq = (a) => new Set(a).size;
  check(uniq(bag.seq.slice(0, bag.n)) === bag.n && uniq(bag.seq.slice(bag.n, bag.n * 2)) === bag.n, `sacchetto: ogni ${bag.n} vite si usano tutte le armi (${bag.seq.join(', ')})`);
  check(bag.seq.every((w, i) => i === 0 || w !== bag.seq[i - 1]), 'mai la stessa arma due volte di fila');

  // ---- 2) armi in campo: A spara a B (3 m davanti)
  const setup = (weapon, dist) =>
    hostEval(
      page,
      async (gm, arg) => {
        const { getWeapon } = await import('/shared/fpsWeapons.ts');
        const sc = gm.game.scene.getScene('fps');
        const [A, B] = sc.players;
        // tutti vivi, sani e non protetti (un test precedente puo' aver ucciso qualcuno, che poi rinasce altrove)
        for (const q of sc.players) {
          q.alive = true;
          q.hp = 100;
          q.spawnProtection = 0;
          q.respawnTimer = 0;
        }
        A.x = 12; // corsia libera tra i container (x=8 e x=16)
        A.z = -14;
        B.x = 12;
        B.z = -14 + arg.dist;
        A.weaponId = arg.weapon;
        A.magazine = getWeapon(arg.weapon).magazine;
        A.reloading = false;
        A.burstLeft = 0;
        A.fireCooldown = 0;
        return true;
      },
      { weapon, dist }
    );
  const shoot = (n) =>
    hostEval(
      page,
      async (gm, arg) => {
        const { getWeapon } = await import('/shared/fpsWeapons.ts');
        const sc = gm.game.scene.getScene('fps');
        const [A, B] = sc.players;
        const w = getWeapon(A.weaponId);
        let total = 0;
        const hits = [];
        for (let i = 0; i < arg.n; i++) {
          B.hp = 100;
          B.alive = true;
          B.spawnProtection = 0;
          A.magazine = w.magazine;
          A.yaw = 0;
          A.pitch = 0; // guarda verso +z, dove sta B
          sc.fireShot(A, w);
          const dmg = 100 - B.hp;
          total += dmg;
          hits.push(dmg);
        }
        return { avg: total / arg.n, hits };
      },
      { n }
    );
  await setup('spaccatutto', 3);
  const close = await shoot(40);
  await setup('spaccatutto', 11);
  const far = await shoot(40);
  check(close.avg > 55 && close.hits.every((d) => d % 11 === 0), `spaccatutto a 3 m: ${close.avg.toFixed(0)} danni medi a colpo (pallini da 11)`);
  check(far.avg < close.avg * 0.4, `spaccatutto a 12 m molto piu' debole (${far.avg.toFixed(0)} contro ${close.avg.toFixed(0)})`);

  // ---- 3) raffica: 3 colpi ravvicinati per pressione, poi pausa (misurato sul clock di gioco)
  await setup('raffica', 8);
  await hostEval(page, (gm) => {
    const sc = gm.game.scene.getScene('fps');
    const A = sc.players[0];
    sc.__log = [];
    const orig = sc.fireShot.bind(sc);
    sc.__orig = orig;
    sc.fireShot = (p, w) => {
      if (p === A) sc.__log.push(sc.clock);
      return orig(p, w);
    };
    sc.ctx.input.get(A.id).setDown('fire');
  });
  await waitGame(page, 1.6);
  const log = await hostEval(page, (gm) => {
    const sc = gm.game.scene.getScene('fps');
    sc.ctx.input.get(sc.players[0].id).setUp('fire');
    sc.fireShot = sc.__orig;
    return sc.__log;
  });
  const g = log.map((t) => t - log[0]);
  check(log.length >= 4 && g[2] <= 0.25, `raffica: 3 colpi ravvicinati (a ${g.slice(0, 3).map((x) => x.toFixed(2)).join(" / ")} s)`);
  check(log.length >= 4 && g[3] >= 0.8, `raffica: poi la pausa del ciclo prima del gruppo successivo (${log.length >= 4 ? g[3].toFixed(2) : "?"} s)`);

  // ---- 4) bombarda: proiettile lento + splash; nessun danno a chi spara; nessun hit istantaneo
  await setup('bombarda', 12);
  const bomb = await hostEval(page, async (gm) => {
    const { getWeapon } = await import('/shared/fpsWeapons.ts');
    const sc = gm.game.scene.getScene('fps');
    const [A, B, C] = sc.players;
    const w = getWeapon('bombarda');
    B.hp = 100;
    A.hp = 100;
    B.spawnProtection = 0;
    A.yaw = 0;
    A.pitch = 0;
    A.magazine = w.magazine;
    // C accanto a B (2 m): finisce dentro lo splash
    C.x = B.x + 1.5;
    C.z = B.z;
    C.hp = 100;
    C.spawnProtection = 0;
    sc.fireShot(A, w);
    return { queued: sc.blasts.length, instant: 100 - B.hp, at: sc.blasts[0] ? sc.blasts[0].at - sc.clock : -1 };
  });
  check(bomb.queued === 1 && bomb.instant === 0, `bombarda: il proiettile parte e NON fa danno istantaneo (esplode tra ${bomb.at.toFixed(2)}s)`);
  await waitGame(page, bomb.at + 0.5);
  const after = await hostEval(page, (gm) => {
    const [A, B, C] = gm.game.scene.getScene('fps').players;
    return { a: A.hp, b: B.hp, c: C.hp };
  });
  check(after.b < 100 && after.c < 100, `bombarda: splash su entrambi i bersagli vicini (B ${after.b}, C ${after.c})`);
  check(after.a === 100, 'bombarda: nessun danno a chi ha sparato');

  // ---- 5) ricarica manuale (pulsante) e automatica (caricatore vuoto)
  await setup('mitraglia', 6);
  const rel = await hostEval(page, (gm) => {
    const sc = gm.game.scene.getScene('fps');
    const A = sc.players[0];
    A.magazine = 10;
    sc.ctx.input.get(A.id).tap('reload');
    return true;
  });
  await waitGame(page, 0.5);
  const r1 = await hostEval(page, (gm) => gm.game.scene.getScene('fps').players[0].reloading);
  await waitGame(page, 1.4);
  const r2 = await hostEval(page, (gm) => {
    const A = gm.game.scene.getScene('fps').players[0];
    return { reloading: A.reloading, mag: A.magazine };
  });
  check(rel && r1 === true, 'ricarica manuale: il pulsante avvia la ricarica');
  check(r2.reloading === false && r2.mag === 30, `ricarica completata (${r2.mag}/30)`);
  const auto = await hostEval(page, async (gm) => {
    const { getWeapon } = await import('/shared/fpsWeapons.ts');
    const sc = gm.game.scene.getScene('fps');
    const A = sc.players[0];
    const w = getWeapon('mitraglia');
    A.reloading = false;
    A.magazine = 1;
    sc.fireShot(A, w);
    return A.reloading;
  });
  check(auto === true, "caricatore vuoto dopo l'ultimo colpo: la ricarica parte da sola");

  // ---- 6) l'hit arriva al tiratore SOLO con danno reale (bersaglio protetto = nessun hit)
  const hitLog = await hostEval(page, async (gm) => {
    const { getWeapon } = await import('/shared/fpsWeapons.ts');
    const sc = gm.game.scene.getScene('fps');
    const [A, B] = sc.players;
    A.x = 12;
    A.z = -14;
    B.x = 12;
    B.z = -9;
    A.yaw = 0;
    A.pitch = 0;
    const sent = [];
    const orig = sc.ctx.signal.bind(sc.ctx);
    sc.ctx.signal = (pid, s) => {
      if (s.type === 'hit') sent.push({ pid, ...s });
      return orig(pid, s);
    };
    const w = getWeapon('laser');
    A.magazine = 5;
    B.hp = 100;
    B.spawnProtection = 1.5; // appena rinato: protetto
    sc.fireShot(A, w);
    const protectedHits = sent.length;
    B.spawnProtection = 0;
    B.hp = 100;
    A.magazine = 5;
    sc.fireShot(A, w);
    sc.ctx.signal = orig;
    return { protectedHits, real: sent.length, first: sent[0] };
  });
  check(hitLog.protectedHits === 0, 'bersaglio protetto: nessun hitmarker al tiratore (niente falsi positivi)');
  check(hitLog.real === 1 && hitLog.first && hitLog.first.dmg === 55 && hitLog.first.kill === false, `colpo reale: hit con danno ${hitLog.first?.dmg} (kill=${hitLog.first?.kill})`);

  // ---- 7) screenshot dei viewmodel sul telefono 1
  if (SHOTS) {
    const ph = phones[0].page;
    await ph.setViewport({ width: 800, height: 390, isMobile: true, hasTouch: true });
    await sleep(600);
    for (const id of ['mitraglia', 'spaccatutto', 'laser', 'raffica', 'bombarda', 'sparapiselli']) {
      await hostEval(page, (gm, wid) => {
        const sc = gm.game.scene.getScene('fps');
        const A = sc.players[0];
        A.weaponId = wid;
        A.magazine = 20;
        A.hp = 100;
        A.alive = true;
        sc.blasts.length = 0;
      }, id);
      await sleep(1600); // il telefono riceve lo stato e fa l'estrazione
      // tiene premuto SPARA per catturare rinculo e lampo
      await ph.evaluate(() => {
        const b = document.getElementById('fps-fire');
        b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
      });
      await sleep(id === 'bombarda' ? 250 : 180);
      await ph.screenshot({ path: path.join(SHOTS, `fps-${id}.png`) });
      await ph.evaluate(() => {
        const b = document.getElementById('fps-fire');
        b?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
      });
    }
    // ricarica in corso (barra + arma abbassata), danno da EST (freccia in basso a destra), kill (feedback forte)
    await hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('fps');
      const [A, B] = sc.players;
      A.weaponId = 'raffica';
      A.magazine = 24;
      A.alive = true;
      A.hp = 100;
      B.alive = true;
      B.x = A.x + 7;
      B.z = A.z;
    });
    await sleep(1500);
    await hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('fps');
      const [A] = sc.players;
      A.magazine = 5;
      sc.startReload(A, { ...sc.constructor, id: 'raffica', reload: 3 }); // ricarica vera sull'host: stato e segnale coerenti
    });
    await sleep(1300);
    await ph.screenshot({ path: path.join(SHOTS, 'fps-ricarica.png') });
    await sleep(2200);
    await hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('fps');
      const [A, B] = sc.players;
      sc.ctx.signal(A.id, { type: 'damaged', amount: 30, from: B.id });
    });
    await sleep(140);
    await ph.screenshot({ path: path.join(SHOTS, 'fps-danno.png') });
    await sleep(1200);
    await hostEval(page, (gm) => {
      const sc = gm.game.scene.getScene('fps');
      const [A, B] = sc.players;
      sc.ctx.signal(A.id, { type: 'hit', dmg: 100, kill: true });
      sc.ctx.signal(A.id, { type: 'killed', name: B.name });
    });
    await sleep(220);
    await ph.screenshot({ path: path.join(SHOTS, 'fps-kill.png') });
    console.log('   screenshot in', SHOTS);
  }

  check(errs.length === 0, `nessun errore di pagina (host e telefoni) ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  process.exitCode = fails ? 1 : 0;
} catch (e) {
  console.error('ERRORE', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
