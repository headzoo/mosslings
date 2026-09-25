import { type Camera, ZOOM_LEVELS } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView } from "./mossling-detail";

/** Largest map zoom. The cough bubble is a max-zoom sprite only. */
export const COUGH_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 32;
export const COUGH_FRAME_COUNT = 4;
/** Long enough that a short line can be read before the fade. */
export const COUGH_FRAME_SECONDS = 0.6;
export const COUGH_PLAY_SECONDS = COUGH_FRAME_SECONDS * COUGH_FRAME_COUNT;
export const COUGH_GAP_SECONDS = 2;
export const COUGH_CYCLE_SECONDS = COUGH_PLAY_SECONDS + COUGH_GAP_SECONDS;
export const COUGH_FILL = "#fff6d8";
export const COUGH_INK = "#2a2418";
/** Sick sentences. One line per speaker, stable for that id. */
export const SICK_LINES = ["🤧💦😷", "🤒🤢💦", "😷🤧💫"] as const;
export type SickLine = (typeof SICK_LINES)[number];
/** Each source pixel is drawn this many screen pixels wide. */
export const COUGH_SCALE = 2;
/** Source-pixel text box the swear bubble wraps. */
export const COUGH_TEXT_WIDTH = 32;
/** Source-pixel text box for about four emoji. */
export const SPEECH_TEXT_WIDTH = 48;
export const COUGH_TEXT_HEIGHT = 11;
/** Source pixels of fill above and below the line. */
export const BUBBLE_PAD_Y = 2;
export const COUGH_FONT_SIZE = COUGH_TEXT_HEIGHT * COUGH_SCALE;
export const COUGH_FONT = `600 ${COUGH_FONT_SIZE}px ui-monospace, monospace`;
export const SPEECH_FONT = `${COUGH_FONT_SIZE}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

/** One sick sentence, stable for this id. */
export function sickLine(id: number): SickLine {
  const pick = (Math.imul(id + 1, 0x27d4eb2f) >>> 0) % SICK_LINES.length;
  return SICK_LINES[pick] ?? SICK_LINES[0];
}

/**
 * Borderless pill. `padX` is fill beside the line; the caps are semicircles.
 * `w` is fill. There is no ink outline and no tail.
 */
function buildBubble(textWidth: number, padX: number): readonly string[] {
  const height = COUGH_TEXT_HEIGHT + BUBBLE_PAD_Y * 2;
  const width = textWidth + padX * 2 + height;
  const radius = height / 2;
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    const dy = y + 0.5 - radius;
    const dx = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    const left = radius - dx;
    const right = width - radius + dx;
    let row = "";
    for (let x = 0; x < width; x++) {
      const sample = x + 0.5;
      row += sample >= left && sample <= right ? "w" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/** Frame 0, a tighter pill so the pop-in stays crisp. Swear width. */
export const COUGH_POP_ROWS = buildBubble(COUGH_TEXT_WIDTH, 1);
/** Frames 1–3. Swear width. */
export const COUGH_ROWS = buildBubble(COUGH_TEXT_WIDTH, 2);
/** Frame 0 at emoji-sentence width. */
export const SPEECH_POP_ROWS = buildBubble(SPEECH_TEXT_WIDTH, 1);
/** Frames 1–3 at emoji-sentence width. */
export const SPEECH_ROWS = buildBubble(SPEECH_TEXT_WIDTH, 2);

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
  /** Emoji sentence. Swears leave this unset and draw their own text. */
  text?: string;
}

function bubbleSize(frame: number) {
  const rows = frame === 0 ? SPEECH_POP_ROWS : SPEECH_ROWS;
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
      text: sickLine(mossling.id),
    });
  }
  return marks;
}
