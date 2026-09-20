/**
 * Central tuning constants. Everything gameplay-related that a designer would
 * want to tweak lives here so the systems stay free of magic numbers.
 */

// ---- Canvas (logical resolution; Phaser scales it to fit the viewport) ----
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

// ---- Road geometry ----
export const LANE_COUNT = 4;
export const ROAD_WIDTH = 344;
export const ROAD_LEFT = (GAME_WIDTH - ROAD_WIDTH) / 2;
export const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

/** Centre x of a lane index (0 = leftmost). */
export function laneX(lane: number): number {
  return ROAD_LEFT + LANE_WIDTH * (lane + 0.5);
}

/** Leftmost / rightmost x the player car may occupy (kept just inside the barriers). */
export const PLAYER_MIN_X = ROAD_LEFT + 26;
export const PLAYER_MAX_X = ROAD_LEFT + ROAD_WIDTH - 26;

// ---- Distance ----
/** Rendered pixels that make up one in-game metre. */
export const PX_PER_METRE = 11;

// ---- Player ----
export const PLAYER_Y = GAME_HEIGHT - 190;
export const PLAYER_MIN_SPEED = 190;
export const PLAYER_BASE_SPEED = 400;
export const PLAYER_MAX_SPEED = 640;
export const PLAYER_ACCEL = 260;
export const PLAYER_BRAKE = 460;
/** Passive drift back toward base speed when neither pedal is held. */
export const PLAYER_COAST = 130;
export const PLAYER_STEER_SPEED = 430;
export const PLAYER_STEER_ACCEL = 2600;

// ---- Nitro ----
export const NITRO_MAX = 100;
export const NITRO_START = 60;
export const NITRO_DRAIN = 26; // per second while held
export const NITRO_REGEN = 3.4; // per second passive
export const NITRO_PICKUP = 45;
export const NITRO_SPEED_BONUS = 320;
export const NITRO_MIN_TO_FIRE = 6; // can't re-trigger below this

// ---- Power-ups ----
export const SHIELD_DURATION = 12_000;
export const MAGNET_DURATION = 7_000;
export const MAGNET_RADIUS = 210;
export const MAGNET_PULL = 620;

// ---- Traffic ----
export interface TrafficKind {
  key: string;
  width: number;
  height: number;
  /** Fraction of the player's base speed this vehicle drives at. */
  speedMin: number;
  speedMax: number;
  weight: number;
}

export const TRAFFIC_KINDS: TrafficKind[] = [
  { key: 'car-blue', width: 46, height: 88, speedMin: 0.5, speedMax: 0.78, weight: 34 },
  { key: 'car-green', width: 46, height: 88, speedMin: 0.5, speedMax: 0.78, weight: 26 },
  { key: 'suv', width: 52, height: 100, speedMin: 0.45, speedMax: 0.68, weight: 20 },
  { key: 'truck', width: 58, height: 142, speedMin: 0.34, speedMax: 0.52, weight: 13 },
  { key: 'bus', width: 58, height: 168, speedMin: 0.3, speedMax: 0.46, weight: 7 },
];

// ---- Police ----
export const POLICE_WIDTH = 48;
export const POLICE_HEIGHT = 94;
/** How close (px, centre-to-centre) counts as "on your tail". */
export const POLICE_CATCH_DIST_Y = 78;
export const POLICE_CATCH_DIST_X = 54;
/** Seconds the police must stay in the catch zone before you're busted. */
export const POLICE_CATCH_TIME = 1.6;
/**
 * Cruisers join just off the bottom of the screen and are only shaken off once
 * they have dropped a long way further back, so an escape always represents a
 * real stretch of outrunning them rather than a spawn that never caught up.
 */
export const POLICE_SPAWN_Y = GAME_HEIGHT + 60;
export const POLICE_ESCAPE_Y = GAME_HEIGHT + 640;
/** A cruiser has to get at least this close before an escape counts. */
export const POLICE_ENGAGE_DIST = 150;

// ---- Coins & pickups ----
export const COIN_SIZE = 26;
export const POWERUP_SIZE = 38;
export const COIN_VALUE = 25;

// ---- Scoring ----
export const SCORE_PER_METRE = 1.4;
export const SCORE_PER_SECOND = 22;
export const SCORE_PER_ESCAPE = 300;
export const SCORE_NEAR_MISS = 60;
export const NEAR_MISS_DIST_X = 46;

// ---- Difficulty ----
export interface DifficultyTier {
  /** Seconds survived at which this tier begins. */
  at: number;
  label: string;
  level: number;
  roadSpeedBonus: number;
  trafficInterval: number; // seconds between spawn attempts
  trafficSpeedScale: number;
  policeCount: number;
  policeSpeedScale: number;
  obstacleChance: number;
}

export const DIFFICULTY_TIERS: DifficultyTier[] = [
  { at: 0,   label: 'EASY',    level: 1, roadSpeedBonus: 0,   trafficInterval: 1.5,  trafficSpeedScale: 1.0,  policeCount: 1, policeSpeedScale: 0.88, obstacleChance: 0.0 },
  { at: 22,  label: 'NORMAL',  level: 2, roadSpeedBonus: 30,  trafficInterval: 1.18, trafficSpeedScale: 1.05, policeCount: 1, policeSpeedScale: 0.92, obstacleChance: 0.08 },
  { at: 50,  label: 'NORMAL+', level: 3, roadSpeedBonus: 58,  trafficInterval: 0.98, trafficSpeedScale: 1.1,  policeCount: 2, policeSpeedScale: 0.97, obstacleChance: 0.14 },
  { at: 85,  label: 'HARD',    level: 4, roadSpeedBonus: 86,  trafficInterval: 0.84, trafficSpeedScale: 1.15, policeCount: 2, policeSpeedScale: 1.02, obstacleChance: 0.2 },
  { at: 125, label: 'HARD+',   level: 5, roadSpeedBonus: 112, trafficInterval: 0.74, trafficSpeedScale: 1.2,  policeCount: 3, policeSpeedScale: 1.06, obstacleChance: 0.25 },
  { at: 175, label: 'EXTREME', level: 6, roadSpeedBonus: 140, trafficInterval: 0.64, trafficSpeedScale: 1.26, policeCount: 3, policeSpeedScale: 1.1,  obstacleChance: 0.3 },
  { at: 240, label: 'INSANE',  level: 7, roadSpeedBonus: 172, trafficInterval: 0.56, trafficSpeedScale: 1.32, policeCount: 4, policeSpeedScale: 1.14, obstacleChance: 0.34 },
];

// ---- Spawn safety ----
/** A newly spawned car must leave at least one lane reachable for the player. */
export const MIN_FREE_LANES = 2;
/** Minimum vertical gap (px) between two cars occupying the same lane. */
export const MIN_LANE_GAP = 150;

// ---- Pooling ----
export const POOL_TRAFFIC = 18;
export const POOL_COINS = 40;
export const POOL_POWERUPS = 6;
export const POOL_POLICE = 5;
