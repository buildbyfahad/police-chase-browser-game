/**
 * The DOM shell around the canvas: landing screen, pause, game over, touch
 * controls and the pause button.
 *
 * Nothing here updates during gameplay — the live HUD is drawn on the canvas.
 * This layer only reacts to state transitions.
 */
import { Audio } from '../game/systems/AudioManager';
import type { GameOverPayload } from '../game/systems/EventBus';
import { formatScore, formatTime } from '../game/systems/ScoreManager';
import { Storage, type ControlSide } from '../game/systems/StorageManager';
import { GarageUI } from './GarageUI';

export type GameState = 'MENU' | 'GARAGE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface UICallbacks {
  onPlay: () => void;
  onGarage: () => void;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onPause: () => void;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`UI element #${id} is missing from index.html`);
  return node as T;
}

export class UIManager {
  private readonly menu = el('screen-menu');
  private readonly pauseScreen = el('screen-pause');
  private readonly gameOver = el('screen-gameover');
  private readonly garageScreen = el('screen-garage');
  readonly garage = new GarageUI();
  private readonly touchControls = el('touch-controls');
  private readonly pauseBtn = el<HTMLButtonElement>('btn-pause');
  private readonly soundBtn = el<HTMLButtonElement>('btn-sound');
  private readonly sideBtn = el<HTMLButtonElement>('btn-side');
  private readonly boostBtn = el<HTMLButtonElement>('touch-controls').querySelector<HTMLElement>('.tc-boost')!;

  // Last pushed boost visuals, so we only touch the DOM when they change
  private lastBoosting: boolean | null = null;
  private lastFuelStep = -1;

  /** Touch controls are only mounted on devices that actually have a finger. */
  private readonly hasTouch =
    window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

  private state: GameState = 'MENU';
  private callbacks!: UICallbacks;

  get touchRoot(): HTMLElement {
    return this.touchControls;
  }

  init(callbacks: UICallbacks): void {
    this.callbacks = callbacks;

    this.bind('btn-play', () => this.callbacks.onPlay());
    this.bind('btn-garage', () => this.callbacks.onGarage());
    this.bind('btn-garage-back', () => this.setState('MENU'));
    this.bind('btn-resume', () => this.callbacks.onResume());
    this.bind('btn-restart-pause', () => this.callbacks.onRestart());
    this.bind('btn-home-pause', () => this.callbacks.onHome());
    this.bind('btn-again', () => this.callbacks.onRestart());
    this.bind('btn-home-over', () => this.callbacks.onHome());
    this.bind('btn-pause', () => this.callbacks.onPause());

    this.soundBtn.addEventListener('click', () => {
      // Toggling counts as the user gesture that unlocks audio
      Audio.unlock();
      const on = Audio.toggle();
      this.renderSoundButton(on);
      if (on) Audio.playButton();
    });

    this.sideBtn.addEventListener('click', () => {
      Audio.unlock();
      Audio.playButton();
      this.setControlSide(Storage.get('controlSide') === 'right' ? 'left' : 'right');
    });

    this.renderSoundButton(Audio.isEnabled());
    this.setControlSide(Storage.get('controlSide'));
    this.refreshMenuStats();
    this.positionPauseButton();

    window.addEventListener('resize', () => this.positionPauseButton());
    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => this.positionPauseButton(), 120);
    });
  }

  private bind(id: string, handler: () => void): void {
    el(id).addEventListener('click', () => {
      Audio.unlock();
      Audio.playButton();
      handler();
    });
  }

  /** Moves the pedal cluster to the player's preferred side and stores it. */
  private setControlSide(side: ControlSide): void {
    Storage.set('controlSide', side);
    this.touchControls.classList.toggle('side-left', side === 'left');
    this.sideBtn.textContent = `PEDALS: ${side.toUpperCase()}`;
  }

  /**
   * Reflects real boost state on the bottle: how much charge is left, whether
   * it is firing, and whether it is empty. Called only when something
   * actually changes, so gameplay never triggers needless DOM work.
   */
  setBoostState(boosting: boolean, fuel01: number, canFire: boolean): void {
    const step = Math.round(clamp(fuel01, 0, 1) * 20);
    if (step !== this.lastFuelStep) {
      this.lastFuelStep = step;
      this.boostBtn.style.setProperty('--boost-fuel', String(step / 20));
    }
    // "Empty" means too low to fire, not literally zero — nitro bottoms out
    // above zero and trickles back, so a bottle showing charge you cannot
    // actually spend would be a lie.
    if (!canFire !== this.boostBtn.classList.contains('is-empty')) {
      this.boostBtn.classList.toggle('is-empty', !canFire);
    }
    if (boosting !== this.lastBoosting) {
      this.lastBoosting = boosting;
      this.boostBtn.classList.toggle('is-boosting', boosting);
    }
  }

  /** Clears boost visuals between runs. */
  resetBoostState(): void {
    this.lastBoosting = null;
    this.lastFuelStep = -1;
    this.boostBtn.classList.remove('is-boosting', 'is-empty');
    this.boostBtn.style.setProperty('--boost-fuel', '1');
  }

  private renderSoundButton(on: boolean): void {
    this.soundBtn.textContent = `SOUND: ${on ? 'ON' : 'OFF'}`;
    this.soundBtn.setAttribute('aria-pressed', String(on));
  }

  /** Keeps the pause button pinned to the canvas, not the letterboxed page. */
  private positionPauseButton(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-root canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.pauseBtn.style.top = `${Math.max(8, rect.top + 10)}px`;
    this.pauseBtn.style.right = `${Math.max(8, window.innerWidth - rect.right + 10)}px`;
  }

  refreshMenuStats(): void {
    el('menu-best').textContent = formatScore(Storage.get('bestScore'));
    el('menu-coins').textContent = formatScore(Storage.get('totalCoins'));
  }

  setState(state: GameState): void {
    this.state = state;
    this.menu.classList.toggle('hidden', state !== 'MENU');
    this.pauseScreen.classList.toggle('hidden', state !== 'PAUSED');
    this.gameOver.classList.toggle('hidden', state !== 'GAME_OVER');
    this.garageScreen.classList.toggle('hidden', state !== 'GARAGE');
    if (state === 'GARAGE') this.garage.render();
    if (state === 'MENU') this.refreshMenuStats();

    const inPlay = state === 'PLAYING';
    this.touchControls.classList.toggle('hidden', !inPlay || !this.hasTouch);
    this.pauseBtn.classList.toggle('hidden', !inPlay);
    if (inPlay) this.positionPauseButton();
  }

  get current(): GameState {
    return this.state;
  }

  /** Fills in the game-over card and records the run. Returns the new best. */
  showGameOver(payload: GameOverPayload): void {
    const score = Math.floor(payload.score);
    const isBest = Storage.submitRun(score, payload.coins);

    el('go-reason').textContent = payload.reason === 'caught' ? 'YOU GOT CAUGHT' : 'YOU CRASHED';
    el('go-score').textContent = formatScore(score);
    el('go-distance').textContent = `${(payload.distanceM / 1000).toFixed(1)} KM`;
    el('go-time').textContent = formatTime(payload.elapsed);
    el('go-coins').textContent = formatScore(payload.coins);
    el('go-escaped').textContent = String(payload.policeEscaped);
    el('go-best').textContent = formatScore(Storage.get('bestScore'));
    el('go-highscore').classList.toggle('hidden', !isBest);

    this.refreshMenuStats();
    this.setState('GAME_OVER');
  }
}

export const UI = new UIManager();
