import {
  COUGH_SCALE,
  COUGH_ZOOM,
  SPEECH_POP_ROWS,
  SPEECH_ROWS,
  type CoughMark,
  coughMotion,
} from "./cough";
import { cursing } from "./curse";
import { pullingCarrots } from "./field-work";
import { touchesFire } from "./fire-sprite";
import { gameDateAt } from "./game-time";
import { fliesKite } from "./kites";
import type { MapData } from "./map";
import type { Camera } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView } from "./mossling-detail";
import { isWhistling, seasonIndexAt } from "./whistle";

/** Share of idle Mosslings who talk in a given season. */
export const CHATTER_CHANCE = 2;
export const CHATTER_LINES = [
  "🥕😋💚",
  "🌞😎🌿",
  "😂🤣💚",
  "😏👀💋",
  "🥰👉👈",
  "🌙💋✨",
  "🌿💚🥰",
  "😜💨🏃",
  "🤔👀🌿",
  "😎💪🔥",
  "🍑👀😏",
  "💤🌙🌿",
  "🤗💚🥕",
  "😋👉👌",
  "💃🕺✨",
  "🔥😏💦",
] as const;

export type ChatterLine = (typeof CHATTER_LINES)[number];

export interface ChatterMark extends CoughMark {
  text: ChatterLine;
}

/** True for about half of ids, for this season only. */
export function chatterRoll(id: number, seasonIndex: number): boolean {
  return (
    ((Math.imul(id + 1, 0xc2b2ae35) ^
      Math.imul(seasonIndex + 1, 0x27d4eb2f)) >>>
      0) %
      CHATTER_CHANCE ===
    0
  );
}

/** One emoji sentence, stable until the season changes. */
export function chatterLine(id: number, seasonIndex: number): ChatterLine {
  const pick =
    ((Math.imul(id + 1, 0x165667b1) ^
      Math.imul(seasonIndex + 1, 0x85ebca6b)) >>>
      0) %
    CHATTER_LINES.length;
  return CHATTER_LINES[pick] ?? CHATTER_LINES[0];
}

/**
 * Living, idle, and winning the season roll.
 * A game, a courtship, a cough, a swear, a whistle, or a kite already speaks.
 */
export function isChattering(
  mossling: PreviewMossling,
  elapsed: number,
  map: MapData,
  partner?: PreviewMossling,
): boolean {
  if ((mossling.health ?? 100) <= 0) return false;
  if (mossling.plagueMonths !== undefined) return false;
  if (cursing(mossling, elapsed)) return false;
  if ((mossling.panic ?? 0) > 0.1) return false;
  if (mossling.soccer) return false;
  if (mossling.ritual) return false;
  if (isWhistling(mossling, elapsed)) return false;
  const season = gameDateAt(elapsed).season;
  if (fliesKite(mossling, season, map, partner)) return false;
  const cell = map.cells[mossling.cellIndex];
  if (pullingCarrots(season, cell)) return false;
  if (cell?.terrain === "water") return false;
  if (touchesFire(map, mossling.cellIndex)) return false;
  return chatterRoll(mossling.id, seasonIndexAt(elapsed));
}

function bubbleSize(frame: number) {
  const rows = frame === 0 ? SPEECH_POP_ROWS : SPEECH_ROWS;
  return {
    width: (rows[0]?.length ?? 0) * COUGH_SCALE,
    height: rows.length * COUGH_SCALE,
  };
}

/**
 * Bubbles for idle talkers the camera can see, at max zoom only.
 * The pop, fade, and gap match a cough, and the line holds for the season.
 */
export function chattersInView(
  mosslings: readonly PreviewMossling[],
  map: MapData,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): ChatterMark[] {
  if (tileSize !== COUGH_ZOOM) return [];
  const byId = new Map(mosslings.map((mossling) => [mossling.id, mossling]));
  const seasonIndex = seasonIndexAt(elapsed);
  const marks: ChatterMark[] = [];
  for (const mossling of mosslings) {
    const partner = mossling.soccer
      ? byId.get(mossling.soccer.partnerId)
      : undefined;
    if (!isChattering(mossling, elapsed, map, partner)) continue;
    if (!mosslingInView(mossling.cellIndex, map.width, camera)) continue;
    const motion = coughMotion(elapsed, mossling.id);
    if (!motion || motion.alpha <= 0.01) continue;
    const { width, height } = bubbleSize(motion.frame);
    const cellX = mossling.cellIndex % map.width;
    const cellY = Math.floor(mossling.cellIndex / map.width);
    const tipY = cellY - 2 / tileSize;
    marks.push({
      x: cellX + 0.5,
      y: tipY - height / 2 / tileSize,
      frame: motion.frame,
      alpha: motion.alpha,
      width,
      height,
      text: chatterLine(mossling.id, seasonIndex),
    });
  }
  return marks;
}
