import assert from "node:assert/strict";
import test from "node:test";
import { type SkyBird, skyBirdsAt } from "../lib/sky-birds";
import { CLOUD_SPEED } from "../lib/sky-clouds";

function leaderOf(birds: SkyBird[]) {
  return birds.find((bird) => bird.leader);
}

test("same seed and time always yield the same birds", () => {
  const first = skyBirdsAt(40, 7, 80, 48);
  const second = skyBirdsAt(40, 7, 80, 48);
  assert.deepEqual(first, second);
});

test("the sky starts clear, a flock crosses, then a gap follows", () => {
  assert.deepEqual(skyBirdsAt(0, 3, 80, 48), []);
  assert.deepEqual(skyBirdsAt(5, 3, 80, 48), []);
  let sawFlock = false;
  let sawGapAfter = false;
  let peak = 0;
  let gap = 0;
  let longestGap = 0;
  for (let t = 0; t <= 200; t += 0.5) {
    const count = skyBirdsAt(t, 3, 80, 48).length;
    assert.ok(count <= 6);
    peak = Math.max(peak, count);
    if (count > 0) {
      if (sawFlock && gap > 0) sawGapAfter = true;
      longestGap = Math.max(longestGap, gap);
      sawFlock = true;
      gap = 0;
    } else if (sawFlock) gap += 0.5;
  }
  longestGap = Math.max(longestGap, gap);
  assert.equal(sawFlock, true);
  assert.equal(sawGapAfter, true);
  assert.ok(peak >= 5 && peak <= 6);
  assert.ok(longestGap >= 17);
});

test("a flock enters from the west and leaves the east at cloud speed", () => {
  const width = 64;
  const seed = 11;
  let prev: SkyBird[] = [];
  let enteredWest = false;
  let clearedEast = false;
  let checkedSpeed = false;
  for (let t = 0; t <= 120; t += 0.05) {
    const birds = skyBirdsAt(t, seed, width, 40);
    if (!enteredWest && prev.length === 0 && birds.length > 0) {
      enteredWest = birds.some((bird) => bird.x < 0);
    }
    if (prev.length > 0 && birds.length === 0 && enteredWest) {
      clearedEast = prev.some((bird) => bird.x > width - 2);
      break;
    }
    if (
      !checkedSpeed &&
      prev.length >= 5 &&
      birds.length === prev.length &&
      prev[0]?.leader &&
      birds[0]?.leader
    ) {
      for (let i = 0; i < prev.length; i++) {
        const delta = (birds[i]?.x ?? 0) - (prev[i]?.x ?? 0);
        assert.ok(Math.abs(delta / 0.05 - CLOUD_SPEED) < 0.7);
      }
      checkedSpeed = true;
    }
    prev = birds;
  }
  assert.equal(enteredWest, true);
  assert.equal(clearedEast, true);
  assert.equal(checkedSpeed, true);
});

test("a full flock stays a loose V at cloud speed", () => {
  let checked = false;
  for (const seed of [0, 1, 7, 11, 42]) {
    let prev: SkyBird[] = [];
    for (let t = 0; t < 160 && !checked; t += 1) {
      const birds = skyBirdsAt(t, seed, 80, 48);
      const leader = leaderOf(birds);
      const earlier = leaderOf(prev);
      if (
        leader &&
        earlier &&
        birds.length >= 5 &&
        birds.length === prev.length
      ) {
        const behind = birds.filter((bird) => !bird.leader);
        assert.ok(behind.length >= 4);
        for (const bird of behind) {
          assert.ok(bird.x < leader.x);
          assert.ok(leader.x - bird.x < 8);
          assert.ok(Math.abs(bird.y - leader.y) < 6);
        }
        assert.ok(behind.some((bird) => bird.y < leader.y - 0.4));
        assert.ok(behind.some((bird) => bird.y > leader.y + 0.4));
        const delta = leader.x - earlier.x;
        assert.ok(Math.abs(delta - CLOUD_SPEED) < 0.5);
        checked = true;
      }
      prev = birds;
    }
  }
  assert.equal(checked, true);
});

test("birds stay inside the map height", () => {
  for (const seed of [0, 1, 42, 99]) {
    for (let t = 0; t < 160; t += 2) {
      for (const bird of skyBirdsAt(t, seed, 80, 48)) {
        assert.ok(bird.y >= 0);
        assert.ok(bird.y <= 48);
        assert.ok(bird.pose >= 0 && bird.pose <= 2);
      }
    }
  }
});
