/**
 * Dev-only inspection hook for the automated playtest harness.
 *
 * It is loaded through a dynamic import behind `import.meta.env.DEV`, so the
 * whole module drops out of the production bundle rather than shipping as dead
 * code.
 */
import type { Player } from '../entities/Player';
import type { PickupManager } from '../systems/PickupManager';
import type { PoliceManager } from '../systems/PoliceManager';
import type { ScoreManager } from '../systems/ScoreManager';
import type { TrafficManager } from '../systems/TrafficManager';
import type { DifficultyManager } from '../systems/DifficultyManager';

export interface DebugSource {
  running: boolean;
  player: Player;
  traffic: TrafficManager;
  police: PoliceManager;
  pickups: PickupManager;
  score: ScoreManager;
  difficulty: DifficultyManager;
}

export function attachDebugBridge(read: () => DebugSource): void {
  (window as unknown as Record<string, unknown>).__policeChase = () => {
    const s = read();
    const traffic: Array<{ x: number; y: number; w: number; h: number }> = [];
    s.traffic.forEachActive((v) => traffic.push({ x: v.x, y: v.y, w: v.hitW, h: v.hitH }));
    const police: Array<{ x: number; y: number }> = [];
    s.police.forEachActive((p) => police.push({ x: p.x, y: p.y }));
    const pickups: Array<{ x: number; y: number; kind: string }> = [];
    s.pickups.forEachActive((p) => pickups.push({ x: p.x, y: p.y, kind: p.kind }));

    return {
      running: s.running,
      player: {
        x: s.player.x,
        y: s.player.y,
        speed: s.player.speed,
        nitro: s.player.nitroFuel,
      },
      shield: s.player.shieldActive,
      magnet: s.player.magnetActive,
      stats: s.score.value,
      level: s.difficulty.value.level,
      traffic,
      police,
      pickups,
    };
  };
}
