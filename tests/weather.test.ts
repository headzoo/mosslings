import assert from "node:assert/strict";
import test from "node:test";
import { MONTH_SECONDS, YEAR_SECONDS } from "../lib/game-time";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import {
  floodRadius,
  rollMonth,
  WILD_RAIN,
  WILD_STORM,
} from "../lib/god/weather";

function fixture(width = 16, height = 16, seed = 42): MapData {
  return {
    width,
    height,
    seed,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 1,
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

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function scripted(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

test("natural rain prefers crops and disasters stay much rarer", () => {
  const map = fixture(10, 10, 1);
  map.cells[0].growth = 0.5;
  const random = rng(7);
  let rains = 0;
  let onCrop = 0;
  let disasters = 0;
  let storms = 0;
  let pending: { x: number; y: number } | null = null;
  for (let month = 0; month < 4000; month++) {
    const roll = rollMonth(map, random, 16, pending, () => true);
    pending = roll.pendingStorm;
    if (roll.floodAt) storms++;
    for (const spawn of roll.spawns) {
      if (spawn.message === WILD_RAIN) {
        rains++;
        if (spawn.x === 0 && spawn.y === 0) onCrop++;
      } else if (spawn.kind !== "rain") disasters++;
    }
  }
  assert.ok(rains > 800);
  assert.ok(onCrop / rains > 0.65);
  assert.ok(disasters > 0);
  assert.ok(storms > 0);
  assert.ok(rains > disasters * 8);
  assert.ok(disasters > storms);
});

test("a full effect list holds a storm until a cloud can be shown", () => {
  const map = fixture(4, 4);
  const held = rollMonth(map, scripted([0, 0]), 0, null, () => true);
  assert.equal(held.spawns.length, 0);
  assert.equal(held.floodAt, undefined);
  assert.deepEqual(held.pendingStorm, { x: 0, y: 0 });
  const released = rollMonth(
    map,
    scripted([0.9, 0.9]),
    3,
    held.pendingStorm,
    () => true,
  );
  assert.equal(released.pendingStorm, null);
  assert.deepEqual(released.floodAt, { x: 0, y: 0 });
  assert.equal(
    released.spawns.filter((spawn) => spawn.message === WILD_STORM).length,
    1,
  );
  assert.equal(released.spawns.length, 3);
  assert.ok(released.spawns.every((spawn) => spawn.kind === "rain"));
});

test("a storm turns grass, rock, and trees into water", () => {
  const map = fixture(7, 7);
  map.cells[24].terrain = "grass";
  map.cells[25].terrain = "rock";
  map.cells[31].terrain = "grass";
  map.cells[31].tree = { health: 80 };
  map.cells[31].growth = 0.4;
  const flooded = floodRadius(map, { x: 3, y: 3 }, () => {});
  assert.ok(flooded >= 3);
  assert.equal(map.cells[24].terrain, "water");
  assert.equal(map.cells[25].terrain, "water");
  assert.equal(map.cells[31].terrain, "water");
  assert.equal(map.cells[31].tree, undefined);
  assert.equal(map.cells[31].growth, undefined);
});

test("one god cloud does not flood, and three overlapping clouds do", () => {
  const dry = new GodWorld(fixture(12, 12), []);
  dry.map.cells[6 * 12 + 7].terrain = "rock";
  dry.map.cells[7 * 12 + 6].tree = { health: 100 };
  dry.cast("rain", 6, 6);
  advance(dry, 6);
  assert.equal(dry.map.cells[6 * 12 + 6].terrain, "grass");
  assert.equal(dry.map.cells[6 * 12 + 7].terrain, "rock");
  assert.equal(dry.map.cells[7 * 12 + 6].tree?.health, 100);
  assert.equal(
    dry.events.some((event) => event.message.startsWith("The flood claims")),
    false,
  );

  const soaked = new GodWorld(fixture(12, 12), [mossling(6 * 12 + 6)]);
  soaked.map.cells[6 * 12 + 7].terrain = "rock";
  soaked.map.cells[7 * 12 + 6].tree = { health: 100 };
  soaked.cast("rain", 6, 6);
  soaked.cast("rain", 6, 6);
  soaked.cast("rain", 6, 6);
  advance(soaked, 6);
  assert.equal(soaked.map.cells[6 * 12 + 6].terrain, "water");
  assert.equal(soaked.map.cells[6 * 12 + 7].terrain, "water");
  assert.equal(soaked.map.cells[7 * 12 + 6].terrain, "water");
  assert.equal(soaked.map.cells[7 * 12 + 6].tree, undefined);
  assert.equal(soaked.mosslings[0]?.health, 0);
  assert.ok(
    soaked.events.some((event) => event.message === "1 Mossling drowned."),
  );
  assert.ok(
    soaked.events.some((event) => event.message.startsWith("The flood claims")),
  );
  assert.equal(soaked.map.cells[0].terrain, "grass");
});

test("a flooded tile is not restored by ecology", () => {
  const map = fixture(8, 8);
  const index = 3 * 8 + 3;
  map.cells[index].tree = { health: 100 };
  const world = new GodWorld(map, []);
  world.cast("lightning", 3, 3);
  for (const cell of world.map.cells) cell.moisture = 1;
  world.cast("rain", 3, 3);
  world.cast("rain", 3, 3);
  world.cast("rain", 3, 3);
  advance(world, 6);
  assert.equal(world.map.cells[index].terrain, "water");
  assert.equal(world.map.cells[index].tree, undefined);
  world.advanceTo(2 * YEAR_SECONDS + MONTH_SECONDS);
  assert.equal(world.map.cells[index].terrain, "water");
  assert.equal(world.map.cells[index].tree, undefined);
  assert.equal(world.map.cells[index].damage, undefined);
});

test("a natural shower does not refill a dry crop", () => {
  const map = fixture(9, 9, 3);
  const index = 4 * 9 + 4;
  map.cells[index].growth = 0.4;
  map.cells[index].moisture = 0.45;
  const world = new GodWorld(map, []);
  let saw = false;
  for (let month = 1; month <= 48 && !saw; month++) {
    world.advanceTo(month * MONTH_SECONDS);
    const rains = world.effects.filter((effect) => effect.kind === "rain");
    const shower = rains[0];
    if (
      rains.length !== 1 ||
      !shower ||
      shower.intensity >= 1 ||
      Math.hypot(shower.x - 4, shower.y - 4) > shower.radius
    )
      continue;
    const before = world.map.cells[index].moisture;
    assert.equal(shower.duration, 3);
    assert.equal(shower.intensity, 0.4);
    world.advanceTo(month * MONTH_SECONDS + shower.duration);
    const after = world.map.cells[index].moisture;
    assert.ok(after > before);
    assert.ok(after < 1);
    assert.ok(after - before < 0.5);
    assert.equal(world.map.cells[index].terrain, "grass");
    saw = true;
  }
  assert.ok(saw);
});
