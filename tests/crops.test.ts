import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceCrops,
  cropFoodSupply,
  CROP_MOISTURE_LOSS,
  CROP_WILT_MOISTURE,
  plantStarterFields,
} from "../lib/crops";
import { MONTH_SECONDS, SEASON_SECONDS } from "../lib/game-time";
import {
  FOREST_SPREAD_MOISTURE,
  FOREST_SPREAD_SECONDS,
  WorldEcology,
} from "../lib/god/ecology";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import { type TraitReading, traitLabels } from "../lib/mossling-traits";

function fixture(width = 12, height = 12): MapData {
  return {
    width,
    height,
    seed: 7,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      rockiness: 0.2,
      fertility: 0.5,
    })),
  };
}

function mossling(
  cellIndex: number,
  id: number,
  traits?: TraitReading[],
): PreviewMossling {
  return {
    id,
    cellIndex,
    health: 100,
    colors: ["#ffe632"],
    pattern: 0,
    traits,
    wontMate: [1, 2, 3, 4],
  };
}

function readings(metabolism: number, drive: number): TraitReading[] {
  return traitLabels.map((label) => ({
    label,
    value:
      label === "Metabolism" ? metabolism : label === "Food drive" ? drive : 40,
  }));
}

function components(map: MapData, planted: number[]): number {
  const chosen = new Set(planted);
  const seen = new Set<number>();
  let count = 0;
  for (const index of planted) {
    if (seen.has(index)) continue;
    count++;
    const queue = [index];
    seen.add(index);
    while (queue.length) {
      const current = queue.pop();
      if (current === undefined) break;
      const x = current % map.width;
      const y = Math.floor(current / map.width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const next = ny * map.width + nx;
        if (!chosen.has(next) || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return count;
}

test("starter fields plant one ripe tile per Mossling, off occupied tiles, in patches", () => {
  const map = fixture();
  const occupied = [
    0, 1, 2, 3, 20, 21, 40, 41, 80, 81, 100, 101, 130, 131, 143, 142,
  ];
  const planted = plantStarterFields(map, occupied.length, new Set(occupied));
  assert.equal(planted, occupied.length);
  const fields = map.cells.flatMap((cell, index) =>
    cell.growth === 1 ? [index] : [],
  );
  assert.equal(fields.length, occupied.length);
  for (const index of fields) {
    assert.equal(occupied.includes(index), false);
    assert.equal(map.cells[index].terrain, "grass");
    assert.equal(map.cells[index].moisture, 1);
  }
  const patches = components(map, fields);
  assert.ok(patches >= 1 && patches < fields.length);
  assert.ok(patches <= Math.ceil(fields.length / 8));
});

test("starter fields convert dirt when grass runs out", () => {
  const map = fixture(4, 4);
  for (const cell of map.cells) cell.terrain = "dirt";
  map.cells[0].terrain = "water";
  map.cells[1].terrain = "rock";
  assert.equal(plantStarterFields(map, 3, new Set()), 3);
  assert.equal(map.cells.filter((cell) => cell.growth === 1).length, 3);
  assert.equal(map.cells[0].growth, undefined);
  assert.equal(map.cells[1].terrain, "rock");
});

test("crops plants a green field and leaves an existing crop's progress", () => {
  const map = fixture(5, 5);
  for (const cell of map.cells) cell.terrain = "dirt";
  map.cells[12].growth = 0.5;
  const world = new GodWorld(map, []);
  assert.equal(world.cast("raze", 2, 2), null);
  assert.equal(world.map.cells[12].growth, 0.5);
  const planted = world.map.cells.filter((cell) => cell.growth === 0);
  assert.equal(planted.length, 7);
  assert.equal(world.map.cells[12].moisture, 0.2);
  for (const cell of planted) assert.equal(cell.moisture, 1);
  for (let i = 0; i < 40; i++) world.tick(0.05);
  assert.equal(world.map.cells.filter((cell) => cell.growth === 0).length, 7);
  assert.equal(world.map.cells[12].growth, 0.5);
});

test("a field planted with crops ripens after six wet and lit months", () => {
  const world = new GodWorld(fixture(3, 3), []);
  assert.equal(world.cast("raze", 1, 1), null);
  assert.equal(world.map.cells[4].growth, 0);
  for (let month = 1; month <= 5; month++) {
    world.map.cells[4].moisture = 1;
    world.map.cells[4].light = 1;
    world.advanceTo(month * MONTH_SECONDS);
    assert.ok((world.map.cells[4].growth ?? 0) < 1);
  }
  world.map.cells[4].moisture = 1;
  world.map.cells[4].light = 1;
  world.advanceTo(4 * SEASON_SECONDS);
  assert.equal(world.map.cells[4].growth, 1);
});

test("six wet and lit months ripen a planting, darkness stalls it, drought takes five years, and rain saves a parched field", () => {
  const dark = new GodWorld(fixture(3, 3), []);
  dark.map.cells[4].growth = 0;
  dark.map.cells[4].moisture = 1;
  dark.advanceTo(MONTH_SECONDS);
  assert.equal(dark.map.cells[4].growth, 0);

  const wet = new GodWorld(fixture(3, 3), []);
  wet.map.cells[4].growth = 0;
  wet.map.cells[4].light = 1;
  for (let month = 1; month <= 6; month++) {
    wet.map.cells[4].moisture = 1;
    wet.map.cells[4].light = 1;
    wet.advanceTo(month * MONTH_SECONDS);
  }
  wet.advanceTo(4 * SEASON_SECONDS);
  assert.equal(wet.map.cells[4].growth, 1);
  assert.equal(wet.snapshot().resources.food, 1);

  const lasting = fixture(3, 3);
  lasting.cells[4].growth = 1;
  lasting.cells[4].moisture = 1;
  for (let month = 0; month < 5 * 12 - 1; month++) advanceCrops(lasting);
  assert.equal(lasting.cells[4].growth, 1);
  advanceCrops(lasting);
  assert.equal(lasting.cells[4].growth, undefined);

  const dry = new GodWorld(fixture(3, 3), []);
  dry.map.cells[4].growth = 0.5;
  dry.map.cells[4].moisture = CROP_WILT_MOISTURE + CROP_MOISTURE_LOSS;
  dry.advanceTo(MONTH_SECONDS);
  assert.equal(dry.map.cells[4].growth, undefined);
  assert.equal(dry.snapshot().resources.food, 0);
  assert.ok(
    dry.events.some(
      (event) => event.message === "The crops withered on 1 tile.",
    ),
  );

  const saved = new GodWorld(fixture(3, 3), []);
  saved.map.cells[4].growth = 0.5;
  saved.map.cells[4].moisture = 0.1;
  saved.map.cells[4].light = 1;
  assert.equal(saved.cast("rain", 1, 1), null);
  saved.advanceTo(MONTH_SECONDS);
  assert.ok((saved.map.cells[4].growth ?? 0) > 0.5);
  assert.equal(
    saved.events.some((event) => event.message.includes("withered")),
    false,
  );
});

test("a dry patch planted with crops starts watered and stays a crop", () => {
  const map = fixture(3, 3);
  map.cells[4].terrain = "dirt";
  map.cells[4].moisture = 0.05;
  map.cells[3].tree = { health: 100 };
  map.cells[3].moisture = 1;
  const world = new GodWorld(map, []);
  assert.equal(world.cast("raze", 1, 1), null);
  assert.equal(world.map.cells[4].growth, 0);
  assert.equal(world.map.cells[4].moisture, 1);
  assert.equal(world.map.cells[4].tree, undefined);
  world.advanceTo(3 * MONTH_SECONDS);
  assert.equal(world.map.cells[4].growth, 0);
  assert.equal(world.map.cells[4].tree, undefined);
  assert.equal(
    world.events.some((event) => event.message.includes("withered")),
    false,
  );
});

test("forest does not spread onto a crop tile", () => {
  const map = fixture(3, 3);
  map.cells[4].tree = { health: 100 };
  map.cells[4].moisture = FOREST_SPREAD_MOISTURE;
  map.cells[5].growth = 0.4;
  const ecology = new WorldEcology(map);
  ecology.month(FOREST_SPREAD_SECONDS, new Set());
  assert.equal(map.cells[5].tree, undefined);
  assert.equal(map.cells[5].growth, 0.4);
  assert.ok(map.cells[1].tree);
});

test("short fields weaken heavier eaters first and do not kill above a quarter tile", () => {
  const map = fixture();
  map.cells[2].growth = 1;
  map.cells[2].moisture = 1;
  const world = new GodWorld(map, [
    mossling(0, 1, readings(100, 100)),
    mossling(11, 2, readings(0, 0)),
  ]);
  world.advanceTo(MONTH_SECONDS);
  const heavy = world.mosslings.find((m) => m.id === 1);
  const light = world.mosslings.find((m) => m.id === 2);
  assert.ok(heavy && light);
  assert.ok((heavy.health ?? 0) > 0);
  assert.ok((light.health ?? 0) > 0);
  assert.ok((heavy.health ?? 100) < (light.health ?? 100));
  assert.equal(heavy.hungry, true);
  assert.equal(world.snapshot().resources.killed, 0);
  assert.equal(world.snapshot().resources.mosslings, 2);
  assert.ok(world.snapshot().resources.health < 100);
});

test("at a quarter tile per Mossling the hungriest starves", () => {
  const map = fixture();
  map.cells[2].growth = 1;
  map.cells[2].moisture = 1;
  const world = new GodWorld(map, [
    mossling(0, 1, readings(100, 100)),
    mossling(11, 2, readings(0, 0)),
    mossling(22, 3, readings(10, 10)),
    mossling(33, 4, readings(20, 20)),
  ]);
  world.advanceTo(MONTH_SECONDS);
  const heavy = world.mosslings.find((m) => m.id === 1);
  const light = world.mosslings.find((m) => m.id === 2);
  assert.equal(heavy?.health, 0);
  assert.ok((light?.health ?? 0) > 0);
  assert.equal(world.snapshot().resources.killed, 1);
  assert.ok(
    world.events.some((event) => event.message === "1 Mossling starved."),
  );
});

test("winter holds a ripe field without feeding or withering, then spring counts it again", () => {
  const held = fixture(3, 3);
  held.cells[4].growth = 0.5;
  held.cells[4].moisture = CROP_WILT_MOISTURE + CROP_MOISTURE_LOSS;
  assert.equal(advanceCrops(held, 0), 0);
  assert.equal(held.cells[4].growth, 0.5);
  assert.equal(held.cells[4].moisture, CROP_WILT_MOISTURE + CROP_MOISTURE_LOSS);
  held.cells[4].growth = 1;
  held.cells[4].moisture = 1;
  assert.equal(cropFoodSupply(held, 0), 0);
  assert.equal(cropFoodSupply(held, 1), 1);
  assert.equal(cropFoodSupply(held, 0.5), 0.5);

  const map = fixture(3, 3);
  map.cells[4].growth = 1;
  map.cells[4].moisture = 1;
  map.cells[4].light = 1;
  const world = new GodWorld(map, []);
  world.advanceTo(SEASON_SECONDS * 2);
  assert.equal(world.map.cells[4].growth, 1);
  const moisture = world.map.cells[4].moisture;
  assert.ok(moisture > CROP_WILT_MOISTURE);
  assert.equal(world.snapshot().resources.food, 0);
  world.advanceTo(SEASON_SECONDS * 3 - 0.01);
  assert.equal(world.map.cells[4].growth, 1);
  assert.equal(world.map.cells[4].moisture, moisture);
  assert.equal(world.snapshot().resources.food, 0);
  world.advanceTo(SEASON_SECONDS * 4);
  assert.equal(world.map.cells[4].growth, 1);
  assert.equal(world.snapshot().resources.food, 1);
});

test("full health lasts a foodless winter, and a weak Mossling starves", () => {
  const fed = fixture();
  fed.cells[2].growth = 1;
  fed.cells[2].moisture = 1;
  fed.cells[2].light = 1;
  const world = new GodWorld(fed, [mossling(0, 1, readings(50, 50))]);
  world.advanceTo(SEASON_SECONDS);
  assert.equal(world.snapshot().resources.food, 1);
  assert.equal(world.mosslings[0]?.health, 100);
  world.advanceTo(SEASON_SECONDS * 2 + MONTH_SECONDS);
  assert.equal(world.snapshot().resources.food, 0);
  assert.ok((world.mosslings[0]?.health ?? 0) > 0);
  assert.ok((world.mosslings[0]?.health ?? 100) < 100);
  assert.equal(
    world.events.some((event) => event.message.includes("starved")),
    false,
  );

  const weakMap = fixture();
  weakMap.cells[2].growth = 1;
  weakMap.cells[2].moisture = 1;
  weakMap.cells[2].light = 1;
  const weak = new GodWorld(weakMap, [mossling(0, 1, readings(50, 50))]);
  weak.advanceTo(SEASON_SECONDS + MONTH_SECONDS);
  const entering = weak.mosslings[0];
  assert.ok(entering);
  entering.health = 10;
  weak.advanceTo(SEASON_SECONDS * 3);
  assert.equal(weak.snapshot().resources.mosslings, 0);
  assert.ok(weak.events.some((event) => event.message.includes("starved")));
});
