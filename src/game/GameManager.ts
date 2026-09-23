/**
 * Top-level state machine: MENU → PLAYING → PAUSED → GAME_OVER.
 *
 * It owns the Phaser game instance and is the only place that starts, pauses
 * or tears down scenes, so there is exactly one authority on what the game is
 * currently doing.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/GameConfig';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { Audio } from './systems/AudioManager';
import { Bus, EVENT, type GameOverPayload } from './systems/EventBus';
import { Input } from './systems/InputManager';
import { UI } from '../ui/UIManager';

export class GameManager {
  private game: Phaser.Game;

  constructor(parent: HTMLElement) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#070912',
      scale: {
        mode: Phaser.Scale.FIT,
        // #game-root already centres the canvas with flexbox. Letting Phaser
        // also apply centring margins would offset it twice, which shows up
        // as a canvas pinned to the right in wide/landscape viewports.
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: {
        antialias: true,
        powerPreference: 'high-performance',
        roundPixels: false,
      },
      // The game is entirely tween/manager driven; no physics engine needed.
      scene: [BootScene, GameScene, HudScene],
      audio: { noAudio: true }, // audio is synthesised by our own AudioManager
    });

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__PHASER_GAME__ = this.game;
    }

    UI.init({
      onPlay: () => this.startGame(),
      onGarage: () => UI.setState('GARAGE'),
      onResume: () => this.resume(),
      onRestart: () => this.startGame(),
      onHome: () => this.goHome(),
      onPause: () => this.togglePause(),
    });

    Input.attach(UI.touchRoot);
    Input.setPauseHandler(() => this.togglePause());

    Bus.on(EVENT.READY, () => {
      UI.setState('MENU');
      UI.refreshMenuStats();
    });

    Bus.on(EVENT.OVER, (payload: GameOverPayload) => {
      this.game.scene.pause('game');
      this.game.scene.pause('hud');
      UI.showGameOver(payload);
    });

    // Backgrounding the tab mid-run shouldn't cost the player their score
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && UI.current === 'PLAYING') this.pause();
    });
  }

  /* ---------------- transitions ---------------- */

  private startGame(): void {
    Audio.unlock();
    Audio.setSuspended(false);
    Audio.stopAll();
    Input.releaseAll();

    this.game.scene.stop('hud');
    this.game.scene.stop('game');
    this.game.scene.start('game');

    UI.setState('PLAYING');
  }

  private togglePause(): void {
    if (UI.current === 'PLAYING') this.pause();
    else if (UI.current === 'PAUSED') this.resume();
  }

  private pause(): void {
    if (UI.current !== 'PLAYING') return;
    Input.releaseAll();
    this.game.scene.pause('game');
    this.game.scene.pause('hud');
    Audio.setSuspended(true);
    UI.setState('PAUSED');
  }

  private resume(): void {
    if (UI.current !== 'PAUSED') return;
    Audio.setSuspended(false);
    this.game.scene.resume('game');
    this.game.scene.resume('hud');
    UI.setState('PLAYING');
  }

  private goHome(): void {
    Audio.setSuspended(false);
    Audio.stopAll();
    Input.releaseAll();
    this.game.scene.stop('hud');
    this.game.scene.stop('game');
    UI.setState('MENU');
    UI.refreshMenuStats();
  }
}
