import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;
const CELL = 140, OFF_X = (W - CELL * 3) / 2, OFF_Y = (H - CELL * 3) / 2 + 10;

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],  // rows
  [0,3,6],[1,4,7],[2,5,8],  // cols
  [0,4,8],[2,4,6],          // diagonals
];

// Minimax AI
function minimax(board, isMax, depth) {
  const w = checkWinner(board);
  if (w === 'O') return 10 - depth;
  if (w === 'X') return depth - 10;
  if (board.every(v => v)) return 0;
  const scores = [];
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = isMax ? 'O' : 'X';
      scores.push(minimax(board, !isMax, depth + 1));
      board[i] = null;
    }
  }
  return isMax ? Math.max(...scores) : Math.min(...scores);
}

function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function bestMove(board) {
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = 'O';
      const score = minimax(board, false, 0);
      board[i] = null;
      if (score > best) { best = score; move = i; }
    }
  }
  return move;
}

export default class TicTacToeScene extends Phaser.Scene {
  constructor() { super({ key: 'TicTacToeScene' }); }

  create() {
    this._leaving = false;
    this.mode = '1P'; // '1P', '2P', 'AI'
    this._reset();
    this._buildUI();
    this._setupInput();
  }

  _reset() {
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.winner = null;
    this.winLine = null;
    this.drawFlag = false;
    this.scores = { X: 0, O: 0, draws: 0, ...this.scores };
    this.aiThinking = false;
  }

  _buildUI() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x14142a); bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 22, 'TIC TAC TOE', {
      fontFamily: 'monospace', fontSize: '22px', color: '#3cc8ff',
    }).setOrigin(0.5).setDepth(10);

    this.gBoard   = this.add.graphics().setDepth(2);
    this.gMarks   = this.add.graphics().setDepth(3);
    this.gWinLine = this.add.graphics().setDepth(4);

    this.turnTxt  = this.add.text(W/2, H - 80, '', { fontFamily:'monospace', fontSize:'16px', color:'#f0f0f0' }).setOrigin(0.5).setDepth(10);
    this.scoreTxt = this.add.text(W/2, H - 56, '', { fontFamily:'monospace', fontSize:'14px', color:'#b4f0b4' }).setOrigin(0.5).setDepth(10);
    this.modeTxt  = this.add.text(W/2, H - 34, '', { fontFamily:'monospace', fontSize:'12px', color: '#787890' }).setOrigin(0.5).setDepth(10);
    this.hintTxt  = this.add.text(W/2, H - 14, 'R: riavvia  T: cambia modalità  M: menu  ESC: menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#505068',
    }).setOrigin(0.5).setDepth(10);

    this._drawBoard();
    this._redrawHUD();
  }

  _drawBoard() {
    const g = this.gBoard;
    g.clear();
    g.lineStyle(3, 0x3264a0, 1);
    for (let i = 1; i < 3; i++) {
      g.beginPath(); g.moveTo(OFF_X + i * CELL, OFF_Y); g.lineTo(OFF_X + i * CELL, OFF_Y + CELL * 3); g.strokePath();
      g.beginPath(); g.moveTo(OFF_X, OFF_Y + i * CELL); g.lineTo(OFF_X + CELL * 3, OFF_Y + i * CELL); g.strokePath();
    }
  }

  _redrawMarks() {
    const g = this.gMarks;
    g.clear();
    this.board.forEach((val, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = OFF_X + col * CELL + CELL / 2;
      const cy = OFF_Y + row * CELL + CELL / 2;
      const r = CELL / 2 - 22;
      if (val === 'X') {
        g.lineStyle(5, 0xe63232, 1);
        g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.strokePath();
        g.beginPath(); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.strokePath();
      } else if (val === 'O') {
        g.lineStyle(5, 0x5a8cff, 1);
        g.strokeCircle(cx, cy, r);
      }
    });
  }

  _drawWinLine() {
    if (!this.winLine) return;
    const [a, b, c] = this.winLine;
    const pos = (idx) => {
      const col = idx % 3, row = Math.floor(idx / 3);
      return [OFF_X + col * CELL + CELL / 2, OFF_Y + row * CELL + CELL / 2];
    };
    const [ax, ay] = pos(a);
    const [cx, cy] = pos(c);
    const col = this.winner === 'X' ? 0xff9090 : 0x90a8ff;
    this.gWinLine.clear();
    this.gWinLine.lineStyle(6, col, 0.8);
    this.gWinLine.beginPath(); this.gWinLine.moveTo(ax, ay); this.gWinLine.lineTo(cx, cy); this.gWinLine.strokePath();
  }

  _redrawHUD() {
    const s = this.scores;
    this.scoreTxt.setText(`X: ${s.X || 0}  O: ${s.O || 0}  Pari: ${s.draws || 0}`);
    this.modeTxt.setText(`Modalità: ${this.mode}  (T: cambia)`);

    if (this.winner) {
      this.turnTxt.setText(`VINCE ${this.winner}! 🎉  —  R: ricomincia`).setColor('#fac864');
    } else if (this.drawFlag) {
      this.turnTxt.setText('PARI!  —  R: ricomincia').setColor('#c8c864');
    } else {
      const col = this.turn === 'X' ? '#e66464' : '#6496ff';
      this.turnTxt.setText(`Turno: ${this.turn}`).setStyle({ color: col });
    }
  }

  _setupInput() {
    this.input.on('pointerdown', (ptr) => {
      if (this.winner || this.drawFlag || this.aiThinking) return;
      if (this.mode !== '2P' && this.turn === 'O') return; // AI's turn
      const col = Math.floor((ptr.x - OFF_X) / CELL);
      const row = Math.floor((ptr.y - OFF_Y) / CELL);
      if (col < 0 || col > 2 || row < 0 || row > 2) return;
      const idx = row * 3 + col;
      this._play(idx);
    });

    const kb = this.input.keyboard;
    kb.on('keydown-R', () => {
      this._reset(); this._drawBoard(); this._redrawMarks(); this.gWinLine.clear(); this._redrawHUD();
    });
    kb.on('keydown-T', () => {
      const modes = ['1P', '2P', 'AI'];
      this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
      this._reset(); this._drawBoard(); this._redrawMarks(); this.gWinLine.clear(); this._redrawHUD();
    });
    kb.on('keydown-M',   () => this._returnToMenu());
    kb.on('keydown-ESC', () => this._returnToMenu());
  }

  _play(idx) {
    if (this.board[idx]) return;
    this.board[idx] = this.turn;
    this._redrawMarks();

    // Check win
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        this.winner = this.board[a];
        this.winLine = line;
        this.scores[this.winner] = (this.scores[this.winner] || 0) + 1;
        this._drawWinLine();
        this._redrawHUD();
        return;
      }
    }

    // Check draw
    if (this.board.every(v => v)) {
      this.drawFlag = true;
      this.scores.draws = (this.scores.draws || 0) + 1;
      this._redrawHUD();
      return;
    }

    // Switch turn
    this.turn = this.turn === 'X' ? 'O' : 'X';
    this._redrawHUD();

    // AI move — guard against _leaving (ESC pressed during AI thinking)
    if (this.mode !== '2P' && this.turn === 'O') {
      this.aiThinking = true;
      const delay = this.mode === '1P' ? 300 : 150;
      this.time.delayedCall(delay, () => {
        if (this._leaving) { this.aiThinking = false; return; }
        const move = this.mode === 'AI'
          ? bestMove([...this.board])
          : this._randomMove();
        if (move !== -1) this._play(move);
        this.aiThinking = false;
      });
    }
  }

  _randomMove() {
    const empty = this.board.map((v, i) => v ? -1 : i).filter(i => i !== -1);
    return empty.length ? empty[Math.floor(Math.random() * empty.length)] : -1;
  }

  _returnToMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }
}
