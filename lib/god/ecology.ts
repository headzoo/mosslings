import { MONTH_SECONDS, YEAR_SECONDS } from "../game-time";
import type { MapCell, MapData } from "../map";

export const RECOVERY_SECONDS = 2 * YEAR_SECONDS;
export const FOREST_SPREAD_SECONDS = 2 * YEAR_SECONDS;
/** A tree spreads only while its own ground is at least this wet. */
export const FOREST_SPREAD_MOISTURE = 0.7;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const FIELDS = ["fertility", "moisture", "elevation", "rockiness"] as const;

/** Scatter forest patches across open grass before the world starts. */
export function plantStarterForests(
  map: MapData,
  occupied: ReadonlySet<number>,
): number {
  const pool = map.cells.flatMap((cell, index) => {
    if (
      occupied.has(index) ||
      cell.terrain !== "grass" ||
      cell.tree ||
      cell.burning ||
      cell.damage ||
      cell.growth !== undefined
    )
      return [];
    return [index];
  });
  const target = Math.min(
    pool.length,
    Math.max(24, Math.round(pool.length * 0.045)),
  );
  if (target === 0) return 0;
  const allowed = new Set(pool);

  let state = (map.seed ^ 0x6a09e667) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const patches = Math.min(target, Math.max(2, Math.ceil(target / 10)));
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

  const chosen = [...seeds];
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
  if (chosen.length < target) {
    for (const index of pool) {
      if (chosen.length >= target) break;
      if (seen.has(index)) continue;
      seen.add(index);
      chosen.push(index);
    }
  }

  for (const index of chosen) {
    const cell = map.cells[index];
    if (!cell) continue;
    cell.tree = { health: 100 };
  }
  return chosen.length;
}
const copyCell = (cell: MapCell): MapCell => ({
  ...cell,
  tree: cell.tree ? { ...cell.tree } : undefined,
});

export class WorldEcology {
  private indices = new WeakMap<MapCell, number>();
  private repairs = new Map<
    number,
    { target: MapCell; lastDamage: number; lastRepair: number }
  >();
  private spreadAt = new Map<number, number>();

  constructor(private readonly map: MapData) {
    map.cells.forEach((cell, index) => {
      this.indices.set(cell, index);
      if (cell.tree) this.spreadAt.set(index, FOREST_SPREAD_SECONDS);
    });
  }

  damage(cell: MapCell, now: number) {
    const index = this.indices.get(cell);
    if (index === undefined) return;
    const previous = this.repairs.get(index);
    this.repairs.set(index, {
      target: previous?.target ?? copyCell(cell),
      lastDamage: now,
      lastRepair: now,
    });
    cell.recovery = 0;
  }

  clear(cell: MapCell) {
    const index = this.indices.get(cell);
    if (index !== undefined) this.repairs.delete(index);
    cell.recovery = undefined;
  }

  syncTrees(now: number) {
    this.map.cells.forEach((cell, index) => {
      if (!cell.tree || cell.burning || cell.damage || this.repairs.has(index))
        this.spreadAt.delete(index);
      else if (!this.spreadAt.has(index))
        this.spreadAt.set(index, now + FOREST_SPREAD_SECONDS);
    });
  }

  canEnter(index: number) {
    // Keep a destroyed tree's footprint free for regrowth.
    return !this.repairs.get(index)?.target.tree;
  }

  month(now: number, occupied: ReadonlySet<number>) {
    let repaired = 0;
    for (const [index, repair] of this.repairs) {
      const cell = this.map.cells[index];
      if (cell.burning) continue;
      const age = Math.max(0, now - repair.lastDamage);
      const remaining =
        RECOVERY_SECONDS - (repair.lastRepair - repair.lastDamage);
      const portion = Math.min(
        1,
        (now - repair.lastRepair) / Math.max(MONTH_SECONDS, remaining),
      );
      for (const key of FIELDS)
        cell[key] += (repair.target[key] - cell[key]) * portion;
      cell.recovery = Math.min(1, age / RECOVERY_SECONDS);
      if (cell.tree && repair.target.tree)
        cell.tree.health +=
          (repair.target.tree.health - cell.tree.health) * portion;
      repair.lastRepair = now;
      if (age + 1e-7 < RECOVERY_SECONDS) continue;
      if (repair.target.tree && occupied.has(index)) continue;
      Object.assign(cell, copyCell(repair.target), {
        damage: undefined,
        burning: false,
        recovery: undefined,
        growth: repair.target.growth,
      });
      this.repairs.delete(index);
      if (cell.tree) this.spreadAt.set(index, now + FOREST_SPREAD_SECONDS);
      repaired++;
    }

    this.syncTrees(now);
    const additions = new Set<number>();
    // Snapshot the old edge: newly planted tiles cannot spread in the same pass.
    for (const [index, due] of this.spreadAt) {
      if (now + 1e-7 < due) continue;
      // A dry tree keeps its turn. The next watered month can still spread.
      if (this.map.cells[index].moisture < FOREST_SPREAD_MOISTURE) continue;
      const x = index % this.map.width,
        y = Math.floor(index / this.map.width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.map.width || ny >= this.map.height)
          continue;
        const next = ny * this.map.width + nx,
          cell = this.map.cells[next];
        if (
          cell.tree ||
          cell.burning ||
          cell.damage ||
          cell.growth !== undefined ||
          this.repairs.has(next) ||
          occupied.has(next)
        )
          continue;
        if (cell.terrain !== "grass" && cell.terrain !== "dirt") continue;
        additions.add(next);
      }
      this.spreadAt.set(index, now + FOREST_SPREAD_SECONDS);
    }
    for (const index of additions) {
      this.map.cells[index].tree = { health: 100 };
      this.spreadAt.set(index, now + FOREST_SPREAD_SECONDS);
    }
    return { repaired, trees: additions.size };
  }
}
