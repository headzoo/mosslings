import assert from "node:assert/strict";
import test from "node:test";
import { CLOUD_SPEED, type SkyCloud, skyCloudsAt } from "../lib/sky-clouds";

function overlapsX(a: SkyCloud, b: SkyCloud) {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

function samePuff(a: SkyCloud, b: SkyCloud) {
  return (
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.silhouette === b.silhouette &&
    a.speed === b.speed
  );
}

test("same seed and time always yield the same clouds", () => {
  const first = skyCloudsAt(40, 7, 80, 48);
  const second = skyCloudsAt(40, 7, 80, 48);
  assert.deepEqual(first, second);
});

test("the sky starts clear and is empty again after a crossing", () => {
  assert.deepEqual(skyCloudsAt(0, 3, 80, 48), []);
  let sawCloud = false;
  let sawGapAfter = false;
  let peak = 0;
  let gap = 0;
  for (let t = 0; t <= 200; t += 0.5) {
    const count = skyCloudsAt(t, 3, 80, 48).length;
    assert.ok(count <= 3);
    peak = Math.max(peak, count);
    if (count > 0) {
      if (sawCloud && gap > 0) sawGapAfter = true;
      sawCloud = true;
      gap = 0;
    } else if (sawCloud) gap += 0.5;
  }
  assert.equal(sawCloud, true);
  assert.equal(sawGapAfter, true);
  assert.ok(peak >= 2);
});

test("a cluster enters from the west and leaves the east", () => {
  const width = 64;
  let prev: SkyCloud[] = [];
  let enteredWest = false;
  let clearedEast = false;
  for (let t = 0; t <= 150; t += 0.25) {
    const clouds = skyCloudsAt(t, 11, width, 40);
    if (prev.length > 0 && clouds.length === 0) {
      clearedEast = prev.some((cloud) => cloud.x > width - cloud.width);
      break;
    }
    if (clouds.length > 0 && prev.length === 0) {
      enteredWest = clouds.some((cloud) => cloud.x < 0);
    }
    for (const cloud of clouds) {
      const earlier = prev.find((item) => samePuff(item, cloud));
      if (earlier) assert.ok(cloud.x >= earlier.x);
    }
    prev = clouds;
  }
  assert.equal(enteredWest, true);
  assert.equal(clearedEast, true);
});

test("cluster members drift east at nearby speeds, not in lockstep", () => {
  let checked = false;
  for (let t = 0; t < 120 && !checked; t += 0.5) {
    const before = skyCloudsAt(t, 5, 80, 40);
    const after = skyCloudsAt(t + 1, 5, 80, 40);
    if (before.length < 2 || after.length < 2) continue;
    const deltas: number[] = [];
    for (const cloud of before) {
      const later = after.find((item) => samePuff(item, cloud));
      if (!later) continue;
      const delta = later.x - cloud.x;
      assert.ok(Math.abs(delta - cloud.speed) < 1e-6);
      assert.ok(delta > CLOUD_SPEED * 0.9);
      assert.ok(delta < CLOUD_SPEED * 1.1);
      deltas.push(delta);
    }
    if (deltas.length >= 2) {
      assert.ok(new Set(deltas.map((delta) => delta.toFixed(8))).size > 1);
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
          assert.ok(cloud.width >= 8 && cloud.width <= 16);
          assert.ok(cloud.height >= 1 && cloud.height <= 4);
          assert.ok(cloud.silhouette >= 0 && cloud.silhouette <= 2);
        }
      }
    }
  }
});

test("clustered puffs overlap in x and differ in y and size", () => {
  let checked = false;
  for (const seed of [0, 1, 7, 11, 42]) {
    for (let t = 0; t < 160; t += 0.5) {
      const clouds = skyCloudsAt(t, seed, 80, 48);
      if (clouds.length < 2) continue;
      const overlapped = clouds.some((cloud, i) =>
        clouds.some((other, j) => i < j && overlapsX(cloud, other)),
      );
      const ys = new Set(clouds.map((cloud) => cloud.y));
      const sizes = new Set(
        clouds.map((cloud) => `${cloud.width}x${cloud.height}`),
      );
      assert.equal(overlapped, true);
      assert.ok(ys.size > 1);
      assert.ok(sizes.size > 1);
      checked = true;
      break;
    }
    if (checked) break;
  }
  assert.equal(checked, true);
});
