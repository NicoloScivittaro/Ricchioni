import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import { getCharacter } from '../../shared/characters';
import type { MinigameDefinition, PlayerPublic } from '../../shared/types';
import { THEME, sceneIn } from '../core/theme';
import { confetti } from './confetti';

const FONT = THEME.title;
const CARD_W = 240;
const CARD_H = 230;
const STEP = 270; // larghezza carta + spazio
const REEL_Y = 245;
const SPIN_MS = 4000; // rallentamento progressivo
const SETTLE_MS = 500; // ultimo piccolo movimento
const START_DELAY_MS = 300;
const TARGET_INDEX = 22; // la carta scelta dal server sta SEMPRE qui

const CATEGORY_COLOR: Record<string, string> = {
  CULTURA: '#a78bfa',
  RIFLESSI: '#fde047',
  MEMORIA: '#f472b6',
  ARENA: '#f87171',
  SPORT: '#4ade80',
  GUIDA: '#60a5fa',
  SKILL: '#fb923c'
};

interface Card {
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
}

/**
 * RULLO. Il minigioco è già stato scelto dal server (authoritativo, `gm.pendingMinigame`):
 * qui è pura animazione, ma DEVE atterrare su quello. La sequenza di carte è costruita in modo
 * che la carta all'indice TARGET_INDEX sia sempre quella scelta, e il tween finisce esattamente lì.
 */
export class RouletteScene extends Phaser.Scene {
  constructor() {
    super('RouletteScene');
  }

  create(): void {
    sceneIn(this);
    const pick = gm.pendingMinigame;
    if (!pick) {
      this.scene.start('RoomScene');
      return;
    }

    const state = gm.state;
    const playerCount = Math.max(1, state?.players.length ?? 1);

    // Carte candidate: i giochi giocabili con questo numero di giocatori (+ sempre il pick).
    let eligible = MINIGAME_DEFINITIONS.filter(
      (d) => d.enabled !== false && playerCount >= d.minPlayers && playerCount <= d.maxPlayers
    );
    const pickDef = getMinigame(pick.minigameId);
    if (pickDef && !eligible.some((d) => d.id === pickDef.id)) eligible = [...eligible, pickDef];
    if (eligible.length === 0 && pickDef) eligible = [pickDef];
    eligible = Phaser.Utils.Array.Shuffle([...eligible]);
    const pickIdx = Math.max(
      0,
      eligible.findIndex((d) => d.id === pick.minigameId)
    );
    const n = Math.max(1, eligible.length);
    // seq[i] = eligible[(i + offset) % n]  →  seq[TARGET_INDEX] === pick
    const offset = (((pickIdx - TARGET_INDEX) % n) + n) % n;
    const seq: (MinigameDefinition | undefined)[] = [];
    for (let i = 0; i < TARGET_INDEX + 5; i++) seq.push(eligible[(i + offset) % n]);

    // ---- testata ----
    this.add
      .text(24, 20, `ROUND ${state?.round ?? 1}`, { fontFamily: FONT, fontSize: '26px', color: '#9ca3af' })
      .setOrigin(0, 0);
    this.add
      .text(1256, 20, `OBIETTIVO ${state?.targetScore ?? '?'} PT`, { fontFamily: FONT, fontSize: '26px', color: '#fbbf24' })
      .setOrigin(1, 0);
    const title = this.add
      .text(640, 66, '🎰 IL RULLO DECIDE…', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);
    // ultimo minigioco giocato + chi l'ha vinto (dal secondo round in poi)
    const lastDef = state?.lastPlayedMinigameId ? getMinigame(state.lastPlayedMinigameId) : undefined;
    if (lastDef) {
      const winId = state?.lastRound?.minigameId === lastDef.id ? state.lastRound.winnerId : null;
      const winName = state?.players.find((p) => p.id === winId)?.displayName;
      this.add
        .text(640, 26, `ULTIMO GIOCO: ${lastDef.icon ?? ''} ${lastDef.name}${winName ? `  ·  🥇 ${winName}` : ''}`, {
          fontFamily: THEME.body,
          fontSize: '17px',
          color: THEME.muted
        })
        .setOrigin(0.5);
    }

    // ---- rullo ----
    const strip = this.add.container(0, REEL_Y);
    const cards: Card[] = [];
    seq.forEach((def, i) => {
      if (!def) return;
      const color = CATEGORY_COLOR[def.category] ?? '#fbbf24';
      const colorInt = Phaser.Display.Color.HexStringToColor(color).color;
      const frame = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x151827, 1).setStrokeStyle(3, colorInt);
      const icon = this.add.text(0, -46, def.icon ?? '🎮', { fontSize: '72px' }).setOrigin(0.5);
      const name = this.add
        .text(0, 38, def.name, {
          fontFamily: FONT,
          fontSize: def.name.length > 22 ? '18px' : '22px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: CARD_W - 24 }
        })
        .setOrigin(0.5);
      const cat = this.add.text(0, 92, def.category, { fontFamily: FONT, fontSize: '15px', color }).setOrigin(0.5);
      const box = this.add.container(i * STEP, 0, [frame, icon, name, cat]);
      strip.add(box);
      cards.push({ box, frame, icon });
    });

    // Ombre laterali + cornice centrale fissa
    // sfumatura laterale a strisce sovrapposte (niente bordo netto)
    for (let k = 0; k < 5; k++) {
      const w = 60 + k * 60;
      this.add.rectangle(w / 2, REEL_Y, w, 300, 0x0b0b14, 0.16).setDepth(5);
      this.add.rectangle(1280 - w / 2, REEL_Y, w, 300, 0x0b0b14, 0.16).setDepth(5);
    }
    this.add.rectangle(640, REEL_Y, CARD_W + 26, CARD_H + 26).setStrokeStyle(4, 0xfbbf24).setDepth(6);
    this.add.text(640, REEL_Y - 132, '▼', { fontSize: '26px', color: '#fbbf24' }).setOrigin(0.5).setDepth(6);
    this.add.text(640, REEL_Y + 132, '▲', { fontSize: '26px', color: '#fbbf24' }).setOrigin(0.5).setDepth(6);

    // ---- classifica compatta + avatar in basso ----
    this.drawStandings(state?.players ?? [], state?.targetScore ?? 0);

    // ---- animazione ----
    const pos = { p: 0 };
    let lastK = 0;
    let lastTickAt = 0;
    const apply = (): void => {
      strip.x = 640 - pos.p * STEP;
      const k = Math.round(pos.p);
      if (k !== lastK) {
        lastK = k;
        const now = this.time.now;
        if (now - lastTickAt > 35) {
          // un tick per carta che passa sotto il puntatore; il tono segue la velocita' (veloce = acuto, in frenata = grave e rado)
          const cardsPerSec = 1000 / Math.max(35, now - lastTickAt);
          lastTickAt = now;
          audio.tick(0.75 + Math.min(0.7, cardsPerSec * 0.04));
        }
      }
      cards.forEach((c, i) => {
        c.box.setScale(1 + 0.1 * Math.max(0, 1 - Math.abs(i - pos.p)));
      });
    };
    apply();

    const reveal = (): void => this.reveal(pick.minigameId, pick.name, pick.modifierId, pick.modifierName, pick.modifierDescription, cards[TARGET_INDEX], cards, title);

    this.time.delayedCall(START_DELAY_MS, () => {
      this.tweens.add({
        targets: pos,
        p: TARGET_INDEX + 0.2, // un pelo oltre…
        duration: SPIN_MS,
        ease: 'Cubic.easeOut',
        onUpdate: apply,
        onComplete: () => {
          this.tweens.add({
            targets: pos,
            p: TARGET_INDEX, // …poi il piccolo ritorno: STOP esatto sulla carta scelta
            duration: SETTLE_MS,
            ease: 'Sine.easeInOut',
            onUpdate: apply,
            onComplete: () => {
              pos.p = TARGET_INDEX;
              apply();
              reveal();
            }
          });
        }
      });
    });

    // L'host può saltare le animazioni (il server sceglie già tutto).
    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', () => gm.skip());
    kb?.on('keydown-SPACE', () => gm.skip());
  }

  private reveal(
    minigameId: string,
    name: string,
    modifierId: string | null,
    modifierName: string | null,
    modifierDescription: string | null,
    chosen: Card | undefined,
    cards: Card[],
    title: Phaser.GameObjects.Text
  ): void {
    audio.thump(0.9); // il "clunk" dello stop
    audio.fanfare(); // DING
    this.cameras.main.flash(140, 255, 240, 180, false);
    this.cameras.main.shake(220, 0.004);
    title.setText('IL PROSSIMO GIOCO È…').setColor('#fbbf24');
    confetti(this, 640, REEL_Y);

    if (chosen) {
      chosen.frame.setStrokeStyle(6, 0xfbbf24);
      this.tweens.add({ targets: chosen.box, scale: 1.22, duration: 350, ease: 'Back.easeOut' });
      this.tweens.add({ targets: chosen.icon, scale: 1.3, duration: 420, delay: 120, ease: 'Back.easeOut' }); // l'icona del gioco "salta fuori"
      const glow = this.add
        .rectangle(640, REEL_Y, CARD_W * 1.22 + 30, CARD_H * 1.22 + 30, 0xfbbf24, 0.16)
        .setStrokeStyle(2, 0xfbbf24, 0.8)
        .setDepth(4);
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    }
    cards.forEach((c) => {
      if (c !== chosen) this.tweens.add({ targets: c.box, alpha: 0.22, duration: 300 });
    });

    const def = getMinigame(minigameId);
    const size = Math.max(28, Math.min(54, Math.floor(1180 / (name.length * 0.72))));
    const nameText = this.add
      .text(640, 442, name, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', align: 'center', wordWrap: { width: 1180 } })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.8);
    this.tweens.add({ targets: nameText, alpha: 1, scale: 1, duration: 350, ease: 'Back.easeOut' });

    if (def?.description) {
      const d = this.add
        .text(640, 492, def.description, { fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#d1d5db', align: 'center', wordWrap: { width: 1100 } })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: d, alpha: 1, duration: 400, delay: 350 });
    }

    if (modifierId && modifierName) {
      const m = this.add
        .text(640, 528, `MODIFICATORE: ${modifierName}${modifierDescription ? ` — ${modifierDescription}` : ''}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          color: '#f87171',
          align: 'center',
          wordWrap: { width: 1100 }
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: m, alpha: 1, duration: 400, delay: 700 });
    }

    this.time.delayedCall(1300, () => {
      const go = this.add
        .text(640, 574, 'PREPARATEVI!', { fontFamily: FONT, fontSize: '34px', color: '#4ade80' })
        .setOrigin(0.5);
      audio.select();
      this.tweens.add({ targets: go, scale: 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  /** Classifica compatta: una scheda per giocatore (ordinata per punti) con barra verso l'obiettivo. */
  private drawStandings(players: PlayerPublic[], target: number): void {
    if (players.length === 0) return;
    const sorted = players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score || a.i - b.i);
    const topScore = sorted[0]?.p.score ?? 0;
    const w = 228;
    const gap = 12;
    const total = sorted.length * w + (sorted.length - 1) * gap;
    const x0 = (1280 - total) / 2 + w / 2;
    const y = 662;
    sorted.forEach(({ p }, rank) => {
      let avatar = '🎲';
      let color = '#9ca3af';
      if (p.characterId) {
        try {
          const c = getCharacter(p.characterId);
          avatar = c.avatar;
          color = c.color;
        } catch {
          /* personaggio sconosciuto: fallback */
        }
      }
      const colorInt = Phaser.Display.Color.HexStringToColor(color).color;
      const cx = x0 + rank * (w + gap);
      this.add.rectangle(cx, y, w, 84, 0x111426, 0.95).setStrokeStyle(2, colorInt, p.connected ? 1 : 0.35);
      this.add
        .text(cx - w / 2 + 12, y - 26, `${topScore > 0 && p.score === topScore ? '👑' : `${rank + 1}°`} ${avatar} ${p.displayName}`, {
          fontFamily: FONT,
          fontSize: '19px',
          color: p.connected ? color : '#6b7280'
        })
        .setOrigin(0, 0.5);
      this.add
        .text(cx - w / 2 + 12, y + 2, `${p.score} / ${target} pt`, { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#e5e7eb' })
        .setOrigin(0, 0.5);
      const d = gm.state?.lastRound?.deltas[p.id] ?? 0;
      if (d > 0) {
        this.add
          .text(cx + w / 2 - 12, y + 2, `+${d}`, { fontFamily: FONT, fontSize: '16px', color: THEME.green })
          .setOrigin(1, 0.5);
      }
      const barW = w - 24;
      this.add.rectangle(cx - w / 2 + 12, y + 28, barW, 8, 0x1f2937).setOrigin(0, 0.5);
      const frac = target > 0 ? Math.max(0, Math.min(1, p.score / target)) : 0;
      if (frac > 0) this.add.rectangle(cx - w / 2 + 12, y + 28, barW * frac, 8, colorInt).setOrigin(0, 0.5);
    });
  }
}
