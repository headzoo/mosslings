/** Tiles per game second, west to east. */
export const CLOUD_SPEED = 4;

/** Quiet seconds after one cluster leaves before the next starts. */
const GAP_MIN = 10;
const GAP_SPAN = 15;

/** Clear seconds before the first cloud, so a new world opens under empty sky. */
const LEAD_MIN = 4;
const LEAD_SPAN = 14;

const WIDTHS = [8, 10, 12, 14, 16] as const;
const HEIGHTS = [2, 3, 4] as const;
const SPEED_MIN = 0.92;
const SPEED_SPAN = 0.16;

export interface SkyCloud {
  /** Left edge in tile coordinates. Negative while the cloud is still entering. */
  x: number;
  /** Top edge in tile coordinates. */
  y: number;
  width: number;
  height: number;
  /** 0, 1, or 2. Picks a puff shape. */
  silhouette: number;
  /** Tiles per game second, west to east. */
  speed: number;
}

type PuffSpec = {
  width: number;
  height: number;
  y: number;
  silhouette: number;
  speed: number;
  /** Left edge at cluster start, west of the map. */
  x0: number;
};

function unit(seed: number, index: number, salt: number) {
  let h =
    (Math.imul(seed ^ salt, 0x9e3779b1) + Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick<T extends number>(
  seed: number,
  index: number,
  salt: number,
  pool: readonly T[],
  used: ReadonlySet<number>,
): T {
  const unused = pool.filter((item) => !used.has(item));
  const choices = unused.length > 0 ? unused : pool;
  return choices[Math.floor(unit(seed, index, salt) * choices.length)];
}

function clusterSpec(
  seed: number,
  index: number,
  mapHeight: number,
): PuffSpec[] {
  const count = 2 + Math.floor(unit(seed, index, 7) * 2);
  const maxHeight = Math.min(HEIGHTS[HEIGHTS.length - 1], mapHeight);
  const pad = mapHeight > maxHeight + 4 ? 2 : 0;
  const lane = Math.max(0, mapHeight - maxHeight - pad);
  const anchor =
    pad + (lane === 0 ? 0 : Math.floor(unit(seed, index, 8) * (lane + 1)));
  const heights = HEIGHTS.filter((height) => height <= mapHeight);
  const heightPool = heights.length > 0 ? heights : [Math.max(1, mapHeight)];
  const usedWidths = new Set<number>();
  const usedHeights = new Set<number>();
  const puffs: PuffSpec[] = [];
  let behind = 0;
  for (let puff = 0; puff < count; puff++) {
    const salt = 20 + puff * 10;
    const width = pick(seed, index, salt, WIDTHS, usedWidths);
    usedWidths.add(width);
    const height = pick(seed, index, salt + 1, heightPool, usedHeights);
    usedHeights.add(height);
    let dy = 0;
    if (puff > 0) {
      const sign = unit(seed, index, salt + 2) < 0.5 ? -1 : 1;
      dy = sign * (1 + Math.floor(unit(seed, index, salt + 3) * 2));
    }
    const y = Math.max(0, Math.min(mapHeight - height, anchor + dy));
    const silhouette = Math.floor(unit(seed, index, salt + 4) * 3);
    const speed =
      CLOUD_SPEED * (SPEED_MIN + unit(seed, index, salt + 5) * SPEED_SPAN);
    if (puff > 0) behind += 6 + unit(seed, index, salt + 6) * 3;
    puffs.push({
      width,
      height,
      y,
      silhouette,
      speed,
      x0: -width - behind,
    });
  }
  return puffs;
}

function clusterDuration(puffs: PuffSpec[], mapWidth: number) {
  let duration = 0;
  for (const puff of puffs) {
    const crossing = (mapWidth - puff.x0) / puff.speed;
    if (crossing > duration) duration = crossing;
  }
  return duration;
}

/**
 * Clouds crossing the map at this game time.
 * One cluster of 2–3 puffs is in the sky at a time. A gap follows each crossing.
 * A cursor resumes from the last cluster when time moves forward on the same map.
 */
type CloudCursor = {
  seed: number;
  mapWidth: number;
  mapHeight: number;
  index: number;
  start: number;
};

let cloudCursor: CloudCursor | null = null;

export function skyCloudsAt(
  elapsed: number,
  seed: number,
  mapWidth: number,
  mapHeight: number,
): SkyCloud[] {
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
    cloudCursor &&
    cloudCursor.seed === seed &&
    cloudCursor.mapWidth === mapWidth &&
    cloudCursor.mapHeight === mapHeight &&
    elapsed >= cloudCursor.start
  ) {
    index = cloudCursor.index;
    start = cloudCursor.start;
  }
  const clouds: SkyCloud[] = [];
  while (start <= elapsed) {
    const puffs = clusterSpec(seed, index, mapHeight);
    const dt = elapsed - start;
    for (const puff of puffs) {
      const x = puff.x0 + dt * puff.speed;
      if (x < mapWidth && x + puff.width > 0) {
        clouds.push({
          x,
          y: puff.y,
          width: puff.width,
          height: puff.height,
          silhouette: puff.silhouette,
          speed: puff.speed,
        });
      }
    }
    const gap = GAP_MIN + unit(seed, index, 6) * GAP_SPAN;
    const nextStart = start + clusterDuration(puffs, mapWidth) + gap;
    if (nextStart > elapsed) {
      cloudCursor = { seed, mapWidth, mapHeight, index, start };
      return clouds;
    }
    start = nextStart;
    index += 1;
  }
  cloudCursor = { seed, mapWidth, mapHeight, index, start };
  return clouds;
}
