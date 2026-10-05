import Phaser from 'phaser';
import QRCode from 'qrcode';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { CHARACTER_ORDER, getCharacter } from '../../shared/characters';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import type { PlayerPublic } from '../../shared/types';
import { presentationOf } from '../../shared/characterPresentation';
import { addPortrait } from '../core/portraits';

/** Minimo giocatori per avviare (deve coincidere con GameSession.MIN_TO_START sul server). */
const MIN_TO_START = 2;

/** Stanza: QR + codice, ritratti dei personaggi scelti, selettore minigioco, avvio. */
export class RoomScene extends Phaser.Scene {
  private portraits: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private startText!: Phaser.GameObjects.Text;
  private mgText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  /** riga di personalita' del personaggio appena scelto (compare qualche secondo, poi sparisce: rara apposta) */
  private spotText!: Phaser.GameObjects.Text;
  private chosen = new Set<string>();

  constructor() {
    super('RoomScene');
  }

  create(): void {
    this.portraits = [];
    this.labels = [];
    this.cameras.main.setBackgroundColor('#0b0b14');
    const code = gm.roomCode || '?????';

    this.add
      .text(640, 26, 'ENTRA NELLA PARTITA', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '34px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 70, `CODICE: ${code}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '46px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    // QR generato in modo asincrono (fire-and-forget) per non bloccare il primo render
    void this.setupQR(code);

    this.add
      .text(920, 196, 'SQUADRA', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '20px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    CHARACTER_ORDER.forEach((cid, i) => {
      const x = 700 + i * 115;
      // ritratto rotondo della testa (lo stesso di risultati e podio): niente illustrazione intera, niente emoji
      this.portraits.push(addPortrait(this, x, 320, cid, 100));

      const label = this.add
        .text(x, 386, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: '#e5e7eb',
          align: 'center',
          wordWrap: { width: 108 }
        })
        .setOrigin(0.5, 0);
      this.labels.push(label);
    });

    this.spotText = this.add
      .text(640, 462, '', { fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 1100 } })
      .setOrigin(0.5)
      .setAlpha(0);
    this.chosen = new Set();

    this.mgText = this.add
      .text(640, 500, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 530, '← → scegli il minigioco · ESC = nuova partita', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#6b7280'
      })
      .setOrigin(0.5);

    this.countText = this.add
      .text(640, 580, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    this.startText = this.add
      .text(640, 680, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: '#4ade80'
      })
      .setOrigin(0.5);

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
    this.add
      .text(300, 128, url, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9ca3af',
        align: 'center',
        wordWrap: { width: 340 }
      })
      .setOrigin(0.5, 0);

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 190,
        margin: 1,
        color: { dark: '#0b0b14', light: '#ffffff' }
      });
      if (this.textures.exists('qr')) this.textures.remove('qr');
      this.textures.addBase64('qr', dataUrl);
      this.add.image(300, 320, 'qr');
    } catch (e) {
      console.warn('Generazione QR fallita', e);
    }
  }

  /** Qualcuno ha appena scelto un personaggio: nome del ruolo + la sua frase, per qualche secondo. */
  private spotlight(cid: string, playerName: string): void {
    const pr = presentationOf(cid);
    if (!pr || !this.spotText) return;
    this.tweens.killTweensOf(this.spotText);
    this.spotText.setText(`${playerName.toUpperCase()} È ${pr.displayName} — “${pr.tagline}”`).setColor(pr.accent).setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: this.spotText, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.spotText, alpha: 0, delay: 3800, duration: 600 });
  }

  private options(): (string | null)[] {
    const st = gm.state;
    if (!st) return [null];
    const compat = MINIGAME_DEFINITIONS.filter(
      (d) => d.enabled !== false && st.playerCount >= d.minPlayers && st.playerCount <= d.maxPlayers
    ).map((d) => d.id);
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

    const sel = st.selectedMinigameId;
    this.mgText.setText(
      sel ? `MINIGIOCO: ${getMinigame(sel)?.name ?? sel}` : 'MINIGIOCO: 🎰 RULLO (casuale)'
    );
    this.mgText.setColor(sel ? '#fbbf24' : '#93c5fd');

    const byChar = new Map<string, PlayerPublic>();
    for (const p of st.players) {
      if (p.characterId) byChar.set(p.characterId, p);
    }

    CHARACTER_ORDER.forEach((cid, i) => {
      const p = byChar.get(cid);
      const c = getCharacter(cid);
      const pr = presentationOf(cid);
      this.portraits[i].setAlpha(p ? 1 : 0.26);
      if (p) {
        const status = !p.connected ? '⚠' : p.ready ? '✅' : '…';
        this.labels[i].setText(`${p.displayName}\n${status}`).setColor(c.color);
        if (!this.chosen.has(cid)) this.spotlight(cid, p.displayName);
      } else {
        this.labels[i].setText(pr?.shortName ?? c.name).setColor('#6b7280');
      }
    });
    this.chosen = new Set(byChar.keys());

    this.countText.setText(`${st.players.length} / ${st.playerCount} giocatori connessi`);

    const canStart = st.players.length >= MIN_TO_START && st.players.every((p) => p.ready && p.characterId);
    this.startText.setText(
      canStart
        ? 'Premi INVIO per INIZIARE LA PARTITA'
        : st.players.length < MIN_TO_START
          ? `Servono almeno ${MIN_TO_START} giocatori per iniziare`
          : 'In attesa che tutti scelgano il personaggio e siano pronti...'
    );
    this.startText.setColor(canStart ? '#4ade80' : '#9ca3af');
  }
}
