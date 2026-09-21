// TORNA ALLA LOBBY dal menu ESC di OGNI minigioco: la stanza resta, i giocatori restano dentro (stessi id), l'host passa alla RoomScene
// e i telefoni tornano alla scelta personaggio/pronto senza dover rientrare. Nessun errore di pagina.
//   GAMES=quiz,arena node scripts/e2e/lobby-return.mjs
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const GAMES = (process.env.GAMES ?? 'quiz,reaction,memory,arena,dodgeball,soccer,volleyball,kart3d,cultura,fps').split(',');
const HTML_MENU = new Set(['arena', 'dodgeball', 'soccer', 'volleyball', 'kart3d']);
let fails = 0;
for (const id of GAMES) {
  const browser = await launch();
  const errs = [];
  const notes = [];
  let ok = true;
  try {
    const { page, code } = await createRoomOnHost(browser);
    page.on('pageerror', (e) => errs.push('HOST ' + String(e).slice(0, 140)));
    page.on('dialog', (d) => void d.accept()); // confirm() dei menu HTML
    const phones = [];
    for (let i = 0; i < 2; i++) {
      const p = await addPhone(browser, code, `P${i + 1}`, i);
      p.page.on('pageerror', (e) => errs.push(`P${i + 1} ` + String(e).slice(0, 140)));
      phones.push(p);
    }
    const before = await hostEval(page, (gm) => gm.state.players.map((p) => p.id).sort());
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    await sleep(300);
    await page.keyboard.press('Enter');
    for (let i = 0; i < 200; i++) {
      if ((await hostSnapshot(page)).phase === 'MINIGAME_PLAYING') break;
      await sleep(150);
    }
    await sleep(2500);
    await page.keyboard.press('Escape');
    await sleep(700);
    if (HTML_MENU.has(id)) {
      const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /TORNA ALLA LOBBY/.test(x.textContent ?? ''));
        b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 }));
        return !!b;
      });
      if (!clicked) throw new Error('bottone TORNA ALLA LOBBY non trovato');
    } else {
      for (const k of ['ArrowDown', 'ArrowDown', 'Enter', 'ArrowDown', 'Enter']) {
        await page.keyboard.press(k);
        await sleep(450);
      }
    }
    let snap;
    for (let i = 0; i < 60; i++) {
      snap = await hostSnapshot(page);
      if (snap.phase === 'LOBBY' && snap.active[0] === 'RoomScene') break;
      await sleep(200);
    }
    await sleep(800);
    snap = await hostSnapshot(page);
    const after = await hostEval(page, (gm) => ({ code: gm.roomCode, ids: gm.state?.players.map((p) => p.id).sort() ?? [], n: gm.state?.players.length }));
    if (snap.phase !== 'LOBBY' || snap.active.length !== 1 || snap.active[0] !== 'RoomScene') { ok = false; notes.push(`host: ${snap.phase} ${JSON.stringify(snap.active)}`); }
    if (after.code !== code) { ok = false; notes.push(`stanza cambiata ${code} -> ${after.code}`); }
    if (JSON.stringify(after.ids) !== JSON.stringify(before)) { ok = false; notes.push(`giocatori cambiati ${JSON.stringify(before)} -> ${JSON.stringify(after.ids)}`); }
    for (const p of phones) {
      // il telefono con il motore 3D (sparatoria) impiega piu' di un istante a smontarsi: si aspetta fino a 10 s
      let inLobby = false;
      for (let k = 0; k < 50 && !inLobby; k++) {
        inLobby = await p.page.evaluate(() => !!document.querySelector('#chars .char') && !!document.querySelector('#ready'));
        if (!inLobby) await sleep(200);
      }
      if (!inLobby) { ok = false; notes.push(`${p.name} non e' tornato alla scelta personaggio`); }
    }
    notes.push(`stanza ${after.code}, ${after.n} giocatori rimasti`);
  } catch (e) {
    ok = false;
    notes.push('ERR ' + String(e).slice(0, 160));
  }
  if (errs.length) { ok = false; notes.push(`pageerror: ${errs.slice(0, 2).join(' | ')}`); }
  console.log(`${ok ? '✅' : '❌'} ${id}: ${notes.join(' · ')}`);
  if (!ok) fails++;
  await browser.close().catch(() => {});
}
console.log(fails ? `\n❌ ${fails} giochi con problemi` : `\n✅ ${GAMES.length}/${GAMES.length} giochi: si torna alla lobby senza perdere nessuno`);
process.exitCode = fails ? 1 : 0;
