import type { Camera } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView, ROUND_ZOOM, SPRITE_ZOOM } from "./mossling-detail";

export const HEART_CYCLE_SECONDS = 1;
export const HEART_FRAME_COUNT = 4;
/** Frame 1 is small, frame 3 is full size, frame 4 fades out. */
export const HEART_SCALES = [0.35, 0.65, 1, 1] as const;
const PIXEL_COUNT = 3;
const HEART_COUNT = 5;
const RISE_TILES = 1.35;
const SPREAD_TILES = 0.28;

export const HEART_COLOR = "#e0233a";
export const HEART_ROWS = [
  "0110110",
  "1111111",
  "1111111",
  "0111110",
  "0011100",
  "0001000",
] as const;

export type HeartStyle = "pixel" | "tiny" | "sprite";

export interface HeartMotion {
  frame: number;
  scale: number;
  alpha: number;
  /** Tile offset from the pair, positive x to the right and positive y downward. */
  dx: number;
  dy: number;
}

export interface HeartMark {
  x: number;
  y: number;
  style: HeartStyle;
  frame: number;
  scale: number;
  alpha: number;
  size: number;
}

export function heartStyle(tileSize: number): HeartStyle {
  if (tileSize >= SPRITE_ZOOM) return "sprite";
  if (tileSize >= ROUND_ZOOM) return "tiny";
  return "pixel";
}

export function heartCount(style: HeartStyle): number {
  return style === "pixel" ? PIXEL_COUNT : HEART_COUNT;
}

/** Full drawn size in pixels. Sprite frames pass their scale; other styles stay fixed. */
export function heartSize(tileSize: number, scale = 1): number {
  const style = heartStyle(tileSize);
  const full =
    style === "pixel" ? 1 : style === "tiny" ? 5 : tileSize >= 32 ? 13 : 9;
  return Math.max(1, Math.round(full * scale));
}

function wrap(value: number, span: number) {
  return ((value % span) + span) % span;
}

/** Where one heart is in its rise. Index staggers the pair so they do not lift together. */
export function heartMotion(
  elapsed: number,
  since: number,
  index: number,
  count: number,
): HeartMotion {
  const slots = Math.max(1, count);
  const shifted = elapsed - since + index * (HEART_CYCLE_SECONDS / slots);
  const t = wrap(shifted, HEART_CYCLE_SECONDS) / HEART_CYCLE_SECONDS;
  const frame = Math.min(
    HEART_FRAME_COUNT - 1,
    Math.floor(t * HEART_FRAME_COUNT),
  );
  const into = t * HEART_FRAME_COUNT - frame;
  const scale = HEART_SCALES[frame] ?? 1;
  return {
    frame,
    scale,
    alpha: frame === HEART_FRAME_COUNT - 1 ? 1 - into : 1,
    dx: (index - (slots - 1) / 2) * SPREAD_TILES * t,
    dy: -t * RISE_TILES || 0,
  };
}

function cellCenter(cellIndex: number, mapWidth: number) {
  return {
    x: (cellIndex % mapWidth) + 0.5,
    y: Math.floor(cellIndex / mapWidth) + 0.5,
  };
}

function courting(mossling: PreviewMossling) {
  return (
    (mossling.health ?? 100) > 0 &&
    mossling.ritual?.phase === "courtship" &&
    mossling.ritual.role !== "child"
  );
}

/**
 * Hearts for courting pairs the camera can see.
 * Off-screen pairs are skipped before any motion is computed.
 */
export function heartsInView(
  mosslings: readonly PreviewMossling[],
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): HeartMark[] {
  const byId = new Map<number, PreviewMossling>();
  for (const mossling of mosslings) byId.set(mossling.id, mossling);
  const style = heartStyle(tileSize);
  const count = heartCount(style);
  const animated = style === "sprite";
  const marks: HeartMark[] = [];
  for (const mossling of mosslings) {
    const ritual = mossling.ritual;
    if (!courting(mossling) || !ritual || mossling.id > ritual.partnerId)
      continue;
    const partner = byId.get(ritual.partnerId);
    if (
      !partner ||
      !courting(partner) ||
      partner.ritual?.partnerId !== mossling.id
    )
      continue;
    if (
      !mosslingInView(mossling.cellIndex, mapWidth, camera) &&
      !mosslingInView(partner.cellIndex, mapWidth, camera)
    )
      continue;
    const left = cellCenter(mossling.cellIndex, mapWidth);
    const right = cellCenter(partner.cellIndex, mapWidth);
    const originX = (left.x + right.x) / 2;
    const originY = (left.y + right.y) / 2;
    for (let index = 0; index < count; index++) {
      const motion = heartMotion(elapsed, ritual.since, index, count);
      const scale = animated ? motion.scale : 1;
      marks.push({
        x: originX + motion.dx,
        y: originY + motion.dy,
        style,
        frame: animated ? motion.frame : 0,
        scale,
        alpha: animated ? motion.alpha : 1,
        size: heartSize(tileSize, scale),
      });
    }
  }
  return marks;
}
