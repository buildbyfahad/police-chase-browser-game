/**
 * Boot: bakes every procedural texture, then hands control to the DOM shell.
 * There are no network assets, so this is a single frame of work.
 */
import Phaser from 'phaser';
import { createTextures } from '../utils/Textures';
import { Bus, EVENT } from '../systems/EventBus';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  create(): void {
    createTextures(this);
    Bus.emit(EVENT.READY);
  }
}
