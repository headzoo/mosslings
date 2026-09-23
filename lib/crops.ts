import type { MapCell, MapData } from "./map";
import { type TraitReading, traitValue } from "./mossling-traits";

/** At or above this, a wet month can ripen the crop. */
export const CROP_GROW_MOISTURE = 0.4;
/** At or above this, a lit month can ripen the crop. */
export const CROP_GROW_LIGHT = 0.4;
/** At or below this, the crop dies. */
export const CROP_WILT_MOISTURE = 0.16;
/** A fully watered crop reaches the wilt line after five years without rain. */
export const CROP_DROUGHT_MONTHS = 5 * 12;
export const CROP_MOISTURE_LOSS =
  (1 - CROP_WILT_MOISTURE) / CROP_DROUGHT_MONTHS;
/**
 * A full sun charge stays above the grow line for about a year.
 * Darkness stalls a crop. It does not kill it.
 */
export const CROP_LIGHT_LOSS = 0.05;
/** Six months that are both wet and lit take a planting from sprout to ripe. */
export const CROP_GROWTH_STEP = 1 / 6;

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function appetite(traits: readonly TraitReading[] | undefined): number {
  const metabolism = traitValue(traits, "Metabolism");
  const drive = traitValue(traits, "Food drive");
  return 0.55 + ((metabolism + drive) / 200) * 0.9;
}

/** Salted so the seed-7 fixtures used by crop tests stay healthy. */
const BLIGHT_SALT = 0xb;

export type CropAdvance = {
  withered: number;
  /** Tile where a blight outbreak started this month. */
  blightAt: { x: number; y: number } | null;
};

/** About one planted carrot tile in a hundred carries a hidden blight. */
export function cropCarriesBlight(seed: number, index: number): boolean {
  let hash = Math.imul((seed ^ BLIGHT_SALT) >>> 0, (index + 1) | 0);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) % 100 === 0;
}

/** Mark a newly planted carrot, or clear a blight left on this tile. */
export function rollCropBlight(cell: MapCell, seed: number, index: number) {
  if (cropCarriesBlight(seed, index)) cell.blight = true;
  else delete cell.blight;
}

function isCarrot(cell: MapCell | undefined): boolean {
  return (
    !!cell &&
    cell.growth !== undefined &&
    !cell.burning &&
    !cell.damage &&
    !cell.tree
  );
}

function ripeBlighted(cell: MapCell): boolean {
  return cell.blight === true && (cell.growth ?? 0) >= 1;
}

function hasRipeBlightNeighbor(map: MapData, index: number): boolean {
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
    const neighbor = map.cells[ny * map.width + nx];
    if (neighbor && isCarrot(neighbor) && ripeBlighted(neighbor)) return true;
  }
  return false;
}

/**
 * Ripe blighted carrots infect every orthogonally connected carrot.
 * Unripe tiles in that patch carry the blight and pass it on, but they
 * still look healthy until they themselves are fully ripe.
 * Returns the first ripe tile that infected a neighbor.
 */
function spreadCropBlight(map: MapData): { x: number; y: number } | null {
  const queue: number[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < map.cells.length; index++) {
    const cell = map.cells[index];
    if (!cell || !isCarrot(cell) || !ripeBlighted(cell)) continue;
    queue.push(index);
    seen.add(index);
  }
  let origin: { x: number; y: number } | null = null;
  let head = 0;
  while (head < queue.length) {
    const index = queue[head++];
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const next = ny * map.width + nx;
      if (seen.has(next)) continue;
      const neighbor = map.cells[next];
      if (!neighbor || !isCarrot(neighbor)) continue;
      seen.add(next);
      if (!neighbor.blight) {
        neighbor.blight = true;
        if (!origin) origin = { x, y };
      }
      queue.push(next);
    }
  }
  return origin;
}

/** Food supply from crop tiles, scaled by seasonal stand height. */
export function cropFoodSupply(map: MapData, cropCover = 1): number {
  if (cropCover <= 0) return 0;
  let supply = 0;
  for (const cell of map.cells) {
    if (cell.growth === undefined || cell.burning || cell.damage || cell.tree)
      continue;
    if (ripeBlighted(cell)) continue;
    supply += Math.min(1, cell.growth) * cropCover;
  }
  return supply;
}

/**
 * Ripen crops that are both wet and lit, and clear those that have gone too dry.
 * Dormant seasons hold every field as it is: no growth, no wilt, and no food.
 * A blighted carrot that reaches full ripeness infects the carrot patch beside it.
 */
export function advanceCrops(map: MapData, cropCover = 1): CropAdvance {
  if (cropCover <= 0) return { withered: 0, blightAt: null };
  let withered = 0;
  let ripenedAt: { x: number; y: number } | null = null;
  for (let index = 0; index < map.cells.length; index++) {
    const cell = map.cells[index];
    if (!cell || !isCarrot(cell)) continue;
    let growth = cell.growth ?? 0;
    cell.moisture = Math.max(0, cell.moisture - CROP_MOISTURE_LOSS);
    const light = Math.max(0, (cell.light ?? 0) - CROP_LIGHT_LOSS);
    cell.light = light < 1e-6 ? undefined : light;
    if (cell.moisture <= CROP_WILT_MOISTURE) {
      cell.growth = undefined;
      delete cell.blight;
      withered++;
      continue;
    }
    if (
      cell.moisture < CROP_GROW_MOISTURE ||
      (cell.light ?? 0) < CROP_GROW_LIGHT ||
      growth >= 1
    )
      continue;
    growth = Math.min(1, growth + CROP_GROWTH_STEP);
    if (growth > 1 - 1e-6) growth = 1;
    cell.growth = growth;
    if (
      cell.blight &&
      growth >= 1 &&
      !ripenedAt &&
      !hasRipeBlightNeighbor(map, index)
    ) {
      ripenedAt = {
        x: index % map.width,
        y: Math.floor(index / map.width),
      };
    }
  }
  const spreadAt = spreadCropBlight(map);
  return { withered, blightAt: spreadAt ?? ripenedAt };
}

/** Keep `count` ripe tiles wet through `months` month-ticks. */
export function provisionCrops(
  map: MapData,
  count: number,
  months: number,
): number {
  let planted = 0;
  const moisture = CROP_WILT_MOISTURE + 0.05 + months * CROP_MOISTURE_LOSS;
  for (const cell of map.cells) {
    if (planted >= count) break;
    if (
      cell.terrain === "water" ||
      cell.terrain === "rock" ||
      cell.terrain === "sand" ||
      cell.tree ||
      cell.burning
    )
      continue;
    cell.terrain = cell.terrain === "dirt" ? "grass" : cell.terrain;
    cell.growth = 1;
    cell.moisture = moisture;
    cell.damage = undefined;
    planted++;
  }
  return planted;
}

function plant(cell: MapCell, seed: number, index: number) {
  cell.terrain = "grass";
  cell.growth = 1;
  cell.moisture = 1;
  cell.damage = undefined;
  cell.burning = false;
  rollCropBlight(cell, seed, index);
}

/**
 * Plant `count` ripe crop tiles in a few clusters.
 * Grass is used first; dirt is converted when grass runs out.
 * Sand, rock, water, occupied, forested, burning, and damaged tiles are left alone.
 */
export function plantStarterFields(
  map: MapData,
  count: number,
  occupied: ReadonlySet<number>,
): number {
  if (count <= 0) return 0;
  const open = (index: number, grassOnly: boolean) => {
    const cell = map.cells[index];
    if (
      !cell ||
      occupied.has(index) ||
      cell.tree ||
      cell.burning ||
      cell.damage
    )
      return false;
    return grassOnly
      ? cell.terrain === "grass"
      : cell.terrain === "grass" || cell.terrain === "dirt";
  };
  let pool = map.cells.flatMap((_, index) =>
    open(index, true) ? [index] : [],
  );
  if (pool.length < count)
    pool = map.cells.flatMap((_, index) => (open(index, false) ? [index] : []));
  const target = Math.min(count, pool.length);
  if (target === 0) return 0;

  const allowed = new Set(pool);
  let state = map.seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const patches = Math.min(target, Math.max(1, Math.ceil(target / 8)));
  const seeds: number[] = [];
  const seeded = new Set<number>();
  while (seeds.length < patches) {
    let best = -1;
    let bestDist = -1;
    const samples = Math.min(pool.length, 32);
    for (let i = 0; i < samples; i++) {
      const index = pool[Math.floor(random() * pool.length)] ?? -1;
      if (index < 0 || seeded.has(index)) continue;
      let nearest = Infinity;
      for (const seed of seeds) {
        const dist =
          Math.abs((index % map.width) - (seed % map.width)) +
          Math.abs(
            Math.floor(index / map.width) - Math.floor(seed / map.width),
          );
        if (dist < nearest) nearest = dist;
      }
      if (seeds.length === 0) nearest = 0;
      if (nearest > bestDist) {
        bestDist = nearest;
        best = index;
      }
    }
    if (best < 0 || seeded.has(best)) break;
    seeds.push(best);
    seeded.add(best);
  }

  const chosen: number[] = [...seeds];
  const queues = seeds.map((seed) => [seed]);
  const seen = new Set(seeds);
  let stalled = false;
  while (chosen.length < target && !stalled) {
    stalled = true;
    for (const queue of queues) {
      if (chosen.length >= target) break;
      const index = queue.shift();
      if (index === undefined) continue;
      stalled = false;
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const next = ny * map.width + nx;
        if (seen.has(next) || !allowed.has(next)) continue;
        seen.add(next);
        queue.push(next);
        chosen.push(next);
        if (chosen.length >= target) break;
      }
    }
  }
  if (chosen.length < target)
    for (const index of pool) {
      if (chosen.length >= target) break;
      if (seen.has(index)) continue;
      seen.add(index);
      chosen.push(index);
    }

  for (const index of chosen) {
    const cell = map.cells[index];
    if (cell) plant(cell, map.seed, index);
  }
  return chosen.length;
}
