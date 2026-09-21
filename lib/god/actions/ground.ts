import { effect, ring } from "../shared";
import type { GodAction } from "../types";

export const ground: GodAction = {
  id: "ground",
  label: "Ground",
  create: (point, seed, id) => effect("ground", point, seed, id, 0.8, 1.5),
  update(e, world) {
    if (e.step !== 0) return;
    const left = Math.max(0, Math.min(world.map.width - 3, e.x - 1));
    const top = Math.max(0, Math.min(world.map.height - 3, e.y - 1));
    const cells = [];
    for (let y = top; y < Math.min(world.map.height, top + 3); y++)
      for (let x = left; x < Math.min(world.map.width, left + 3); x++) {
        const cell = world.cell(x, y);
        if (cell)
          cells.push({
            cell,
            distance: Math.hypot(x - e.x, y - e.y),
            index: y * world.map.width + x,
          });
      }
    cells
      .sort((a, b) => a.distance - b.distance || a.index - b.index)
      .slice(0, 8)
      .forEach(({ cell }) => {
        world.clearRecovery(cell);
        cell.terrain = "dirt";
        cell.damage = undefined;
        cell.burning = false;
      });
  },
  draw(e, painter) {
    ring(
      painter,
      e.x + 0.5,
      e.y + 0.5,
      0.35 + e.age,
      "#a57a4c",
      1 - e.age / e.duration,
    );
  },
};
