import assert from "node:assert/strict";
import test from "node:test";
import { provisionCrops } from "../lib/crops";
import { MONTH_SECONDS, YEAR_SECONDS } from "../lib/game-time";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";

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
  assert.equal(world.snapshot().resources.stone, 0);
  world.advanceTo(48);
  assert.ok((world.map.cells[111].recovery ?? 0) > 0.4);
  assert.equal(world.map.cells[111].tree, undefined);
  world.advanceTo(100); // First month boundary two years after the impact.
  assert.equal(world.snapshot().map.cells[111].tree?.health, 100);
  assert.equal(world.map.cells[113].terrain, "rock");
  assert.equal(world.map.cells[113].damage, undefined);
  assert.equal(world.map.cells[113].elevation, map.cells[113].elevation);
  assert.equal(world.snapshot().resources.wood, before.wood);
  assert.equal(world.snapshot().resources.stone, before.stone);
  assert.equal(world.mosslings.length, 0);
  assert.equal(
    world.events.find((e) => e.message.includes("recovered"))?.year,
    3,
  );
});

test("repeated strikes restart recovery without replacing the original forest", () => {
  const map = fixture();
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
  map.cells[12].tree = { health: 100 };
  map.cells[7].terrain = "water";
  map.cells[11].terrain = "rock";
  map.cells[17].burning = true;
  map.cells[17].damage = "burned";
  const world = new GodWorld(map, []);
  world.advanceTo(95.99);
  assert.equal(world.snapshot().resources.wood, 1);
  world.advanceTo(96);
  assert.ok(world.map.cells[13].tree);
  assert.equal(world.snapshot().resources.wood, 2);
  assert.equal(world.map.cells[14].tree, undefined);
  world.advanceTo(192);
  assert.ok(world.map.cells[14].tree);
  assert.equal(world.map.cells[7].tree, undefined);
  assert.equal(world.map.cells[11].tree, undefined);
  assert.equal(world.map.cells[17].tree, undefined);
});

test("a tree already on the map waits two years before spreading", () => {
  const map = fixture(5, 5);
  map.cells[12].tree = { health: 100 };
  const world = new GodWorld(map, []);
  world.advanceTo(80);
  assert.equal(world.snapshot().resources.wood, 1);
  world.advanceTo(96);
  assert.equal(world.snapshot().resources.wood, 5);
});

test("forest expansion cannot plant on a trapped Mossling or wrap across an edge", () => {
  const map = fixture(3, 3);
  map.cells[4].tree = { health: 100 };
  map.cells[2].terrain = "rock";
  map.cells[8].terrain = "rock";
  const world = new GodWorld(map, [mossling(5)]);
  provisionCrops(world.map, 1, 30);
  world.advanceTo(96);
  assert.equal(world.mosslings[0].cellIndex, 5);
  assert.equal(world.map.cells[5].tree, undefined);
  const edge = fixture(3, 3);
  edge.cells[2].tree = { health: 100 };
  const atEdge = new GodWorld(edge, []);
  atEdge.advanceTo(96);
  assert.equal(atEdge.map.cells[3].tree, undefined);
  assert.equal(atEdge.snapshot().resources.wood, 3);
});

test("deliberate ground edits replace an older repair target", () => {
  const map = fixture();
  map.cells[112].terrain = "rock";
  const world = new GodWorld(map, []);
  world.cast("meteor", 7, 7);
  world.advanceTo(4);
  world.cast("ground", 7, 7);
  world.advanceTo(104);
  assert.equal(world.map.cells[112].terrain, "dirt");
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
    mosslings: 1,
    killed: 0,
    food: 0,
    health: 100,
    wood: 1,
    stone: 1,
    water: 1,
  });
  world.cast("ground", 0, 0);
  assert.equal(world.snapshot().resources.water, 0);
  assert.equal(world.snapshot().resources.stone, 0);
});

test("all destructive powers repair their damage on the game calendar", () => {
  for (const power of [
    "fire",
    "tornado",
    "quake",
    "lightning",
    "meteor",
    "raze",
  ] as const) {
    const map = fixture();
    map.cells[112].tree = { health: 100 };
    const world = new GodWorld(map, []);
    world.cast(power, 7, 7);
    world.advanceTo(16);
    world.advanceTo(112);
    assert.equal(world.map.cells[112].tree?.health, 100, power);
    assert.equal(world.map.cells[112].damage, undefined, power);
    assert.equal(world.map.cells[112].burning, false, power);
  }
});
