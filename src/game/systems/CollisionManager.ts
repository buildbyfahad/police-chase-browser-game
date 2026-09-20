/**
 * All player contact resolution in one place: traffic, hazards, pickups and
 * near misses.
 *
 * Checks are plain AABB overlaps against the live pools — no physics engine
 * is needed for a lane-based racer, and this keeps the per-frame cost flat.
 */
import { NEAR_MISS_DIST_X } from '../config/GameConfig';
import type { Player } from '../entities/Player';
import type { Vehicle } from '../entities/Vehicle';
import type { PickupKind } from '../entities/Pickup';
import type { TrafficManager } from './TrafficManager';
import type { PickupManager } from './PickupManager';

export interface CollisionCallbacks {
  onCoin: (x: number, y: number) => void;
  onPowerUp: (kind: PickupKind, x: number, y: number) => void;
  /** A fatal hit — the run is over. */
  onCrash: (x: number, y: number) => void;
  /** The shield ate a hit that would otherwise have ended the run. */
  onShieldAbsorb: (x: number, y: number) => void;
  /** A non-fatal hazard (oil) knocked the car about. */
  onSpinOut: (x: number, y: number) => void;
  onNearMiss: (x: number, y: number) => void;
}

export class CollisionManager {
  constructor(
    private readonly traffic: TrafficManager,
    private readonly pickups: PickupManager,
    private readonly callbacks: CollisionCallbacks,
  ) {}

  check(player: Player): void {
    if (player.isCrashed) return;
    this.checkPickups(player);
    this.checkTraffic(player);
  }

  private checkPickups(player: Player): void {
    this.pickups.forEachActive((p) => {
      const overlapX = Math.abs(p.x - player.x) < player.hitW / 2 + p.radius;
      const overlapY = Math.abs(p.y - player.y) < player.hitH / 2 + p.radius;
      if (!overlapX || !overlapY) return;

      const { x, y, kind } = p;
      p.despawn();
      if (kind === 'coin') this.callbacks.onCoin(x, y);
      else this.callbacks.onPowerUp(kind as PickupKind, x, y);
    });
  }

  private checkTraffic(player: Player): void {
    this.traffic.forEachActive((v) => {
      if (player.isCrashed) return;

      if (this.overlaps(player, v)) {
        this.resolveHit(player, v);
        return;
      }

      // Drawn level with a car without touching it — that's a near miss
      if (!v.isObstacle && !v.scoredNearMiss && v.y > player.y) {
        const gap = Math.abs(v.x - player.x) - (player.hitW + v.hitW) / 2;
        v.scoredNearMiss = true;
        if (gap > 0 && gap < NEAR_MISS_DIST_X) this.callbacks.onNearMiss(v.x, v.y);
      }
    });
  }

  private overlaps(player: Player, v: Vehicle): boolean {
    return (
      Math.abs(v.x - player.x) < (player.hitW + v.hitW) / 2 &&
      Math.abs(v.y - player.y) < (player.hitH + v.hitH) / 2
    );
  }

  private resolveHit(player: Player, v: Vehicle): void {
    const { x, y } = v;

    // Oil is a handling hazard, not a wreck — it costs you speed and control
    if (v.isObstacle && v.texture.key === 'tex-oil') {
      v.despawn();
      player.stagger();
      this.callbacks.onSpinOut(x, y);
      return;
    }

    if (player.consumeShield()) {
      v.despawn();
      player.stagger();
      this.callbacks.onShieldAbsorb(x, y);
      return;
    }

    this.callbacks.onCrash(x, y);
  }
}
