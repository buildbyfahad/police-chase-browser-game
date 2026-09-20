/**
 * A pooled traffic/obstacle sprite.
 *
 * Nothing here is ever destroyed during a run: `spawn`/`despawn` flip the
 * active+visible flags so the same handful of objects is recycled for the
 * whole session. That is what keeps long runs allocation-free.
 */
import Phaser from 'phaser';
import type { TrafficKind } from '../config/GameConfig';

export type ObstacleKind = 'cone' | 'oil';

export class Vehicle extends Phaser.GameObjects.Image {
  /** Fraction of the player's base speed this vehicle travels at. */
  speedFactor = 0.6;
  /** Collision box, kept slightly inside the art so contacts feel fair. */
  hitW = 40;
  hitH = 80;
  lane = 0;
  /** Set once the player has drawn level, so a near miss only scores once. */
  scoredNearMiss = false;
  /** Obstacles are static hazards rather than moving traffic. */
  isObstacle = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'tex-car-blue');
    this.setOrigin(0.5, 0.5);
    this.setActive(false).setVisible(false);
    scene.add.existing(this);
  }

  spawnTraffic(kind: TrafficKind, x: number, y: number, lane: number, speedFactor: number): void {
    this.setTexture(`tex-${kind.key}`);
    this.setDisplaySize(kind.width * 1.12, kind.height * 1.1);
    this.hitW = kind.width * 0.86;
    this.hitH = kind.height * 0.9;
    this.isObstacle = false;
    this.speedFactor = speedFactor;
    this.reset(x, y, lane);
  }

  spawnObstacle(kind: ObstacleKind, x: number, y: number, lane: number): void {
    if (kind === 'cone') {
      this.setTexture('tex-cone');
      this.setDisplaySize(30, 30);
      this.hitW = 20;
      this.hitH = 20;
    } else {
      this.setTexture('tex-oil');
      this.setDisplaySize(66, 44);
      this.hitW = 56;
      this.hitH = 34;
    }
    this.isObstacle = true;
    this.speedFactor = 0;
    this.reset(x, y, lane);
  }

  private reset(x: number, y: number, lane: number): void {
    this.lane = lane;
    this.scoredNearMiss = false;
    this.setPosition(x, y);
    this.setAngle(0);
    this.setAlpha(1);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /**
   * `closingSpeed` is how fast the world is moving past this vehicle, i.e.
   * playerSpeed - ownSpeed. Positive means the player is gaining on it.
   */
  advance(closingSpeed: number, dt: number): void {
    this.y += closingSpeed * dt;
  }
}
