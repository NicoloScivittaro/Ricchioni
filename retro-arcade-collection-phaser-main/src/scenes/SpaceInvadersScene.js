import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;

export default class SpaceInvadersScene extends Phaser.Scene {
  constructor() { super({ key: 'SpaceInvadersScene' }); }

  create() {
    this._reset();
    this._buildGraphics();
    this._setupInput();
    this._buildPauseOverlay();
    this.cursors = this.input.keyboard.createCursorKeys();

    this.enemyTimer    = this.time.addEvent({ delay: 600, loop: true, callback: this._moveEnemies, callbackScope: this });
    this.shootTimer    = this.time.addEvent({ delay: 800, loop: true, callback: this._enemyShoot, callbackScope: this });
  }

  _reset() {
    this.shipX = W / 2;
    this.bullets = [];
    this.enemyBullets = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.paused = false;
    this.ended = false;
    this.enemyDir = 1;
    this.enemies = this._spawnEnemies(4);
    // Reset timer speeds (may have sped up through levels)
    if (this.enemyTimer) this.enemyTimer.delay = 600;
    if (this.shootTimer) this.shootTimer.delay = 800;
  }

  _spawnEnemies(rows) {
    const list = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < 8; c++)
        list.push({ x: 80 + c * 64, y: 50 + r * 48 });
    return list;
  }

  _buildGraphics() {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x000008); bg.fillRect(0, 0, W, H);

    this.gGame  = this.add.graphics().setDepth(2);
    this.hudTxt = this.add.text(10, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#b4f0b4' }).setDepth(10);
    this.hintTxt = this.add.text(W/2, H - 10, '←→: muovi  SPC: spara  |  ESC: pausa  M: menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#787890',
    }).setOrigin(0.5).setDepth(10);

    this.endTxt = this.add.text(W/2, H/2 - 30, '', {
      fontFamily: 'monospace', fontSize: '28px', color: '#f0c850',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.endSub = this.add.text(W/2, H/2 + 14, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dcdcdc',
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  _setupInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => {
      if (this.ended) return;
      this.paused = !this.paused;
      this.pauseContainer.setVisible(this.paused);
    });
    kb.on('keydown-M', () => this._returnToMenu());
    kb.on('keydown-R', () => { this._reset(); this.endTxt.setVisible(false); this.endSub.setVisible(false); });
    kb.on('keydown-SPACE', () => {
      if (this.paused || this.ended) return;
      this.bullets.push({ x: this.shipX, y: H - 76 });
    });
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

  _moveEnemies() {
    if (this.paused || this.ended) return;
    let shift = false;
    this.enemies.forEach(e => {
      e.x += this.enemyDir * 12;
      if (e.x < 20 || e.x > W - 20) shift = true;
    });
    if (shift) {
      this.enemyDir *= -1;
      this.enemies.forEach(e => { e.y += 18; });
      this.enemyTimer.delay = Math.max(200, 600 - this.level * 60);
    }

    // Check if enemies reached player
    if (this.enemies.some(e => e.y >= H - 70)) this._endGame('HAI PERSO!');
  }

  _enemyShoot() {
    if (this.paused || this.ended || !this.enemies.length) return;
    const shooter = this.enemies[Math.floor(Math.random() * this.enemies.length)];
    this.enemyBullets.push({ x: shooter.x, y: shooter.y + 16 });
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
    this.endSub.setText(`Score: ${this.score}  Level: ${this.level}  |  R: rigioca  M: menu`).setVisible(true);
  }

  update(time, delta) {
    if (this.paused || this.ended) return;
    const dt = delta / 16.67;
    // Ship movement
    if (this.cursors.left.isDown)  this.shipX -= 5 * dt;
    if (this.cursors.right.isDown) this.shipX += 5 * dt;
    this.shipX = Phaser.Math.Clamp(this.shipX, 20, W - 20);

    // Move player bullets
    this.bullets = this.bullets.filter(b => {
      b.y -= 10 * dt;
      if (b.y < 0) return false;
      // Hit enemy
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 16) {
          this.enemies.splice(i, 1);
          this.score += 10;
          this.hudTxt.setText(`SCORE: ${this.score}  LEVEL: ${this.level}  VITE: ${this.lives}`);
          return false;
        }
      }
      return true;
    });

    // Move enemy bullets
    this.enemyBullets = this.enemyBullets.filter(eb => {
      eb.y += 7 * dt;
      if (eb.y > H) return false;
      if (Math.abs(eb.x - this.shipX) < 20 && Math.abs(eb.y - (H - 60)) < 16) {
        this.lives--;
        this.hudTxt.setText(`SCORE: ${this.score}  LEVEL: ${this.level}  VITE: ${this.lives}`);
        if (this.lives <= 0) this._endGame('HAI PERSO!');
        return false;
      }
      return true;
    });

    // Next level
    if (!this.enemies.length) {
      this.level++;
      this.enemies = this._spawnEnemies(Math.min(4 + this.level - 1, 7));
      this.enemyDir = 1;
      this.enemyTimer.delay = Math.max(200, 600 - this.level * 60);
    }

    this.hudTxt.setText(`SCORE: ${this.score}  LEVEL: ${this.level}  VITE: ${this.lives}`);

    // Draw
    const g = this.gGame;
    g.clear();

    // Ship (triangle)
    g.fillStyle(0xc8c8ff);
    g.fillTriangle(this.shipX, H - 76, this.shipX - 16, H - 44, this.shipX + 16, H - 44);

    // Enemies
    this.enemies.forEach(e => {
      g.fillStyle(0xdc5050); g.fillRect(e.x - 12, e.y - 8, 24, 16);
      // Antennae
      g.lineStyle(1, 0xff9090, 1);
      g.beginPath(); g.moveTo(e.x - 6, e.y - 8); g.lineTo(e.x - 8, e.y - 14); g.strokePath();
      g.beginPath(); g.moveTo(e.x + 6, e.y - 8); g.lineTo(e.x + 8, e.y - 14); g.strokePath();
    });

    // Player bullets
    this.bullets.forEach(b => { g.fillStyle(0xffff78); g.fillRect(b.x - 2, b.y, 4, 8); });
    // Enemy bullets
    this.enemyBullets.forEach(eb => { g.fillStyle(0xff6464); g.fillRect(eb.x - 2, eb.y, 4, 8); });
  }
}
