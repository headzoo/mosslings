import type { Season } from "./game-time";
import type { MapCell } from "./map";

/** How far a growing-season Mossling will walk to reach a carrot field. */
export const FIELD_REACH = 20;

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export interface FieldPoint {
  x: number;
  y: number;
}

/** A standing carrot row. Fallow, burning, damaged, and forested tiles are not. */
export function isCarrotTile(cell: MapCell | undefined): boolean {
  return (
    !!cell &&
    cell.growth !== undefined &&
    !cell.tree &&
    !cell.burning &&
    !cell.damage
  );
}

/** Spring and summer draw Mosslings onto the fields. Autumn and winter do not. */
export function farmingSeason(season: Season): boolean {
  return season === "Spring" || season === "Summer";
}

/** The pull pose plays on a carrot row in spring and summer. */
export function pullingCarrots(
  season: Season,
  cell: MapCell | undefined,
): boolean {
  return farmingSeason(season) && isCarrotTile(cell);
}

export function manhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Nearest carrot within reach. Equal distances prefer the northern, then western, tile. */
export function nearestCarrot(
  x: number,
  y: number,
  carrots: readonly FieldPoint[],
  reach = FIELD_REACH,
): FieldPoint | undefined {
  let best: FieldPoint | undefined;
  let bestDistance = reach + 1;
  for (const carrot of carrots) {
    const distance = manhattan(x, y, carrot.x, carrot.y);
    if (distance > reach) continue;
    if (
      !best ||
      distance < bestDistance ||
      (distance === bestDistance &&
        (carrot.y < best.y || (carrot.y === best.y && carrot.x < best.x)))
    ) {
      best = carrot;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * One step that shortens the walk to `target`.
 * Null means every closer step is blocked, so the Mossling waits beside the field.
 */
export function fieldStep(
  x: number,
  y: number,
  target: FieldPoint,
  canStep: (nx: number, ny: number) => boolean,
): readonly [number, number] | null {
  let chosen: readonly [number, number] | null = null;
  let best = manhattan(x, y, target.x, target.y);
  for (const step of STEPS) {
    const nx = x + step[0];
    const ny = y + step[1];
    if (!canStep(nx, ny)) continue;
    const distance = manhattan(nx, ny, target.x, target.y);
    if (distance < best) {
      chosen = step;
      best = distance;
    }
  }
  return chosen;
}
