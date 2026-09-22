import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewMossling } from "../lib/map-preview";
import {
  lineageDistance,
  paletteDistance,
  quantizeHex,
  visualMatch,
} from "../lib/species-similarity";

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

test("quantizeHex snaps channels to palette buckets", () => {
  assert.equal(quantizeHex("#010203"), "#000000");
  assert.equal(quantizeHex("#101112"), "#111111");
  assert.equal(quantizeHex("#ffffff"), "#ffffff");
});

test("paletteDistance treats tiny mix drift as close", () => {
  const base = ["#ff8090", "#eeddcc"];
  const drift = ["#ff8191", "#eeddcd"];
  assert.ok(paletteDistance(base, drift) <= 17);
});

test("paletteDistance rejects clearly different palettes", () => {
  const yellow = ["#ffe632", "#769f24"];
  const blue = ["#49d5df", "#6c58d5"];
  assert.ok(paletteDistance(yellow, blue) > 17);
});

test("visualMatch groups near-identical palettes with the same pattern", () => {
  const left = mossling({ id: 1, cellIndex: 0, pattern: 1 });
  const right = mossling({
    id: 2,
    cellIndex: 1,
    pattern: 1,
    colors: ["#111213", "#222324"],
  });
  assert.equal(visualMatch(left, right), true);
});

test("visualMatch rejects different patterns", () => {
  const left = mossling({ id: 1, cellIndex: 0, pattern: 0 });
  const right = mossling({ id: 2, cellIndex: 1, pattern: 1 });
  assert.equal(visualMatch(left, right), false);
});

test("lineageDistance covers parent, sibling, and cousin links", () => {
  const parent = mossling({ id: 1, cellIndex: 0, parents: [10, 11] });
  const child = mossling({
    id: 2,
    cellIndex: 1,
    parents: [1, 9],
  });
  const sibling = mossling({
    id: 3,
    cellIndex: 2,
    parents: [1, 9],
  });
  const aunt = mossling({
    id: 4,
    cellIndex: 3,
    parents: [10, 12],
  });
  const cousin = mossling({
    id: 7,
    cellIndex: 4,
    parents: [4, 8],
  });
  const living = [parent, child, sibling, aunt, cousin];
  assert.equal(lineageDistance(parent, child, living), 1);
  assert.equal(lineageDistance(child, sibling, living), 1);
  assert.equal(lineageDistance(child, cousin, living), 3);
});

test("lineageDistance is infinite for unrelated mosslings", () => {
  const left = mossling({ id: 1, cellIndex: 0 });
  const right = mossling({ id: 2, cellIndex: 1 });
  assert.equal(lineageDistance(left, right, [left, right]), Infinity);
});
