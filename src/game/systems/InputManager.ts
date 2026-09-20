/**
 * Unified input. Keyboard and touch both feed the same flat state object that
 * the Player reads once per frame — no per-frame DOM queries, no duplicated
 * control logic between platforms.
 */

export interface InputState {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  nitro: boolean;
}

type PauseHandler = () => void;

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'accelerate',
  KeyW: 'accelerate',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'nitro',
};

export class InputManager {
  readonly state: InputState = { left: false, right: false, accelerate: false, brake: false, nitro: false };

  private keyState: InputState = { left: false, right: false, accelerate: false, brake: false, nitro: false };
  private touchState: InputState = { left: false, right: false, accelerate: false, brake: false, nitro: false };

  private onPause: PauseHandler | null = null;
  private attached = false;
  private buttons: HTMLElement[] = [];

  /** True once any touch control has been used — drives the mobile HUD. */
  touchActive = false;

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      this.onPause?.();
      return;
    }
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    this.keyState[action] = true;
    this.sync();
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    this.keyState[action] = false;
    this.sync();
  };

  /** Losing focus mid-hold would otherwise leave a key stuck down. */
  private readonly handleBlur = (): void => {
    this.releaseAll();
  };

  attach(touchRoot: HTMLElement): void {
    if (this.attached) return;
    this.attached = true;

    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    window.addEventListener('blur', this.handleBlur);

    this.buttons = Array.from(touchRoot.querySelectorAll<HTMLElement>('[data-ctl]'));
    for (const btn of this.buttons) {
      const action = btn.dataset.ctl as keyof InputState;
      const press = (e: PointerEvent) => {
        e.preventDefault();
        this.touchActive = true;
        btn.classList.add('active');
        btn.setPointerCapture?.(e.pointerId);
        this.touchState[action] = true;
        this.sync();
      };
      const release = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.remove('active');
        this.touchState[action] = false;
        this.sync();
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  setPauseHandler(handler: PauseHandler | null): void {
    this.onPause = handler;
  }

  /** Clears every held control — used on pause, game over and focus loss. */
  releaseAll(): void {
    for (const key of Object.keys(this.state) as Array<keyof InputState>) {
      this.keyState[key] = false;
      this.touchState[key] = false;
    }
    for (const btn of this.buttons) btn.classList.remove('active');
    this.sync();
  }

  private sync(): void {
    for (const key of Object.keys(this.state) as Array<keyof InputState>) {
      this.state[key] = this.keyState[key] || this.touchState[key];
    }
  }
}

export const Input = new InputManager();
