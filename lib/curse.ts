import {
  COUGH_GAP_SECONDS,
  COUGH_PLAY_SECONDS,
  COUGH_POP_ROWS,
  COUGH_ROWS,
  COUGH_SCALE,
  type CoughMark,
  type CoughMotion,
  coughMotion,
} from "./cough";
import { type Camera, ZOOM_LEVELS } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView } from "./mossling-detail";

/** Cartoon swear that fits the cough bubble. */
export const CURSE_TEXT = "@$#*!";
/** Closest two map zooms. The cough bubble is max-zoom only. */
export const CURSE_ZOOMS: ReadonlySet<number> = new Set(ZOOM_LEVELS.slice(-2));
export const CURSE_PLAY_SECONDS = COUGH_PLAY_SECONDS;
export const CURSE_GAP_SECONDS = COUGH_GAP_SECONDS;
export const CURSE_CYCLE_SECONDS = CURSE_PLAY_SECONDS + CURSE_GAP_SECONDS;

export type CurseMark = CoughMark;
export type CurseMotion = CoughMotion;

/**
 * One play from the hit, then nothing. A later markCurse starts it again.
 */
export function curseMotion(
  elapsed: number,
  cursedAt: number,
): CurseMotion | null {
  const since = elapsed - cursedAt;
  if (since < 0 || since >= CURSE_PLAY_SECONDS) return null;
  return coughMotion(since, 0);
}

/** True while the swear bubble is on screen. */
export function cursing(mossling: PreviewMossling, elapsed: number): boolean {
  if (mossling.cursedAt === undefined) return false;
  return curseMotion(elapsed, mossling.cursedAt) !== null;
}

/**
 * Stamp a surviving Mossling. Repeats only after the cough-length rest.
 */
export function markCurse(mossling: PreviewMossling, now: number): boolean {
  if ((mossling.health ?? 100) <= 0) return false;
  if (
    mossling.cursedAt !== undefined &&
    now - mossling.cursedAt < CURSE_CYCLE_SECONDS
  )
    return false;
  mossling.cursedAt = now;
  return true;
}

function bubbleSize(frame: number) {
  const rows = frame === 0 ? COUGH_POP_ROWS : COUGH_ROWS;
  return {
    width: (rows[0]?.length ?? 0) * COUGH_SCALE,
    height: rows.length * COUGH_SCALE,
  };
}

/**
 * Bubbles for living Mosslings who just survived a disaster, at the two
 * closest zooms only.
 */
export function cursesInView(
  mosslings: readonly PreviewMossling[],
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): CurseMark[] {
  if (!CURSE_ZOOMS.has(tileSize)) return [];
  const marks: CurseMark[] = [];
  for (const mossling of mosslings) {
    if ((mossling.health ?? 100) <= 0 || mossling.cursedAt === undefined)
      continue;
    if (!mosslingInView(mossling.cellIndex, mapWidth, camera)) continue;
    const motion = curseMotion(elapsed, mossling.cursedAt);
    if (!motion || motion.alpha <= 0.01) continue;
    const { width, height } = bubbleSize(motion.frame);
    const cellX = mossling.cellIndex % mapWidth;
    const cellY = Math.floor(mossling.cellIndex / mapWidth);
    const tipY = cellY - 2 / tileSize;
    marks.push({
      x: cellX + 0.5,
      y: tipY - height / 2 / tileSize,
      frame: motion.frame,
      alpha: motion.alpha,
      width,
      height,
    });
  }
  return marks;
}
