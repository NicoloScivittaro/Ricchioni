import Phaser from 'phaser';
import { audio } from '../../core/AudioManager';
import { confetti } from '../../scenes/confetti';
import { PauseMenu } from '../../core/PauseMenu';
import { MEMORY_ABILITIES } from '../../../shared/memoryAbilities';
import { MEMORY_TILES, MEMORY_SEQ_LENS, MEMORY_ROUNDS, isMemoryOver } from '../../../shared/memoryTiles';
import type { MinigameContext } from '../types';
import type { PlayerSnapshot } from '../../../shared/types';

// MEMORIA DA UBRIACO — 5 round a eliminazione, sequenze 3-4-5-6-7.
// OSSERVA → RIPETI. Chi arriva più avanti nella sequenza vince; a parità conta
// il tempo. 5 abilità (una per personaggio, una volta a partita).

const TITLE_S = 2.2;
const OBSERVE_PRE = 0.9;
const OBSERVE_INTERVAL = 0.62;
const OBSERVE_POST = 0.55;
const TIME_BUDGET_PER_TILE = 1.5; // secondi per mossa + margine
const ROUND_RESULT_S = 2.4;
// Ultimo superstite (con altri già fuori): deve comunque completare tutti i round, ma più svelti
// (osserva ~40% più rapido, stacchi più corti) così i round "da soli" non annoiano.
const SOLO_SPEED = 0.6;
const SOLO_ROUND_RESULT_S = 1.0;
const REPLAY_TILE_S = 0.42; // replay veloce (Goblin)
const REPLAY_POST_S = 0.4;
// Abilita' che toccano il TEMPO del giocatore (lo spareggio e' la somma dei tempi di completamento)
const PEEK_PENALTY_MS = 800; // M'HO SVEJATO: costo dello sbirciare
const PEEK_SHOW_MS = 1200;
const PAUSE_S = 2; // NO, ASPETTA!: tempo fermo
const RATE_CREDIT_MS = 1500; // A RATE: sconto sul tempo a meta' sequenza

const JUDOKA_SHOUTS = ['EH?! MA DAI!', 'NO, ASPETTA!', 'NON È COSÌ!', 'CASA MIA, REGOLE MIE!'];

type Phase = 'title' | 'observe' | 'repeat' | 'roundResult' | 'results';

interface PState {
  snap: PlayerSnapshot;
  alive: boolean;
  abilityUsed: boolean; // una volta per partita
  completedRounds: number;
  progress: number; // mosse giuste prima dell'errore (ranking)
  totalTimeMs: number; // somma tempi di completamento (spareggio)
  totalCorrect: number; // punteggio display
  inputIndex: number;
  deadline: number;
  penaltyMs: number;
  /** tempo "fermo" dalle abilita' (NO, ASPETTA! / A RATE): non conta per lo spareggio */
  pauseMs: number;
  /** fino a questo istante di gioco i tasti sono bloccati (NO, ASPETTA!) */
  pausedUntil: number;
  rateArmed: boolean;
  resolved: boolean;
  card: Phaser.GameObjects.Text;
}

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class MemoryScene extends Phaser.Scene {
  private ctx!: MinigameContext;
  private players: PState[] = [];
  private sequences: number[][] = [];
  private round = 0;
  private phase: Phase = 'title';
  private gameTime = 0;
  private phaseEndsAt = 0;
  private observeStart = 0;
  private nextFlashIndex = 0;
  private repeatStartTime = 0;
  private goblinReplayPending = false;
  private finished = false;

  private centerText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private tileRects: Phaser.GameObjects.Rectangle[] = [];
  private tileHalos: Phaser.GameObjects.Rectangle[] = [];
  private tileIcons: Phaser.GameObjects.Text[] = [];
  private tileLabels: Phaser.GameObjects.Text[] = [];
  private drunkTint!: Phaser.GameObjects.Rectangle;
  private pauseMenu!: PauseMenu;

  constructor() {
    super('memory');
  }

  create(data: { ctx: MinigameContext }): void {
    this.ctx = data.ctx;
    // RICOMINCIA riusa la stessa istanza: azzera tutto.
    this.players = [];
    this.sequences = [];
    this.round = 0;
    this.phase = 'title';
    this.gameTime = 0;
    this.phaseEndsAt = 0;
    this.observeStart = 0;
    this.nextFlashIndex = 0;
    this.repeatStartTime = 0;
    this.goblinReplayPending = false;
    this.finished = false;
    this.tileRects = [];
    this.tileHalos = [];
    this.tileIcons = [];
    this.tileLabels = [];

    audio.unlock();
    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setRotation(0);

    this.drunkTint = this.add
      .rectangle(640, 360, 1280, 720, 0x7c2d12, 0)
      .setDepth(50)
      .setAlpha(0);

    this.centerText = this.add
      .text(640, 74, '', { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '72px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(20);
    this.subText = this.add
      .text(640, 126, '', { fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#9ca3af', align: 'center' })
      .setOrigin(0.5)
      .setDepth(20);

    // Griglia 2x2 senza sovrapposizioni: tessere 220px con passo 260px, da y=150 a y=630 (titolo sopra, schede giocatori sotto).
    const positions = [
      { x: 510, y: 260 },
      { x: 770, y: 260 },
      { x: 510, y: 520 },
      { x: 770, y: 520 }
    ];
    for (let i = 0; i < 4; i++) {
      const t = MEMORY_TILES[i];
      const { x, y } = positions[i];
      const halo = this.add
        .rectangle(x, y, 270, 270, hex(t.color), 0)
        .setDepth(5)
        .setAlpha(0);
      const rect = this.add
        .rectangle(x, y, 220, 220, hex(t.color), 0.9)
        .setStrokeStyle(6, 0xffffff, 0.85)
        .setDepth(6);
      const icon = this.add
        .text(x, y - 22, t.icon, { fontSize: '100px' })
        .setOrigin(0.5)
        .setDepth(7);
      const label = this.add
        .text(x, y + 80, t.label, { fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '22px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(7);
      this.tileRects.push(rect);
      this.tileHalos.push(halo);
      this.tileIcons.push(icon);
      this.tileLabels.push(label);
    }

    const n = this.ctx.players.length;
    this.ctx.players.forEach((p, i) => {
      const x = n > 1 ? 640 - ((n - 1) * 230) / 2 + i * 230 : 640;
      const card = this.add
        .text(x, 656, '', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: p.color, align: 'center', lineSpacing: 3 })
        .setOrigin(0.5, 0);
      this.players.push({
        snap: p,
        alive: true,
        abilityUsed: false,
        pauseMs: 0,
        pausedUntil: 0,
        completedRounds: 0,
        progress: 0,
        totalTimeMs: 0,
        totalCorrect: 0,
        inputIndex: 0,
        deadline: 0,
        penaltyMs: 0,
        rateArmed: false,
        resolved: false,
        card
      });
    });

    this.sequences = MEMORY_SEQ_LENS.map((len) => Array.from({ length: len }, () => Math.floor(this.ctx.rng.next() * 4)));

    this.pauseMenu = new PauseMenu(this, '🧠 MEMORIA DA UBRIACO', this.ctx.input, () => this.scene.restart({ ctx: this.ctx }));

    this.showTitle();
  }

  // ---- Fasi ----

  private showTitle(): void {
    this.phase = 'title';
    this.phaseEndsAt = this.gameTime + TITLE_S;
    this.centerText.setText('🧠 MEMORIA DA UBRIACO').setFontSize(62).setColor('#fbbf24').setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: this.centerText, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
    this.subText.setText('OSSERVA la sequenza · RIPETILA · chi sbaglia è eliminato');
    audio.select();
  }

  private startObserve(): void {
    this.phase = 'observe';
    this.observeStart = this.gameTime;
    this.nextFlashIndex = 0;
    this.goblinReplayPending = false;
    const seq = this.sequences[this.round];
    const isLast = this.round === MEMORY_ROUNDS - 1;

    this.centerText.setText('👀 OSSERVA').setFontSize(88).setColor('#ffffff').setScale(1).setAlpha(1);
    this.subText
      .setText(
        this.soloSurvivor()
          ? `⭐ ULTIMO IN GARA — round ${this.round + 1}/${MEMORY_ROUNDS}, completa le sequenze!`
          : isLast
            ? '🔥 ULTIMO ROUND — attento!'
            : `Round ${this.round + 1}/${MEMORY_ROUNDS} · sequenza da ${seq.length}`
      )
      .setColor(isLast ? '#f87171' : '#9ca3af');

    for (const p of this.players) this.updateCard(p);
    this.ctx.signal(null, { type: 'observe', seqLen: seq.length });
  }

  /** true = un solo giocatore ancora in gara mentre altri sono già stati eliminati. */
  private soloSurvivor(): boolean {
    return this.players.length > 1 && this.players.filter((p) => p.alive).length === 1;
  }

  private observeTiming(): { pre: number; interval: number; post: number } {
    const k = this.soloSurvivor() ? SOLO_SPEED : 1;
    return { pre: OBSERVE_PRE * k, interval: OBSERVE_INTERVAL * k, post: OBSERVE_POST * k };
  }

  private updateObserve(): void {
    const seq = this.sequences[this.round];
    while (
      this.nextFlashIndex < seq.length &&
      this.gameTime >= this.observeStart + this.observeTiming().pre + this.nextFlashIndex * this.observeTiming().interval
    ) {
      this.flashTile(seq[this.nextFlashIndex]);
      this.nextFlashIndex++;
    }
    const tm = this.observeTiming();
    if (this.gameTime >= this.observeStart + tm.pre + seq.length * tm.interval + tm.post) {
      this.startRepeat();
    }
  }

  private startRepeat(): void {
    this.phase = 'repeat';
    this.repeatStartTime = this.gameTime;
    const seq = this.sequences[this.round];
    const budget = seq.length * TIME_BUDGET_PER_TILE + 2.5;

    for (const p of this.players) {
      if (!p.alive) continue;
      p.inputIndex = 0;
      p.penaltyMs = 0;
      p.pauseMs = 0;
      p.pausedUntil = 0;
      p.rateArmed = false;
      p.resolved = false;
      p.deadline = this.repeatStartTime + budget;
      this.updateCard(p);
    }

    this.centerText.setText('👆 TOCCA LA SEQUENZA').setFontSize(66).setColor('#4ade80');
    this.subText.setText(`${seq.length} mosse · vai!`);
    this.ctx.signal(null, { type: 'repeat' });

    // Goblin "ANCORA UN GIRO": replay privato (solo il suo telefono).
    if (this.goblinReplayPending) {
      this.goblinReplayPending = false;
      const goblin = this.players.find((p) => p.snap.characterId === 'goblin' && p.alive);
      if (goblin) {
        const replaySec = seq.length * REPLAY_TILE_S + REPLAY_POST_S;
        this.ctx.signal(goblin.snap.id, { type: 'replay', seq });
        goblin.deadline += replaySec;
      }
    }
  }

  private updateRepeat(): void {
    const seq = this.sequences[this.round];
    for (const p of this.players) {
      if (!p.alive || p.resolved) continue;

      if (this.gameTime > p.deadline) {
        this.eliminate(p, `⏱ Tempo scaduto (mossa ${p.inputIndex + 1})`);
        continue;
      }

      const input = this.ctx.input.get(p.snap.id);
      if (input.justPressed('ability')) this.handleAbility(p);
      // NO, ASPETTA!: durante la pausa i tasti non contano (il tempo e' fermo); si riprende subito dopo, senza replay
      if (this.gameTime < p.pausedUntil) continue;
      for (let c = 0; c < 4; c++) {
        if (input.justPressed(`c${c}`)) this.handleTilePress(p, c, seq);
      }
    }

    if (!this.players.some((p) => p.alive && !p.resolved)) this.endRound();
  }

  private handleTilePress(p: PState, c: number, seq: number[]): void {
    audio.tileTone(c);
    this.flashTile(c);

    if (c === seq[p.inputIndex]) {
      p.inputIndex++;
      p.totalCorrect++;
      if (p.inputIndex >= seq.length) {
        const roundMs = Math.max(150, Math.round((this.gameTime - this.repeatStartTime) * 1000) + p.penaltyMs - p.pauseMs);
        p.totalTimeMs += roundMs;
        p.completedRounds++;
        p.progress = seq.length;
        p.resolved = true;
        audio.correct();
        this.ctx.signal(p.snap.id, { type: 'completed', ms: roundMs });
        this.showBanner(p, `✅ Sequenza completata (${roundMs} ms)`);
      } else {
        // Ciro "A RATE": pausa mentale a metà sequenza.
        if (p.rateArmed && p.inputIndex === Math.ceil(seq.length / 2)) {
          p.deadline += 2;
          p.pauseMs += RATE_CREDIT_MS;
          p.rateArmed = false;
          this.ctx.signal(p.snap.id, { type: 'rate' });
          this.showBanner(p, '💸 A RATE — metà fatta, respira! (−1,5 s dal tuo tempo)');
        }
      }
      this.updateCard(p);
    } else {
      this.handleWrong(p);
    }
  }

  private handleWrong(p: PState): void {
    // Buttafuori "MO HO CAPITO": una seconda chance (penalità tempo).
    if (p.snap.characterId === 'buttafuori' && !p.abilityUsed) {
      p.abilityUsed = true;
      p.penaltyMs += 1200;
      audio.select();
      this.ctx.signal(p.snap.id, { type: 'abilityUsed', name: 'MO HO CAPITO' });
      this.ctx.signal(p.snap.id, { type: 'secondChance' });
      this.showBanner(p, '🥊 MO HO CAPITO — seconda chance (+1200 ms)');
      this.updateCard(p);
      return;
    }
    this.eliminate(p, `❌ Errore alla mossa ${p.inputIndex + 1}`);
  }

  private eliminate(p: PState, reason: string): void {
    p.resolved = true;
    p.alive = false;
    p.progress = p.inputIndex;
    audio.wrong();
    this.ctx.signal(p.snap.id, { type: 'eliminated', at: p.inputIndex + 1 });
    this.showBanner(p, reason);
    this.updateCard(p);
  }

  private handleAbility(p: PState): void {
    if (p.abilityUsed || !p.alive) return;
    const cid = p.snap.characterId ?? '';
    const ab = MEMORY_ABILITIES[cid];
    if (!ab) return;
    if (ab.phase === 'observe' && this.phase !== 'observe') return;
    if (ab.phase === 'repeat' && this.phase !== 'repeat') return;
    if (ab.phase === 'passive') return; // Buttafuori: scatta da sola sull'errore

    p.abilityUsed = true;
    this.ctx.signal(p.snap.id, { type: 'abilityUsed', name: ab.name });
    audio.select();

    switch (cid) {
      case 'goblin': {
        this.goblinReplayPending = true;
        this.showBanner(p, '🍺 ANCORA UN GIRO — replay privato in arrivo');
        break;
      }
      case 'dottore': {
        // Privato: la casella si vede SOLO sul telefono del Dottore (prima si illuminava sulla TV e la vedevano tutti). Costa tempo.
        const seq = this.sequences[this.round];
        const next = seq[p.inputIndex] ?? 0;
        p.penaltyMs += PEEK_PENALTY_MS;
        this.ctx.signal(p.snap.id, { type: 'hint', tile: next, ms: PEEK_SHOW_MS });
        this.showBanner(p, "🤦‍♂️ M'HO SVEJATO — ha sbirciato (+0,8 s)");
        break;
      }
      case 'judoka': {
        // Tempo fermo: la scadenza slitta, lo spareggio non conta la pausa, i tasti restano bloccati 2 s, poi si riprende SUBITO
        p.deadline += PAUSE_S;
        p.pauseMs += PAUSE_S * 1000;
        p.pausedUntil = this.gameTime + PAUSE_S;
        const shout = JUDOKA_SHOUTS[Math.floor(Math.random() * JUDOKA_SHOUTS.length)];
        this.ctx.signal(p.snap.id, { type: 'pause', ms: PAUSE_S * 1000 });
        this.showBanner(p, `🥋 ${shout} — tempo fermo 2s`);
        break;
      }
      case 'ciro': {
        p.rateArmed = true;
        this.ctx.signal(p.snap.id, { type: 'rateArmed' });
        this.showBanner(p, '💸 A RATE — pausa a metà sequenza');
        break;
      }
    }
    this.updateCard(p);
  }

  private endRound(): void {
    this.phase = 'roundResult';
    this.phaseEndsAt = this.gameTime + (this.soloSurvivor() ? SOLO_ROUND_RESULT_S : ROUND_RESULT_S);
    const survivors = this.players.filter((p) => p.alive);
    this.centerText.setText(`FINE ROUND ${this.round + 1}`).setFontSize(60).setColor('#ffffff');
    this.subText.setText(survivors.length > 0 ? `In gara: ${survivors.length}` : 'Tutti eliminati!');
    if (survivors.length < this.players.length) audio.wrong();
    else audio.select();
  }

  private advanceRound(): void {
    // Fine ROUND ≠ fine MINIGIOCO: anche se resta un solo superstite si giocano tutti i round
    // previsti (5); il minigioco finisce solo dopo l'ultimo round o se sono usciti tutti.
    const aliveCount = this.players.filter((p) => p.alive).length;
    if (isMemoryOver(this.round, MEMORY_ROUNDS, aliveCount)) {
      this.showResults();
    } else {
      this.round += 1;
      this.startObserve();
    }
  }

  // ---- Risultati ----

  private rankPlayers(): PState[] {
    return [...this.players].sort((a, b) => {
      if (a.completedRounds !== b.completedRounds) return b.completedRounds - a.completedRounds;
      if (a.progress !== b.progress) return b.progress - a.progress;
      return a.totalTimeMs - b.totalTimeMs;
    });
  }

  private showResults(): void {
    this.phase = 'results';
    this.drunkTint.setAlpha(0);
    this.cameras.main.setRotation(0);
    this.centerText.setText('RISULTATI').setFontSize(64).setColor('#ffffff');
    this.subText.setText('Chi è arrivato più avanti vince');
    // Nasconde le tile per far spazio alla classifica.
    for (const o of [...this.tileRects, ...this.tileHalos, ...this.tileIcons, ...this.tileLabels]) {
      o.setVisible(false);
    }
    const ranking = this.rankPlayers();

    let t = 0;
    for (let i = ranking.length - 1; i >= 0; i--) {
      const at = t;
      t += i === 0 ? 560 : 520;
      this.time.delayedCall(at, () => this.revealRank(ranking[i], i + 1, i === 0));
    }
    this.time.delayedCall(t + 2200, () => this.finish(ranking));
  }

  private revealRank(p: PState, placement: number, isWinner: boolean): void {
    const medal = placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `${placement}°`;
    const info = `${p.completedRounds} round · ${p.totalCorrect} mosse`;
    const txt = this.add
      .text(640, 150 + placement * 74, `${medal}  ${p.snap.avatar} ${p.snap.name} — ${info}`, {
        fontFamily: isWinner ? '"Arial Black", Arial, sans-serif' : 'Arial, sans-serif',
        fontSize: isWinner ? '36px' : '26px',
        color: isWinner ? '#fbbf24' : p.snap.color,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: txt, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

    if (isWinner) {
      audio.fanfare();
      confetti(this, 640, 250);
    } else {
      audio.select();
    }
  }

  private finish(ranking: PState[]): void {
    if (this.finished) return;
    this.finished = true;
    const results = ranking.map((p, i) => ({
      playerId: p.snap.id,
      placement: i + 1,
      score: p.totalCorrect,
      stats: [`${p.completedRounds}/${MEMORY_ROUNDS} sequenze`, `${p.totalCorrect} mosse esatte`]
    }));
    this.ctx.finish({ results });
  }

  // ---- Effetti ----

  private flashTile(i: number): void {
    const rect = this.tileRects[i];
    const halo = this.tileHalos[i];
    rect.setScale(0.94);
    this.tweens.add({
      targets: rect,
      scale: 1.07,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => rect.setScale(1)
    });
    halo.setAlpha(0.55);
    this.tweens.add({ targets: halo, alpha: 0, duration: 380 });

    // Doppia visione "da ubriaco" dai round più avanti.
    if (this.round >= 2) {
      const ghost = this.add
        .rectangle(rect.x + 18, rect.y + 12, 220, 220, hex(MEMORY_TILES[i].color), 0.22)
        .setDepth(4);
      this.tweens.add({ targets: ghost, alpha: 0, duration: 320, onComplete: () => ghost.destroy() });
    }
    if (this.round >= 3) this.cameras.main.shake(60, 0.003);
  }

  private highlightTile(i: number, ms: number): void {
    const rect = this.tileRects[i];
    const halo = this.tileHalos[i];
    rect.setStrokeStyle(10, 0xffffff, 1);
    halo.setAlpha(0.7);
    this.tweens.add({ targets: rect, alpha: 1, scale: 1.06, duration: 120, yoyo: true, repeat: Math.floor(ms / 240) - 1 });
    this.time.delayedCall(ms, () => {
      rect.setStrokeStyle(6, 0xffffff, 0.85);
      halo.setAlpha(0);
    });
  }

  private showBanner(p: PState, text: string): void {
    const b = this.add
      .text(640, 646, `${p.snap.avatar} ${text}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: p.snap.color
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 150, yoyo: true, hold: 900, onComplete: () => b.destroy() });
  }

  private updateCard(p: PState): void {
    const seqLen = this.sequences[this.round]?.length ?? 0;
    let status: string;
    let color: string;
    if (!p.alive) {
      status = `💀 ELIMINATO (mossa ${p.progress})`;
      color = '#f87171';
    } else if (p.resolved) {
      status = '✅ FATTO';
      color = '#4ade80';
    } else if (this.phase === 'observe' || this.phase === 'title') {
      status = '👀 osserva';
      color = p.snap.color;
    } else {
      status = `⏳ ${p.inputIndex}/${seqLen}`;
      color = p.snap.color;
    }
    const abName = MEMORY_ABILITIES[p.snap.characterId ?? '']?.name ?? 'ABILITÀ';
    const ability = p.abilityUsed ? '⭐ usata' : `⭐ ${abName}`;
    p.card.setText(`${p.snap.avatar} ${p.snap.displayName}\n${status}\n${ability}`).setColor(color);
  }

  private applyDrunk(): void {
    const lvl = this.round;
    if (lvl >= 2) {
      const base = lvl >= 4 ? 0.1 : lvl === 3 ? 0.08 : 0.05;
      this.drunkTint.setAlpha(base + Math.sin(this.gameTime * 1.6) * 0.015);
    } else {
      this.drunkTint.setAlpha(0);
    }
    if (lvl >= 2) {
      this.cameras.main.setRotation(Math.sin(this.gameTime * 2.1) * (lvl - 1) * 0.0022);
    } else {
      this.cameras.main.setRotation(0);
    }
  }

  // ---- Loop ----

  update(_t: number, delta: number): void {
    if (this.pauseMenu.update()) return;
    if (this.finished) return;

    const dt = Math.min(delta, 250) / 1000; // tempo reale fino a ~4 FPS
    this.gameTime += dt;
    this.applyDrunk();

    switch (this.phase) {
      case 'title':
        if (this.gameTime >= this.phaseEndsAt) this.startObserve();
        break;
      case 'observe':
        this.updateObserve();
        break;
      case 'repeat':
        this.updateRepeat();
        break;
      case 'roundResult':
        if (this.gameTime >= this.phaseEndsAt) this.advanceRound();
        break;
      case 'results':
        break;
    }

    this.ctx.input.update();
  }
}
