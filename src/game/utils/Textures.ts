/**
 * Procedural art. Every sprite in the game is drawn here at boot and baked
 * into a GPU texture, so the game ships with zero image assets and loads
 * instantly. Textures are rendered at TEX_SCALE and displayed at 1x, which
 * keeps them crisp on high-DPI and on large desktop screens.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, LANE_COUNT, LANE_WIDTH, ROAD_WIDTH, TRAFFIC_KINDS } from '../config/GameConfig';
import { CARS } from '../config/Cars';

export const TEX_SCALE = 2;

/**
 * Car sprites as data URLs, so the DOM garage screen can show the exact same
 * art the game draws without a second set of assets.
 */
export function carThumbnails(scene: Phaser.Scene): Record<string, string> {
  const out: Record<string, string> = {};
  for (const car of CARS) {
    const source = scene.textures.get(`tex-car-${car.id}`).getSourceImage();
    if (source instanceof HTMLCanvasElement) out[car.id] = source.toDataURL();
  }
  return out;
}

const ROAD_TILE_H = 160;
const GROUND_TILE_H = 300;

interface CarPalette {
  body: number;
  bodyDark: number;
  cabin: number;
  glass: number;
  accent?: number;
}

const PALETTES: Record<string, CarPalette> = {
  player: { body: 0xff8a1f, bodyDark: 0xc4590a, cabin: 0x2b1405, glass: 0x7fd4ff, accent: 0xfff0c9 },
  'car-blue': { body: 0x3d7bf0, bodyDark: 0x244a94, cabin: 0x16233f, glass: 0x9cd8ff },
  'car-green': { body: 0x2fbf6b, bodyDark: 0x1c7743, cabin: 0x123424, glass: 0x9cd8ff },
  suv: { body: 0xb7b9c6, bodyDark: 0x74778a, cabin: 0x2a2d3c, glass: 0xaee0ff },
  truck: { body: 0xe0e3ee, bodyDark: 0x9296a8, cabin: 0x2a2d3c, glass: 0xaee0ff },
  bus: { body: 0xf2c33c, bodyDark: 0xa8811c, cabin: 0x2f2711, glass: 0xaee0ff },
  police: { body: 0xf4f6ff, bodyDark: 0x1d2742, cabin: 0x101828, glass: 0x8fd0ff, accent: 0x2f5fd0 },
};

export function createTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  // --- Vehicles ---
  // One sprite per garage car, so switching cars is a texture swap
  for (const car of CARS) {
    drawVehicle(g, `tex-car-${car.id}`, 50, 92, car.palette, 'player');
  }
  for (const kind of TRAFFIC_KINDS) {
    const style = kind.key === 'truck' || kind.key === 'bus' ? 'heavy' : 'car';
    drawVehicle(g, `tex-${kind.key}`, kind.width, kind.height, PALETTES[kind.key], style);
  }
  drawVehicle(g, 'tex-police', 48, 94, PALETTES.police, 'police');

  // --- Pickups ---
  drawCoin(g);
  drawNitroPickup(g);
  drawShieldPickup(g);
  drawMagnetPickup(g);
  drawCone(g);
  drawOilSlick(g);

  // --- Scrolling surfaces ---
  drawRoad(g);
  drawGround(g);

  // --- Effects ---
  drawSpark(g);
  drawShieldBubble(g);
  g.destroy();

  drawGlow(scene, 'tex-glow', 64, 0xffffff);
  drawGlow(scene, 'tex-glow-blue', 64, 0x63b4ff);
  drawGlow(scene, 'tex-glow-red', 64, 0xff4a5e);
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

type VehicleStyle = 'car' | 'heavy' | 'police' | 'player';

function drawVehicle(
  g: Phaser.GameObjects.Graphics,
  key: string,
  w: number,
  h: number,
  pal: CarPalette,
  style: VehicleStyle,
): void {
  const s = TEX_SCALE;
  const W = w * s;
  const H = h * s;
  const pad = 4 * s; // room for the drop shadow
  g.clear();

  // Drop shadow
  g.fillStyle(0x000000, 0.32);
  g.fillRoundedRect(pad * 0.6, pad * 1.2, W, H, 8 * s);

  // Wheels poke out from under the chassis
  const wheelW = 5 * s;
  const wheelH = H * 0.16;
  g.fillStyle(0x0d0f16, 1);
  for (const wy of [H * 0.17, H * 0.66]) {
    g.fillRoundedRect(0, wy, wheelW + 2 * s, wheelH, 2 * s);
    g.fillRoundedRect(W - wheelW - 2 * s, wy, wheelW + 2 * s, wheelH, 2 * s);
  }

  // Chassis
  const bx = wheelW * 0.5;
  const bw = W - wheelW;
  g.fillStyle(pal.bodyDark, 1);
  g.fillRoundedRect(bx, 0, bw, H, 9 * s);
  g.fillStyle(pal.body, 1);
  g.fillRoundedRect(bx + 1.5 * s, 1.5 * s, bw - 3 * s, H - 3 * s, 8 * s);

  // Cabin block
  const cabY = style === 'heavy' ? H * 0.06 : H * 0.24;
  const cabH = style === 'heavy' ? H * 0.26 : H * 0.44;
  g.fillStyle(pal.cabin, 1);
  g.fillRoundedRect(bx + 4 * s, cabY, bw - 8 * s, cabH, 5 * s);

  // Windscreen + rear glass
  g.fillStyle(pal.glass, 0.92);
  g.fillRoundedRect(bx + 6 * s, cabY + 2.5 * s, bw - 12 * s, cabH * 0.36, 3 * s);
  g.fillStyle(pal.glass, 0.55);
  g.fillRoundedRect(bx + 6 * s, cabY + cabH - cabH * 0.32, bw - 12 * s, cabH * 0.26, 3 * s);

  if (style === 'heavy') {
    // Cargo box ribs
    g.fillStyle(pal.bodyDark, 0.55);
    for (let i = 0; i < 5; i++) {
      g.fillRect(bx + 5 * s, H * 0.42 + i * (H * 0.1), bw - 10 * s, 2 * s);
    }
  }

  if (style === 'player') {
    // Racing stripes
    g.fillStyle(pal.accent!, 0.9);
    g.fillRect(W * 0.5 - 5 * s, 3 * s, 3.5 * s, H - 6 * s);
    g.fillRect(W * 0.5 + 1.5 * s, 3 * s, 3.5 * s, H - 6 * s);
  }

  if (style === 'police') {
    // Chequer band down each flank
    g.fillStyle(pal.accent!, 1);
    g.fillRect(bx + 2 * s, H * 0.3, 6 * s, H * 0.4);
    g.fillRect(bx + bw - 8 * s, H * 0.3, 6 * s, H * 0.4);
    // Roof light bar housing (the flashing colours are separate sprites)
    g.fillStyle(0x151b2c, 1);
    g.fillRoundedRect(bx + 6 * s, cabY + cabH * 0.42, bw - 12 * s, 7 * s, 2 * s);
  }

  // Head- and tail-lights
  g.fillStyle(0xfff6d8, 1);
  g.fillRoundedRect(bx + 4 * s, 2 * s, 8 * s, 4 * s, 2 * s);
  g.fillRoundedRect(bx + bw - 12 * s, 2 * s, 8 * s, 4 * s, 2 * s);
  g.fillStyle(0xff3b3b, 1);
  g.fillRoundedRect(bx + 4 * s, H - 6 * s, 8 * s, 4 * s, 2 * s);
  g.fillRoundedRect(bx + bw - 12 * s, H - 6 * s, 8 * s, 4 * s, 2 * s);

  g.generateTexture(key, W + pad, H + pad * 1.4);
}

/* ------------------------------------------------------------------ */
/* Pickups                                                             */
/* ------------------------------------------------------------------ */

function drawCoin(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const r = 13 * s;
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillCircle(r + 1.5 * s, r + 2.5 * s, r);
  g.fillStyle(0xb8860b, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(0xffd24a, 1);
  g.fillCircle(r, r, r * 0.86);
  g.fillStyle(0xfff3b0, 1);
  g.fillCircle(r, r, r * 0.6);
  g.fillStyle(0xd99a12, 1);
  // Simple coin face: a chunky star
  star(g, r, r, r * 0.46, r * 0.2, 5);
  g.generateTexture('tex-coin', r * 2 + 3 * s, r * 2 + 4 * s);
}

function drawNitroPickup(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const S = 36 * s;
  g.clear();
  pickupPlate(g, S, 0x0d2a5c, 0x2f7bff, 0x8fd0ff);
  // Lightning bolt
  g.fillStyle(0xfdfdff, 1);
  g.beginPath();
  g.moveTo(S * 0.56, S * 0.18);
  g.lineTo(S * 0.34, S * 0.54);
  g.lineTo(S * 0.48, S * 0.54);
  g.lineTo(S * 0.42, S * 0.84);
  g.lineTo(S * 0.68, S * 0.44);
  g.lineTo(S * 0.52, S * 0.44);
  g.lineTo(S * 0.62, S * 0.18);
  g.closePath();
  g.fillPath();
  g.generateTexture('tex-pickup-nitro', S, S);
}

function drawShieldPickup(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const S = 36 * s;
  g.clear();
  pickupPlate(g, S, 0x073527, 0x22c37a, 0x9cffd4);
  g.fillStyle(0xfdfdff, 1);
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.17);
  g.lineTo(S * 0.79, S * 0.3);
  g.lineTo(S * 0.79, S * 0.55);
  g.lineTo(S * 0.5, S * 0.85);
  g.lineTo(S * 0.21, S * 0.55);
  g.lineTo(S * 0.21, S * 0.3);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x22c37a, 1);
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.27);
  g.lineTo(S * 0.7, S * 0.36);
  g.lineTo(S * 0.7, S * 0.53);
  g.lineTo(S * 0.5, S * 0.74);
  g.lineTo(S * 0.3, S * 0.53);
  g.lineTo(S * 0.3, S * 0.36);
  g.closePath();
  g.fillPath();
  g.generateTexture('tex-pickup-shield', S, S);
}

function drawMagnetPickup(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const S = 36 * s;
  g.clear();
  pickupPlate(g, S, 0x3b0a36, 0xc040c8, 0xf6a8ff);
  // Horseshoe magnet
  g.lineStyle(6.5 * s, 0xfdfdff, 1);
  g.beginPath();
  g.arc(S * 0.5, S * 0.5, S * 0.22, Math.PI, 0, false);
  g.strokePath();
  g.lineBetween(S * 0.28, S * 0.5, S * 0.28, S * 0.76);
  g.lineBetween(S * 0.72, S * 0.5, S * 0.72, S * 0.76);
  g.lineStyle(6.5 * s, 0xff4a5e, 1);
  g.lineBetween(S * 0.28, S * 0.7, S * 0.28, S * 0.8);
  g.lineBetween(S * 0.72, S * 0.7, S * 0.72, S * 0.8);
  g.generateTexture('tex-pickup-magnet', S, S);
}

function pickupPlate(
  g: Phaser.GameObjects.Graphics,
  S: number,
  dark: number,
  mid: number,
  light: number,
): void {
  const r = S * 0.26;
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(S * 0.05, S * 0.09, S * 0.92, S * 0.92, r);
  g.fillStyle(light, 1);
  g.fillRoundedRect(0, 0, S, S, r);
  g.fillStyle(mid, 1);
  g.fillRoundedRect(S * 0.05, S * 0.05, S * 0.9, S * 0.9, r * 0.9);
  g.fillStyle(dark, 1);
  g.fillRoundedRect(S * 0.11, S * 0.11, S * 0.78, S * 0.78, r * 0.8);
}

function drawCone(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const S = 30 * s;
  g.clear();
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(S * 0.5 + 2 * s, S * 0.82, S * 0.8, S * 0.26);
  g.fillStyle(0x2a2f3d, 1);
  g.fillEllipse(S * 0.5, S * 0.78, S * 0.86, S * 0.28);
  g.fillStyle(0xff6a18, 1);
  g.fillCircle(S * 0.5, S * 0.5, S * 0.3);
  g.fillStyle(0xffe9d6, 1);
  g.fillCircle(S * 0.5, S * 0.5, S * 0.19);
  g.fillStyle(0xff6a18, 1);
  g.fillCircle(S * 0.5, S * 0.5, S * 0.1);
  g.generateTexture('tex-cone', S, S);
}

function drawOilSlick(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const W = 60 * s;
  const H = 40 * s;
  g.clear();
  g.fillStyle(0x0a0c14, 0.82);
  g.fillEllipse(W * 0.5, H * 0.5, W, H);
  g.fillStyle(0x2b3350, 0.6);
  g.fillEllipse(W * 0.42, H * 0.44, W * 0.5, H * 0.42);
  g.fillStyle(0x4a3f6b, 0.45);
  g.fillEllipse(W * 0.62, H * 0.6, W * 0.3, H * 0.24);
  g.generateTexture('tex-oil', W, H);
}

/* ------------------------------------------------------------------ */
/* Scrolling surfaces                                                  */
/* ------------------------------------------------------------------ */

function drawRoad(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const W = ROAD_WIDTH * s;
  const H = ROAD_TILE_H * s;
  g.clear();

  g.fillStyle(0x24262f, 1);
  g.fillRect(0, 0, W, H);

  // Asphalt grain — deterministic so the tile edges always line up
  for (let i = 0; i < 90; i++) {
    const x = pseudo(i * 3.1) * W;
    const y = pseudo(i * 7.7) * H;
    g.fillStyle(0x2c2f39, 0.55);
    g.fillRect(x, y, 3 * s + pseudo(i) * 6 * s, 2 * s);
  }
  // Worn wheel tracks
  g.fillStyle(0x1f2129, 0.35);
  for (let l = 0; l < LANE_COUNT; l++) {
    const cx = (LANE_WIDTH * (l + 0.5)) * s;
    g.fillRect(cx - 17 * s, 0, 9 * s, H);
    g.fillRect(cx + 8 * s, 0, 9 * s, H);
  }

  // Dashed lane dividers
  g.fillStyle(0xf3f4f8, 0.8);
  const dashH = 44 * s;
  const gap = 36 * s;
  for (let l = 1; l < LANE_COUNT; l++) {
    const x = LANE_WIDTH * l * s - 2 * s;
    for (let y = 0; y < H; y += dashH + gap) {
      g.fillRect(x, y, 4 * s, Math.min(dashH, H - y));
    }
  }

  // Solid edge lines
  g.fillStyle(0xf3f4f8, 0.85);
  g.fillRect(5 * s, 0, 4 * s, H);
  g.fillRect(W - 9 * s, 0, 4 * s, H);

  g.generateTexture('tex-road', W, H);
}

function drawGround(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const W = GAME_WIDTH * s;
  const H = GROUND_TILE_H * s;
  const roadLeft = ((GAME_WIDTH - ROAD_WIDTH) / 2) * s;
  const roadRight = roadLeft + ROAD_WIDTH * s;
  g.clear();

  // Night ground
  g.fillStyle(0x121626, 1);
  g.fillRect(0, 0, W, H);

  // City blocks / rooftops in the outer margin
  const blocks: Array<[number, number, number, number, number]> = [
    [2, 8, 46, 92, 0x1c2238],
    [6, 128, 40, 74, 0x222842],
    [0, 222, 50, 66, 0x191f33],
    [W / s - 50, 20, 46, 86, 0x1e2439],
    [W / s - 44, 132, 40, 70, 0x232946],
    [W / s - 52, 226, 48, 60, 0x1a2034],
  ];
  for (const [bx, by, bw, bh, colour] of blocks) {
    g.fillStyle(colour, 1);
    g.fillRect(bx * s, by * s, bw * s, bh * s);
    g.fillStyle(0x2f3757, 1);
    g.fillRect(bx * s, by * s, bw * s, 4 * s);
    // Lit windows
    g.fillStyle(0xffd98a, 0.5);
    for (let i = 0; i < 4; i++) {
      if (pseudo(bx + by + i * 11) > 0.45) {
        g.fillRect((bx + 7 + (i % 2) * 18) * s, (by + 16 + Math.floor(i / 2) * 22) * s, 9 * s, 7 * s);
      }
    }
  }

  // Grass verge next to the road
  g.fillStyle(0x16301f, 1);
  g.fillRect(52 * s, 0, roadLeft - 52 * s, H);
  g.fillRect(roadRight, 0, W - roadRight - 52 * s, H);

  // Trees
  for (const [tx, ty] of [[62, 40], [64, 178], [60, 272], [W / s - 62, 96], [W / s - 60, 214]] as const) {
    g.fillStyle(0x0b1a12, 0.6);
    g.fillCircle(tx * s + 3 * s, ty * s + 4 * s, 13 * s);
    g.fillStyle(0x1f7a45, 1);
    g.fillCircle(tx * s, ty * s, 13 * s);
    g.fillStyle(0x2aa35c, 1);
    g.fillCircle(tx * s - 3 * s, ty * s - 3 * s, 8 * s);
  }

  // Street lights: pole on the verge, lamp head leaning over the road
  for (const [lx, ly, dir] of [[roadLeft / s - 12, 60, 1], [roadRight / s + 12, 200, -1]] as const) {
    g.fillStyle(0x394158, 1);
    g.fillRect(lx * s - 2 * s, ly * s, 4 * s, 46 * s);
    g.fillRect(lx * s, ly * s, dir * 24 * s, 4 * s);
    g.fillStyle(0xffe7a8, 0.95);
    g.fillCircle(lx * s + dir * 24 * s, ly * s + 3 * s, 5 * s);
    g.fillStyle(0xffe7a8, 0.12);
    g.fillCircle(lx * s + dir * 24 * s, ly * s + 3 * s, 20 * s);
  }

  // Crash barriers hugging both road edges
  for (const edge of [roadLeft - 11 * s, roadRight + 3 * s]) {
    g.fillStyle(0x20263a, 1);
    g.fillRect(edge, 0, 8 * s, H);
    g.fillStyle(0xc9cee0, 0.9);
    for (let y = 0; y < H; y += 30 * s) {
      g.fillRect(edge + 1 * s, y, 6 * s, 18 * s);
    }
    g.fillStyle(0xff5a3c, 0.85);
    for (let y = 12 * s; y < H; y += 120 * s) {
      g.fillRect(edge + 1 * s, y, 6 * s, 8 * s);
    }
  }

  g.generateTexture('tex-ground', W, H);
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

function drawSpark(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const r = 6 * s;
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r, r, r);
  g.generateTexture('tex-spark', r * 2, r * 2);
}

function drawShieldBubble(g: Phaser.GameObjects.Graphics): void {
  const s = TEX_SCALE;
  const r = 44 * s;
  g.clear();
  g.fillStyle(0x22c37a, 0.14);
  g.fillCircle(r, r, r);
  g.lineStyle(3 * s, 0x5effb0, 0.85);
  g.strokeCircle(r, r, r - 2 * s);
  g.lineStyle(1.5 * s, 0x9cffd4, 0.5);
  g.strokeCircle(r, r, r - 9 * s);
  g.generateTexture('tex-shield-bubble', r * 2, r * 2);
}

/** Radial-gradient glow — needs a real canvas, Graphics has no gradients. */
function drawGlow(scene: Phaser.Scene, key: string, size: number, colour: number): void {
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = Phaser.Display.Color.IntegerToRGB(colour);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},1)`);
  grad.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},0.45)`);
  grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

/* ------------------------------------------------------------------ */

function star(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outer: number, inner: number, points: number): void {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/** Deterministic pseudo-random in [0,1) — keeps baked textures stable. */
function pseudo(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
