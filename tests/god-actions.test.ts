import assert from "node:assert/strict";
import test from "node:test";
import { GOD_ACTIONS } from "../lib/god/actions";
import { GodWorld } from "../lib/god/engine";
import type { PowerId } from "../lib/god/types";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";

function fixture(width = 120, height = 120): MapData {
  return {
    width,
    height,
    seed: 42,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass",
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}
function mossling(index: number, id = 0): PreviewMossling {
  return {
    id,
    cellIndex: index,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
  };
}
function advance(world: GodWorld, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) world.tick(0.05);
}

test("disease can be cast on water or a Mossling and only paints finite cells", () => {
  const map = fixture(12, 12);
  map.cells[0].terrain = "water";
  const world = new GodWorld(map, [mossling(13)]);
  assert.equal(world.cast("disease", 0, 0), null);
  assert.equal(world.mosslings[0]?.plagueMonths, 0);
  const before = JSON.stringify(world.snapshot());
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  world.draw({
    width: 12,
    height: 12,
    cell(x, y, color, size = 1, alpha = 1) {
      assert.ok(Number.isFinite(x + y + size + alpha));
      assert.ok(color);
      if (color !== "#c8c8c8" && color !== "#2a2a2a") return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + size);
    },
  });
  assert.equal(JSON.stringify(world.snapshot()), before);
  assert.ok(Math.abs(maxX - minX - 12) < 1e-9);
  assert.ok(Math.abs(maxY - minY - 12) < 1e-9);
});
test("rain changes a bounded area and extinguishes a live fire without damaging Mosslings", () => {
  const world = new GodWorld(fixture(30, 30), [mossling(15 * 30 + 15)]);
  world.cast("fire", 15, 15);
  world.cast("rain", 15, 15);
  advance(world, 4);
  assert.equal(world.map.cells[465].burning, false);
  assert.ok(world.map.cells[465].moisture > 0.72);
  assert.equal(world.map.cells[0].moisture, 0.2);
  const health = world.mosslings[0]?.health ?? 0;
  advance(world, 1);
  assert.equal(world.mosslings[0]?.health ?? 0, health);
});
test("grow restores burned dirt only in its local area", () => {
  const map = fixture(30, 30);
  map.cells[465].terrain = "dirt";
  map.cells[465].damage = "burned";
  const world = new GodWorld(map, []);
  world.cast("grow", 15, 15);
  advance(world, 4);
  assert.equal(world.map.cells[465].terrain, "grass");
  assert.equal(world.map.cells[465].damage, undefined);
  assert.ok(world.map.cells[465].fertility > 0.4);
  assert.equal(world.map.cells[0].fertility, 0.4);
});
test("grow fills up to eight connected ground tiles without crossing forest, water, or stone", () => {
  const map = fixture(5, 5);
  for (const cell of map.cells) cell.terrain = "dirt";
  map.cells[11].tree = { health: 100 };
  map.cells[13].terrain = "water";
  map.cells[17].terrain = "rock";
  const world = new GodWorld(map, []);
  assert.match(world.cast("grow", 1, 2) ?? "", /forest/);
  assert.match(world.cast("grow", 3, 2) ?? "", /water/);
  assert.match(world.cast("grow", 2, 3) ?? "", /stone/);
  assert.equal(world.cast("grow", 2, 2), null);
  assert.equal(
    world.map.cells.filter((cell) => cell.terrain === "grass").length,
    8,
  );
  assert.ok(world.map.cells[11].tree);
  assert.equal(world.map.cells[13].terrain, "water");
  assert.equal(world.map.cells[17].terrain, "rock");
});
test("ground changes a compact eight-tile patch to dirt", () => {
  const map = fixture(5, 5);
  for (const cell of map.cells) cell.terrain = "water";
  const world = new GodWorld(map, []);
  world.cast("ground", 2, 2);
  const ground = world.map.cells.flatMap((cell, index) =>
    cell.terrain === "dirt" ? [index] : [],
  );
  assert.equal(ground.length, 8);
  assert.ok(ground.includes(12));
  assert.ok(
    ground.every(
      (index) =>
        [1, 2, 3].includes(index % 5) &&
        [1, 2, 3].includes(Math.floor(index / 5)),
    ),
  );
  assert.equal(world.map.cells[12].moisture, 0.2);
  assert.equal(world.map.cells[12].fertility, 0.4);
});
test("raze clears up to eight connected forest tiles to dirt", () => {
  const map = fixture(5, 5);
  for (let index = 0; index < 10; index++)
    map.cells[index].tree = { health: 100 };
  const world = new GodWorld(map, []);
  assert.match(world.cast("raze", 0, 2) ?? "", /forest/);
  assert.equal(world.cast("raze", 0, 0), null);
  assert.equal(world.map.cells.filter((cell) => cell.tree).length, 2);
  assert.equal(
    world.map.cells.filter((cell) => cell.terrain === "dirt").length,
    8,
  );
});
test("lightning applies real health and tree damage once, leaving a scorch", () => {
  const map = fixture(30, 30);
  map.cells[465].tree = { health: 100 };
  const source = mossling(465);
  const world = new GodWorld(map, [source, mossling(0, 1)]);
  world.cast("lightning", 15, 15);
  const health = world.mosslings.find((m) => m.id === 0)?.health ?? 0;
  assert.ok(health < 100);
  assert.equal(world.mosslings.find((m) => m.id === 1)?.health, 100);
  assert.equal(world.map.cells[465].tree, undefined);
  assert.equal(world.map.cells[465].damage, "burned");
  advance(world, 2);
  assert.equal(world.mosslings.find((m) => m.id === 0)?.health ?? 0, health);
  assert.equal(source.health, 100);
  assert.ok(map.cells[465].tree);
});
test("fire spreads locally, respects water, expires and clears all burning flags", () => {
  const map = fixture(30, 30);
  map.cells[466].terrain = "water";
  const world = new GodWorld(map, [mossling(465)]);
  world.cast("fire", 15, 15);
  advance(world, 12);
  const burned = world.map.cells.flatMap((c, i) =>
    c.damage === "burned" ? [i] : [],
  );
  assert.ok(burned.length > 1);
  for (const i of burned)
    assert.ok(Math.hypot((i % 30) - 15, Math.floor(i / 30) - 15) <= 6);
  assert.equal(world.map.cells[466].terrain, "water");
  assert.equal(
    world.map.cells.some((c) => c.burning),
    false,
  );
  assert.equal(world.effects.length, 0);
  assert.ok((world.mosslings[0]?.health ?? 0) < 100);
});
test("tornado wanders, damages occupants, moves them without overlaps, and expires", () => {
  const world = new GodWorld(fixture(30, 30), [
    mossling(465),
    mossling(466, 1),
    mossling(435, 2),
  ]);
  world.cast("tornado", 15, 15);
  advance(world, 1);
  assert.ok(world.effects[0].x !== 15 || world.effects[0].y !== 15);
  assert.ok(world.mosslings.some((m) => (m.health ?? 100) < 100));
  assert.ok(
    world.mosslings.some((m) => ![465, 466, 435].includes(m.cellIndex)),
  );
  assert.equal(
    new Set(world.mosslings.map((m) => m.cellIndex)).size,
    world.mosslings.length,
  );
  advance(world, 13);
  assert.equal(world.effects.length, 0);
});
test("quake remains inside fifty tiles of its target", () => {
  const world = new GodWorld(fixture(), [
    mossling(60 * 120 + 60),
    mossling(0, 1),
  ]);
  world.cast("quake", 60, 60);
  advance(world, 5);
  const cracks = world.map.cells.flatMap((c, i) =>
    c.damage === "cracked" ? [i] : [],
  );
  assert.ok(cracks.length > 50);
  for (const i of cracks) {
    assert.ok(Math.abs((i % 120) - 60) <= 50);
    assert.ok(Math.abs(Math.floor(i / 120) - 60) <= 50);
  }
  assert.equal(world.mosslings.find((m) => m.id === 1)?.health, 100);
});
test("meteor impact removes dead organisms and leaves a bounded crater", () => {
  const world = new GodWorld(fixture(30, 30), [mossling(465), mossling(0, 1)]);
  world.cast("meteor", 15, 15);
  advance(world, 0.5);
  assert.equal(world.mosslings.length, 2);
  advance(world, 3);
  assert.equal(world.mosslings.find((m) => m.id === 0)?.health, 0);
  assert.deepEqual(
    world.mosslings.filter((m) => (m.health ?? 0) > 0).map((m) => m.id),
    [1],
  );
  world.advanceTo(4);
  assert.deepEqual(
    world.mosslings.map((m) => m.id),
    [1],
  );
  assert.equal(world.map.cells[465].damage, "crater");
  assert.equal(world.map.cells[0].damage, undefined);
});
test("every action is bounded on tiny maps and at all corners", () => {
  for (const power of Object.keys(GOD_ACTIONS) as PowerId[])
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const world = new GodWorld(fixture(2, 2), []);
      world.cast(power, x, y);
      advance(world, 15);
      assert.equal(world.map.cells.length, 4);
      assert.equal(world.effects.length, 0);
      for (const cell of world.map.cells) {
        assert.ok(cell.moisture >= 0 && cell.moisture <= 1);
        assert.ok(cell.fertility >= 0 && cell.fertility <= 1);
      }
    }
});
test("effects are deterministic, rendering is read-only, and concurrency is capped", () => {
  const a = new GodWorld(fixture(20, 20), []),
    b = new GodWorld(fixture(20, 20), []);
  a.cast("fire", 10, 10);
  b.cast("fire", 10, 10);
  advance(a, 2);
  advance(b, 2);
  const before = JSON.stringify(a.snapshot());
  a.draw({
    width: 20,
    height: 20,
    cell(x, y, color, size = 1, alpha = 1) {
      assert.ok(Number.isFinite(x + y + size + alpha));
      assert.ok(color);
    },
  });
  assert.equal(JSON.stringify(a.snapshot()), before);
  assert.deepEqual(a.snapshot(), b.snapshot());
  for (let i = 0; i < 20; i++) a.cast("rain", 10, 10);
  assert.equal(a.effects.length, 16);
  assert.ok(a.cast("meteor", 10, 10));
});
