import assert from "node:assert/strict";
import test from "node:test";
import { CLOUD_SPEED, type SkyCloud, skyCloudsAt } from "../lib/sky-clouds";

test("same seed and time always yield the same clouds", () => {
  const first = skyCloudsAt(40, 7, 80, 48);
  const second = skyCloudsAt(40, 7, 80, 48);
  assert.deepEqual(first, second);
});

test("the sky starts clear and is empty again after a crossing", () => {
  assert.deepEqual(skyCloudsAt(0, 3, 80, 48), []);
  let sawCloud = false;
  let sawGapAfter = false;
  let gap = 0;
  for (let t = 0; t <= 200; t += 0.5) {
    const count = skyCloudsAt(t, 3, 80, 48).length;
    assert.ok(count <= 1);
    if (count > 0) {
      if (sawCloud && gap > 0) sawGapAfter = true;
      sawCloud = true;
      gap = 0;
    } else if (sawCloud) gap += 0.5;
  }
  assert.equal(sawCloud, true);
  assert.equal(sawGapAfter, true);
});

test("a cloud enters from the west and leaves the east", () => {
  const width = 64;
  let prev: SkyCloud | null = null;
  let enteredWest = false;
  let clearedEast = false;
  for (let t = 0; t <= 150; t += 0.25) {
    const cloud = skyCloudsAt(t, 11, width, 40)[0] ?? null;
    if (prev && !cloud) {
      clearedEast = prev.x > width - prev.width;
      break;
    }
    if (cloud && !prev && cloud.x < 0) enteredWest = true;
    if (prev && cloud) assert.ok(cloud.x >= prev.x);
    prev = cloud;
  }
  assert.equal(enteredWest, true);
  assert.equal(clearedEast, true);
});

test("clouds drift east at a steady four tiles per second", () => {
  let checked = false;
  for (let t = 0; t < 120 && !checked; t += 0.5) {
    const before = skyCloudsAt(t, 5, 80, 40);
    const after = skyCloudsAt(t + 1, 5, 80, 40);
    if (
      before.length === 1 &&
      after.length === 1 &&
      before[0].y === after[0].y &&
      before[0].width === after[0].width
    ) {
      assert.ok(Math.abs(after[0].x - before[0].x - CLOUD_SPEED) < 1e-6);
      checked = true;
    }
  }
  assert.equal(checked, true);
});

test("lanes stay inside the map height", () => {
  for (const seed of [0, 1, 42, 99, 0xffffffff]) {
    for (const height of [3, 24, 48]) {
      for (let t = 0; t < 160; t += 2) {
        for (const cloud of skyCloudsAt(t, seed, 80, height)) {
          assert.ok(cloud.y >= 0);
          assert.ok(cloud.y + cloud.height <= height);
          assert.ok(cloud.width >= 10);
          assert.ok(cloud.height >= 1 && cloud.height <= 4);
          assert.ok(cloud.silhouette >= 0 && cloud.silhouette <= 2);
        }
      }
    }
  }
});
