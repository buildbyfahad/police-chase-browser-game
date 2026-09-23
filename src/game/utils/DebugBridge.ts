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
import type { RoadManager } from '../systems/RoadManager';

export interface DebugSource {
  running: boolean;
  player: Player;
  traffic: TrafficManager;
  police: PoliceManager;
  pickups: PickupManager;
  score: ScoreManager;
  difficulty: DifficultyManager;
  road: RoadManager;
}

export function attachDebugBridge(read: () => DebugSource): void {
  (window as unknown as Record<string, unknown>).__policeChase = () => {
    const s = read();
    // localX is the honest coordinate on a bending road: screen x changes as a
    // car travels down the curve, its position across the lanes does not.
    const traffic: Array<{ x: number; y: number; localX: number; w: number; h: number }> = [];
    s.traffic.forEachActive((v) => traffic.push({ x: v.x, y: v.y, localX: v.localX, w: v.hitW, h: v.hitH }));
    const police: Array<{ x: number; y: number }> = [];
    s.police.forEachActive((p) => police.push({ x: p.x, y: p.y }));
    const pickups: Array<{ x: number; y: number; kind: string }> = [];
    s.pickups.forEachActive((p) => pickups.push({ x: p.x, y: p.y, kind: p.kind }));

    return {
      running: s.running,
      player: {
        x: s.player.x,
        localX: s.player.x - (s.road.offset + 240),
        y: s.player.y,
        speed: s.player.speed,
        nitro: s.player.nitroFuel,
      },
      shield: s.player.shieldActive,
      magnet: s.player.magnetActive,
      stats: s.score.value,
      level: s.difficulty.value.level,
      // Lateral offset of the road at the player, and one screen ahead
      road: { offset: s.road.offset, ahead: s.road.offsetAt(s.player.y - 400) },
      traffic,
      police,
      pickups,
    };
  };
}
