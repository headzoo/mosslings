import type { MapData } from "./map";
import { FRAME_COUNT, SPRITE_SIZE } from "./mossling-detail";

type Rgb = readonly [number, number, number];

const RIM: Rgb = [168, 48, 18];
const ORANGE: Rgb = [255, 112, 28];
const CORE: Rgb = [255, 244, 170];

const LEANS = [0, -2, 1.5, -0.6] as const;
const TONGUES = [9, 13, 6, 11] as const;

const pixels = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE * 4);

function offsetOf(frame: number, x: number, y: number) {
  return ((frame * SPRITE_SIZE + y) * SPRITE_SIZE + x) * 4;
}

function plot(frame: number, x: number, y: number, color: Rgb) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE) return;
  const offset = offsetOf(frame, px, py);
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = 255;
}

function heatColor(edge: number): Rgb {
  if (edge < 0.45) return CORE;
  if (edge < 0.82) return ORANGE;
  return RIM;
}

function drawFlame(frame: number) {
  const lean = LEANS[frame] ?? 0;
  const tongue = TONGUES[frame] ?? 9;
  const bodyCx = 15.5 + lean;
  const bodyCy = 18;
  const bodyRx = 14;
  const bodyRy = 12;
  const tongueCx = 15.5 + lean * 1.3;
  const tongueCy = bodyCy - 4 - tongue * 0.35;
  const tongueRx = 6.4;
  const tongueRy = tongue;
  const hotX = bodyCx;
  const hotY = bodyCy - 2;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const bx = (x + 0.5 - bodyCx) / bodyRx;
      const by = (y + 0.5 - bodyCy) / bodyRy;
      const tx = (x + 0.5 - tongueCx) / tongueRx;
      const ty = (y + 0.5 - tongueCy) / tongueRy;
      if (bx * bx + by * by > 1 && tx * tx + ty * ty > 1) continue;
      const edge = Math.hypot((x + 0.5 - hotX) / bodyRx, (y + 0.5 - hotY) / bodyRy);
      plot(frame, x, y, heatColor(edge));
    }
  }
}

for (let frame = 0; frame < FRAME_COUNT; frame++) drawFlame(frame);

/**
 * True when the occupied cell or any of the eight around it is burning.
 * A flame two tiles away does not count. Off-map neighbors are skipped.
 */
export function touchesFire(map: MapData, cellIndex: number): boolean {
  const { width, height, cells } = map;
  if (cellIndex < 0 || cellIndex >= cells.length || width <= 0) return false;
  const x = cellIndex % width;
  const y = Math.floor(cellIndex / width);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (cells[ny * width + nx]?.burning) return true;
    }
  }
  return false;
}

/** One flame pixel. Colors are fixed; genetic pattern is never sampled. */
export function fireSpritePixel(
  frame: number,
  x: number,
  y: number,
): readonly [number, number, number, number] | null {
  if (
    frame < 0 ||
    frame >= FRAME_COUNT ||
    x < 0 ||
    y < 0 ||
    x >= SPRITE_SIZE ||
    y >= SPRITE_SIZE
  )
    return null;
  const offset = offsetOf(frame, x, y);
  if ((pixels[offset + 3] ?? 0) === 0) return null;
  return [
    pixels[offset] ?? 0,
    pixels[offset + 1] ?? 0,
    pixels[offset + 2] ?? 0,
    255,
  ];
}

let sheetPromise: HTMLCanvasElement | null | undefined;

/** Four-frame flame, shared by every Mossling standing next to fire. */
export function buildFireSpriteSheet(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (sheetPromise !== undefined) return sheetPromise;
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) {
    sheetPromise = null;
    return null;
  }
  const image = sprite.createImageData(canvas.width, canvas.height);
  image.data.set(pixels);
  sprite.putImageData(image, 0, 0);
  sheetPromise = canvas;
  return canvas;
}
