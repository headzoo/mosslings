import assert from "node:assert/strict";
import test from "node:test";
import type { MapCell, MapData } from "../lib/map";
import {
  greeneryHome,
  MAX_POLLINATORS,
  pollinatorPosition,
  pollinatorsActive,
  pollinatorsForMap,
  pollinatorVisible,
} from "../lib/pollinators";

function cell(patch: Partial<MapCell> = {}): MapCell {
  return {
    terrain: "grass",
    elevation: 0.6,
    moisture: 1,
    fertility: 0.5,
    rockiness: 0.2,
    ...patch,
  };
}

function map(
  width: number,
  height: number,
  fill: Partial<MapCell> = {},
  seed = 1,
): MapData {
  return {
    width,
    height,
    seed,
    cells: Array.from({ length: width * height }, () => cell(fill)),
  };
}

test("pollinators appear only in spring and summer", () => {
  assert.equal(pollinatorsActive("Spring"), true);
  assert.equal(pollinatorsActive("Summer"), true);
  assert.equal(pollinatorsActive("Autumn"), false);
  assert.equal(pollinatorsActive("Winter"), false);
});

test("the same map seed always picks the same pollinators on greenery", () => {
  const field = map(20, 12, {}, 9);
  const first = pollinatorsForMap(field);
  const second = pollinatorsForMap(field);
  assert.deepEqual(first, second);
  assert.ok(first.length > 0);
  assert.ok(first.length <= MAX_POLLINATORS);
  for (const pollinator of first) {
    assert.equal(greeneryHome(field.cells[pollinator.homeIndex]), true);
  }
});

test("pollinators orbit their home tile and repeat at the same time", () => {
  const field = map(8, 8, {}, 3);
  const pollinator = pollinatorsForMap(field)[0];
  assert.ok(pollinator);
  const a = pollinatorPosition(field, pollinator, 12);
  const b = pollinatorPosition(field, pollinator, 12);
  const c = pollinatorPosition(field, pollinator, 12.5);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("a pollinator leaves when its home tile is no longer greenery", () => {
  const field = map(4, 4, {}, 5);
  const pollinator = pollinatorsForMap(field)[0];
  assert.ok(pollinator);
  assert.equal(pollinatorVisible(field, pollinator), true);
  field.cells[pollinator.homeIndex].burning = true;
  assert.equal(pollinatorVisible(field, pollinator), false);
  field.cells[pollinator.homeIndex].burning = false;
  field.cells[pollinator.homeIndex].growth = 0.4;
  assert.equal(pollinatorVisible(field, pollinator), false);
});
