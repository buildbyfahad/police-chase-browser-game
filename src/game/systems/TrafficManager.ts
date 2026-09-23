/**
 * AI traffic and road hazards.
 *
 * Spawning is deliberately conservative: before a car is placed the manager
 * checks that the player is still left with a reachable gap, so the game can
 * get relentless without ever becoming unfair.
 */
import Phaser from 'phaser';
import {
  LANE_COUNT,
  MIN_FREE_LANES,
  MIN_LANE_GAP,
  PLAYER_BASE_SPEED,
  POOL_TRAFFIC,
  TRAFFIC_KINDS,
  laneLocalX,
  type TrafficKind,
} from '../config/GameConfig';
import type { DifficultySnapshot } from './DifficultyManager';
import { Vehicle } from '../entities/Vehicle';

const SPAWN_Y = -140;
const DESPAWN_BELOW = 1100;
const DESPAWN_ABOVE = -320;
/** Band ahead of the player that spawn-safety reasons about. */
const SAFETY_BAND = 340;

export class TrafficManager {
  private readonly pool: Vehicle[] = [];
  private readonly weightTotal: number;
  private timer = 0;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < POOL_TRAFFIC; i++) {
      const v = new Vehicle(scene);
      v.setDepth(20);
      this.pool.push(v);
    }
    this.weightTotal = TRAFFIC_KINDS.reduce((sum, k) => sum + k.weight, 0);
  }

  reset(): void {
    for (const v of this.pool) v.despawn();
    this.timer = 0.9; // brief grace period before the first car appears
  }

  /** @param playerSpeed world scroll speed in px/s */
  update(dt: number, playerSpeed: number, diff: DifficultySnapshot): void {
    for (const v of this.pool) {
      if (!v.active) continue;
      const ownSpeed = v.isObstacle ? 0 : v.speedFactor * PLAYER_BASE_SPEED * diff.trafficSpeedScale;
      v.advance(playerSpeed - ownSpeed, dt);
      if (v.y > DESPAWN_BELOW || v.y < DESPAWN_ABOVE) v.despawn();
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = diff.trafficInterval * Phaser.Math.FloatBetween(0.78, 1.25);
      this.trySpawn(diff);
    }
  }

  private trySpawn(diff: DifficultySnapshot): void {
    const v = this.pool.find((item) => !item.active);
    if (!v) return; // pool exhausted — the road is busy enough already

    const lane = this.pickSafeLane();
    if (lane < 0) return;

    if (Math.random() < diff.obstacleChance) {
      const kind = Math.random() < 0.6 ? 'cone' : 'oil';
      v.spawnObstacle(kind, laneLocalX(lane) + Phaser.Math.FloatBetween(-16, 16), SPAWN_Y, lane);
      return;
    }

    const kind = this.pickKind();
    const factor = Phaser.Math.FloatBetween(kind.speedMin, kind.speedMax);
    v.spawnTraffic(kind, laneLocalX(lane), SPAWN_Y, lane, factor);
  }

  /**
   * Returns a lane that can be occupied without walling the player in, or -1
   * when every candidate would make the road impassable.
   */
  private pickSafeLane(): number {
    const blocked = new Array<boolean>(LANE_COUNT).fill(false);
    for (const v of this.pool) {
      if (v.active && v.y < SAFETY_BAND) blocked[v.lane] = true;
    }

    const freeCount = blocked.filter((b) => !b).length;
    if (freeCount <= MIN_FREE_LANES) return -1;

    const candidates: number[] = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (blocked[lane]) continue;
      if (!this.laneHasRoom(lane)) continue;
      candidates.push(lane);
    }
    if (candidates.length === 0) return -1;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Keeps a minimum tailgating distance between two cars in the same lane. */
  private laneHasRoom(lane: number): boolean {
    for (const v of this.pool) {
      if (v.active && v.lane === lane && v.y < SPAWN_Y + MIN_LANE_GAP + v.displayHeight) {
        return false;
      }
    }
    return true;
  }

  private pickKind(): TrafficKind {
    let roll = Math.random() * this.weightTotal;
    for (const kind of TRAFFIC_KINDS) {
      roll -= kind.weight;
      if (roll <= 0) return kind;
    }
    return TRAFFIC_KINDS[0];
  }

  /** Iterates only the live vehicles — used by collisions and effects. */
  forEachActive(fn: (v: Vehicle) => void): void {
    for (const v of this.pool) if (v.active) fn(v);
  }

  /** True when the given rect is clear of traffic — used before dropping pickups. */
  isClear(localX: number, y: number, w: number, h: number): boolean {
    for (const v of this.pool) {
      if (!v.active) continue;
      if (Math.abs(v.localX - localX) < (v.hitW + w) / 2 && Math.abs(v.y - y) < (v.hitH + h) / 2 + 30) {
        return false;
      }
    }
    return true;
  }

  destroy(): void {
    for (const v of this.pool) v.destroy();
    this.pool.length = 0;
  }
}
