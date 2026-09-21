import { effect, noise, random } from "../shared";
import type { GodAction } from "../types";

export const tornado: GodAction = {
  id: "tornado",
  label: "Tornado",
  threats: (e) => [
    { x: e.x, y: e.y, radius: e.radius, severity: 1, kind: "impact" },
  ],
  create: (point, seed, id) => effect("tornado", point, seed, id, 12, 4),
  update(e, world, dt) {
    // A bounded wandering path; its center never leaves the map.
    e.x = Math.max(
      0,
      Math.min(
        world.map.width - 1,
        e.x + Math.cos(e.age * 0.65 + e.id) * dt * 2.8,
      ),
    );
    e.y = Math.max(
      0,
      Math.min(
        world.map.height - 1,
        e.y + Math.sin(e.age * 0.9 + e.id) * dt * 2.2,
      ),
    );
    const strength = Math.min(1, (e.duration - e.age) / 2);
    world.area(e.x, e.y, e.radius, (cell, index, distance) => {
      world.damage(
        index,
        dt * 20 * strength * (1 - distance / (e.radius + 1)),
        "impact",
      );
      world.damageTree(cell, dt * 35 * strength);
      if (cell.terrain === "grass") {
        if (dt > 0) world.damageTerrain(cell);
        cell.fertility = Math.max(0, cell.fertility - dt * 0.025);
        cell.growth = undefined;
      }
    });
    if (e.step % 6 !== 0) return;
    for (const m of world.mosslings) {
      if ((m.health ?? 100) <= 0) continue;
      const x = m.cellIndex % world.map.width,
        y = Math.floor(m.cellIndex / world.map.width);
      if (Math.hypot(x - e.x, y - e.y) > e.radius) continue;
      const angle = Math.atan2(y - e.y, x - e.x) + 0.9;
      const radius = Math.min(
        e.radius + 1,
        Math.hypot(x - e.x, y - e.y) + random(e),
      );
      world.forceMove(
        m,
        Math.round(e.x + Math.cos(angle) * radius),
        Math.round(e.y + Math.sin(angle) * radius),
      );
    }
  },
  draw(e, p) {
    const fade = Math.min(1, e.age * 3 + 0.3, (e.duration - e.age) / 2);
    for (let i = 0; i < 160; i++) {
      const radius = (i / 160) * e.radius;
      const angle = i * 0.23 + e.age * 5;
      p.cell(
        e.x + Math.cos(angle) * radius,
        e.y + Math.sin(angle) * radius,
        i % 3 ? "#a4adb0" : "#e0e3d6",
        0.65,
        fade * (0.5 + noise(i) * 0.5),
      );
    }
    for (let i = 0; i < 10; i++) {
      const angle = e.age * 4 + i;
      p.cell(
        e.x + Math.cos(angle) * (e.radius + 1),
        e.y + Math.sin(angle) * (e.radius + 1),
        "#a78952",
        0.4,
        fade,
      );
    }
  },
};
