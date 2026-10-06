import Phaser from 'phaser';
import { UI, hexToInt } from './uiTokens';
import { addPortrait } from './portraits';

/**
 * COMPONENTI UI della TV (Phaser), costruiti sui token di uiTokens.ts. Le scene non scelgono piu' a mano font, contorni,
 * pannelli e animazioni: usano questi pezzi, cosi' lobby, rullo, giochi 2D e risultati sembrano lo STESSO gioco.
 */

/** Testo DISPLAY (titoli, annunci, numeri importanti): contorno sottile + ombra. */
export function displayText(scene: Phaser.Scene, x: number, y: number, text: string, size: number = UI.size.XL, color: string = UI.color.text): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: UI.font.display, fontSize: `${size}px`, color, align: 'center' })
    .setOrigin(0.5)
    .setStroke(UI.outline.color, size >= 40 ? UI.outline.thick : UI.outline.thin)
    .setShadow(0, UI.shadow.y, UI.shadow.color, UI.shadow.blur, true, true);
}

/** Testo BODY (spiegazioni, stato): pulito, mai sotto UI.size.XS. */
export function infoText(scene: Phaser.Scene, x: number, y: number, text: string, size: number = UI.size.S, color: string = UI.color.textDim, wrap = 0): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: UI.font.body, fontStyle: 'bold', fontSize: `${Math.max(UI.size.XS, size)}px`, color, align: 'center', wordWrap: wrap ? { width: wrap } : undefined })
    .setOrigin(0.5);
}

/** Pannello standard (fondo scuro semitrasparente, bordo sottile o d'accento). */
export function uiPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, border: string = UI.color.line, strong = false): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(x, y, w, h, hexToInt(strong ? UI.color.panelStrong : UI.color.panel), UI.color.panelAlpha)
    .setStrokeStyle(strong ? 3 : 2, hexToInt(border), 1);
}

/** Pillola: etichetta compatta con fondo (ROUND 3, OBIETTIVO 120, ⚠ PUNTI DOPPI). */
export function pill(scene: Phaser.Scene, x: number, y: number, text: string, color: string = UI.color.accent, size: number = UI.size.S, originX = 0.5): Phaser.GameObjects.Container {
  const t = scene.add.text(0, 0, text, { fontFamily: UI.font.display, fontSize: `${size}px`, color }).setOrigin(0.5);
  const w = t.width + size * 1.4;
  const h = size * 1.75;
  const bg = scene.add.rectangle(0, 0, w, h, hexToInt(UI.color.panel), 0.9).setStrokeStyle(2, hexToInt(color), 0.85);
  const c = scene.add.container(x + (0.5 - originX) * w, y, [bg, t]);
  c.setSize(w, h);
  return c;
}

/** ANNUNCIO a centro schermo (scatto in entrata, breve, uscita rapida): stessa grammatica di GOOOL/KO dei giochi 3D. */
export function announce(scene: Phaser.Scene, text: string, opts: { sub?: string; color?: string; ms?: number; y?: number } = {}): void {
  const y = opts.y ?? 360;
  const band = scene.add.rectangle(640, y, 1280, opts.sub ? 190 : 150, 0x0b0b14, 0.6).setDepth(900).setAlpha(0);
  const big = displayText(scene, 640, y - (opts.sub ? 22 : 0), text, 96, opts.color ?? UI.color.accent).setDepth(901).setScale(1.6).setAlpha(0);
  const sub = opts.sub ? displayText(scene, 640, y + 58, opts.sub, UI.size.M, UI.color.text).setDepth(901).setAlpha(0) : null;
  const all = [band, big, ...(sub ? [sub] : [])];
  scene.tweens.add({ targets: band, alpha: 1, duration: UI.motion.enter * 0.6 });
  scene.tweens.add({ targets: big, alpha: 1, scale: 1, duration: UI.motion.enter, ease: 'Back.easeOut' });
  if (sub) scene.tweens.add({ targets: sub, alpha: 1, duration: UI.motion.enter, delay: 80 });
  scene.time.delayedCall(opts.ms ?? 1300, () => {
    scene.tweens.add({ targets: all, alpha: 0, duration: UI.motion.exit, onComplete: () => all.forEach((o) => o.destroy()) });
  });
}

export interface BadgePlayer {
  id: string;
  displayName: string;
  characterId: string | null;
  color: string;
  connected?: boolean;
}

export type BadgeState = 'normal' | 'ready' | 'done' | 'out' | 'winner' | 'offline';

/**
 * BADGE GIOCATORE: [RITRATTO] [NOME] [valore] / [stato]. Un solo componente per lobby, giochi 2D, risultati e classifiche.
 * Lo stato non e' mai solo colore: ha sempre un'icona o una parola (✅ FATTO, ✕ FUORI, ⚠ OFFLINE).
 */
export class PlayerBadge {
  readonly root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private face: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  private nameText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private state: BadgeState = 'normal';

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    readonly player: BadgePlayer,
    readonly w = 230,
    readonly h = 70
  ) {
    const face = Math.min(h - 14, 56);
    this.bg = scene.add.rectangle(0, 0, w, h, hexToInt(UI.color.panel), UI.color.panelAlpha).setStrokeStyle(2, hexToInt(player.color), 0.9);
    this.face = addPortrait(scene, -w / 2 + 10 + face / 2, 0, player.characterId, face);
    const tx = -w / 2 + 20 + face;
    const maxW = w - face - 30;
    this.nameText = scene.add
      .text(tx, -h / 2 + 10, player.displayName.toUpperCase(), { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: player.color })
      .setOrigin(0, 0);
    this.fit(this.nameText, maxW, UI.size.S);
    this.valueText = scene.add.text(w / 2 - 12, -h / 2 + 10, '', { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.text }).setOrigin(1, 0);
    this.statusText = scene.add
      .text(tx, h / 2 - 10, '', { fontFamily: UI.font.body, fontStyle: 'bold', fontSize: `${UI.size.XS + 1}px`, color: UI.color.textDim })
      .setOrigin(0, 1);
    this.root = scene.add.container(x, y, [this.bg, this.face, this.nameText, this.valueText, this.statusText]);
    this.root.setSize(w, h);
  }

  /** Riduce un testo finche' non sta nella larghezza (nomi lunghi: mai fuori dalla scheda). */
  private fit(t: Phaser.GameObjects.Text, maxW: number, size: number): void {
    let s = size;
    while (t.width > maxW && s > UI.size.XS - 2) {
      s -= 1;
      t.setFontSize(s);
    }
    if (t.width > maxW) {
      let txt = t.text;
      while (t.width > maxW && txt.length > 3) {
        txt = txt.slice(0, -1);
        t.setText(`${txt}…`);
      }
    }
  }

  /** Cio' che la scheda mostra (nome, valore, stato), anche per i test (privacy: nessuna informazione extra). */
  get text(): string {
    return [this.nameText.text, this.valueText.text, this.statusText.text].filter(Boolean).join('\n');
  }

  setValue(text: string, color: string = UI.color.text): this {
    this.valueText.setText(text).setColor(color);
    const face = Math.min(this.h - 14, 56);
    const inner = this.w - face - 30;
    // valore corto (numero, tempo): a destra sulla riga del nome; valore lungo (stato): sotto il nome, a sinistra
    const short = text.length <= 7;
    if (short) {
      this.valueText.setOrigin(1, 0).setPosition(this.w / 2 - 12, -this.h / 2 + 10).setFontSize(UI.size.S);
    } else {
      this.valueText.setOrigin(0, 0.5).setPosition(this.nameText.x, 2).setFontSize(UI.size.S - 2);
      this.fit(this.valueText, inner, UI.size.S - 2);
    }
    const free = inner - (text && short ? this.valueText.width + 10 : 0);
    this.nameText.setFontSize(short || !text ? UI.size.S : UI.size.XS).setText(this.player.displayName.toUpperCase());
    this.fit(this.nameText, free, short || !text ? UI.size.S : UI.size.XS);
    return this;
  }

  setStatus(text: string, color: string = UI.color.textDim): this {
    this.statusText.setText(text).setColor(color);
    this.fit(this.statusText, this.w - (this.h - 14) - 30, UI.size.XS + 1);
    return this;
  }

  setState(state: BadgeState): this {
    if (state === this.state) return this;
    this.state = state;
    const dim = state === 'out' || state === 'offline';
    this.root.setAlpha(dim ? 0.55 : 1);
    if ('setTint' in this.face) {
      if (dim) this.face.setTint(0x8a8f99);
      else this.face.clearTint();
    }
    const border = state === 'winner' ? UI.color.accent : state === 'done' || state === 'ready' ? UI.color.success : state === 'out' || state === 'offline' ? UI.color.danger : this.player.color;
    this.bg.setStrokeStyle(state === 'winner' ? 4 : 2, hexToInt(border), 1);
    if (state === 'winner' || state === 'done') this.scene.tweens.add({ targets: this.root, scale: 1.06, duration: UI.motion.success / 2, yoyo: true, ease: 'Sine.easeOut' });
    return this;
  }
}

/** Fila di badge centrata (y = centro della fila), larghezza che si adatta al numero di giocatori. */
export function badgeRow(scene: Phaser.Scene, players: BadgePlayer[], y: number, maxW = 1280 - UI.safe.x * 2, h = 70): Map<string, PlayerBadge> {
  const n = Math.max(1, players.length);
  const gap = 12;
  const w = Math.min(250, Math.floor((maxW - gap * (n - 1)) / n));
  const x0 = 640 - ((n - 1) * (w + gap)) / 2;
  const out = new Map<string, PlayerBadge>();
  players.forEach((p, i) => out.set(p.id, new PlayerBadge(scene, x0 + i * (w + gap), y, p, w, h)));
  return out;
}

/** Due colonne di badge ai lati dello schermo (giochi con un centro che deve restare libero, es. Memoria). */
export function badgeColumns(scene: Phaser.Scene, players: BadgePlayer[], w = 250, yTop = 222, step = 84, h = 70): Map<string, PlayerBadge> {
  const out = new Map<string, PlayerBadge>();
  const left = Math.ceil(players.length / 2);
  players.forEach((p, i) => {
    const col = i < left ? 0 : 1;
    const row = col === 0 ? i : i - left;
    const x = col === 0 ? UI.safe.x + w / 2 : 1280 - UI.safe.x - w / 2;
    out.set(p.id, new PlayerBadge(scene, x, yTop + row * step, p, w, h));
  });
  return out;
}

/**
 * INDICATORE DELLE FASI (1 SCRIVI → 2 SCEGLI → ...): la fase attuale si capisce senza leggere spiegazioni.
 * Attiva = oro piena, fatte = ✓ verde, prossime = spente. Forma + numero + parola, non solo colore.
 */
export function phaseStepper(scene: Phaser.Scene, y: number, labels: string[]): { set(i: number): void; root: Phaser.GameObjects.Container } {
  const items = labels.map((l, i) => {
    const t = scene.add.text(0, 0, `${i + 1} ${l}`, { fontFamily: UI.font.display, fontSize: `${UI.size.XS + 1}px`, color: UI.color.muted }).setOrigin(0.5);
    const bg = scene.add.rectangle(0, 0, t.width + 30, 34, hexToInt(UI.color.panel), 0.9).setStrokeStyle(2, hexToInt(UI.color.line));
    return { t, bg, label: l, w: t.width + 30 };
  });
  const gap = 26;
  const total = items.reduce((a, it) => a + it.w, 0) + gap * (items.length - 1);
  const root = scene.add.container(640, y);
  let x = -total / 2;
  const arrows: Phaser.GameObjects.Text[] = [];
  items.forEach((it, i) => {
    it.bg.setX(x + it.w / 2);
    it.t.setX(x + it.w / 2);
    root.add([it.bg, it.t]);
    x += it.w;
    if (i < items.length - 1) {
      const a = scene.add.text(x + gap / 2, 0, '›', { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.muted }).setOrigin(0.5);
      arrows.push(a);
      root.add(a);
      x += gap;
    }
  });
  let cur = -1;
  return {
    root,
    set(i: number): void {
      if (i === cur) return;
      cur = i;
      root.setVisible(i >= 0);
      items.forEach((it, k) => {
        const active = k === i;
        const done = k < i;
        it.t.setText(`${done ? '✓' : k + 1} ${it.label}`).setColor(active ? '#0b0b14' : done ? UI.color.success : UI.color.muted);
        it.bg.setFillStyle(hexToInt(active ? UI.color.accent : UI.color.panel), active ? 1 : 0.9).setStrokeStyle(2, hexToInt(active ? UI.color.accent : done ? UI.color.success : UI.color.line));
        if (active) scene.tweens.add({ targets: [it.bg, it.t], scale: { from: 1.15, to: 1 }, duration: UI.motion.enter, ease: 'Back.easeOut' });
      });
    }
  };
}
