import assert from "node:assert/strict";
import test from "node:test";
import { provisionCrops } from "../lib/crops";
import { MONTH_SECONDS, YEAR_SECONDS } from "../lib/game-time";
import {
  FOREST_SPREAD_MOISTURE,
  FOREST_SPREAD_SECONDS,
  plantStarterForests,
  WorldEcology,
} from "../lib/god/ecology";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import { sampleFromResources } from "../lib/resource-history";
import { countWorldResources } from "../lib/world-resources";

function fixture(width = 15, height = 15): MapData {
  return {
    width,
    height,
    seed: 91,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass",
      elevation: 0.6,
      moisture: 0.2,
      rockiness: 0.4,
      fertility: 0.5,
    })),
  };
}
function mossling(
  cellIndex: number,
  id = 1,
  wontMate?: number[],
): PreviewMossling {
  return {
    id,
    cellIndex,
    health: 100,
    colors: ["#ffff00"],
    pattern: 0,
    wontMate,
  };
}

test("Mosslings move once per game month, remain still while paused, and never overlap", () => {
  const world = new GodWorld(fixture(), [
    mossling(112, 1, [2]),
    mossling(113, 2, [1]),
  ]);
  provisionCrops(world.map, 2, 130);
  world.advanceTo(MONTH_SECONDS - 0.001);
  assert.deepEqual(
    world.mosslings.map((m) => m.cellIndex),
    [112, 113],
  );
  world.advanceTo(MONTH_SECONDS);
  for (const [i, original] of [112, 113].entries()) {
    const current = world.mosslings[i].cellIndex;
    assert.equal(
      Math.abs((current % 15) - (original % 15)) +
        Math.abs(Math.floor(current / 15) - Math.floor(original / 15)),
      1,
    );
  }
  const paused = world.snapshot();
  for (let i = 0; i < 50; i++)
    assert.equal(world.advanceTo(MONTH_SECONDS), false);
  assert.deepEqual(world.snapshot(), paused);
  world.advanceTo(10 * YEAR_SECONDS);
  const living = world.mosslings.filter((m) => (m.health ?? 0) > 0);
  assert.equal(new Set(living.map((m) => m.cellIndex)).size, living.length);
});

test("starter forests plant tree patches on open grass away from Mosslings", () => {
  const map = fixture(20, 20);
  const occupied = new Set([40, 41, 42, 60, 61]);
  const planted = plantStarterForests(map, occupied);
  assert.ok(planted >= 24);
  const trees = map.cells.flatMap((cell, index) => (cell.tree ? [index] : []));
  assert.equal(trees.length, planted);
  assert.equal(countWorldResources(map, []).trees, planted);
  for (const index of trees) {
    assert.equal(occupied.has(index), false);
    assert.equal(map.cells[index].growth, undefined);
  }
});

test("blocked Mosslings wait; movement cannot enter water, rock, trees, or fire", () => {
  const map = fixture(3, 3);
  map.cells[1].terrain = "water";
  map.cells[3].terrain = "rock";
  map.cells[5].tree = { health: 100 };
  map.cells[7].burning = true;
  const world = new GodWorld(map, [mossling(4)]);
  provisionCrops(world.map, 1, 4);
  world.advanceTo(8);
  assert.equal(world.mosslings[0].cellIndex, 4);
});

test("skipped months produce the same wandering as individual months", () => {
  const a = new GodWorld(fixture(), [mossling(112)]);
  const b = new GodWorld(fixture(), [mossling(112)]);
  a.advanceTo(YEAR_SECONDS);
  for (let t = MONTH_SECONDS; t <= YEAR_SECONDS; t += MONTH_SECONDS)
    b.advanceTo(t);
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test("catastrophe repairs restore original forest and terrain after two years, never Mosslings", () => {
  const map = fixture();
  map.cells[111].tree = { health: 100 };
  map.cells[113].terrain = "rock";
  const world = new GodWorld(map, [mossling(112)]);
  const before = world.snapshot().resources;
  world.cast("meteor", 7, 7);
  world.advanceTo(3);
  assert.equal(world.mosslings.length, 1);
  assert.equal(world.mosslings[0]?.health, 0);
  assert.equal(world.snapshot().resources.mosslings, 0);
  assert.equal(world.map.cells[111].tree, undefined);
  assert.equal(world.map.cells[113].terrain, "dirt");
  assert.ok(world.snapshot().resources.destroyed > 0);
  world.advanceTo(48);
  assert.ok((world.map.cells[111].recovery ?? 0) > 0.4);
  assert.equal(world.map.cells[111].tree, undefined);
  world.advanceTo(100); // First month boundary two years after the impact.
  assert.equal(world.snapshot().map.cells[111].tree?.health, 100);
  assert.equal(world.map.cells[113].terrain, "rock");
  assert.equal(world.map.cells[113].damage, undefined);
  assert.equal(world.map.cells[113].elevation, map.cells[113].elevation);
  assert.equal(world.snapshot().resources.trees, before.trees);
  assert.equal(world.mosslings.length, 0);
  assert.equal(
    world.events.find((e) => e.message.includes("recovered"))?.year,
    3,
  );
});

test("repeated strikes restart recovery without replacing the original forest", () => {
  const map = fixture();
  // Heavier rain makes seed 91 flood this tile before the forest can return.
  map.seed = 2;
  map.cells[112].tree = { health: 100 };
  const world = new GodWorld(map, []);
  world.cast("lightning", 7, 7);
  world.advanceTo(48);
  world.cast("lightning", 7, 7);
  world.advanceTo(96);
  assert.equal(world.map.cells[112].tree, undefined);
  world.advanceTo(144);
  assert.equal(world.snapshot().map.cells[112].tree?.health, 100);
  assert.equal(world.map.cells[112].damage, undefined);
});

test("forest grows one frontier layer per two years and respects obstacles and occupants", () => {
  const map = fixture(5, 5);
  for (const cell of map.cells) cell.moisture = FOREST_SPREAD_MOISTURE;
  map.cells[12].tree = { health: 100 };
  map.cells[7].terrain = "water";
  map.cells[11].terrain = "rock";
  map.cells[17].burning = true;
  map.cells[17].damage = "burned";
  const ecology = new WorldEcology(map);
  const trees = () => countWorldResources(map, []).trees;
  ecology.month(FOREST_SPREAD_SECONDS - 0.01, new Set());
  assert.equal(trees(), 1);
  ecology.month(FOREST_SPREAD_SECONDS, new Set());
  assert.ok(map.cells[13].tree);
  assert.equal(trees(), 2);
  assert.equal(map.cells[14].tree, undefined);
  ecology.month(FOREST_SPREAD_SECONDS * 2, new Set());
  assert.ok(map.cells[14].tree);
  assert.equal(map.cells[7].tree, undefined);
  assert.equal(map.cells[11].tree, undefined);
  assert.equal(map.cells[17].tree, undefined);
});

test("a tree already on the map waits two years before spreading", () => {
  const map = fixture(5, 5);
  map.cells[12].moisture = FOREST_SPREAD_MOISTURE;
  map.cells[12].tree = { health: 100 };
  const ecology = new WorldEcology(map);
  ecology.month(80, new Set());
  assert.equal(countWorldResources(map, []).trees, 1);
  ecology.month(FOREST_SPREAD_SECONDS, new Set());
  assert.equal(countWorldResources(map, []).trees, 5);
});

test("a dry forest keeps its turn until the trees are well watered", () => {
  const map = fixture(5, 5);
  map.cells[12].tree = { health: 100 };
  map.cells[12].moisture = FOREST_SPREAD_MOISTURE - 0.01;
  const ecology = new WorldEcology(map);
  ecology.month(FOREST_SPREAD_SECONDS, new Set());
  assert.equal(countWorldResources(map, []).trees, 1);
  map.cells[12].moisture = FOREST_SPREAD_MOISTURE;
  ecology.month(FOREST_SPREAD_SECONDS, new Set());
  assert.equal(countWorldResources(map, []).trees, 5);
  assert.equal(map.cells[13].moisture < FOREST_SPREAD_MOISTURE, true);
});

test("forest expansion cannot plant on a trapped Mossling or wrap across an edge", () => {
  const map = fixture(3, 3);
  map.cells[4].moisture = FOREST_SPREAD_MOISTURE;
  map.cells[4].tree = { health: 100 };
  map.cells[2].terrain = "rock";
  map.cells[8].terrain = "rock";
  const ecology = new WorldEcology(map);
  ecology.month(FOREST_SPREAD_SECONDS, new Set([5]));
  assert.equal(map.cells[5].tree, undefined);
  const edge = fixture(3, 3);
  edge.cells[2].moisture = FOREST_SPREAD_MOISTURE;
  edge.cells[2].tree = { health: 100 };
  const atEdge = new WorldEcology(edge);
  atEdge.month(FOREST_SPREAD_SECONDS, new Set());
  assert.equal(edge.cells[3].tree, undefined);
  assert.equal(countWorldResources(edge, []).trees, 3);
});

test("deliberate crops edits replace an older repair target", () => {
  const map = fixture();
  map.cells[112].terrain = "rock";
  const world = new GodWorld(map, []);
  world.cast("meteor", 7, 7);
  world.advanceTo(4);
  assert.equal(world.cast("raze", 7, 7), null);
  world.advanceTo(104);
  assert.equal(world.map.cells[112].terrain, "grass");
  assert.equal(world.map.cells[112].damage, undefined);
});

test("resource totals are derived from live tile data and living population", () => {
  const map = fixture(3, 2);
  map.cells[0].terrain = "water";
  map.cells[1].terrain = "rock";
  map.cells[2].tree = { health: 50 };
  map.cells[3].tree = { health: 50 };
  map.cells[4].damage = "burned";
  const world = new GodWorld(map, [mossling(5)]);
  assert.deepEqual(world.snapshot().resources, {
    born: 0,
    mosslings: 1,
    killed: 0,
    food: 0,
    health: 100,
    trees: 2,
    destroyed: 1,
  });
  world.cast("raze", 2, 0);
  assert.equal(world.snapshot().resources.trees, 1);
  assert.equal(world.snapshot().resources.destroyed, 1);
});

test("destroyed counts damaged and burning tiles without double-counting", () => {
  const map = fixture(2, 2);
  assert.deepEqual(countWorldResources(map, []), {
    born: 0,
    mosslings: 0,
    killed: 0,
    food: 0,
    trees: 0,
    destroyed: 0,
    health: 0,
  });
  map.cells[0].damage = "cracked";
  assert.equal(countWorldResources(map, []).destroyed, 1);
  map.cells[1].burning = true;
  assert.equal(countWorldResources(map, []).destroyed, 2);
  map.cells[0].burning = true;
  assert.equal(countWorldResources(map, []).destroyed, 2);
});

test("all destructive powers repair their damage on the game calendar", () => {
  for (const power of [
    "fire",
    "tornado",
    "nuke",
    "lightning",
    "meteor",
  ] as const) {
    const map = fixture();
    map.cells[112].tree = { health: 100 };
    const world = new GodWorld(map, []);
    world.cast(power, 7, 7);
    world.advanceTo(16);
    world.advanceTo(112);
    const cell = world.map.cells[112];
    // Rain can strike the same spot again before the first scar heals.
    if (
      cell.terrain !== "water" &&
      cell.recovery === undefined &&
      !cell.damage &&
      !cell.burning
    )
      assert.equal(cell.tree?.health, 100, power);
  }
});

test("resource history grows on monthly ticks and matches the latest snapshot", () => {
  const world = new GodWorld(fixture(), [mossling(112)]);
  const initial = world.snapshot();
  assert.equal(initial.resourceHistory.length, 1);
  assert.deepEqual(
    initial.resourceHistory[0],
    sampleFromResources(initial.resources),
  );

  world.advanceTo(MONTH_SECONDS);
  const afterOneMonth = world.snapshot();
  assert.equal(afterOneMonth.resourceHistory.length, 2);
  assert.deepEqual(
    afterOneMonth.resourceHistory.at(-1),
    sampleFromResources(afterOneMonth.resources),
  );

  world.advanceTo(3 * MONTH_SECONDS);
  const afterThreeMonths = world.snapshot();
  assert.equal(afterThreeMonths.resourceHistory.length, 4);
});
