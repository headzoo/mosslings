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
test("sun lights its disk, cures the living, and leaves the dead", () => {
  const map = fixture(30, 30);
  const hurt = mossling(15 * 30 + 15);
  hurt.health = 40;
  hurt.plagueMonths = 2;
  const nearly = mossling(15 * 30 + 16, 1);
  nearly.health = 90;
  nearly.plagueMonths = 1;
  const dead = mossling(15 * 30 + 17, 2);
  dead.health = 0;
  dead.plagueMonths = 4;
  const far = mossling(0, 3);
  far.health = 40;
  far.plagueMonths = 1;
  const world = new GodWorld(map, [hurt, nearly, dead, far]);
  assert.equal(world.cast("sun", 15, 15), null);
  const at = (id: number) => world.mosslings.find((m) => m.id === id);
  assert.equal(at(0)?.health, 70);
  assert.equal(at(0)?.plagueMonths, undefined);
  assert.equal(at(1)?.health, 100);
  assert.equal(at(1)?.plagueMonths, undefined);
  assert.equal(at(2)?.health, 0);
  assert.equal(at(2)?.plagueMonths, 4);
  assert.equal(at(3)?.health, 40);
  assert.equal(at(3)?.plagueMonths, 1);
  advance(world, 4);
  assert.equal(world.map.cells[15 * 30 + 15].light, 1);
  assert.ok((world.map.cells[15 * 30 + 20].light ?? 0) > 0.9);
  assert.equal(world.map.cells[15 * 30 + 21].light, undefined);
  assert.equal(world.map.cells[0].light, undefined);
  assert.equal(at(0)?.health, 70);
});
test("crops marks only freshly planted tiles in effect.hit", () => {
  const map = fixture(5, 5);
  const world = new GodWorld(map, []);
  assert.equal(world.cast("raze", 2, 2), null);
  const effect = world.effects.find((entry) => entry.kind === "raze");
  assert.ok(effect);
  assert.equal(effect.hit.size, 8);
  assert.ok(effect.hit.has(2 * 5 + 2));
  map.cells[2 * 5 + 2].growth = 0.5;
  assert.equal(world.cast("raze", 2, 2, { quiet: true }), null);
  const replay = world.effects.filter((entry) => entry.kind === "raze").at(-1);
  assert.ok(replay);
  assert.equal(replay.hit.size, 0);
  assert.equal(
    world.events.some((event) => event.tag === "player-crop-planted"),
    true,
  );
});

test("crops restores burned dirt only in its local area", () => {
  const map = fixture(30, 30);
  map.cells[465].terrain = "dirt";
  map.cells[465].damage = "burned";
  const world = new GodWorld(map, []);
  world.cast("raze", 15, 15);
  assert.equal(world.map.cells[465].terrain, "grass");
  assert.equal(world.map.cells[465].damage, undefined);
  assert.equal(world.map.cells[465].growth, 0);
  assert.equal(world.map.cells[0].growth, undefined);
});
test("crops fills up to eight connected grass tiles without crossing forest, water, or stone", () => {
  const map = fixture(5, 5);
  map.cells[11].tree = { health: 100 };
  map.cells[13].terrain = "water";
  map.cells[17].terrain = "rock";
  const world = new GodWorld(map, []);
  assert.match(world.cast("raze", 3, 2) ?? "", /water/);
  assert.match(world.cast("raze", 2, 3) ?? "", /stone/);
  assert.equal(world.cast("raze", 2, 2), null);
  assert.equal(world.map.cells.filter((cell) => cell.growth === 0).length, 8);
  assert.ok(world.map.cells[11].tree);
  assert.equal(world.map.cells[13].terrain, "water");
  assert.equal(world.map.cells[17].terrain, "rock");
});
test("crops turns a connected stand of trees into crop land", () => {
  const map = fixture(5, 5);
  for (let index = 0; index < 10; index++)
    map.cells[index].tree = { health: 100 };
  map.cells[24].tree = { health: 100 };
  const world = new GodWorld(map, []);
  assert.equal(world.cast("raze", 0, 0), null);
  assert.equal(world.map.cells.filter((cell) => cell.tree).length, 1);
  assert.equal(world.map.cells[24].tree?.health, 100);
  assert.equal(world.map.cells.filter((cell) => cell.growth === 0).length, 10);
  assert.equal(world.map.cells[0].terrain, "grass");
  assert.equal(world.map.cells[0].tree, undefined);
  world.advanceTo(112);
  assert.equal(world.map.cells[0].tree, undefined);
});
test("crops turns up to eight connected dirt tiles into crop land", () => {
  const map = fixture(5, 5);
  for (const cell of map.cells) cell.terrain = "dirt";
  map.cells[11].tree = { health: 100 };
  map.cells[13].terrain = "water";
  map.cells[17].terrain = "rock";
  map.cells[12].growth = 0.5;
  const world = new GodWorld(map, []);
  assert.match(world.cast("raze", 3, 2) ?? "", /water/);
  assert.match(world.cast("raze", 2, 3) ?? "", /stone/);
  assert.equal(world.cast("raze", 2, 2), null);
  assert.equal(world.map.cells[12].growth, 0.5);
  assert.equal(world.map.cells[12].terrain, "grass");
  assert.equal(world.map.cells.filter((cell) => cell.growth === 0).length, 7);
  assert.ok(world.map.cells[11].tree);
  assert.equal(world.map.cells[13].terrain, "water");
  assert.equal(world.map.cells[17].terrain, "rock");
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
  for (const cell of map.cells) cell.moisture = 0.5;
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
test("brown grass and moss carry fire farther than wet ground", () => {
  const map = fixture(30, 30);
  for (const cell of map.cells) cell.moisture = 0;
  map.cells[466].terrain = "water";
  const world = new GodWorld(map, []);
  world.cast("fire", 15, 15);
  advance(world, 12);
  const burned = world.map.cells.flatMap((c, i) =>
    c.damage === "burned" ? [i] : [],
  );
  assert.ok(
    burned.some((i) => Math.hypot((i % 30) - 15, Math.floor(i / 30) - 15) > 6),
  );
  for (const i of burned)
    assert.ok(Math.hypot((i % 30) - 15, Math.floor(i / 30) - 15) <= 10);
  assert.equal(world.map.cells[466].terrain, "water");
  assert.equal(
    world.map.cells.some((c) => c.burning),
    false,
  );
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
test("a quiet plow stroke skips the log and recycles a finished flash", () => {
  const world = new GodWorld(fixture(20, 20), []);
  for (let i = 0; i < 16; i++) assert.equal(world.cast("raze", 0, 0), null);
  assert.equal(world.effects.length, 16);
  const before = world.events.length;
  assert.equal(world.map.cells[19 * 20 + 19].growth, undefined);
  assert.equal(world.cast("raze", 19, 19, { quiet: true }), null);
  assert.equal(world.effects.length, 16);
  assert.equal(world.events.length, before);
  assert.equal(world.map.cells[19 * 20 + 19].growth, 0);
});
test("a quiet rejection is not written to the event log", () => {
  const map = fixture(4, 4);
  map.cells[0].terrain = "water";
  const world = new GodWorld(map, []);
  const before = world.events.length;
  assert.equal(
    world.cast("raze", 0, 0, { quiet: true }),
    "Carrots need ground or forest, not water.",
  );
  assert.equal(world.events.length, before);
});
test("winter clouds drop snow and warmer clouds drop rain", () => {
  const winter = new GodWorld(fixture(12, 12), []);
  winter.advanceTo(28);
  assert.equal(winter.cast("rain", 4, 4), null);
  const snow = new Set<string>();
  winter.draw({
    width: 12,
    height: 12,
    cell(_x, _y, color) {
      snow.add(color);
    },
  });
  assert.ok(snow.has("#f7fbff"));
  assert.equal(snow.has("#56b9ff"), false);

  const summer = new GodWorld(fixture(12, 12), []);
  summer.advanceTo(8);
  assert.equal(summer.cast("rain", 4, 4), null);
  const rain = new Set<string>();
  summer.draw({
    width: 12,
    height: 12,
    cell(_x, _y, color) {
      rain.add(color);
    },
  });
  assert.ok(rain.has("#56b9ff"));
  assert.equal(rain.has("#f7fbff"), false);
});
test("rain still stops when sixteen powers are already active", () => {
  const world = new GodWorld(fixture(20, 20), []);
  for (let i = 0; i < 16; i++) world.cast("rain", i, 0);
  assert.equal(
    world.cast("rain", 0, 1, { quiet: true }),
    "Let a few active powers finish first.",
  );
  assert.equal(world.effects.length, 16);
});
test("a quiet disease cast still records who caught it", () => {
  const world = new GodWorld(fixture(12, 12), [mossling(0)]);
  assert.equal(world.cast("disease", 0, 0, { quiet: true }), null);
  assert.equal(world.events[0]?.message, "1 Mossling caught the black death.");
  assert.ok(
    world.events.every((event) => !event.message.startsWith("Disease at tile")),
  );
});
