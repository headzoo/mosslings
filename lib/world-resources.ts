import { ripeTiles } from "./crops";
import type { Season } from "./game-time";
import type { MapData } from "./map";
import type { PreviewMossling } from "./map-preview";

export interface WorldResources {
  mosslings: number;
  killed: number;
  food: number;
  trees: number;
  stone: number;
  water: number;
  /** Average health of living Mosslings, 0–100. */
  health: number;
}

export function countWorldResources(
  map: MapData,
  mosslings: PreviewMossling[],
  killed = 0,
  season: Season = "Summer",
): WorldResources {
  const living = mosslings.filter((m) => (m.health ?? 100) > 0);
  const totals = {
    mosslings: living.length,
    killed,
    food: ripeTiles(map, season),
    trees: 0,
    stone: 0,
    water: 0,
    health: living.length
      ? Math.round(
          living.reduce((sum, m) => sum + (m.health ?? 100), 0) / living.length,
        )
      : 0,
  };
  for (const cell of map.cells) {
    if (cell.terrain === "water") totals.water++;
    if (cell.burning) continue;
    if (cell.tree) totals.trees++;
    if (cell.damage) continue;
    if (cell.terrain === "rock") totals.stone++;
  }
  return totals;
}
