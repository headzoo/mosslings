import { connectedCellIndices, effect, ring } from "../shared";
import type { GodAction } from "../types";

export const raze: GodAction = {
  id: "raze",
  label: "Raze",
  canPlace(world, point) {
    return world.cell(point.x, point.y)?.tree
      ? null
      : "Choose a forest tile to raze.";
  },
  create: (point, seed, id) => effect("raze", point, seed, id, 0.8, 2),
  update(e, world) {
    if (e.step !== 0) return;
    for (const index of connectedCellIndices(
      world,
      e,
      8,
      (cell) => !!cell.tree,
    )) {
      const cell = world.map.cells[index];
      world.damageTerrain(cell);
      cell.tree = undefined;
      cell.terrain = "dirt";
      cell.growth = undefined;
      cell.damage = undefined;
      cell.burning = false;
    }
  },
  draw(e, painter) {
    ring(
      painter,
      e.x + 0.5,
      e.y + 0.5,
      0.4 + e.age * 1.5,
      "#d19a5d",
      1 - e.age / e.duration,
    );
  },
};
