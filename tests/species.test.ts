import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewMossling } from "../lib/map-preview";
import {
  clusterSpecies,
  groupSpecies,
  nearestMember,
  speciesKey,
  speciesKeyFor,
} from "../lib/species";

function mossling(
  patch: Partial<PreviewMossling> & Pick<PreviewMossling, "id" | "cellIndex">,
): PreviewMossling {
  return {
    colors: ["#111111", "#222222"],
    pattern: 0,
    health: 100,
    ...patch,
  };
}

test("species key is the pattern and palette", () => {
  const a = mossling({ id: 1, cellIndex: 0, pattern: 2 });
  const b = mossling({
    id: 2,
    cellIndex: 1,
    pattern: 2,
    colors: ["#333333"],
  });
  assert.equal(speciesKey(a), "2:#111111,#222222");
  assert.notEqual(speciesKey(a), speciesKey(b));
});

test("groups living mosslings by look and orders them by count", () => {
  const yellow = ["#ffe632", "#769f24"];
  const blue = ["#49d5df", "#6c58d5"];
  const groups = groupSpecies([
    mossling({ id: 1, cellIndex: 0, colors: yellow, pattern: 1 }),
    mossling({ id: 2, cellIndex: 1, colors: blue, pattern: 0 }),
    mossling({ id: 3, cellIndex: 2, colors: yellow, pattern: 1 }),
    mossling({ id: 4, cellIndex: 3, colors: blue, pattern: 0 }),
    mossling({ id: 5, cellIndex: 4, colors: blue, pattern: 0 }),
    mossling({ id: 6, cellIndex: 5, health: 0, colors: yellow, pattern: 1 }),
    mossling({ id: 7, cellIndex: 6, colors: yellow, pattern: 3 }),
    mossling({ id: 8, cellIndex: 7, colors: ["#aaaaaa"], pattern: 3 }),
  ]);
  assert.deepEqual(
    groups.map((group) => [group.count, group.pattern, group.colors[0]]),
    [
      [3, 0, "#49d5df"],
      [2, 1, "#ffe632"],
      [1, 3, "#aaaaaa"],
      [1, 3, "#ffe632"],
    ],
  );
  assert.deepEqual(
    groups[1]?.members.map((member) => member.id),
    [1, 3],
  );
});

test("a missing health still counts as alive", () => {
  const groups = groupSpecies([
    mossling({ id: 1, cellIndex: 0, health: undefined }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.count, 1);
});

test("clusterSpecies merges near-duplicate palettes into one group", () => {
  const base = ["#ff8090", "#eeddcc"];
  const drift = ["#ff8191", "#eeddcd"];
  const groups = clusterSpecies([
    mossling({ id: 1, cellIndex: 0, colors: base, pattern: 1 }),
    mossling({ id: 2, cellIndex: 1, colors: drift, pattern: 1 }),
    mossling({ id: 3, cellIndex: 2, colors: drift, pattern: 1 }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.count, 3);
});

test("clusterSpecies merges siblings even when their palettes differ slightly", () => {
  const groups = clusterSpecies([
    mossling({
      id: 1,
      cellIndex: 0,
      colors: ["#ff0000", "#00ff00"],
      pattern: 2,
      parents: [9, 10],
    }),
    mossling({
      id: 2,
      cellIndex: 1,
      colors: ["#0000ff", "#ffff00"],
      pattern: 3,
      parents: [9, 10],
    }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.count, 2);
});

test("clusterSpecies keeps unrelated mosslings separate", () => {
  const groups = clusterSpecies([
    mossling({
      id: 1,
      cellIndex: 0,
      colors: ["#ffe632", "#769f24"],
      pattern: 0,
    }),
    mossling({
      id: 2,
      cellIndex: 1,
      colors: ["#49d5df", "#6c58d5"],
      pattern: 0,
    }),
  ]);
  assert.equal(groups.length, 2);
});

test("speciesKeyFor returns the cluster canonical key", () => {
  const population = [
    mossling({ id: 1, cellIndex: 0, colors: ["#ff8090"], pattern: 1 }),
    mossling({
      id: 2,
      cellIndex: 1,
      colors: ["#ff8191"],
      pattern: 1,
      parents: [9, 10],
    }),
  ];
  const cluster = clusterSpecies(population)[0];
  const subject = population[1];
  assert.ok(cluster);
  assert.ok(subject);
  assert.equal(speciesKeyFor(subject, population), cluster.key);
});

test("nearest member prefers the tile closest to the focus, then the lower id", () => {
  const far = mossling({ id: 1, cellIndex: 0 });
  const near = mossling({ id: 4, cellIndex: 8 });
  const tiedLow = mossling({ id: 2, cellIndex: 1 });
  const tiedHigh = mossling({ id: 9, cellIndex: 0 });
  assert.equal(nearestMember([far, near], 4, { x: 0.5, y: 2.5 })?.id, 4);
  assert.equal(nearestMember([tiedHigh, tiedLow], 4, { x: 1, y: 0.5 })?.id, 2);
});
