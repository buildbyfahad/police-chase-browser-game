/**
 * All audio is synthesised with the Web Audio API — no sound files to
 * download, so the game stays instant-loading.
 *
 * The AudioContext is only created from a real user gesture (the PLAY tap),
 * which keeps us on the right side of browser autoplay policy.
 */
import { Storage } from './StorageManager';

type Ctx = AudioContext;

export class AudioManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private enabled: boolean;

  // Continuous voices
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  // Music scheduler
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.enabled = Storage.get('soundEnabled');
  }

  /* ---------------- lifecycle ---------------- */

  /** Must be called from a user-gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(this.ctx);
    } catch {
      this.ctx = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    Storage.set('soundEnabled', on);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /** Pause/resume every running voice (used by the pause screen). */
  setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    if (suspended && this.ctx.state === 'running') void this.ctx.suspend();
    if (!suspended && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Tears down every continuous voice. Called whenever a run ends. */
  stopAll(): void {
    this.stopEngine();
    this.stopSiren();
    this.stopMusic();
  }

  /* ---------------- one-shots ---------------- */

  playCoin(): void {
    this.blip([1320, 1980], 0.09, 'square', 0.16);
  }

  playPowerUp(): void {
    this.blip([440, 660, 880, 1320], 0.22, 'triangle', 0.2);
  }

  playButton(): void {
    this.blip([520, 700], 0.07, 'square', 0.12);
  }

  playNitro(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(4200, t + 0.45);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  playCrash(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.85);

    // Low thud underneath the debris
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  playNearMiss(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.3);
  }

  private blip(freqs: number[], dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const step = dur / freqs.length;
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + step * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + step);
      osc.connect(gain).connect(this.master!);
      osc.start(t);
      osc.stop(t + step + 0.02);
    });
  }

  /* ---------------- engine ---------------- */

  startEngine(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.engineOsc) return;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.1;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 3;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 70;

    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'square';
    this.engineSub.frequency.value = 35;

    this.engineOsc.connect(this.engineFilter);
    this.engineSub.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    this.engineSub.start();
  }

  /** `throttle` is 0..1 (idle → redline), `boost` adds nitro snarl. */
  setEngine(throttle: number, boost: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.engineOsc || !this.engineSub || !this.engineFilter || !this.engineGain) return;
    const t = ctx.currentTime;
    const base = 62 + throttle * 96 + (boost ? 34 : 0);
    this.engineOsc.frequency.setTargetAtTime(base, t, 0.08);
    this.engineSub.frequency.setTargetAtTime(base * 0.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(520 + throttle * 1500 + (boost ? 900 : 0), t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.085 + throttle * 0.05 + (boost ? 0.05 : 0), t, 0.1);
  }

  stopEngine(): void {
    this.engineOsc?.stop();
    this.engineSub?.stop();
    this.engineOsc?.disconnect();
    this.engineSub?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.engineOsc = this.engineSub = null;
    this.engineFilter = null;
    this.engineGain = null;
  }

  /* ---------------- siren ---------------- */

  startSiren(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.sirenOsc) return;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;

    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.value = 760;

    // LFO sweeps the siren pitch for the classic wail
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = 'triangle';
    this.sirenLfo.frequency.value = 0.85;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 240;
    this.sirenLfo.connect(lfoDepth).connect(this.sirenOsc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 2.5;

    this.sirenOsc.connect(filter).connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  /** `proximity` 0 (far) .. 1 (right behind you). */
  setSirenProximity(proximity: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sirenGain || !this.sirenLfo) return;
    const t = ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(0.02 + proximity * 0.1, t, 0.15);
    this.sirenLfo.frequency.setTargetAtTime(0.7 + proximity * 1.1, t, 0.2);
  }

  stopSiren(): void {
    this.sirenOsc?.stop();
    this.sirenLfo?.stop();
    this.sirenOsc?.disconnect();
    this.sirenLfo?.disconnect();
    this.sirenGain?.disconnect();
    this.sirenOsc = this.sirenLfo = null;
    this.sirenGain = null;
  }

  /* ---------------- music ---------------- */

  private static readonly BASS = [55, 55, 82.4, 55, 73.4, 73.4, 61.7, 65.4];

  startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.musicTimer !== null) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    // Lookahead scheduler: cheap, jitter-free, and independent of frame rate
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 40);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicGain?.disconnect();
    this.musicGain = null;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const spb = 60 / 132 / 2; // eighth notes at 132bpm
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const t = this.nextNoteTime;
      const i = this.step % 8;

      // Bass pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = AudioManager.BASS[i];
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(220, t + spb);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.32, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.95);
      osc.connect(f).connect(gain).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + spb);

      // Off-beat hat
      if (this.noiseBuffer && i % 2 === 1) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hf = ctx.createBiquadFilter();
        hf.type = 'highpass';
        hf.frequency.value = 7000;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.1, t);
        hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(hf).connect(hg).connect(this.musicGain);
        src.start(t);
        src.stop(t + 0.06);
      }

      this.nextNoteTime += spb;
      this.step++;
    }
  }

  /* ---------------- helpers ---------------- */

  private makeNoise(ctx: Ctx): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.9);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

export const Audio = new AudioManager();
