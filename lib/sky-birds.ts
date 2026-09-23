import { CLOUD_SPEED } from "./sky-clouds";

/** Quiet seconds after one flock leaves before the next starts. */
const GAP_MIN = 18;
const GAP_SPAN = 18;

/** Clear seconds before the first flock, so a new world opens under an empty sky. */
const LEAD_MIN = 6;
const LEAD_SPAN = 10;

/** Slot jitter, each side of a V point, in tiles. */
const JITTER = 0.33;
const BOB_AMP = 0.22;
const BOB_PERIOD = 2.6;

/** Half of the 16px sprite at the normal 8px tile. */
const BIRD_HALF = 1;

/** Leader at the east tip. Arms trail west, alternating above and below. */
const V_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1.7, -1.2],
  [-1.7, 1.2],
  [-3.4, -2.3],
  [-3.4, 2.3],
];

export interface SkyBird {
  /** Center in tile coordinates. Negative while the bird is still entering. */
  x: number;
  /** Center in tile coordinates. */
  y: number;
  /** 0 wings up, 1 level, 2 down. */
  pose: 0 | 1 | 2;
  leader: boolean;
}

type Slot = {
  x: number;
  y: number;
  flapPhase: number;
  flapPeriod: number;
  bobPhaseX: number;
  bobPhaseY: number;
  leader: boolean;
};

function unit(seed: number, index: number, salt: number) {
  let h =
    (Math.imul(seed ^ salt, 0x9e3779b1) + Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function bob(elapsed: number, phase: number) {
  return Math.sin((elapsed / BOB_PERIOD) * Math.PI * 2 + phase) * BOB_AMP;
}

function flockSlots(seed: number, index: number, mapHeight: number): Slot[] {
  const six = unit(seed, index, 4) < 0.5;
  const arm = unit(seed, index, 9) < 0.5 ? -1 : 1;
  const points: Array<readonly [number, number]> = [...V_SLOTS];
  if (six) points.push([-5.1, arm * 3.3]);

  const yReach = 3.3 + JITTER + BOB_AMP;
  const yScale =
    mapHeight <= 1 ? 0 : Math.min(1, (mapHeight - 1) / (yReach * 2));

  const slots: Slot[] = points.map((point, bird) => {
    const salt = 30 + bird * 11;
    return {
      x: point[0] + (unit(seed, index, salt) - 0.5) * 2 * JITTER,
      y: point[1] * yScale + (unit(seed, index, salt + 1) - 0.5) * 2 * JITTER,
      flapPhase: unit(seed, index, salt + 2),
      flapPeriod: 0.46 + unit(seed, index, salt + 3) * 0.12,
      bobPhaseX: unit(seed, index, salt + 4) * Math.PI * 2,
      bobPhaseY: unit(seed, index, salt + 5) * Math.PI * 2,
      leader: bird === 0,
    };
  });

  let minY = Infinity;
  let maxY = -Infinity;
  for (const slot of slots) {
    minY = Math.min(minY, slot.y - BOB_AMP);
    maxY = Math.max(maxY, slot.y + BOB_AMP);
  }
  const room = Math.max(0, mapHeight - (maxY - minY));
  const anchor = -minY + (room === 0 ? 0 : unit(seed, index, 8) * room);
  for (const slot of slots) slot.y += anchor;
  return slots;
}

/** Leader origin at the start, and seconds until the last bird has cleared the east. */
function flockSpan(slots: Slot[], mapWidth: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const slot of slots) {
    minX = Math.min(minX, slot.x - BOB_AMP);
    maxX = Math.max(maxX, slot.x + BOB_AMP);
  }
  const x0 = -BIRD_HALF - maxX;
  const clearOrigin = mapWidth + BIRD_HALF - minX;
  return { x0, duration: (clearOrigin - x0) / CLOUD_SPEED };
}

function poseAt(elapsed: number, slot: Slot): 0 | 1 | 2 {
  const cycle = (elapsed / slot.flapPeriod + slot.flapPhase) % 1;
  return Math.floor(cycle * 3) as 0 | 1 | 2;
}

/**
 * Birds crossing the map at this game time.
 * One flock of 5–6 flies west to east at the cloud speed, then the sky is quiet.
 * A cursor resumes from the last flock when time moves forward on the same map.
 */
type BirdCursor = {
  seed: number;
  mapWidth: number;
  mapHeight: number;
  index: number;
  start: number;
};

let birdCursor: BirdCursor | null = null;

export function skyBirdsAt(
  elapsed: number,
  seed: number,
  mapWidth: number,
  mapHeight: number,
): SkyBird[] {
  if (
    mapWidth < 1 ||
    mapHeight < 1 ||
    !Number.isFinite(elapsed) ||
    elapsed < 0
  ) {
    return [];
  }
  let index = 0;
  let start = LEAD_MIN + unit(seed, 0, 5) * LEAD_SPAN;
  if (
    birdCursor &&
    birdCursor.seed === seed &&
    birdCursor.mapWidth === mapWidth &&
    birdCursor.mapHeight === mapHeight &&
    elapsed >= birdCursor.start
  ) {
    index = birdCursor.index;
    start = birdCursor.start;
  }
  while (start <= elapsed) {
    const slots = flockSlots(seed, index, mapHeight);
    const { x0, duration } = flockSpan(slots, mapWidth);
    const dt = elapsed - start;
    const origin = x0 + dt * CLOUD_SPEED;
    const birds: SkyBird[] = [];
    if (dt <= duration) {
      for (const slot of slots) {
        const x = origin + slot.x + bob(elapsed, slot.bobPhaseX);
        const y = Math.min(
          mapHeight,
          Math.max(0, slot.y + bob(elapsed, slot.bobPhaseY)),
        );
        if (x + BIRD_HALF > 0 && x - BIRD_HALF < mapWidth) {
          birds.push({
            x,
            y,
            pose: poseAt(elapsed, slot),
            leader: slot.leader,
          });
        }
      }
    }
    const gap = GAP_MIN + unit(seed, index, 6) * GAP_SPAN;
    const nextStart = start + duration + gap;
    if (nextStart > elapsed) {
      birdCursor = { seed, mapWidth, mapHeight, index, start };
      return birds;
    }
    start = nextStart;
    index += 1;
  }
  birdCursor = { seed, mapWidth, mapHeight, index, start };
  return [];
}
