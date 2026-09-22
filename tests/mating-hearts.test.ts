import assert from "node:assert/strict";
import test from "node:test";
import type { Camera } from "../lib/map-camera";
import type { PreviewMossling } from "../lib/map-preview";
import {
  HEART_CYCLE_SECONDS,
  heartCount,
  heartMotion,
  heartSize,
  heartStyle,
  heartsInView,
} from "../lib/mating-hearts";

function courting(
  id: number,
  partnerId: number,
  cellIndex: number,
): PreviewMossling {
  return {
    id,
    cellIndex,
    health: 100,
    colors: ["#ff8866"],
    pattern: 0,
    ritual: {
      partnerId,
      months: 1,
      since: 0,
      phase: "courtship",
    },
  };
}

test("zoom steps use pixels, then a tiny heart, then a sprite", () => {
  assert.equal(heartStyle(8), "pixel");
  assert.equal(heartStyle(16), "tiny");
  assert.equal(heartStyle(24), "sprite");
  assert.equal(heartStyle(32), "sprite");
  assert.equal(heartCount("pixel"), 3);
  assert.equal(heartCount("tiny"), 5);
  assert.equal(heartCount("sprite"), 5);
});

test("sprite frame 3 is full size and frame 4 ends transparent", () => {
  const since = 4;
  const first = heartMotion(since, since, 0, 5);
  const third = heartMotion(since + HEART_CYCLE_SECONDS * 0.5, since, 0, 5);
  const fourth = heartMotion(since + HEART_CYCLE_SECONDS * 0.999, since, 0, 5);
  assert.equal(first.frame, 0);
  assert.equal(third.frame, 2);
  assert.equal(third.scale, 1);
  assert.equal(heartSize(24, third.scale), 9);
  assert.equal(heartSize(32, third.scale), 13);
  assert.ok(heartSize(32, 1) > heartSize(24, 1));
  assert.ok(heartSize(24, first.scale) < heartSize(24, third.scale));
  assert.equal(fourth.frame, 3);
  assert.equal(fourth.scale, 1);
  assert.ok(fourth.alpha < 0.01);
});

test("hearts rise through the cycle and then start over", () => {
  const low = heartMotion(2, 2, 0, 5);
  const high = heartMotion(2.5, 2, 0, 5);
  const again = heartMotion(2 + HEART_CYCLE_SECONDS, 2, 0, 5);
  assert.equal(low.dy, 0);
  assert.ok(high.dy < low.dy);
  assert.equal(again.dy, low.dy);
  assert.equal(again.dx, low.dx);
});

test("a pair outside the camera grows no hearts", () => {
  const camera: Camera = { x: 8, y: 8, width: 3, height: 3, left: 0, top: 0 };
  const width = 20;
  const hidden = [courting(1, 2, 0), courting(2, 1, 1)];
  assert.deepEqual(heartsInView(hidden, width, camera, 8, 1), []);

  const shown = [courting(1, 2, 8 + 8 * width), courting(2, 1, 9 + 8 * width)];
  assert.equal(heartsInView(shown, width, camera, 8, 1).length, 3);
});
