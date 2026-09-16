import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;

function generateMaze(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const stack = [];
  let cx = 0, cy = 0;
  grid[cy][cx] = 0;
  stack.push([cx, cy]);
  while (stack.length) {
    [cx, cy] = stack[stack.length - 1];
    const neighbors = [[-2,0],[2,0],[0,-2],[0,2]]
      .map(([dx, dy]) => [cx+dx, cy+dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && grid[ny][nx] === 1);
    if (neighbors.length) {
      const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[(cy+ny)>>1][(cx+nx)>>1] = 0;
      grid[ny][nx] = 0;
      stack.push([nx, ny]);
    } else { stack.pop(); }
  }
  return grid;
}

const DIFFICULTIES = { easy: [15,11], medium: [21,15], hard: [31,21] };

export default class MazeRunnerScene extends Phaser.Scene {
  constructor() { super({ key: 'MazeRunnerScene' }); }

  create() {
    this.difficulty = 'easy';
    this._reset();
    this._buildGraphics();
    this._setupInput();
    this._buildPauseOverlay();
    this._buildDiffPanel();
  }

  _reset() {
    const [cols, rows] = DIFFICULTIES[this.difficulty];
    this.maze = generateMaze(cols, rows);
    this.mazeW = cols; this.mazeH = rows;
    this.cellW = Math.floor((W - 40) / cols);
    this.cellH = Math.floor((H - 60) / rows);
    this.offX = (W - this.cellW * cols) / 2;
    this.offY = (H - 40 - this.cellH * rows) / 2 + 40;
    this.px = 0; this.py = 0;
    this.goal = [cols - 1, rows - 1];
    // Make sure goal is accessible
    this.maze[rows-1][cols-1] = 0;
    if (cols > 2) this.maze[rows-1][cols-2] = 0;
    if (rows > 2) this.maze[rows-2][cols-1] = 0;
    this.moves = 0;
    this.startTime = Date.now();
    this.breadcrumbs = new Set();
    this.breadcrumbs.add(`${this.px},${this.py}`);
    this.ended = false;
    this.paused = false;
  }

  _buildGraphics() {
    this.gMaze   = this.add.graphics().setDepth(1);
    this.gPlayer = this.add.graphics().setDepth(3);
    this.hudTxt  = this.add.text(10, 10, '', { fontFamily: 'monospace', fontSize: '13px', color: '#b4f0b4' }).setDepth(10);
    this.hintTxt = this.add.text(W - 10, 10, 'ESC: pausa  M: menu  1/2/3: difficoltà', {
      fontFamily: 'monospace', fontSize: '11px', color: '#787890',
    }).setOrigin(1, 0).setDepth(10);

    this.endTxt = this.add.text(W/2, H/2 - 30, '', {
      fontFamily: 'monospace', fontSize: '26px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.endSub = this.add.text(W/2, H/2 + 14, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._drawMaze();
  }

  _drawMaze() {
    const g = this.gMaze;
    g.clear();
    // Background
    g.fillStyle(0x0a0a18); g.fillRect(0, 0, W, H);

    for (let row = 0; row < this.mazeH; row++) {
      for (let col = 0; col < this.mazeW; col++) {
        const cx = this.offX + col * this.cellW;
        const cy = this.offY + row * this.cellH;
        if (this.maze[row][col] === 1) {
          g.fillStyle(0x1e2d5a); g.fillRect(cx, cy, this.cellW, this.cellH);
        } else {
          // Breadcrumb
          if (this.breadcrumbs.has(`${col},${row}`)) {
            g.fillStyle(0x1a3a1a); g.fillRect(cx + 1, cy + 1, this.cellW - 2, this.cellH - 2);
          }
        }
      }
    }
    // Goal
    const [gx, gy] = this.goal;
    const gcx = this.offX + gx * this.cellW + 2;
    const gcy = this.offY + gy * this.cellH + 2;
    g.fillStyle(0xf0dc46); g.fillRect(gcx, gcy, this.cellW - 4, this.cellH - 4);
  }

  _drawPlayer() {
    const g = this.gPlayer;
    g.clear();
    const cx = this.offX + this.px * this.cellW + this.cellW / 2;
    const cy = this.offY + this.py * this.cellH + this.cellH / 2;
    const r  = Math.min(this.cellW, this.cellH) / 2 - 2;
    g.fillStyle(0x3cc8ff); g.fillCircle(cx, cy, r);
    g.lineStyle(2, 0x0064a0, 1); g.strokeCircle(cx, cy, r);
  }

  _setupInput() {
    const kb = this.input.keyboard;
    const move = (dx, dy) => {
      if (this.paused || this.ended) return;
      const nx = this.px + dx, ny = this.py + dy;
      if (nx < 0 || ny < 0 || nx >= this.mazeW || ny >= this.mazeH) return;
      if (this.maze[ny][nx] === 1) return;
      this.px = nx; this.py = ny;
      this.moves++;
      this.breadcrumbs.add(`${nx},${ny}`);
      this._drawMaze(); this._drawPlayer();
      this.hudTxt.setText(`Mosse: ${this.moves}  |  Tempo: ${Math.floor((Date.now()-this.startTime)/1000)}s  |  Diff: ${this.difficulty}`);
      if (nx === this.goal[0] && ny === this.goal[1]) this._win();
    };
    kb.on('keydown-LEFT',  () => move(-1, 0));
    kb.on('keydown-RIGHT', () => move(1, 0));
    kb.on('keydown-UP',    () => move(0, -1));
    kb.on('keydown-DOWN',  () => move(0, 1));
    kb.on('keydown-A',     () => move(-1, 0));
    kb.on('keydown-D',     () => move(1, 0));
    kb.on('keydown-W',     () => move(0, -1));
    kb.on('keydown-S',     () => move(0, 1));
    kb.on('keydown-ONE',   () => { this.difficulty = 'easy';   this._restart(); });
    kb.on('keydown-TWO',   () => { this.difficulty = 'medium'; this._restart(); });
    kb.on('keydown-THREE', () => { this.difficulty = 'hard';   this._restart(); });
    kb.on('keydown-R',     () => this._restart());
    kb.on('keydown-M',     () => this._returnToMenu());
    kb.on('keydown-ESC',   () => {
      if (this.ended) return;
      this.paused = !this.paused;
      this.pauseContainer.setVisible(this.paused);
    });
  }

  _win() {
    this.ended = true;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    this.endTxt.setText('🎉 USCITA TROVATA!').setVisible(true);
    this.endSub.setText(`Mosse: ${this.moves}  Tempo: ${elapsed}s  |  R: rigioca  M: menu`).setVisible(true);
  }

  _restart() {
    this._reset();
    this._drawMaze();
    this._drawPlayer();
    this.endTxt.setVisible(false);
    this.endSub.setVisible(false);
    this.hudTxt.setText(`Mosse: 0  |  Diff: ${this.difficulty}`);
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

  _buildDiffPanel() {
    this.hudTxt.setText(`Mosse: 0  |  Diff: ${this.difficulty}`);
  }

  _returnToMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }

  update() { this._drawPlayer(); }
}
