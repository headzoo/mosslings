import { cropFoodSupply } from "./crops";
import type { MapData } from "./map";
import type { PreviewMossling } from "./map-preview";

export interface WorldResources {
  /** Mosslings born during play. */
  born: number;
  mosslings: number;
  killed: number;
  food: number;
  trees: number;
  /** Tiles damaged by disasters that have not fully recovered. */
  destroyed: number;
  /** Average health of living Mosslings, 0–100. */
  health: number;
}

export function countWorldResources(
  map: MapData,
  mosslings: PreviewMossling[],
  killed = 0,
  born = 0,
  cropCover = 1,
): WorldResources {
  const living = mosslings.filter((m) => (m.health ?? 100) > 0);
  const totals = {
    born,
    mosslings: living.length,
    killed,
    food: Math.round(cropFoodSupply(map, cropCover)),
    trees: 0,
    destroyed: 0,
    health: living.length
      ? Math.round(
          living.reduce((sum, m) => sum + (m.health ?? 100), 0) / living.length,
        )
      : 0,
  };
  for (const cell of map.cells) {
    if (cell.damage || cell.burning) totals.destroyed++;
    if (cell.burning) continue;
    if (cell.tree) totals.trees++;
  }
  return totals;
}
