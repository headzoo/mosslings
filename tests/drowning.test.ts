import assert from "node:assert/strict";
import test from "node:test";
import { provisionCrops } from "../lib/crops";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";

function fixture(size = 5): MapData {
  return {
    width: size,
    height: size,
    seed: 42,
    cells: Array.from({ length: size * size }, () => ({
      terrain: "grass",
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.5,
      rockiness: 0.2,
    })),
  };
}
function mossling(index: number, id = 1): PreviewMossling {
  return { id, cellIndex: index, health: 100, colors: ["#ffe632"], pattern: 0 };
}

test("voluntary movement avoids water; forced movement drowns and counts only once", () => {
  const map = fixture();
  map.cells[13].terrain = "water";
  const world = new GodWorld(map, [mossling(12), mossling(0, 2)]);
  provisionCrops(world.map, 2, 60);
  const m = world.mosslings[0];
  world.context.move(m, 3, 2);
  assert.equal(m.cellIndex, 12);
  assert.equal(m.health, 100);
  world.context.forceMove(m, 3, 2);
  assert.equal(m.health, 0);
  world.tick(0.05);
  assert.equal(world.snapshot().resources.mosslings, 1);
  assert.equal(world.snapshot().resources.killed, 1);
  assert.equal(
    world.events.filter((e) => e.message === "1 Mossling drowned.").length,
    1,
  );
  world.context.forceMove(m, 2, 2);
  world.advanceTo(200);
  // Weather may claim the survivor. A recounted drowning would add a death per month.
  assert.ok(world.snapshot().resources.killed <= 2);
  assert.ok(world.mosslings.length <= 1);
});

test("a push cannot carry a Mossling across a water tile to safety", () => {
  const map = fixture();
  map.cells[12].terrain = "water";
  const world = new GodWorld(map, [mossling(11)]);
  const m = world.mosslings[0];
  world.context.forceMove(m, 3, 2);
  assert.equal(m.cellIndex, 12);
  assert.equal(m.health, 0);
  world.tick(0.05);
  assert.equal(world.snapshot().resources.killed, 1);
});

test("actual tornado displacement can drown a living Mossling", () => {
  const map = fixture();
  for (const cell of map.cells) cell.terrain = "water";
  map.cells[12].terrain = "grass";
  const world = new GodWorld(map, [mossling(12)]);
  world.cast("tornado", 1, 2);
  assert.equal(world.mosslings.length, 1);
  assert.equal(world.mosslings[0]?.health, 0);
  assert.equal(world.snapshot().resources.mosslings, 0);
  assert.equal(world.snapshot().resources.killed, 1);
  assert.ok(world.events.some((e) => e.message.includes("drowned")));
  world.advanceTo(4);
  assert.equal(world.mosslings.length, 0);
});

test("fire can drive a trapped Mossling into water, but an open land escape is preferred", () => {
  const map = fixture(3);
  for (const cell of map.cells) cell.terrain = "water";
  map.cells[4].terrain = "grass";
  const trapped = new GodWorld(map, [mossling(4)]);
  trapped.cast("fire", 1, 1);
  trapped.advanceTo(1.5);
  assert.equal(trapped.mosslings.length, 1);
  assert.equal(trapped.mosslings[0]?.health, 0);
  assert.equal(trapped.snapshot().resources.killed, 1);
  assert.ok(trapped.events.some((e) => e.message.includes("drowned")));
  trapped.advanceTo(4);
  assert.equal(trapped.mosslings.length, 0);

  // A wet land corridor is safe from spreading fire.
  const openMap = fixture(5);
  for (const cell of openMap.cells) cell.terrain = "water";
  openMap.cells[12].terrain = "grass";
  openMap.cells[13].terrain = "grass";
  openMap.cells[13].moisture = 1;
  openMap.cells[14].terrain = "grass";
  openMap.cells[14].moisture = 1;
  const open = new GodWorld(openMap, [mossling(12)]);
  open.cast("fire", 2, 2);
  open.advanceTo(1.5);
  assert.equal(open.mosslings.length, 1);
  assert.equal(open.snapshot().resources.killed, 0);
  assert.ok([13, 14].includes(open.mosslings[0].cellIndex));
});

test("all death causes contribute to the cumulative tally and a fresh world starts at zero", () => {
  const world = new GodWorld(fixture(), [mossling(12), mossling(0, 2)]);
  world.context.damage(12, 10000, "impact");
  world.tick(0.05);
  assert.equal(world.snapshot().resources.killed, 1);
  const soaked = world.mosslings.find((m) => m.id === 2);
  assert.ok(soaked);
  for (const trait of soaked.traits ?? [])
    if (trait.label === "Water tolerance") trait.value = 20;
  world.map.cells[0].terrain = "water";
  world.tick(0.05);
  assert.equal(world.snapshot().resources.killed, 2);
  assert.equal(world.snapshot().resources.mosslings, 0);
  world.advanceTo(200);
  assert.equal(world.snapshot().resources.killed, 2);
  assert.equal(
    new GodWorld(fixture(), [mossling(12)]).snapshot().resources.killed,
    0,
  );
});

test("forced movement still respects solid obstacles, occupied tiles, and bounds", () => {
  const map = fixture();
  map.cells[13].terrain = "rock";
  const world = new GodWorld(map, [mossling(12), mossling(11, 2)]);
  const m = world.mosslings[0];
  world.context.forceMove(m, 4, 2);
  world.context.forceMove(m, 1, 2);
  world.context.forceMove(m, -1, 2);
  assert.equal(m.cellIndex, 12);
  assert.equal(m.health, 100);
  assert.equal(world.snapshot().resources.killed, 0);
});
