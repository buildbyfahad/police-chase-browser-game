/**
 * The player's car: lateral steering, throttle/brake, nitro and the two
 * timed power-ups. It owns no spawning or collision logic — it just turns
 * input into motion and exposes readable state for the rest of the game.
 */
import Phaser from 'phaser';
import {
  CURVE_DRIFT,
  MAGNET_DURATION,
  NITRO_DRAIN,
  NITRO_MAX,
  NITRO_MIN_TO_FIRE,
  NITRO_PICKUP,
  NITRO_REGEN,
  NITRO_SPEED_BONUS,
  NITRO_START,
  PLAYER_ACCEL,
  PLAYER_BASE_SPEED,
  PLAYER_BRAKE,
  PLAYER_COAST,
  PLAYER_MAX_SPEED,
  PLAYER_LIMIT_X,
  PLAYER_MIN_SPEED,
  PLAYER_STEER_ACCEL,
  PLAYER_STEER_SPEED,
  PLAYER_Y,
  ROAD_CENTER,
  SHIELD_DURATION,
} from '../config/GameConfig';
import type { InputState } from '../systems/InputManager';
import { Garage } from '../systems/GarageManager';
import type { ResolvedStats } from '../config/Cars';

export class Player extends Phaser.GameObjects.Container {
  /** Forward speed in px/s — also the speed the whole world scrolls at. */
  speed = PLAYER_BASE_SPEED;
  /** Extra top/base speed granted by the current difficulty tier. */
  speedBonus = 0;

  nitroFuel = NITRO_START;
  nitroActive = false;
  /** True on the single frame nitro is first engaged, for one-shot FX. */
  nitroJustFired = false;

  shieldActive = false;
  private shieldUntil = 0;
  magnetActive = false;
  private magnetUntil = 0;

  readonly hitW = 40;
  readonly hitH = 80;

  private readonly chassis: Phaser.GameObjects.Image;
  private readonly flame: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Image;
  private steerVel = 0;
  private crashed = false;
  /** Multipliers from the selected car and its upgrades. */
  private stats: ResolvedStats = Garage.activeStats();

  constructor(scene: Phaser.Scene) {
    super(scene, ROAD_CENTER, PLAYER_Y);

    this.flame = scene.add.image(0, 62, 'tex-glow-blue').setDisplaySize(52, 104).setAlpha(0);
    this.chassis = scene.add.image(0, 0, `tex-car-${Garage.selectedId()}`).setDisplaySize(52, 96);
    this.bubble = scene.add.image(0, 0, 'tex-shield-bubble').setDisplaySize(104, 104).setAlpha(0);

    this.add([this.flame, this.chassis, this.bubble]);
    this.setDepth(30);
    scene.add.existing(this);
  }

  /** Puts the car back to its opening state for a fresh run. */
  reset(): void {
    // Picked up fresh each run, so a garage visit takes effect immediately
    this.stats = Garage.activeStats();
    this.chassis.setTexture(`tex-car-${Garage.selectedId()}`);
    this.setPosition(ROAD_CENTER, PLAYER_Y);
    this.speed = PLAYER_BASE_SPEED;
    this.speedBonus = 0;
    this.nitroFuel = NITRO_START * this.stats.nitro;
    this.nitroActive = false;
    this.nitroJustFired = false;
    this.shieldActive = false;
    this.magnetActive = false;
    this.shieldUntil = 0;
    if (this.stats.startsWithShield) this.giveShield(this.scene.time.now);
    this.magnetUntil = 0;
    this.steerVel = 0;
    this.crashed = false;
    this.chassis.setAngle(0).setAlpha(1);
    this.bubble.setAlpha(0);
    this.flame.setAlpha(0);
    this.setAlpha(1).setVisible(true);
  }

  /** How hard the engine is working, 0..1 — drives engine pitch and FX. */
  get throttle(): number {
    const span = this.maxSpeed - PLAYER_MIN_SPEED;
    return span <= 0 ? 0 : Phaser.Math.Clamp((this.speed - PLAYER_MIN_SPEED) / span, 0, 1);
  }

  private get maxSpeed(): number {
    return PLAYER_MAX_SPEED * this.stats.speed + this.speedBonus;
  }

  /** Bottle capacity for this car, after nitro upgrades. */
  get nitroCapacity(): number {
    return NITRO_MAX * this.stats.nitro;
  }

  update(dt: number, input: InputState, now: number, curve: { offset: number; rate: number }): void {
    if (this.crashed) return;

    this.updateNitro(dt, input);
    this.updateSpeed(dt, input);
    this.updateSteering(dt, input, curve);
    this.updatePowerUps(now);
  }

  private updateNitro(dt: number, input: InputState): void {
    this.nitroJustFired = false;
    const wants = input.nitro;

    if (this.nitroActive) {
      // A bigger bottle also empties more slowly
      this.nitroFuel -= (NITRO_DRAIN / this.stats.nitro) * dt;
      if (!wants || this.nitroFuel <= 0) {
        this.nitroActive = false;
        this.nitroFuel = Math.max(0, this.nitroFuel);
      }
    } else if (wants && this.nitroFuel >= NITRO_MIN_TO_FIRE) {
      this.nitroActive = true;
      this.nitroJustFired = true;
    } else {
      this.nitroFuel = Math.min(this.nitroCapacity, this.nitroFuel + NITRO_REGEN * this.stats.nitro * dt);
    }

    // Exhaust flame tracks the boost
    const target = this.nitroActive ? 0.95 : 0;
    this.flame.setAlpha(Phaser.Math.Linear(this.flame.alpha, target, Math.min(1, dt * 12)));
    if (this.nitroActive) {
      this.flame.setDisplaySize(52, 96 + Math.sin(this.scene.time.now * 0.05) * 22);
    }
  }

  private updateSpeed(dt: number, input: InputState): void {
    const base = PLAYER_BASE_SPEED + this.speedBonus;
    let ceiling = this.maxSpeed;

    if (this.nitroActive) {
      ceiling = this.maxSpeed + NITRO_SPEED_BONUS;
      this.speed += PLAYER_ACCEL * this.stats.accel * 2.4 * dt;
    } else if (input.accelerate) {
      this.speed += PLAYER_ACCEL * this.stats.accel * dt;
    } else if (input.brake) {
      this.speed -= PLAYER_BRAKE * dt;
    } else {
      // Coast back toward the cruising speed from either direction
      const delta = base - this.speed;
      const move = PLAYER_COAST * dt;
      this.speed += Math.abs(delta) <= move ? delta : Math.sign(delta) * move;
    }

    // Overspeed from a finished boost bleeds off instead of snapping down
    if (this.speed > ceiling) {
      this.speed = Math.max(ceiling, this.speed - PLAYER_COAST * 2.6 * dt);
    }
    this.speed = Math.max(PLAYER_MIN_SPEED, this.speed);
  }

  private updateSteering(dt: number, input: InputState, curve: { offset: number; rate: number }): void {
    const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    // Steering grip falls off a little at very high speed
    const grip = 1 - Math.min(0.25, (this.speed - PLAYER_BASE_SPEED) / 2600);
    const target = dir * PLAYER_STEER_SPEED * this.stats.handling * grip;
    const step = PLAYER_STEER_ACCEL * this.stats.handling * dt;
    this.steerVel += Phaser.Math.Clamp(target - this.steerVel, -step, step);

    // A bend carries the car with it, then throws it toward the outside of
    // the corner — holding a line through a sweeper takes a correction.
    const carried = curve.rate * dt;
    const thrown = -curve.rate * CURVE_DRIFT * dt;
    const minX = ROAD_CENTER + curve.offset - PLAYER_LIMIT_X;
    const maxX = ROAD_CENTER + curve.offset + PLAYER_LIMIT_X;

    this.x = Phaser.Math.Clamp(this.x + this.steerVel * dt + carried + thrown, minX, maxX);
    // Scrubbing a barrier kills sideways momentum rather than sticking
    if (this.x <= minX || this.x >= maxX) this.steerVel = 0;

    this.chassis.setAngle((this.steerVel / (PLAYER_STEER_SPEED * this.stats.handling)) * 9);
  }

  private updatePowerUps(now: number): void {
    if (this.magnetActive && now >= this.magnetUntil) this.magnetActive = false;

    if (this.shieldActive) {
      if (now >= this.shieldUntil) {
        this.shieldActive = false;
        this.bubble.setAlpha(0);
      } else {
        const remaining = this.shieldUntil - now;
        // Blink out the last second and a half as a warning
        const blink = remaining < 1500 ? (Math.floor(now / 120) % 2 === 0 ? 0.25 : 0.9) : 0.85;
        this.bubble.setAlpha(blink);
        this.bubble.setAngle(this.bubble.angle + 0.6);
      }
    }
  }

  /* ---------------- pickups ---------------- */

  addNitro(): void {
    this.nitroFuel = Math.min(this.nitroCapacity, this.nitroFuel + NITRO_PICKUP * this.stats.nitro);
  }

  giveShield(now: number): void {
    this.shieldActive = true;
    this.shieldUntil = now + SHIELD_DURATION * this.stats.shield;
    this.bubble.setAlpha(0.85);
  }

  giveMagnet(now: number): void {
    this.magnetActive = true;
    this.magnetUntil = now + MAGNET_DURATION;
  }

  /** Consumes the shield on a dangerous hit. Returns true if it absorbed it. */
  consumeShield(): boolean {
    if (!this.shieldActive) return false;
    this.shieldActive = false;
    this.bubble.setAlpha(0);
    return true;
  }

  /** Drops speed after a glancing hit without ending the run. */
  stagger(): void {
    this.speed = Math.max(PLAYER_MIN_SPEED, this.speed * 0.55);
    this.nitroActive = false;
    this.steerVel *= 0.2;
  }

  crash(): void {
    this.crashed = true;
    this.nitroActive = false;
    this.flame.setAlpha(0);
    this.bubble.setAlpha(0);
  }

  get isCrashed(): boolean {
    return this.crashed;
  }

  /** The car body, so scenes can tween/tint the art without the FX children. */
  get art(): Phaser.GameObjects.Image {
    return this.chassis;
  }
}
