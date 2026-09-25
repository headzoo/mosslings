import { effect } from "../shared";
import type { EffectPainter, GodAction, GodEffect } from "../types";

const FLIGHT = 0.7;
const DURATION = 4;
const RADIUS = 25;

function missile(e: GodEffect, p: EffectPainter) {
  const progress = e.age / FLIGHT;
  const x = e.x - (1 - progress) * 14;
  const y = e.y - (1 - progress) * 20;
  const length = Math.hypot(14, 20);
  const ux = 14 / length;
  const uy = 20 / length;
  for (let i = 7; i >= 1; i--) {
    p.cell(
      x - ux * i * 0.62,
      y - uy * i * 0.62,
      i > 5 ? "#6d7278" : "#a8adb3",
      i > 5 ? 0.55 : 0.8,
    );
  }
  p.cell(x + ux * 0.9, y + uy * 0.9, "#ff3b30", 0.7);
  p.cell(x + ux * 0.35, y + uy * 0.35, "#e10600", 1.05);
  p.cell(x - ux * 0.15, y - uy * 0.15, "#b42318", 0.85);
}

function cloud(e: GodEffect, p: EffectPainter) {
  const age = e.age - FLIGHT;
  const fade = Math.max(0, 1 - age / (e.duration - FLIGHT));
  const rise = Math.min(1, age / 1.1);
  const stem = 1.2 + rise * 9;
  const flash = Math.max(0, 1 - age / 0.8) * fade;
  if (flash > 0) {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = 0.6 + age * 1.4;
      p.cell(
        e.x + Math.cos(angle) * radius,
        e.y + Math.sin(angle) * radius * 0.45,
        i % 2 ? "#ff7a2f" : "#ffd27a",
        0.8,
        flash,
      );
    }
  }
  for (let h = 0; h <= stem; h += 0.55) {
    const t = h / Math.max(stem, 0.01);
    const width = 0.55 + (1 - t) * 0.45;
    p.cell(e.x, e.y - h, "#c5c9ce", width, fade);
    p.cell(e.x - 0.4, e.y - h, "#8b9198", width * 0.65, fade * 0.9);
  }
  const capY = e.y - stem;
  const capRx = 1.4 + rise * 7.5;
  const capRy = 0.7 + rise * 2.2;
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    p.cell(
      e.x + Math.cos(angle) * capRx,
      capY + Math.sin(angle) * capRy - 0.3,
      i % 3 === 0 ? "#eceff1" : "#9aa1a8",
      0.9,
      fade,
    );
  }
  p.cell(e.x, capY - 0.2, "#d7dbdf", Math.max(0.8, capRx * 0.45), fade);
}

export const nuke: GodAction = {
  id: "nuke",
  label: "Nuke",
  threats: (e) =>
    e.impacted
      ? []
      : [{ x: e.x, y: e.y, radius: e.radius, severity: 1.4, kind: "impact" }],
  create: (point, seed, id) =>
    effect("nuke", point, seed, id, DURATION, RADIUS),
  update(e, world) {
    if (e.age < FLIGHT || e.impacted) return;
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
    if (e.age < FLIGHT) {
      missile(e, p);
      return;
    }
    cloud(e, p);
  },
};
