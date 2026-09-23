/**
 * The garage screen: pick a car, spend coins on it.
 *
 * Purely presentational — every rule about what you own, what things cost and
 * what a purchase does lives in GarageManager, so this file can be rewritten
 * without touching the economy.
 */
import { MAX_UPGRADE_LEVEL, STATS, type StatKey } from '../game/config/Cars';
import { Garage } from '../game/systems/GarageManager';
import { Audio } from '../game/systems/AudioManager';
import { formatScore } from '../game/systems/ScoreManager';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`UI element #${id} is missing from index.html`);
  return node as T;
}

export class GarageUI {
  private readonly coins = el('garage-coins');
  private readonly cars = el('garage-cars');
  private readonly carName = el('garage-car-name');
  private readonly carBlurb = el('garage-car-blurb');
  private readonly upgrades = el('garage-upgrades');
  private readonly msg = el('garage-msg');

  private thumbnails: Record<string, string> = {};
  private msgTimer = 0;

  /** Car art comes from the game's own textures once boot has drawn them. */
  setThumbnails(map: Record<string, string>): void {
    this.thumbnails = map;
  }

  render(): void {
    this.coins.textContent = formatScore(Garage.coins());
    this.renderCars();
    this.renderUpgrades();
  }

  private renderCars(): void {
    const balance = Garage.coins();
    this.cars.replaceChildren(
      ...Garage.list().map(({ car, owned, selected }) => {
        const card = document.createElement('button');
        card.className = 'car-card';
        card.classList.toggle('is-selected', selected);
        card.classList.toggle('is-locked', !owned);

        const art = document.createElement('img');
        art.className = 'car-art';
        art.alt = car.name;
        art.src = this.thumbnails[car.id] ?? '';

        const name = document.createElement('span');
        name.className = 'car-name';
        name.textContent = car.name;

        const tag = document.createElement('span');
        if (owned) {
          tag.className = 'car-tag owned';
          tag.textContent = selected ? 'SELECTED' : 'OWNED';
        } else {
          tag.className = `car-tag ${balance >= car.price ? 'price' : 'cant'}`;
          tag.textContent = `${formatScore(car.price)} COINS`;
        }

        card.append(art, name, tag);
        card.addEventListener('click', () => this.onCarClick(car.id, owned));
        return card;
      }),
    );
  }

  private onCarClick(id: string, owned: boolean): void {
    Audio.playButton();
    if (owned) {
      Garage.select(id);
      this.render();
      return;
    }
    const result = Garage.buyCar(id);
    if (result === 'ok') {
      this.flash(`Unlocked. It's yours.`, 'good');
      Audio.playPowerUp();
    } else if (result === 'insufficient-funds') {
      this.flash('Not enough coins for that one yet.', 'bad');
    }
    this.render();
  }

  private renderUpgrades(): void {
    const id = Garage.selectedId();
    const car = Garage.selectedCar();
    const levels = Garage.levels(id);
    const balance = Garage.coins();

    this.carName.textContent = car.name;
    this.carBlurb.textContent = car.blurb;

    this.upgrades.replaceChildren(
      ...STATS.map(({ key, name }) => {
        const level = levels[key];
        const cost = Garage.nextCost(id, key);

        const row = document.createElement('div');
        row.className = 'up-row';

        const info = document.createElement('div');
        info.className = 'up-info';
        const label = document.createElement('span');
        label.className = 'up-name';
        label.textContent = name;
        const pips = document.createElement('div');
        pips.className = 'up-pips';
        for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
          const pip = document.createElement('span');
          pip.className = i < level ? 'pip on' : 'pip';
          pips.append(pip);
        }
        info.append(label, pips);

        const buy = document.createElement('button');
        buy.className = 'up-buy';
        if (cost === null) {
          buy.classList.add('is-max');
          buy.textContent = 'MAX';
          buy.disabled = true;
        } else {
          buy.classList.toggle('is-poor', balance < cost);
          buy.textContent = formatScore(cost);
          buy.addEventListener('click', () => this.onUpgradeClick(id, key));
        }

        row.append(info, buy);
        return row;
      }),
    );
  }

  private onUpgradeClick(carId: string, stat: StatKey): void {
    const result = Garage.buyUpgrade(carId, stat);
    if (result === 'ok') {
      Audio.playCoin();
      this.flash('Upgraded.', 'good');
    } else if (result === 'insufficient-funds') {
      Audio.playButton();
      this.flash('Not enough coins. Go earn some.', 'bad');
    }
    this.render();
  }

  private flash(text: string, tone: 'good' | 'bad'): void {
    this.msg.textContent = text;
    this.msg.className = `garage-msg ${tone}`;
    window.clearTimeout(this.msgTimer);
    this.msgTimer = window.setTimeout(() => {
      this.msg.textContent = '';
      this.msg.className = 'garage-msg';
    }, 2200);
  }
}
