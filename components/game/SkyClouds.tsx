"use client";

import { useEffect, useRef } from "react";
import type { Camera } from "@/lib/map-camera";
import { type SkyCloud, skyCloudsAt } from "@/lib/sky-clouds";

const BODY = "#d2e0e4";
const SHADE = "#889ead";
const SHADOW = "#102018";
const cloudSprites = new Map<string, HTMLCanvasElement>();

/** Inclusive column spans as fractions of the cloud width, top to bottom. */
const SHAPES: Array<Array<[number, number]>> = [
  [
    [0.28, 0.72],
    [0.1, 0.9],
    [0, 1],
    [0, 1],
  ],
  [
    [0.18, 0.62],
    [0.05, 0.88],
    [0, 1],
  ],
  [
    [0.38, 0.84],
    [0.12, 0.96],
    [0.04, 0.92],
    [0, 1],
  ],
];

function stamp(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  alpha: number,
) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x, y, 1, 1);
}

/** One pixel per tile, including the shadow pad, reused for every copy of this shape. */
function cloudSprite(cloud: SkyCloud): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = `${cloud.silhouette}:${cloud.width}:${cloud.height}`;
  const cached = cloudSprites.get(key);
  if (cached) return cached;
  const shape = SHAPES[cloud.silhouette] ?? SHAPES[0];
  const rows = shape.slice(Math.max(0, shape.length - cloud.height));
  const pad = 1;
  const canvas = document.createElement("canvas");
  canvas.width = cloud.width + pad * 2;
  canvas.height = cloud.height + 2;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const bottom = rows[rows.length - 1];
  const x0 = Math.floor(bottom[0] * cloud.width);
  const x1 = Math.max(x0, Math.ceil(bottom[1] * cloud.width) - 1);
  for (let row = 1; row <= 2; row++) {
    for (let col = x0 - 1; col <= x1 + 1; col++) {
      stamp(sprite, col + pad, cloud.height - 1 + row, SHADOW, 0.16);
    }
  }
  rows.forEach((span, row) => {
    const left = Math.floor(span[0] * cloud.width);
    const right = Math.max(left, Math.ceil(span[1] * cloud.width) - 1);
    const color = row === rows.length - 1 ? SHADE : BODY;
    for (let col = left; col <= right; col++)
      stamp(sprite, col + pad, row, color, 0.88);
  });
  sprite.globalAlpha = 1;
  cloudSprites.set(key, canvas);
  return canvas;
}

function drawCloud(
  context: CanvasRenderingContext2D,
  camera: Camera,
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  cloud: SkyCloud,
) {
  const sprite = cloudSprite(cloud);
  if (!sprite) return;
  const px = Math.round(camera.left + (cloud.x - 1) * tileSize);
  const py = Math.round(camera.top + cloud.y * tileSize);
  const width = sprite.width * tileSize;
  const height = sprite.height * tileSize;
  if (px > viewWidth || py > viewHeight || px + width < 0 || py + height < 0)
    return;
  context.drawImage(sprite, px, py, width, height);
}

export function SkyClouds({
  seed,
  mapWidth,
  mapHeight,
  cameraRef,
  tileSize,
  width,
  height,
  elapsed,
}: {
  seed: number;
  mapWidth: number;
  mapHeight: number;
  cameraRef: { current: Camera | null };
  tileSize: number;
  width: number;
  height: number;
  elapsed: () => number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    let frame = 0;
    let clear = true;
    const render = () => {
      const camera = cameraRef.current;
      const clouds = skyCloudsAt(
        elapsedRef.current(),
        seed,
        mapWidth,
        mapHeight,
      );
      if (!camera || clouds.length === 0) {
        if (!clear) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.globalAlpha = 1;
          clear = true;
        }
        frame = requestAnimationFrame(render);
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      clear = false;
      for (const cloud of clouds)
        drawCloud(context, camera, tileSize, width, height, cloud);
      context.globalAlpha = 1;
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [seed, mapWidth, mapHeight, cameraRef, tileSize, width, height]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="god-effects"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
