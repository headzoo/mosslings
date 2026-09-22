import { type Camera, ZOOM_LEVELS } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView } from "./mossling-detail";

/** Largest map zoom. The cough bubble is a max-zoom sprite only. */
export const COUGH_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 32;
export const COUGH_FRAME_COUNT = 4;
/** Long enough that “cough” can be read before the fade. */
export const COUGH_FRAME_SECONDS = 0.3;
export const COUGH_PLAY_SECONDS = COUGH_FRAME_SECONDS * COUGH_FRAME_COUNT;
export const COUGH_GAP_SECONDS = 2;
export const COUGH_CYCLE_SECONDS = COUGH_PLAY_SECONDS + COUGH_GAP_SECONDS;
export const COUGH_FILL = "#fff6d8";
export const COUGH_INK = "#2a2418";
export const COUGH_TEXT = "cough";
/** Each source pixel is drawn this many screen pixels wide. */
export const COUGH_SCALE = 2;
/** Source-pixel text box the bubble wraps. */
export const COUGH_TEXT_WIDTH = 32;
export const COUGH_TEXT_HEIGHT = 11;
export const COUGH_FONT_SIZE = COUGH_TEXT_HEIGHT * COUGH_SCALE;
export const COUGH_FONT = `600 ${COUGH_FONT_SIZE}px ui-monospace, monospace`;

/** White bubble outline and tail. `pad` is fill around the text box. */
function buildBubble(pad: number): readonly string[] {
  const innerW = COUGH_TEXT_WIDTH + pad * 2;
  const innerH = COUGH_TEXT_HEIGHT + pad * 2;
  const width = innerW + 2;
  const rows: string[] = ["o".repeat(width)];
  for (let y = 0; y < innerH; y++) {
    rows.push(`o${"w".repeat(innerW)}o`);
  }
  rows.push("o".repeat(width));
  const mid = Math.floor(width / 2);
  const wide = Array.from({ length: width }, (_, i) =>
    Math.abs(i - mid) <= 1 ? "o" : ".",
  ).join("");
  const tip = Array.from({ length: width }, (_, i) =>
    i === mid ? "o" : ".",
  ).join("");
  rows.push(wide, tip);
  return rows;
}

/** Frame 0, a tighter bubble so the pop-in stays crisp. */
export const COUGH_POP_ROWS = buildBubble(1);
/** Frames 1–3. */
export const COUGH_ROWS = buildBubble(2);

export interface CoughMotion {
  frame: number;
  alpha: number;
}

function wrap(value: number, span: number) {
  return ((value % span) + span) % span;
}

/**
 * One play of the bubble, then nothing for the gap.
 * Neighboring ids are a frame apart. Null is the quiet wait.
 */
export function coughMotion(elapsed: number, id: number): CoughMotion | null {
  const shifted = elapsed + id * COUGH_FRAME_SECONDS;
  const wrapped = wrap(shifted, COUGH_CYCLE_SECONDS);
  const frameMs = Math.round(COUGH_FRAME_SECONDS * 1000);
  const playMs = frameMs * COUGH_FRAME_COUNT;
  const ms = Math.round(wrapped * 1000);
  if (ms >= playMs) return null;
  const frame = Math.min(COUGH_FRAME_COUNT - 1, Math.floor(ms / frameMs));
  const into = (ms - frame * frameMs) / frameMs;
  return {
    frame,
    alpha: frame === COUGH_FRAME_COUNT - 1 ? 1 - into : 1,
  };
}

export interface CoughMark {
  /** Tile-space center of the bubble. */
  x: number;
  y: number;
  frame: number;
  alpha: number;
  width: number;
  height: number;
}

function bubbleSize(frame: number) {
  const rows = frame === 0 ? COUGH_POP_ROWS : COUGH_ROWS;
  return {
    width: (rows[0]?.length ?? 0) * COUGH_SCALE,
    height: rows.length * COUGH_SCALE,
  };
}

/**
 * Bubbles for living infected Mosslings the camera can see, at max zoom only.
 */
export function coughsInView(
  mosslings: readonly PreviewMossling[],
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): CoughMark[] {
  if (tileSize !== COUGH_ZOOM) return [];
  const marks: CoughMark[] = [];
  for (const mossling of mosslings) {
    if ((mossling.health ?? 100) <= 0 || mossling.plagueMonths === undefined)
      continue;
    if (mossling.cursedAt !== undefined) {
      const since = elapsed - mossling.cursedAt;
      if (since >= 0 && since < COUGH_PLAY_SECONDS) continue;
    }
    if (!mosslingInView(mossling.cellIndex, mapWidth, camera)) continue;
    const motion = coughMotion(elapsed, mossling.id);
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
