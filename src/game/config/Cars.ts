/**
 * Garage data: the cars you can own and the five upgrade tracks you can buy
 * for each of them.
 *
 * Everything here is pure data plus the maths that turns it into the
 * multipliers the Player applies. No Phaser, no DOM — so the garage screen and
 * the game read the exact same numbers.
 */

export type StatKey = 'speed' | 'accel' | 'handling' | 'nitro' | 'shield';

export interface CarSpec {
  id: string;
  name: string;
  blurb: string;
  /** Cost in coins. The starter car is free. */
  price: number;
  /** Baseline multipliers before upgrades. 1.0 is the reference car. */
  base: Record<Exclude<StatKey, 'shield'>, number>;
  /** Body colours for the procedurally drawn sprite. */
  palette: { body: number; bodyDark: number; cabin: number; glass: number; accent: number };
}

export const MAX_UPGRADE_LEVEL = 5;
/** Each level adds this much of the stat, as a fraction of the car's base. */
export const UPGRADE_STEP = 0.06;

export const STATS: Array<{ key: StatKey; name: string; detail: string }> = [
  { key: 'speed', name: 'Top Speed', detail: 'How fast you can run flat out' },
  { key: 'accel', name: 'Acceleration', detail: 'How quickly you get there' },
  { key: 'handling', name: 'Handling', detail: 'How sharply you change lane' },
  { key: 'nitro', name: 'Nitro', detail: 'Bottle size and how slowly it drains' },
  { key: 'shield', name: 'Shield', detail: 'How long a shield lasts' },
];

export const CARS: CarSpec[] = [
  {
    id: 'street',
    name: 'Street',
    blurb: 'Honest all-rounder. Nothing to complain about, nothing to brag about.',
    price: 0,
    base: { speed: 1, accel: 1, handling: 1, nitro: 1 },
    palette: { body: 0xff8a1f, bodyDark: 0xc4590a, cabin: 0x2b1405, glass: 0x7fd4ff, accent: 0xfff0c9 },
  },
  {
    id: 'bolt',
    name: 'Bolt',
    blurb: 'Light and twitchy. Threads gaps nothing else fits through.',
    price: 900,
    base: { speed: 0.93, accel: 1.18, handling: 1.24, nitro: 1.05 },
    palette: { body: 0x2fd6d0, bodyDark: 0x137a77, cabin: 0x07302f, glass: 0xa8f4ff, accent: 0xe6fffe },
  },
  {
    id: 'muscle',
    name: 'Muscle',
    blurb: 'Enormous top end, steers like a wardrobe. Pick your lane early.',
    price: 2400,
    base: { speed: 1.2, accel: 1.08, handling: 0.82, nitro: 0.94 },
    palette: { body: 0xe23a4a, bodyDark: 0x8c1622, cabin: 0x2d060c, glass: 0xffc2c9, accent: 0xffe3e6 },
  },
  {
    id: 'gt',
    name: 'GT',
    blurb: 'No weaknesses and priced accordingly. The one you save up for.',
    price: 5200,
    base: { speed: 1.13, accel: 1.16, handling: 1.09, nitro: 1.16 },
    palette: { body: 0x9b5cff, bodyDark: 0x4f1f9e, cabin: 0x1d0b3a, glass: 0xd9c2ff, accent: 0xf1e6ff },
  },
];

export const DEFAULT_CAR = CARS[0].id;

export function carById(id: string): CarSpec {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}

/** Save key for one car's upgrade track, e.g. "muscle.handling". */
export function upgradeKey(carId: string, stat: StatKey): string {
  return `${carId}.${stat}`;
}

/**
 * Coin cost of moving a track from `level` to `level + 1`.
 * Returns null when the track is already maxed.
 */
export function upgradeCost(level: number): number | null {
  if (level >= MAX_UPGRADE_LEVEL) return null;
  return Math.round(55 * Math.pow(level + 1, 1.45));
}

/** Total coins to take one car from stock to fully maxed — used by the UI. */
export function fullUpgradeCost(): number {
  let total = 0;
  for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) total += upgradeCost(i) ?? 0;
  return total * STATS.length;
}

/** The finished multipliers the Player applies for a given car and its levels. */
export interface ResolvedStats {
  speed: number;
  accel: number;
  handling: number;
  nitro: number;
  shield: number;
  /** A fully upgraded shield track starts every run with a shield already up. */
  startsWithShield: boolean;
}

export function resolveStats(car: CarSpec, levels: Record<StatKey, number>): ResolvedStats {
  const boost = (stat: Exclude<StatKey, 'shield'>) => car.base[stat] * (1 + levels[stat] * UPGRADE_STEP);
  return {
    speed: boost('speed'),
    accel: boost('accel'),
    handling: boost('handling'),
    nitro: boost('nitro'),
    // Shield has no per-car baseline — every car starts equal on it
    shield: 1 + levels.shield * UPGRADE_STEP * 3,
    startsWithShield: levels.shield >= MAX_UPGRADE_LEVEL,
  };
}

/** 0..1 bar fill for the garage stat readouts. */
export function statBar(value: number): number {
  const MIN = 0.8;
  const MAX = 1.75;
  return Math.max(0, Math.min(1, (value - MIN) / (MAX - MIN)));
}
