import Phaser from 'phaser';

/**
 * DESIGN SYSTEM dell'host (PC): un solo set di colori, font, pannelli e tempi per tutte le scene
 * (rullo, intro, risultati, classifica, finale, menu ESC, loading, errori) così i minigiochi sembrano
 * parti dello STESSO gioco. Il controller mobile usa gli stessi token come variabili CSS (style.css).
 */
export const THEME = {
  // sfondi e pannelli
  bg: '#0b0b14',
  bgInt: 0x0b0b14,
  panel: 0x111426,
  panelStrong: 0x1a1f36,
  line: 0x2b3050,
  // accenti
  gold: '#fbbf24',
  goldInt: 0xfbbf24,
  blue: '#93c5fd',
  green: '#4ade80',
  greenInt: 0x4ade80,
  red: '#f87171',
  redInt: 0xf87171,
  // testo
  text: '#ffffff',
  textDim: '#d1d5db',
  muted: '#9ca3af',
  // font
  title: '"Arial Black", Arial, sans-serif',
  body: 'Arial, sans-serif',
  // durate standard (ms): brevi, mai bloccanti
  fast: 160,
  normal: 280,
  slow: 420
} as const;

/** Medaglia/posizione: 1 → 🥇, 2 → 🥈, 3 → 🥉, poi "4°". */
export function medal(place: number): string {
  return place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}°`;
}

/** Testo titolo (font "Arial Black" + ombra) — centrato di default. */
export function titleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 48,
  color: string = THEME.gold
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: THEME.title, fontSize: `${size}px`, color, align: 'center' })
    .setOrigin(0.5)
    .setShadow(0, 4, '#000000', 8);
}

/** Testo corrente (Arial). */
export function bodyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 22,
  color: string = THEME.textDim
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: THEME.body, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);
}

/** Pannello rettangolare con bordo (stile unico per righe, card, chip, modali). */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; stroke?: number; strokeWidth?: number; alpha?: number } = {}
): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(x, y, w, h, opts.fill ?? THEME.panel, opts.alpha ?? 0.96)
    .setStrokeStyle(opts.strokeWidth ?? 2, opts.stroke ?? THEME.line);
}

/** Colore "#rrggbb" → intero Phaser. */
export function hexInt(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

/** Ingresso di scena uniforme: dissolvenza breve (mai più di ~180ms, non blocca nulla). */
export function sceneIn(scene: Phaser.Scene): void {
  scene.cameras.main.setBackgroundColor(THEME.bg);
  scene.cameras.main.fadeIn(THEME.fast + 20, 11, 11, 20);
}

/**
 * Schermata di CARICAMENTO standard per i minigiochi 3D (asset/motore in arrivo): titolo, nome del gioco,
 * puntini animati e barra indeterminata. Restituisce una funzione che la rimuove.
 */
export function showLoading(scene: Phaser.Scene, icon: string, name: string): () => void {
  const objs: Phaser.GameObjects.GameObject[] = [];
  objs.push(titleText(scene, 640, 250, `${icon}`, 84, THEME.text));
  objs.push(titleText(scene, 640, 340, name, 40, THEME.gold));
  const dots = bodyText(scene, 640, 410, 'CARICAMENTO', 24, THEME.muted);
  objs.push(dots);
  const barBg = scene.add.rectangle(640, 460, 360, 10, THEME.line).setOrigin(0.5);
  const bar = scene.add.rectangle(460, 460, 90, 10, THEME.goldInt).setOrigin(0, 0.5);
  objs.push(barBg, bar);
  let n = 0;
  const ev = scene.time.addEvent({
    delay: 320,
    loop: true,
    callback: () => {
      n = (n + 1) % 4;
      dots.setText(`CARICAMENTO${'.'.repeat(n)}`);
    }
  });
  const tw = scene.tweens.add({ targets: bar, x: 460 + 270, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return () => {
    ev.remove();
    tw.stop();
    for (const o of objs) o.destroy();
  };
}
