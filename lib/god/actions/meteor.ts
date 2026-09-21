import { effect, noise, ring } from "../shared";
import type { GodAction } from "../types";

export const meteor: GodAction = {
  id: "meteor",
  label: "Meteor",
  threats: (e) =>
    e.impacted
      ? []
      : [{ x: e.x, y: e.y, radius: e.radius, severity: 1.4, kind: "impact" }],
  create: (point, seed, id) => effect("meteor", point, seed, id, 2.8, 6),
  update(e, world) {
    if (e.age < 0.7 || e.impacted) return;
    e.impacted = true;
    world.area(e.x, e.y, e.radius, (cell, index, distance) => {
      if (cell.terrain !== "water") world.damageTerrain(cell);
      world.damage(index, 220 * (1 - distance / (e.radius + 1)), "impact");
      world.damageTree(cell, 200);
      cell.burning = false;
      if (cell.terrain === "water") return;
      cell.damage = "crater";
      cell.terrain = "dirt";
      cell.growth = undefined;
      cell.fertility *= 0.1;
      cell.elevation = Math.max(
        0,
        cell.elevation - 0.18 * (1 - distance / (e.radius + 1)),
      );
    });
  },
  draw(e, p) {
    if (e.age < 0.7) {
      const progress = e.age / 0.7;
      const x = e.x - (1 - progress) * 14,
        y = e.y - (1 - progress) * 20;
      for (let i = 8; i >= 0; i--)
        p.cell(
          x - i * 0.6,
          y - i * 0.9,
          i % 2 ? "#ff651d" : "#ffc933",
          Math.max(0.4, 2 - i * 0.18),
          1 - i / 10,
        );
      p.cell(x, y, "#fff0a2", 1.8);
      return;
    }
    const age = e.age - 0.7,
      fade = 1 - age / (e.duration - 0.7);
    ring(p, e.x, e.y, age * 5, "#ffb557", fade);
    for (let i = 0; i < 40; i++) {
      const angle = i * 2.4,
        radius = age * (2 + noise(i) * 5);
      p.cell(
        e.x + Math.cos(angle) * radius,
        e.y + Math.sin(angle) * radius,
        i % 2 ? "#a58660" : "#e6742e",
        0.6,
        fade,
      );
    }
  },
};
