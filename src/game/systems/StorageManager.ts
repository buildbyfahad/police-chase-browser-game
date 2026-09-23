/**
 * Thin, fail-safe wrapper around localStorage.
 *
 * Every read is guarded: private browsing, blocked site data and cleared
 * storage must never break the game. Swapping this file for an HTTP-backed
 * implementation later is the only change a backend would require.
 */

/** Which side of the screen the pedal cluster sits on. */
export type ControlSide = 'left' | 'right';

export interface SaveData {
  bestScore: number;
  totalCoins: number;
  soundEnabled: boolean;
  controlSide: ControlSide;
  selectedCar: string;
  /** Ids of every car the player owns. The starter car is always present. */
  ownedCars: string[];
  /** Upgrade levels keyed "carId.stat", e.g. "muscle.handling". */
  carUpgrades: Record<string, number>;
}

const KEY = 'police-chase:save:v1';

const DEFAULTS: SaveData = {
  bestScore: 0,
  totalCoins: 0,
  soundEnabled: true,
  controlSide: 'right',
  selectedCar: 'street',
  ownedCars: ['street'],
  carUpgrades: {},
};

class StorageManagerImpl {
  private cache: SaveData;

  constructor() {
    this.cache = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        bestScore: numberOr(parsed.bestScore, DEFAULTS.bestScore),
        totalCoins: numberOr(parsed.totalCoins, DEFAULTS.totalCoins),
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULTS.soundEnabled,
        controlSide: parsed.controlSide === 'left' ? 'left' : DEFAULTS.controlSide,
        selectedCar: typeof parsed.selectedCar === 'string' ? parsed.selectedCar : DEFAULTS.selectedCar,
        ownedCars: sanitiseOwned(parsed.ownedCars),
        carUpgrades: parsed.carUpgrades && typeof parsed.carUpgrades === 'object' ? parsed.carUpgrades : {},
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.cache));
    } catch {
      /* storage unavailable — the session still plays, it just won't be saved */
    }
  }

  get<K extends keyof SaveData>(key: K): SaveData[K] {
    return this.cache[key];
  }

  set<K extends keyof SaveData>(key: K, value: SaveData[K]): void {
    this.cache[key] = value;
    this.persist();
  }

  /** Deducts a purchase. Returns false (and changes nothing) if short. */
  spendCoins(amount: number): boolean {
    if (amount < 0 || this.cache.totalCoins < amount) return false;
    this.cache.totalCoins -= amount;
    this.persist();
    return true;
  }

  /** Records a finished run. Returns true when it beat the stored best. */
  submitRun(score: number, coins: number): boolean {
    const isBest = score > this.cache.bestScore;
    if (isBest) this.cache.bestScore = Math.floor(score);
    this.cache.totalCoins += coins;
    this.persist();
    return isBest;
  }
}

/** The starter car can never be missing, however mangled the saved data is. */
function sanitiseOwned(value: unknown): string[] {
  const list = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  return list.includes('street') ? list : ['street', ...list];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const Storage = new StorageManagerImpl();
