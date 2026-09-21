import { effect, noise, scorch } from "../shared";
import type { GodAction } from "../types";

export const lightning: GodAction = {
  id: "lightning",
  label: "Lightning",
  // The first bolt is instantaneous; survivors react to its lingering flash.
  threats: (e) => [
    { x: e.x, y: e.y, radius: e.radius, severity: 1, kind: "heat" },
  ],
  create: (point, seed, id) => effect("lightning", point, seed, id, 0.9, 2),
  update(e, world) {
    if (e.step !== 0) return;
    world.area(e.x, e.y, e.radius, (cell, index, distance) => {
      world.damage(index, 110 * (1 - distance / (e.radius + 1)), "heat");
      world.damageTree(cell, 120 * (1 - distance / (e.radius + 1)));
    });
    scorch(world, e.x, e.y, 1.5);
  },
  draw(e, p) {
    const fade = 1 - e.age / e.duration;
    // A jagged bolt travels from above the impact point into the chosen cell.
    for (let row = 0; row <= 14; row++) {
      const jitter =
        row === 14
          ? 0
          : Math.round(
              (noise(row + e.id * 11 + Math.floor(e.age * 12)) - 0.5) * 3,
            );
      p.cell(e.x + jitter, e.y - 14 + row, "#faffd3", 0.7, fade);
      p.cell(e.x + jitter - 0.4, e.y - 14 + row, "#ffd82f", 0.4, fade * 0.7);
      if (row > 5 && row < 10)
        p.cell(e.x + jitter + (row - 5), e.y - 12 + row, "#d9f5ff", 0.4, fade);
    }
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      p.cell(
        e.x + Math.cos(angle) * e.age * 5,
        e.y + Math.sin(angle) * e.age * 5,
        "#ffe963",
        0.5,
        fade,
      );
    }
  },
};
