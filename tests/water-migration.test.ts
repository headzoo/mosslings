import assert from "node:assert/strict";
import test from "node:test";
import { provisionCrops } from "../lib/crops";
import { MONTH_SECONDS, SEASON_SECONDS } from "../lib/game-time";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import { previewTraits, type TraitReading } from "../lib/mossling-traits";
import { nearestShore, shoreMigrant } from "../lib/water-migration";

const WIDTH = 40;

function fixture(): MapData {
  return {
    width: WIDTH,
    height: WIDTH,
    seed: 42,
    cells: Array.from({ length: WIDTH * WIDTH }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}

function at(x: number, y: number) {
  return y * WIDTH + x;
}

function traits(tolerance: number, id = 1): TraitReading[] {
  return previewTraits(42, id).map((trait) =>
    trait.label === "Water tolerance"
      ? { label: trait.label, value: tolerance }
      : trait,
  );
}

function mossling(
  x: number,
  y: number,
  tolerance: number,
  id = 1,
): PreviewMossling {
  return {
    id,
    cellIndex: at(x, y),
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    traits: traits(tolerance, id),
  };
}

function water(map: MapData, x: number, y: number) {
  const cell = map.cells[at(x, y)];
  assert.ok(cell);
  cell.terrain = "water";
}

function feed(map: MapData, months = 6) {
  provisionCrops(map, 1, months);
}

function rock(map: MapData, x: number, y: number) {
  const cell = map.cells[at(x, y)];
  assert.ok(cell);
  cell.terrain = "rock";
}

test("only tolerance of 25% or more migrates, and the nearest shore wins", () => {
  assert.equal(shoreMigrant(traits(24)), false);
  assert.equal(shoreMigrant(traits(25)), true);
  assert.deepEqual(
    nearestShore(0, 0, [
      { x: 4, y: 4 },
      { x: 3, y: 0 },
    ]),
    { x: 3, y: 0 },
  );
});

test("summer walks a swimmer onto the first water tile and keeps them alive", () => {
  const approaching = fixture();
  water(approaching, 8, 5);
  feed(approaching);
  const walker = new GodWorld(approaching, [mossling(5, 5, 25)]);
  walker.advanceTo(MONTH_SECONDS);
  assert.equal(walker.mosslings[0]?.cellIndex, at(7, 5));
  assert.equal(walker.mosslings[0]?.health, 100);

  const entering = fixture();
  water(entering, 6, 5);
  feed(entering);
  const swimmer = new GodWorld(entering, [mossling(5, 5, 90)]);
  swimmer.advanceTo(MONTH_SECONDS);
  assert.equal(swimmer.mosslings[0]?.cellIndex, at(6, 5));
  assert.equal(swimmer.map.cells[at(6, 5)]?.terrain, "water");
  assert.equal(swimmer.mosslings[0]?.health, 100);

  const staying = fixture();
  water(staying, 5, 5);
  feed(staying);
  const resident = new GodWorld(staying, [mossling(5, 5, 90)]);
  resident.advanceTo(MONTH_SECONDS * 2);
  assert.equal(resident.mosslings[0]?.cellIndex, at(5, 5));
  assert.equal(resident.mosslings[0]?.health, 100);

  const far = fixture();
  water(far, 25, 10);
  feed(far);
  const distant = new GodWorld(far, [mossling(0, 10, 80)]);
  distant.advanceTo(MONTH_SECONDS);
  assert.equal(distant.mosslings[0]?.cellIndex, at(2, 10));
});

test("tolerance below 25% stays on land, and the player still cannot place a swimmer in the water", () => {
  const map = fixture();
  water(map, 6, 5);
  feed(map);
  rock(map, 5, 4);
  rock(map, 5, 6);
  rock(map, 4, 5);
  const world = new GodWorld(map, [mossling(5, 5, 24)]);
  world.advanceTo(MONTH_SECONDS);
  assert.equal(world.mosslings[0]?.cellIndex, at(5, 5));
  assert.equal(world.mosslings[0]?.health, 100);

  const placed = fixture();
  water(placed, 6, 5);
  const swimmer = new GodWorld(placed, [mossling(5, 5, 90)]);
  assert.match(swimmer.moveMossling(1, 6, 5) ?? "", /water/);
  assert.equal(swimmer.mosslings[0]?.cellIndex, at(5, 5));
});

test("autumn steps a swimmer back onto land", () => {
  const map = fixture();
  water(map, 5, 5);
  feed(map, 12);
  const world = new GodWorld(map, [mossling(5, 5, 90)]);
  world.advanceTo(SEASON_SECONDS);
  assert.equal(world.mosslings[0]?.cellIndex, at(6, 5));
  assert.equal(world.map.cells[at(6, 5)]?.terrain, "grass");
  assert.equal((world.mosslings[0]?.health ?? 0) > 0, true);
});

test("a shove still drowns a swimmer, and low tolerance drowns on the water", () => {
  const shoved = fixture();
  water(shoved, 6, 5);
  const world = new GodWorld(shoved, [mossling(5, 5, 90)]);
  const swimmer = world.mosslings[0];
  assert.ok(swimmer);
  world.context.forceMove(swimmer, 6, 5);
  assert.equal(swimmer.health, 0);
  assert.equal(swimmer.cellIndex, at(6, 5));

  const soaked = fixture();
  water(soaked, 5, 5);
  const dry = new GodWorld(soaked, [mossling(5, 5, 24)]);
  assert.equal(dry.mosslings[0]?.health, 0);
  assert.ok(dry.events.some((event) => event.message.includes("drowned")));
});
