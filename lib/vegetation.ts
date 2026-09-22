import type { MapCell, MapData } from "./map";

/** At or below this, trees, grass, and moss look brown and fire can run farther. */
export const BROWN_MOISTURE = 0.18;
/** Shores stay green without sitting at the saturation that starts a flood. */
export const IRRIGATED_MOISTURE = 0.8;
/** Chebyshev distance: a square neighborhood, diagonals included. */
export const WATER_REACH = 4;
/** A fully watered tree reaches the brown line after ten years without rain. */
export const TREE_DROUGHT_MONTHS = 10 * 12;
/** Fully watered grass and moss reach the brown line after five years without rain. */
export const GRASS_DROUGHT_MONTHS = 5 * 12;
export const TREE_MOISTURE_LOSS = (1 - BROWN_MOISTURE) / TREE_DROUGHT_MONTHS;
export const GRASS_MOISTURE_LOSS = (1 - BROWN_MOISTURE) / GRASS_DROUGHT_MONTHS;

/** 0 is fully watered green. 1 is brown. */
export function brownBlend(moisture: number): number {
  if (moisture >= 1) return 0;
  if (moisture <= BROWN_MOISTURE) return 1;
  return (1 - moisture) / (1 - BROWN_MOISTURE);
}

export function mixHex(lush: string, dry: string, amount: number): string {
  const parse = (hex: string) => {
    const value = Number.parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  };
  const from = parse(lush);
  const to = parse(dry);
  const channel = (index: number) =>
    Math.round(from[index] + (to[index] - from[index]) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function dries(cell: MapCell): "tree" | "grass" | null {
  if (cell.burning || cell.damage || cell.growth !== undefined) return null;
  if (cell.tree) return "tree";
  if (cell.terrain === "grass") return "grass";
  return null;
}

/** Tiles within four of any water, including tiles that became water in a flood. */
function irrigated(map: MapData): Uint8Array {
  const wet = new Uint8Array(map.cells.length);
  const { width, height } = map;
  map.cells.forEach((cell, index) => {
    if (cell.terrain !== "water") return;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let dy = -WATER_REACH; dy <= WATER_REACH; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -WATER_REACH; dx <= WATER_REACH; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        wet[ny * width + nx] = 1;
      }
    }
  });
  return wet;
}

/**
 * Dry trees, grass, and moss that are not near water.
 * Crops, burning ground, and damaged ground are left alone.
 */
export function advanceVegetation(map: MapData) {
  const wet = irrigated(map);
  map.cells.forEach((cell, index) => {
    const kind = dries(cell);
    if (!kind) return;
    if (wet[index]) {
      if (cell.moisture < IRRIGATED_MOISTURE)
        cell.moisture = IRRIGATED_MOISTURE;
      return;
    }
    const loss = kind === "tree" ? TREE_MOISTURE_LOSS : GRASS_MOISTURE_LOSS;
    cell.moisture = Math.max(0, cell.moisture - loss);
  });
}
