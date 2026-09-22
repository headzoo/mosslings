/** Tiles per game second, west to east. */
export const CLOUD_SPEED = 4;

/** Quiet seconds after one cloud leaves before the next starts. */
const GAP_MIN = 10;
const GAP_SPAN = 15;

/** Clear seconds before the first cloud, so a new world opens under empty sky. */
const LEAD_MIN = 4;
const LEAD_SPAN = 14;

const WIDTHS = [10, 12, 14] as const;

export interface SkyCloud {
  /** Left edge in tile coordinates. Negative while the cloud is still entering. */
  x: number;
  /** Top edge in tile coordinates. */
  y: number;
  width: number;
  height: number;
  /** 0, 1, or 2. Picks a puff shape. */
  silhouette: number;
}

function unit(seed: number, index: number, salt: number) {
  let h =
    (Math.imul(seed ^ salt, 0x9e3779b1) + Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function spec(seed: number, index: number, mapHeight: number) {
  const width = WIDTHS[Math.floor(unit(seed, index, 1) * WIDTHS.length)];
  const height = Math.min(mapHeight, unit(seed, index, 2) < 0.5 ? 3 : 4);
  const lane = Math.max(0, mapHeight - height);
  const y = lane === 0 ? 0 : Math.floor(unit(seed, index, 3) * (lane + 1));
  const silhouette = Math.floor(unit(seed, index, 4) * 3);
  return { width, height, y, silhouette };
}

/**
 * Clouds crossing the map at this game time.
 * One cloud is in the sky at a time. A gap follows each crossing.
 */
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
  const clouds: SkyCloud[] = [];
  let start = LEAD_MIN + unit(seed, 0, 5) * LEAD_SPAN;
  for (let index = 0; start <= elapsed; index++) {
    const cloud = spec(seed, index, mapHeight);
    const duration = (mapWidth + cloud.width) / CLOUD_SPEED;
    const x = -cloud.width + (elapsed - start) * CLOUD_SPEED;
    if (x < mapWidth && x + cloud.width > 0) {
      clouds.push({ ...cloud, x });
    }
    const gap = GAP_MIN + unit(seed, index, 6) * GAP_SPAN;
    start += duration + gap;
  }
  return clouds;
}
