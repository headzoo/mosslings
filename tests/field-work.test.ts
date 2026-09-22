import assert from "node:assert/strict";
import test from "node:test";
import {
  farmingSeason,
  fieldStep,
  isCarrotTile,
  nearestCarrot,
  pullingCarrots,
} from "../lib/field-work";
import { MONTH_SECONDS, SEASON_SECONDS } from "../lib/game-time";
import { GodWorld } from "../lib/god/engine";
import type { MapCell, MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import { previewTraits } from "../lib/mossling-traits";

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

function mossling(x: number, y: number, id = 1): PreviewMossling {
  return {
    id,
    cellIndex: at(x, y),
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    traits: previewTraits(42, id),
  };
}

function plant(map: MapData, x: number, y: number) {
  const cell = map.cells[at(x, y)];
  assert.ok(cell);
  cell.growth = 1;
  cell.moisture = 1;
  cell.light = 1;
}

function rock(map: MapData, x: number, y: number) {
  const cell = map.cells[at(x, y)];
  assert.ok(cell);
  cell.terrain = "rock";
}

test("carrot tiles are standing crops, not burned or damaged ground", () => {
  const ripe = { terrain: "grass", growth: 1 } as MapCell;
  const sprout = { terrain: "grass", growth: 0 } as MapCell;
  const grass = { terrain: "grass" } as MapCell;
  const burned = { terrain: "grass", growth: 1, burning: true } as MapCell;
  const cracked = {
    terrain: "grass",
    growth: 1,
    damage: "cracked",
  } as MapCell;
  assert.equal(isCarrotTile(ripe), true);
  assert.equal(isCarrotTile(sprout), true);
  assert.equal(isCarrotTile(grass), false);
  assert.equal(isCarrotTile(burned), false);
  assert.equal(isCarrotTile(cracked), false);
  assert.equal(isCarrotTile(undefined), false);
});

test("only spring and summer pull Mosslings onto the fields", () => {
  const ripe = { terrain: "grass", growth: 1 } as MapCell;
  const grass = { terrain: "grass" } as MapCell;
  assert.equal(farmingSeason("Spring"), true);
  assert.equal(farmingSeason("Summer"), true);
  assert.equal(farmingSeason("Autumn"), false);
  assert.equal(farmingSeason("Winter"), false);
  assert.equal(pullingCarrots("Spring", ripe), true);
  assert.equal(pullingCarrots("Summer", ripe), true);
  assert.equal(pullingCarrots("Autumn", ripe), false);
  assert.equal(pullingCarrots("Winter", ripe), false);
  assert.equal(pullingCarrots("Summer", grass), false);
});

test("the nearest carrot ignores anything past 20 tiles", () => {
  const far = nearestCarrot(0, 0, [{ x: 21, y: 0 }]);
  assert.equal(far, undefined);
  assert.deepEqual(nearestCarrot(0, 0, [{ x: 20, y: 0 }]), { x: 20, y: 0 });
  assert.deepEqual(
    nearestCarrot(0, 0, [
      { x: 4, y: 4 },
      { x: 3, y: 0 },
    ]),
    { x: 3, y: 0 },
  );
});

test("a blocked closer step waits beside the field", () => {
  assert.deepEqual(
    fieldStep(0, 0, { x: 3, y: 0 }, () => true),
    [1, 0],
  );
  assert.equal(
    fieldStep(0, 0, { x: 3, y: 0 }, (nx) => nx !== 1),
    null,
  );
});

test("summer walks a nearby Mossling onto the carrots and keeps them there", () => {
  const approaching = fixture();
  plant(approaching, 8, 5);
  const walker = new GodWorld(approaching, [mossling(5, 5)]);
  walker.advanceTo(MONTH_SECONDS);
  assert.equal(walker.mosslings[0]?.cellIndex, at(7, 5));

  const working = fixture();
  plant(working, 5, 5);
  const farmer = new GodWorld(working, [mossling(5, 5)]);
  farmer.advanceTo(MONTH_SECONDS);
  assert.equal(farmer.mosslings[0]?.cellIndex, at(5, 5));

  const blocked = fixture();
  plant(blocked, 7, 5);
  rock(blocked, 6, 5);
  const waiting = new GodWorld(blocked, [mossling(5, 5)]);
  waiting.advanceTo(MONTH_SECONDS);
  assert.equal(waiting.mosslings[0]?.cellIndex, at(5, 5));
});

test("autumn and winter step off a carrot row onto open ground", () => {
  const row = () => {
    const map = fixture();
    plant(map, 4, 5);
    plant(map, 5, 5);
    plant(map, 6, 5);
    return map;
  };
  const fence: readonly (readonly [number, number])[] = [
    [3, 5],
    [4, 4],
    [4, 6],
    [5, 4],
    [5, 6],
    [6, 4],
    [6, 6],
    [7, 5],
  ];

  const summer = row();
  const staying = new GodWorld(summer, [mossling(5, 5)]);
  staying.advanceTo(MONTH_SECONDS);
  assert.equal(staying.mosslings[0]?.cellIndex, at(5, 5));

  const autumn = row();
  const leaving = new GodWorld(autumn, [mossling(5, 5)]);
  leaving.advanceTo(SEASON_SECONDS);
  assert.equal(
    isCarrotTile(autumn.cells[leaving.mosslings[0]?.cellIndex ?? -1]),
    false,
  );

  const winter = row();
  for (const [x, y] of fence) rock(winter, x, y);
  const held = new GodWorld(winter, [mossling(5, 5)]);
  held.advanceTo(SEASON_SECONDS * 2 - MONTH_SECONDS);
  assert.equal(
    isCarrotTile(winter.cells[held.mosslings[0]?.cellIndex ?? -1]),
    true,
  );
  for (const [x, y] of fence) {
    const cell = held.map.cells[at(x, y)];
    assert.ok(cell);
    cell.terrain = "grass";
  }
  held.advanceTo(SEASON_SECONDS * 2);
  assert.equal(
    isCarrotTile(held.map.cells[held.mosslings[0]?.cellIndex ?? -1]),
    false,
  );
});

test("a carrot 21 tiles away does not pull, and autumn lets a farmer leave", () => {
  const distant = fixture();
  plant(distant, 31, 10);
  rock(distant, 11, 10);
  rock(distant, 10, 9);
  rock(distant, 10, 11);
  const wanderer = new GodWorld(distant, [mossling(10, 10)]);
  wanderer.advanceTo(MONTH_SECONDS);
  assert.equal(wanderer.mosslings[0]?.cellIndex, at(9, 10));

  const field = fixture();
  plant(field, 5, 5);
  const farmer = new GodWorld(field, [mossling(5, 5)]);
  farmer.advanceTo(SEASON_SECONDS);
  assert.notEqual(farmer.mosslings[0]?.cellIndex, at(5, 5));
  assert.equal((farmer.mosslings[0]?.health ?? 0) > 0, true);
});
