import Phaser from '../lib/phaser.esm.min.js';

const W = 800, H = 600;

const TILES = [
  'Tic Tac Toe', 'Snake', 'Tetris',
  'Pong', 'Breakout', 'Space Invaders',
  'Maze Runner', 'Memory Game', 'Puzzle 15'
];

const SCENE_KEYS = [
  'TicTacToeScene', 'SnakeScene', 'TetrisScene',
  'PongScene', 'BreakoutScene', 'SpaceInvadersScene',
  'MazeRunnerScene', 'MemoryGameScene', 'Puzzle15Scene'
];

const COMMANDS = {
  'Tic Tac Toe':    'Click: posiziona X/O  |  T: modalità  |  R: riavvia  |  M/ESC: menu',
  'Snake':          'Frecce/WASD: muovi  |  R: riavvia  |  ESC: pausa  |  M: menu',
  'Tetris':         '←→: muovi  ↑: ruota  SPC: drop  C: hold  |  ESC: pausa  |  M: menu',
  'Pong':           'W/S: P1  ↑↓: P2  |  TAB: 1P/2P/AI  |  SPC: pausa  |  ESC: menu',
  'Breakout':       'Mouse/A-D: paddle  |  ESC: pausa  |  M: menu',
  'Space Invaders': '←→: muovi  SPC: spara  |  ESC: pausa  |  M: menu',
  'Maze Runner':    'Frecce/WASD: muovi  |  1/2/3: difficoltà  |  ESC: pausa  |  M: menu',
  'Memory Game':    'Click: scopri coppia  |  ESC: pausa  |  M: menu',
  'Puzzle 15':      'Click tessera adiacente al vuoto  |  ESC: pausa  |  M: menu',
};

const TILE_W = 200, TILE_H = 120;
const MARGIN_X = 40, MARGIN_Y = 110;
const SPACING_X = 30, SPACING_Y = 22;

const COL_BG      = 0x14142a;
const COL_GRID    = 0x1e1e32;
const COL_NEON_O  = 0x8c32dc;
const COL_NEON_I  = 0x3cc8ff;
const COL_TEXT    = 0xdcdcff;
const COL_HUD     = 0x78f078;

export default class LauncherScene extends Phaser.Scene {
  constructor() { super({ key: 'LauncherScene' }); }

  create() {
    this.selected = 4;
    this.pulse = 0;
    this.state = 'main'; // 'main' | 'credits'
    this.creditsScroll = 0;

    this._buildBackground();
    this._buildScanlines();
    this._buildTiles();
    this._buildUI();
    this._setupInput();

    // Fade in when entering (from game scenes or first launch)
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Called when returning from a game (scene.wake path)
    this.events.on('wake', () => {
      this.state = 'main';
      this._refreshUI();
    });
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  _buildBackground() {
    const g = this.add.graphics();
    g.fillStyle(COL_BG);
    g.fillRect(0, 0, W, H);
    // Grid lines
    g.lineStyle(1, COL_GRID, 1);
    for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.strokePath(); }
    for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
    g.setDepth(0);
  }

  _buildScanlines() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x000000, 0.10);
    for (let y = 0; y < H; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
    g.setDepth(100);
  }

  // ─── Tiles ──────────────────────────────────────────────────────────────────

  _buildTiles() {
    this.tileRects = [];
    this.tileGraphics = [];
    this.tileLabels = [];

    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MARGIN_X + col * (TILE_W + SPACING_X);
      const y = MARGIN_Y + row * (TILE_H + SPACING_Y);
      this.tileRects.push({ x, y, w: TILE_W, h: TILE_H });

      // Tile background + border
      const g = this.add.graphics();
      g.lineStyle(2, 0x1e1e30, 1);
      g.strokeRoundedRect(x, y, TILE_W, TILE_H, 10);
      g.fillStyle(0x0a0a18);
      g.fillRoundedRect(x, y, TILE_W, TILE_H, 10);
      this._drawThumb(g, i, x, y, TILE_W, TILE_H);
      g.setDepth(1);
      this.tileGraphics.push(g);

      // Label
      const lbl = this.add.text(x + 10, y + TILE_H - 20, TILES[i].toUpperCase(), {
        fontFamily: 'monospace', fontSize: '11px', color: '#dcdcff', alpha: 0.85,
      }).setDepth(2);
      this.tileLabels.push(lbl);
    }

    // Selection glow (redrawn each frame via update)
    this.selGlow = this.add.graphics().setDepth(3);
  }

  _drawThumb(g, idx, tx, ty, tw, th) {
    const cx = tx + 8, cy = ty + 8, cw = tw - 16, ch = th - 28;
    switch (idx) {
      case 0: this._thumbTicTacToe(g, cx, cy, cw, ch); break;
      case 1: this._thumbSnake(g, cx, cy, cw, ch); break;
      case 2: this._thumbTetris(g, cx, cy, cw, ch); break;
      case 3: this._thumbPong(g, cx, cy, cw, ch); break;
      case 4: this._thumbBreakout(g, cx, cy, cw, ch); break;
      case 5: this._thumbSpaceInv(g, cx, cy, cw, ch); break;
      case 6: this._thumbMaze(g, cx, cy, cw, ch); break;
      case 7: this._thumbMemory(g, cx, cy, cw, ch); break;
      case 8: this._thumbPuzzle15(g, cx, cy, cw, ch); break;
    }
  }

  _thumbTicTacToe(g, x, y, w, h) {
    const cw = w / 3, ch = h / 3;
    g.lineStyle(2, 0x3264a0, 1);
    for (let i = 1; i < 3; i++) {
      g.beginPath(); g.moveTo(x + i*cw, y); g.lineTo(x + i*cw, y + h); g.strokePath();
      g.beginPath(); g.moveTo(x, y + i*ch); g.lineTo(x + w, y + i*ch); g.strokePath();
    }
    const Xs = [[0,0],[0,2],[2,1]], Os = [[1,0],[1,1],[1,2]];
    Xs.forEach(([r,c]) => {
      const px = x + c*cw + 4, py = y + r*ch + 2;
      g.lineStyle(2, 0xe63232, 1);
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + cw - 8, py + ch - 4); g.strokePath();
      g.beginPath(); g.moveTo(px + cw - 8, py); g.lineTo(px, py + ch - 4); g.strokePath();
    });
    Os.forEach(([r,c]) => {
      g.lineStyle(2, 0x5a8cff, 1);
      g.strokeCircle(x + c*cw + cw/2, y + r*ch + ch/2, Math.min(cw, ch) / 2 - 4);
    });
  }

  _thumbSnake(g, x, y, w, h) {
    const seg = 12;
    for (let i = 0; i < 6; i++) {
      const t = i / 5, bright = Math.floor(200 * (1 - t * 0.6));
      g.fillStyle(Phaser.Display.Color.GetColor(20, bright, 30));
      g.fillRect(x + 10 + i * (seg + 2), y + h/2 - seg/2, seg, seg);
    }
    g.fillStyle(0xdc3232); g.fillCircle(x + w - 16, y + 14, 6);
  }

  _thumbTetris(g, x, y, w, h) {
    const blocks = [
      { col: 0xe02828, bx: 24 }, { col: 0x2878dc, bx: 60 },
      { col: 0xdcc81e, bx: 100 }, { col: 0x3cc850, bx: 140 }
    ];
    blocks.forEach(({ col, bx }, i) => {
      g.fillStyle(col); g.fillRect(x + bx - 24 + i*2, y + 8, 24, 16);
    });
  }

  _thumbPong(g, x, y, w, h) {
    g.fillStyle(0xf0f0f0);
    g.fillRect(x + 10, y + h/2 - 18, 6, 36);
    g.fillRect(x + w - 16, y + h/2 - 18, 6, 36);
    g.fillCircle(x + w/2, y + h/2, 5);
    // Center dashes
    g.lineStyle(1, 0x505064, 0.8);
    for (let dy = 0; dy < h; dy += 8) { g.beginPath(); g.moveTo(x+w/2, y+dy); g.lineTo(x+w/2, y+dy+4); g.strokePath(); }
  }

  _thumbBreakout(g, x, y, w, h) {
    const colors = [0xff5050, 0xffaa00, 0xffe63c, 0x64dc78, 0x50b4ff];
    const cols = 6, bw = Math.floor(w / cols) - 2, bh = 8;
    for (let r = 0; r < 4; r++) for (let c = 0; c < cols; c++) {
      g.fillStyle(colors[r % colors.length]);
      g.fillRect(x + c * (bw + 2), y + r * (bh + 2), bw, bh);
    }
    g.fillStyle(0xf0f0f0); g.fillRect(x + w/2 - 20, y + h - 14, 40, 6);
    g.fillCircle(x + w/2 + 30, y + h - 20, 4);
  }

  _thumbSpaceInv(g, x, y, w, h) {
    // Pixel alien
    const px = 6;
    const pattern = [[0,1,0,1,0],[1,1,1,1,1],[1,0,1,0,1],[1,1,1,1,1]];
    pattern.forEach((row, r) => row.forEach((v, c) => {
      if (v) { g.fillStyle(0xdcdcdc); g.fillRect(x + 20 + c*px*2, y + 8 + r*px*2, px, px); }
    }));
  }

  _thumbMaze(g, x, y, w, h) {
    const wall = 0x1478dc;
    g.fillStyle(wall);
    g.fillRect(x + 8, y + 8, w - 16, 6);
    g.fillRect(x + 8, y + 22, 6, h - 30);
    g.fillRect(x + 30, y + 22, w - 50, 6);
    g.fillRect(x + w - 14, y + 22, 6, h - 30);
    g.fillStyle(0xf0dc46); g.fillCircle(x + 14, y + h - 16, 5);
  }

  _thumbMemory(g, x, y, w, h) {
    const colors = [0xdc3c3c, 0x3c82f0, 0x46c850, 0xf0dc46];
    const size = Math.min(w / 4 - 6, h - 16);
    const startX = x + (w - (size*4 + 3*6)) / 2;
    colors.forEach((col, i) => {
      g.fillStyle(col); g.fillRect(startX + i * (size + 6), y + h/2 - size/2, size, size);
    });
  }

  _thumbPuzzle15(g, x, y, w, h) {
    const cols = 4, tile = Math.floor((w - 12) / cols);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (r === 3 && c === 3) continue;
      g.fillStyle(0x505050);
      g.fillRect(x + c*(tile+3), y + r*(tile+3), tile, tile);
    }
  }

  // ─── Main UI ────────────────────────────────────────────────────────────────

  _buildUI() {
    // Title
    this.titleText = this.add.text(W/2, 38, 'RETRO ARCADE COLLECTION', {
      fontFamily: 'monospace', fontSize: '22px', color: '#32e6ff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.subtitleText = this.add.text(W/2, 66, 'Python → Phaser 4  |  Sir Alfry', {
      fontFamily: 'monospace', fontSize: '12px', color: '#f0f0f0', alpha: 0.75,
    }).setOrigin(0.5).setDepth(10);

    // Footer hint
    this.hintText = this.add.text(W/2, H - 14, 'ENTER/CLICK: Avvia  |  ↑↓←→: Naviga  |  C: Crediti', {
      fontFamily: 'monospace', fontSize: '11px', color: '#b4b4c8',
    }).setOrigin(0.5).setDepth(10);

    // Info panel (commands for selected game)
    this.infoPanel = this.add.graphics().setDepth(9);
    this.infoText  = this.add.text(12, H - 44, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#c8c8e0',
    }).setDepth(10);

    // Credits overlay (hidden initially)
    this.creditsContainer = this.add.container(0, 0).setDepth(200).setVisible(false);
    this._buildCredits();

    this._refreshUI();
  }

  _refreshUI() {
    this._drawInfoPanel();
    this._drawSelectionGlow();
  }

  _drawInfoPanel() {
    const cmd = COMMANDS[TILES[this.selected]] || '';
    this.infoPanel.clear();
    this.infoPanel.fillStyle(0x000000, 0.55);
    this.infoPanel.fillRect(0, H - 52, W, 52);
    this.infoPanel.lineStyle(2, COL_NEON_I, 0.7);
    this.infoPanel.strokeRect(0, H - 52, W, 52);
    this.infoText.setText(TILES[this.selected] + '  —  ' + cmd);
  }

  _drawSelectionGlow() {
    const g = this.selGlow;
    g.clear();
    const { x, y, w, h } = this.tileRects[this.selected];
    const p = (Math.sin(this.pulse) + 1) * 0.5;
    // Outer glow
    g.lineStyle(4, COL_NEON_O, 0.35 + 0.25 * p);
    g.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 14);
    // Inner border
    g.lineStyle(3, COL_NEON_I, 0.85 + 0.15 * p);
    g.strokeRoundedRect(x, y, w, h, 10);
  }

  // ─── Credits ────────────────────────────────────────────────────────────────

  _buildCredits() {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.88);
    bg.fillRect(0, 0, W, H);
    this.creditsContainer.add(bg);

    const lines = [
      { text: 'RETRO ARCADE COLLECTION', size: 22, color: '#fac864' },
      { text: '', size: 12, color: '#ffffff' },
      { text: 'Creato da  Sir Alfry', size: 14, color: '#dcdcff' },
      { text: 'Linguaggi:  Python → Phaser 4 (JavaScript)', size: 13, color: '#c8c8e0' },
      { text: '', size: 12, color: '#ffffff' },
      { text: 'GitHub:      github.com/sirAlfry', size: 13, color: '#3cc8ff' },
      { text: 'Instagram:   @sir_alfry', size: 13, color: '#3cc8ff' },
      { text: 'ArtStation:  siralfry.artstation.com', size: 13, color: '#3cc8ff' },
      { text: '', size: 12, color: '#ffffff' },
      { text: 'GIOCHI', size: 14, color: '#78f078' },
      { text: 'Snake · Tetris · Pong · Breakout', size: 12, color: '#dcdcff' },
      { text: 'Space Invaders · Maze Runner', size: 12, color: '#dcdcff' },
      { text: 'Memory Game · Puzzle 15 · Tic Tac Toe', size: 12, color: '#dcdcff' },
      { text: '', size: 12, color: '#ffffff' },
      { text: 'Licenza MIT', size: 12, color: '#a0a0b8' },
      { text: '', size: 12, color: '#ffffff' },
      { text: 'ESC / C: Chiudi crediti', size: 12, color: '#787890' },
    ];

    this.creditsItems = [];
    let yo = 60;
    lines.forEach(({ text, size, color }) => {
      const t = this.add.text(W / 2, yo, text, {
        fontFamily: 'monospace', fontSize: `${size}px`, color,
      }).setOrigin(0.5);
      this.creditsContainer.add(t);
      this.creditsItems.push(t);
      yo += size + 10;
    });
    this.creditsTotalH = yo;
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  _setupInput() {
    const kb = this.input.keyboard;

    kb.on('keydown-RIGHT', () => {
      if (this.state !== 'main') return;
      this.selected = (this.selected + 1) % 9;
      this._refreshUI();
    });
    kb.on('keydown-LEFT', () => {
      if (this.state !== 'main') return;
      this.selected = (this.selected + 8) % 9;
      this._refreshUI();
    });
    kb.on('keydown-DOWN', () => {
      if (this.state !== 'main') return;
      this.selected = (this.selected + 3) % 9;
      this._refreshUI();
    });
    kb.on('keydown-UP', () => {
      if (this.state !== 'main') return;
      this.selected = (this.selected + 6) % 9;
      this._refreshUI();
    });
    kb.on('keydown-ENTER', () => {
      if (this.state !== 'main') return;
      this._launchGame(this.selected);
    });
    kb.on('keydown-SPACE', () => {
      if (this.state !== 'main') return;
      this._launchGame(this.selected);
    });
    kb.on('keydown-C', () => {
      if (this.state === 'main') {
        this.state = 'credits';
        this.creditsContainer.setVisible(true);
        this.creditsScroll = 0;
      } else if (this.state === 'credits') {
        this.state = 'main';
        this.creditsContainer.setVisible(false);
      }
    });
    kb.on('keydown-ESC', () => {
      if (this.state === 'credits') {
        this.state = 'main';
        this.creditsContainer.setVisible(false);
      }
    });

    // Mouse hover on tiles
    this.input.on('pointermove', (ptr) => {
      if (this.state !== 'main') return;
      this.tileRects.forEach(({ x, y, w, h }, i) => {
        if (ptr.x >= x && ptr.x <= x+w && ptr.y >= y && ptr.y <= y+h) {
          if (this.selected !== i) { this.selected = i; this._refreshUI(); }
        }
      });
    });

    // Mouse click on tiles
    this.input.on('pointerdown', (ptr) => {
      if (this.state !== 'main') return;
      this.tileRects.forEach(({ x, y, w, h }, i) => {
        if (ptr.x >= x && ptr.x <= x+w && ptr.y >= y && ptr.y <= y+h) {
          this._launchGame(i);
        }
      });
    });
  }

  _launchGame(idx) {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS[idx]);
    });
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  update(time, delta) {
    this.pulse += delta * 0.003;
    this._drawSelectionGlow();

    if (this.state === 'credits') {
      this.creditsScroll += delta * 0.025;
      const wrap = this.creditsTotalH + H;
      const offset = this.creditsScroll % wrap;
      this.creditsItems.forEach((t, i) => {
        // Items were placed starting at y=60; scroll them
        const baseY = 60 + i * 24;
        t.setY(baseY - offset + H * 0.1);
      });
    }
  }
}
