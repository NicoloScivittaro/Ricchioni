// QUALITA' HIGH: il cielo non deve sbiancare (il GlowLayer sommava il cielo emissivo a se stesso). Per Arena, Dodgeball, Calcio e Pallavolo
// con ?quality=high misura la luminanza di una fascia di cielo nello screenshot e controlla che il glow sia attivo (HIGH resta HIGH).
//   OUT=cartella node scripts/e2e/high-quality.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, createRoomOnHost, addPhone, hostEval, hostSnapshot, sleep } from './lib.mjs';

const OUT = process.env.OUT ?? '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
for (const id of (process.env.GAMES ?? 'arena,dodgeball,soccer,volleyball').split(',')) {
  const browser = await launch();
  try {
    const { page, code } = await createRoomOnHost(browser);
    for (let i = 0; i < 2; i++) await addPhone(browser, code, `P${i}`, i);
    await hostEval(page, (gm, g) => gm.selectMinigame(g), id);
    await sleep(300);
    await page.keyboard.press('Enter');
    for (let i = 0; i < 200; i++) { if ((await hostSnapshot(page)).phase === 'MINIGAME_PLAYING') break; await sleep(150); }
    for (let i = 0; i < 300; i++) {
      if ((await hostEval(page, (gm, g) => gm.game.scene.getScene(g)?.game3d?.phase, id)) === 'playing') break;
      await sleep(150);
    }
    await sleep(2500); // fuori dal lampo bianco del "VIA!"
    const glow = await hostEval(page, (gm, g) => { const l = gm.game.scene.getScene(g).game3d.scene.effectLayers[0]; return l ? l.isEnabled : null; }, id);
    const measure = async (tag) => {
      const buf = await page.screenshot({ encoding: 'base64' });
      if (OUT) fs.writeFileSync(path.join(OUT, `high-${id}-${tag}.png`), Buffer.from(buf, 'base64'));
      return page.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        // fascia di cielo a sinistra, sotto l'intestazione e sopra il campo (evita titoli e cartelloni)
        const d = x.getImageData(20, 110, 140, 60).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 255;
      }, buf);
    };
    // confronto a parita' di scena: cielo con il glow di HIGH acceso e con il glow spento (il cielo deve restare quello disegnato)
    const withGlow = await measure('glow');
    await hostEval(page, (gm, g) => { for (const l of gm.game.scene.getScene(g).game3d.scene.effectLayers) l.isEnabled = false; }, id);
    await sleep(600);
    const noGlow = await measure('noglow');
    const ok = glow === true && Math.abs(withGlow - noGlow) < 0.08 && withGlow < 0.85;
    console.log(`${ok ? '✅' : '❌'} ${id}: glow ${glow ? 'attivo' : 'SPENTO'}, cielo con glow ${withGlow.toFixed(2)} contro ${noGlow.toFixed(2)} senza (scarto ${Math.abs(withGlow - noGlow).toFixed(2)})`);
    if (!ok) fails++;
  } catch (e) { console.log('❌', id, String(e).slice(0, 150)); fails++; }
  await browser.close().catch(() => {});
}
process.exitCode = fails ? 1 : 0;
