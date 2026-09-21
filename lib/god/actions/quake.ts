import { effect, random, ring } from "../shared";
import type { GodAction } from "../types";

export const quake: GodAction = {
  id: "quake",
  label: "Quake",
  threats: (e) => [
    {
      x: e.x,
      y: e.y,
      radius: e.radius,
      severity: 0.8,
      kind: "impact",
      alreadyHit: e.hit,
    },
  ],
  create: (point, seed, id) => effect("quake", point, seed, id, 4, 50),
  update(e, world) {
    if (e.step === 0) {
      for (let branch = 0; branch < 9; branch++) {
        let angle = (branch / 9) * Math.PI * 2;
        for (let distance = 0; distance <= e.radius; distance++) {
          angle += (random(e) - 0.5) * 0.06;
          const x = Math.round(e.x + Math.cos(angle) * distance),
            y = Math.round(e.y + Math.sin(angle) * distance);
          if (world.cell(x, y)) e.marks.set(y * world.map.width + x, distance);
        }
      }
    }
    const wave = (e.age / e.duration) * e.radius;
    for (const [index, distance] of e.marks) {
      if (distance < 0 || distance > wave) continue;
      const cell = world.map.cells[index];
      if (cell.terrain !== "water") {
        world.damageTerrain(cell);
        cell.damage = "cracked";
        cell.fertility *= 0.7;
        cell.growth = undefined;
        world.damageTree(cell, 80 * (1 - distance / (e.radius + 1)));
      }
      e.marks.set(index, -distance - 1);
    }
    for (const m of world.mosslings) {
      const distance = Math.hypot(
        (m.cellIndex % world.map.width) - e.x,
        Math.floor(m.cellIndex / world.map.width) - e.y,
      );
      if (distance > wave || e.hit.has(m.id)) continue;
      e.hit.add(m.id);
      world.damage(m.cellIndex, 80 * (1 - distance / (e.radius + 1)), "impact");
    }
  },
  draw(e, p) {
    const wave = (e.age / e.duration) * e.radius;
    ring(p, e.x, e.y, wave, "#dbc895", (1 - e.age / e.duration) * 0.7);
    for (const [index, distance] of e.marks) {
      if (distance >= 0) continue;
      p.cell(
        index % p.width,
        Math.floor(index / p.width),
        "#23221c",
        0.6,
        1 - (e.age / e.duration) * 0.5,
      );
    }
  },
};
