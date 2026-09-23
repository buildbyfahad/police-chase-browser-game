/**
 * A pursuing police car.
 *
 * Vertical motion is relative: the cruiser closes the gap when its own speed
 * beats the player's and drops back when it doesn't, so outrunning the law is
 * always a straight consequence of how fast you are willing to drive.
 */
import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_Y,
  POLICE_ENGAGE_DIST,
  POLICE_HEIGHT,
  POLICE_SPAWN_Y,
  POLICE_WIDTH,
} from '../config/GameConfig';

export class Police extends Phaser.GameObjects.Container {
  /** Own forward speed in px/s, set each frame by the PoliceManager. */
  speed = 400;
  /** How long this cruiser has been inside the catch zone, in seconds. */
  catchTimer = 0;
  /**
   * Set once the cruiser has actually closed on the player. A car that never
   * gets near doesn't count as "escaped" when it drops off the back.
   */
  engaged = false;

  readonly hitW = POLICE_WIDTH * 0.84;
  readonly hitH = POLICE_HEIGHT * 0.88;

  private readonly art: Phaser.GameObjects.Image;
  private readonly lightRed: Phaser.GameObjects.Image;
  private readonly lightBlue: Phaser.GameObjects.Image;
  private readonly wash: Phaser.GameObjects.Image;
  private steerVel = 0;
  private flashTime = 0;
  /** Random per-car offset so a pack of cruisers doesn't move as one block. */
  private laneBias = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, POLICE_SPAWN_Y);

    this.wash = scene.add.image(0, 0, 'tex-glow-blue').setDisplaySize(190, 190).setAlpha(0.16);
    this.art = scene.add.image(0, 0, 'tex-police').setDisplaySize(POLICE_WIDTH * 1.1, POLICE_HEIGHT * 1.08);
    this.lightRed = scene.add.image(-11, -10, 'tex-glow-red').setDisplaySize(44, 44);
    this.lightBlue = scene.add.image(11, -10, 'tex-glow-blue').setDisplaySize(44, 44);

    this.add([this.wash, this.art, this.lightRed, this.lightBlue]);
    this.setDepth(28);
    this.setActive(false).setVisible(false);
    scene.add.existing(this);
  }

  spawn(x: number, speed: number): void {
    this.setPosition(x, POLICE_SPAWN_Y);
    this.speed = speed;
    this.catchTimer = 0;
    this.engaged = false;
    this.steerVel = 0;
    this.laneBias = Phaser.Math.FloatBetween(-26, 26);
    this.art.setAngle(0);
    this.setAlpha(1);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /**
   * @param playerSpeed  world scroll speed, for the relative vertical move
   * @param playerX      lateral target to home in on
   * @param steerRate    px/s of sideways pursuit — rises with difficulty
   */
  update(dt: number, playerSpeed: number, playerX: number, steerRate: number): void {
    // Closing in means moving up the screen toward the player
    this.y += (playerSpeed - this.speed) * dt;
    // Never let a cruiser overtake and block from in front. The lower bound
    // must stay clear of POLICE_ESCAPE_Y or a shaken-off car could never
    // actually fall far enough back to count as escaped.
    this.y = Phaser.Math.Clamp(this.y, PLAYER_Y - 4, GAME_HEIGHT + 800);

    const target = Phaser.Math.Clamp(playerX + this.laneBias, PLAYER_MIN_X, PLAYER_MAX_X);
    const desired = Phaser.Math.Clamp((target - this.x) * 3.2, -steerRate, steerRate);
    this.steerVel += Phaser.Math.Clamp(desired - this.steerVel, -2200 * dt, 2200 * dt);
    this.x += this.steerVel * dt;
    this.art.setAngle(Phaser.Math.Clamp(this.steerVel / 40, -11, 11));

    if (!this.engaged && this.y - PLAYER_Y < POLICE_ENGAGE_DIST) this.engaged = true;

    this.updateLights(dt);
  }

  private updateLights(dt: number): void {
    this.flashTime += dt;
    // ~7Hz alternating strobe
    const phase = Math.floor(this.flashTime * 7) % 2 === 0;
    this.lightRed.setAlpha(phase ? 0.95 : 0.12);
    this.lightBlue.setAlpha(phase ? 0.12 : 0.95);
    this.wash.setTint(phase ? 0xff3b5c : 0x3b7bff);
    this.wash.setAlpha(0.1 + (phase ? 0.09 : 0.06));
  }

  /** 0 (far behind) .. 1 (right on your bumper) — drives siren volume. */
  proximity(): number {
    const gap = this.y - PLAYER_Y;
    return Phaser.Math.Clamp(1 - gap / 420, 0, 1);
  }
}
