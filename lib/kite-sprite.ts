import { CLOUD_SHADOW, CLOUD_SHADOW_ALPHA } from "./cloud-visual";
import { FRAME_COUNT, SPRITE_SIZE } from "./mossling-detail";

const SHIFTS = [
  [0, 0],
  [-1, -1],
  [1, 0],
  [0, 1],
] as const;

const shadow = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE * 4);

const SHADOW_RGB = [
  Number.parseInt(CLOUD_SHADOW.slice(1, 3), 16),
  Number.parseInt(CLOUD_SHADOW.slice(3, 5), 16),
  Number.parseInt(CLOUD_SHADOW.slice(5, 7), 16),
] as const;

function offsetOf(frame: number, x: number, y: number) {
  return ((frame * SPRITE_SIZE + y) * SPRITE_SIZE + x) * 4;
}

function plot(frame: number, x: number, y: number, alpha: number) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE) return;
  const offset = offsetOf(frame, px, py);
  shadow[offset] = SHADOW_RGB[0];
  shadow[offset + 1] = SHADOW_RGB[1];
  shadow[offset + 2] = SHADOW_RGB[2];
  shadow[offset + 3] = alpha;
}

function drawShadow(frame: number) {
  const shift = SHIFTS[frame] ?? [0, 0];
  const cx = 16 + shift[0] * 0.4;
  const cy = 16 + shift[1] * 0.4;
  const alpha = Math.round(CLOUD_SHADOW_ALPHA * 255);
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const dx = (x + 0.5 - cx) / 13;
      const dy = (y + 0.5 - cy) / 8;
      const falloff = dx * dx + dy * dy;
      if (falloff > 1) continue;
      const rim = falloff > 0.72 ? 0.5 : 1;
      plot(frame, x, y, Math.round(alpha * rim));
    }
  }
}

for (let frame = 0; frame < FRAME_COUNT; frame++) drawShadow(frame);

/** Soft ground blob in the cloud shadow color. */
export function kiteShadowPixel(
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
  if ((shadow[offset + 3] ?? 0) === 0) return null;
  return [
    shadow[offset] ?? 0,
    shadow[offset + 1] ?? 0,
    shadow[offset + 2] ?? 0,
    shadow[offset + 3] ?? 0,
  ];
}

let shadowSheet: HTMLCanvasElement | null | undefined;

/** Four-frame shadow. Drawn as the extra tile under the kite. */
export function buildKiteShadowSheet(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (shadowSheet !== undefined) return shadowSheet;
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) {
    shadowSheet = null;
    return null;
  }
  const image = sprite.createImageData(canvas.width, canvas.height);
  image.data.set(shadow);
  sprite.putImageData(image, 0, 0);
  shadowSheet = canvas;
  return shadowSheet;
}
