import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;
const GRID = 4;
const TILE = 100, GAP = 6;
const TOTAL = GRID * TILE + (GRID - 1) * GAP;
const OX = (W - TOTAL) / 2;
const OY = (H - TOTAL) / 2 + 20;

function isSolvable(tiles) {
  const flat = tiles.filter(v => v !== 0);
  let inv = 0;
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i] > flat[j]) inv++;
  const blankRow = 3 - Math.floor(tiles.indexOf(0) / GRID);
  return (inv % 2 === 0) === (blankRow % 2 === 1);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generateBoard() {
  const nums = [...Array(16).keys()]; // 0-15, 0 = blank
  let tries = 0;
  do { shuffle(nums); tries++; } while (!isSolvable(nums) && tries < 1000);
  return nums;
}

export default class Puzzle15Scene extends Phaser.Scene {
  constructor() { super({ key: 'Puzzle15Scene' }); }

  create() {
    this._reset();
    this._buildUI();
    this._setupInput();
    this._buildPauseOverlay();
  }

  _reset() {
    this.tiles = generateBoard();
    this.moves = 0;
    this.startTime = Date.now();
    this.ended = false;
    this.paused = false;
    // Animated tile positions (smooth movement)
    this.tilePos = this.tiles.map((_, i) => ({
      col: i % GRID, row: Math.floor(i / GRID),
      tx: i % GRID, ty: Math.floor(i / GRID),
    }));
  }

  _buildUI() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x14142a); bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 18, 'PUZZLE 15', {
      fontFamily: 'monospace', fontSize: '20px', color: '#3cc8ff',
    }).setOrigin(0.5).setDepth(10);

    this.hudTxt = this.add.text(W/2, 44, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#b4f0b4',
    }).setOrigin(0.5).setDepth(10);

    this.hintTxt = this.add.text(W/2, H - 12, 'Click tessera adiacente al vuoto  |  R: ricomincia  ESC: pausa  M: menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#787890',
    }).setOrigin(0.5).setDepth(10);

    this.gBoard = this.add.graphics().setDepth(2);
    // Create tile texts
    this.tileTxts = Array.from({ length: 16 }, (_, i) =>
      this.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '28px', color: '#f0f0ff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(3)
    );

    this.endTxt = this.add.text(W/2, H/2 - 30, '', {
      fontFamily: 'monospace', fontSize: '26px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.endSub = this.add.text(W/2, H/2 + 14, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._redrawBoard();
    this._redrawHUD();
  }

  _tileXY(col, row) {
    return {
      x: OX + col * (TILE + GAP),
      y: OY + row * (TILE + GAP),
      cx: OX + col * (TILE + GAP) + TILE / 2,
      cy: OY + row * (TILE + GAP) + TILE / 2,
    };
  }

  _redrawBoard() {
    const g = this.gBoard;
    g.clear();

    // Board background
    g.fillStyle(0x0a0a18); g.fillRect(OX - 4, OY - 4, TOTAL + 8, TOTAL + 8);

    this.tiles.forEach((val, idx) => {
      const col = idx % GRID, row = Math.floor(idx / GRID);
      const { x, y, cx, cy } = this._tileXY(col, row);
      const t = this.tileTxts[idx];

      if (val === 0) {
        t.setText('');
        return;
      }

      // Color based on position correctness
      const correct = val === idx + 1;
      const tileCol = correct ? 0x285a28 : 0x323264;
      g.fillStyle(tileCol);
      g.fillRoundedRect(x, y, TILE, TILE, 8);
      g.lineStyle(2, correct ? 0x50a050 : 0x5050a0, 1);
      g.strokeRoundedRect(x, y, TILE, TILE, 8);
      // Highlight
      g.fillStyle(0xffffff, 0.08); g.fillRect(x + 2, y + 2, TILE - 4, 8);

      t.setText(String(val)).setPosition(cx, cy).setVisible(true);
    });
  }

  _redrawHUD() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    this.hudTxt.setText(`Mosse: ${this.moves}  |  Tempo: ${elapsed}s`);
  }

  _setupInput() {
    this.input.on('pointerdown', (ptr) => {
      if (this.paused || this.ended) return;
      const col = Math.floor((ptr.x - OX) / (TILE + GAP));
      const row = Math.floor((ptr.y - OY) / (TILE + GAP));
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) return;
      this._tryMove(col, row);
    });

    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => {
      if (this.ended) return;
      this.paused = !this.paused;
      this.pauseContainer.setVisible(this.paused);
    });
    kb.on('keydown-R', () => { this._reset(); this._redrawBoard(); this._redrawHUD(); this.endTxt.setVisible(false); this.endSub.setVisible(false); });
    kb.on('keydown-M', () => this._returnToMenu());
  }

  _tryMove(col, row) {
    const idx = row * GRID + col;
    const blankIdx = this.tiles.indexOf(0);
    const blankCol = blankIdx % GRID, blankRow = Math.floor(blankIdx / GRID);
    const adjDist = Math.abs(col - blankCol) + Math.abs(row - blankRow);
    if (adjDist !== 1) return;

    // Swap
    [this.tiles[idx], this.tiles[blankIdx]] = [this.tiles[blankIdx], this.tiles[idx]];
    this.moves++;
    this._redrawBoard();
    this._redrawHUD();

    if (this._isSolved()) this._win();
  }

  _isSolved() {
    for (let i = 0; i < 15; i++) if (this.tiles[i] !== i + 1) return false;
    return this.tiles[15] === 0;
  }

  _win() {
    this.ended = true;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    this.endTxt.setText('🎉 RISOLTO!').setVisible(true);
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
