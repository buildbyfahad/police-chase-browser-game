/**
 * Ownership, purchases and upgrade levels.
 *
 * Sits between the save file and everything that cares about car stats, so the
 * garage screen and the game itself can never disagree about what you own or
 * how fast it is.
 */
import {
  CARS,
  DEFAULT_CAR,
  MAX_UPGRADE_LEVEL,
  STATS,
  carById,
  resolveStats,
  upgradeCost,
  upgradeKey,
  type CarSpec,
  type ResolvedStats,
  type StatKey,
} from '../config/Cars';
import { Storage } from './StorageManager';

export type PurchaseResult = 'ok' | 'insufficient-funds' | 'already-owned' | 'maxed';

class GarageManagerImpl {
  /** Every car, with whatever the player has done to it. */
  list(): Array<{ car: CarSpec; owned: boolean; selected: boolean; levels: Record<StatKey, number> }> {
    const owned = Storage.get('ownedCars');
    const selected = this.selectedId();
    return CARS.map((car) => ({
      car,
      owned: owned.includes(car.id),
      selected: car.id === selected,
      levels: this.levels(car.id),
    }));
  }

  selectedId(): string {
    const id = Storage.get('selectedCar');
    // Fall back if the save points at a car that is no longer owned or known
    return this.owns(id) ? id : DEFAULT_CAR;
  }

  selectedCar(): CarSpec {
    return carById(this.selectedId());
  }

  owns(id: string): boolean {
    return Storage.get('ownedCars').includes(id);
  }

  select(id: string): boolean {
    if (!this.owns(id)) return false;
    Storage.set('selectedCar', id);
    return true;
  }

  buyCar(id: string): PurchaseResult {
    if (this.owns(id)) return 'already-owned';
    const car = carById(id);
    if (!Storage.spendCoins(car.price)) return 'insufficient-funds';
    Storage.set('ownedCars', [...Storage.get('ownedCars'), id]);
    Storage.set('selectedCar', id);
    return 'ok';
  }

  /** Upgrade levels for one car, defaulting every track to zero. */
  levels(carId: string): Record<StatKey, number> {
    const saved = Storage.get('carUpgrades');
    const out = {} as Record<StatKey, number>;
    for (const { key } of STATS) {
      const raw = saved[upgradeKey(carId, key)];
      out[key] = typeof raw === 'number' ? Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(raw))) : 0;
    }
    return out;
  }

  /** Cost of the next level on a track, or null when it is maxed. */
  nextCost(carId: string, stat: StatKey): number | null {
    return upgradeCost(this.levels(carId)[stat]);
  }

  buyUpgrade(carId: string, stat: StatKey): PurchaseResult {
    const level = this.levels(carId)[stat];
    const cost = upgradeCost(level);
    if (cost === null) return 'maxed';
    if (!Storage.spendCoins(cost)) return 'insufficient-funds';
    Storage.set('carUpgrades', { ...Storage.get('carUpgrades'), [upgradeKey(carId, stat)]: level + 1 });
    return 'ok';
  }

  /** The multipliers the Player should run with this session. */
  activeStats(): ResolvedStats {
    const id = this.selectedId();
    return resolveStats(carById(id), this.levels(id));
  }

  coins(): number {
    return Storage.get('totalCoins');
  }
}

export const Garage = new GarageManagerImpl();
