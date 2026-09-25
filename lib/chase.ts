import {
  COUGH_SCALE,
  COUGH_ZOOM,
  SPEECH_POP_ROWS,
  SPEECH_ROWS,
  type CoughMark,
  coughMotion,
} from "./cough";
import { WEEK_SECONDS } from "./game-time";
import type { Camera } from "./map-camera";
import type { PreviewMossling } from "./map-preview";
import { mosslingInView } from "./mossling-detail";

/** Two weeks, half a month. */
export const CHASE_PLAY_SECONDS = WEEK_SECONDS * 2;
/** Half the gap, so the two bodies stay three tiles apart. */
export const CHASE_RADIUS = 1.5;
/** One circuit. A two-week chase is about two laps. */
export const CHASE_LAP_SECONDS = 1;
/** Chase sentences. One line per runner, stable for that id. */
export const CHASE_LINES = ["😂🏃💨", "🤣👉😜", "😜💨💚", "🏃💨🤣"] as const;
export type ChaseLine = (typeof CHASE_LINES)[number];

/** One chase sentence, stable for this id. */
export function chaseLine(id: number): ChaseLine {
  const pick = (Math.imul(id + 1, 0x85ebca6b) >>> 0) % CHASE_LINES.length;
  return CHASE_LINES[pick] ?? CHASE_LINES[0];
}

/** Chebyshev tiles. The same spacing where a pair stops walking and plays. */
const CHASE_REACH = 2;

export interface ChasePlace {
  /** Tile-space top-left of the sprite. */
  x: number;
  y: number;
  face: "left" | "right";
}

function cellPos(cellIndex: number, width: number) {
  return {
    x: cellIndex % width,
    y: Math.floor(cellIndex / width),
  };
}

function alive(
  mossling: PreviewMossling | undefined,
): mossling is PreviewMossling {
  return !!mossling && (mossling.health ?? 100) > 0;
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** True while a linked pair is circling and still close enough to keep at it. */
export function chasing(
  mossling: PreviewMossling,
  partner: PreviewMossling | undefined,
  width: number,
): boolean {
  const game = mossling.soccer;
  if (!game || game.kind !== "chase") return false;
  if (!alive(mossling) || !alive(partner)) return false;
  if (game.phase !== "play" || partner.soccer?.phase !== "play") return false;
  if (partner.soccer?.kind !== "chase") return false;
  if (partner.soccer.partnerId !== mossling.id || game.partnerId !== partner.id)
    return false;
  const distance = chebyshev(
    cellPos(mossling.cellIndex, width),
    cellPos(partner.cellIndex, width),
  );
  return distance >= 1 && distance <= CHASE_REACH;
}

/**
 * Tile-space spot on the circle. The lower id leads; the partner stays opposite.
 * Null once the two weeks are over, even if the month tick has not cleared them.
 */
export function chasePlace(
  mossling: PreviewMossling,
  partner: PreviewMossling | undefined,
  width: number,
  elapsed: number,
): ChasePlace | null {
  if (!chasing(mossling, partner, width) || !partner) return null;
  const since = mossling.soccer?.since ?? 0;
  if (elapsed < since || elapsed >= since + CHASE_PLAY_SECONDS) return null;
  const self = cellPos(mossling.cellIndex, width);
  const other = cellPos(partner.cellIndex, width);
  const centerX = (self.x + other.x) / 2;
  const centerY = (self.y + other.y) / 2;
  const lead = mossling.id < partner.id;
  const turns = (elapsed - since) / CHASE_LAP_SECONDS;
  const angle = turns * Math.PI * 2 + (lead ? 0 : Math.PI);
  const vx = -Math.sin(angle);
  return {
    x: centerX + Math.cos(angle) * CHASE_RADIUS,
    y: centerY + Math.sin(angle) * CHASE_RADIUS,
    face: vx < 0 ? "left" : "right",
  };
}

function bubbleSize(frame: number) {
  const rows = frame === 0 ? SPEECH_POP_ROWS : SPEECH_ROWS;
  return {
    width: (rows[0]?.length ?? 0) * COUGH_SCALE,
    height: rows.length * COUGH_SCALE,
  };
}

function originInView(
  x: number,
  y: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
) {
  return (
    x < camera.x + camera.width &&
    x + 1 > camera.x &&
    y < camera.y + camera.height &&
    y + 1 > camera.y
  );
}

/**
 * Emoji bubbles for chasers the camera can see, at max zoom only.
 * The pop, fade, and gap match a cough, and the bubble sits on the orbit.
 */
export function lolInView(
  mosslings: readonly PreviewMossling[],
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): CoughMark[] {
  if (tileSize !== COUGH_ZOOM) return [];
  const byId = new Map(mosslings.map((mossling) => [mossling.id, mossling]));
  const marks: CoughMark[] = [];
  for (const mossling of mosslings) {
    const partner = mossling.soccer
      ? byId.get(mossling.soccer.partnerId)
      : undefined;
    const place = chasePlace(mossling, partner, mapWidth, elapsed);
    if (!place) continue;
    if (
      !mosslingInView(mossling.cellIndex, mapWidth, camera) &&
      !originInView(place.x, place.y, camera)
    )
      continue;
    const motion = coughMotion(elapsed, mossling.id);
    if (!motion || motion.alpha <= 0.01) continue;
    const { width, height } = bubbleSize(motion.frame);
    const tipY = place.y - 2 / tileSize;
    marks.push({
      x: place.x + 0.5,
      y: tipY - height / 2 / tileSize,
      frame: motion.frame,
      alpha: motion.alpha,
      width,
      height,
      text: chaseLine(mossling.id),
    });
  }
  return marks;
}
