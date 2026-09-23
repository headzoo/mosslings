import { cursing } from "./curse";
import { SEASON_SECONDS } from "./game-time";
import type { Camera } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView, SPRITE_ZOOM } from "./mossling-detail";

/** Share of Mosslings who whistle in a given season. */
export const WHISTLE_CHANCE = 20;
export const WHISTLE_FRAME_COUNT = 4;
/** Long enough that the note can be read before the fade. */
export const WHISTLE_FRAME_SECONDS = 0.3;
export const WHISTLE_PLAY_SECONDS = WHISTLE_FRAME_SECONDS * WHISTLE_FRAME_COUNT;
export const WHISTLE_GAP_SECONDS = 2;
export const WHISTLE_CYCLE_SECONDS = WHISTLE_PLAY_SECONDS + WHISTLE_GAP_SECONDS;
/** Frame 1 is small, frame 3 is full size, frame 4 fades out. */
export const WHISTLE_SCALES = [0.45, 0.75, 1, 1] as const;
export const WHISTLE_INK = "#2a2418";
/** How far the note rises, in tiles. */
const RISE_TILES = 1.15;

/** Pixel eighth note. Stem up, flag at the top, head at the bottom. */
export const NOTE_ROWS = [
  "...1111",
  "..111..",
  "..1.11.",
  "..1....",
  "..1....",
  "..1....",
  "1111...",
  "11111..",
  ".1111..",
] as const;

export const NOTE_WIDTH = NOTE_ROWS[0].length;
export const NOTE_HEIGHT = NOTE_ROWS.length;

export interface WhistleMotion {
  frame: number;
  scale: number;
  alpha: number;
  /** Tile offset from the Mossling, positive y downward. */
  dy: number;
}

export interface WhistleMark {
  x: number;
  y: number;
  frame: number;
  scale: number;
  alpha: number;
  width: number;
  height: number;
}

function wrap(value: number, span: number) {
  return ((value % span) + span) % span;
}

/** Whole seasons since the world began. */
export function seasonIndexAt(elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) / SEASON_SECONDS);
}

/** True for about one id in twenty, for this season only. */
export function whistleRoll(id: number, seasonIndex: number): boolean {
  return (
    ((Math.imul(id + 1, 0x9e3779b9) ^
      Math.imul(seasonIndex + 1, 0x85ebca6b)) >>>
      0) %
      WHISTLE_CHANCE ===
    0
  );
}

/**
 * Living, winning the season roll, and not already coughing or swearing.
 */
export function isWhistling(
  mossling: PreviewMossling,
  elapsed: number,
): boolean {
  if ((mossling.health ?? 100) <= 0) return false;
  if (mossling.plagueMonths !== undefined) return false;
  if (cursing(mossling, elapsed)) return false;
  return whistleRoll(mossling.id, seasonIndexAt(elapsed));
}

/**
 * One play of the note, then nothing for the gap.
 * Neighboring ids are a frame apart. Null is the quiet wait.
 */
export function whistleMotion(
  elapsed: number,
  id: number,
): WhistleMotion | null {
  const shifted = elapsed + id * WHISTLE_FRAME_SECONDS;
  const wrapped = wrap(shifted, WHISTLE_CYCLE_SECONDS);
  const frameMs = Math.round(WHISTLE_FRAME_SECONDS * 1000);
  const playMs = frameMs * WHISTLE_FRAME_COUNT;
  const ms = Math.round(wrapped * 1000);
  if (ms >= playMs) return null;
  const frame = Math.min(WHISTLE_FRAME_COUNT - 1, Math.floor(ms / frameMs));
  const into = (ms - frame * frameMs) / frameMs;
  const t = ms / playMs;
  return {
    frame,
    scale: WHISTLE_SCALES[frame] ?? 1,
    alpha: frame === WHISTLE_FRAME_COUNT - 1 ? 1 - into : 1,
    dy: -t * RISE_TILES || 0,
  };
}

/** Full drawn size in pixels. Later frames pass their scale. */
export function whistleSize(
  tileSize: number,
  scale = 1,
): { width: number; height: number } {
  const fullHeight = tileSize >= 32 ? 16 : 12;
  const height = Math.max(1, Math.round(fullHeight * scale));
  const width = Math.max(1, Math.round((height * NOTE_WIDTH) / NOTE_HEIGHT));
  return { width, height };
}

/**
 * Notes for living whistling Mosslings the camera can see, at sprite zoom.
 */
export function whistlesInView(
  mosslings: readonly PreviewMossling[],
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): WhistleMark[] {
  if (tileSize < SPRITE_ZOOM) return [];
  const marks: WhistleMark[] = [];
  for (const mossling of mosslings) {
    if (!isWhistling(mossling, elapsed)) continue;
    if (!mosslingInView(mossling.cellIndex, mapWidth, camera)) continue;
    const motion = whistleMotion(elapsed, mossling.id);
    if (!motion || motion.alpha <= 0.01) continue;
    const { width, height } = whistleSize(tileSize, motion.scale);
    const cellX = mossling.cellIndex % mapWidth;
    const cellY = Math.floor(mossling.cellIndex / mapWidth);
    marks.push({
      x: cellX + 0.5,
      y: cellY + 0.2 + motion.dy,
      frame: motion.frame,
      scale: motion.scale,
      alpha: motion.alpha,
      width,
      height,
    });
  }
  return marks;
}
