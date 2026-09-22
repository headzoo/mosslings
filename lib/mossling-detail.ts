import { plagueShade } from "./god/disease";
import type { Camera } from "./map-camera";
import {
  mosslingPatternColor,
  type PreviewMossling,
  paintedMosslingColor,
  TILE_SIZE,
} from "./map-preview";

/** First size where a Mossling is redrawn as a round body. */
export const ROUND_ZOOM = 16;
/** Faced bounce sprites start at the 24px zoom, one step before the maximum. */
export const SPRITE_ZOOM = 24;
export const SPRITE_SIZE = 32;
export const FRAME_COUNT = 4;
/** One squash-and-stretch cycle, in game seconds. Pause freezes it. */
export const BOUNCE_SECONDS = 0.5;
/** Slow hop for the round ball at the 16px zoom. Pause freezes it. */
export const ROUND_BOUNCE_SECONDS = 1.6;
/** How far the round ball rises, in screen pixels. */
export const ROUND_BOUNCE_PIXELS = 3;

const EMPTY = 0;
const BODY = 1;
const EYE = 2;
const GLINT = 3;
const MOUTH = 4;

export type DetailMode = "square" | "round" | "sprite";

export function detailMode(tileSize: number): DetailMode {
  if (tileSize >= SPRITE_ZOOM) return "sprite";
  if (tileSize >= ROUND_ZOOM) return "round";
  return "square";
}

/** True when the Mossling's cell overlaps the camera. Off-screen cells stay square. */
export function mosslingInView(
  cellIndex: number,
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
): boolean {
  const x = cellIndex % mapWidth;
  const y = Math.floor(cellIndex / mapWidth);
  return (
    x < camera.x + camera.width &&
    x + 1 > camera.x &&
    y < camera.y + camera.height &&
    y + 1 > camera.y
  );
}

function scaleHex(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 255) * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * Color of one screen pixel in a round body, or null outside the circle.
 * The fill is the same 8×8 pattern, with a one-pixel darker rim.
 */
export function circleColor(
  mossling: PreviewMossling,
  x: number,
  y: number,
  tileSize: number,
): string | null {
  const radius = tileSize / 2 - 0.35;
  const dx = x + 0.5 - tileSize / 2;
  const dy = y + 0.5 - tileSize / 2;
  const dist = Math.hypot(dx, dy);
  if (dist > radius) return null;
  const sx = Math.min(TILE_SIZE - 1, Math.floor((x * TILE_SIZE) / tileSize));
  const sy = Math.min(TILE_SIZE - 1, Math.floor((y * TILE_SIZE) / tileSize));
  const color = paintedMosslingColor(mossling, sx, sy);
  return dist > radius - 1 ? scaleHex(color, 0.7) : color;
}

/** Frame 0..3. Neighboring ids are a frame apart so the herd does not bounce together. */
export function bounceFrame(id: number, elapsed: number): number {
  const span = BOUNCE_SECONDS / FRAME_COUNT;
  const shifted = elapsed + id * span;
  const wrapped =
    ((shifted % BOUNCE_SECONDS) + BOUNCE_SECONDS) % BOUNCE_SECONDS;
  return Math.min(FRAME_COUNT - 1, Math.floor(wrapped / span));
}

/**
 * Vertical shift for the round ball. 0 rests on the ground; the peak is a few
 * pixels up. Neighboring ids are out of step. The dead stay still.
 */
export function roundBounceOffset(
  id: number,
  elapsed: number,
  health = 100,
): number {
  if (health <= 0) return 0;
  const shifted = elapsed + id * 0.37;
  const wrapped =
    ((shifted % ROUND_BOUNCE_SECONDS) + ROUND_BOUNCE_SECONDS) %
    ROUND_BOUNCE_SECONDS;
  const lift = Math.sin((wrapped / ROUND_BOUNCE_SECONDS) * Math.PI);
  return -Math.round(lift * ROUND_BOUNCE_PIXELS) || 0;
}

/** Living Mosslings get a face frame. The dead stay a round cross and do not bounce. */
export function faceFrame(
  mossling: Pick<PreviewMossling, "id" | "health">,
  elapsed: number,
): number | null {
  if ((mossling.health ?? 100) <= 0) return null;
  return bounceFrame(mossling.id, elapsed);
}

/** Shared by every Mossling with the same pattern and colors. */
export function spriteLookKey(mossling: PreviewMossling): string {
  return [
    mossling.pattern,
    mossling.pattern === 4 ? mossling.id : "",
    mossling.colors.join("."),
    mossling.plagueMonths ?? "",
  ].join("|");
}

type Ball = { cx: number; cy: number; rx: number; ry: number };

// Round and lifted, squashed on the ground, stretched on the rise, then settled.
const BALLS: readonly Ball[] = [
  { cx: 15.5, cy: 13.6, rx: 11.4, ry: 11.4 },
  { cx: 15.5, cy: 19.2, rx: 14.2, ry: 9.2 },
  { cx: 15.5, cy: 12.8, rx: 10.2, ry: 12.6 },
  { cx: 15.5, cy: 16.0, rx: 12.2, ry: 11.6 },
];

const shade = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);
const kind = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);
const pattern = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);

function indexOf(frame: number, x: number, y: number) {
  return (frame * SPRITE_SIZE + y) * SPRITE_SIZE + x;
}

function bodyShade(nx: number, ny: number) {
  const edge = Math.hypot(nx, ny);
  const light = Math.max(0, 1 - Math.hypot(nx + 0.42, ny + 0.5) / 1.45);
  let brightness = 78 + light * 145;
  if (edge > 0.86) brightness *= 0.62;
  else if (edge > 0.72) brightness *= 0.82;
  return Math.max(36, Math.min(220, Math.round(brightness)));
}

function stampEye(
  frame: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  let eyes = 0;
  let glint = -1;
  let glintScore = Number.POSITIVE_INFINITY;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const index = indexOf(frame, x, y);
      if (kind[index] !== BODY) continue;
      kind[index] = EYE;
      eyes += 1;
      const score = x + y * 2;
      if (score < glintScore) {
        glintScore = score;
        glint = index;
      }
    }
  }
  if (glint >= 0 && eyes > 1) kind[glint] = GLINT;
}

function stampMouth(frame: number, ball: Ball) {
  const y = Math.round(ball.cy + ball.ry * 0.38);
  const x0 = Math.round(ball.cx);
  for (const dx of [-1, 0, 1]) {
    const x = x0 + dx;
    if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) continue;
    const index = indexOf(frame, x, y);
    if (kind[index] === BODY) kind[index] = MOUTH;
  }
}

function buildSprites() {
  for (let frame = 0; frame < BALLS.length; frame++) {
    const ball = BALLS[frame];
    if (!ball) continue;
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const nx = (x + 0.5 - ball.cx) / ball.rx;
        const ny = (y + 0.5 - ball.cy) / ball.ry;
        if (nx * nx + ny * ny > 1) continue;
        const index = indexOf(frame, x, y);
        kind[index] = BODY;
        shade[index] = bodyShade(nx, ny);
        const px = Math.min(7, Math.max(0, Math.floor(((nx + 1) / 2) * 8)));
        const py = Math.min(7, Math.max(0, Math.floor(((ny + 1) / 2) * 8)));
        pattern[index] = px | (py << 3);
      }
    }
    const eyeRx = Math.max(1.65, ball.rx * 0.16);
    const eyeRy = Math.max(2.05, ball.ry * 0.2);
    const eyeY = ball.cy - ball.ry * 0.04;
    stampEye(frame, ball.cx - ball.rx * 0.3, eyeY, eyeRx, eyeRy);
    stampEye(frame, ball.cx + ball.rx * 0.28, eyeY, eyeRx, eyeRy);
    stampMouth(frame, ball);
  }
}

buildSprites();

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** One sprite pixel after genetic color is laid over the body. Face pixels stay put. */
export function skinnedSpritePixel(
  frame: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
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
  const index = indexOf(frame, x, y);
  const mark = kind[index];
  if (mark === EMPTY || mark === undefined) return null;
  if (mark === GLINT) return [255, 255, 255, 255];
  if (mark === EYE || mark === MOUTH) return [0, 0, 0, 255];
  const packed = pattern[index] ?? 0;
  const color = mosslingPatternColor(mossling, packed & 7, packed >> 3);
  const rgb = hexToRgb(color);
  const months = mossling.plagueMonths;
  const factor =
    Math.min(1.25, (shade[index] ?? 0) / 155) *
    (months === undefined ? 1 : plagueShade(months));
  const tinted = rgb.map((channel) => Math.round(channel * factor));
  return [tinted[0] ?? 0, tinted[1] ?? 0, tinted[2] ?? 0, 255];
}
