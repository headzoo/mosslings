import { type FieldPoint, farmingSeason, manhattan } from "./field-work";
import type { Season } from "./game-time";
import { type TraitReading, traitValue } from "./mossling-traits";

/** Water tolerance at or above this sends a Mossling to the shore. */
export const SHORE_TOLERANCE = 25;

const EXITS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** True when this Mossling is built to live in the water. */
export function shoreMigrant(
  traits: readonly TraitReading[] | undefined,
): boolean {
  return traitValue(traits, "Water tolerance") >= SHORE_TOLERANCE;
}

/** Spring and summer are the months they actually swim. */
export function swims(
  traits: readonly TraitReading[] | undefined,
  season: Season,
): boolean {
  return shoreMigrant(traits) && farmingSeason(season);
}

/** Nearest open water. Equal distances prefer the northern, then western, tile. */
export function nearestShore(
  x: number,
  y: number,
  shores: readonly FieldPoint[],
): FieldPoint | undefined {
  let best: FieldPoint | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const shore of shores) {
    const distance = manhattan(x, y, shore.x, shore.y);
    if (
      !best ||
      distance < bestDistance ||
      (distance === bestDistance &&
        (shore.y < best.y || (shore.y === best.y && shore.x < best.x)))
    ) {
      best = shore;
      bestDistance = distance;
    }
  }
  return best;
}

/** First open land step off a water tile. Null means the shore is walled in. */
export function landExit(
  x: number,
  y: number,
  canStep: (nx: number, ny: number) => boolean,
): readonly [number, number] | null {
  for (const step of EXITS) {
    if (canStep(x + step[0], y + step[1])) return step;
  }
  return null;
}
