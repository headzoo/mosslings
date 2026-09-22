import assert from "node:assert/strict";
import test from "node:test";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import { previewTraits } from "../lib/mossling-traits";

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

function mossling(
  index: number,
  id = 1,
  tune: Partial<PreviewMossling> = {},
): PreviewMossling {
  return {
    id,
    cellIndex: index,
    health: 100,
    colors: ["#ffe632", "#769f24"],
    pattern: 2,
    traits: previewTraits(42, id),
    ...tune,
  };
}

test("moveMossling moves to an empty grass tile", () => {
  const map = fixture();
  const world = new GodWorld(map, [mossling(12)]);
  const before = world.revision;
  assert.equal(world.moveMossling(1, 3, 3), null);
  assert.equal(world.mosslings[0]?.cellIndex, 18);
  assert.ok(world.revision > before);
});

test("moveMossling rejects invalid destinations", () => {
  const map = fixture();
  map.cells[13].terrain = "water";
  map.cells[14].terrain = "rock";
  map.cells[15].tree = { health: 100 };
  map.cells[16].burning = true;
  const world = new GodWorld(map, [mossling(12), mossling(0, 2)]);
  assert.match(world.moveMossling(1, 3, 2), /water/);
  assert.match(world.moveMossling(1, 4, 2), /stone/);
  assert.match(world.moveMossling(1, 0, 3), /tree/);
  assert.match(world.moveMossling(1, 1, 3), /fire/);
  assert.match(world.moveMossling(1, 0, 0), /occupied/);
});

test("moveMossling rejects dead mosslings and same-tile no-ops", () => {
  const map = fixture();
  const world = new GodWorld(map, [mossling(12, 1, { health: 0 })]);
  assert.equal(world.moveMossling(1, 3, 3), "That Mossling is gone.");
  const live = new GodWorld(map, [mossling(12)]);
  assert.equal(live.moveMossling(1, 2, 2), null);
  assert.equal(live.mosslings[0]?.cellIndex, 12);
});

test("cloneMossling creates a copy at the destination", () => {
  const map = fixture();
  const source = mossling(12, 1, {
    hungry: true,
    parents: [0, 2],
    ritual: { partnerId: 2, months: 1, since: 0, phase: "courtship" },
    plagueMonths: 1,
    panic: 0.5,
  });
  const world = new GodWorld(map, [source]);
  const before = world.snapshot().resources.mosslings;
  assert.equal(world.cloneMossling(1, 3, 3), null);
  assert.equal(world.mosslings.length, 2);
  assert.equal(world.mosslings[0]?.cellIndex, 12);
  const clone = world.mosslings[1];
  assert.ok(clone);
  assert.equal(clone.cellIndex, 18);
  assert.notEqual(clone.id, source.id);
  assert.deepEqual(clone.colors, source.colors);
  assert.equal(clone.pattern, source.pattern);
  assert.equal(clone.health, source.health);
  assert.equal(clone.hungry, true);
  assert.deepEqual(
    clone.traits?.map((trait) => trait.value),
    source.traits?.map((trait) => trait.value),
  );
  assert.equal(clone.parents, undefined);
  assert.equal(clone.ritual, undefined);
  assert.equal(clone.plagueMonths, undefined);
  assert.equal(clone.panic, undefined);
  assert.equal(world.snapshot().resources.mosslings, before + 1);
  assert.ok(
    world.events.some((event) => event.message === "1 Mossling was cloned."),
  );
});

test("cloneMossling rejects invalid destinations and dead sources", () => {
  const map = fixture();
  map.cells[13].terrain = "water";
  const world = new GodWorld(map, [
    mossling(12),
    mossling(0, 2, { health: 0 }),
  ]);
  assert.match(world.cloneMossling(1, 3, 2), /water/);
  assert.match(world.cloneMossling(1, 0, 0), /occupied/);
  assert.equal(world.cloneMossling(2, 3, 3), "That Mossling is gone.");
  assert.equal(world.mosslings.length, 2);
});
