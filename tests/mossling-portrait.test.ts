import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewMossling } from "../lib/map-preview";
import {
  opaqueBounds,
  PORTRAIT_BOUNCE_SECONDS,
  PORTRAIT_FACE_DARK,
  PORTRAIT_FACE_GLINT,
  PORTRAIT_FRAME_COUNT,
  portraitBounceFrame,
  portraitLookKey,
  skinPortrait,
} from "../lib/mossling-portrait";

if (typeof ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace = "srgb";
    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight?: number,
      height?: number,
    ) {
      if (typeof dataOrWidth === "number") {
        this.width = dataOrWidth;
        this.height = widthOrHeight ?? 0;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight ?? 0;
        this.height = height ?? dataOrWidth.length / 4 / this.width;
      }
    }
  } as typeof ImageData;
}

function living(id = 3): PreviewMossling {
  return {
    id,
    cellIndex: 0,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
  };
}

function grayFrame(
  width: number,
  height: number,
  body: { minX: number; minY: number; maxX: number; maxY: number },
  marks: { x: number; y: number; rgb: [number, number, number] }[] = [],
) {
  const image = new ImageData(width, height);
  for (let y = body.minY; y <= body.maxY; y++) {
    for (let x = body.minX; x <= body.maxX; x++) {
      const offset = (y * width + x) * 4;
      image.data[offset] = 120;
      image.data[offset + 1] = 120;
      image.data[offset + 2] = 120;
      image.data[offset + 3] = 255;
    }
  }
  for (const mark of marks) {
    const offset = (mark.y * width + mark.x) * 4;
    image.data[offset] = mark.rgb[0];
    image.data[offset + 1] = mark.rgb[1];
    image.data[offset + 2] = mark.rgb[2];
    image.data[offset + 3] = 255;
  }
  return image;
}

function pixel(
  image: ImageData,
  x: number,
  y: number,
): [number, number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [
    image.data[offset] ?? 0,
    image.data[offset + 1] ?? 0,
    image.data[offset + 2] ?? 0,
    image.data[offset + 3] ?? 0,
  ];
}

test("overlay colors gray body and leaves dark and white face pixels", () => {
  const base = grayFrame(16, 16, { minX: 2, minY: 2, maxX: 13, maxY: 13 }, [
    { x: 6, y: 6, rgb: [10, 10, 10] },
    { x: 7, y: 6, rgb: [255, 255, 255] },
  ]);
  const skinned = skinPortrait(base, living());
  const body = pixel(skinned, 4, 4);
  assert.equal(body[3], 255);
  assert.notEqual(body[0], 120);
  assert.deepEqual(pixel(skinned, 6, 6), [10, 10, 10, 255]);
  assert.deepEqual(pixel(skinned, 7, 6), [255, 255, 255, 255]);
  assert.equal(pixel(skinned, 0, 0)[3], 0);
  assert.ok(PORTRAIT_FACE_DARK < 40);
  assert.ok(PORTRAIT_FACE_GLINT > 200);
});

test("partial alpha fringe stays colored and keeps its alpha", () => {
  const base = new ImageData(4, 4);
  const fringe = (1 * 4 + 1) * 4;
  base.data[fringe] = 120;
  base.data[fringe + 1] = 120;
  base.data[fringe + 2] = 120;
  base.data[fringe + 3] = 80;
  const skinned = skinPortrait(base, living());
  const pixelFringe = pixel(skinned, 1, 1);
  assert.equal(pixelFringe[3], 80);
  assert.notEqual(pixelFringe[0], 120);
  assert.deepEqual(pixel(skinned, 0, 0), [0, 0, 0, 0]);
});

test("dead portraits turn the whole silhouette black", () => {
  const base = grayFrame(8, 8, { minX: 1, minY: 1, maxX: 6, maxY: 6 }, [
    { x: 3, y: 3, rgb: [255, 255, 255] },
  ]);
  const skinned = skinPortrait(base, { ...living(), health: 0 });
  assert.deepEqual(pixel(skinned, 2, 2), [17, 17, 17, 255]);
  assert.deepEqual(pixel(skinned, 3, 3), [17, 17, 17, 255]);
  assert.equal(pixel(skinned, 0, 0)[3], 0);
});

test("pattern mapping uses the opaque silhouette box", () => {
  const left = grayFrame(16, 16, { minX: 0, minY: 0, maxX: 7, maxY: 7 });
  const right = grayFrame(16, 16, { minX: 8, minY: 8, maxX: 15, maxY: 15 });
  const mossling = living();
  const leftSkin = skinPortrait(left, mossling);
  const rightSkin = skinPortrait(right, mossling);
  assert.deepEqual(opaqueBounds(left), {
    minX: 0,
    minY: 0,
    maxX: 7,
    maxY: 7,
  });
  assert.deepEqual(opaqueBounds(right), {
    minX: 8,
    minY: 8,
    maxX: 15,
    maxY: 15,
  });
  // The same relative cell in each box wears the same pattern color.
  assert.deepEqual(pixel(leftSkin, 0, 0), pixel(rightSkin, 8, 8));
  assert.deepEqual(pixel(leftSkin, 7, 7), pixel(rightSkin, 15, 15));
});

test("bounce frames wrap, desync neighbors, and freeze the dead", () => {
  assert.equal(portraitBounceFrame(0, 0), 0);
  const span = PORTRAIT_BOUNCE_SECONDS / PORTRAIT_FRAME_COUNT;
  assert.equal(portraitBounceFrame(0, span * 1.5), 1);
  assert.equal(portraitBounceFrame(0, PORTRAIT_BOUNCE_SECONDS), 0);
  assert.notEqual(portraitBounceFrame(0, 0.2), portraitBounceFrame(1, 0.2));
  assert.equal(portraitBounceFrame(4, 0.4, 0), 0);
  const seen = new Set<number>();
  for (let i = 0; i < PORTRAIT_FRAME_COUNT; i++) {
    seen.add(portraitBounceFrame(0, (i + 0.5) * span));
  }
  assert.equal(seen.size, PORTRAIT_FRAME_COUNT);
  assert.equal(portraitBounceFrame(0, span * 1.5, 100, 5), 0);
});

test("look keys ignore live health but mark the dead", () => {
  const a = living();
  const b = { ...living(), health: 40 };
  const dead = { ...living(), health: 0 };
  assert.equal(portraitLookKey(a), portraitLookKey(b));
  assert.notEqual(portraitLookKey(a), portraitLookKey(dead));
});

test("plague tints the body puke-green without darkening the face", () => {
  const base = grayFrame(16, 16, { minX: 2, minY: 2, maxX: 13, maxY: 13 }, [
    { x: 6, y: 6, rgb: [10, 10, 10] },
  ]);
  const healthy = skinPortrait(base, living());
  const sick = skinPortrait(base, { ...living(), plagueMonths: 5 });
  const bodyHealthy = pixel(healthy, 4, 4);
  const bodySick = pixel(sick, 4, 4);
  assert.ok(bodySick[1] > bodyHealthy[1]);
  assert.ok(bodySick[2] < bodyHealthy[2]);
  assert.deepEqual(pixel(sick, 6, 6), [10, 10, 10, 255]);
});
