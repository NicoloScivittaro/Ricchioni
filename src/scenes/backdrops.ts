import Phaser from 'phaser';

/**
 * SCENOGRAFIE dei giochi 2D e del rullo (Art Bible: docs/ART_BIBLE.md). Solo sfondo: stanno SOTTO tutto (profondita'
 * -100), lasciano il centro piu' scuro e calmo dove ci sono tessere / VIA / domande, e non cambiano nessun tempo.
 *   memory   bar/pub completamente fuori controllo: bancone, bottiglie, neon "BAR" che sfarfalla, lampada storta
 *   reaction studio TV da game show: muro LED, due fasci di luce, pedana con le luci
 *   quiz     quiz televisivo serio che diventa assurdo (setAbsurd: papera, palla da discoteca, raggi che girano)
 *   cultura  quiz culturale DA BAR: legno caldo, lavagna dietro la domanda, lampade a sospensione, poster
 *   roulette studio + sala giochi + serata tra amici; tint(): per un attimo prende i colori del gioco uscito
 * La parte ferma e' disegnata UNA volta in una texture (in cache tra una partita e l'altra): costo per frame ~nullo.
 */

export type BackdropKind = 'memory' | 'reaction' | 'quiz' | 'cultura' | 'roulette';

export interface Backdrop {
  /** Quiz: 0 = serio, 1 = assurdo (cresce con le domande). */
  setAbsurd(k: number): void;
  /** Rullo: per ~1.5 s lo sfondo prende i colori del gioco uscito (nessun effetto sui tempi). */
  tint(minigameId: string): void;
}

const W = 1280;
const H = 720;
const FONT = '"Arial Black", Arial, sans-serif';

/** Colore guida di ogni gioco (lo stesso dei suoi ambienti 3D): usato dal rullo per la transizione. */
export const GAME_TINT: Record<string, number> = {
  arena: 0x6a3a9a,
  dodgeball: 0x4c7a86,
  soccer: 0x2f8a52,
  volleyball: 0xe8a060,
  kart3d: 0x3a8ad8,
  fps: 0xc9a43a,
  memory: 0x9a3a4a,
  reaction: 0x3a4aa8,
  quiz: 0x5a3ab8,
  cultura: 0xa8683a
};

function rnd(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Disegna una volta su una Graphics e la trasforma in texture riusabile. */
function bake(scene: Phaser.Scene, key: string, draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, W, H);
    g.destroy();
  }
  return scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-100);
}

/** Gradiente verticale a bande (fillGradientStyle non funziona quando la Graphics viene "cotta" in texture). */
function vgrad(g: Phaser.GameObjects.Graphics, top: number, bottom: number, x = 0, y = 0, w = W, h = H, steps = 32): void {
  const a = Phaser.Display.Color.IntegerToColor(top);
  const b = Phaser.Display.Color.IntegerToColor(bottom);
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, steps - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(x, y + (h * i) / steps, w, h / steps + 1);
  }
}

function vignette(g: Phaser.GameObjects.Graphics, strength = 0.55): void {
  // bordo scuro + centro calmo (dove sta il gioco): anelli concentrici morbidi
  for (let i = 0; i < 12; i++) {
    const k = i / 11;
    g.fillStyle(0x000000, (strength * (1 - k)) / 12);
    g.fillRect(0, 0, W, H * 0.06 * (1 - k) + 2);
    g.fillRect(0, H - (H * 0.06 * (1 - k) + 2), W, H * 0.06 * (1 - k) + 2);
  }
}

function sign(scene: Phaser.Scene, x: number, y: number, text: string, color: string, size: number, angle = 0, stroke = '#000000'): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
    .setOrigin(0.5)
    .setAngle(angle)
    .setStroke(stroke, Math.max(2, size * 0.08))
    .setShadow(0, 0, color, 18, true, true)
    .setDepth(-99);
}

// ---------------------------------------------------------------- MEMORIA: pub fuori controllo
function memory(scene: Phaser.Scene): Partial<Backdrop> {
  bake(scene, 'bd_memory', (g) => {
    // parete di legno scuro a doghe
    vgrad(g, 0x2c1b16, 0x1a100d);
    for (let x = 0; x < W; x += 46) {
      g.fillStyle(0x000000, 0.18);
      g.fillRect(x, 0, 3, H * 0.78);
    }
    // mensole con bottiglie (ai lati: il centro resta alle tessere)
    const r = rnd(4);
    const bottleCols = [0x3f6b4a, 0x7a5a2a, 0x5a3a2a, 0x2f4f5f, 0x8a7a4a, 0x6a2f3a];
    for (const [x0, x1] of [[30, 330], [950, 1250]] as const) {
      for (const y of [150, 300, 450]) {
        g.fillStyle(0x6b4a32, 1);
        g.fillRect(x0, y, x1 - x0, 10);
        let x = x0 + 8;
        while (x < x1 - 20) {
          const bw = 16 + r() * 10;
          const bh = 46 + r() * 34;
          g.fillStyle(bottleCols[Math.floor(r() * bottleCols.length)], 0.95);
          g.fillRoundedRect(x, y - bh, bw, bh, 5);
          g.fillRect(x + bw * 0.35, y - bh - 16, bw * 0.3, 18); // collo
          g.fillStyle(0xffffff, 0.18);
          g.fillRect(x + 3, y - bh + 6, 3, bh - 14); // riflesso
          x += bw + 6 + r() * 8;
        }
      }
    }
    // bancone in basso (sotto le schede dei giocatori)
    g.fillStyle(0x4a2e1e, 1);
    g.fillRect(0, H - 120, W, 120);
    g.fillStyle(0x7a4e30, 1);
    g.fillRect(0, H - 128, W, 14);
    // sgabelli e tavolini storti agli angoli
    for (const [x, a] of [[110, -0.2], [1170, 0.25]] as const) {
      g.fillStyle(0x24160f, 1);
      g.fillEllipse(x, H - 150 + a * 30, 150, 26);
      g.fillRect(x - 6, H - 150, 12, 90);
    }
    // centro calmo: alone scuro dietro le tessere
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0x0a0606, 0.06);
      g.fillEllipse(640, 440, 760 - i * 40, 620 - i * 36);
    }
    vignette(g);
  });
  // neon BAR che sfarfalla (rosa) + lampada che dondola
  const neon = sign(scene, 180, 66, 'BAR', '#ff5fb0', 54, -6);
  sign(scene, 1110, 70, 'APERTO\nFINO ALLE 6', '#ffc54d', 22, 4);
  scene.time.addEvent({
    delay: 1700,
    loop: true,
    callback: () => {
      neon.setAlpha(0.35);
      scene.time.delayedCall(70, () => neon.setAlpha(1));
      scene.time.delayedCall(160, () => neon.setAlpha(0.5));
      scene.time.delayedCall(230, () => neon.setAlpha(1));
    }
  });
  const lamp = scene.add.container(440, 0).setDepth(-99); // di lato: al centro c'e' il titolo OSSERVA / TOCCA
  const wire = scene.add.rectangle(0, 0, 3, 34, 0x111111).setOrigin(0.5, 0);
  const shade = scene.add.triangle(0, 34, -26, 22, 26, 22, 0, 0, 0x3a5a3a).setOrigin(0.5, 0);
  const bulb = scene.add.circle(0, 58, 7, 0xffe2a0);
  lamp.add([wire, shade, bulb]);
  lamp.setAngle(-8);
  scene.tweens.add({ targets: lamp, angle: 8, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return {};
}

// ---------------------------------------------------------------- BOTTA AL VOLO: studio TV
function reaction(scene: Phaser.Scene): Partial<Backdrop> {
  bake(scene, 'bd_reaction', (g) => {
    vgrad(g, 0x0d1030, 0x070816);
    // muro LED: puntini tenui
    for (let y = 30; y < H * 0.62; y += 22) {
      for (let x = 20; x < W; x += 22) {
        const d = Math.hypot(x - 640, y - 300) / 700;
        g.fillStyle(0x4a5aff, 0.06 + Math.max(0, 0.12 - d * 0.12));
        g.fillRect(x, y, 6, 6);
      }
    }
    // pedana ellittica con le luci
    g.fillStyle(0x161a3a, 1);
    g.fillEllipse(640, 600, 1100, 170);
    g.lineStyle(4, 0x6a7aff, 0.6);
    g.strokeEllipse(640, 600, 1100, 170);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0xffd27a : 0x8ab4ff, 0.9);
      g.fillCircle(640 + Math.cos(a) * 550, 600 + Math.sin(a) * 85, 4);
    }
    // tralicci laterali con i fari
    for (const x of [40, 1240]) {
      g.fillStyle(0x2a2f4a, 1);
      g.fillRect(x - 10, 0, 20, H);
      for (let y = 60; y < H; y += 120) {
        g.fillStyle(0xfff2c0, 0.9);
        g.fillCircle(x, y, 9);
      }
    }
    vignette(g, 0.6);
  });
  // due fasci di luce che si muovono piano (sotto il VIA, mai sopra)
  const beams = [-1, 1].map((s) => {
    const b = scene.add.triangle(640 + s * 520, -20, 0, 0, -90, 760, 90, 760, 0xbfd2ff, 0.06).setOrigin(0.5, 0).setDepth(-98);
    b.setAngle(s * 22);
    scene.tweens.add({ targets: b, angle: s * 10, duration: 4200 + (s > 0 ? 600 : 0), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return b;
  });
  void beams;
  return {};
}

// ---------------------------------------------------------------- QUIZ: tv seria che diventa assurda
function quiz(scene: Phaser.Scene): Partial<Backdrop> {
  bake(scene, 'bd_quiz', (g) => {
    vgrad(g, 0x1a1640, 0x0d0b22);
    // raggi del logo dietro la domanda (tenui)
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = a0 + Math.PI / 48;
      g.fillStyle(i % 2 ? 0x2a2460 : 0x221d52, 0.55);
      g.beginPath();
      g.moveTo(640, 190);
      g.lineTo(640 + Math.cos(a0) * 900, 190 + Math.sin(a0) * 900);
      g.lineTo(640 + Math.cos(a1) * 900, 190 + Math.sin(a1) * 900);
      g.closePath();
      g.fillPath();
    }
    // colonne laterali con le lampadine da varieta'
    for (const x of [60, 1220]) {
      g.fillStyle(0x2a2050, 1);
      g.fillRoundedRect(x - 40, 120, 80, 470, 14);
      for (let y = 140; y < 580; y += 26) {
        g.fillStyle(0xffd27a, 0.85);
        g.fillCircle(x - 26, y, 5);
        g.fillCircle(x + 26, y, 5);
      }
    }
    // banco dei concorrenti (sotto le schede)
    g.fillStyle(0x241c4a, 1);
    g.fillRect(0, H - 92, W, 92);
    g.fillStyle(0x6a5aff, 0.8);
    g.fillRect(0, H - 96, W, 5);
    vignette(g, 0.5);
  });
  // elementi "assurdi" che compaiono con le domande
  const duck = scene.add.text(1188, 640, '🦆', { fontSize: '44px' }).setOrigin(0.5).setDepth(-97).setAlpha(0);
  const disco = scene.add.text(640, 10, '🪩', { fontSize: '52px' }).setOrigin(0.5, 0).setDepth(-97).setAlpha(0);
  const flamingo = scene.add.text(92, 640, '🦩', { fontSize: '44px' }).setOrigin(0.5).setDepth(-97).setAlpha(0);
  // invisibile (non solo trasparente) finche' non serve: un cerchio a riempimento 0 viene comunque disegnato a ogni frame
  const disc = scene.add.circle(640, 190, 340, 0xff5fb0, 0).setDepth(-99).setVisible(false);
  let absurd = -1;
  return {
    setAbsurd(k: number): void {
      const lvl = k >= 0.85 ? 3 : k >= 0.55 ? 2 : k >= 0.3 ? 1 : 0;
      if (lvl === absurd) return;
      absurd = lvl;
      if (lvl >= 1) scene.tweens.add({ targets: duck, alpha: 1, duration: 600 });
      if (lvl >= 2) {
        scene.tweens.add({ targets: disco, alpha: 1, duration: 600 });
        scene.tweens.add({ targets: disco, angle: 360, duration: 6000, repeat: -1 });
      }
      if (lvl >= 3) {
        scene.tweens.add({ targets: flamingo, alpha: 1, duration: 600 });
        disc.setVisible(true);
        scene.tweens.add({ targets: disc, fillAlpha: 0.08, duration: 900, yoyo: true, repeat: -1 });
      }
    }
  };
}

// ---------------------------------------------------------------- CULTURA: quiz da bar
function cultura(scene: Phaser.Scene): Partial<Backdrop> {
  bake(scene, 'bd_cultura', (g) => {
    // legno caldo + boiserie
    vgrad(g, 0x5a3520, 0x2e1a10);
    for (let x = 0; x < W; x += 64) {
      g.fillStyle(0x000000, 0.14);
      g.fillRect(x, 0, 4, H);
    }
    g.fillStyle(0x3a2214, 1);
    g.fillRect(0, H - 150, W, 150);
    g.fillStyle(0x8a5a32, 1);
    g.fillRect(0, H - 156, W, 8);
    // LAVAGNA dietro la domanda (cornice di legno)
    g.fillStyle(0x7a4e2a, 1);
    g.fillRoundedRect(110, 112, 1060, 300, 14);
    g.fillStyle(0x1f3a2e, 1);
    g.fillRoundedRect(126, 128, 1028, 268, 8);
    // segni di gesso cancellato
    const r = rnd(9);
    for (let i = 0; i < 26; i++) {
      g.fillStyle(0xffffff, 0.025);
      g.fillRoundedRect(140 + r() * 900, 140 + r() * 230, 60 + r() * 140, 10 + r() * 16, 6);
    }
    // poster ai lati
    g.fillStyle(0xf1e6c8, 1);
    g.fillRect(20, 440, 130, 170);
    g.fillRect(1130, 430, 130, 170);
    g.fillStyle(0x9a3a2a, 1);
    g.fillRect(20, 440, 130, 18);
    g.fillStyle(0x2a4a6a, 1);
    g.fillRect(1130, 430, 130, 18);
    // bottiglie sul banco
    const cols = [0x3f6b4a, 0x7a5a2a, 0x5a3a2a, 0x2f4f5f];
    for (let i = 0; i < 9; i++) {
      g.fillStyle(cols[i % 4], 0.95);
      g.fillRoundedRect(180 + i * 26, H - 202, 18, 46, 5); // appoggiate sul banco, sotto il testo di stato
      g.fillRect(185 + i * 26, H - 214, 8, 14);
    }
    vignette(g, 0.45);
  });
  sign(scene, 85, 520, 'VIETATO\nSUGGERIRE', '#3a2416', 15, -3, '#f1e6c8').setShadow(0, 0, '#000', 0);
  sign(scene, 1195, 510, 'QUIZ DEL\nGIOVEDÌ', '#1f3a5a', 16, 3, '#f1e6c8').setShadow(0, 0, '#000', 0);
  // lampade a sospensione con il loro cono di luce calda
  for (const x of [230, 1050]) { // ai lati: al centro c'e' il titolo
    scene.add.rectangle(x, 0, 3, 50, 0x111111).setOrigin(0.5, 0).setDepth(-98);
    scene.add.triangle(x, 50, -34, 26, 34, 26, 0, 0, 0x2f4a3a).setOrigin(0.5, 0).setDepth(-98);
    const glow = scene.add.triangle(x, 76, 0, 0, -160, 340, 160, 340, 0xffd27a, 0.05).setOrigin(0.5, 0).setDepth(-99);
    scene.tweens.add({ targets: glow, alpha: 0.08, duration: 2200 + x, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return {};
}

// ---------------------------------------------------------------- RULLO: il cuore del party
function roulette(scene: Phaser.Scene): Partial<Backdrop> {
  bake(scene, 'bd_roulette', (g) => {
    vgrad(g, 0x14102a, 0x07060f);
    // sipari ai lati (bordeaux smorzato)
    for (const [x0, dir] of [[0, 1], [W, -1]] as const) {
      for (let i = 0; i < 6; i++) {
        g.fillStyle(i % 2 ? 0x4a1a2a : 0x3a1422, 1);
        g.fillRect(x0 + dir * i * 22 - (dir < 0 ? 22 : 0), 0, 22, H);
      }
    }
    // pavimento da sala giochi: griglia prospettica neon (sotto le carte, dietro la classifica)
    const hy = 450;
    g.lineStyle(2, 0x5a3aff, 0.35);
    for (let i = -16; i <= 16; i++) {
      g.beginPath();
      g.moveTo(640 + i * 30, hy);
      g.lineTo(640 + i * 150, H);
      g.strokePath();
    }
    for (let k = 0; k < 8; k++) {
      const y = hy + Math.pow(k / 7, 1.8) * (H - hy);
      g.beginPath();
      g.moveTo(130, y);
      g.lineTo(W - 130, y);
      g.strokePath();
    }
    // arco di lampadine sopra il rullo
    for (let i = 0; i <= 30; i++) {
      const a = Math.PI + (i / 30) * Math.PI;
      g.fillStyle(i % 2 ? 0xffd27a : 0xff8ac0, 0.85);
      g.fillCircle(640 + Math.cos(a) * 560, 470 + Math.sin(a) * 380, 5);
    }
    vignette(g, 0.5);
  });
  // tinta del gioco uscito (sopra lo sfondo, sotto le carte)
  const wash = scene.add.rectangle(640, 360, W, H, 0xffffff, 0).setDepth(-90).setVisible(false); // visibile solo durante la tinta
  // bagliore che respira dietro la finestra del rullo
  const halo = scene.add.ellipse(640, 255, 900, 340, 0x7a5aff, 0.06).setDepth(-95);
  scene.tweens.add({ targets: halo, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return {
    tint(minigameId: string): void {
      const c = GAME_TINT[minigameId];
      if (c === undefined) return;
      wash.setFillStyle(c, 0).setVisible(true);
      scene.tweens.add({ targets: wash, fillAlpha: 0.3, duration: 260, yoyo: true, hold: 1100, ease: 'Sine.easeOut', onComplete: () => wash.setVisible(false) });
      halo.setFillStyle(c, 0.18);
    }
  };
}

/** Monta la scenografia del tipo indicato sotto tutto il resto della scena. */
export function addBackdrop(scene: Phaser.Scene, kind: BackdropKind): Backdrop {
  const parts = { memory, reaction, quiz, cultura, roulette }[kind](scene);
  return {
    setAbsurd: parts.setAbsurd ?? (() => {}),
    tint: parts.tint ?? (() => {})
  };
}
