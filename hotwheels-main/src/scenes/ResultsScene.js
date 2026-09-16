import Phaser from 'phaser';

/**
 * Results screen — shows race outcome, times, and options.
 */
export class ResultsScene extends Phaser.Scene {

  constructor() {
    super({ key: 'ResultsScene' });
  }

  init(data) {
    this.playerWon = data.playerWon;
    this.playerResults = data.playerResults;
    this.aiResults = data.aiResults;
    this.carKey = data.carKey;
    this.carStats = data.carStats;
    this.difficulty = data.difficulty;
    this.difficultyName = data.difficultyName;
    this.speedClass = data.speedClass;
    this.speedClassName = data.speedClassName;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Result header
    const headerText = this.playerWon ? 'YOU WIN!' : 'YOU LOSE!';
    const headerColor = this.playerWon ? '#ffd700' : '#cc4444';

    this.add.text(width / 2, 50, headerText, {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: headerColor,
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    // Trophy or skull
    const emoji = this.playerWon ? '🏆' : '💀';
    this.add.text(width / 2, 100, emoji, {
      fontSize: '40px'
    }).setOrigin(0.5);

    // Times section
    const sectionY = 160;

    this.add.text(width / 2, sectionY, '── RACE RESULTS ──', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#888888'
    }).setOrigin(0.5);

    // Player times
    this.add.text(width / 2 - 180, sectionY + 40, 'YOUR TIME', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#44cc44'
    });

    const playerTotal = this.playerResults ? this.formatTime(this.playerResults.totalTime) : '--:--';
    this.add.text(width / 2 + 100, sectionY + 40, playerTotal, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff'
    });

    // Player lap times
    if (this.playerResults && this.playerResults.lapTimes) {
      this.playerResults.lapTimes.forEach((lt, i) => {
        const y = sectionY + 65 + i * 22;
        this.add.text(width / 2 - 160, y, `  Lap ${i + 1}:`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#668866'
        });
        this.add.text(width / 2 + 100, y, this.formatTime(lt), {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#aaaaaa'
        });
      });

      // Best lap
      if (this.playerResults.bestLap) {
        const bestY = sectionY + 65 + this.playerResults.lapTimes.length * 22 + 5;
        this.add.text(width / 2 - 160, bestY, '  Best:', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffcc00'
        });
        this.add.text(width / 2 + 100, bestY, this.formatTime(this.playerResults.bestLap), {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffcc00'
        });
      }
    }

    // AI times
    const aiSectionY = sectionY + 160;

    this.add.text(width / 2 - 180, aiSectionY, 'AI TIME', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#cc4444'
    });

    const aiTotal = this.aiResults ? this.formatTime(this.aiResults.totalTime) : '--:--';
    this.add.text(width / 2 + 100, aiSectionY, aiTotal, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff'
    });

    if (this.aiResults && this.aiResults.lapTimes) {
      this.aiResults.lapTimes.forEach((lt, i) => {
        const y = aiSectionY + 25 + i * 22;
        this.add.text(width / 2 - 160, y, `  Lap ${i + 1}:`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#886666'
        });
        this.add.text(width / 2 + 100, y, this.formatTime(lt), {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#aaaaaa'
        });
      });
    }

    // Time difference
    if (this.playerResults && this.aiResults && this.playerResults.totalTime && this.aiResults.totalTime) {
      const diff = Math.abs(this.playerResults.totalTime - this.aiResults.totalTime);
      const ahead = this.playerResults.totalTime < this.aiResults.totalTime;
      const diffText = ahead ? `You won by ${this.formatTime(diff)}` : `AI won by ${this.formatTime(diff)}`;
      const diffColor = ahead ? '#44cc44' : '#cc4444';

      this.add.text(width / 2, aiSectionY + 100, diffText, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: diffColor
      }).setOrigin(0.5);
    }

    // Difficulty label
    this.add.text(width / 2, height - 130, `${this.difficultyName.toUpperCase()}  |  ${this.speedClassName.toUpperCase()}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#666666'
    }).setOrigin(0.5);

    // Buttons
    this.createButton(width / 2 - 100, height - 80, 'RACE AGAIN', () => this.raceAgain());
    this.createButton(width / 2 + 100, height - 80, 'CAR SELECT', () => this.goToCarSelect());

    // Keyboard shortcuts
    this.input.keyboard.on('keydown-R', () => this.raceAgain());
    this.input.keyboard.on('keydown-ESC', () => this.goToCarSelect());
    this.input.keyboard.on('keydown-ENTER', () => this.raceAgain());

    // Hint
    this.add.text(width / 2, height - 30, 'R / ENTER  RACE AGAIN     ESC  CAR SELECT', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#555555'
    }).setOrigin(0.5);
  }

  createButton(x, y, text, onClick) {
    const bg = this.add.graphics();
    bg.fillStyle(0x333355, 0.8);
    bg.fillRoundedRect(x - 80, y - 18, 160, 36, 6);
    bg.lineStyle(2, 0x6666aa);
    bg.strokeRoundedRect(x - 80, y - 18, 160, 36, 6);

    const label = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(x, y, 160, 36, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', onClick);
    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x4444aa, 0.8);
      bg.fillRoundedRect(x - 80, y - 18, 160, 36, 6);
      bg.lineStyle(2, 0x8888ff);
      bg.strokeRoundedRect(x - 80, y - 18, 160, 36, 6);
    });
    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x333355, 0.8);
      bg.fillRoundedRect(x - 80, y - 18, 160, 36, 6);
      bg.lineStyle(2, 0x6666aa);
      bg.strokeRoundedRect(x - 80, y - 18, 160, 36, 6);
    });
  }

  formatTime(ms) {
    if (!ms) return '--:--';
    const totalSec = ms / 1000;
    const minutes = Math.floor(totalSec / 60);
    const seconds = Math.floor(totalSec % 60);
    const millis = Math.floor((totalSec % 1) * 100);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
  }

  raceAgain() {
    this.scene.start('RaceScene', {
      carKey: this.carKey,
      carStats: this.carStats,
      difficulty: this.difficulty,
      difficultyName: this.difficultyName,
      speedClass: this.speedClass,
      speedClassName: this.speedClassName
    });
  }

  goToCarSelect() {
    this.scene.start('CarSelectScene');
  }
}
