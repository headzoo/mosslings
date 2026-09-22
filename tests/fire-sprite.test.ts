import assert from "node:assert/strict";
import test from "node:test";
import { fireSpritePixel, touchesFire } from "../lib/fire-sprite";
import type { MapData } from "../lib/map";
import { FRAME_COUNT, SPRITE_SIZE } from "../lib/mossling-detail";

function meadow(size = 5): MapData {
  return {
    width: size,
    height: size,
    seed: 1,
    cells: Array.from({ length: size * size }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}

function at(map: MapData, x: number, y: number) {
  return y * map.width + x;
}

function isWarm(pixel: readonly [number, number, number, number]) {
  return pixel[0] >= 160 && pixel[0] >= pixel[1] && pixel[1] > pixel[2];
}

test("a Mossling touches fire on its own cell and the eight around it", () => {
  const map = meadow();
  const home = at(map, 2, 2);
  assert.equal(touchesFire(map, home), false);

  map.cells[home]!.burning = true;
  assert.equal(touchesFire(map, home), true);

  map.cells[home]!.burning = false;
  map.cells[at(map, 3, 2)]!.burning = true;
  assert.equal(touchesFire(map, home), true);

  map.cells[at(map, 3, 2)]!.burning = false;
  map.cells[at(map, 3, 3)]!.burning = true;
  assert.equal(touchesFire(map, home), true);

  map.cells[at(map, 3, 3)]!.burning = false;
  map.cells[at(map, 4, 2)]!.burning = true;
  assert.equal(touchesFire(map, home), false);
});

test("fire off the map edge is ignored", () => {
  const map = meadow();
  const corner = at(map, 0, 0);
  assert.equal(touchesFire(map, corner), false);
  assert.equal(touchesFire(map, -1), false);
  assert.equal(touchesFire(map, map.cells.length), false);

  map.cells[at(map, 1, 1)]!.burning = true;
  assert.equal(touchesFire(map, corner), true);
});

test("the flame center is fire-colored and frames do not match", () => {
  const center = fireSpritePixel(0, 16, 16);
  assert.ok(center);
  assert.equal(isWarm(center), true);
  assert.equal(fireSpritePixel(0, 0, 0), null);
  assert.equal(fireSpritePixel(FRAME_COUNT, 16, 16), null);

  let same = true;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const a = fireSpritePixel(0, x, y);
      const b = fireSpritePixel(1, x, y);
      if (a?.[0] !== b?.[0] || a?.[1] !== b?.[1] || a?.[2] !== b?.[2])
        same = false;
    }
  }
  assert.equal(same, false);
});
