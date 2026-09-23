/** A pooled collectible — a coin or one of the three power-ups. */
import Phaser from 'phaser';
import { COIN_SIZE, POWERUP_SIZE, ROAD_CENTER } from '../config/GameConfig';

export type PickupKind = 'coin' | 'nitro' | 'shield' | 'magnet';

const TEXTURES: Record<PickupKind, string> = {
  coin: 'tex-coin',
  nitro: 'tex-pickup-nitro',
  shield: 'tex-pickup-shield',
  magnet: 'tex-pickup-magnet',
};

export class Pickup extends Phaser.GameObjects.Image {
  kind: PickupKind = 'coin';
  radius = COIN_SIZE / 2;
  /** Offset from the road centreline; magnet pull nudges this rather than x
   *  directly, so an attracted coin still travels with the bend. */
  localX = 0;
  /** Phase offset so a row of coins shimmers in a wave rather than in sync. */
  private phase = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'tex-coin');
    this.setOrigin(0.5, 0.5);
    this.setActive(false).setVisible(false);
    scene.add.existing(this);
  }

  spawn(kind: PickupKind, localX: number, y: number): void {
    this.kind = kind;
    this.setTexture(TEXTURES[kind]);
    const size = kind === 'coin' ? COIN_SIZE : POWERUP_SIZE;
    this.setDisplaySize(size, size);
    this.radius = size / 2;
    this.phase = Math.random() * Math.PI * 2;
    this.localX = localX;
    this.setPosition(ROAD_CENTER + localX, y);
    this.setAlpha(1).setScale(this.scaleX, this.scaleY);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  update(scrollSpeed: number, dt: number, time: number, offsetAt: (y: number) => number): void {
    this.y += scrollSpeed * dt;
    this.x = ROAD_CENTER + offsetAt(this.y) + this.localX;
    if (this.kind === 'coin') {
      // Squash the x axis to fake a spinning coin
      const spin = Math.abs(Math.cos(time * 0.004 + this.phase));
      this.displayWidth = COIN_SIZE * (0.28 + spin * 0.72);
    } else {
      this.y += Math.sin(time * 0.006 + this.phase) * 0.35;
      this.setAngle(Math.sin(time * 0.003 + this.phase) * 8);
    }
  }

  /** Magnet pull — drags the coin toward a point at `pull` px/s. */
  attractTo(x: number, y: number, pull: number, dt: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = Math.min(dist, pull * dt);
    this.localX += (dx / dist) * step;
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
  }
}
