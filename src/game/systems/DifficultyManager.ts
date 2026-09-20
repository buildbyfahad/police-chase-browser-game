/**
 * Difficulty ramp.
 *
 * Tiers are defined as keyframes in GameConfig and every value is interpolated
 * between the current and next tier, so the game tightens continuously instead
 * of lurching at each threshold.
 */
import Phaser from 'phaser';
import { DIFFICULTY_TIERS, type DifficultyTier } from '../config/GameConfig';

export interface DifficultySnapshot {
  level: number;
  label: string;
  roadSpeedBonus: number;
  trafficInterval: number;
  trafficSpeedScale: number;
  policeCount: number;
  policeSpeedScale: number;
  obstacleChance: number;
}

export class DifficultyManager {
  private current: DifficultySnapshot = { ...DIFFICULTY_TIERS[0] };
  private lastLevel = DIFFICULTY_TIERS[0].level;
  /** Set on the frame the tier label changes, so the HUD can announce it. */
  levelChanged = false;

  reset(): void {
    this.current = { ...DIFFICULTY_TIERS[0] };
    this.lastLevel = DIFFICULTY_TIERS[0].level;
    this.levelChanged = false;
  }

  /** @param elapsed seconds survived this run */
  update(elapsed: number): void {
    let lower: DifficultyTier = DIFFICULTY_TIERS[0];
    let upper: DifficultyTier = DIFFICULTY_TIERS[0];

    for (let i = 0; i < DIFFICULTY_TIERS.length; i++) {
      if (elapsed >= DIFFICULTY_TIERS[i].at) {
        lower = DIFFICULTY_TIERS[i];
        upper = DIFFICULTY_TIERS[i + 1] ?? DIFFICULTY_TIERS[i];
      }
    }

    const span = upper.at - lower.at;
    const t = span > 0 ? Phaser.Math.Clamp((elapsed - lower.at) / span, 0, 1) : 0;
    const mix = (a: number, b: number) => a + (b - a) * t;

    this.current = {
      level: lower.level,
      label: lower.label,
      roadSpeedBonus: mix(lower.roadSpeedBonus, upper.roadSpeedBonus),
      trafficInterval: mix(lower.trafficInterval, upper.trafficInterval),
      trafficSpeedScale: mix(lower.trafficSpeedScale, upper.trafficSpeedScale),
      // Police count and label step rather than blend — they're discrete
      policeCount: lower.policeCount,
      policeSpeedScale: mix(lower.policeSpeedScale, upper.policeSpeedScale),
      obstacleChance: mix(lower.obstacleChance, upper.obstacleChance),
    };

    this.levelChanged = this.current.level !== this.lastLevel;
    this.lastLevel = this.current.level;
  }

  get value(): DifficultySnapshot {
    return this.current;
  }
}
