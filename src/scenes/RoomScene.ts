import Phaser from 'phaser';
import QRCode from 'qrcode';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { CHARACTER_ORDER, getCharacter } from '../../shared/characters';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import type { PlayerPublic } from '../../shared/types';

/** Stanza: QR + codice, ritratti dei personaggi scelti, selettore minigioco, avvio. */
export class RoomScene extends Phaser.Scene {
  private portraits: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private startText!: Phaser.GameObjects.Text;
  private mgText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;

  constructor() {
    super('RoomScene');
  }

  async create(): Promise<void> {
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
      this.textures.addBase64('qr', dataUrl);
      this.add.image(300, 320, 'qr');
    } catch (e) {
      console.warn('Generazione QR fallita', e);
    }

    this.add
      .text(920, 196, 'SQUADRA', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '20px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    CHARACTER_ORDER.forEach((cid, i) => {
      const x = 700 + i * 115;
      const img = this.add.image(x, 320, cid);
      img.setScale(112 / img.height);
      this.portraits.push(img);

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

    this.mgText = this.add
      .text(640, 500, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 530, '← → scegli il minigioco', {
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

  private options(): (string | null)[] {
    const st = gm.state;
    if (!st) return [null];
    const compat = MINIGAME_DEFINITIONS.filter(
      (d) => st.playerCount >= d.minPlayers && st.playerCount <= d.maxPlayers
    ).map((d) => d.id);
    return [null, ...compat];
  }

  private cycleMinigame(dir: number): void {
    const opts = this.options();
    const cur = gm.state?.selectedMinigameId ?? null;
    const idx = Math.max(0, opts.indexOf(cur));
    const next = opts[(idx + dir + opts.length) % opts.length];
    audio.select();
    gm.selectMinigame(next);
  }

  private tryStart(): void {
    const st = gm.state;
    if (!st) return;
    if (st.players.length >= 2 && st.players.every((p) => p.ready && p.characterId)) {
      audio.select();
      gm.startGame();
    }
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
      this.portraits[i].setAlpha(p ? 1 : 0.26);
      if (p) {
        const status = !p.connected ? '⚠' : p.ready ? '✅' : '…';
        this.labels[i].setText(`${c.avatar} ${p.displayName}\n${status}`).setColor(c.color);
      } else {
        this.labels[i].setText(c.name).setColor('#6b7280');
      }
    });

    this.countText.setText(`${st.players.length} / ${st.playerCount} giocatori connessi`);

    const canStart = st.players.length >= 2 && st.players.every((p) => p.ready && p.characterId);
    this.startText.setText(
      canStart
        ? 'Premi INVIO per INIZIARE LA PARTITA'
        : 'In attesa che tutti scelgano il personaggio e siano pronti...'
    );
    this.startText.setColor(canStart ? '#4ade80' : '#9ca3af');
  }
}
