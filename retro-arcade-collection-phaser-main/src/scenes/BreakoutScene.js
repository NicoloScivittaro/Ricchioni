import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600, BALL_R = 8;
const PW = 110, PH = 12;
const COLS = 10, ROWS = 5;

const BRICK_COLORS = [0xff5050, 0xffaa00, 0xffe63c, 0x64dc78, 0x50b4ff];

export default class BreakoutScene extends Phaser.Scene {
  constructor() { super({ key: 'BreakoutScene' }); }

  create() {
    this._reset();
    this._buildGraphics();
    this._setupInput();
    this._buildPauseOverlay();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  _reset() {
    const brickW = Math.floor((W - 120) / COLS);
    this.bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.bricks.push({
          x: 60 + c * brickW, y: 80 + r * 22,
          w: brickW - 4, h: 18,
          hp: r < 2 ? 2 : 1, maxHp: r < 2 ? 2 : 1,
          row: r,
        });
      }
    }
    this.px = W/2 - PW/2;
    this.py = H - 40;
    this.bx = W/2; this.by = H/2;
    this.bvx = 4; this.bvy = -5;
    this.score = 0;
    this.lives = 3;
    this.paused = false;
    this.ended = false;
    this.elapsed = 0;
  }

  _buildGraphics() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x14142a); bg.fillRect(0, 0, W, H);

    this.gBricks  = this.add.graphics().setDepth(1);
    this.gGame    = this.add.graphics().setDepth(2);
    this.scoreTxt = this.add.text(10, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#b4f0b4' }).setDepth(10);
    this.livesTxt = this.add.text(W - 10, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ff6464' }).setOrigin(1, 0).setDepth(10);
    this.hintTxt  = this.add.text(W/2, H - 10, 'Mouse/A-D: muovi  |  ESC: pausa  |  M: menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#787890',
    }).setOrigin(0.5).setDepth(10);

    this.endTxt = this.add.text(W/2, H/2 - 30, '', {
      fontFamily: 'monospace', fontSize: '28px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.endSub = this.add.text(W/2, H/2 + 14, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._drawBricks();
    this._redrawHUD();
  }

  _drawBricks() {
    this.gBricks.clear();
    this.bricks.forEach(b => {
      let col = BRICK_COLORS[b.row % BRICK_COLORS.length];
      if (b.maxHp > 1 && b.hp < b.maxHp) {
        const f = 0.5 + 0.5 * (b.hp / b.maxHp);
        const c = Phaser.Display.Color.IntegerToColor(col);
        col = Phaser.Display.Color.GetColor(
          Math.floor(c.red * f), Math.floor(c.green * f), Math.floor(c.blue * f)
        );
      }
      this.gBricks.fillStyle(col);
      this.gBricks.fillRect(b.x, b.y, b.w, b.h);
      this.gBricks.lineStyle(1, 0x000000, 0.3);
      this.gBricks.strokeRect(b.x, b.y, b.w, b.h);
    });
  }

  _redrawHUD() {
    this.scoreTxt.setText(`SCORE: ${this.score}`);
    this.livesTxt.setText(`VITE: ${this.lives}`);
  }

  _setupInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => {
      if (this.ended) return;
      this.paused = !this.paused;
      this.pauseContainer.setVisible(this.paused);
    });
    kb.on('keydown-M', () => this._returnToMenu());
    kb.on('keydown-R', () => {
      this._reset(); this._drawBricks(); this._redrawHUD();
      this.endTxt.setVisible(false); this.endSub.setVisible(false);
    });
  }

  _buildPauseOverlay() {
    this.pauseContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.72); bg.fillRect(0, 0, W, H);
    this.pauseContainer.add([
      bg,
      this.add.text(W/2, H/2 - 50, 'PAUSA', {
        fontFamily: 'monospace', fontSize: '28px', color: '#f0f0f0',
      }).setOrigin(0.5),
      this.add.text(W/2, H/2 + 10, 'ESC: Riprendi\nR: Ricomincia\nM: Menu', {
        fontFamily: 'monospace', fontSize: '15px', color: '#c8c8e0', align: 'center',
      }).setOrigin(0.5),
    ]);
  }

  _returnToMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }

  _endGame(msg) {
    this.ended = true;
    this.endTxt.setText(msg).setVisible(true);
    this.endSub.setText(`Score: ${this.score}  |  R: rigioca  M: menu`).setVisible(true);
  }

  update(time, delta) {
    if (this.paused || this.ended) return;
    const dt = delta / 16.67;
    this.elapsed += delta / 1000;

    // Paddle input
    if (this.keyA.isDown) this.px -= 7 * dt;
    if (this.keyD.isDown) this.px += 7 * dt;
    if (this.input.activePointer.x > 0) {
      this.px = Phaser.Math.Clamp(this.input.activePointer.x - PW/2, 0, W - PW);
    }
    this.px = Phaser.Math.Clamp(this.px, 0, W - PW);

    // Ball movement
    this.bx += this.bvx * dt;
    this.by += this.bvy * dt;

    // Walls
    if (this.bx - BALL_R <= 0 || this.bx + BALL_R >= W) this.bvx *= -1;
    if (this.by - BALL_R <= 0) this.bvy = Math.abs(this.bvy);

    // Paddle collision
    if (this.bx >= this.px && this.bx <= this.px + PW &&
        this.by + BALL_R >= this.py && this.by + BALL_R <= this.py + PH) {
      this.bvy = -Math.abs(this.bvy);
      const offset = (this.bx - (this.px + PW/2)) / (PW/2);
      this.bvx += offset * 2;
    }

    // Brick collisions
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const b = this.bricks[i];
      if (this.bx >= b.x && this.bx <= b.x + b.w &&
          this.by >= b.y && this.by <= b.y + b.h) {
        this.bvy *= -1;
        b.hp--;
        this.score += b.hp <= 0 ? 10 : 5;
        if (b.hp <= 0) this.bricks.splice(i, 1);
        this._drawBricks();
        this._redrawHUD();
        break;
      }
    }

    // Win / lose
    if (!this.bricks.length) { this._endGame('HAI VINTO! 🎉'); return; }
    if (this.by - BALL_R > H) {
      this.lives--;
      this._redrawHUD();
      if (this.lives <= 0) { this._endGame('HAI PERSO!'); return; }
      this.bx = W/2; this.by = H/2; this.bvx = 4; this.bvy = -5;
    }

    // Progressive speed
    const maxSpd = 8, targetSpd = Math.min(maxSpd, 4 + this.elapsed * 0.05);
    const spd = Math.hypot(this.bvx, this.bvy);
    if (spd < targetSpd) { this.bvx *= targetSpd/spd; this.bvy *= targetSpd/spd; }

    // Draw
    this.gGame.clear();
    // Paddle
    this.gGame.fillStyle(0xe0e0e0); this.gGame.fillRect(this.px, this.py, PW, PH);
    // Ball
    this.gGame.fillStyle(0xffffff); this.gGame.fillCircle(this.bx, this.by, BALL_R);
  }
}
