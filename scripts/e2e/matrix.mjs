// Per OGNI minigioco del registry: rullo → intro → gioco (host + 2 telefoni reali) → fine → risultati → rullo. Nessun refresh.
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, phoneView, sleep } from './lib.mjs';

const GAMES = (process.env.GAMES ?? 'quiz,reaction,memory,arena,dodgeball,soccer,volleyball,kart3d,cultura,fps').split(',');
const report = [];

async function until(fn, ms, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(150);
  }
  throw new Error(`timeout: ${what}`);
}

for (const id of GAMES) {
  const browser = await launch();
  const errs = [];
  const row = { id, ok: true, notes: [] };
  let hostPage;
  try {
    const { page, code } = await createRoomOnHost(browser);
    hostPage = page;
    page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 160)));
    const phones = [];
    for (let i = 0; i < 2; i++) {
      const p = await addPhone(browser, code, `P${i + 1}`, i);
      p.page.on('pageerror', (e) => errs.push(`PHONE${i + 1} ` + String(e).slice(0, 160)));
      phones.push(p);
    }
    await hostEval(page, (gm, gid) => gm.selectMinigame(gid), id);
    await sleep(300);
    await page.keyboard.press('Enter');
    // rullo naturale (7s) + intro naturale (3.8s)
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_PLAYING', 25000, 'PLAYING');
    await sleep(2500);
    const snap = await hostSnapshot(page);
    if (snap.pending !== id) row.notes.push(`pending=${snap.pending}`);
    if (snap.active.length !== 1 || snap.active[0] !== id) {
      row.ok = false;
      row.notes.push(`scene attive ${JSON.stringify(snap.active)}`);
    }
    for (const p of phones) {
      const v = await phoneView(p.page);
      const nBtn = await p.page.evaluate(() => document.querySelectorAll('#app button, #app canvas, #app input').length);
      row.notes.push(`${p.name}:"${v.h1 || v.text.slice(0, 30)}"/${nBtn}el`);
      if (/PROSSIMO|ROUND TERMINATO|Riconnessione|Attendi/.test(v.h1)) {
        row.ok = false;
        row.notes.push(`${p.name} bloccato su "${v.h1}"`);
      }
    }
    // fine gioco
    await hostEval(page, (gm) => {
      const ctx = gm.minigameContext;
      ctx.finish({ results: ctx.players.map((p, i) => ({ playerId: p.id, placement: i + 1, score: 10 - i })) });
    });
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_FINISHED', 8000, 'FINISHED');
    await sleep(800);
    let s2 = await hostSnapshot(page);
    if (s2.active.length !== 1 || s2.active[0] !== 'FinishedScene' || s2.overlays) {
      row.ok = false;
      row.notes.push(`dopo la fine: ${JSON.stringify(s2)}`);
    }
    for (const p of phones) {
      const v = await phoneView(p.page);
      if (v.h1 !== 'ROUND TERMINATO') {
        row.ok = false;
        row.notes.push(`${p.name} dopo la fine: "${v.h1}"`);
      }
    }
    await until(async () => (await hostSnapshot(page)).phase === 'MINIGAME_ROULETTE', 25000, 'ROULETTE dopo i risultati');
    await sleep(700);
    s2 = await hostSnapshot(page);
    if (s2.active.length !== 1 || s2.active[0] !== 'RouletteScene') {
      row.ok = false;
      row.notes.push(`nel rullo: ${JSON.stringify(s2.active)}`);
    }
    for (const p of phones) {
      const v = await phoneView(p.page);
      if (v.h1 !== 'PROSSIMO GIOCO...') {
        row.ok = false;
        row.notes.push(`${p.name} nel rullo: "${v.h1}"`);
      }
    }
  } catch (e) {
    row.ok = false;
    row.notes.push('ERR ' + String(e).slice(0, 160));
  }
  if (errs.length) {
    row.ok = false;
    row.notes.push(`pageerror x${errs.length}: ${errs.slice(0, 3).join(' | ')}`);
  }
  report.push(row);
  console.log(`${row.ok ? '✅' : '❌'} ${id}: ${row.notes.join('  ')}`);
  await browser.close().catch(() => {});
}
const failed = report.filter((r) => !r.ok);
console.log(`\n${failed.length ? '❌' : '✅'} ${report.length - failed.length}/${report.length} giochi OK`);
process.exitCode = failed.length ? 1 : 0;
