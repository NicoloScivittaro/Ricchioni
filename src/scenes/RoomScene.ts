import Phaser from 'phaser';
import QRCode from 'qrcode';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { getCharacter } from '../../shared/characters';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';

/** Mostra room code + QR + lista giocatori + selettore minigioco; l'host avvia la partita. */
export class RoomScene extends Phaser.Scene {
  private playersText!: Phaser.GameObjects.Text;
  private startText!: Phaser.GameObjects.Text;
  private mgText!: Phaser.GameObjects.Text;

  constructor() {
    super('RoomScene');
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const code = gm.roomCode || '?????';

    this.add
      .text(640, 40, 'ENTRA NELLA PARTITA', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '38px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 96, `CODICE: ${code}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '56px',
        color: '#fbbf24'
      })
      .setOrigin(0.5);

    this.playersText = this.add
      .text(640, 545, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '21px',
        color: '#e5e7eb',
        align: 'center'
      })
      .setOrigin(0.5);

    this.mgText = this.add
      .text(640, 480, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 508, '← → scegli il minigioco', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#6b7280'
      })
      .setOrigin(0.5);

    this.startText = this.add
      .text(640, 690, '', {
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

    const url = await this.controllerUrl(code);
    this.add
      .text(640, 150, url, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        color: '#9ca3af'
      })
      .setOrigin(0.5);

    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#0b0b14', light: '#ffffff' } });
      this.textures.addBase64('qr', dataUrl);
      this.add.image(640, 320, 'qr');
    } catch (e) {
      console.warn('Generazione QR fallita', e);
    }
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

    const lines = st.players.map((p) => {
      const c = p.characterId ? getCharacter(p.characterId) : null;
      const status = !p.connected ? '⚠ DISCONNESSO' : p.ready ? 'PRONTO ✅' : 'NON PRONTO';
      return `${c?.avatar ?? '❓'} ${p.displayName} — ${c?.name ?? 'scegli personaggio'}  ${status}`;
    });
    this.playersText.setText(`${st.players.length}/${st.playerCount} giocatori\n\n${lines.join('\n')}`);

    const canStart = st.players.length >= 2 && st.players.every((p) => p.ready && p.characterId);
    this.startText.setText(
      canStart ? 'Premi INVIO per INIZIARE LA PARTITA' : 'In attesa che tutti scelgano il personaggio e siano pronti...'
    );
    this.startText.setColor(canStart ? '#4ade80' : '#9ca3af');
  }
}
