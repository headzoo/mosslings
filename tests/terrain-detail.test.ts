import assert from "node:assert/strict";
import test from "node:test";
import type { SeasonLook } from "../lib/game-time";
import type { MapCell, MapData } from "../lib/map";
import { SUMMER_LOOK, snowBlanket, snowDepth } from "../lib/map-preview";
import {
  cellNeedsTerrainDetail,
  terrainDetailActive,
  terrainPixel,
  terrainTileKey,
  waterRipple,
  writeTerrainTile,
} from "../lib/terrain-detail";

const SUMMER: SeasonLook = SUMMER_LOOK;

function cell(tune: Partial<MapCell> = {}): MapCell {
  return {
    terrain: "grass",
    elevation: 0.55,
    moisture: 0.45,
    fertility: 0.5,
    rockiness: 0.7,
    ...tune,
  };
}

function mapOf(tile: MapCell): MapData {
  return { width: 1, height: 1, seed: 1, cells: [tile] };
}

function luminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return ((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255);
}

function isOrange(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return red > 160 && green > 40 && green < 160 && blue < 80;
}

test("detail starts at the 24px zoom", () => {
  assert.equal(terrainDetailActive(8), false);
  assert.equal(terrainDetailActive(16), false);
  assert.equal(terrainDetailActive(23.9), false);
  assert.equal(terrainDetailActive(24), true);
  assert.equal(terrainDetailActive(32), true);
});

test("bare dirt stays on the base map", () => {
  const dirt = mapOf(cell({ terrain: "dirt" }));
  assert.equal(cellNeedsTerrainDetail(dirt, 0, SUMMER), false);
  assert.equal(terrainPixel(dirt, 0, 4, 4, 24, SUMMER), null);
});

function isGreen(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return green > red + 15 && green > blue;
}

test("a summer tree has a leafy crown over a trunk, with ground in the corner", () => {
  const forest = mapOf(cell({ tree: { health: 100 }, moisture: 0.8 }));
  const size = 24;
  assert.equal(cellNeedsTerrainDetail(forest, 0, SUMMER), true);
  const crown = terrainPixel(forest, 0, 12, 8, size, SUMMER);
  const trunk = terrainPixel(forest, 0, 11, 20, size, SUMMER);
  const corner = terrainPixel(forest, 0, 0, 23, size, SUMMER);
  assert.ok(crown && isGreen(crown));
  assert.ok(trunk && !isGreen(trunk));
  assert.ok(corner && corner !== crown);
});

test("a winter tree keeps its trunk and drops the leaves", () => {
  const winter: SeasonLook = {
    cover: 0.08,
    autumn: 0,
    snow: 0.3,
    ice: 0.8,
    crop: 0,
  };
  const forest = mapOf(cell({ tree: { health: 100 }, moisture: 0.8 }));
  const crown = terrainPixel(forest, 0, 12, 8, 24, winter);
  const trunk = terrainPixel(forest, 0, 11, 20, 24, winter);
  assert.ok(crown && !isGreen(crown));
  assert.ok(trunk && !isGreen(trunk));
});

function countPlantPixels(field: MapData, size: number, look: SeasonLook) {
  let plants = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = terrainPixel(field, 0, x, y, size, look);
      if (color && (isGreen(color) || isOrange(color))) plants += 1;
    }
  }
  return plants;
}

function furrowContrast(field: MapData, size: number, look: SeasonLook) {
  const rowLight: number[] = [];
  for (let y = 0; y < size; y++) {
    let sum = 0;
    let count = 0;
    for (let x = 0; x < size; x++) {
      const color = terrainPixel(field, 0, x, y, size, look);
      if (!color) continue;
      sum += luminance(color);
      count += 1;
    }
    if (count) rowLight.push(sum / count);
  }
  return Math.max(...rowLight) - Math.min(...rowLight);
}

test("ripe carrots sit in separated rows over soil", () => {
  const field = mapOf(cell({ terrain: "dirt", growth: 1 }));
  const size = 24;
  const bands: { start: number; end: number }[] = [];
  let current: { start: number; end: number } | null = null;
  for (let y = 0; y < size; y++) {
    let orange = false;
    for (let x = 0; x < size; x++) {
      const color = terrainPixel(field, 0, x, y, size, SUMMER);
      if (color && isOrange(color)) orange = true;
    }
    if (orange) {
      if (current) current.end = y;
      else current = { start: y, end: y };
    } else if (current) {
      bands.push(current);
      current = null;
    }
  }
  if (current) bands.push(current);
  assert.equal(bands.length, 3);
  assert.ok(bands[1].start > bands[0].end + 1);
  assert.ok(bands[2].start > bands[1].end + 1);
  const between = terrainPixel(field, 0, 0, bands[0].end + 1, size, SUMMER);
  assert.ok(between);
  assert.equal(isOrange(between), false);
});

test("autumn and winter crops at close zoom are empty plowed beds", () => {
  const field = mapOf(cell({ terrain: "dirt", growth: 1 }));
  const autumn: SeasonLook = {
    cover: 1,
    autumn: 1,
    snow: 0,
    ice: 0,
    crop: 0.5,
  };
  const winter: SeasonLook = {
    cover: 0.08,
    autumn: 0,
    snow: 0,
    ice: 0.8,
    crop: 0,
  };
  for (const [look, size] of [
    [autumn, 24],
    [winter, 32],
  ] as const) {
    assert.equal(countPlantPixels(field, size, look), 0);
    assert.ok(furrowContrast(field, size, look) > 30);
  }
});

test("spring crops still put up a stand at close zoom", () => {
  const field = mapOf(cell({ terrain: "dirt", growth: 1 }));
  const spring: SeasonLook = {
    cover: 0.54,
    autumn: 0,
    snow: 0,
    ice: 0.5,
    crop: 0.5,
  };
  assert.ok(countPlantPixels(field, 24, spring) > 0);
});

test("grass is more than one green", () => {
  const meadow = mapOf(cell());
  const colors = new Set<string>();
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const color = terrainPixel(meadow, 0, x, y, 24, SUMMER);
      if (color) colors.add(color);
    }
  }
  assert.ok(colors.size > 1);
});

test("water ripples are lighter than the deep pixels", () => {
  const lake = mapOf(cell({ terrain: "water", elevation: 0.2 }));
  assert.equal(waterRipple(0, 24), false);
  assert.equal(waterRipple(1, 24), true);
  const deep = terrainPixel(lake, 0, 0, 0, 24, SUMMER);
  const ripple = terrainPixel(lake, 0, 0, 1, 24, SUMMER);
  assert.ok(deep && ripple);
  assert.ok(luminance(ripple) > luminance(deep));
});

const SNOW_COLORS = new Set(["#f7fbff", "#ffffff", "#d5e4ee"]);

test("winter snow sits in patches on the ground", () => {
  const winter: SeasonLook = {
    cover: 0.08,
    autumn: 0,
    snow: 0.5,
    ice: 0.9,
    crop: 0,
  };
  const meadow: MapData = {
    width: 16,
    height: 12,
    seed: 1,
    cells: Array.from({ length: 16 * 12 }, () => cell({ elevation: 0.85 })),
  };
  let index = -1;
  for (let i = 0; i < meadow.cells.length; i++) {
    if (
      snowDepth(meadow, i, winter.snow) > 0.15 &&
      !snowBlanket(meadow, i, winter)
    ) {
      index = i;
      break;
    }
  }
  assert.ok(index >= 0);
  const size = 24;
  let snow = 0;
  let linked = 0;
  const at = (x: number, y: number) =>
    terrainPixel(meadow, index, x, y, size, winter);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = at(x, y);
      if (!color || !SNOW_COLORS.has(color)) continue;
      snow += 1;
      const neighbor =
        (x > 0 && SNOW_COLORS.has(at(x - 1, y) ?? "")) ||
        (x + 1 < size && SNOW_COLORS.has(at(x + 1, y) ?? "")) ||
        (y > 0 && SNOW_COLORS.has(at(x, y - 1) ?? "")) ||
        (y + 1 < size && SNOW_COLORS.has(at(x, y + 1) ?? ""));
      if (neighbor) linked += 1;
    }
  }
  assert.ok(snow > 20);
  assert.ok(snow < size * size);
  assert.ok(linked / snow > 0.8);

  const light: SeasonLook = { ...winter, snow: 0.12 };
  let lightSnow = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const color = terrainPixel(meadow, index, x, y, size, light);
      if (color && SNOW_COLORS.has(color)) lightSnow += 1;
    }
  assert.ok(lightSnow < snow);
});

test("rock has a darker crack", () => {
  const rocks = mapOf(cell({ terrain: "rock" }));
  let darkest = Number.POSITIVE_INFINITY;
  let lightest = 0;
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const color = terrainPixel(rocks, 0, x, y, 24, SUMMER);
      if (!color) continue;
      const light = luminance(color);
      darkest = Math.min(darkest, light);
      lightest = Math.max(lightest, light);
    }
  }
  assert.ok(lightest - darkest > 40);
});

test("tile keys follow the cell, and the byte tile matches the pixel", () => {
  const meadow = mapOf(cell());
  assert.notEqual(
    terrainTileKey(meadow, 0, SUMMER, 24),
    terrainTileKey({ ...meadow, cells: [cell(), cell()] }, 1, SUMMER, 24),
  );
  const size = 24;
  const data = new Uint8ClampedArray(size * size * 4);
  assert.equal(writeTerrainTile(data, meadow, 0, size, SUMMER), true);
  const color = terrainPixel(meadow, 0, 3, 5, size, SUMMER);
  assert.ok(color);
  const value = Number.parseInt(color.slice(1), 16);
  const offset = (5 * size + 3) * 4;
  assert.equal(data[offset], (value >> 16) & 255);
  assert.equal(data[offset + 1], (value >> 8) & 255);
  assert.equal(data[offset + 2], value & 255);
  assert.equal(data[offset + 3], 255);
});
