import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { music } from '../core/music';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import { getCharacter } from '../../shared/characters';
import type { MinigameDefinition, PlayerPublic } from '../../shared/types';
import { THEME, sceneIn } from '../core/theme';
import { UI, hexToInt } from '../core/uiTokens';
import { PlayerBadge, displayText, infoText, pill } from '../core/uiPhaser';
import { confetti } from './confetti';
import { addBackdrop } from './backdrops';
import type { Backdrop } from './backdrops';
import { FONT_BODY } from '../core/uiTokens';

const FONT = THEME.title;
const CARD_W = 240;
const CARD_H = 230;
const STEP = 270; // larghezza carta + spazio
const REEL_Y = 270;
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
  private backdrop: Backdrop | null = null;
  private standings: Phaser.GameObjects.GameObject[] = [];
  private lastText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('RouletteScene');
  }

  create(): void {
    sceneIn(this);
    this.standings = [];
    this.lastText = null;
    this.backdrop = addBackdrop(this, 'roulette'); // scenografia: studio + sala giochi (solo sfondo)
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
    pill(this, UI.safe.x, UI.safe.y + 18, `ROUND ${state?.round ?? 1}`, UI.color.textDim, UI.size.S, 0);
    pill(this, 1280 - UI.safe.x, UI.safe.y + 18, `🎯 OBIETTIVO ${state?.targetScore ?? '?'}`, UI.color.accent, UI.size.S, 1);
    const title = displayText(this, 640, 80, '🎰 IL RULLO DECIDE…', UI.size.L, UI.color.text);
    // ultimo minigioco giocato + chi l'ha vinto (dal secondo round in poi)
    const lastDef = state?.lastPlayedMinigameId ? getMinigame(state.lastPlayedMinigameId) : undefined;
    if (lastDef) {
      const winId = state?.lastRound?.minigameId === lastDef.id ? state.lastRound.winnerId : null;
      const winName = state?.players.find((p) => p.id === winId)?.displayName;
      // secondario: piccolo, e sparisce allo stop (gerarchia: la carta uscita e' l'unica cosa grande)
      this.lastText = infoText(this, 640, UI.safe.y + 6, `ULTIMO: ${lastDef.icon ?? ''} ${lastDef.name}${winName ? `  ·  🥇 ${winName}` : ''}`, UI.size.XS, UI.color.muted);
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
          fontSize: def.name.length > 22 ? '20px' : '24px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: CARD_W - 24 }
        })
        .setOrigin(0.5);
      const cat = this.add.text(0, 92, def.category, { fontFamily: FONT, fontSize: `${UI.size.XS}px`, color }).setOrigin(0.5);
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
    let tension = false;
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
          audio.rouletteTick(Math.min(1, cardsPerSec / 18));
          // tensione degli ultimi secondi: quando il rullo rallenta la musica passa allo strato finale
          if (cardsPerSec < 6 && !tension) {
            tension = true;
            if (music.current() === 'roulette') music.setLevel(2);
          }
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
    // STOP: clunk meccanico, la musica del rullo si chiude, parte lo stinger DEL GIOCO uscito (piu' spettacolare per i giochi
    // lunghi come Sparatoria e Kart, senza effetto "jackpot": le probabilita' del rullo non cambiano)
    audio.rouletteClunk();
    this.backdrop?.tint(minigameId); // per un attimo lo studio prende i colori del gioco uscito (nessun effetto sui tempi)
    music.stop(0.25, 'roulette');
    audio.gameSting(minigameId, minigameId === 'fps' || minigameId === 'kart3d');
    this.cameras.main.flash(140, 255, 240, 180, false);
    this.cameras.main.shake(220, 0.004);
    title.setText('IL PROSSIMO GIOCO È…').setColor(UI.color.accent);
    this.lastText?.destroy();
    this.tweens.add({ targets: this.standings, alpha: 1, duration: UI.motion.reveal });
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
    const size = Math.max(36, Math.min(UI.size.XL, Math.floor(1100 / (name.length * 0.66))));
    const nameText = displayText(this, 640, 456, name, size, UI.color.text).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: nameText, alpha: 1, scale: 1, duration: UI.motion.reveal, ease: 'Back.easeOut' });

    if (def?.description) {
      // UNA riga sola: se la descrizione e' lunga si taglia sulla prima frase
      const one = def.description.split(/(?<=[.!?])\s/)[0];
      const d = infoText(this, 640, 502, one, UI.size.S + 2, UI.color.textDim).setAlpha(0);
      while (d.width > 1120 && d.text.length > 10) d.setText(`${d.text.slice(0, -2)}…`);
      this.tweens.add({ targets: d, alpha: 1, duration: 400, delay: 350 });
    }

    if (modifierId && modifierName) {
      const m = pill(this, 640, 540, `⚠ ${modifierName}${modifierDescription ? ` — ${modifierDescription}` : ''}`, UI.color.warning, UI.size.XS + 2).setAlpha(0);
      this.tweens.add({ targets: m, alpha: 1, duration: 400, delay: 700 });
    }

    this.time.delayedCall(1300, () => {
      const go = displayText(this, 640, modifierId ? 576 : 552, 'PREPARATEVI!', UI.size.M + 4, UI.color.success);
      audio.select();
      this.tweens.add({ targets: go, scale: 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  /** Classifica compatta (badge del design system): piu' tenue durante il giro, piena allo stop. */
  private drawStandings(players: PlayerPublic[], target: number): void {
    if (players.length === 0) return;
    const sorted = players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score || a.i - b.i);
    const topScore = sorted[0]?.p.score ?? 0;
    const n = sorted.length;
    const gap = 12;
    const w = Math.min(232, Math.floor((1280 - UI.safe.x * 2 - gap * (n - 1)) / n));
    const x0 = 640 - ((n - 1) * (w + gap)) / 2;
    const y = 720 - UI.safe.y - 42;
    const objs: Phaser.GameObjects.GameObject[] = [];
    sorted.forEach(({ p }, rank) => {
      let color: string = UI.color.muted;
      if (p.characterId) {
        try {
          color = getCharacter(p.characterId).color;
        } catch {
          /* personaggio sconosciuto: fallback */
        }
      }
      const b = new PlayerBadge(this, x0 + rank * (w + gap), y, { id: p.id, displayName: p.displayName, characterId: p.characterId, color }, w, 76);
      const lead = topScore > 0 && p.score === topScore;
      b.setValue(`${p.score}`, lead ? UI.color.accent : UI.color.text);
      const d = gm.state?.lastRound?.deltas[p.id] ?? 0;
      const left = Math.max(0, target - p.score);
      b.setStatus(`${lead ? '👑 ' : ''}${left > 0 ? `MANCANO ${left}` : '🎯 OBIETTIVO!'}`, left > 0 && left <= Math.max(5, target * 0.1) ? UI.color.accent : UI.color.textDim);
      // punti appena presi: piccolo e verde sopra la scheda (non ruba spazio al nome)
      if (d > 0) objs.push(this.add.text(b.root.x + w / 2 - 6, y - 40, `+${d}`, { fontFamily: UI.font.display, fontSize: `${UI.size.XS}px`, color: UI.color.success }).setOrigin(1, 1).setStroke('#000000', 3));
      if (!p.connected) b.setState('offline');
      // barra verso l'obiettivo
      const barW = w - 20;
      const frac = target > 0 ? Math.max(0, Math.min(1, p.score / target)) : 0;
      const bar = this.add.rectangle(b.root.x - barW / 2, y + 44, barW, 6, hexToInt(UI.color.line)).setOrigin(0, 0.5);
      const fill = this.add.rectangle(b.root.x - barW / 2, y + 44, Math.max(2, barW * frac), 6, hexToInt(color)).setOrigin(0, 0.5);
      objs.push(b.root, bar, fill);
    });
    this.standings = objs;
    for (const o of objs) (o as unknown as { setAlpha(a: number): void }).setAlpha(0.55);
  }
}
