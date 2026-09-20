/**
 * Coins and power-ups.
 *
 * Coins arrive in readable patterns (lines, arcs, zig-zags) rather than as
 * scattered singles, which turns collecting them into a driving line the
 * player can commit to. Nothing is ever dropped on top of traffic.
 */
import Phaser from 'phaser';
import {
  COIN_SIZE,
  LANE_COUNT,
  MAGNET_PULL,
  MAGNET_RADIUS,
  POOL_COINS,
  POOL_POWERUPS,
  POWERUP_SIZE,
  laneX,
} from '../config/GameConfig';
import { Pickup, type PickupKind } from '../entities/Pickup';
import type { TrafficManager } from './TrafficManager';
import type { Player } from '../entities/Player';

const SPAWN_Y = -60;
const DESPAWN_BELOW = 1000;
const DESPAWN_ABOVE = -400;
const COIN_GAP = 48;

const COIN_INTERVAL: [number, number] = [1.8, 3.4];
const POWERUP_INTERVAL: [number, number] = [8.5, 14];
/** Relative chances of each power-up type. */
const POWERUP_WEIGHTS: Array<[PickupKind, number]> = [
  ['nitro', 52],
  ['shield', 27],
  ['magnet', 21],
];

export class PickupManager {
  private readonly coins: Pickup[] = [];
  private readonly powerUps: Pickup[] = [];
  private coinTimer = 0;
  private powerTimer = 0;

  constructor(scene: Phaser.Scene, private readonly traffic: TrafficManager) {
    for (let i = 0; i < POOL_COINS; i++) {
      const p = new Pickup(scene);
      p.setDepth(15);
      this.coins.push(p);
    }
    for (let i = 0; i < POOL_POWERUPS; i++) {
      const p = new Pickup(scene);
      p.setDepth(16);
      this.powerUps.push(p);
    }
  }

  reset(): void {
    for (const p of this.coins) p.despawn();
    for (const p of this.powerUps) p.despawn();
    this.coinTimer = 1.4;
    this.powerTimer = 6;
  }

  update(dt: number, playerSpeed: number, time: number, player: Player): void {
    const magnetOn = player.magnetActive;

    for (const list of [this.coins, this.powerUps]) {
      for (const p of list) {
        if (!p.active) continue;
        p.update(playerSpeed, dt, time);

        if (magnetOn && p.kind === 'coin') {
          const dist = Phaser.Math.Distance.Between(p.x, p.y, player.x, player.y);
          if (dist < MAGNET_RADIUS) p.attractTo(player.x, player.y, MAGNET_PULL, dt);
        }

        if (p.y > DESPAWN_BELOW || p.y < DESPAWN_ABOVE) p.despawn();
      }
    }

    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      this.coinTimer = Phaser.Math.FloatBetween(...COIN_INTERVAL);
      this.spawnCoinPattern();
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      this.powerTimer = Phaser.Math.FloatBetween(...POWERUP_INTERVAL);
      this.spawnPowerUp();
    }
  }

  /* ---------------- spawning ---------------- */

  private spawnCoinPattern(): void {
    const pattern = Phaser.Math.Between(0, 2);
    const count = Phaser.Math.Between(4, 7);
    const startLane = Phaser.Math.Between(0, LANE_COUNT - 1);

    for (let i = 0; i < count; i++) {
      let lane = startLane;
      if (pattern === 1) lane = Phaser.Math.Clamp(startLane + Math.round(i / 2), 0, LANE_COUNT - 1);
      else if (pattern === 2) lane = Phaser.Math.Clamp(startLane + (i % 2), 0, LANE_COUNT - 1);

      const x = laneX(lane);
      const y = SPAWN_Y - i * COIN_GAP;
      if (!this.traffic.isClear(x, y, COIN_SIZE, COIN_SIZE)) continue;

      const free = this.coins.find((c) => !c.active);
      if (!free) return;
      free.spawn('coin', x, y);
    }
  }

  private spawnPowerUp(): void {
    const free = this.powerUps.find((p) => !p.active);
    if (!free) return;

    const lane = Phaser.Math.Between(0, LANE_COUNT - 1);
    const x = laneX(lane);
    if (!this.traffic.isClear(x, SPAWN_Y, POWERUP_SIZE, POWERUP_SIZE)) {
      this.powerTimer = 1.2; // road was busy — try again shortly
      return;
    }
    free.spawn(this.pickPowerUpKind(), x, SPAWN_Y);
  }

  private pickPowerUpKind(): PickupKind {
    const total = POWERUP_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * total;
    for (const [kind, weight] of POWERUP_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return kind;
    }
    return 'nitro';
  }

  /* ---------------- access ---------------- */

  forEachActive(fn: (p: Pickup) => void): void {
    for (const p of this.coins) if (p.active) fn(p);
    for (const p of this.powerUps) if (p.active) fn(p);
  }

  destroy(): void {
    for (const p of this.coins) p.destroy();
    for (const p of this.powerUps) p.destroy();
    this.coins.length = 0;
    this.powerUps.length = 0;
  }
}
