/**
 * Visual feedback: particles, speed lines, floating score pops and shakes.
 *
 * Every emitter is created once and reused; floating text comes from a small
 * fixed pool. Nothing here allocates during play.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MAX_SPEED, ROAD_LEFT, ROAD_WIDTH } from '../config/GameConfig';

const POP_POOL = 8;

export class EffectsManager {
  private readonly scene: Phaser.Scene;
  private readonly crash: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly nitro: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly speedLines: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly pops: Phaser.GameObjects.Text[] = [];
  private popIndex = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.speedLines = scene.add.particles(0, 0, 'tex-spark', {
      x: { min: ROAD_LEFT + 10, max: ROAD_LEFT + ROAD_WIDTH - 10 },
      y: -20,
      lifespan: 500,
      speedY: { min: 900, max: 1500 },
      scaleX: 0.12,
      scaleY: { min: 1.6, max: 4.2 },
      alpha: { start: 0.42, end: 0 },
      quantity: 1,
      frequency: 60,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(26);

    this.nitro = scene.add.particles(0, 0, 'tex-glow-blue', {
      lifespan: 380,
      speedY: { min: 220, max: 480 },
      speedX: { min: -50, max: 50 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.85, end: 0 },
      quantity: 2,
      frequency: 22,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(29);

    this.sparkle = scene.add.particles(0, 0, 'tex-spark', {
      lifespan: 420,
      speed: { min: 60, max: 190 },
      scale: { start: 0.42, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe066, 0xfff6c9, 0xffb020],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(40);

    this.crash = scene.add.particles(0, 0, 'tex-spark', {
      lifespan: { min: 400, max: 900 },
      speed: { min: 120, max: 420 },
      gravityY: 380,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff8a1f, 0xffd24a, 0xff3b3b, 0x9aa3bb],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(45);

    this.flash = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
      .setAlpha(0)
      .setDepth(50);

    for (let i = 0; i < POP_POOL; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#ffe066',
          stroke: '#1a1004',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(46)
        .setAlpha(0);
      this.pops.push(text);
    }
  }

  reset(): void {
    this.crash.stop();
    this.sparkle.stop();
    this.nitro.stop();
    this.speedLines.stop();
    this.flash.setAlpha(0);
    for (const pop of this.pops) {
      this.scene.tweens.killTweensOf(pop);
      pop.setAlpha(0);
    }
  }

  /** Ties the nitro plume and speed streaks to how fast the player is going. */
  updateAmbient(speed: number, nitroActive: boolean, x: number, y: number): void {
    this.nitro.setPosition(x, y + 52);
    if (nitroActive !== this.nitro.emitting) {
      if (nitroActive) this.nitro.start();
      else this.nitro.stop();
    }

    const intensity = Phaser.Math.Clamp((speed - PLAYER_MAX_SPEED * 0.72) / (PLAYER_MAX_SPEED * 0.6), 0, 1);
    if (intensity <= 0.02) {
      if (this.speedLines.emitting) this.speedLines.stop();
    } else {
      this.speedLines.frequency = 70 - intensity * 56;
      if (!this.speedLines.emitting) this.speedLines.start();
    }
  }

  coinBurst(x: number, y: number): void {
    this.sparkle.emitParticleAt(x, y, 7);
  }

  powerUpBurst(x: number, y: number, tint: number): void {
    this.sparkle.setParticleTint(tint);
    this.sparkle.emitParticleAt(x, y, 16);
    this.sparkle.setParticleTint([0xffe066, 0xfff6c9, 0xffb020]);
  }

  crashBurst(x: number, y: number): void {
    this.crash.emitParticleAt(x, y, 34);
    this.scene.cameras.main.shake(320, 0.016);
    this.flash.setAlpha(0.55);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
  }

  nitroKick(): void {
    this.scene.cameras.main.shake(180, 0.004);
  }

  /** Small rising label, e.g. "+25" or "NEAR MISS". */
  pop(x: number, y: number, label: string, colour = '#ffe066'): void {
    const text = this.pops[this.popIndex];
    this.popIndex = (this.popIndex + 1) % POP_POOL;

    this.scene.tweens.killTweensOf(text);
    text.setText(label).setColor(colour).setPosition(x, y).setAlpha(1).setScale(0.7);
    this.scene.tweens.add({
      targets: text,
      y: y - 52,
      alpha: 0,
      scale: 1.05,
      duration: 700,
      ease: 'Quad.easeOut',
    });
  }

  destroy(): void {
    this.crash.destroy();
    this.sparkle.destroy();
    this.nitro.destroy();
    this.speedLines.destroy();
    this.flash.destroy();
    for (const pop of this.pops) pop.destroy();
    this.pops.length = 0;
  }
}
