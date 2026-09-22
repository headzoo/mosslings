import assert from "node:assert/strict";
import test from "node:test";
import { plagueBounceScale } from "../lib/god/disease";
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
  SHOVEL_FRAME_COUNT,
  SHOVEL_SECONDS,
  SPLASH_FRAME_COUNT,
  SPLASH_SECONDS,
  SPRITE_SIZE,
  shovelFrame,
  skinnedKitePixel,
  skinnedShovelPixel,
  skinnedSplashPixel,
  skinnedSpritePixel,
  splashFrame,
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

const CARROT_ORANGE = [232, 120, 32] as const;
const CARROT_TIP = [196, 72, 24] as const;
const CARROT_LEAF = [84, 163, 46] as const;
const CARROT_LEAF_SHADE = [61, 154, 52] as const;

function pixelRgb(pixel: readonly [number, number, number, number]) {
  return [pixel[0], pixel[1], pixel[2]] as const;
}

function sameRgb(
  pixel: readonly [number, number, number, number],
  rgb: readonly [number, number, number],
) {
  return pixel[0] === rgb[0] && pixel[1] === rgb[1] && pixel[2] === rgb[2];
}

function isCarrotOrange(pixel: readonly [number, number, number, number]) {
  return sameRgb(pixel, CARROT_ORANGE) || sameRgb(pixel, CARROT_TIP);
}

function isCarrotLeaf(pixel: readonly [number, number, number, number]) {
  return sameRgb(pixel, CARROT_LEAF) || sameRgb(pixel, CARROT_LEAF_SHADE);
}

test("pull frames yank through six poses and toss carrots overhead", () => {
  const mossling = living();
  const sick = { ...mossling, plagueMonths: 5 };
  const step = SHOVEL_SECONDS / SHOVEL_FRAME_COUNT;
  assert.equal(shovelFrame(0, 0), 0);
  assert.equal(shovelFrame(0, step), 1);
  assert.equal(shovelFrame(0, SHOVEL_SECONDS), 0);
  assert.equal(shovelFrame(0, step * 5), 5);
  assert.notEqual(shovelFrame(0, 0), shovelFrame(1, 0));
  assert.equal(shovelFrame(0, step, 5), 0);
  assert.equal(shovelFrame(0, step * plagueBounceScale(5), 5), 1);
  const masks = new Set<string>();
  let flying = false;
  let orangeHeld = false;
  for (let frame = 0; frame < SHOVEL_FRAME_COUNT; frame++) {
    assert.equal(skinnedShovelPixel(frame, 0, 0, mossling), null);
    let mask = "";
    let bodyTop = SPRITE_SIZE;
    let orange = false;
    let green = false;
    const carrotRows: number[] = [];
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = skinnedShovelPixel(frame, x, y, mossling);
        mask += pixel ? "1" : "0";
        if (!pixel) continue;
        const ill = skinnedShovelPixel(frame, x, y, sick);
        if (isCarrotOrange(pixel)) {
          orange = true;
          carrotRows.push(y);
          assert.deepEqual(pixelRgb(ill ?? pixel), pixelRgb(pixel));
          orangeHeld = true;
        } else if (isCarrotLeaf(pixel)) {
          green = true;
          carrotRows.push(y);
          assert.deepEqual(pixelRgb(ill ?? pixel), pixelRgb(pixel));
        } else if (y < bodyTop) bodyTop = y;
      }
    }
    masks.add(mask);
    assert.ok(orange, `frame ${frame} carrot`);
    assert.ok(green, `frame ${frame} leaves`);
    if (carrotRows.some((row) => row < bodyTop)) flying = true;
  }
  assert.equal(masks.size, SHOVEL_FRAME_COUNT);
  assert.ok(flying);
  assert.ok(orangeHeld);
});

test("splash frames keep the body above the water and stick snub arms out", () => {
  const mossling = living();
  const step = SPLASH_SECONDS / SPLASH_FRAME_COUNT;
  assert.equal(splashFrame(0, 0), 0);
  assert.equal(splashFrame(0, step), 1);
  assert.equal(splashFrame(0, SPLASH_SECONDS), 0);
  assert.notEqual(splashFrame(0, 0), splashFrame(1, 0));
  const masks = new Set<string>();
  for (let frame = 0; frame < SPLASH_FRAME_COUNT; frame++) {
    let mask = "";
    let above = false;
    let leftArm = false;
    let rightArm = false;
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = skinnedSplashPixel(frame, x, y, mossling);
        if (y >= 20) assert.equal(pixel, null);
        else if (pixel) above = true;
        if (pixel && pixel[2] < 250 && x <= 5) leftArm = true;
        if (pixel && pixel[2] < 250 && x >= 26) rightArm = true;
        mask += pixel ? "1" : "0";
      }
    }
    assert.equal(above, true);
    assert.equal(leftArm, true, `frame ${frame} left arm`);
    assert.equal(rightArm, true, `frame ${frame} right arm`);
    masks.add(mask);
  }
  assert.equal(masks.size, SPLASH_FRAME_COUNT);
});

test("plague stretches the sprite bounce as infection deepens", () => {
  const step = BOUNCE_SECONDS / FRAME_COUNT;
  assert.equal(bounceFrame(0, step), 1);
  assert.equal(bounceFrame(0, step, 0), 0);
  assert.equal(bounceFrame(0, step, 5), 0);
  assert.equal(faceFrame({ id: 0, health: 100, plagueMonths: 5 }, step), 0);
  assert.equal(bounceFrame(0, step * plagueBounceScale(5), 5), 1);
  const healthyHop = roundBounceOffset(0, ROUND_BOUNCE_SECONDS / 4);
  const sickHop = roundBounceOffset(0, ROUND_BOUNCE_SECONDS / 4, 100, 5);
  assert.ok(Math.abs(sickHop) < Math.abs(healthyHop));
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

test("plague tints sprite bodies puke-green and leaves the face black", () => {
  const healthy = living();
  const sick = { ...healthy, plagueMonths: 5 };
  let greener = false;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const before = skinnedSpritePixel(0, x, y, healthy);
      const after = skinnedSpritePixel(0, x, y, sick);
      if (!before || !after) continue;
      if (before[0] === 0 && before[1] === 0 && before[2] === 0) {
        assert.deepEqual(after, before);
        continue;
      }
      if (after[1] > before[1] && after[2] <= before[2]) greener = true;
    }
  }
  assert.ok(greener);
});

test("kite frames raise nub arms the bounce does not have", () => {
  const mossling = living();
  const tops: number[] = [];
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    let left = false;
    let right = false;
    let top = SPRITE_SIZE;
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const arm = skinnedKitePixel(frame, x, y, mossling);
        const body = skinnedSpritePixel(frame, x, y, mossling);
        if (body) {
          assert.ok(arm);
          continue;
        }
        if (!arm) continue;
        assert.ok(arm[0] + arm[1] + arm[2] > 0);
        if (y < top) top = y;
        if (x < 12) left = true;
        if (x > 19) right = true;
      }
    }
    assert.equal(left, true, `frame ${frame} left nub`);
    assert.equal(right, true, `frame ${frame} right nub`);
    tops.push(top);
  }
  const lifted = tops[2] ?? 0;
  const landed = tops[1] ?? 0;
  assert.ok(lifted < landed);
});

function rgbOf(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
}

test("map cells go puke-green on infection and greener as they sicken", () => {
  const healthy = living();
  const sick = { ...healthy, plagueMonths: 0 };
  const sicker = { ...healthy, plagueMonths: 5 };
  const before = rgbOf(paintedMosslingColor(healthy, 0, 0));
  const after = rgbOf(paintedMosslingColor(sick, 0, 0));
  const worst = rgbOf(paintedMosslingColor(sicker, 0, 0));
  assert.ok(after[1] > before[1]);
  assert.ok(after[2] < before[2]);
  assert.ok(worst[1] >= after[1]);
  assert.ok(worst[2] <= after[2]);
  assert.notEqual(
    paintedMosslingColor(sick, 0, 0),
    paintedMosslingColor(healthy, 0, 0),
  );
});
