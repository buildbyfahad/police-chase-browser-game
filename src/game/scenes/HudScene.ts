/**
 * In-game HUD.
 *
 * It runs as its own scene so the crash shake applied to the game camera
 * doesn't rattle the readouts, and everything is drawn on the canvas rather
 * than in the DOM — no layout thrash while driving.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, NITRO_MAX } from '../config/GameConfig';
import { formatScore } from '../systems/ScoreManager';

/** Mutable snapshot the GameScene writes once per frame. */
export interface HudState {
  score: number;
  distanceKm: number;
  coins: number;
  nitro: number;
  nitroActive: boolean;
  shield: boolean;
  magnet: boolean;
  catchProgress: number;
  levelLabel: string;
}

export function createHudState(): HudState {
  return {
    score: 0,
    distanceKm: 0,
    coins: 0,
    nitro: 0,
    nitroActive: false,
    shield: false,
    magnet: false,
    catchProgress: 0,
    levelLabel: '',
  };
}

const NITRO_BAR_W = 148;
const NITRO_BAR_H = 13;

const LABEL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  fontSize: '10px',
  fontStyle: 'bold',
  color: '#8d97c4',
};

const VALUE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  fontSize: '26px',
  fontStyle: 'bold',
  color: '#eef2ff',
};

export class HudScene extends Phaser.Scene {
  private state!: HudState;

  private scoreText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private nitroFill!: Phaser.GameObjects.Rectangle;
  private nitroLabel!: Phaser.GameObjects.Text;
  private shieldBadge!: Phaser.GameObjects.Container;
  private magnetBadge!: Phaser.GameObjects.Container;
  private warning!: Phaser.GameObjects.Text;
  private warningBar!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;

  // Cached last-rendered values so we only touch text objects when they change
  private lastScore = -1;
  private lastDistance = '';
  private lastCoins = -1;
  private lastLevel = '';

  constructor() {
    super({ key: 'hud' });
  }

  init(data: { state: HudState }): void {
    this.state = data.state;
  }

  create(): void {
    // --- Score (top left) ---
    this.add.text(16, 14, 'SCORE', LABEL);
    this.scoreText = this.add.text(16, 26, '0', VALUE);

    // --- Distance (top centre) ---
    this.add.text(186, 14, 'DISTANCE', LABEL);
    this.distanceText = this.add.text(186, 26, '0.0 KM', { ...VALUE, fontSize: '22px' });

    // --- Coins (top right, clear of the pause button) ---
    this.add.image(348, 24, 'tex-coin').setDisplaySize(18, 18);
    this.coinText = this.add.text(362, 14, '0', { ...VALUE, fontSize: '20px', color: '#ffd24a' });

    // --- Difficulty tag (kept left of the pause button, which is a DOM overlay) ---
    this.levelText = this.add.text(186, 52, '', { ...LABEL, fontSize: '9px', color: '#ff8a1f' });

    // --- Nitro meter ---
    this.nitroLabel = this.add.text(16, 66, 'NITRO', { ...LABEL, fontSize: '9px' });
    this.add
      .rectangle(16, 80, NITRO_BAR_W, NITRO_BAR_H, 0x000000, 0.45)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff, 0.18);
    this.nitroFill = this.add
      .rectangle(17, 81, NITRO_BAR_W - 2, NITRO_BAR_H - 2, 0x2f7bff)
      .setOrigin(0, 0);

    this.shieldBadge = this.makeBadge(176, 80, 'tex-pickup-shield', '#5effb0');
    this.magnetBadge = this.makeBadge(222, 80, 'tex-pickup-magnet', '#f6a8ff');

    // --- Pursuit warning ---
    this.warningBar = this.add
      .rectangle(GAME_WIDTH / 2, 112, 200, 5, 0xff3b5c)
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.warning = this.add
      .text(GAME_WIDTH / 2, 90, 'THEY’RE ON YOU!', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ff3b5c',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);

    // --- Level-up banner ---
    this.banner = this.add
      .text(GAME_WIDTH / 2, 190, '', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffc23c',
        stroke: '#1a1004',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);
  }

  private makeBadge(x: number, y: number, texture: string, colour: string): Phaser.GameObjects.Container {
    const icon = this.add.image(0, 0, texture).setDisplaySize(22, 22);
    const dot = this.add.circle(11, -9, 3, Phaser.Display.Color.HexStringToColor(colour).color);
    return this.add.container(x + 11, y + 6, [icon, dot]).setAlpha(0);
  }

  /** Called by the GameScene when the difficulty tier ticks over. */
  announce(label: string): void {
    this.banner.setText(label).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({
      targets: this.banner,
      scale: 1.1,
      alpha: 0,
      duration: 1100,
      ease: 'Back.easeOut',
    });
  }

  update(): void {
    const s = this.state;

    if (s.score !== this.lastScore) {
      this.lastScore = s.score;
      this.scoreText.setText(formatScore(s.score));
    }

    const dist = `${s.distanceKm.toFixed(1)} KM`;
    if (dist !== this.lastDistance) {
      this.lastDistance = dist;
      this.distanceText.setText(dist);
    }

    if (s.coins !== this.lastCoins) {
      this.lastCoins = s.coins;
      this.coinText.setText(String(s.coins));
    }

    if (s.levelLabel !== this.lastLevel) {
      this.lastLevel = s.levelLabel;
      this.levelText.setText(s.levelLabel);
    }

    // Nitro meter
    const pct = Phaser.Math.Clamp(s.nitro / NITRO_MAX, 0, 1);
    this.nitroFill.displayWidth = Math.max(0.001, (NITRO_BAR_W - 2) * pct);
    this.nitroFill.fillColor = s.nitroActive ? 0x8fd0ff : pct < 0.12 ? 0x6a7391 : 0x2f7bff;
    this.nitroLabel.setColor(s.nitroActive ? '#8fd0ff' : '#8d97c4');

    this.shieldBadge.setAlpha(s.shield ? 1 : 0);
    this.magnetBadge.setAlpha(s.magnet ? 1 : 0);

    // Pursuit warning intensifies as the catch timer fills
    if (s.catchProgress > 0.05) {
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(this.time.now * 0.012));
      this.warning.setAlpha(blink);
      this.warningBar.setAlpha(blink).setSize(200 * s.catchProgress, 5);
    } else if (this.warning.alpha !== 0) {
      this.warning.setAlpha(0);
      this.warningBar.setAlpha(0);
    }
  }
}
