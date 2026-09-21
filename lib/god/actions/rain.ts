import { effect, noise, ring } from "../shared";
import type { GodAction } from "../types";

export const rain: GodAction = {
  id: "rain",
  label: "Rain",
  create: (point, seed, id) => effect("rain", point, seed, id, 6, 5),
  update(e, world, dt) {
    const strength = e.intensity;
    world.area(e.x, e.y, e.radius, (cell) => {
      cell.moisture = Math.min(1, cell.moisture + dt * 0.22 * strength);
      if (cell.terrain !== "water" && cell.terrain !== "rock")
        cell.fertility = Math.min(1, cell.fertility + dt * 0.035 * strength);
      if (cell.moisture > 0.72) cell.burning = false;
    });
  },
  draw(e, p) {
    const fade = Math.min(1, e.age * 3, (e.duration - e.age) * 2);
    for (let row = 0; row < 3; row++)
      for (let x = -4; x <= 4; x++) {
        if (row === 0 && Math.abs(x) > 2) continue;
        p.cell(
          e.x + x,
          e.y - 7 + row,
          row === 2 ? "#889ead" : "#d2e0e4",
          1,
          fade,
        );
      }
    for (let i = 0; i < 32; i++) {
      const x = e.x - 4 + noise(i + e.id * 51) * 8;
      const y = e.y - 4 + ((e.age * 9 + noise(i + 99) * 9) % 9);
      p.cell(x, y, "#56b9ff", 0.3, fade);
      p.cell(x, y + 0.4, "#2b86e6", 0.3, fade);
    }
    ring(p, e.x, e.y + 1, (e.age * 2) % 5, "#80d8ee", 0.25 * fade);
  },
};
