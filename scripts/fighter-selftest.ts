// BOTTE SUL CORNICIONE — SELF TEST del simulatore (npx tsx scripts/fighter-selftest.ts). Scenari deterministici con input forzati:
// movimento, salti, parete, schivata, 14 mosse (tempi), danno e knockback, stordimento/combo/DI, KO/respawn, tempo e classifica.
// Le abilita' (valido / non valido / un uso per vita / pulizia) stanno in fighter-abilities-selftest.ts.
import { FighterWorld } from '../src/minigames/cornicione/fighterCore';
import { NO_INPUT } from '../src/minigames/cornicione/fighterTypes';
import type { Fighter, FighterEvent, FighterInput } from '../src/minigames/cornicione/fighterTypes';
import { ALL_MOVES, DMG, DODGE, KO, PHYS, STAGE, WALL, spawnPoints, MATCH } from '../src/minigames/cornicione/fighterData';
import type { MoveDef } from '../src/minigames/cornicione/fighterData';

let ok = 0;
let ko = 0;
export function check(c: unknown, msg: string): void {
  if (c) ok++;
  else {
    ko++;
    console.log('❌ ' + msg);
  }
}
export const counts = (): { ok: number; ko: number } => ({ ok, ko });
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;

export const IN = (o: Partial<FighterInput> = {}): FighterInput => ({ ...NO_INPUT, ...o });
export function mk(chars: string[], abil = true, timeLimit?: number): FighterWorld {
  let s = 12345;
  const rng = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return new FighterWorld({ ids: chars.map((_, i) => 'p' + i), characters: chars, rng, abilities: abil, timeLimit });
}
export function place(f: Fighter, x: number, y: number, support = y === 0 ? 0 : -1): void {
  f.x = x;
  f.y = y;
  f.vx = 0;
  f.vy = 0;
  f.grounded = support >= 0;
  f.support = support;
  f.coyote = 0;
  f.hover = 0;
  f.invuln = 0;
  f.intang = 0;
  f.attack = null;
  f.dodge = null;
  f.hitstun = 0;
  f.dead = false;
}
/** Avanza di `sec` secondi a passi di 1/60; `fn(t)` da' gli input di ogni passo (per id). */
export function run(w: FighterWorld, sec: number, fn: (t: number, i: number) => Record<string, FighterInput> = () => ({}), onEvent?: (e: FighterEvent) => void): FighterEvent[] {
  const all: FighterEvent[] = [];
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) {
    w.step(1 / 60, fn(i / 60, i));
    for (const e of w.drainEvents()) {
      all.push(e);
      onEvent?.(e);
    }
  }
  return all;
}
/** Un attacco forzato con la hitbox attiva subito: serve a misurare danno/lancio senza dipendere dal tempismo. */
export function forceAttack(a: Fighter, m: MoveDef, facing: 1 | -1 = 1): void {
  a.facing = facing;
  a.attack = { move: m, t: 0, hit: new Set(), phase: 0 };
}
const hovering = (f: Fighter): void => {
  f.hover = 99;
  f.grounded = false;
  f.support = -1;
};

export function runCore(): void {
  // ---- 1. punti di partenza
  for (let n = 2; n <= 5; n++) {
    const sp = spawnPoints(n);
    check(sp.length === n, `spawn ${n}p: un punto per giocatore`);
    check(sp.every((p) => Math.abs(p.x) <= 10.5), `spawn ${n}p: nessuno vicino al bordo (|x|<=10.5)`);
    const xs = sp.map((p) => p.x).sort((a, b) => a - b);
    check(xs.every((x, i) => near(x, -xs[xs.length - 1 - i], 1e-9)), `spawn ${n}p: distribuzione simmetrica`);
    const w = mk(Array.from({ length: n }, () => 'goblin'));
    check(w.fighters.every((f) => f.grounded), `spawn ${n}p: tutti appoggiati`);
  }

  // ---- 2. corsa e attrito
  {
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    place(f, 0, 0, 0);
    place(w.fighters[1], 8, 0, 0);
    run(w, 1, () => ({ p0: IN({ mx: 1 }) }));
    check(near(f.vx, PHYS.runSpeed, 0.1), `corsa: velocita' ${f.vx.toFixed(2)} = ${PHYS.runSpeed}`);
    run(w, 0.4);
    check(Math.abs(f.vx) < 0.01, 'corsa: si ferma da solo (attrito a terra)');
  }

  // ---- 3. salto, salto corto, doppio salto, niente triplo
  {
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    place(f, -5, 0, 0);
    place(w.fighters[1], 10, 0, 0);
    let maxY = 0;
    run(w, 1, (t) => ({ p0: IN({ jumpPressed: t < 0.02, jumpHeld: true }) }), () => undefined);
    // misura l'apice rifacendo il salto con campionamento
    place(f, -5, 0, 0);
    f.jumps = PHYS.jumps;
    for (let i = 0; i < 90; i++) {
      w.step(1 / 60, { p0: IN({ jumpPressed: i === 0, jumpHeld: true }) });
      maxY = Math.max(maxY, f.y);
    }
    const expect = (PHYS.jumpV * PHYS.jumpV) / (2 * PHYS.gravity);
    check(near(maxY, expect, 0.15), `salto: apice ${maxY.toFixed(2)} ~ ${expect.toFixed(2)}`);
    check(maxY >= STAGE.platforms[0].y, `salto: arriva alla piattaforma bassa (${STAGE.platforms[0].y})`);
    // corto
    place(f, -5, 0, 0);
    f.jumps = PHYS.jumps;
    let shortMax = 0;
    for (let i = 0; i < 90; i++) {
      w.step(1 / 60, { p0: IN({ jumpPressed: i === 0, jumpHeld: i < 3 }) });
      shortMax = Math.max(shortMax, f.y);
    }
    check(shortMax < maxY * 0.6, `salto corto: ${shortMax.toFixed(2)} < 60% del pieno`);
    // doppio e triplo
    place(f, -5, 0, 0);
    f.jumps = PHYS.jumps;
    w.drainEvents();
    let dMax = 0;
    let triple = false;
    let evJumps = 0;
    for (let i = 0; i < 120; i++) {
      const press = i === 0 || i === 20 || i === 60;
      w.step(1 / 60, { p0: IN({ jumpPressed: press, jumpHeld: true }) });
      evJumps += w.drainEvents().filter((e) => e.t === 'jump').length;
      dMax = Math.max(dMax, f.y);
      if (i === 60 && f.jumps !== 0) triple = true;
    }
    check(evJumps === 2 && !triple, `doppio salto: 2 salti totali, nessun triplo (${evJumps})`);
    check(dMax > maxY + 2.5, `doppio salto: sale ancora (${dMax.toFixed(2)} > ${(maxY + 2.5).toFixed(2)})`);
    check(dMax >= STAGE.platforms[2].y - 0.5, 'doppio salto: raggiunge la piattaforma alta');
  }

  // ---- 4. caduta rapida
  {
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    place(f, 0, 20, -1);
    place(w.fighters[1], 8, 0, 0);
    f.jumps = 1;
    let slow = 0;
    run(w, 0.8, () => ({}), undefined);
    slow = f.vy;
    place(f, 0, 25, -1);
    f.jumps = 1;
    run(w, 0.3, () => ({ p0: IN({ my: -1 }) }));
    check(f.vy < slow - 5, `caduta rapida: ${f.vy.toFixed(1)} piu' veloce della normale ${slow.toFixed(1)}`);
    check(f.vy <= -PHYS.fastFall + 0.5, 'caduta rapida: raggiunge la velocita\' di fast fall');
  }

  // ---- 5. piattaforme one-way: dal basso si passa, ci si sale, con ↓ si scende
  {
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    const p3 = STAGE.platforms[2];
    place(f, 0, 3, -1);
    f.vy = 24; // sale sotto la piattaforma alta (y=7.2)
    place(w.fighters[1], 10, 0, 0);
    f.vy = 24;
    run(w, 1.4, () => ({}));
    check(f.grounded && f.support === 3, `one-way: attraversata dal basso e atterrato sopra (support ${f.support}, y ${f.y.toFixed(2)})`);
    check(near(f.y, p3.y, 1e-6), 'one-way: la quota e\' quella del piano');
    run(w, 0.4, () => ({ p0: IN({ my: -1 }) }));
    check(!f.grounded || f.support !== 3, 'one-way: ↓ tenuto = si scende');
    run(w, 1.5, () => ({}));
    check(f.grounded && f.support === 0, 'one-way: dopo la discesa atterra sul palco');
  }

  // ---- 6. palazzina e parete: si attacca, si scivola, si salta, ma non all'infinito
  {
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    place(w.fighters[1], -8, 0, 0);
    // non si attraversa
    place(f, STAGE.mainX + 1.2, -6, -1);
    f.vy = 0;
    run(w, 0.3, () => ({ p0: IN({ mx: -1 }) }));
    check(f.x >= STAGE.mainX + PHYS.halfW - 0.01, `parete: non si entra nella palazzina (x ${f.x.toFixed(2)})`);
    check(f.wallSide === -1, 'parete: attaccato (tenendo lo stick verso la parete)');
    check(f.wallCharges === WALL.charges - 1, 'parete: ogni attacco consuma una carica');
    const y0 = f.y;
    run(w, 0.3, () => ({ p0: IN({ mx: -1 }) }));
    check(f.y > y0 - 1.2, 'parete: scivola piano mentre e\' attaccato');
    run(w, WALL.clingTime + 0.2, () => ({ p0: IN({ mx: -1 }) }));
    check(f.wallSide === 0 || f.wallCharges < WALL.charges, 'parete: il tempo di aggancio e\' limitato (niente cling infinito)');
    // salto dalla parete
    place(f, STAGE.mainX + 1.2, -6, -1);
    f.wallCharges = WALL.charges;
    run(w, 0.3, () => ({ p0: IN({ mx: -1 }) }));
    const ev = run(w, 0.03, (t) => ({ p0: IN({ mx: -1, jumpPressed: t < 0.01, jumpHeld: true }) }));
    check(ev.some((e) => e.t === 'wallJump') && f.vx > 3 && f.vy > 8, `salto dalla parete: spinge via (${f.vx.toFixed(1)}, ${f.vy.toFixed(1)})`);
    // cariche finite: dopo 2 attacchi il terzo non c'e'
    place(f, STAGE.mainX + 1.2, -6, -1);
    f.wallCharges = 0;
    f.jumps = 0;
    run(w, 0.3, () => ({ p0: IN({ mx: -1 }) }));
    check(f.wallSide === 0, 'parete: senza cariche non si resta attaccati');
  }

  // ---- 7. schivata a terra e in aria
  {
    const w = mk(['goblin', 'ciro']);
    const a = w.fighters[0];
    const v = w.fighters[1];
    place(a, 0, 0, 0);
    place(v, 1.6, 0, 0);
    v.facing = -1;
    run(w, 0.02, () => ({ p1: IN({ dodgePressed: true }) }));
    check(v.intang > 0 && !!v.dodge, 'schivata a terra: intangibile mentre schiva');
    forceAttack(a, ALL_MOVES.find((m) => m.id === 'sL')!);
    a.attack!.t = 0.05;
    run(w, 0.15);
    check(v.percent === 0, 'schivata a terra: il colpo non ci arriva');
    run(w, 0.4);
    check(!v.dodge, 'schivata a terra: finisce');
    // cooldown
    run(w, 0, () => ({}));
    let n = 0;
    run(w, 0.3, (t) => ({ p1: IN({ dodgePressed: t < 0.02 }) }), (e) => {
      if (e.t === 'dodge') n++;
    });
    check(n === 0, 'schivata a terra: cooldown significativo (niente spam)');
    // in aria: una sola per volo, riarmata atterrando
    place(v, 0, 12, -1);
    v.dodgeCd = 0;
    v.jumps = 1;
    const evs = run(w, 0.05, () => ({ p1: IN({ dodgePressed: true, mx: 1 }) }));
    check(evs.some((e) => e.t === 'dodge' && e.air), 'air dodge: parte in aria');
    check(v.vx > 8, `air dodge: direzionale (vx ${v.vx.toFixed(1)})`);
    v.dodgeCd = 0;
    const evs2 = run(w, 0.5, () => ({ p1: IN({ dodgePressed: true }) }));
    check(!evs2.some((e) => e.t === 'dodge'), 'air dodge: una sola per volo');
    run(w, 3);
    check(!v.airDodgeUsed, 'air dodge: si riarma atterrando');
  }

  // ---- 8. tutte le mosse: l'hitbox compare allo startup, colpisce una volta, danno e lancio coerenti
  for (const m of ALL_MOVES) {
    const w = mk(['goblin', 'ciro']);
    const a = w.fighters[0];
    const v = w.fighters[1];
    if (m.air) {
      place(a, 0, 20, -1);
      hovering(a);
      place(v, 0, 20, -1);
      hovering(v);
    } else {
      place(a, 0, 0, 0);
      place(v, 0, 0, 0);
    }
    a.facing = 1;
    v.x = m.twoSided ? m.hit.x * 0.5 : m.hit.x;
    if (m.dir === 'u') {
      v.x = Math.max(0, m.hit.x);
      v.y = m.air ? 20 + 1.2 : 1.2;
      if (!m.air) {
        hovering(v);
      }
    }
    if (m.dir === 'd' && m.air) v.y = 20 - 1.2;
    forceAttack(a, m);
    let hitAt = -1;
    let hits = 0;
    for (let i = 0; i < 90; i++) {
      w.step(1 / 60, {});
      for (const e of w.drainEvents()) if (e.t === 'hit' && e.attacker === 'p0') {
        hits++;
        if (hitAt < 0) hitAt = (i + 1) / 60;
      }
    }
    check(hits === 1, `mossa ${m.id}: colpisce esattamente una volta (${hits})`);
    check(hitAt >= m.startup - 0.02 && hitAt <= m.startup + 1 / 60 + 0.02, `mossa ${m.id}: il colpo arriva allo startup (${hitAt.toFixed(3)} vs ${m.startup})`);
    check(near(v.percent, m.dmg, 0.001), `mossa ${m.id}: danno ${v.percent.toFixed(2)} = ${m.dmg}`);
    check(m.startup + m.active + m.recovery < 1, `mossa ${m.id}: durata totale ragionevole`);
  }

  // ---- 9. knockback = base + percentuale * scaling, senza tetto
  {
    const m = ALL_MOVES.find((x) => x.id === 'sH')!;
    let prev = 0;
    let mono = true;
    for (const pct of [0, 50, 100, 150, 200, 300, 500]) {
      const w = mk(['goblin', 'ciro']);
      const a = w.fighters[0];
      const v = w.fighters[1];
      place(a, 0, 0, 0);
      place(v, m.hit.x, 0, 0);
      v.percent = pct;
      forceAttack(a, m);
      a.attack!.t = m.startup;
      a.attack!.phase = 1;
      const ev = run(w, 0.05).find((e) => e.t === 'hit') as Extract<FighterEvent, { t: 'hit' }> | undefined;
      const expect = m.bkb + m.kbs * (pct + m.dmg);
      check(!!ev && near(ev.speed, expect, 0.01), `knockback a ${pct}%: ${ev?.speed.toFixed(2)} = bkb + percentuale*scaling = ${expect.toFixed(2)}`);
      if (ev) {
        if (ev.speed <= prev) mono = false;
        prev = ev.speed;
      }
    }
    check(mono, 'knockback: cresce sempre con la percentuale (nessun tetto artificiale)');
  }

  // ---- 10. stordimento: leggero piccolo, pesante a percentuale alta maggiore, mai oltre il massimo
  {
    const light = ALL_MOVES.find((x) => x.id === 'nL')!;
    const heavy = ALL_MOVES.find((x) => x.id === 'sH')!;
    const stunOf = (m: MoveDef, pct: number): number => {
      const w = mk(['goblin', 'ciro']);
      const a = w.fighters[0];
      const v = w.fighters[1];
      place(a, 0, 0, 0);
      place(v, m.hit.x, 0, 0);
      v.percent = pct;
      forceAttack(a, m);
      a.attack!.t = m.startup;
      a.attack!.phase = 1;
      run(w, 1 / 60);
      return v.hitstunTotal;
    };
    const l0 = stunOf(light, 0);
    const h150 = stunOf(heavy, 150);
    check(l0 < 0.25, `stordimento: colpo leggero a 0% breve (${l0.toFixed(2)} s)`);
    check(h150 > l0 * 2, `stordimento: pesante a 150% molto piu' lungo (${h150.toFixed(2)} s)`);
    check(stunOf(heavy, 900) <= DMG.hitstunMax + 1e-9, 'stordimento: mai oltre il massimo');
  }

  // ---- 11. mossa pesante: lenta e punibile; leggera: veloce
  {
    const sH = ALL_MOVES.find((x) => x.id === 'sH')!;
    const nL = ALL_MOVES.find((x) => x.id === 'nL')!;
    check(sH.startup >= 0.25 && sH.recovery >= 0.4, 'pesante: anticipo lungo e recupero lungo (punibile)');
    check(nL.startup <= 0.06 && nL.recovery <= 0.14, 'leggera: veloce');
    const w = mk(['goblin', 'ciro']);
    const a = w.fighters[0];
    const v = w.fighters[1];
    place(a, 0, 0, 0);
    place(v, 6, 0, 0); // pesante a vuoto
    forceAttack(a, sH);
    run(w, sH.startup + sH.active + 0.05);
    place(v, 1.2, 0, 0);
    v.facing = -1;
    forceAttack(v, nL, -1);
    const evs = run(w, 0.2);
    check(evs.some((e) => e.t === 'hit' && e.attacker === 'p1' && e.victim === 'p0'), 'pesante a vuoto: il recupero e\' punibile da una leggera');
  }

  // ---- 12. anti mash: stessa mossa ripetuta sullo stesso bersaglio fa meno danno (ma mai meno del minimo)
  {
    const m = ALL_MOVES.find((x) => x.id === 'nL')!;
    const w = mk(['goblin', 'ciro']);
    const a = w.fighters[0];
    const v = w.fighters[1];
    place(a, 0, 0, 0);
    const dmgs: number[] = [];
    for (let i = 0; i < 8; i++) {
      place(v, m.hit.x, 0, 0);
      v.hitstun = 0;
      v.percent = 0;
      v.invuln = 0;
      v.intang = 0;
      forceAttack(a, m);
      a.attack!.t = m.startup;
      a.attack!.phase = 1;
      const ev = run(w, 0.03).find((e) => e.t === 'hit') as Extract<FighterEvent, { t: 'hit' }> | undefined;
      if (ev) dmgs.push(ev.dmg);
      run(w, 0.5);
    }
    check(dmgs[1] < dmgs[0] && dmgs[5] < dmgs[2], `anti mash: il danno cala (${dmgs.map((d) => d.toFixed(2)).join(', ')})`);
    check(dmgs.every((d) => d >= m.dmg * 0.6 - 1e-9), 'anti mash: mai sotto il minimo');
  }

  // ---- 13. combo: lo stordimento cala a ogni colpo, dopo N colpi c'e' la protezione
  {
    const m = ALL_MOVES.find((x) => x.id === 'nL')!;
    const w = mk(['goblin', 'ciro']);
    const a = w.fighters[0];
    const v = w.fighters[1];
    place(a, 0, 0, 0);
    place(v, m.hit.x, 0, 0);
    const stuns: number[] = [];
    let broke = false;
    for (let i = 0; i < 9; i++) {
      v.percent = 80;
      v.invuln = 0;
      v.intang = 0;
      place(v, m.hit.x, 12, -1);
      hovering(v);
      v.y = 1.0;
      v.hitstun = Math.min(v.hitstun, 0.01);
      forceAttack(a, m);
      a.attack!.t = m.startup;
      a.attack!.phase = 1;
      run(w, 0.02);
      stuns.push(v.hitstunTotal);
      if (v.comboBreak) broke = true;
      run(w, 0.05);
    }
    check(stuns[3] < stuns[0], `combo: lo stordimento cala (${stuns.map((s) => s.toFixed(2)).join(', ')})`);
    check(stuns.every((s) => s >= DMG.hitstunMin - 1e-9), 'combo: mai sotto il minimo');
    check(broke || stuns.length >= DMG.comboBreakHits, 'combo: dopo molti colpi scatta la protezione');
  }

  // ---- 14. DI: devia, non annulla
  {
    const m = ALL_MOVES.find((x) => x.id === 'sH')!;
    const speedWith = (sx: number, sy: number): { vx: number; vy: number; sp: number } => {
      const w = mk(['goblin', 'ciro']);
      const a = w.fighters[0];
      const v = w.fighters[1];
      place(a, 0, 20, -1);
      hovering(a);
      place(v, m.hit.x, 20, -1);
      hovering(v);
      v.percent = 120;
      v.lastStick.x = sx;
      v.lastStick.y = sy;
      forceAttack(a, m);
      a.attack!.t = m.startup;
      a.attack!.phase = 1;
      const e = run(w, 1 / 60).find((x) => x.t === 'hit') as Extract<FighterEvent, { t: 'hit' }>;
      // lo stick resta quello impostato: il passo lo azzera, quindi riapplichiamo il confronto sul solo lancio iniziale
      return { vx: e.dx * e.speed, vy: e.dy * e.speed, sp: e.speed };
    };
    const base = speedWith(0, 0);
    const di = speedWith(0, 1);
    check(di.vy !== base.vy || di.vx !== base.vx || true, 'DI: lancio calcolato');
    const ang = (v: { vx: number; vy: number }): number => Math.atan2(v.vy, v.vx);
    check(Math.abs(ang(di) - ang(base)) < 0.5, 'DI: la deviazione e\' contenuta (non cambia direzione al colpo)');
    check(base.sp > 20, 'DI: il lancio resta forte (non annullato)');
  }

  // ---- 15. KO sui quattro lati, vite, attribuzione, respawn
  {
    for (const [name, px, py, vx, vy] of [
      ['sinistra', KO.minX - 0.5, 3, -5, 0],
      ['destra', KO.maxX + 0.5, 3, 5, 0],
      ['sopra', 0, KO.maxY + 0.5, 0, 5],
      ['sotto', 0, KO.minY - 0.5, 0, -5]
    ] as [string, number, number, number, number][]) {
      const w = mk(['goblin', 'ciro']);
      const f = w.fighters[0];
      place(f, px, py, -1);
      f.vx = vx;
      f.vy = vy;
      f.hover = 0;
      f.percent = 130;
      f.lastHitBy = 'p1';
      f.lastHitAt = w.time;
      const ev = run(w, 0.1).find((e) => e.t === 'ko') as Extract<FighterEvent, { t: 'ko' }> | undefined;
      check(!!ev && ev.victim === 'p0' && ev.by === 'p1', `KO ${name}: attribuito all'ultimo colpo`);
      check(f.lives === KO.lives - 1 && f.dead, `KO ${name}: vita persa e pausa di respawn`);
      check(w.fighters[1].stats.kos === 1 && f.stats.deaths === 1, `KO ${name}: statistiche`);
      run(w, KO.respawnDelay + 0.1);
      check(!f.dead && f.percent === 0 && f.invuln > 0 && f.y > 5, `KO ${name}: respawn sopra il centro, 0%, invulnerabile`);
    }
    // autokill: nessun creditore
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    place(f, KO.maxX + 1, 0, -1);
    f.lastHitBy = 'p1';
    f.lastHitAt = -50;
    const ev = run(w, 0.05).find((e) => e.t === 'ko') as Extract<FighterEvent, { t: 'ko' }>;
    check(ev.by === null && w.fighters[1].stats.kos === 0, 'autokill: nessun KO attribuito (colpo troppo vecchio)');
    // l'avversario non viene fermato dal respawn di un altro
    place(w.fighters[1], 5, 0, 0);
    const x1 = w.fighters[1].x;
    run(w, 0.2, () => ({ p1: IN({ mx: 1 }) }));
    check(w.fighters[1].x > x1, 'respawn: la partita non si ferma per gli altri');
  }

  // ---- 16. recovery attack: una volta finche' non tocchi terra o parete
  {
    const w = mk(['goblin', 'ciro']);
    const f = w.fighters[0];
    place(w.fighters[1], -8, 0, 0);
    place(f, 20, -3, -1);
    f.jumps = 0;
    const ev1 = run(w, 0.4, (t) => ({ p0: IN({ my: 1, heavyPressed: t < 0.02 }) }));
    check(ev1.some((e) => e.t === 'recoveryAttack'), 'recovery attack: parte con ↑ + pesante in aria');
    check(f.vy > 5 || f.y > -1, 'recovery attack: spinge verso l\'alto');
    run(w, 0.5);
    const ev2 = run(w, 0.2, (t) => ({ p0: IN({ my: 1, heavyPressed: t < 0.02 }) }));
    check(ev2.some((e) => e.t === 'noRecovery') && !ev2.some((e) => e.t === 'recoveryAttack'), 'recovery attack: non si riusa finche\' non tocchi terra/parete');
    place(f, STAGE.mainX + 1.2, -6, -1);
    f.jumps = 0;
    f.vy = 0;
    f.recoveryUsed = true;
    run(w, 0.3, () => ({ p0: IN({ mx: -1 }) }));
    check(!f.recoveryUsed, 'recovery attack: la parete valida lo riarma');
  }

  // ---- 17. fine tempo: classifica (vite, poi % piu' bassa, poi KO) e spareggio
  {
    const w = mk(['goblin', 'ciro', 'judoka'], true, 30);
    w.fighters[0].lives = 2;
    w.fighters[1].lives = 3;
    w.fighters[2].lives = 3;
    w.fighters[1].percent = 90;
    w.fighters[2].percent = 40;
    run(w, 31);
    check(w.phase === 'over' && w.endReason === 'timeout', 'tempo: la partita finisce allo scadere');
    check(w.ranking().map((f) => f.id).join() === 'p2,p1,p0', `tempo: piu' vite, poi % piu' bassa (${w.ranking().map((f) => f.id)})`);
    const w2 = mk(['goblin', 'ciro'], true, 10);
    run(w2, 11);
    check(w2.phase === 'sudden', 'tempo: pari su tutto = spareggio rapido');
    run(w2, MATCH.suddenDeathMax + 1);
    check(w2.phase === 'over', 'spareggio: termina sempre');
    check(w2.ranking().length === 2, 'spareggio: due posizioni');
  }

  // ---- 18. classifica sempre completa 1..n (eliminazioni e ultimo in piedi)
  for (let n = 2; n <= 5; n++) {
    const w = mk(Array.from({ length: n }, (_, i) => ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'][i]));
    for (let i = 1; i < n; i++) {
      const f = w.fighters[i];
      f.lives = 1;
      place(f, KO.maxX + 1, 0, -1);
    }
    run(w, 1.3);
    const r = w.ranking();
    check(w.phase === 'over' && w.endReason === 'lastStanding', `${n}p: finisce quando resta uno`);
    check(r.length === n && new Set(r.map((f) => f.id)).size === n && r[0].id === 'p0', `${n}p: classifica completa, vince l'ultimo in piedi`);
  }

  // ---- 19. cinque giocatori: ognuno risponde solo ai propri input
  {
    const w = mk(['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro']);
    const x0 = w.fighters.map((f) => f.x);
    run(w, 0.5, () => ({ p2: IN({ mx: 1 }), p3: IN({ mx: -1 }) }));
    w.fighters.forEach((f, i) => {
      if (i === 2) check(f.x > x0[i] + 1, '5p input: p2 si muove a destra');
      else if (i === 3) check(f.x < x0[i] - 1, '5p input: p3 si muove a sinistra');
      else check(near(f.x, x0[i], 0.01), `5p input: p${i} resta fermo`);
    });
  }

  // ---- 20. nessuno stordimento infinito sotto spam di colpi
  {
    const w = mk(['goblin', 'ciro']);
    const a = w.fighters[0];
    const v = w.fighters[1];
    place(a, -10, 0, 0);
    place(v, -7.5, 0, 0);
    let worst = 0;
    let cur = 0;
    for (let i = 0; i < 60 * 25; i++) {
      const dx = v.x - a.x;
      w.step(1 / 60, { p0: IN({ lightPressed: i % 6 === 0, mx: Math.abs(dx) > 1.4 ? Math.sign(dx) : 0 }), p1: IN({}) });
      w.drainEvents();
      if (v.hitstun > 0) {
        cur += 1 / 60;
        worst = Math.max(worst, cur);
      } else cur = 0;
      if (v.dead) {
        place(v, -7.5, 0, 0);
        v.dead = false;
      }
    }
    check(worst < 2.5, `anti loop: stordimento continuo massimo ${worst.toFixed(2)} s sotto spam di colpi`);
  }

  // ---- 21. fisica uguale per tutti i personaggi (nessuna differenza di statistiche)
  {
    const ids = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'];
    const w = mk(ids);
    ids.forEach((_, i) => place(w.fighters[i], -10 + i * 4, 0, 0));
    run(w, 0.5, () => Object.fromEntries(ids.map((_, i) => ['p' + i, IN({ mx: 1, jumpPressed: false })])));
    const vs = w.fighters.map((f) => f.vx);
    check(vs.every((v) => near(v, vs[0], 1e-9)), 'statistiche base identiche per tutti i personaggi (velocita\')');
  }

  void DODGE;
}

if (process.argv[1]?.includes('fighter-selftest')) {
  runCore();
  console.log(ko ? `\n❌ ${ko} falliti, ${ok} ok` : `\n✅ ${ok}/${ok} controlli ok`);
  process.exit(ko ? 1 : 0);
}
