/**
 * Score, distance and run statistics.
 *
 * Score accrues continuously from distance and survival time, with lump sums
 * for coins, shaken-off police and near misses.
 */
import {
  COIN_VALUE,
  PX_PER_METRE,
  SCORE_NEAR_MISS,
  SCORE_PER_ESCAPE,
  SCORE_PER_METRE,
  SCORE_PER_SECOND,
} from '../config/GameConfig';

export interface RunStats {
  score: number;
  distanceM: number;
  elapsed: number;
  coins: number;
  policeEscaped: number;
  nearMisses: number;
}

export class ScoreManager {
  private stats: RunStats = blank();
  private pixels = 0;

  reset(): void {
    this.stats = blank();
    this.pixels = 0;
  }

  /** @param speed world scroll speed in px/s */
  update(speed: number, dt: number): void {
    this.pixels += speed * dt;
    this.stats.distanceM = this.pixels / PX_PER_METRE;
    this.stats.elapsed += dt;
    this.stats.score += (speed * dt) / PX_PER_METRE * SCORE_PER_METRE + SCORE_PER_SECOND * dt;
  }

  addCoin(): void {
    this.stats.coins += 1;
    this.stats.score += COIN_VALUE;
  }

  addEscape(): void {
    this.stats.policeEscaped += 1;
    this.stats.score += SCORE_PER_ESCAPE;
  }

  addNearMiss(): void {
    this.stats.nearMisses += 1;
    this.stats.score += SCORE_NEAR_MISS;
  }

  get value(): RunStats {
    return this.stats;
  }

  get score(): number {
    return Math.floor(this.stats.score);
  }

  get distanceKm(): number {
    return this.stats.distanceM / 1000;
  }
}

function blank(): RunStats {
  return { score: 0, distanceM: 0, elapsed: 0, coins: 0, policeEscaped: 0, nearMisses: 0 };
}

/** mm:ss for the HUD and the game-over card. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Thousands-separated integer, e.g. 24,850. */
export function formatScore(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
