import assert from "node:assert/strict";
import test from "node:test";
import { foliageAt, SEASON_SECONDS, type SeasonLook } from "../lib/game-time";
import type { MapCell, MapData } from "../lib/map";
import {
  iceCover,
  SUMMER_LOOK,
  snowBlanket,
  snowDepth,
  terrainColor,
  treePaintColor,
} from "../lib/map-preview";
import {
  advanceVegetation,
  BROWN_MOISTURE,
  GRASS_DROUGHT_MONTHS,
  IRRIGATED_MOISTURE,
  TREE_DROUGHT_MONTHS,
} from "../lib/vegetation";

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
): MapData {
  return {
    width,
    height,
    seed: 1,
    cells: Array.from({ length: width * height }, () => cell(fill)),
  };
}

function hue(color: string) {
  return hslParts(color).h;
}

function hslParts(color: string) {
  const match = /hsl\(([-\d.]+) ([-\d.]+)% ([-\d.]+)%\)/.exec(color);
  assert.ok(match);
  return {
    h: Number(match[1]),
    s: Number(match[2]),
    l: Number(match[3]),
  };
}

function channels(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255 };
}

test("grass and moss turn brown in five years, and a tree in ten", () => {
  const meadow = map(1, 1);
  for (let month = 0; month < GRASS_DROUGHT_MONTHS - 1; month++)
    advanceVegetation(meadow);
  assert.ok(meadow.cells[0].moisture > BROWN_MOISTURE);
  assert.equal(meadow.cells[0].terrain, "grass");
  advanceVegetation(meadow);
  assert.ok(meadow.cells[0].moisture <= BROWN_MOISTURE + 1e-9);
  assert.equal(meadow.cells[0].terrain, "grass");

  const forest = map(1, 1, { terrain: "dirt", tree: { health: 100 } });
  for (let month = 0; month < TREE_DROUGHT_MONTHS - 1; month++)
    advanceVegetation(forest);
  assert.ok(forest.cells[0].moisture > BROWN_MOISTURE);
  assert.ok(forest.cells[0].tree);
  advanceVegetation(forest);
  assert.ok(forest.cells[0].moisture <= BROWN_MOISTURE + 1e-9);
  assert.ok(forest.cells[0].tree);
});

test("water within four tiles keeps trees, grass, and moss green", () => {
  const land = map(8, 6, { moisture: 0.2 });
  land.cells[0].terrain = "water";
  land.cells[3].terrain = "dirt";
  land.cells[3].tree = { health: 40 };
  land.cells[3].moisture = 0.95;
  land.cells[9].terrain = "dirt";
  advanceVegetation(land);
  assert.equal(land.cells[4].moisture, IRRIGATED_MOISTURE);
  assert.equal(land.cells[4 + 8 * 4].moisture, IRRIGATED_MOISTURE);
  assert.ok(land.cells[5].moisture < 0.2);
  assert.equal(land.cells[3].moisture, 0.95);
  assert.equal(land.cells[9].moisture, 0.2);
});

test("crops, fire, and scars are left out of the vegetation drought", () => {
  const land = map(2, 2);
  land.cells[0].growth = 1;
  land.cells[1].burning = true;
  land.cells[2].damage = "burned";
  advanceVegetation(land);
  assert.equal(land.cells[0].moisture, 1);
  assert.equal(land.cells[1].moisture, 1);
  assert.equal(land.cells[2].moisture, 1);
  assert.ok(land.cells[3].moisture < 1);
});

test("summer grass stays greener than autumn, and a winter tree paints bare wood", () => {
  const lush = cell({ moisture: 1 });
  const summer = foliageAt(0);
  const autumn = foliageAt(SEASON_SECONDS + SEASON_SECONDS / 2);
  const winter = foliageAt(SEASON_SECONDS * 2 + SEASON_SECONDS / 2);
  assert.ok(
    hue(terrainColor(lush, 3, summer)) >
      hue(terrainColor(lush, 3, autumn)) + 40,
  );
  const canopy = treePaintColor(1, "leaf", summer);
  const bare = treePaintColor(1, "leaf", winter);
  assert.ok(channels(canopy).g > channels(canopy).r);
  assert.ok(channels(bare).r > channels(bare).g);
  assert.equal(summer.snow, 0);
  assert.equal(autumn.snow, 0);
  assert.ok(winter.snow > 0);
});

test("snow drifts, piles on high ground, and thins beside water", () => {
  const field = map(16, 12, { elevation: 0.85 });
  let bare = 0;
  let deep = 0;
  let piled = -1;
  for (let index = 0; index < field.cells.length; index++) {
    const depth = snowDepth(field, index, 0.5);
    if (depth === 0) bare++;
    if (depth > 0.12) {
      deep++;
      piled = index;
    }
  }
  assert.ok(bare > 10);
  assert.ok(deep > 5);
  assert.ok(piled >= 0);

  const high = map(16, 12, { elevation: 1 });
  const low = map(16, 12, { elevation: 0.05 });
  assert.ok(snowDepth(high, piled, 0.5) > snowDepth(low, piled, 0.5));

  const before = snowDepth(field, piled, 0.5);
  const x = piled % field.width;
  const y = Math.floor(piled / field.width);
  const shore = y * field.width + (x === 0 ? 1 : x - 1);
  field.cells[shore].terrain = "water";
  assert.ok(snowDepth(field, piled, 0.5) < before);
});

test("winter buries a few connected drifts and leaves the speckled snow alone", () => {
  const winter: SeasonLook = {
    cover: 0.08,
    autumn: 0,
    snow: 0.45,
    ice: 0.9,
    crop: 0,
  };
  const field = map(40, 28, { elevation: 0.75 });
  const buried: number[] = [];
  for (let index = 0; index < field.cells.length; index++) {
    if (snowBlanket(field, index, winter)) buried.push(index);
  }
  const share = buried.length / field.cells.length;
  assert.ok(share > 0.02 && share < 0.12);
  let linked = 0;
  for (const index of buried) {
    const x = index % field.width;
    const y = Math.floor(index / field.width);
    const neighbor = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= field.width || ny >= field.height)
        return false;
      return snowBlanket(field, ny * field.width + nx, winter);
    });
    if (neighbor) linked++;
  }
  assert.ok(linked / buried.length > 0.7);

  const hit = buried[0];
  assert.ok(hit !== undefined);
  field.cells[hit].terrain = "dirt";
  assert.equal(snowBlanket(field, hit, winter), true);
  field.cells[hit].tree = { health: 100 };
  assert.equal(snowBlanket(field, hit, winter), true);
  field.cells[hit].tree = undefined;
  field.cells[hit].terrain = "rock";
  assert.equal(snowBlanket(field, hit, winter), false);
  field.cells[hit].terrain = "grass";
  field.cells[hit].growth = 1;
  assert.equal(snowBlanket(field, hit, winter), false);
  assert.equal(snowBlanket(field, hit, SUMMER_LOOK), false);
  assert.ok(snowDepth(field, hit, winter.snow) >= 0);
});

test("late autumn starts the ice, winter finishes it, and the sheet is white-blue", () => {
  const water = cell({ terrain: "water", elevation: 0.2 });
  const open = hslParts(terrainColor(water, 4, SUMMER_LOOK));
  const frozen = hslParts(terrainColor(water, 4, { ...SUMMER_LOOK, ice: 1 }));
  assert.ok(frozen.l > open.l + 25);
  assert.ok(frozen.s < open.s - 40);
  assert.ok(frozen.h > 190 && frozen.h < 210);

  const late = foliageAt(SEASON_SECONDS * 2 - 0.2);
  let skim = 0;
  let openTiles = 0;
  for (let index = 0; index < 40; index++) {
    const cover = iceCover(index, late.ice);
    if (cover === 0) openTiles++;
    if (cover > 0) skim++;
  }
  assert.ok(skim > 0);
  assert.ok(openTiles > 0);
  assert.equal(iceCover(4, 1), 1);
  assert.equal(iceCover(4, 0), 0);
});

test("dry trees, grass, and moss paint brown", () => {
  const lush = cell({ moisture: 1 });
  const brown = cell({ moisture: BROWN_MOISTURE });
  assert.ok(hue(terrainColor(lush, 3)) > hue(terrainColor(brown, 3)) + 40);
  const wetTree = treePaintColor(1, "fill");
  const dryTree = treePaintColor(0, "fill");
  assert.ok(channels(wetTree).g > channels(wetTree).r);
  assert.ok(channels(dryTree).r > channels(dryTree).g);
});
