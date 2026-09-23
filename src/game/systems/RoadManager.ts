/**
 * The endless highway.
 *
 * Two tiled surfaces (roadside scenery and asphalt) scroll by offsetting their
 * tile position, so the road repeats forever at a fixed, tiny draw cost — no
 * spawning or recycling of scenery objects at all.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD_LEFT, ROAD_WIDTH } from '../config/GameConfig';
import { TEX_SCALE } from '../utils/Textures';

export class RoadManager {
  private readonly ground: Phaser.GameObjects.TileSprite;
  private readonly road: Phaser.GameObjects.TileSprite;
  private readonly vignette: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.ground = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'tex-ground')
      .setOrigin(0, 0)
      .setTileScale(1 / TEX_SCALE, 1 / TEX_SCALE)
      .setDepth(0);

    this.road = scene.add
      .tileSprite(ROAD_LEFT, 0, ROAD_WIDTH, GAME_HEIGHT, 'tex-road')
      .setOrigin(0, 0)
      .setTileScale(1 / TEX_SCALE, 1 / TEX_SCALE)
      .setDepth(1);

    // Soft darkening toward the top sells the sense of distance
    this.vignette = scene.add
      .image(GAME_WIDTH / 2, 0, 'tex-glow')
      .setDisplaySize(GAME_WIDTH * 2.2, 420)
      .setTint(0x05070f)
      .setAlpha(0.55)
      .setDepth(2);
  }

  reset(): void {
    this.road.tilePositionY = 0;
    this.ground.tilePositionY = 0;
  }

  /** @param speed world scroll speed in px/s */
  update(speed: number, dt: number): void {
    const move = speed * dt * TEX_SCALE;
    this.road.tilePositionY -= move;
    // The verge drifts fractionally slower, which reads as parallax depth
    this.ground.tilePositionY -= move * 0.92;
  }

  destroy(): void {
    this.road.destroy();
    this.ground.destroy();
    this.vignette.destroy();
  }
}
