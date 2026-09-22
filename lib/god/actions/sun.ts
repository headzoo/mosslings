import { effect, ring } from "../shared";
import type { GodAction } from "../types";

/** Health restored to each living Mossling in the beam. */
export const SUN_HEAL = 30;

export const sun: GodAction = {
  id: "sun",
  label: "Sun",
  create: (point, seed, id) => effect("sun", point, seed, id, 4, 5),
  update(e, world) {
    if (e.step !== 0) return;
    const lightBoost = e.duration * 0.28;
    world.area(e.x, e.y, e.radius, (cell) => {
      cell.light = Math.min(1, (cell.light ?? 0) + lightBoost);
    });
    const width = world.map.width;
    for (const mossling of world.mosslings) {
      if ((mossling.health ?? 100) <= 0) continue;
      const x = mossling.cellIndex % width;
      const y = Math.floor(mossling.cellIndex / width);
      if (Math.hypot(x - e.x, y - e.y) > e.radius) continue;
      mossling.plagueMonths = undefined;
      mossling.health = Math.min(100, (mossling.health ?? 100) + SUN_HEAL);
    }
  },
  draw(e, painter) {
    const fade = Math.min(1, e.age * 3, (e.duration - e.age) * 2);
    ring(painter, e.x + 0.5, e.y + 0.5, 0.8 + e.age * 1.1, "#ffe128", fade);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + e.age * 0.4;
      const reach = 1.4 + (i % 2) * 0.6;
      painter.cell(
        e.x + 0.5 + Math.cos(angle) * reach,
        e.y + 0.5 + Math.sin(angle) * reach,
        "#ffe128",
        0.45,
        fade,
      );
    }
    painter.cell(e.x + 0.5, e.y + 0.5, "#fff4b0", 1.1, fade);
  },
};
