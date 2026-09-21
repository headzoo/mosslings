import type { MapCell, MapData } from "./map";
import { type TraitReading, traitValue } from "./mossling-traits";

/** At or above this, a wet month ripens the crop. */
export const CROP_GROW_MOISTURE = 0.4;
/** At or below this, the crop dies. */
export const CROP_WILT_MOISTURE = 0.16;
/** A fully watered crop reaches the wilt line after five years without rain. */
export const CROP_DROUGHT_MONTHS = 5 * 12;
export const CROP_MOISTURE_LOSS =
  (1 - CROP_WILT_MOISTURE) / CROP_DROUGHT_MONTHS;
/** Six wet months take a planting from sprout to ripe. */
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

export function ripeTiles(map: MapData): number {
  let count = 0;
  for (const cell of map.cells) if (isRipe(cell)) count++;
  return count;
}

export function isRipe(cell: MapCell): boolean {
  return (cell.growth ?? 0) >= 1 && !cell.burning && !cell.damage && !cell.tree;
}

/** Ripen wet crops and clear those that have gone too dry. Returns how many died. */
export function advanceCrops(map: MapData): number {
  let withered = 0;
  for (const cell of map.cells) {
    if (cell.growth === undefined || cell.burning || cell.damage || cell.tree)
      continue;
    cell.moisture = Math.max(0, cell.moisture - CROP_MOISTURE_LOSS);
    if (cell.moisture <= CROP_WILT_MOISTURE) {
      cell.growth = undefined;
      withered++;
      continue;
    }
    if (cell.moisture < CROP_GROW_MOISTURE || cell.growth >= 1) continue;
    cell.growth = Math.min(1, cell.growth + CROP_GROWTH_STEP);
    if (cell.growth > 1 - 1e-6) cell.growth = 1;
  }
  return withered;
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

function plant(cell: MapCell) {
  cell.terrain = "grass";
  cell.growth = 1;
  cell.moisture = 1;
  cell.damage = undefined;
  cell.burning = false;
}

/**
 * Plant `count` ripe crop tiles in a few clusters.
 * Grass is used first; dirt is converted when grass runs out.
 * Occupied, forested, burning, and damaged tiles are left alone.
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
    if (cell) plant(cell);
  }
  return chosen.length;
}
