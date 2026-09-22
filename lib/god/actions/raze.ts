import { rollCropBlight } from "../../crops";
import type { MapCell } from "../../map";
import { connectedCellIndices, effect, ring } from "../shared";
import type { GodAction, GodContext } from "../types";

function sow(world: GodContext, cell: MapCell, index: number) {
  world.clearRecovery(cell);
  cell.tree = undefined;
  cell.terrain = "grass";
  cell.damage = undefined;
  cell.burning = false;
  // A new field starts fully watered, so it can ripen instead of
  // withering straight back into grass for the forest to reclaim.
  if (cell.growth === undefined) {
    cell.growth = 0;
    cell.moisture = 1;
    rollCropBlight(cell, world.map.seed, index);
    return true;
  }
  return false;
}

export const raze: GodAction = {
  id: "raze",
  label: "Carrots",
  canPlace(world, point) {
    const cell = world.cell(point.x, point.y);
    if (cell?.tree) return null;
    if (cell?.burning) return "Put out the fire before planting carrots here.";
    if (cell?.terrain === "water")
      return "Carrots need ground or forest, not water.";
    if (cell?.terrain === "rock")
      return "Carrots need ground or forest, not stone.";
    if (cell && (cell.terrain === "grass" || cell.terrain === "dirt"))
      return null;
    return "Choose a forest or ground tile for carrots.";
  },
  create: (point, seed, id) => effect("raze", point, seed, id, 0.8, 2),
  update(e, world) {
    if (e.step !== 0) return;
    const forest = !!world.cell(e.x, e.y)?.tree;
    for (const index of connectedCellIndices(
      world,
      e,
      forest ? world.map.width * world.map.height : 8,
      (cell) =>
        forest
          ? !!cell.tree
          : (cell.terrain === "grass" || cell.terrain === "dirt") &&
            !cell.tree &&
            !cell.burning,
    )) {
      if (sow(world, world.map.cells[index], index)) e.hit.add(index);
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
