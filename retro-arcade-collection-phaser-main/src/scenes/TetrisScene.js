import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;
const COLS = 10, ROWS = 20, CELL = 24;
const BW = COLS * CELL, BH = ROWS * CELL;
const OX = (W - BW) / 2, OY = 80;
const PX = OX + BW + 24;

const SHAPES = [
  { cells: [[1,1,1,1]], color: 0xc82828 },
  { cells: [[1,1],[1,1]], color: 0x2878dc },
  { cells: [[0,1,1],[1,1,0]], color: 0xdcc81e },
  { cells: [[1,1,0],[0,1,1]], color: 0x3cc850 },
  { cells: [[1,0,0],[1,1,1]], color: 0xc86428 },
  { cells: [[0,0,1],[1,1,1]], color: 0xa03cc8 },
  { cells: [[0,1,0],[1,1,1]], color: 0x50b4dc },
];

function rotate(s) { return s[0].map((_, c) => s.map(r => r[c]).reverse()); }

function loadScores() { try { return JSON.parse(localStorage.getItem('retro_scores') || '{}'); } catch { return {}; } }
function saveScores(s) { try { localStorage.setItem('retro_scores', JSON.stringify(s)); } catch {} }

export default class TetrisScene extends Phaser.Scene {
  constructor() { super({ key: 'TetrisScene' }); }

  create() {
    this._reset();
    this._buildGraphics();
    this._setupInput();
    this._buildPauseOverlay();

    this.fallTimer = this.time.addEvent({
      delay: 600, loop: true, callback: this._fall, callbackScope: this,
    });
  }

  _reset() {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.curr = this._newPiece();
    this.next = this._newPiece();
    this.held = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.paused = false;
    this.gameOver = false;
    this.flashLines = [];
    this.flashTimer = 0;
    if (this.fallTimer) this.fallTimer.delay = 600;
  }

  _newPiece() {
    const idx = Math.floor(Math.random() * SHAPES.length);
    const { cells, color } = SHAPES[idx];
    return {
      cells: cells.map(r => [...r]),
      x: Math.floor(COLS/2) - Math.floor(cells[0].length/2),
      y: 0, color,
    };
  }

  _buildGraphics() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x14142a); bg.fillRect(0, 0, W, H);

    // Board border
    const border = this.add.graphics().setDepth(1);
    border.lineStyle(2, 0x323250, 1);
    border.strokeRect(OX - 2, OY - 2, BW + 4, BH + 4);

    this.gBoard  = this.add.graphics().setDepth(2);
    this.gPiece  = this.add.graphics().setDepth(3);
    this.gGhost  = this.add.graphics().setDepth(2);

    // HUD
    const hudStyle = { fontFamily: 'monospace', fontSize: '14px', color: '#b4f0b4' };
    this.scoreTxt = this.add.text(10, 10, '', hudStyle).setDepth(10);
    this.levelTxt = this.add.text(10, 30, '', hudStyle).setDepth(10);
    this.linesTxt = this.add.text(10, 50, '', hudStyle).setDepth(10);

    this.add.text(PX, OY,       'NEXT', hudStyle).setDepth(10);
    this.add.text(PX, OY + 110, 'HOLD', hudStyle).setDepth(10);
    this.add.text(PX, OY + 220, 'ESC: pausa', { fontFamily: 'monospace', fontSize: '11px', color: '#787890' }).setDepth(10);
    this.add.text(PX, OY + 238, 'C: hold', { fontFamily: 'monospace', fontSize: '11px', color: '#787890' }).setDepth(10);

    this.gNext = this.add.graphics().setDepth(10);
    this.gHold = this.add.graphics().setDepth(10);

    this.overTxt = this.add.text(W/2, H/2 - 30, '', {
      fontFamily: 'monospace', fontSize: '28px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.overSub = this.add.text(W/2, H/2 + 14, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._redrawAll();
  }

  _redrawAll() {
    this.scoreTxt.setText(`SCORE: ${this.score}`);
    this.levelTxt.setText(`LEVEL: ${this.level}`);
    this.linesTxt.setText(`LINES: ${this.lines}`);
  }

  _setupInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT',  () => { if (!this.paused && !this.gameOver) this._move(-1, 0); });
    kb.on('keydown-RIGHT', () => { if (!this.paused && !this.gameOver) this._move(1, 0); });
    kb.on('keydown-DOWN',  () => { if (!this.paused && !this.gameOver) this._move(0, 1); });
    kb.on('keydown-UP',    () => { if (!this.paused && !this.gameOver) this._rotate(); });
    kb.on('keydown-SPACE', () => { if (!this.paused && !this.gameOver) this._hardDrop(); });
    kb.on('keydown-C',     () => { if (!this.paused && !this.gameOver) this._holdPiece(); });
    kb.on('keydown-R',     () => { this._reset(); this.overTxt.setVisible(false); this.overSub.setVisible(false); });
    kb.on('keydown-M',     () => this._returnToMenu());
    kb.on('keydown-ESC',   () => {
      if (this.gameOver) return;
      if (this.paused) { this.paused = false; this.pauseContainer.setVisible(false); }
      else             { this.paused = true;  this.pauseContainer.setVisible(true); }
    });
  }

  _collide(cells, x, y) {
    return cells.some((row, r) => row.some((v, c) => {
      if (!v) return false;
      const rr = y + r, cc = x + c;
      return rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || this.board[rr][cc];
    }));
  }

  _move(dx, dy) {
    const nx = this.curr.x + dx, ny = this.curr.y + dy;
    if (!this._collide(this.curr.cells, nx, ny)) {
      this.curr.x = nx; this.curr.y = ny;
    }
  }

  _rotate() {
    const ns = rotate(this.curr.cells);
    if (!this._collide(ns, this.curr.x, this.curr.y)) this.curr.cells = ns;
  }

  _hardDrop() {
    while (!this._collide(this.curr.cells, this.curr.x, this.curr.y + 1)) this.curr.y++;
    this._lock();
  }

  _fall() {
    if (this.paused || this.gameOver) return;
    if (this.flashLines.length > 0) {
      this.flashTimer -= 200;
      if (this.flashTimer <= 0) this._clearFlash();
      return;
    }
    if (!this._collide(this.curr.cells, this.curr.x, this.curr.y + 1)) {
      this.curr.y++;
    } else {
      this._lock();
    }
  }

  _lock() {
    this.curr.cells.forEach((row, r) => row.forEach((v, c) => {
      if (v) this.board[this.curr.y + r][this.curr.x + c] = this.curr.color;
    }));

    // Check game over
    if (this.curr.y <= 0) {
      this.gameOver = true;
      const s = loadScores(); s['tetris'] = Math.max(s['tetris'] || 0, this.score); saveScores(s);
      this.overTxt.setText('GAME OVER').setVisible(true);
      this.overSub.setText(`Score: ${this.score}  Level: ${this.level}  |  R: riavvia  M: menu`).setVisible(true);
      return;
    }

    this._checkLines();
    this.curr = this.next;
    this.next = this._newPiece();
    this.canHold = true;
    this._updateFallSpeed();
    this._redrawAll();
  }

  _checkLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every(v => v !== 0)) full.push(r);
    }
    if (!full.length) return;
    this.flashLines = full;
    this.flashTimer = 200;
    const pts = [0, 40, 100, 300, 1200][full.length] || full.length * 50;
    this.score += pts;
    this.lines += full.length;
    this.level = 1 + Math.floor(this.lines / 10);
  }

  _clearFlash() {
    this.board = this.board.filter((_, r) => !this.flashLines.includes(r));
    while (this.board.length < ROWS) this.board.unshift(Array(COLS).fill(0));
    this.flashLines = [];
  }

  _updateFallSpeed() {
    const delay = Math.max(80, 600 - (this.level - 1) * 55);
    this.fallTimer.delay = delay;
  }

  _holdPiece() {
    if (!this.canHold) return;
    if (!this.held) {
      this.held = this.curr;
      this.curr = this.next;
      this.next = this._newPiece();
    } else {
      [this.held, this.curr] = [this.curr, this.held];
      this.curr.x = Math.floor(COLS/2) - Math.floor(this.curr.cells[0].length/2);
      this.curr.y = 0;
    }
    this.canHold = false;
  }

  _ghostY() {
    let gy = this.curr.y;
    while (!this._collide(this.curr.cells, this.curr.x, gy + 1)) gy++;
    return gy;
  }

  _buildPauseOverlay() {
    this.pauseContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75); bg.fillRect(0, 0, W, H);
    const title = this.add.text(W/2, H/2 - 60, 'PAUSA', {
      fontFamily: 'monospace', fontSize: '28px', color: '#f0f0f0',
    }).setOrigin(0.5);
    const opts = this.add.text(W/2, H/2 + 10,
      'ESC: Riprendi\nR: Ricomincia\nM: Menu principale', {
        fontFamily: 'monospace', fontSize: '15px', color: '#c8c8e0', align: 'center',
      }).setOrigin(0.5);
    this.pauseContainer.add([bg, title, opts]);
  }

  _returnToMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }

  _drawCell(g, bx, by, color) {
    g.fillStyle(color); g.fillRect(bx, by, CELL - 1, CELL - 1);
    g.fillStyle(0xffffff, 0.15); g.fillRect(bx, by, CELL - 1, 3);
    g.fillStyle(0x000000, 0.25); g.fillRect(bx, by + CELL - 4, CELL - 1, 3);
  }

  _drawPreview(g, piece, ox, oy) {
    if (!piece) return;
    g.clear();
    g.fillStyle(0x0a0a18); g.fillRoundedRect(ox, oy, 80, 78, 4);
    piece.cells.forEach((row, r) => row.forEach((v, c) => {
      if (v) { g.fillStyle(piece.color); g.fillRect(ox + 6 + c * 16, oy + 6 + r * 16, 14, 14); }
    }));
  }

  update() {
    if (this.gameOver) return;

    // Board
    this.gBoard.clear();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = this.board[r][c];
        if (v) {
          const flash = this.flashLines.includes(r) && Math.floor(Date.now() / 80) % 2 === 0;
          this._drawCell(this.gBoard, OX + c * CELL, OY + r * CELL, flash ? 0xffffff : v);
        } else {
          this.gBoard.fillStyle(0x0a0a18, 0.6);
          this.gBoard.fillRect(OX + c * CELL, OY + r * CELL, CELL - 1, CELL - 1);
        }
      }
    }

    // Ghost
    this.gGhost.clear();
    const gy = this._ghostY();
    this.curr.cells.forEach((row, r) => row.forEach((v, c) => {
      if (v) {
        const col = Phaser.Display.Color.IntegerToColor(this.curr.color);
        const gc = Phaser.Display.Color.GetColor(
          Math.floor(col.red * 0.25), Math.floor(col.green * 0.25), Math.floor(col.blue * 0.25)
        );
        this.gGhost.fillStyle(gc);
        this.gGhost.fillRect(OX + (this.curr.x + c) * CELL, OY + (gy + r) * CELL, CELL - 1, CELL - 1);
      }
    }));

    // Current piece
    this.gPiece.clear();
    this.curr.cells.forEach((row, r) => row.forEach((v, c) => {
      if (v) this._drawCell(this.gPiece,
        OX + (this.curr.x + c) * CELL,
        OY + (this.curr.y + r) * CELL,
        this.curr.color);
    }));

    // Next & Hold previews
    this._drawPreview(this.gNext, this.next, PX, OY + 20);
    this._drawPreview(this.gHold, this.held, PX, OY + 130);
  }
}
