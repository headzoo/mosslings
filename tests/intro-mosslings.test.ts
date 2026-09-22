import assert from "node:assert/strict";
import test from "node:test";
import { plantStarterFields } from "../lib/crops";
import { plantStarterForests } from "../lib/god/ecology";
import {
  createIntroMosslings,
  ensureIntroZone,
  introClearZoneTiles,
  introClusterCenter,
  introMosslingTiles,
  introZoneIndices,
} from "../lib/intro-mosslings";
import type { MapData } from "../lib/map";
import { createPreviewMosslings } from "../lib/map-preview";

function fixture(width = 20, height = 16): MapData {
  return {
    width,
    height,
    seed: 42,
    cells: Array.from({ length: width * height }, (_, index) => ({
      terrain: index % 7 === 0 ? "water" : "grass",
      elevation: 0.6,
      moisture: 0.5,
      rockiness: 0.2,
      fertility: 0.7,
      ...(index % 11 === 0 ? { tree: { health: 100 } } : {}),
      ...(index % 13 === 0 ? { growth: 0.5 } : {}),
    })),
  };
}

function assertGrassOnly(map: MapData, indices: Iterable<number>) {
  for (const index of indices) {
    const cell = map.cells[index];
    assert.equal(cell.terrain, "grass");
    assert.equal(cell.tree, undefined);
    assert.equal(cell.growth, undefined);
    assert.equal(cell.damage, undefined);
    assert.equal(cell.burning, undefined);
  }
}

test("introMosslingTiles returns four corners with two empty tiles between", () => {
  const tiles = introMosslingTiles({ width: 20, height: 16 });
  assert.equal(tiles.length, 4);
  assert.deepEqual(tiles, [
    { x: 8, y: 6 },
    { x: 11, y: 6 },
    { x: 8, y: 9 },
    { x: 11, y: 9 },
  ]);
});

test("introClearZoneTiles covers the spotlight circle around the cluster", () => {
  const map = fixture();
  const zone = introClearZoneTiles(map);
  const mosslings = introMosslingTiles(map);
  assert.ok(zone.length > mosslings.length);
  for (const tile of mosslings) {
    assert.ok(zone.some((entry) => entry.x === tile.x && entry.y === tile.y));
  }
});

test("ensureIntroZone forces grass and clears obstacles in the spotlight", () => {
  const map = fixture();
  ensureIntroZone(map);
  assertGrassOnly(map, introZoneIndices(map));
});

test("createIntroMosslings returns four fixed designs at center tiles", () => {
  const map = fixture();
  ensureIntroZone(map);
  const mosslings = createIntroMosslings(map);
  assert.equal(mosslings.length, 4);
  for (let id = 0; id < 4; id++) {
    assert.equal(mosslings[id].id, id);
    assert.equal(mosslings[id].health, 100);
    assert.notDeepEqual(mosslings[0].colors, mosslings[1].colors);
  }
  const tiles = introMosslingTiles(map);
  for (let id = 0; id < 4; id++) {
    assert.equal(
      mosslings[id].cellIndex,
      tiles[id].y * map.width + tiles[id].x,
    );
  }
});

test("introClusterCenter returns normalized coords within 0..1", () => {
  const map = fixture();
  const center = introClusterCenter(map);
  assert.ok(center.x > 0 && center.x < 1);
  assert.ok(center.y > 0 && center.y < 1);
  assert.equal(center.x, 10 / map.width);
  assert.equal(center.y, 8 / map.height);
});

test("createPreviewMosslings skips occupied intro zone tiles", () => {
  const map = fixture(40, 32);
  ensureIntroZone(map);
  const occupied = introZoneIndices(map);
  const rest = createPreviewMosslings(map, { startId: 4, occupied });
  assert.ok(rest.length > 0);
  assert.ok(rest.every((mossling) => mossling.id >= 4));
  for (const mossling of rest) {
    assert.ok(!occupied.has(mossling.cellIndex));
  }
});

test("ensureIntroZone stays grass-only after starter forests and fields", () => {
  const map = fixture(40, 32);
  ensureIntroZone(map);
  const occupied = introZoneIndices(map);
  const rest = createPreviewMosslings(map, { startId: 4, occupied });
  const mosslings = [...createIntroMosslings(map), ...rest];
  for (const mossling of rest) occupied.add(mossling.cellIndex);
  plantStarterForests(map, occupied);
  plantStarterFields(map, mosslings.length, occupied);
  ensureIntroZone(map);
  assertGrassOnly(map, introZoneIndices(map));
});
