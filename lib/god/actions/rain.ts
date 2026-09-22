import {
  CLOUD_BODY,
  CLOUD_SHADE,
  CLOUD_SHADOW,
  CLOUD_SHADOW_ALPHA,
  CLOUD_SHADOW_GAP,
  CLOUD_SHADOW_ROWS,
} from "../../cloud-visual";
import { effect, noise, ring } from "../shared";
import type { GodAction } from "../types";

const PUFF_TOP = -7;
const PUFF_ROWS = 3;
const PUFF_BOTTOM = PUFF_TOP + PUFF_ROWS - 1;

export const rain: GodAction = {
  id: "rain",
  label: "Rain",
  create: (point, seed, id) => effect("rain", point, seed, id, 6, 5),
  update(e, world) {
    if (e.step !== 0) return;
    const strength = e.intensity;
    const moistureBoost = e.duration * 0.22 * strength;
    const fertilityBoost = e.duration * 0.035 * strength;
    world.area(e.x, e.y, e.radius, (cell) => {
      cell.moisture = Math.min(1, cell.moisture + moistureBoost);
      if (cell.terrain !== "water" && cell.terrain !== "rock")
        cell.fertility = Math.min(1, cell.fertility + fertilityBoost);
      if (cell.moisture > 0.72) cell.burning = false;
    });
  },
  draw(e, p) {
    const fade = Math.min(1, e.age * 3, (e.duration - e.age) * 2);
    const snow = p.season === "Winter";
    for (let row = 0; row < PUFF_ROWS; row++)
      for (let x = -4; x <= 4; x++) {
        if (row === 0 && Math.abs(x) > 2) continue;
        p.cell(
          e.x + x,
          e.y + PUFF_TOP + row,
          row === PUFF_ROWS - 1 ? CLOUD_SHADE : CLOUD_BODY,
          1,
          fade,
        );
      }
    for (let row = 1; row <= CLOUD_SHADOW_ROWS; row++)
      for (let x = -5; x <= 5; x++)
        p.cell(
          e.x + x,
          e.y + PUFF_BOTTOM + CLOUD_SHADOW_GAP + row,
          CLOUD_SHADOW,
          1,
          CLOUD_SHADOW_ALPHA * fade,
        );
    if (snow) {
      for (let i = 0; i < 18; i++) {
        const x = e.x - 4 + noise(i + e.id * 51) * 8;
        const y = e.y - 1 + ((e.age * 3.2 + noise(i + 99) * 8) % 8);
        p.cell(x, y, i % 2 ? "#f7fbff" : "#d5e6f2", 0.45, fade);
      }
      ring(p, e.x, e.y + 1, (e.age * 1.2) % 5, "#e7f2f8", 0.2 * fade);
      return;
    }
    for (let i = 0; i < 32; i++) {
      const x = e.x - 4 + noise(i + e.id * 51) * 8;
      const y = e.y - 2 + ((e.age * 9 + noise(i + 99) * 9) % 9);
      p.cell(x, y, "#56b9ff", 0.3, fade);
      p.cell(x, y + 0.4, "#2b86e6", 0.3, fade);
    }
    ring(p, e.x, e.y + 1, (e.age * 2) % 5, "#80d8ee", 0.25 * fade);
  },
};
