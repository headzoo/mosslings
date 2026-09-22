import assert from "node:assert/strict";
import test from "node:test";
import type { Camera } from "../lib/map-camera";
import {
  inMosslingCircle,
  type PreviewMossling,
  paintedMosslingColor,
} from "../lib/map-preview";
import {
  BOUNCE_SECONDS,
  bounceFrame,
  circleColor,
  detailMode,
  FRAME_COUNT,
  faceFrame,
  mosslingInView,
  ROUND_BOUNCE_PIXELS,
  ROUND_BOUNCE_SECONDS,
  roundBounceOffset,
  SPRITE_SIZE,
  skinnedSpritePixel,
} from "../lib/mossling-detail";

function living(id = 3): PreviewMossling {
  return {
    id,
    cellIndex: 0,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
  };
}

test("8x8 mosslings clip the square corners", () => {
  assert.equal(inMosslingCircle(0, 0), false);
  assert.equal(inMosslingCircle(7, 7), false);
  assert.equal(inMosslingCircle(3, 3), true);
});

test("zoom steps stay square, then round, then a sprite", () => {
  assert.equal(detailMode(8), "square");
  assert.equal(detailMode(15.9), "square");
  assert.equal(detailMode(16), "round");
  assert.equal(detailMode(23.9), "round");
  assert.equal(detailMode(24), "sprite");
  assert.equal(detailMode(32), "sprite");
});

test("round bodies leave the cell corners empty and keep the pattern", () => {
  const mossling = living();
  assert.equal(circleColor(mossling, 0, 0, 16), null);
  assert.equal(circleColor(mossling, 15, 0, 16), null);
  assert.equal(circleColor(mossling, 0, 15, 16), null);
  assert.equal(circleColor(mossling, 15, 15, 16), null);
  const sx = Math.min(7, Math.floor((7 * 8) / 16));
  const sy = Math.min(7, Math.floor((7 * 8) / 16));
  assert.equal(
    circleColor(mossling, 7, 7, 16),
    paintedMosslingColor(mossling, sx, sy),
  );
});

test("bounce frames advance and neighboring Mosslings are out of step", () => {
  assert.equal(bounceFrame(0, 0), 0);
  assert.equal(bounceFrame(0, BOUNCE_SECONDS / FRAME_COUNT), 1);
  assert.equal(bounceFrame(0, BOUNCE_SECONDS), 0);
  assert.notEqual(bounceFrame(0, 0), bounceFrame(1, 0));
});

test("cells outside the camera are left at the base detail", () => {
  const camera: Camera = { x: 2, y: 3, width: 4, height: 2, left: 0, top: 0 };
  const width = 10;
  assert.equal(mosslingInView(0, width, camera), false);
  assert.equal(mosslingInView(3 + 3 * width, width, camera), true);
  assert.equal(mosslingInView(9 + 3 * width, width, camera), false);
  assert.equal(mosslingInView(3 + 8 * width, width, camera), false);
});

test("round balls hop a few pixels and rest between steps", () => {
  assert.equal(roundBounceOffset(0, 0), 0);
  assert.equal(
    roundBounceOffset(0, ROUND_BOUNCE_SECONDS / 2),
    -ROUND_BOUNCE_PIXELS,
  );
  assert.equal(roundBounceOffset(0, ROUND_BOUNCE_SECONDS), 0);
  assert.equal(roundBounceOffset(4, 0.2, 0), 0);
  assert.notEqual(roundBounceOffset(0, 0.4), roundBounceOffset(1, 0.4));
  const rising = roundBounceOffset(0, ROUND_BOUNCE_SECONDS / 4);
  assert.ok(rising < 0 && rising > -ROUND_BOUNCE_PIXELS);
});

test("dead bodies do not pick a face frame", () => {
  assert.equal(faceFrame({ id: 4, health: 0 }, 0.2), null);
  assert.equal(faceFrame({ id: 0, health: 100 }, 0), 0);
});

test("each bounce frame keeps a face and wears the genetic color", () => {
  const mossling = living();
  const tops: number[] = [];
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    let black = 0;
    let colored = 0;
    let top = SPRITE_SIZE;
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = skinnedSpritePixel(frame, x, y, mossling);
        if (!pixel) continue;
        if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) black += 1;
        else colored += 1;
        if (y < top) top = y;
      }
    }
    assert.ok(black >= 8, `frame ${frame} face`);
    assert.ok(colored >= 200, `frame ${frame} body`);
    tops.push(top);
  }
  const lifted = tops[0] ?? 0;
  const landed = tops[1] ?? 0;
  assert.ok(landed > lifted);
});
