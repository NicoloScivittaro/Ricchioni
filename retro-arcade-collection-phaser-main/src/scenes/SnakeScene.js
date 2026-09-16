import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600, GRID = 20;
const SCORES_KEY = 'retro_scores';

function loadScores() { try { return JSON.parse(localStorage.getItem(SCORES_KEY) || '{}'); } catch { return {}; } }
function saveScores(s) { try { localStorage.setItem(SCORES_KEY, JSON.stringify(s)); } catch {} }

export default class SnakeScene extends Phaser.Scene {
  constructor() { super({ key: 'SnakeScene' }); }

  create() {
    this.paused = false;
    this._reset();
    this._buildGraphics();
    this._setupInput();

    // Scroll timer
    this.moveTimer = this.time.addEvent({
      delay: 120, loop: true, callback: this._step, callbackScope: this
    });

    // Pause overlay
    this._buildPauseOverlay();
  }

  _reset() {
    const cx = Math.floor(W / (2 * GRID)) * GRID + GRID / 2;
    const cy = Math.floor(H / (2 * GRID)) * GRID + GRID / 2;
    this.snake = [
      [cx, cy], [cx - GRID, cy], [cx - GRID * 2, cy]
    ];
    this.dir = [GRID, 0];
    this.nextDir = [GRID, 0];
    this.alive = true;
    this.score = 0;
    this.highScore = loadScores()['snake'] || 0;
    this.particles = [];
    this.redFood = this._spawnFood([]);
    this.blueFood = this._spawnFood([this.redFood]);
    this.blueVisible = true;
    this.blueCooldown = 0;
    if (this.moveTimer) this.moveTimer.delay = 120;
  }

  _spawnFood(avoid) {
    const occupiedSet = new Set([
      ...this.snake.map(([x, y]) => `${x},${y}`),
      ...avoid.map(([x, y]) => `${x},${y}`)
    ]);
    let x, y;
    do {
      x = Math.floor(Math.random() * (W / GRID)) * GRID + GRID / 2;
      y = Math.floor(Math.random() * (H / GRID)) * GRID + GRID / 2;
    } while (occupiedSet.has(`${x},${y}`));
    return [x, y];
  }

  _buildGraphics() {
    // Background grid
    const bg = this.add.graphics();
    bg.lineStyle(1, 0x282832, 1);
    for (let x = 0; x < W; x += GRID) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, H); bg.strokePath(); }
    for (let y = 0; y < H; y += GRID) { bg.beginPath(); bg.moveTo(0, y); bg.lineTo(W, y); bg.strokePath(); }
    bg.setDepth(0);

    this.gSnake  = this.add.graphics().setDepth(2);
    this.gFood   = this.add.graphics().setDepth(2);
    this.gParts  = this.add.graphics().setDepth(3);

    // HUD
    this.scoreTxt  = this.add.text(10, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#b4f0b4' }).setDepth(10);
    this.highTxt   = this.add.text(10, 28, '', { fontFamily: 'monospace', fontSize: '14px', color: '#c8c864' }).setDepth(10);
    this.overTxt   = this.add.text(W/2, H/2 - 40, '', {
      fontFamily: 'monospace', fontSize: '24px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.overSub   = this.add.text(W/2, H/2 + 2, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._redrawHUD();
  }

  _redrawHUD() {
    this.scoreTxt.setText(`SCORE: ${this.score}`);
    this.highTxt.setText(`HIGH:  ${this.highScore}`);
  }

  _setupInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT',  () => { if (this.dir[0] !== GRID)  this.nextDir = [-GRID, 0]; });
    kb.on('keydown-RIGHT', () => { if (this.dir[0] !== -GRID) this.nextDir = [GRID,  0]; });
    kb.on('keydown-UP',    () => { if (this.dir[1] !== GRID)  this.nextDir = [0, -GRID]; });
    kb.on('keydown-DOWN',  () => { if (this.dir[1] !== -GRID) this.nextDir = [0,  GRID]; });
    kb.on('keydown-A',     () => { if (this.dir[0] !== GRID)  this.nextDir = [-GRID, 0]; });
    kb.on('keydown-D',     () => { if (this.dir[0] !== -GRID) this.nextDir = [GRID,  0]; });
    kb.on('keydown-W',     () => { if (this.dir[1] !== GRID)  this.nextDir = [0, -GRID]; });
    kb.on('keydown-S',     () => { if (this.dir[1] !== -GRID) this.nextDir = [0,  GRID]; });
    kb.on('keydown-R',     () => { this._reset(); this.overTxt.setVisible(false); this.overSub.setVisible(false); });
    kb.on('keydown-M',     () => this._returnToMenu());
    kb.on('keydown-ESC',   () => {
      if (this.paused) this._resumeGame(); else this._pauseGame();
    });
  }

  _step() {
    if (!this.alive || this.paused) return;
    this.dir = this.nextDir;
    const [hx, hy] = this.snake[0];
    const [dx, dy] = this.dir;
    const nx = hx + dx, ny = hy + dy;

    // Wall collision
    if (nx < GRID/2 || ny < GRID/2 || nx > W - GRID/2 || ny > H - GRID/2) {
      this._die(); return;
    }
    // Self collision
    if (this.snake.some(([sx, sy]) => sx === nx && sy === ny)) {
      this._die(); return;
    }

    this.snake.unshift([nx, ny]);

    let grew = false;
    const now = this.time.now;

    // Red food
    if (Math.abs(nx - this.redFood[0]) < GRID && Math.abs(ny - this.redFood[1]) < GRID) {
      this.score += 2;
      this._addParticles(this.redFood[0], this.redFood[1], 0xdc1414);
      this.redFood = this._spawnFood([this.blueFood]);
      grew = true;
    }
    // Blue food
    else if (this.blueVisible &&
             Math.abs(nx - this.blueFood[0]) < GRID && Math.abs(ny - this.blueFood[1]) < GRID) {
      this.score += 5;
      this._addParticles(this.blueFood[0], this.blueFood[1], 0x3c8cdc);
      this.blueVisible = false;
      this.blueCooldown = now + 5000;
      grew = true;
    }

    if (!grew) this.snake.pop();

    // Respawn blue food
    if (!this.blueVisible && now >= this.blueCooldown) {
      this.blueFood = this._spawnFood([this.redFood]);
      this.blueVisible = true;
    }

    // Speed up
    const newDelay = Math.max(60, 120 - Math.floor(this.score / 5) * 4);
    this.moveTimer.delay = newDelay;

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      const s = loadScores(); s['snake'] = this.highScore; saveScores(s);
    }
    this._redrawHUD();
  }

  _die() {
    this.alive = false;
    const s = loadScores(); s['snake'] = Math.max(s['snake'] || 0, this.score); saveScores(s);
    this.overTxt.setText('GAME OVER').setVisible(true);
    this.overSub.setText(`Score: ${this.score}   High: ${this.highScore}   |   R: riavvia   M: menu`).setVisible(true);
  }

  _addParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      this.particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 20, color });
    }
  }

  // ─── Pause ──────────────────────────────────────────────────────────────────

  _buildPauseOverlay() {
    this.pauseContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75); bg.fillRect(0, 0, W, H);
    const title = this.add.text(W/2, H/2 - 80, 'PAUSA', {
      fontFamily: 'monospace', fontSize: '32px', color: '#f0f0f0',
    }).setOrigin(0.5);
    const opts = this.add.text(W/2, H/2 + 10,
      'ESC: Riprendi\nR: Ricomincia\nM: Menu principale', {
        fontFamily: 'monospace', fontSize: '16px', color: '#c8c8e0', align: 'center',
      }).setOrigin(0.5);
    this.pauseContainer.add([bg, title, opts]);
  }

  _pauseGame() {
    this.paused = true;
    this.pauseContainer.setVisible(true);
  }

  _resumeGame() {
    this.paused = false;
    this.pauseContainer.setVisible(false);
  }

  _returnToMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  update(time, delta) {
    if (!this.alive && !this.paused) return;

    // Draw snake
    this.gSnake.clear();
    this.snake.forEach(([sx, sy], i) => {
      const t = i / Math.max(1, this.snake.length - 1);
      const bright = Math.floor(200 * (1 - t * 0.6));
      const col = i === 0 ? 0x64ff64 : Phaser.Display.Color.GetColor(20, bright, 30);
      this.gSnake.fillStyle(col);
      this.gSnake.fillRect(sx - GRID/2, sy - GRID/2, GRID, GRID);
    });

    // Draw food
    this.gFood.clear();
    this.gFood.fillStyle(0xc81e1e); this.gFood.fillCircle(this.redFood[0], this.redFood[1], GRID/2 - 2);
    if (this.blueVisible) {
      this.gFood.fillStyle(0x328cdc); this.gFood.fillCircle(this.blueFood[0], this.blueFood[1], GRID/2 - 2);
    }

    // Particles
    this.gParts.clear();
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life--;
      const a = p.life / 20;
      this.gParts.fillStyle(p.color, a);
      this.gParts.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
  }
}
