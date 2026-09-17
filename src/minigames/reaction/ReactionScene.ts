import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { confetti } from '../../scenes/confetti';
import { game as gm } from '../../core/GameManager';
import type { MinigameContext } from '../types';
import type { PlayerSnapshot } from '../../../shared/types';

// BOTTA AL VOLO — presentazione da game show: intro, nucleo di tensione,
// fake-out, VIA!, tempi in millisecondi e classifica dal peggiore al migliore.

const INTRO_S = 2;
const MIN_WAIT_S = 2;
const MAX_WAIT_S = 6;
const FAKEOUT_CHANCE = 0.4;
const RESPONSE_TIMEOUT_S = 3;
const RESULTS_HOLD_S = 4.5;

type Status = 'ready' | 'pressed' | 'falseStart' | 'dnf';

interface PState {
  snap: PlayerSnapshot;
  status: Status;
  timeMs: number | null;
  falseAt: number | null;
  card: Phaser.GameObjects.Text;
}

// Record della serata (persiste tra i round finché la pagina non si ricarica).
let sessionRecord: { ms: number; name: string } | null = null;

export class ReactionScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private players: PState[] = [];
  private phase: 'intro' | 'waiting' | 'via' | 'results' = 'intro';
  private gameTime = 0;
  private viaTime = 0;
  private viaDeadline = 0;
  private fakeAt = -1;
  private fakeDone = false;
  private finished = false;

  private centerText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private core!: Phaser.GameObjects.Arc;
  private flashRect!: Phaser.GameObjects.Rectangle;

  // Menu ESC
  private paused = false;
  private menuMode: 'none' | 'main' | 'confirmRestart' | 'confirmLobby' = 'none';
  private menuIndex = 0;
  private menuContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('reaction');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    audio.unlock();
    this.cameras.main.setBackgroundColor('#0d0f1e');

    this.flashRect = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(60);

    // Nucleo energetico centrale (dietro al testo)
    this.core = this.add.circle(640, 350, 100, 0x14182b).setStrokeStyle(6, 0x6366f1).setDepth(5);

    // Carte giocatori (in basso)
    const n = this.ctx.players.length;
    this.ctx.players.forEach((p, i) => {
      const x = n > 1 ? 170 + i * (940 / (n - 1)) : 640;
      const card = this.add
        .text(x, 600, `${p.avatar}\n${p.displayName}\nPRONTO`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '20px',
          color: p.color,
          align: 'center'
        })
        .setOrigin(0.5, 0);
      this.players.push({ snap: p, status: 'ready', timeMs: null, falseAt: null, card });
    });

    this.centerText = this.add
      .text(640, 330, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '110px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.subText = this.add
      .text(640, 440, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#9ca3af',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));

    this.showIntro();
  }

  // ---- Fasi ----

  private showIntro(): void {
    this.phase = 'intro';
    this.core.setScale(0.9);
    this.centerText.setText('⚡ BOTTA AL VOLO ⚡').setFontSize(72).setColor('#fbbf24').setScale(0.4).setAlpha(0);
    this.subText.setText('PREMI IL PULSANTE APPENA VEDI "VIA!"\nSE PREMI PRIMA: FALSA PARTENZA');
    this.tweens.add({ targets: this.centerText, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
    audio.select();
  }

  private enterWaiting(): void {
    this.phase = 'waiting';
    this.viaDeadline = this.gameTime + MIN_WAIT_S + Math.random() * (MAX_WAIT_S - MIN_WAIT_S);
    this.fakeAt = Math.random() < FAKEOUT_CHANCE ? this.gameTime + 0.6 + Math.random() * (this.viaDeadline - this.gameTime - 1.4) : -1;
    this.fakeDone = false;
    for (const p of this.players) {
      p.status = 'ready';
      p.timeMs = null;
      p.falseAt = null;
      this.updateCard(p);
    }
    this.centerText.setText('ATTENDI...').setFontSize(96).setColor('#e0e7ff');
    this.subText.setText('');
    this.core.setVisible(true);
  }

  private updateWaiting(): void {
    // Impulso del nucleo
    this.core.setScale(1 + Math.sin(this.gameTime * 6) * 0.07);
    this.core.setStrokeStyle(6, 0x6366f1 + Math.floor((Math.sin(this.gameTime * 6) + 1) * 40));

    // Fake-out
    if (this.fakeAt >= 0 && !this.fakeDone && this.gameTime >= this.fakeAt) {
      this.fakeDone = true;
      this.doFakeOut();
    }

    // Falsa partenza
    for (const p of this.players) {
      if (p.status !== 'ready') continue;
      if (this.ctx.input.get(p.snap.id).justPressed('action')) {
        p.status = 'falseStart';
        p.falseAt = this.gameTime;
        this.updateCard(p);
        audio.wrong();
        this.ctx.signal(p.snap.id, { type: 'falseStart' });
      }
    }

    if (this.gameTime >= this.viaDeadline) this.triggerVia();
  }

  private doFakeOut(): void {
    audio.tick();
    this.flashRect.setFillStyle(0x4ade80, 1).setAlpha(0.15);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 180 });
    const v = this.add
      .text(640, 330, 'V', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '100px', color: '#4ade80' })
      .setOrigin(0.5)
      .setDepth(11)
      .setAlpha(0);
    this.tweens.add({ targets: v, alpha: 1, duration: 70, yoyo: true, onComplete: () => v.destroy() });
  }

  private triggerVia(): void {
    this.phase = 'via';
    this.viaTime = this.gameTime;
    this.core.setVisible(false);
    this.centerText.setText('⚡ VIA! ⚡').setFontSize(140).setColor('#4ade80');
    this.subText.setText('');
    this.cameras.main.shake(180, 0.008);
    this.flashRect.setFillStyle(0x4ade80, 1).setAlpha(0.5);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 300 });
    confetti(this, 640, 320);
    audio.correct();
    this.ctx.signal(null, { type: 'via' });
  }

  private updateVia(): void {
    for (const p of this.players) {
      if (p.status !== 'ready') continue;
      if (this.ctx.input.get(p.snap.id).justPressed('action')) {
        p.status = 'pressed';
        p.timeMs = Math.round((this.gameTime - this.viaTime) * 1000);
        this.updateCard(p);
        audio.select();
        this.ctx.signal(p.snap.id, { type: 'pressed', ms: p.timeMs });
      }
    }

    if (this.gameTime - this.viaTime >= RESPONSE_TIMEOUT_S) {
      for (const p of this.players) {
        if (p.status === 'ready') {
          p.status = 'dnf';
          this.updateCard(p);
        }
      }
      this.showResults();
    }
  }

  // ---- Risultati ----

  private showResults(): void {
    this.phase = 'results';
    this.centerText.setText('RISULTATI').setFontSize(64).setColor('#ffffff');
    this.subText.setText('');

    const pressed = this.players
      .filter((p) => p.status === 'pressed')
      .sort((a, b) => (a.timeMs ?? 1e9) - (b.timeMs ?? 1e9));
    const falseStarts = this.players
      .filter((p) => p.status === 'falseStart')
      .sort((a, b) => (b.falseAt ?? 0) - (a.falseAt ?? 0));
    const dnf = this.players.filter((p) => p.status === 'dnf');
    const ranking = [...pressed, ...falseStarts, ...dnf]; // dal migliore al peggiore

    const best = ranking[0];
    if (best?.timeMs != null && (!sessionRecord || best.timeMs < sessionRecord.ms)) {
      sessionRecord = { ms: best.timeMs, name: best.snap.displayName };
    }

    // Rivelazione dal peggiore al migliore
    let t = 0;
    for (let i = ranking.length - 1; i >= 0; i--) {
      const p = ranking[i];
      const at = t;
      t += p === best ? 500 : 520;
      this.time.delayedCall(at, () => this.revealRank(p, i + 1, p === best));
    }

    // Record + statistiche comiche
    if (sessionRecord) {
      this.add
        .text(640, 60, `⚡ RECORD SERATA: ${sessionRecord.ms} ms (${sessionRecord.name})`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '22px',
          color: '#fbbf24'
        })
        .setOrigin(0.5)
        .setDepth(20);
    }
    if (this.players.length >= 2) {
      const worst = ranking[ranking.length - 1];
      const mostFalse = this.players.filter((p) => p.status === 'falseStart').length;
      const gag =
        mostFalse > 0
          ? `ANSIA PURA: ${mostFalse} fals${mostFalse === 1 ? 'a' : 'e'} partenz${mostFalse === 1 ? 'a' : 'e'}`
          : best?.timeMs != null
            ? `FULMINE: ${best.timeMs} ms · RIFLESSI DA NONNO: ${worst?.timeMs ?? '—'} ms`
            : '';
      if (gag) {
        this.add
          .text(640, 90, gag, { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#e5e7eb' })
          .setOrigin(0.5)
          .setDepth(20);
      }
    }

    this.time.delayedCall(t + RESULTS_HOLD_S * 1000, () => this.finish(ranking));
  }

  private revealRank(p: PState, placement: number, isWinner: boolean): void {
    const medal = placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `${placement}°`;
    const line = this.buildLine(p);
    const txt = this.add
      .text(640, 130 + placement * 80, `${medal}  ${line}`, {
        fontFamily: isWinner ? '"Arial Black", Arial, sans-serif' : 'Arial, sans-serif',
        fontSize: isWinner ? '40px' : '30px',
        color: isWinner ? '#fbbf24' : p.snap.color,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(15)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: txt, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

    if (isWinner) {
      audio.fanfare();
      confetti(this, 640, 250);
      const win = this.add
        .text(640, 180, `🏆 VINCITORE · ${p.timeMs ?? '—'} ms`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '44px',
          color: '#fbbf24'
        })
        .setOrigin(0.5)
        .setDepth(16)
        .setScale(0.5);
      this.tweens.add({ targets: win, scale: 1, duration: 320, ease: 'Back.easeOut' });
    } else {
      audio.select();
    }
  }

  private buildLine(p: PState): string {
    const name = p.snap.name;
    if (p.status === 'pressed') return `${p.snap.avatar} ${name} — ${p.timeMs} ms`;
    if (p.status === 'falseStart') return `${p.snap.avatar} ${name} — ❌ FALSA PARTENZA`;
    return `${p.snap.avatar} ${name} — NESSUNA RISPOSTA`;
  }

  private updateCard(p: PState): void {
    let status: string;
    let color: string;
    if (p.status === 'ready') {
      status = 'PRONTO';
      color = '#9ca3af';
    } else if (p.status === 'pressed') {
      status = `${p.timeMs} ms`;
      color = '#4ade80';
    } else if (p.status === 'falseStart') {
      status = 'FALSA PARTENZA 💀';
      color = '#f87171';
    } else {
      status = 'NESSUNA RISPOSTA';
      color = '#64748b';
    }
    p.card.setText(`${p.snap.avatar}\n${p.snap.displayName}\n${status}`).setColor(p.status === 'ready' ? p.snap.color : color);
  }

  private finish(ranking: PState[]): void {
    if (this.finished) return;
    this.finished = true;
    const results = ranking.map((p, i) => ({
      playerId: p.snap.id,
      placement: i + 1,
      score: p.timeMs ?? 0
    }));
    this.ctx.finish({ results });
  }

  // ---- Menu ESC (solo host) ----

  private onKey(e: KeyboardEvent): void {
    if (this.finished || this.phase === 'results') return;

    if (e.key === 'Escape') {
      if (this.menuMode === 'none') this.openMenu();
      else if (this.menuMode === 'main') this.closeMenu();
      else this.openMenu();
      return;
    }
    if (this.menuMode === 'none') return;

    if (e.key === 'ArrowUp') {
      this.menuIndex = (this.menuIndex - 1 + this.menuItemCount()) % this.menuItemCount();
      audio.select();
      this.renderMenu();
    } else if (e.key === 'ArrowDown') {
      this.menuIndex = (this.menuIndex + 1) % this.menuItemCount();
      audio.select();
      this.renderMenu();
    } else if (e.key === 'Enter') {
      this.confirmMenu();
    }
  }

  private menuItemCount(): number {
    return this.menuMode === 'main' ? 3 : 2;
  }

  private openMenu(): void {
    this.paused = true;
    this.menuMode = 'main';
    this.menuIndex = 0;
    this.renderMenu();
  }

  private closeMenu(): void {
    this.paused = false;
    this.menuMode = 'none';
    this.menuContainer?.destroy();
    this.menuContainer = null;
  }

  private renderMenu(): void {
    this.menuContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(100);
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.72);
    c.add(overlay);

    c.add(
      this.add
        .text(640, 170, 'BOTTA AL VOLO', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '44px', color: '#fbbf24' })
        .setOrigin(0.5)
    );
    c.add(
      this.add
        .text(640, 220, 'PAUSA', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '30px', color: '#ffffff' })
        .setOrigin(0.5)
    );

    const items =
      this.menuMode === 'main'
        ? ['RIPRENDI', 'RICOMINCIA MINIGIOCO', 'TORNA ALLA LOBBY']
        : this.menuMode === 'confirmRestart'
          ? ['ANNULLA', 'RICOMINCIA']
          : ['ANNULLA', 'TORNA ALLA LOBBY'];

    if (this.menuMode !== 'main') {
      const msg =
        this.menuMode === 'confirmRestart'
          ? 'Vuoi davvero ricominciare il minigioco?'
          : 'Vuoi davvero abbandonare il minigioco e tornare alla lobby?';
      c.add(
        this.add
          .text(640, 285, msg, { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#e5e7eb', align: 'center', wordWrap: { width: 700 } })
          .setOrigin(0.5)
      );
    }

    items.forEach((label, i) => {
      const y = this.menuMode === 'main' ? 300 + i * 90 : 380 + i * 90;
      const sel = i === this.menuIndex;
      const bg = this.add.rectangle(640, y, 520, 64, sel ? 0xfbbf24 : 0x1f2937, sel ? 0.95 : 0.85).setStrokeStyle(2, 0xffffff);
      const txt = this.add
        .text(640, y, label, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '26px', color: sel ? '#111827' : '#ffffff' })
        .setOrigin(0.5);
      c.add(bg);
      c.add(txt);
    });

    this.menuContainer = c;
  }

  private confirmMenu(): void {
    if (this.menuMode === 'main') {
      if (this.menuIndex === 0) {
        this.closeMenu(); // RIPRENDI
      } else if (this.menuIndex === 1) {
        this.menuMode = 'confirmRestart';
        this.menuIndex = 0;
        this.renderMenu();
      } else {
        this.menuMode = 'confirmLobby';
        this.menuIndex = 0;
        this.renderMenu();
      }
    } else if (this.menuMode === 'confirmRestart') {
      if (this.menuIndex === 1) {
        this.scene.restart({ ctx: this.ctx });
      } else {
        this.openMenu();
      }
    } else {
      if (this.menuIndex === 1) {
        // TORNA ALLA LOBBY: riavvia il match (stessi giocatori) e torna in stanza
        gm.restartMatch();
      } else {
        this.openMenu();
      }
    }
  }

  update(_t: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    if (this.paused) {
      this.ctx.input.update();
      return;
    }
    this.gameTime += dt;

    switch (this.phase) {
      case 'intro':
        if (this.gameTime >= INTRO_S) this.enterWaiting();
        break;
      case 'waiting':
        this.updateWaiting();
        break;
      case 'via':
        this.updateVia();
        break;
      case 'results':
        break;
    }

    this.ctx.input.update();
  }
}
