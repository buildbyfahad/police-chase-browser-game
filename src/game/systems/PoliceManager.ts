/**
 * The pursuit.
 *
 * Cruisers rubber-band: the further back one falls, the harder it pushes, so
 * the chase stays tense without ever being unwinnable. Sustained speed — and
 * nitro in particular — is always the way out.
 */
import Phaser from 'phaser';
import {
  PLAYER_BASE_SPEED,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_Y,
  POLICE_CATCH_DIST_X,
  POLICE_CATCH_DIST_Y,
  POLICE_CATCH_TIME,
  POLICE_ESCAPE_Y,
  POOL_POLICE,
} from '../config/GameConfig';
import type { DifficultySnapshot } from './DifficultyManager';
import { Police } from '../entities/Police';

/** Seconds before a shaken-off cruiser is replaced by a fresh one. */
const RESPAWN_DELAY = 4;
/** Grace period at the start of a run before the first cruiser shows up. */
const FIRST_SPAWN_DELAY = 4.5;
/**
 * Range over which the rubber band tapers. A cruiser level with the player
 * gets no bonus at all, so at low difficulty simply cruising is enough to
 * pull away — braking, or a tier with a faster fleet, is what gets you caught.
 */
const BAND_RANGE = 500;
/** Extra speed a trailing cruiser can summon to close the gap. */
const RUBBER_BAND = 215;

export interface PoliceCallbacks {
  onEscape: () => void;
  onCaught: () => void;
  /** Fired when a cruiser first enters the catch zone, for the HUD warning. */
  onCatchProgress: (progress: number) => void;
}

export class PoliceManager {
  private readonly pool: Police[] = [];
  private respawnTimer = 0;
  private caught = false;

  constructor(scene: Phaser.Scene, private readonly callbacks: PoliceCallbacks) {
    for (let i = 0; i < POOL_POLICE; i++) this.pool.push(new Police(scene));
  }

  reset(): void {
    for (const p of this.pool) p.despawn();
    this.respawnTimer = FIRST_SPAWN_DELAY;
    this.caught = false;
  }

  update(dt: number, playerSpeed: number, playerX: number, diff: DifficultySnapshot, curveOffset: number): void {
    if (this.caught) return;

    const cruise = (PLAYER_BASE_SPEED + diff.roadSpeedBonus) * diff.policeSpeedScale;
    const steerRate = 210 + diff.level * 26;
    let worstProgress = 0;

    for (const p of this.pool) {
      if (!p.active) continue;

      const gap = p.y - PLAYER_Y;
      if (p.engaged) {
        // Trailing cruisers push harder; one on your bumper gets no bonus at
        // all, so out-driving it is always a matter of holding your speed.
        const band = Phaser.Math.Clamp(gap / BAND_RANGE, 0, 1);
        p.speed = cruise + band * RUBBER_BAND;
      } else {
        // A cruiser that has just joined always closes in at least once —
        // otherwise there is no pursuit to escape from in the first place.
        p.speed = Math.max(cruise + RUBBER_BAND, playerSpeed + 70);
      }

      p.update(dt, playerSpeed, playerX, steerRate, curveOffset);

      if (p.y > POLICE_ESCAPE_Y) {
        // Only a cruiser that actually got on your tail counts as shaken off
        const earned = p.engaged;
        p.despawn();
        if (earned) this.callbacks.onEscape();
        continue;
      }

      const inZone =
        Math.abs(p.y - PLAYER_Y) < POLICE_CATCH_DIST_Y && Math.abs(p.x - playerX) < POLICE_CATCH_DIST_X;
      // Slipping out of the zone drains the timer quickly but not instantly,
      // so a brief weave doesn't fully reset a pursuit that's nearly closed.
      p.catchTimer = Phaser.Math.Clamp(p.catchTimer + (inZone ? dt : -dt * 1.6), 0, POLICE_CATCH_TIME);
      worstProgress = Math.max(worstProgress, p.catchTimer / POLICE_CATCH_TIME);

      if (p.catchTimer >= POLICE_CATCH_TIME) {
        this.caught = true;
        this.callbacks.onCaught();
        return;
      }
    }

    this.callbacks.onCatchProgress(worstProgress);
    this.maintainFleet(dt, diff, cruise);
  }

  private maintainFleet(dt: number, diff: DifficultySnapshot, cruise: number): void {
    const activeCount = this.pool.reduce((n, p) => n + (p.active ? 1 : 0), 0);
    if (activeCount >= diff.policeCount) return;

    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;
    // The further the fleet is below strength, the quicker the next cruiser
    // joins, so a high tier reaches its intended pressure even when the
    // player keeps shaking cars off.
    const deficit = diff.policeCount - activeCount;
    this.respawnTimer = Math.max(1.5, RESPAWN_DELAY - (deficit - 1) * 1.2);

    const free = this.pool.find((p) => !p.active);
    // Joining cruisers run flat out so they visibly close the gap
    if (free) free.spawn(Phaser.Math.Between(PLAYER_MIN_X, PLAYER_MAX_X), cruise + RUBBER_BAND * 0.5);
  }

  /** Loudest siren among the active cruisers, 0..1. */
  proximity(): number {
    let max = 0;
    for (const p of this.pool) if (p.active) max = Math.max(max, p.proximity());
    return max;
  }

  get activeCount(): number {
    return this.pool.reduce((n, p) => n + (p.active ? 1 : 0), 0);
  }

  forEachActive(fn: (p: Police) => void): void {
    for (const p of this.pool) if (p.active) fn(p);
  }

  destroy(): void {
    for (const p of this.pool) p.destroy();
    this.pool.length = 0;
  }
}
