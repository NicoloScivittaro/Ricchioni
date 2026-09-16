import Phaser from 'phaser';
import { CAR_STATS, CAR_KEYS, DIFFICULTY, SPEED_CLASS, SPEED_CLASS_KEYS } from '../data/carStats.js';
import { SoundManager } from '../audio/SoundManager.js';

/**
 * Car selection screen — side-by-side layout with stats.
 * Flow: Car Select → Difficulty → Speed Class → Race
 */
export class CarSelectScene extends Phaser.Scene {

  constructor() {
    super({ key: 'CarSelectScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.soundManager = new SoundManager(this);
    this.soundManager.init();

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title
    this.add.text(width / 2, 40, 'SELECT YOUR RIDE', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // State
    this.selectedCarIndex = 1;
    this.currentOverlay = null; // null | 'difficulty' | 'speedClass'
    this.selectedDifficulty = null;

    // Car cards
    this.carCards = [];
    const cardWidth = 200;
    const spacing = 30;
    const totalWidth = CAR_KEYS.length * cardWidth + (CAR_KEYS.length - 1) * spacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;

    CAR_KEYS.forEach((key, i) => {
      const stats = CAR_STATS[key];
      const cx = startX + i * (cardWidth + spacing);
      const cy = 240;
      const card = this.createCarCard(cx, cy, key, stats, i);
      this.carCards.push(card);
    });

    // Navigation hint
    this.add.text(width / 2, 440, '← →  SELECT     ENTER  CONFIRM', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#666666'
    }).setOrigin(0.5);

    // Keyboard controls
    this.input.keyboard.on('keydown-LEFT', () => this.navigate(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.navigate(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-ESC', () => this.goBack());

    this.updateSelection();
  }

  createCarCard(cx, cy, carKey, stats, index) {
    const container = this.add.container(cx, cy);

    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 0.8);
    bg.fillRoundedRect(-90, -120, 180, 300, 8);
    container.add(bg);

    const carSprite = this.add.image(0, -60, `car_${carKey}`);
    carSprite.setScale(3);
    container.add(carSprite);

    const name = this.add.text(0, 0, stats.name, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    container.add(name);

    const statNames = ['SPD', 'ACC', 'HND'];
    const statValues = [stats.speed, stats.acceleration, stats.handling];
    const statColors = [0xff4444, 0x44ff44, 0x4444ff];

    statNames.forEach((statName, si) => {
      const sy = 30 + si * 28;
      const label = this.add.text(-70, sy, statName, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#aaaaaa'
      });
      container.add(label);

      const barBg = this.add.graphics();
      barBg.fillStyle(0x333333);
      barBg.fillRect(-30, sy + 2, 100, 12);
      container.add(barBg);

      const barFill = this.add.graphics();
      barFill.fillStyle(statColors[si]);
      barFill.fillRect(-30, sy + 2, (statValues[si] / 5) * 100, 12);
      container.add(barFill);
    });

    if (carKey === 'topHatCar') {
      const bonus = this.add.text(0, 118, '★ WIDE PICKUP', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffcc00'
      }).setOrigin(0.5);
      container.add(bonus);
    }

    const desc = this.add.text(0, 138, stats.description, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#888888',
      wordWrap: { width: 160 },
      align: 'center'
    }).setOrigin(0.5);
    container.add(desc);

    const border = this.add.graphics();
    container.add(border);

    const hitArea = this.add.rectangle(0, 30, 180, 300, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      if (this.selectedCarIndex === index && !this.currentOverlay) {
        this.confirm();
      } else if (!this.currentOverlay) {
        this.selectedCarIndex = index;
        this.updateSelection();
        this.soundManager.play('select');
      }
    });
    container.add(hitArea);

    return { container, border, bg };
  }

  navigate(dir) {
    if (this.currentOverlay) return;
    this.selectedCarIndex = (this.selectedCarIndex + dir + CAR_KEYS.length) % CAR_KEYS.length;
    this.updateSelection();
    this.soundManager.play('select');
  }

  updateSelection() {
    this.carCards.forEach((card, i) => {
      card.border.clear();
      if (i === this.selectedCarIndex) {
        card.border.lineStyle(3, 0xffcc00);
        card.border.strokeRoundedRect(-92, -122, 184, 304, 8);
        card.container.setScale(1.05);
      } else {
        card.container.setScale(0.95);
        card.container.setAlpha(0.6);
      }
    });
    this.carCards[this.selectedCarIndex].container.setAlpha(1);
  }

  confirm() {
    if (!this.currentOverlay) {
      this.showDifficultySelect();
    }
  }

  goBack() {
    if (this.currentOverlay === 'speedClass') {
      this.hideSpeedClassSelect();
      this.showDifficultySelect();
    } else if (this.currentOverlay === 'difficulty') {
      this.hideDifficultySelect();
    }
  }

  // ── Difficulty Select ──

  showDifficultySelect() {
    this.currentOverlay = 'difficulty';
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.diffOverlay = this.add.graphics();
    this.diffOverlay.fillStyle(0x000000, 0.7);
    this.diffOverlay.fillRect(0, 0, width, height);

    this.diffContainer = this.add.container(width / 2, height / 2);

    const title = this.add.text(0, -80, 'SELECT DIFFICULTY', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.diffContainer.add(title);

    const difficulties = ['easy', 'medium', 'hard'];
    const diffColors = { easy: 0x44cc44, medium: 0xcccc44, hard: 0xcc4444 };
    const diffDescs = {
      easy: 'Relaxed race. AI takes it easy.',
      medium: 'Fair challenge. Good racing.',
      hard: 'Intense! AI is ruthless.'
    };

    difficulties.forEach((diff, i) => {
      const by = -20 + i * 55;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(diffColors[diff], 0.3);
      btnBg.fillRoundedRect(-120, by - 18, 240, 44, 6);
      btnBg.lineStyle(2, diffColors[diff]);
      btnBg.strokeRoundedRect(-120, by - 18, 240, 44, 6);
      this.diffContainer.add(btnBg);

      const label = this.add.text(0, by, DIFFICULTY[diff].name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      this.diffContainer.add(label);

      const desc = this.add.text(0, by + 14, diffDescs[diff], {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
      this.diffContainer.add(desc);

      const hitArea = this.add.rectangle(0, by, 240, 44, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.selectDifficulty(diff));
      this.diffContainer.add(hitArea);
    });

    const hint = this.add.text(0, 130, '1  EASY     2  MEDIUM     3  HARD     ESC  BACK', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#666666'
    }).setOrigin(0.5);
    this.diffContainer.add(hint);

    this.diffKeyOne = () => this.selectDifficulty('easy');
    this.diffKeyTwo = () => this.selectDifficulty('medium');
    this.diffKeyThree = () => this.selectDifficulty('hard');
    this.input.keyboard.on('keydown-ONE', this.diffKeyOne);
    this.input.keyboard.on('keydown-TWO', this.diffKeyTwo);
    this.input.keyboard.on('keydown-THREE', this.diffKeyThree);
  }

  selectDifficulty(diff) {
    this.selectedDifficulty = diff;
    this.soundManager.play('select');
    this.hideDifficultySelect();
    this.showSpeedClassSelect();
  }

  hideDifficultySelect() {
    this.input.keyboard.off('keydown-ONE', this.diffKeyOne);
    this.input.keyboard.off('keydown-TWO', this.diffKeyTwo);
    this.input.keyboard.off('keydown-THREE', this.diffKeyThree);
    if (this.diffOverlay) { this.diffOverlay.destroy(); this.diffOverlay = null; }
    if (this.diffContainer) { this.diffContainer.destroy(); this.diffContainer = null; }
    if (!this.currentOverlay || this.currentOverlay === 'difficulty') {
      this.currentOverlay = null;
    }
  }

  // ── Speed Class Select ──

  showSpeedClassSelect() {
    this.currentOverlay = 'speedClass';
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.speedOverlay = this.add.graphics();
    this.speedOverlay.fillStyle(0x000000, 0.7);
    this.speedOverlay.fillRect(0, 0, width, height);

    this.speedContainer = this.add.container(width / 2, height / 2);

    const title = this.add.text(0, -100, 'SELECT SPEED CLASS', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.speedContainer.add(title);

    const classColors = {
      '50cc': 0x44cc44,
      '100cc': 0x44aaff,
      '150cc': 0xcccc44,
      '300cc': 0xff4444
    };
    const classDescs = {
      '50cc': 'Cruising speed. Learn the track.',
      '100cc': 'Getting faster. A solid pace.',
      '150cc': 'Full speed. The real deal.',
      '300cc': 'INSANE. Triple max speed!'
    };

    SPEED_CLASS_KEYS.forEach((key, i) => {
      const by = -50 + i * 55;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(classColors[key], 0.3);
      btnBg.fillRoundedRect(-120, by - 18, 240, 44, 6);
      btnBg.lineStyle(2, classColors[key]);
      btnBg.strokeRoundedRect(-120, by - 18, 240, 44, 6);
      this.speedContainer.add(btnBg);

      const label = this.add.text(0, by, key.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      this.speedContainer.add(label);

      const desc = this.add.text(0, by + 14, classDescs[key], {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
      this.speedContainer.add(desc);

      const hitArea = this.add.rectangle(0, by, 240, 44, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.selectSpeedClass(key));
      this.speedContainer.add(hitArea);
    });

    const hint = this.add.text(0, 150, '1  50cc   2  100cc   3  150cc   4  300cc   ESC  BACK', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#666666'
    }).setOrigin(0.5);
    this.speedContainer.add(hint);

    this.speedKeyOne = () => this.selectSpeedClass('50cc');
    this.speedKeyTwo = () => this.selectSpeedClass('100cc');
    this.speedKeyThree = () => this.selectSpeedClass('150cc');
    this.speedKeyFour = () => this.selectSpeedClass('300cc');
    this.input.keyboard.on('keydown-ONE', this.speedKeyOne);
    this.input.keyboard.on('keydown-TWO', this.speedKeyTwo);
    this.input.keyboard.on('keydown-THREE', this.speedKeyThree);
    this.input.keyboard.on('keydown-FOUR', this.speedKeyFour);
  }

  selectSpeedClass(key) {
    this.soundManager.play('select');
    this.startRace(this.selectedDifficulty, key);
  }

  hideSpeedClassSelect() {
    this.input.keyboard.off('keydown-ONE', this.speedKeyOne);
    this.input.keyboard.off('keydown-TWO', this.speedKeyTwo);
    this.input.keyboard.off('keydown-THREE', this.speedKeyThree);
    this.input.keyboard.off('keydown-FOUR', this.speedKeyFour);
    if (this.speedOverlay) { this.speedOverlay.destroy(); this.speedOverlay = null; }
    if (this.speedContainer) { this.speedContainer.destroy(); this.speedContainer = null; }
    this.currentOverlay = null;
  }

  // ── Start Race ──

  startRace(difficulty, speedClass) {
    const selectedCar = CAR_KEYS[this.selectedCarIndex];
    this.soundManager.destroy();

    this.scene.start('RaceScene', {
      carKey: selectedCar,
      carStats: CAR_STATS[selectedCar],
      difficulty: DIFFICULTY[difficulty],
      difficultyName: difficulty,
      speedClass: SPEED_CLASS[speedClass],
      speedClassName: speedClass
    });
  }
}
