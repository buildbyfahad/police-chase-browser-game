/**
 * The living backdrop behind the landing screen.
 *
 * Rather than ship a trailer video, the menu sits over the game actually
 * running: real road, real bends, real traffic, a car driving itself and a
 * cruiser on its tail. It reuses the same managers as play, so it can never
 * drift out of step with what the game looks like.
 *
 * Deliberately has no collisions, no scoring and no failure — it is scenery.
 */
import Phaser from 'phaser';
import {
  DIFFICULTY_TIERS,
  GAME_HEIGHT,
  PLAYER_LIMIT_X,
  PLAYER_Y,
  ROAD_CENTER,
} from '../config/GameConfig';
import { RoadManager } from '../systems/RoadManager';
import { TrafficManager } from '../systems/TrafficManager';
import { Garage } from '../systems/GarageManager';

const CRUISE_SPEED = 430;
/** How far ahead the autopilot looks when choosing a lane. */
const LOOKAHEAD = 460;

export class AttractScene extends Phaser.Scene {
  private road!: RoadManager;
  private traffic!: TrafficManager;
  private car!: Phaser.GameObjects.Image;
  private cop!: Phaser.GameObjects.Container;
  private copLights!: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private targetLocalX = 0;
  private localX = 0;
  private flash = 0;

  constructor() {
    super({ key: 'attract' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070912');

    this.road = new RoadManager(this);
    this.traffic = new TrafficManager(this);
    this.traffic.reset();
    this.road.reset();

    this.car = this.add
      .image(ROAD_CENTER, PLAYER_Y + 40, `tex-car-${Garage.selectedId()}`)
      .setDisplaySize(52, 96)
      .setDepth(30);

    const art = this.add.image(0, 0, 'tex-police').setDisplaySize(50, 98);
    const red = this.add.image(-11, -10, 'tex-glow-red').setDisplaySize(46, 46);
    const blue = this.add.image(11, -10, 'tex-glow-blue').setDisplaySize(46, 46);
    this.cop = this.add.container(ROAD_CENTER + 40, GAME_HEIGHT - 60, [art, red, blue]).setDepth(28);
    this.copLights = [red, blue];

    // Only a light wash here — the menu's own gradient does most of the work,
    // and burying the gameplay defeats the point of running it live.
    this.add
      .rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0x05070f)
      .setOrigin(0)
      .setAlpha(0.18)
      .setDepth(60);

    this.events.once('shutdown', () => {
      this.road.destroy();
      this.traffic.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    const tier = DIFFICULTY_TIERS[1];

    this.road.update(CRUISE_SPEED, dt);
    this.traffic.update(dt, CRUISE_SPEED, tier, (y) => this.road.offsetAt(y));

    this.steer(dt);
    this.updateCop(dt);
  }

  /** Picks the roomiest line ahead and eases toward it. */
  private steer(dt: number): void {
    let best = { localX: this.localX, clear: -1 };
    for (let lx = -PLAYER_LIMIT_X; lx <= PLAYER_LIMIT_X; lx += 12) {
      let clear = LOOKAHEAD;
      this.traffic.forEachActive((v) => {
        if (v.y > this.car.y || v.y < this.car.y - LOOKAHEAD) return;
        if (Math.abs(v.localX - lx) < (v.hitW + 52) / 2) clear = Math.min(clear, this.car.y - v.y);
      });
      // Prefer a roomy line, but don't weave for the sake of it
      const score = clear - Math.abs(lx - this.localX) * 0.25;
      if (score > best.clear) best = { localX: lx, clear: score };
    }
    this.targetLocalX = best.localX;

    this.localX = Phaser.Math.Linear(this.localX, this.targetLocalX, Math.min(1, dt * 2.2));
    const prevX = this.car.x;
    this.car.x = ROAD_CENTER + this.road.offsetAt(this.car.y) + this.localX;
    this.car.setAngle(Phaser.Math.Clamp((this.car.x - prevX) / dt / 60, -10, 10));
  }

  private updateCop(dt: number): void {
    this.flash += dt;
    const phase = Math.floor(this.flash * 7) % 2 === 0;
    this.copLights[0].setAlpha(phase ? 0.95 : 0.12);
    this.copLights[1].setAlpha(phase ? 0.12 : 0.95);

    // Hangs a little behind and weaves gently, as if working for it
    const target = this.car.x + Math.sin(this.flash * 0.8) * 46;
    this.cop.x = Phaser.Math.Linear(this.cop.x, target, Math.min(1, dt * 1.6));
    this.cop.y = PLAYER_Y + 120 + Math.sin(this.flash * 0.5) * 34;
  }
}
