/**
 * The endless highway.
 *
 * Two tiled surfaces (roadside scenery and asphalt) scroll by offsetting their
 * tile position, so the road repeats forever at a fixed, tiny draw cost — no
 * spawning or recycling of scenery objects at all.
 */
import Phaser from 'phaser';
import {
  CURVE_MAX,
  CURVE_WAVE_A,
  CURVE_WAVE_B,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_Y,
  PX_PER_METRE,
  ROAD_CENTER,
  ROAD_WIDTH,
} from '../config/GameConfig';
import { TEX_SCALE } from '../utils/Textures';

export class RoadManager {
  private readonly ground: Phaser.GameObjects.TileSprite;
  private readonly road: Phaser.GameObjects.TileSprite;
  private readonly vignette: Phaser.GameObjects.Image;

  /** Metres travelled, which is what the bend pattern is a function of. */
  private travelled = 0;
  /** Current lateral offset of the road centreline, in px. */
  private offsetX = 0;
  /** Rate of change of that offset — how hard the current bend is. */
  private offsetRate = 0;
  /**
   * The ground sprite is far wider than the screen so it can rotate without
   * exposing an edge, which pushes its left edge off-screen and throws the
   * repeating verge pattern out of phase. This shifts it back so the texture
   * still lines up with screen x = 0.
   */
  private readonly groundPhaseX: number;

  constructor(scene: Phaser.Scene) {
    // Both surfaces are heavily oversized and pivot on the player, so they can
    // be rotated into a bend without ever exposing an edge.
    this.ground = scene.add
      .tileSprite(GAME_WIDTH / 2, PLAYER_Y, GAME_WIDTH * 2.2, GAME_HEIGHT * 2.6, 'tex-ground')
      .setOrigin(0.5, 0.5)
      .setTileScale(1 / TEX_SCALE, 1 / TEX_SCALE)
      .setDepth(0);

    this.groundPhaseX = -((GAME_WIDTH * 2.2) / 2 - GAME_WIDTH / 2) * TEX_SCALE;
    this.ground.tilePositionX = this.groundPhaseX;

    this.road = scene.add
      .tileSprite(ROAD_CENTER, PLAYER_Y, ROAD_WIDTH, GAME_HEIGHT * 2.6, 'tex-road')
      .setOrigin(0.5, 0.5)
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
    this.travelled = 0;
    this.offsetX = 0;
    this.offsetRate = 0;
    this.road.x = ROAD_CENTER;
    this.road.rotation = 0;
    this.ground.rotation = 0;
    this.ground.tilePositionX = this.groundPhaseX;
  }

  /**
   * Two out-of-phase sine waves against distance travelled: long sweepers
   * with an occasional tighter kink, and never the same bend twice in the
   * same place. Deterministic, so nothing has to be stored or streamed.
   */
  private curveAt(metres: number): number {
    const a = Math.sin((metres / CURVE_WAVE_A) * Math.PI * 2);
    const b = Math.sin((metres / CURVE_WAVE_B) * Math.PI * 2 + 1.7);
    return (a * 0.68 + b * 0.32) * CURVE_MAX;
  }

  /** @param speed world scroll speed in px/s */
  update(speed: number, dt: number): void {
    const move = speed * dt * TEX_SCALE;
    this.road.tilePositionY -= move;
    // The verge drifts fractionally slower, which reads as parallax depth
    this.ground.tilePositionY -= move * 0.92;

    this.travelled += (speed * dt) / PX_PER_METRE;
    const next = this.curveAt(this.travelled);
    this.offsetRate = dt > 0 ? (next - this.offsetX) / dt : 0;
    this.offsetX = next;

    // Lean both surfaces into the local gradient of the bend. Rotating about
    // the player means the road ahead swings away while the tarmac under the
    // car stays put — which is what reads as a corner rather than a slide.
    const gradient = (this.offsetAt(PLAYER_Y - 200) - this.offsetX) / 200;
    const lean = Math.atan(-gradient);
    this.road.x = ROAD_CENTER + this.offsetX;
    this.road.rotation = lean;
    this.ground.rotation = lean;
    this.ground.tilePositionX = this.groundPhaseX - this.offsetX * TEX_SCALE * 0.92;
  }

  /**
   * Lateral offset of the road centreline at a given screen y. Things higher
   * up the screen are further down the road, so they sit at that part of the
   * bend — which is what turns a sideways slide into a real curve.
   */
  offsetAt(y: number): number {
    return this.curveAt(this.travelled + (PLAYER_Y - y) / PX_PER_METRE);
  }

  /** Lateral offset at the player's own position. */
  get offset(): number {
    return this.offsetX;
  }

  /** px/s the road is sweeping sideways — drives the drift on the car. */
  get curveRate(): number {
    return this.offsetRate;
  }

  destroy(): void {
    this.road.destroy();
    this.ground.destroy();
    this.vignette.destroy();
  }
}
