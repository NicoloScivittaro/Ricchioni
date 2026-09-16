import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;

const CARD_COLORS = [
  0xe63232, 0x3264f0, 0x32c850, 0xdcc81e,
  0xdc5ac8, 0x3cc8f0, 0xf08c28, 0x8c3cf0,
];

export default class MemoryGameScene extends Phaser.Scene {
  constructor() { super({ key: 'MemoryGameScene' }); }

  create() {
    this._reset();
    this._buildUI();
    this._setupInput();
    this._buildPauseOverlay();
  }

  _reset() {
    // 4×4 grid = 16 cards = 8 pairs
    const values = [...CARD_COLORS, ...CARD_COLORS];
    // Shuffle
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    this.cards = values.map((col, i) => ({
      col, i,
      col_idx: i,
      flipped: false,
      matched: false,
      flipAnim: 0, // 0=face-down, 1=face-up
      animDir: 0,
    }));

    this.selected = [];   // indices of currently flipped cards (max 2)
    this.lockInput = false;
    this.moves = 0;
    this.matched = 0;
    this.paused = false;
    this.ended = false;
    this.startTime = Date.now();
  }

  _buildUI() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x14142a); bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 22, 'MEMORY GAME', {
      fontFamily: 'monospace', fontSize: '20px', color: '#3cc8ff',
    }).setOrigin(0.5).setDepth(10);

    this.hudTxt = this.add.text(W/2, 48, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#b4f0b4',
    }).setOrigin(0.5).setDepth(10);

    this.hintTxt = this.add.text(W/2, H - 12, 'Click: scopri  |  ESC: pausa  |  R: riavvia  |  M: menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#787890',
    }).setOrigin(0.5).setDepth(10);

    this.gCards = this.add.graphics().setDepth(2);
    this.cardTexts = this.cards.map((c, i) => {
      const { cx, cy } = this._cardPos(i);
      return this.add.text(cx, cy, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(3);
    });

    this.endTxt = this.add.text(W/2, H/2 - 30, '', {
      fontFamily: 'monospace', fontSize: '26px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.endSub = this.add.text(W/2, H/2 + 14, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._redrawCards();
    this._redrawHUD();
  }

  _cardPos(i) {
    const CARD_W = 80, CARD_H = 90, GAP = 16;
    const cols = 4, rows = 4;
    const totalW = cols * CARD_W + (cols - 1) * GAP;
    const totalH = rows * CARD_H + (rows - 1) * GAP;
    const startX = (W - totalW) / 2;
    const startY = (H - totalH) / 2 + 20;
    const col = i % 4, row = Math.floor(i / 4);
    return {
      cx: startX + col * (CARD_W + GAP) + CARD_W / 2,
      cy: startY + row * (CARD_H + GAP) + CARD_H / 2,
      w: CARD_W, h: CARD_H,
      x: startX + col * (CARD_W + GAP),
      y: startY + row * (CARD_H + GAP),
    };
  }

  _redrawCards() {
    const g = this.gCards;
    g.clear();

    this.cards.forEach((card, i) => {
      const { x, y, w, h, cx, cy } = this._cardPos(i);
      const t = this.cardTexts[i];

      if (card.matched) {
        // Matched: show color dimmed
        g.fillStyle(card.col, 0.4);
        g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(2, card.col, 0.6);
        g.strokeRoundedRect(x, y, w, h, 8);
        t.setText('✓').setColor('#' + card.col.toString(16).padStart(6, '0'));
      } else if (card.flipped) {
        // Flipped: show color
        g.fillStyle(card.col);
        g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(2, 0xffffff, 0.4);
        g.strokeRoundedRect(x, y, w, h, 8);
        // Color name digit
        t.setText(String(CARD_COLORS.indexOf(card.col) + 1)).setColor('#ffffff');
      } else {
        // Face down
        g.fillStyle(0x1e1e40);
        g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(2, 0x3c3c78, 1);
        g.strokeRoundedRect(x, y, w, h, 8);
        // Pattern
        g.lineStyle(1, 0x2a2a60, 1);
        g.beginPath(); g.moveTo(x + 10, y + 10); g.lineTo(x + w - 10, y + h - 10); g.strokePath();
        g.beginPath(); g.moveTo(x + w - 10, y + 10); g.lineTo(x + 10, y + h - 10); g.strokePath();
        t.setText('?').setColor('#3c3c78');
      }
    });
  }

  _redrawHUD() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    this.hudTxt.setText(`Mosse: ${this.moves}  |  Coppie: ${this.matched}/8  |  Tempo: ${elapsed}s`);
  }

  _setupInput() {
    this.input.on('pointerdown', (ptr) => {
      if (this.lockInput || this.paused || this.ended) return;
      for (let i = 0; i < 16; i++) {
        const { x, y, w, h } = this._cardPos(i);
        const card = this.cards[i];
        if (ptr.x >= x && ptr.x <= x+w && ptr.y >= y && ptr.y <= y+h) {
          if (card.flipped || card.matched) return;
          if (this.selected.includes(i)) return;
          card.flipped = true;
          this.selected.push(i);
          this._redrawCards();
          if (this.selected.length === 2) {
            this.moves++;
            this._checkMatch();
          }
          break;
        }
      }
    });

    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => {
      if (this.ended) return;
      this.paused = !this.paused;
      this.pauseContainer.setVisible(this.paused);
    });
    kb.on('keydown-R', () => { this._reset(); this._redrawCards(); this._redrawHUD(); this.endTxt.setVisible(false); this.endSub.setVisible(false); });
    kb.on('keydown-M', () => this._returnToMenu());
  }

  _checkMatch() {
    const [a, b] = this.selected;
    if (this.cards[a].col === this.cards[b].col) {
      // Match!
      this.time.delayedCall(400, () => {
        this.cards[a].matched = true;
        this.cards[b].matched = true;
        this.matched++;
        this.selected = [];
        this._redrawCards();
        this._redrawHUD();
        if (this.matched === 8) this._win();
      });
    } else {
      // No match - flip back after delay
      this.lockInput = true;
      this.time.delayedCall(900, () => {
        this.cards[a].flipped = false;
        this.cards[b].flipped = false;
        this.selected = [];
        this.lockInput = false;
        this._redrawCards();
        this._redrawHUD();
      });
    }
  }

  _win() {
    this.ended = true;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    this.endTxt.setText('🎉 HAI VINTO!').setVisible(true);
    this.endSub.setText(`Mosse: ${this.moves}  Tempo: ${elapsed}s  |  R: rigioca  M: menu`).setVisible(true);
  }

  _buildPauseOverlay() {
    this.pauseContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.72); bg.fillRect(0, 0, W, H);
    this.pauseContainer.add([
      bg,
      this.add.text(W/2, H/2 - 50, 'PAUSA', { fontFamily:'monospace', fontSize:'28px', color:'#f0f0f0' }).setOrigin(0.5),
      this.add.text(W/2, H/2 + 10, 'ESC: Riprendi\nR: Ricomincia\nM: Menu', { fontFamily:'monospace', fontSize:'15px', color:'#c8c8e0', align:'center' }).setOrigin(0.5),
    ]);
  }

  _returnToMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }

  update() { this._redrawHUD(); }
}
