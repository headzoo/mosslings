import { BROWN_MOISTURE } from "../../vegetation";
import { effect, landOnly, noise, random } from "../shared";
import type { GodAction, GodContext, GodEffect } from "../types";

const FIRE_WET_RADIUS = 6;
const FIRE_DRY_RADIUS = 10;
const FIRE_WET_CAP = 70;
const FIRE_DRY_CAP = 180;
const FIRE_WET_SPREAD_AGE = 6;
const FIRE_DRY_SPREAD_AGE = 8;

function ignite(e: GodEffect, world: GodContext, index: number) {
  const cell = world.map.cells[index];
  if (
    !cell ||
    cell.terrain === "water" ||
    cell.terrain === "rock" ||
    cell.moisture > 0.82 ||
    cell.burning ||
    cell.damage === "burned" ||
    e.marks.has(index)
  )
    return;
  world.damageTerrain(cell);
  cell.burning = true;
  e.marks.set(index, 2 + random(e) * 2);
}
function burnOut(world: GodContext, index: number) {
  const cell = world.map.cells[index];
  if (!cell) return;
  world.damageTerrain(cell);
  cell.burning = false;
  cell.damage = "burned";
  cell.terrain = "dirt";
  cell.growth = undefined;
  cell.fertility *= 0.3;
}
export const fire: GodAction = {
  id: "fire",
  label: "Fire",
  threats(e, world) {
    return [...e.marks.keys()]
      .filter((index) => world.map.cells[index].burning)
      .map((index) => ({
        x: index % world.map.width,
        y: Math.floor(index / world.map.width),
        radius: 1.5,
        severity: 1,
        kind: "heat" as const,
      }));
  },
  canPlace(world, point) {
    return (
      landOnly(world, point) ??
      ((world.cell(point.x, point.y)?.moisture ?? 1) > 0.82
        ? "This patch is too wet to burn."
        : world.cell(point.x, point.y)?.damage === "burned"
          ? "This patch has already burned."
          : null)
    );
  },
  create: (point, seed, id) =>
    effect("fire", point, seed, id, 10, FIRE_WET_RADIUS),
  update(e, world, dt) {
    if (e.step === 0) ignite(e, world, e.y * world.map.width + e.x);
    for (const [index, remaining] of [...e.marks]) {
      const cell = world.map.cells[index];
      if (!cell.burning || cell.moisture > 0.82) {
        cell.burning = false;
        e.marks.delete(index);
        continue;
      }
      world.damage(index, dt * 40, "heat");
      world.damageTree(cell, dt * 45);
      if (dt > 0) world.damageTerrain(cell);
      cell.moisture = Math.max(0, cell.moisture - dt * 0.07);
      e.marks.set(index, remaining - dt);
      if (remaining <= dt) {
        burnOut(world, index);
        e.marks.delete(index);
        continue;
      }
      if (
        e.step % 8 !== 0 ||
        e.age > FIRE_DRY_SPREAD_AGE ||
        e.marks.size >= FIRE_DRY_CAP
      )
        continue;
      const x = index % world.map.width,
        y = Math.floor(index / world.map.width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        const next = world.cell(nx, ny);
        if (!next) continue;
        const dry = next.moisture <= BROWN_MOISTURE;
        if (
          !dry &&
          (e.age > FIRE_WET_SPREAD_AGE || e.marks.size >= FIRE_WET_CAP)
        )
          continue;
        if (
          Math.hypot(nx - e.origin.x, ny - e.origin.y) <=
            (dry ? FIRE_DRY_RADIUS : e.radius) &&
          random(e) < 0.7 - next.moisture * 0.45
        )
          ignite(e, world, ny * world.map.width + nx);
      }
    }
  },
  draw(e, p) {
    for (const [index] of e.marks) {
      const width = p.width;
      if (width < 1) continue;
      const x = index % width,
        y = Math.floor(index / width);
      const flicker = noise(index + Math.floor(e.age * 12));
      p.cell(x, y, "#ed481b", 1);
      p.cell(x + 0.15, y - flicker * 0.8, "#ff9827", 0.7);
      p.cell(x + 0.3, y - flicker * 0.5, "#ffeb55", 0.35);
    }
  },
  finish(e, world) {
    for (const index of e.marks.keys())
      if (world.map.cells[index]?.burning) burnOut(world, index);
  },
};
