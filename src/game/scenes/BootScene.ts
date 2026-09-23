/**
 * Boot: bakes every procedural texture, then hands control to the DOM shell.
 * There are no network assets, so this is a single frame of work.
 */
import Phaser from 'phaser';
import { carThumbnails, createTextures } from '../utils/Textures';
import { Bus, EVENT } from '../systems/EventBus';
import { UI } from '../../ui/UIManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  create(): void {
    createTextures(this);
    // Hand the car art to the DOM garage so both show the same sprites
    UI.garage.setThumbnails(carThumbnails(this));
    Bus.emit(EVENT.READY);
  }
}
