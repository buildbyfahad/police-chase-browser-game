/** Single cross-boundary event channel between the Phaser scenes and the DOM shell. */
import Phaser from 'phaser';
import type { RunStats } from './ScoreManager';

export type GameOverReason = 'crashed' | 'caught';

export interface GameOverPayload extends RunStats {
  reason: GameOverReason;
}

export const Bus = new Phaser.Events.EventEmitter();

export const EVENT = {
  /** Textures are baked and the game is safe to start. */
  READY: 'game:ready',
  OVER: 'game:over',
} as const;
