/**
 * The play scene. It owns the managers and drives them in a fixed order each
 * frame; all rules live in the managers themselves, so this stays a readable
 * top-level description of what a frame of Police Chase actually is.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, NITRO_MIN_TO_FIRE } from '../config/GameConfig';
import { Player } from '../entities/Player';
import type { PickupKind } from '../entities/Pickup';
import { Audio } from '../systems/AudioManager';
import { CollisionManager } from '../systems/CollisionManager';
import { DifficultyManager } from '../systems/DifficultyManager';
import { EffectsManager } from '../systems/EffectsManager';
import { Bus, EVENT, type GameOverReason } from '../systems/EventBus';
import { Input } from '../systems/InputManager';
import { PickupManager } from '../systems/PickupManager';
import { PoliceManager } from '../systems/PoliceManager';
import { RoadManager } from '../systems/RoadManager';
import { ScoreManager } from '../systems/ScoreManager';
import { TrafficManager } from '../systems/TrafficManager';
import { createHudState, HudScene, type HudState } from './HudScene';
import { UI } from '../../ui/UIManager';

/** Longest frame step we'll simulate — protects against tab-switch spikes. */
const MAX_DT = 0.05;
/** Pause between the crash and the game-over card, so the wreck lands first. */
const OUTRO_MS = 1000;

const POWERUP_TINT: Record<PickupKind, number> = {
  coin: 0xffd24a,
  nitro: 0x63b4ff,
  shield: 0x5effb0,
  magnet: 0xf6a8ff,
};

export class GameScene extends Phaser.Scene {
  private road!: RoadManager;
  private player!: Player;
  private traffic!: TrafficManager;
  private police!: PoliceManager;
  private pickups!: PickupManager;
  private collisions!: CollisionManager;
  private effects!: EffectsManager;
  private difficulty!: DifficultyManager;
  private score!: ScoreManager;

  private hudState: HudState = createHudState();
  private running = false;
  private nearMissCooldown = 0;

  constructor() {
    super({ key: 'game' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070912');

    this.road = new RoadManager(this);
    this.player = new Player(this);
    this.traffic = new TrafficManager(this);
    this.pickups = new PickupManager(this, this.traffic);
    this.effects = new EffectsManager(this);
    this.difficulty = new DifficultyManager();
    this.score = new ScoreManager();

    this.police = new PoliceManager(this, {
      onEscape: () => {
        this.score.addEscape();
        this.effects.pop(GAME_WIDTH / 2, GAME_HEIGHT - 300, 'ESCAPED! +750', '#5effb0');
      },
      onCaught: () => this.endRun('caught'),
      onCatchProgress: (progress) => {
        this.hudState.catchProgress = progress;
      },
    });

    this.collisions = new CollisionManager(this.traffic, this.pickups, {
      onCoin: (x, y) => {
        this.score.addCoin();
        this.effects.coinBurst(x, y);
        Audio.playCoin();
      },
      onPowerUp: (kind, x, y) => this.applyPowerUp(kind, x, y),
      onCrash: (x, y) => {
        this.effects.crashBurst(x, y);
        this.endRun('crashed');
      },
      onShieldAbsorb: (x, y) => {
        this.effects.powerUpBurst(x, y, POWERUP_TINT.shield);
        this.effects.pop(x, y - 30, 'SHIELD USED', '#5effb0');
        this.cameras.main.shake(180, 0.008);
        Audio.playCrash();
      },
      onSpinOut: (x, y) => {
        this.effects.pop(x, y - 20, 'OIL!', '#c9cee0');
        this.cameras.main.shake(260, 0.01);
        Audio.playCrash();
      },
      onNearMiss: (x, y) => {
        if (this.nearMissCooldown > 0) return;
        this.nearMissCooldown = 0.35;
        this.score.addNearMiss();
        this.effects.pop(x, y - 40, 'NEAR MISS +60', '#8fd0ff');
        Audio.playNearMiss();
      },
    });

    this.scene.launch('hud', { state: this.hudState });
    if (import.meta.env.DEV) {
      // Dynamically imported so the bridge is absent from production builds
      void import('../utils/DebugBridge').then((m) =>
        m.attachDebugBridge(() => ({
          running: this.running,
          player: this.player,
          traffic: this.traffic,
          police: this.police,
          pickups: this.pickups,
          score: this.score,
          difficulty: this.difficulty,
        })),
      );
    }
    this.events.once('shutdown', () => this.cleanup());

    this.startRun();
  }

  private startRun(): void {
    this.player.reset();
    this.traffic.reset();
    this.police.reset();
    this.pickups.reset();
    this.difficulty.reset();
    this.score.reset();
    this.effects.reset();
    this.road.reset();
    this.hudState = Object.assign(this.hudState, createHudState());
    this.nearMissCooldown = 0;
    this.running = true;
    UI.resetBoostState();

    Audio.startEngine();
    Audio.startSiren();
    Audio.startMusic();
  }

  update(time: number, delta: number): void {
    if (!this.running) return;
    const dt = Math.min(delta / 1000, MAX_DT);

    this.difficulty.update(this.score.value.elapsed);
    const diff = this.difficulty.value;
    if (this.difficulty.levelChanged) {
      this.hudScene()?.announce(diff.label);
    }

    this.player.speedBonus = diff.roadSpeedBonus;
    this.player.update(dt, Input.state, time);

    if (this.player.nitroJustFired) {
      Audio.playNitro();
      this.effects.nitroKick();
    }

    const speed = this.player.speed;
    this.road.update(speed, dt);
    this.traffic.update(dt, speed, diff);
    this.pickups.update(dt, speed, time, this.player);
    this.police.update(dt, speed, this.player.x, diff);

    // Police may have ended the run inside its own update
    if (!this.running) return;

    this.collisions.check(this.player);
    if (!this.running) return;

    this.score.update(speed, dt);
    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt);

    this.effects.updateAmbient(speed, this.player.nitroActive, this.player.x, this.player.y);
    // The boost control mirrors real nitro state — charge left, firing, empty —
    // so a press with a dead bottle never looks like a boost.
    UI.setBoostState(
      this.player.nitroActive,
      this.player.nitroFuel / this.player.nitroCapacity,
      this.player.nitroActive || this.player.nitroFuel >= NITRO_MIN_TO_FIRE,
    );
    Audio.setEngine(this.player.throttle, this.player.nitroActive);
    Audio.setSirenProximity(this.police.proximity());

    this.syncHud(diff.label);
  }

  private syncHud(levelLabel: string): void {
    const s = this.hudState;
    const stats = this.score.value;
    s.score = this.score.score;
    s.distanceKm = this.score.distanceKm;
    s.coins = stats.coins;
    s.nitro = this.player.nitroFuel;
    s.nitroMax = this.player.nitroCapacity;
    s.nitroActive = this.player.nitroActive;
    s.shield = this.player.shieldActive;
    s.magnet = this.player.magnetActive;
    s.levelLabel = levelLabel;
  }

  private applyPowerUp(kind: PickupKind, x: number, y: number): void {
    const now = this.time.now;
    switch (kind) {
      case 'nitro':
        this.player.addNitro();
        this.effects.pop(x, y - 30, 'NITRO +45', '#8fd0ff');
        break;
      case 'shield':
        this.player.giveShield(now);
        this.effects.pop(x, y - 30, 'SHIELD', '#5effb0');
        break;
      case 'magnet':
        this.player.giveMagnet(now);
        this.effects.pop(x, y - 30, 'COIN MAGNET', '#f6a8ff');
        break;
      default:
        break;
    }
    this.effects.powerUpBurst(x, y, POWERUP_TINT[kind]);
    Audio.playPowerUp();
  }

  /* ---------------- end of run ---------------- */

  private endRun(reason: GameOverReason): void {
    if (!this.running) return;
    this.running = false;

    this.player.crash();
    Input.releaseAll();
    Audio.stopAll();
    Audio.playCrash();

    this.hudState.catchProgress = 0;

    if (reason === 'crashed') {
      this.tweens.add({
        targets: this.player,
        angle: Phaser.Math.Between(-55, 55),
        scale: 0.82,
        duration: 520,
        ease: 'Quad.easeOut',
      });
    } else {
      this.cameras.main.shake(260, 0.01);
      this.tweens.add({ targets: this.player, alpha: 0.35, yoyo: true, repeat: 3, duration: 130 });
    }

    // Let the wreck play out before the card covers the screen
    this.time.delayedCall(OUTRO_MS, () => {
      Bus.emit(EVENT.OVER, { ...this.score.value, reason });
    });
  }

  private hudScene(): HudScene | undefined {
    return this.scene.get('hud') as HudScene | undefined;
  }

  private cleanup(): void {
    this.running = false;
    Audio.stopAll();
    this.scene.stop('hud');
    this.road.destroy();
    this.traffic.destroy();
    this.police.destroy();
    this.pickups.destroy();
    this.effects.destroy();
    this.player.destroy();
  }
}
