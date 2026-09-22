import { plagueBounceScale, plagueRgb } from "./god/disease";
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
/** Pull cycle played while a Mossling stands on carrots. */
export const SHOVEL_FRAME_COUNT = 6;
/** One squash-and-stretch cycle, in game seconds. Pause freezes it. */
export const BOUNCE_SECONDS = 0.5;
/** One pull cycle. Each pose holds as long as a bounce frame. */
export const SHOVEL_SECONDS =
  (BOUNCE_SECONDS / FRAME_COUNT) * SHOVEL_FRAME_COUNT;
/** Submerged splash played while a Mossling stands in the water. */
export const SPLASH_FRAME_COUNT = 6;
/** One splash cycle. Each pose holds as long as a bounce frame. */
export const SPLASH_SECONDS =
  (BOUNCE_SECONDS / FRAME_COUNT) * SPLASH_FRAME_COUNT;
/** Side kick played while two Mosslings share a ball. */
export const KICK_FRAME_COUNT = 6;
/** One kick cycle. Each pose holds as long as a bounce frame. */
export const KICK_SECONDS = (BOUNCE_SECONDS / FRAME_COUNT) * KICK_FRAME_COUNT;
/** Slow hop for the round ball at the 16px zoom. Pause freezes it. */
export const ROUND_BOUNCE_SECONDS = 1.6;
/** How far the round ball rises, in screen pixels. */
export const ROUND_BOUNCE_PIXELS = 3;

const EMPTY = 0;
const BODY = 1;
const EYE = 2;
const GLINT = 3;
const MOUTH = 4;
const SPLASH = 5;
const CARROT = 6;
const CARROT_TIP = 7;
const LEAF = 8;
const LEAF_SHADE = 9;

const CARROT_RGB = [0xe8, 0x78, 0x20, 255] as const;
const CARROT_TIP_RGB = [0xc4, 0x48, 0x18, 255] as const;
const LEAF_RGB = [0x54, 0xa3, 0x2e, 255] as const;
const LEAF_SHADE_RGB = [0x3d, 0x9a, 0x34, 255] as const;

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
export function bounceFrame(
  id: number,
  elapsed: number,
  plagueMonths?: number,
): number {
  const t = elapsed / plagueBounceScale(plagueMonths);
  const span = BOUNCE_SECONDS / FRAME_COUNT;
  const shifted = t + id * span;
  const wrapped =
    ((shifted % BOUNCE_SECONDS) + BOUNCE_SECONDS) % BOUNCE_SECONDS;
  return Math.min(FRAME_COUNT - 1, Math.floor(wrapped / span));
}

/** Frame 0..5. Neighboring ids are a frame apart so the herd does not dig together. */
export function shovelFrame(
  id: number,
  elapsed: number,
  plagueMonths?: number,
): number {
  const t = elapsed / plagueBounceScale(plagueMonths);
  const span = SHOVEL_SECONDS / SHOVEL_FRAME_COUNT;
  const shifted = t + id * span;
  const wrapped =
    ((shifted % SHOVEL_SECONDS) + SHOVEL_SECONDS) % SHOVEL_SECONDS;
  return Math.min(SHOVEL_FRAME_COUNT - 1, Math.floor(wrapped / span));
}

/** Frame 0..5. Neighboring ids are a frame apart so the herd does not splash together. */
export function splashFrame(
  id: number,
  elapsed: number,
  plagueMonths?: number,
): number {
  const t = elapsed / plagueBounceScale(plagueMonths);
  const span = SPLASH_SECONDS / SPLASH_FRAME_COUNT;
  const shifted = t + id * span;
  const wrapped =
    ((shifted % SPLASH_SECONDS) + SPLASH_SECONDS) % SPLASH_SECONDS;
  return Math.min(SPLASH_FRAME_COUNT - 1, Math.floor(wrapped / span));
}

/**
 * Vertical shift for the round ball. 0 rests on the ground; the peak is a few
 * pixels up. Neighboring ids are out of step. The dead stay still.
 */
export function roundBounceOffset(
  id: number,
  elapsed: number,
  health = 100,
  plagueMonths?: number,
): number {
  if (health <= 0) return 0;
  const t = elapsed / plagueBounceScale(plagueMonths);
  const shifted = t + id * 0.37;
  const wrapped =
    ((shifted % ROUND_BOUNCE_SECONDS) + ROUND_BOUNCE_SECONDS) %
    ROUND_BOUNCE_SECONDS;
  const lift = Math.sin((wrapped / ROUND_BOUNCE_SECONDS) * Math.PI);
  return -Math.round(lift * ROUND_BOUNCE_PIXELS) || 0;
}

/** Living Mosslings get a face frame. The dead stay a round cross and do not bounce. */
export function faceFrame(
  mossling: Pick<PreviewMossling, "id" | "health" | "plagueMonths">,
  elapsed: number,
): number | null {
  if ((mossling.health ?? 100) <= 0) return null;
  return bounceFrame(mossling.id, elapsed, mossling.plagueMonths);
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
const shovelShade = new Uint8Array(
  SHOVEL_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const shovelKind = new Uint8Array(
  SHOVEL_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const shovelPattern = new Uint8Array(
  SHOVEL_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const splashShade = new Uint8Array(
  SPLASH_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const splashKind = new Uint8Array(
  SPLASH_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const splashPattern = new Uint8Array(
  SPLASH_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const kickShade = new Uint8Array(KICK_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);
const kickKind = new Uint8Array(KICK_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);
const kickPattern = new Uint8Array(
  KICK_FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE,
);
const kiteShade = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);
const kiteKind = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);
const kitePattern = new Uint8Array(FRAME_COUNT * SPRITE_SIZE * SPRITE_SIZE);

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
  marks: Uint8Array,
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
      if (marks[index] !== BODY) continue;
      marks[index] = EYE;
      eyes += 1;
      const score = x + y * 2;
      if (score < glintScore) {
        glintScore = score;
        glint = index;
      }
    }
  }
  if (glint >= 0 && eyes > 1) marks[glint] = GLINT;
}

function stampMouth(marks: Uint8Array, frame: number, ball: Ball) {
  const y = Math.round(ball.cy + ball.ry * 0.38);
  const x0 = Math.round(ball.cx);
  for (const dx of [-1, 0, 1]) {
    const x = x0 + dx;
    if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) continue;
    const index = indexOf(frame, x, y);
    if (marks[index] === BODY) marks[index] = MOUTH;
  }
}

function stampBall(
  frame: number,
  ball: Ball,
  marks: Uint8Array,
  shades: Uint8Array,
  patterns: Uint8Array,
) {
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const nx = (x + 0.5 - ball.cx) / ball.rx;
      const ny = (y + 0.5 - ball.cy) / ball.ry;
      if (nx * nx + ny * ny > 1) continue;
      const index = indexOf(frame, x, y);
      marks[index] = BODY;
      shades[index] = bodyShade(nx, ny);
      const px = Math.min(7, Math.max(0, Math.floor(((nx + 1) / 2) * 8)));
      const py = Math.min(7, Math.max(0, Math.floor(((ny + 1) / 2) * 8)));
      patterns[index] = px | (py << 3);
    }
  }
  const eyeRx = Math.max(1.65, ball.rx * 0.16);
  const eyeRy = Math.max(2.05, ball.ry * 0.2);
  const eyeY = ball.cy - ball.ry * 0.04;
  stampEye(marks, frame, ball.cx - ball.rx * 0.3, eyeY, eyeRx, eyeRy);
  stampEye(marks, frame, ball.cx + ball.rx * 0.28, eyeY, eyeRx, eyeRy);
  stampMouth(marks, frame, ball);
}

function buildSprites() {
  for (let frame = 0; frame < BALLS.length; frame++) {
    const ball = BALLS[frame];
    if (!ball) continue;
    stampBall(frame, ball, kind, shade, pattern);
  }
}

// Reach, grip, yank, follow through, settle, then lean into the next pull.
// Each pose stays low enough to leave sky above the head.
const SHOVELS: readonly Ball[] = [
  { cx: 13.2, cy: 22.0, rx: 9.8, ry: 8.0 },
  { cx: 12.6, cy: 23.2, rx: 10.6, ry: 7.2 },
  { cx: 12.0, cy: 19.6, rx: 9.0, ry: 9.4 },
  { cx: 11.4, cy: 18.4, rx: 8.2, ry: 10.2 },
  { cx: 12.2, cy: 20.6, rx: 9.4, ry: 8.8 },
  { cx: 11.0, cy: 22.4, rx: 9.6, ry: 7.6 },
];

type CarrotDot = readonly [number, number, number];

// Tip down: leaves, then a tapering root.
const CARROT_DOWN: readonly CarrotDot[] = [
  [2, 0, LEAF],
  [3, 0, LEAF_SHADE],
  [4, 0, LEAF],
  [1, 1, LEAF],
  [2, 1, LEAF_SHADE],
  [3, 1, LEAF],
  [4, 1, LEAF_SHADE],
  [5, 1, LEAF],
  [2, 2, CARROT],
  [3, 2, CARROT],
  [4, 2, CARROT],
  [2, 3, CARROT],
  [3, 3, CARROT],
  [4, 3, CARROT],
  [3, 4, CARROT],
  [4, 4, CARROT],
  [3, 5, CARROT],
  [3, 6, CARROT_TIP],
  [3, 7, CARROT_TIP],
];

// Flying sideways, tip leading to the left.
const CARROT_SIDE: readonly CarrotDot[] = [
  [5, 0, LEAF],
  [6, 0, LEAF_SHADE],
  [2, 1, CARROT],
  [3, 1, CARROT],
  [4, 1, CARROT],
  [5, 1, LEAF],
  [0, 2, CARROT_TIP],
  [1, 2, CARROT],
  [2, 2, CARROT],
  [3, 2, CARROT],
  [4, 2, CARROT],
  [5, 2, LEAF_SHADE],
  [6, 2, LEAF],
  [2, 3, CARROT],
  [3, 3, CARROT],
  [4, 3, CARROT],
  [5, 3, LEAF],
  [5, 4, LEAF_SHADE],
];

// Tumbling, tip up and leaves underneath.
const CARROT_UP: readonly CarrotDot[] = [
  [3, 0, CARROT_TIP],
  [3, 1, CARROT_TIP],
  [3, 2, CARROT],
  [2, 3, CARROT],
  [3, 3, CARROT],
  [4, 3, CARROT],
  [2, 4, CARROT],
  [3, 4, CARROT],
  [4, 4, CARROT],
  [1, 5, LEAF],
  [2, 5, LEAF_SHADE],
  [3, 5, LEAF],
  [4, 5, LEAF_SHADE],
  [5, 5, LEAF],
  [2, 6, LEAF],
  [3, 6, LEAF_SHADE],
  [4, 6, LEAF],
];

// Exiting, tip leading to the right.
const CARROT_AWAY: readonly CarrotDot[] = [
  [1, 0, LEAF_SHADE],
  [2, 0, LEAF],
  [2, 1, LEAF],
  [3, 1, CARROT],
  [4, 1, CARROT],
  [5, 1, CARROT],
  [1, 2, LEAF],
  [2, 2, LEAF_SHADE],
  [3, 2, CARROT],
  [4, 2, CARROT],
  [5, 2, CARROT],
  [6, 2, CARROT],
  [7, 2, CARROT_TIP],
  [2, 3, LEAF],
  [3, 3, CARROT],
  [4, 3, CARROT],
  [5, 3, CARROT],
  [2, 4, LEAF_SHADE],
];

// One carrot climbs out of the soil. The other, three frames ahead, is already overhead.
const CARROT_ARC: readonly {
  x: number;
  y: number;
  dots: readonly CarrotDot[];
}[] = [
  { x: 25, y: 23, dots: CARROT_DOWN },
  { x: 25, y: 16, dots: CARROT_DOWN },
  { x: 24, y: 10, dots: CARROT_DOWN },
  { x: 12, y: 0, dots: CARROT_SIDE },
  { x: 4, y: 0, dots: CARROT_UP },
  { x: 1, y: 1, dots: CARROT_AWAY },
];

function stampCarrot(
  marks: Uint8Array,
  frame: number,
  originX: number,
  originY: number,
  dots: readonly CarrotDot[],
) {
  for (const [dx, dy, mark] of dots) {
    const x = originX + dx;
    const y = originY + dy;
    if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) continue;
    marks[indexOf(frame, x, y)] = mark;
  }
}

function buildShovels() {
  for (let frame = 0; frame < SHOVELS.length; frame++) {
    const ball = SHOVELS[frame];
    if (!ball) continue;
    stampBall(frame, ball, shovelKind, shovelShade, shovelPattern);
    for (const step of [0, 3]) {
      const carrot = CARROT_ARC[(frame + step) % CARROT_ARC.length];
      if (!carrot) continue;
      stampCarrot(shovelKind, frame, carrot.x, carrot.y, carrot.dots);
    }
  }
}

buildSprites();
buildShovels();

/** Pixels at this row and below stay empty so the water tile shows through. */
const SPLASH_WATERLINE = 20;
// Head and shoulders stay above the water. The lower body is the part that's under.
const SPLASH_BALL: Ball = { cx: 15.5, cy: 13.5, rx: 9.2, ry: 9.4 };
// Short stubs: tucked, lifted, wide, a slap, a rebound, then settled.
const SPLASH_ARMS: readonly (readonly [number, number, number, number])[][] = [
  [
    [5.4, 14.2, 2.4, 1.6],
    [25.6, 14.2, 2.4, 1.6],
  ],
  [
    [5.2, 10.4, 2.0, 2.4],
    [25.8, 10.4, 2.0, 2.4],
  ],
  [
    [4.2, 13.2, 2.6, 1.6],
    [26.8, 13.2, 2.6, 1.6],
  ],
  [
    [4.6, 17.4, 2.7, 1.5],
    [26.4, 17.4, 2.7, 1.5],
  ],
  [
    [4.8, 10.0, 2.1, 2.5],
    [26.2, 10.0, 2.1, 2.5],
  ],
  [
    [5.6, 15.6, 2.4, 1.6],
    [25.4, 15.6, 2.4, 1.6],
  ],
];
/** Droplets flung from the arm tips. The slap and rebound throw the most. */
const SPLASH_DROPS: readonly (readonly [number, number])[][] = [
  [
    [5, 16],
    [26, 16],
  ],
  [
    [5, 8],
    [26, 8],
  ],
  [
    [2, 12],
    [3, 15],
    [28, 12],
    [29, 15],
  ],
  [
    [2, 16],
    [3, 18],
    [5, 18],
    [26, 18],
    [28, 16],
    [29, 18],
  ],
  [
    [3, 8],
    [4, 11],
    [27, 8],
    [28, 11],
  ],
  [
    [6, 17],
    [25, 17],
  ],
];

function stampNub(
  frame: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  for (let y = 0; y < SPLASH_WATERLINE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const index = indexOf(frame, x, y);
      if (splashKind[index] !== EMPTY) continue;
      splashKind[index] = BODY;
      splashShade[index] = bodyShade(nx * 0.55, ny * 0.55);
      const px = Math.min(7, Math.max(0, Math.floor(((nx + 1) / 2) * 8)));
      const py = Math.min(7, Math.max(0, Math.floor(((ny + 1) / 2) * 8)));
      splashPattern[index] = px | (py << 3);
    }
  }
}

function buildSplashes() {
  const ball = SPLASH_BALL;
  for (let frame = 0; frame < SPLASH_FRAME_COUNT; frame++) {
    for (let y = 0; y < SPLASH_WATERLINE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const nx = (x + 0.5 - ball.cx) / ball.rx;
        const ny = (y + 0.5 - ball.cy) / ball.ry;
        if (nx * nx + ny * ny > 1) continue;
        const index = indexOf(frame, x, y);
        splashKind[index] = BODY;
        splashShade[index] = bodyShade(nx, ny);
        const px = Math.min(7, Math.max(0, Math.floor(((nx + 1) / 2) * 8)));
        const py = Math.min(7, Math.max(0, Math.floor(((ny + 1) / 2) * 8)));
        splashPattern[index] = px | (py << 3);
      }
    }
    const eyeY = ball.cy - 2.2;
    stampEye(splashKind, frame, ball.cx - 3.2, eyeY, 1.8, 2.2);
    stampEye(splashKind, frame, ball.cx + 3, eyeY, 1.8, 2.2);
    const mouthY = Math.round(ball.cy + 2.4);
    const mouthX = Math.round(ball.cx);
    for (const dx of [-1, 0, 1]) {
      const x = mouthX + dx;
      if (x < 0 || mouthY < 0 || x >= SPRITE_SIZE || mouthY >= SPRITE_SIZE)
        continue;
      const index = indexOf(frame, x, mouthY);
      if (splashKind[index] === BODY) splashKind[index] = MOUTH;
    }
    for (const arm of SPLASH_ARMS[frame] ?? [])
      stampNub(frame, arm[0], arm[1], arm[2], arm[3]);
    for (const [x, y] of SPLASH_DROPS[frame] ?? []) {
      if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPLASH_WATERLINE) continue;
      const index = indexOf(frame, x, y);
      if (splashKind[index] === EMPTY) splashKind[index] = SPLASH;
    }
  }
}

buildSplashes();

// Side view, facing right. The left-facing sheet is this buffer mirrored.
const KICK_BALLS: readonly Ball[] = [
  { cx: 13.2, cy: 15.5, rx: 9.2, ry: 8.4 },
  { cx: 13.0, cy: 14.2, rx: 8.8, ry: 9.0 },
  { cx: 12.4, cy: 15.8, rx: 9.4, ry: 8.0 },
  { cx: 13.6, cy: 16.2, rx: 9.6, ry: 7.6 },
  { cx: 13.2, cy: 15.8, rx: 9.2, ry: 8.2 },
  { cx: 13.2, cy: 15.6, rx: 9.2, ry: 8.4 },
];

// Plant, lift, kick, follow through, recover, rest. The strike reaches x=27.
const KICK_LEGS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [10, 24],
    [10, 25],
    [11, 25],
    [11, 26],
    [16, 24],
    [16, 25],
    [17, 25],
    [17, 26],
  ],
  [
    [10, 24],
    [10, 25],
    [11, 25],
    [11, 26],
    [17, 20],
    [18, 20],
    [18, 21],
    [19, 21],
  ],
  [
    [9, 24],
    [9, 25],
    [10, 25],
    [10, 26],
    [25, 23],
    [26, 23],
    [27, 23],
  ],
  [
    [10, 25],
    [11, 25],
    [11, 26],
    [20, 24],
    [21, 24],
    [22, 25],
    [23, 25],
  ],
  [
    [10, 24],
    [11, 25],
    [11, 26],
    [18, 23],
    [19, 24],
    [19, 25],
  ],
  [
    [10, 25],
    [11, 25],
    [11, 26],
    [16, 25],
    [17, 25],
    [17, 26],
  ],
];

function stampKickNub(frame: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) return;
  const index = indexOf(frame, x, y);
  if (kickKind[index] !== EMPTY) return;
  kickKind[index] = BODY;
  kickShade[index] = 70;
  kickPattern[index] = 3 | (4 << 3);
}

function stampKickBall(frame: number, ball: Ball) {
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const nx = (x + 0.5 - ball.cx) / ball.rx;
      const ny = (y + 0.5 - ball.cy) / ball.ry;
      if (nx * nx + ny * ny > 1) continue;
      const index = indexOf(frame, x, y);
      kickKind[index] = BODY;
      kickShade[index] = bodyShade(nx, ny);
      const px = Math.min(7, Math.max(0, Math.floor(((nx + 1) / 2) * 8)));
      const py = Math.min(7, Math.max(0, Math.floor(((ny + 1) / 2) * 8)));
      kickPattern[index] = px | (py << 3);
    }
  }
  const eyeRx = Math.max(1.65, ball.rx * 0.16);
  const eyeRy = Math.max(2.05, ball.ry * 0.2);
  const eyeY = ball.cy - ball.ry * 0.04;
  stampEye(kickKind, frame, ball.cx + ball.rx * 0.32, eyeY, eyeRx, eyeRy);
  const mouthY = Math.round(ball.cy + ball.ry * 0.32);
  const mouthX = Math.round(ball.cx + ball.rx * 0.2);
  for (const dx of [0, 1]) {
    const x = mouthX + dx;
    if (x < 0 || mouthY < 0 || x >= SPRITE_SIZE || mouthY >= SPRITE_SIZE)
      continue;
    const index = indexOf(frame, x, mouthY);
    if (kickKind[index] === BODY) kickKind[index] = MOUTH;
  }
}

function buildKicks() {
  for (let frame = 0; frame < KICK_BALLS.length; frame++) {
    const ball = KICK_BALLS[frame];
    if (!ball) continue;
    stampKickBall(frame, ball);
    for (const [x, y] of KICK_LEGS[frame] ?? []) stampKickNub(frame, x, y);
  }
}

buildKicks();

// Raised beside the head, following the bounce so the nubs hop with the body.
const KITE_ARMS: readonly (readonly [number, number, number, number])[][] = [
  [
    [3.2, 5.2, 2.15, 2.35],
    [27.8, 5.2, 2.15, 2.35],
  ],
  [
    [7.4, 7.6, 2.2, 2.15],
    [23.6, 7.6, 2.2, 2.15],
  ],
  [
    [3.6, 3.6, 2.05, 2.2],
    [27.4, 3.6, 2.05, 2.2],
  ],
  [
    [3.4, 6.2, 2.1, 2.2],
    [27.6, 6.2, 2.1, 2.2],
  ],
];

function stampKiteNub(
  frame: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const index = indexOf(frame, x, y);
      if (kiteKind[index] !== EMPTY) continue;
      kiteKind[index] = BODY;
      kiteShade[index] = bodyShade(nx * 0.55, ny * 0.55);
      const px = Math.min(7, Math.max(0, Math.floor(((nx + 1) / 2) * 8)));
      const py = Math.min(7, Math.max(0, Math.floor(((ny + 1) / 2) * 8)));
      kitePattern[index] = px | (py << 3);
    }
  }
}

function buildKites() {
  for (let frame = 0; frame < BALLS.length; frame++) {
    const ball = BALLS[frame];
    if (!ball) continue;
    stampBall(frame, ball, kiteKind, kiteShade, kitePattern);
    for (const arm of KITE_ARMS[frame] ?? [])
      stampKiteNub(frame, arm[0], arm[1], arm[2], arm[3]);
  }
}

buildKites();

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function skinnedPixel(
  frame: number,
  frameCount: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
  marks: Uint8Array,
  shades: Uint8Array,
  patterns: Uint8Array,
): readonly [number, number, number, number] | null {
  if (
    frame < 0 ||
    frame >= frameCount ||
    x < 0 ||
    y < 0 ||
    x >= SPRITE_SIZE ||
    y >= SPRITE_SIZE
  )
    return null;
  const index = indexOf(frame, x, y);
  const mark = marks[index];
  if (mark === EMPTY || mark === undefined) return null;
  if (mark === SPLASH) return [214, 244, 255, 255];
  if (mark === GLINT) return [255, 255, 255, 255];
  if (mark === EYE || mark === MOUTH) return [0, 0, 0, 255];
  if (mark === CARROT) return CARROT_RGB;
  if (mark === CARROT_TIP) return CARROT_TIP_RGB;
  if (mark === LEAF) return LEAF_RGB;
  if (mark === LEAF_SHADE) return LEAF_SHADE_RGB;
  const packed = patterns[index] ?? 0;
  const color = mosslingPatternColor(mossling, packed & 7, packed >> 3);
  const rgb = hexToRgb(color);
  const months = mossling.plagueMonths;
  const body =
    months === undefined
      ? rgb
      : plagueRgb(rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, months);
  const factor = Math.min(1.25, (shades[index] ?? 0) / 155);
  const tinted = body.map((channel) => Math.round(channel * factor));
  return [tinted[0] ?? 0, tinted[1] ?? 0, tinted[2] ?? 0, 255];
}

/** One kite-flying pixel. The bounce, plus two nubs raised beside the head. */
export function skinnedKitePixel(
  frame: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
): readonly [number, number, number, number] | null {
  return skinnedPixel(
    frame,
    FRAME_COUNT,
    x,
    y,
    mossling,
    kiteKind,
    kiteShade,
    kitePattern,
  );
}

/** One sprite pixel after genetic color is laid over the body. Face pixels stay put. */
export function skinnedSpritePixel(
  frame: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
): readonly [number, number, number, number] | null {
  return skinnedPixel(frame, FRAME_COUNT, x, y, mossling, kind, shade, pattern);
}

/** One pulling pixel. The body yanks; carrots rise from the soil and tumble overhead. */
export function skinnedShovelPixel(
  frame: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
): readonly [number, number, number, number] | null {
  return skinnedPixel(
    frame,
    SHOVEL_FRAME_COUNT,
    x,
    y,
    mossling,
    shovelKind,
    shovelShade,
    shovelPattern,
  );
}

/** One kick pixel. Left is the right-facing sheet mirrored across the sprite. */
export function skinnedKickPixel(
  frame: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
  face: "left" | "right",
): readonly [number, number, number, number] | null {
  const sampleX = face === "left" ? SPRITE_SIZE - 1 - x : x;
  return skinnedPixel(
    frame,
    KICK_FRAME_COUNT,
    sampleX,
    y,
    mossling,
    kickKind,
    kickShade,
    kickPattern,
  );
}

/** One swimming pixel. The body is clipped at the waterline and droplets sit on it. */
export function skinnedSplashPixel(
  frame: number,
  x: number,
  y: number,
  mossling: PreviewMossling,
): readonly [number, number, number, number] | null {
  return skinnedPixel(
    frame,
    SPLASH_FRAME_COUNT,
    x,
    y,
    mossling,
    splashKind,
    splashShade,
    splashPattern,
  );
}
