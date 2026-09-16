import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;
const PW = 10, PH = 80, BALL_R = 8, MAX_SPD = 12;

export default class PongScene extends Phaser.Scene {
  constructor() { super({ key: 'PongScene' }); }

  _reset() {
    this.lY = H / 2; this.rY = H / 2;
    this.bx = W / 2; this.by = H / 2;
    const ang = (Math.random() * 0.4 - 0.2);
    this.bvx = (Math.random() < 0.5 ? 1 : -1) * (6 + Math.cos(ang) * 2);
    this.bvy = Math.sin(ang) * 4;
    this.scoreL = 0; this.scoreR = 0;
    this.mode = '2P'; // '1P', '2P', 'AI'
    this.paused = false;
    this.trail = [];
    this.winner = null;
  }

  _buildGraphics() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x14142a); bg.fillRect(0, 0, W, H);

    this.gGame  = this.add.graphics().setDepth(2);
    this.gTrail = this.add.graphics().setDepth(1);

    this.scoreL_txt = this.add.text(W/2 - 60, 20, '0', {
      fontFamily: 'monospace', fontSize: '28px', color: '#b4f0b4',
    }).setOrigin(0.5).setDepth(10);
    this.scoreR_txt = this.add.text(W/2 + 60, 20, '0', {
      fontFamily: 'monospace', fontSize: '28px', color: '#b4f0b4',
    }).setOrigin(0.5).setDepth(10);
    this.modeTxt = this.add.text(10, 10, 'Mode: 2P', {
      fontFamily: 'monospace', fontSize: '12px', color: '#dcdcdc',
    }).setDepth(10);
    this.hintTxt = this.add.text(10, H - 20, 'TAB: cambia modalità  |  SPC: pausa  |  ESC: menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#787890',
    }).setDepth(10);

    this.winTxt = this.add.text(W/2, H/2 - 40, '', {
      fontFamily: 'monospace', fontSize: '26px', color: '#fac864',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.winSub = this.add.text(W/2, H/2 + 10, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  _setupInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-TAB',   () => {
      const modes = ['2P', '1P', 'AI'];
      this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
      this.modeTxt.setText(`Mode: ${this.mode}`);
      if (this.winner) { this.winner = null; this.winTxt.setVisible(false); this.winSub.setVisible(false); this._resetBall(); }
    });
    kb.on('keydown-SPACE', () => {
      if (this.winner) return;
      this.paused = !this.paused;
      this.pauseContainer.setVisible(this.paused);
    });
    kb.on('keydown-ESC', () => this._returnToMenu());
    kb.on('keydown-R',   () => {
      this._reset();
      this.winTxt.setVisible(false); this.winSub.setVisible(false);
      this.modeTxt.setText('Mode: 2P');
    });
  }

  _resetBall() {
    this.bx = W / 2; this.by = H / 2;
    const ang = (Math.random() * 0.4 - 0.2);
    this.bvx = (Math.random() < 0.5 ? 1 : -1) * 6;
    this.bvy = Math.sin(ang) * 4;
    this.trail = [];
  }

  _aiMove(paddleY, difficulty) {
    const spd = [4, 5, 6][difficulty - 1] || 5;
    if (difficulty === 1 && Math.random() < 0.4) return 0;
    if (paddleY + 10 < this.by) return spd;
    if (paddleY - 10 > this.by) return -spd;
    return 0;
  }

  _clampSpeed() {
    const spd = Math.hypot(this.bvx, this.bvy);
    if (spd > MAX_SPD) { this.bvx *= MAX_SPD / spd; this.bvy *= MAX_SPD / spd; }
  }

  _buildPauseOverlay() {
    this.pauseContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.72); bg.fillRect(0, 0, W, H);
    const title = this.add.text(W/2, H/2 - 50, 'PAUSA', {
      fontFamily: 'monospace', fontSize: '28px', color: '#f0f0f0',
    }).setOrigin(0.5);
    const opts = this.add.text(W/2, H/2 + 10,
      'SPC: Riprendi\nR: Ricomincia\nESC: Menu principale', {
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

  create() {
    this._reset();
    this._buildGraphics();
    this._setupInput();
    this._buildPauseOverlay();
    // Pre-create cursor keys and WASD keys for polling
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  }

  update(time, delta) {
    if (this.paused || this.winner) return;
    const dt = delta / 16.67;

    // Player 1 (left paddle)
    if (this.keyW.isDown) this.lY -= 6 * dt;
    if (this.keyS.isDown) this.lY += 6 * dt;
    this.lY = Phaser.Math.Clamp(this.lY, PH/2, H - PH/2);

    // Player 2 / AI (right paddle)
    if (this.mode === '2P') {
      if (this.cursors.up.isDown)   this.rY -= 6 * dt;
      if (this.cursors.down.isDown) this.rY += 6 * dt;
    } else {
      const diff = this.mode === 'AI' ? 3 : 1;
      this.rY += this._aiMove(this.rY, diff) * dt;
    }
    this.rY = Phaser.Math.Clamp(this.rY, PH/2, H - PH/2);

    // Ball
    this.trail.push({ x: this.bx, y: this.by, life: 10 });
    this.trail = this.trail.filter(t => t.life-- > 0);

    this.bx += this.bvx * dt;
    this.by += this.bvy * dt;

    // Top / bottom wall
    if (this.by - BALL_R <= 0)       { this.bvy = Math.abs(this.bvy); }
    if (this.by + BALL_R >= H)        { this.bvy = -Math.abs(this.bvy); }

    // Left paddle collision
    if (this.bx - BALL_R <= 40 && this.by >= this.lY - PH/2 && this.by <= this.lY + PH/2) {
      this.bvx = Math.abs(this.bvx);
      this.bvy += ((this.by - this.lY) / (PH/2)) * 3;
      this._clampSpeed();
    }
    // Right paddle collision
    if (this.bx + BALL_R >= W - 40 && this.by >= this.rY - PH/2 && this.by <= this.rY + PH/2) {
      this.bvx = -Math.abs(this.bvx);
      this.bvy += ((this.by - this.rY) / (PH/2)) * 3;
      this._clampSpeed();
    }

    // Goals
    if (this.bx < 0) { this.scoreR++; this._checkWin(); this._resetBall(); }
    if (this.bx > W) { this.scoreL++; this._checkWin(); this._resetBall(); }

    this.scoreL_txt.setText(String(this.scoreL));
    this.scoreR_txt.setText(String(this.scoreR));

    // Draw
    const g = this.gGame;
    g.clear();

    // Center dashes
    g.lineStyle(2, 0x505064, 0.7);
    for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(W/2, y+8); g.lineTo(W/2, y+16); g.strokePath(); }

    // Paddles
    g.fillStyle(0xf0f0f0);
    g.fillRect(30, this.lY - PH/2, PW, PH);
    g.fillRect(W - 30 - PW, this.rY - PH/2, PW, PH);

    // Trail
    this.gTrail.clear();
    this.trail.forEach(t => {
      this.gTrail.fillStyle(0x787878, t.life / 10 * 0.5);
      this.gTrail.fillCircle(t.x, t.y, BALL_R * 0.7);
    });

    // Ball
    g.fillStyle(0xf0f0f0); g.fillCircle(this.bx, this.by, BALL_R);
  }

  _checkWin() {
    if (this.scoreL >= 11 || this.scoreR >= 11) {
      this.winner = this.scoreL >= 11 ? 'SINISTRA' : 'DESTRA';
      this.winTxt.setText(`PLAYER ${this.winner} VINCE!`).setVisible(true);
      this.winSub.setText(`${this.scoreL} - ${this.scoreR}  |  TAB: rivincita  ESC: menu`).setVisible(true);
    }
  }
}
