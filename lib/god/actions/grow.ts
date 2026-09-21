import { connectedCellIndices, effect, ring } from "../shared";
import type { GodAction } from "../types";

export const grow: GodAction = {
  id: "grow",
  label: "Grow",
  canPlace(world, point) {
    const cell = world.cell(point.x, point.y);
    if (!cell || cell.terrain === "water")
      return "Grow needs solid ground, not water.";
    if (cell.terrain === "rock") return "Grow needs solid ground, not stone.";
    if (cell.tree) return "Raze the forest before using Grow here.";
    if (cell.burning) return "Put out the fire before using Grow here.";
    return null;
  },
  create: (point, seed, id) => effect("grow", point, seed, id, 3, 4),
  update(e, world, dt) {
    if (e.step === 0)
      for (const index of connectedCellIndices(
        world,
        e,
        8,
        (cell) =>
          cell.terrain !== "water" &&
          cell.terrain !== "rock" &&
          !cell.tree &&
          !cell.burning,
      ))
        e.marks.set(index, 1);
    for (const index of e.marks.keys()) {
      const cell = world.map.cells[index];
      world.clearRecovery(cell);
      cell.terrain = "grass";
      cell.damage = undefined;
      if (cell.growth === undefined) cell.growth = 0;
      cell.fertility = Math.min(1, cell.fertility + dt * 0.25);
      cell.moisture = Math.min(1, cell.moisture + dt * 0.06);
    }
  },
  draw(e, p) {
    ring(
      p,
      e.x,
      e.y,
      Math.min(e.radius, e.age * 2),
      "#bcf267",
      1 - e.age / e.duration,
    );
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.4;
      const radius = 1 + (i % 4);
      p.cell(
        e.x + Math.cos(angle) * radius,
        e.y + Math.sin(angle) * radius - (e.age % 1),
        "#cef77b",
        0.4,
        1 - e.age / e.duration,
      );
    }
  },
};
