// AUDIT DEI CONTROLLER: per ogni minigioco apre i telefoni reali e, a gioco in corso, in verticale E in orizzontale misura:
// niente scroll di pagina, bottoni raggiungibili (≥ 44px, dentro lo schermo), nessun overflow. Salva anche gli screenshot.
//   node scripts/e2e/controllers.mjs                 (tutti)      GAMES=quiz,fps node scripts/e2e/controllers.mjs
//   OUT=cartella per gli screenshot (default: ./e2e-shots/controllers)
import fs from 'node:fs';
import path from 'node:path';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const GAMES = (process.env.GAMES ?? 'quiz,reaction,memory,arena,dodgeball,soccer,volleyball,kart3d,cultura,fps').split(',');
const OUT = process.env.OUT ?? path.resolve('e2e-shots/controllers');
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = [
  ['portrait', { width: 390, height: 800 }],
  ['landscape', { width: 800, height: 390 }],
  ['small', { width: 360, height: 640 }] // telefono economico
];
let problems = 0;

async function audit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const de = document.documentElement;
    const els = [...document.querySelectorAll('#app button, #app [role=button], #app .btn, #app input, #app textarea, #app select')];
    const small = [];
    const outside = [];
    const clipped = []; // testo che esce dal proprio bottone
    let visible = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none' || el.disabled) continue;
      visible++;
      const label = (el.textContent || el.id || el.className || el.tagName).toString().trim().slice(0, 18);
      if (el.tagName === 'BUTTON') {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        if (t.width > 0 && (t.left < r.left - 2 || t.right > r.right + 2)) clipped.push(label + '(testo ' + Math.round(t.width) + 'px in ' + Math.round(r.width) + 'px)');
      }
      if (Math.min(r.width, r.height) < 44) small.push(`${label}(${Math.round(r.width)}x${Math.round(r.height)})`);
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) outside.push(`${label}(${Math.round(r.left)},${Math.round(r.top)}→${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    return {
      vw,
      vh,
      scrollY: Math.max(0, de.scrollHeight - vh),
      scrollX: Math.max(0, de.scrollWidth - vw),
      visible,
      small: small.slice(0, 6),
      outside: outside.slice(0, 6),
      clipped: clipped.slice(0, 6)
    };
  });
}

for (const id of GAMES) {
  const browser = await launch();
  try {
    const { page, code } = await createRoomOnHost(browser);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    const phones = [];
    for (let i = 0; i < 2; i++) phones.push(await addPhone(browser, code, `P${i + 1}`, i));
    await hostEval(page, (gm, gid) => gm.selectMinigame(gid), id);
    await sleep(300);
    await page.keyboard.press('Enter');
    const t0 = Date.now();
    while ((await hostSnapshot(page)).phase !== 'MINIGAME_PLAYING') {
      if (Date.now() - t0 > 30000) throw new Error('timeout PLAYING');
      await sleep(200);
    }
    await sleep(id === 'fps' ? 6000 : 3500); // il gioco 3D sul telefono ha bisogno di qualche secondo (headless)
    const ph = phones[0].page;
    for (const [name, vp] of VIEWS) {
      await ph.setViewport({ ...vp, isMobile: true, hasTouch: true });
      await sleep(700);
      const a = await audit(ph);
      await ph.screenshot({ path: path.join(OUT, `${id}-${name}.png`) });
      const bad = a.scrollY > 2 || a.scrollX > 2 || a.outside.length > 0 || a.small.length > 0 || a.clipped.length > 0;
      if (bad) problems++;
      console.log(
        `${bad ? '⚠️ ' : '✅'} ${id.padEnd(10)} ${name.padEnd(9)} ${a.vw}x${a.vh} · bottoni ${a.visible}` +
          (a.scrollY > 2 ? ` · SCROLL-Y +${a.scrollY}` : '') +
          (a.scrollX > 2 ? ` · SCROLL-X +${a.scrollX}` : '') +
          (a.small.length ? ` · piccoli: ${a.small.join(' ')}` : '') +
          (a.outside.length ? ` · fuori schermo: ${a.outside.join(' ')}` : '') +
          (a.clipped.length ? ` · testo fuori dal bottone: ${a.clipped.join(' ')}` : '')
      );
    }
    if (errs.length) {
      problems++;
      console.log(`❌ ${id}: errori di pagina ${JSON.stringify(errs.slice(0, 2))}`);
    }
  } catch (e) {
    problems++;
    console.log(`❌ ${id}: ${String(e).slice(0, 160)}`);
  } finally {
    await browser.close();
  }
}
console.log(problems ? `\n${problems} segnalazioni (vedi ⚠️/❌; screenshot in ${OUT})` : `\n✅ controller ok su tutti i giochi (screenshot in ${OUT})`);
process.exitCode = problems ? 1 : 0;
