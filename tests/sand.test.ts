import assert from "node:assert/strict";
import test from "node:test";
import { plantStarterFields } from "../lib/crops";
import { GodWorld } from "../lib/god/engine";
import {
  generateMap,
  type MapCell,
  type MapData,
  pruneBeaches,
} from "../lib/map";
import { type PreviewMossling, terrainColor } from "../lib/map-preview";
import { cellNeedsTerrainDetail, terrainPixel } from "../lib/terrain-detail";

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

function cell(patch: Partial<MapCell> = {}): MapCell {
  return {
    terrain: "grass",
    elevation: 0.55,
    moisture: 0.4,
    fertility: 0.5,
    rockiness: 0.2,
    ...patch,
  };
}

function waterDistance(map: MapData, index: number): number {
  const { width, height, cells } = map;
  const distance = new Int16Array(cells.length);
  distance.fill(-1);
  distance[index] = 0;
  const queue = [index];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === undefined) break;
    const soFar = distance[current] ?? 0;
    if (cells[current]?.terrain === "water") return soFar;
    if (soFar >= 3) continue;
    const x = current % width;
    const y = Math.floor(current / width);
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (distance[next] !== -1) continue;
      distance[next] = soFar + 1;
      queue.push(next);
    }
  }

  return 99;
}

function cardinalNeighbors(map: MapData, index: number): number[] {
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  const neighbors: number[] = [];
  for (const [dx, dy] of STEPS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
    neighbors.push(ny * map.width + nx);
  }
  return neighbors;
}

function components(indices: number[], map: MapData): number[][] {
  const allowed = new Set(indices);
  const seen = new Set<number>();
  const groups: number[][] = [];

  for (const start of indices) {
    if (seen.has(start)) continue;
    const group: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) break;
      group.push(current);
      for (const neighbor of cardinalNeighbors(map, current)) {
        if (!allowed.has(neighbor) || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    groups.push(group);
  }

  return groups;
}

function shoreIndices(map: MapData): number[] {
  return map.cells.flatMap((tile, index) =>
    tile.terrain !== "water" && waterDistance(map, index) === 1 ? [index] : [],
  );
}

function assertBeaches(map: MapData) {
  const shoreSand: number[] = [];
  const inlandSand: number[] = [];

  map.cells.forEach((tile, index) => {
    if (tile.terrain !== "sand") return;
    const distance = waterDistance(map, index);
    assert.ok(
      distance === 1 || distance === 2,
      `sand at ${index} is ${distance} tiles from water`,
    );
    if (distance === 1) shoreSand.push(index);
    else inlandSand.push(index);
  });

  for (const run of components(shoreSand, map)) {
    assert.ok(
      run.length >= 3 && run.length <= 25,
      `shore run length ${run.length}`,
    );
  }

  const shoreSandSet = new Set(shoreSand);
  for (const index of inlandSand) {
    const touchesShore = cardinalNeighbors(map, index).some((neighbor) =>
      shoreSandSet.has(neighbor),
    );
    assert.equal(touchesShore, true);
  }

  for (const shore of components(shoreIndices(map), map)) {
    if (shore.length >= 3) continue;
    for (const index of shore) {
      assert.notEqual(map.cells[index]?.terrain, "sand");
    }
  }
}

test("sand stays on the shore in runs of three to twenty-five", () => {
  const seeds = [1, 7, 42, "MOSS-48291"];
  for (const seed of seeds) {
    const map = generateMap(96, 64, { seed });
    assert.ok(map.cells.some((tile) => tile.terrain === "sand"));
    assertBeaches(map);
    const runs = components(
      map.cells.flatMap((tile, index) =>
        tile.terrain === "sand" && waterDistance(map, index) === 1
          ? [index]
          : [],
      ),
      map,
    );
    const mean =
      runs.reduce((total, run) => total + run.length, 0) / runs.length;
    assert.ok(mean < 14, `mean run ${mean} on seed ${String(seed)}`);
  }
});

test("a beach pulled off the water turns back to grass", () => {
  const tile = (terrain: MapCell["terrain"]): MapCell =>
    cell({ terrain, fertility: 0.12 });
  const stranded: MapData = {
    width: 6,
    height: 2,
    seed: 1,
    cells: [
      tile("grass"),
      tile("grass"),
      tile("water"),
      tile("water"),
      tile("water"),
      tile("water"),
      tile("sand"),
      tile("sand"),
      tile("sand"),
      tile("sand"),
      tile("sand"),
      tile("sand"),
    ],
  };
  pruneBeaches(stranded);
  assert.deepEqual(
    stranded.cells.map((entry) => entry.terrain),
    [
      "grass",
      "grass",
      "water",
      "water",
      "water",
      "water",
      "grass",
      "sand",
      "sand",
      "sand",
      "sand",
      "sand",
    ],
  );

  const clipped: MapData = {
    width: 3,
    height: 2,
    seed: 1,
    cells: [
      tile("water"),
      tile("water"),
      tile("water"),
      tile("sand"),
      tile("sand"),
      tile("grass"),
    ],
  };
  pruneBeaches(clipped);
  assert.ok(clipped.cells.every((entry) => entry.terrain !== "sand"));
});

test("the same seed lays the same beaches", () => {
  const first = generateMap(48, 36, { seed: 7 });
  const second = generateMap(48, 36, { seed: 7 });
  assert.deepEqual(
    first.cells.map((tile) => tile.terrain),
    second.cells.map((tile) => tile.terrain),
  );
});

test("sand is pale, grainy, and barren", () => {
  const sand = cell({ terrain: "sand", fertility: 0.12 });
  const dirt = cell({ terrain: "dirt" });
  const sandLight = Number(terrainColor(sand, 3).match(/(\d+)%\)$/)?.[1]);
  const dirtLight = Number(terrainColor(dirt, 3).match(/(\d+)%\)$/)?.[1]);
  assert.ok(sandLight > dirtLight + 10);

  const map: MapData = { width: 1, height: 1, seed: 1, cells: [sand] };
  assert.equal(cellNeedsTerrainDetail(map, 0), true);
  assert.match(terrainPixel(map, 0, 4, 4, 24) ?? "", /^#[cdef]/);

  const field = generateMap(12, 12, { seed: 3, rivers: false });
  for (const tile of field.cells) {
    if (tile.terrain !== "water") tile.terrain = "sand";
  }
  assert.equal(plantStarterFields(field, 6, new Set()), 0);

  const world = new GodWorld(
    {
      width: 2,
      height: 1,
      seed: 1,
      cells: [sand, cell()],
    },
    [
      {
        id: 0,
        cellIndex: 1,
        health: 100,
        colors: ["#ffe632", "#769f24", "#fff5b7"],
        pattern: 0,
      } satisfies PreviewMossling,
    ],
  );
  assert.equal(world.cast("raze", 0, 0), "Carrots will not grow in sand.");
  assert.equal(world.moveMossling(0, 0, 0), null);
  assert.equal(world.mosslings[0]?.cellIndex, 0);
});
