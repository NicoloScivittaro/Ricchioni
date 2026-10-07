import Phaser from 'phaser';
import QRCode from 'qrcode';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { CHARACTER_ORDER, getCharacter } from '../../shared/characters';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import { estimateGameMinutes } from '../../shared/types';
import type { PlayerPublic } from '../../shared/types';
import { presentationOf } from '../../shared/characterPresentation';
import { addPortrait } from '../core/portraits';
import { pads } from '../input/GamepadManager';
import { UI, hexToInt } from '../core/uiTokens';
import { displayText, infoText, uiPanel } from '../core/uiPhaser';

/** Minimo giocatori per avviare (deve coincidere con GameSession.MIN_TO_START sul server). */
const MIN_TO_START = 2;
const SLOT_X0 = 598;
const SLOT_W = 120;
const SLOT_Y = 300;

/**
 * STANZA = l'inizio della serata. Gerarchia: 1) CODICE + QR per entrare, 2) chi c'e', 3) personaggi, 4) controller/telefono,
 * 5) obiettivo e minigioco, 6) START. Niente informazioni tecniche: il pannello controller (G) le tiene per se'.
 */
export class RoomScene extends Phaser.Scene {
  private portraits: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  private names: Phaser.GameObjects.Text[] = [];
  private states: Phaser.GameObjects.Text[] = [];
  private slotBg: Phaser.GameObjects.Rectangle[] = [];
  private startBar!: Phaser.GameObjects.Rectangle;
  private startText!: Phaser.GameObjects.Text;
  private mgText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private devText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  /** riga di personalita' del personaggio appena scelto (compare qualche secondo, poi sparisce: rara apposta) */
  private spotText!: Phaser.GameObjects.Text;
  private chosen = new Set<string>();
  private known = new Set<string>();
  private toastY = 0;
  private lastKey = '';

  constructor() {
    super('RoomScene');
  }

  create(): void {
    this.portraits = [];
    this.names = [];
    this.states = [];
    this.slotBg = [];
    this.known = new Set((gm.state?.players ?? []).map((p) => p.id));
    this.lastKey = '';
    this.cameras.main.setBackgroundColor(UI.color.bg);
    const code = gm.roomCode || '?????';

    // ---- 1) ENTRA: codice grande + QR (colonna sinistra)
    uiPanel(this, 300, 340, 470, 556, UI.color.accent, true);
    infoText(this, 300, 92, 'ENTRA DAL TELEFONO', UI.size.S, UI.color.info);
    displayText(this, 300, 148, code, 72, UI.color.accent);
    void this.setupQR(code);

    // ---- 2-4) GIOCATORI (colonna destra)
    this.countText = displayText(this, 920, 92, '', UI.size.L, UI.color.text);
    this.devText = infoText(this, 920, 140, '', UI.size.S, UI.color.textDim);
    CHARACTER_ORDER.forEach((cid, i) => {
      const x = SLOT_X0 + i * (SLOT_W + 6) + SLOT_W / 2;
      this.slotBg.push(this.add.rectangle(x, SLOT_Y + 20, SLOT_W, 220, hexToInt(UI.color.panel), 0.75).setStrokeStyle(2, hexToInt(UI.color.line)));
      // ritratto rotondo della testa (lo stesso di risultati e podio)
      this.portraits.push(addPortrait(this, x, SLOT_Y - 30, cid, 96));
      this.names.push(
        this.add
          .text(x, SLOT_Y + 34, '', { fontFamily: UI.font.display, fontSize: `${UI.size.XS + 1}px`, color: UI.color.text, align: 'center', wordWrap: { width: SLOT_W - 12 } })
          .setOrigin(0.5, 0)
      );
      this.states.push(
        this.add.text(x, SLOT_Y + 100, '', { fontFamily: UI.font.body, fontStyle: 'bold', fontSize: `${UI.size.XS}px`, color: UI.color.muted, align: 'center' }).setOrigin(0.5)
      );
    });

    this.spotText = infoText(this, 920, 456, '', UI.size.S, UI.color.text, 600).setAlpha(0);
    this.chosen = new Set();

    // ---- 5) obiettivo + minigioco (secondari)
    this.targetText = infoText(this, 920, 504, '', UI.size.S, UI.color.accent);
    this.mgText = infoText(this, 920, 540, '', UI.size.S, UI.color.info);
    infoText(this, 920, 574, '← →  cambia minigioco   ·   ESC  nuova partita', UI.size.XS, UI.color.muted);

    // ---- 6) START
    this.startBar = this.add.rectangle(640, 662, 1184, 56, hexToInt(UI.color.panel), 0.92).setStrokeStyle(3, hexToInt(UI.color.line));
    this.startText = displayText(this, 640, 662, '', UI.size.M, UI.color.muted);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') this.cycleMinigame(-1);
      else if (e.key === 'ArrowRight') this.cycleMinigame(1);
      else if (e.key === 'Backspace' || e.key === 'Escape') this.abandon();
      else if (e.key === 'Enter') this.tryStart();
    });
  }

  private async controllerUrl(code: string): Promise<string> {
    let url = `${location.origin}/controller.html?room=${code}`;
    if (import.meta.env.DEV) {
      try {
        const res = await fetch(`http://${location.hostname}:3001/api/network`);
        const data = (await res.json()) as { ips: string[] };
        const ip = data.ips?.[0];
        if (ip) url = `http://${ip}:5173/controller.html?room=${code}`;
      } catch {
        /* resta same-origin */
      }
    }
    return url;
  }

  /** Genera URL + QR in background (non blocca il render della stanza). */
  private async setupQR(code: string): Promise<void> {
    const url = await this.controllerUrl(code);
    if (!this.sys.isActive()) return;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1, color: { dark: '#0b0b14', light: '#ffffff' } });
      if (!this.sys.isActive()) return;
      if (this.textures.exists('qr')) this.textures.remove('qr');
      this.textures.once(`${Phaser.Textures.Events.ADD_KEY}qr`, () => {
        if (this.sys.isActive()) this.add.image(300, 370, 'qr').setDisplaySize(280, 280);
      });
      this.textures.addBase64('qr', dataUrl);
    } catch (e) {
      console.warn('Generazione QR fallita', e);
    }
    // indirizzo per chi non riesce a inquadrare (piccolo: il QR e' la via principale)
    infoText(this, 300, 540, url.replace(/^https?:\/\//, ''), UI.size.XS, UI.color.muted, 420);
    infoText(this, 300, 590, 'INQUADRA IL QR · SCEGLI IL PERSONAGGIO · PRONTO', UI.size.XS, UI.color.textDim, 420);
  }

  /** Qualcuno ha appena scelto un personaggio: nome del ruolo + la sua frase, per qualche secondo. */
  private spotlight(cid: string, playerName: string): void {
    const pr = presentationOf(cid);
    if (!pr || !this.spotText) return;
    this.tweens.killTweensOf(this.spotText);
    this.spotText.setText(`${playerName.toUpperCase()} È ${pr.displayName} — “${pr.tagline}”`).setColor(pr.accent).setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: this.spotText, alpha: 1, scale: 1, duration: UI.motion.enter, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.spotText, alpha: 0, delay: 3800, duration: 600 });
  }

  /** "CIRO È ENTRATO": scheda breve in alto a destra, non blocca niente. */
  private joinToast(p: PlayerPublic): void {
    const y = UI.safe.y + 30 + this.toastY * 62;
    this.toastY++;
    const name = p.displayName.toUpperCase();
    const t = this.add.text(0, 0, `${name} È ENTRATO`, { fontFamily: UI.font.display, fontSize: `${UI.size.S}px`, color: UI.color.text }).setOrigin(0, 0.5);
    const w = Math.min(520, t.width + 92);
    const bg = this.add.rectangle(0, 0, w, 52, hexToInt(UI.color.panelStrong), 0.96).setStrokeStyle(3, hexToInt(UI.color.success));
    const face = addPortrait(this, -w / 2 + 30, 0, p.characterId, 38);
    t.setX(-w / 2 + 58);
    const box = this.add.container(1280 - UI.safe.x - w / 2 + 40, y, [bg, face, t]).setDepth(50).setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, x: box.x - 40, duration: UI.motion.enter, ease: 'Back.easeOut' });
    this.time.delayedCall(1900, () =>
      this.tweens.add({
        targets: box,
        alpha: 0,
        duration: UI.motion.exit,
        onComplete: () => {
          box.destroy();
          this.toastY = Math.max(0, this.toastY - 1);
        }
      })
    );
    audio.ui('confirm');
  }

  private options(): (string | null)[] {
    const st = gm.state;
    if (!st) return [null];
    const compat = MINIGAME_DEFINITIONS.filter((d) => d.enabled !== false && st.playerCount >= d.minPlayers && st.playerCount <= d.maxPlayers).map((d) => d.id);
    return [null, ...compat];
  }

  private cycleMinigame(dir: number): void {
    const opts = this.options();
    const cur = gm.state?.selectedMinigameId ?? null;
    const idx = Math.max(0, opts.indexOf(cur));
    const next = opts[(idx + dir + opts.length) % opts.length];
    audio.ui('move');
    gm.selectMinigame(next);
  }

  private tryStart(): void {
    const st = gm.state;
    if (!st) return;
    if (st.players.length >= MIN_TO_START && st.players.every((p) => p.ready && p.characterId)) {
      audio.ui('confirm');
      gm.startGame();
    }
  }

  /** Abbandona la stanza e torna alla configurazione (pulisce il token host). */
  private abandon(): void {
    audio.ui('cancel');
    gm.backToLobby();
    this.scene.start('LobbyScene');
  }

  update(): void {
    const st = gm.state;
    if (!st) return;

    // nuovi arrivati: "X È ENTRATO"
    for (const p of st.players) {
      if (!this.known.has(p.id)) {
        this.known.add(p.id);
        this.joinToast(p);
      }
    }

    const sel = st.selectedMinigameId;
    const withPad = st.players.filter((p) => pads.slotOf(p.id)?.state === 'paired').length;
    const key = `${sel}|${st.targetScore}|${withPad}|${st.players.map((p) => `${p.id}:${p.characterId}:${p.ready}:${p.connected}:${pads.slotOf(p.id)?.state ?? ''}`).join(',')}`;
    if (key === this.lastKey) return; // niente setText a ogni frame
    this.lastKey = key;

    this.mgText.setText(sel ? `MINIGIOCO: ${getMinigame(sel)?.name ?? sel}` : 'MINIGIOCO: 🎰 IL RULLO DECIDE');
    this.targetText.setText(`🎯 OBIETTIVO ${st.targetScore} PUNTI · ~${estimateGameMinutes(st.targetScore)} MIN`);

    const byChar = new Map<string, PlayerPublic>();
    for (const p of st.players) if (p.characterId) byChar.set(p.characterId, p);

    CHARACTER_ORDER.forEach((cid, i) => {
      const p = byChar.get(cid);
      const c = getCharacter(cid);
      const pr = presentationOf(cid);
      this.portraits[i].setAlpha(p ? 1 : 0.22);
      if (p) {
        const dev = pads.slotOf(p.id)?.state === 'paired' ? '🎮' : '📱';
        const status = !p.connected ? '⚠ OFFLINE' : p.ready ? `✅ PRONTO ${dev}` : `… SCEGLIE ${dev}`;
        this.names[i].setText(p.displayName.toUpperCase()).setColor(c.color).setFontSize(UI.size.XS + 1);
        // nomi lunghi: si riducono e poi si accorciano, non escono mai dalla scheda
        for (let fs = UI.size.XS + 1; this.names[i].width > SLOT_W - 12 && fs > 14; fs--) this.names[i].setFontSize(fs - 1);
        while (this.names[i].width > SLOT_W - 12 && this.names[i].text.length > 4) this.names[i].setText(`${this.names[i].text.replace(/…$/, '').slice(0, -1)}…`);
        this.states[i].setText(status).setColor(!p.connected ? UI.color.danger : p.ready ? UI.color.success : UI.color.muted);
        this.slotBg[i].setStrokeStyle(3, hexToInt(!p.connected ? UI.color.danger : p.ready ? c.color : UI.color.line));
        if (!this.chosen.has(cid)) this.spotlight(cid, p.displayName);
      } else {
        this.names[i].setText(pr?.shortName ?? c.name).setColor(UI.color.muted);
        this.states[i].setText('LIBERO').setColor('#4b5563');
        this.slotBg[i].setStrokeStyle(2, hexToInt(UI.color.line));
      }
    });
    this.chosen = new Set(byChar.keys());

    const n = st.players.length;
    this.countText.setText(`${n} / ${st.playerCount} GIOCATORI`);
    // riepilogo dispositivi, leggibile a colpo d'occhio: "4 🎮 + 1 📱" oppure "5 🎮"
    const phone = n - withPad;
    this.devText.setText(n === 0 ? 'ASPETTO I GIOCATORI…' : withPad === 0 ? `${n} 📱 TELEFONI` : phone ? `${withPad} 🎮 + ${phone} 📱` : `${withPad} 🎮`);

    const canStart = n >= MIN_TO_START && st.players.every((p) => p.ready && p.characterId);
    this.tweens.killTweensOf(this.startText);
    this.startText.setScale(1);
    if (canStart) {
      this.startText.setText('INVIO  ·  INIZIA LA SERATA').setColor('#062012').setStroke('#062012', 0);
      this.startBar.setFillStyle(hexToInt(UI.color.success), 1).setStrokeStyle(3, hexToInt('#bbf7d0'));
      this.tweens.add({ targets: this.startText, scale: 1.04, duration: UI.motion.pulse, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.startText
        .setText(n < MIN_TO_START ? `SERVONO ALMENO ${MIN_TO_START} GIOCATORI` : 'ASPETTO CHE TUTTI SIANO PRONTI…')
        .setColor(UI.color.muted)
        .setStroke(UI.outline.color, UI.outline.thin);
      this.startBar.setFillStyle(hexToInt(UI.color.panel), 0.92).setStrokeStyle(3, hexToInt(UI.color.line));
    }
  }
}

