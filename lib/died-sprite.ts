import { FRAME_COUNT, SPRITE_SIZE } from "./mossling-detail";

type Rgb = readonly [number, number, number];

const STONE: Rgb = [110, 110, 118];
const STONE_LIGHT: Rgb = [186, 186, 194];
const MOUND: Rgb = [122, 84, 52];
const MOUND_DARK: Rgb = [90, 60, 38];
const SOUL_RIM: Rgb = [140, 198, 255];
const SOUL: Rgb = [255, 255, 255];
const EYE: Rgb = [20, 24, 32];

const SOUL_Y = [7, 4, 1, -2] as const;
const SOUL_ALPHA = [255, 255, 220, 120] as const;

/** One soul-rise cycle, in game seconds. Pause freezes it. */
export const ASCENT_SECONDS = 1;

function plot(
  image: ImageData,
  frame: number,
  x: number,
  y: number,
  color: Rgb,
  alpha = 255,
) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE || alpha <= 0)
    return;
  const offset = ((frame * SPRITE_SIZE + py) * SPRITE_SIZE + px) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = alpha;
}

function ellipse(
  image: ImageData,
  frame: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Rgb,
  alpha = 255,
) {
  if (rx <= 0 || ry <= 0) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) plot(image, frame, x, y, color, alpha);
    }
  }
}

function drawGrave(image: ImageData, frame: number) {
  ellipse(image, frame, 16, 27, 11, 3.6, MOUND);
  ellipse(image, frame, 16, 28.2, 8, 2, MOUND_DARK);
  for (let y = 16; y <= 25; y++) {
    for (let x = 10; x <= 21; x++) plot(image, frame, x, y, STONE);
  }
  ellipse(image, frame, 15.5, 16, 6, 5.2, STONE);
  ellipse(image, frame, 13.2, 13.4, 2.1, 1.3, STONE_LIGHT);
}

function drawSoul(image: ImageData, frame: number) {
  const cy = SOUL_Y[frame] ?? 7;
  const alpha = SOUL_ALPHA[frame] ?? 255;
  ellipse(image, frame, 16, cy, 4.4, 5.1, SOUL_RIM, alpha);
  ellipse(image, frame, 16, cy + 0.4, 3.1, 3.7, SOUL, alpha);
  plot(image, frame, 16, cy + 4.6, SOUL, alpha);
  plot(image, frame, 15, cy + 5.4, SOUL_RIM, alpha);
  plot(image, frame, 16, cy + 5.4, SOUL, alpha);
  plot(image, frame, 17, cy + 5.4, SOUL_RIM, alpha);
  plot(image, frame, 14.2, cy + 0.2, EYE, alpha);
  plot(image, frame, 17.6, cy + 0.2, EYE, alpha);
}

let sheetPromise: HTMLCanvasElement | null | undefined;

/** Grave and rising soul, four frames tall. Shared by the HUD and map corpses. */
export function buildDiedSpriteSheet(): HTMLCanvasElement | null {
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
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    drawGrave(image, frame);
    drawSoul(image, frame);
  }
  sprite.putImageData(image, 0, 0);
  sheetPromise = canvas;
  return canvas;
}

/** Frame 0..3 during ascent, then 0 for the idle grave. */
export function diedAscentFrame(elapsedSinceDeath: number): number {
  if (elapsedSinceDeath >= ASCENT_SECONDS) return 0;
  const span = ASCENT_SECONDS / FRAME_COUNT;
  return Math.min(FRAME_COUNT - 1, Math.floor(elapsedSinceDeath / span));
}
