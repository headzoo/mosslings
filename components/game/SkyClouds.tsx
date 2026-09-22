"use client";

import { useEffect, useRef } from "react";
import type { Camera } from "@/lib/map-camera";
import { type SkyCloud, skyCloudsAt } from "@/lib/sky-clouds";

const BODY = "#d2e0e4";
const SHADE = "#889ead";
const SHADOW = "#102018";

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

function paint(
  context: CanvasRenderingContext2D,
  camera: Camera,
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  x: number,
  y: number,
  color: string,
  alpha: number,
) {
  const px = Math.round(camera.left + x * tileSize);
  const py = Math.round(camera.top + y * tileSize);
  if (
    px > viewWidth ||
    py > viewHeight ||
    px + tileSize < 0 ||
    py + tileSize < 0
  )
    return;
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(px, py, Math.max(1, tileSize), Math.max(1, tileSize));
}

function drawCloud(
  context: CanvasRenderingContext2D,
  camera: Camera,
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  cloud: SkyCloud,
) {
  const shape = SHAPES[cloud.silhouette] ?? SHAPES[0];
  const rows = shape.slice(Math.max(0, shape.length - cloud.height));
  const bottom = rows[rows.length - 1];
  const x0 = Math.floor(bottom[0] * cloud.width);
  const x1 = Math.max(x0, Math.ceil(bottom[1] * cloud.width) - 1);
  for (let row = 1; row <= 2; row++) {
    for (let col = x0 - 1; col <= x1 + 1; col++) {
      paint(
        context,
        camera,
        tileSize,
        viewWidth,
        viewHeight,
        cloud.x + col,
        cloud.y + cloud.height - 1 + row,
        SHADOW,
        0.16,
      );
    }
  }
  rows.forEach((span, row) => {
    const left = Math.floor(span[0] * cloud.width);
    const right = Math.max(left, Math.ceil(span[1] * cloud.width) - 1);
    const color = row === rows.length - 1 ? SHADE : BODY;
    for (let col = left; col <= right; col++) {
      paint(
        context,
        camera,
        tileSize,
        viewWidth,
        viewHeight,
        cloud.x + col,
        cloud.y + row,
        color,
        0.88,
      );
    }
  });
}

export function SkyClouds({
  seed,
  mapWidth,
  mapHeight,
  camera,
  tileSize,
  width,
  height,
  elapsed,
}: {
  seed: number;
  mapWidth: number;
  mapHeight: number;
  camera: Camera;
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
    let frame = 0;
    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const cloud of skyCloudsAt(
        elapsedRef.current(),
        seed,
        mapWidth,
        mapHeight,
      )) {
        drawCloud(context, camera, tileSize, width, height, cloud);
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [seed, mapWidth, mapHeight, camera, tileSize, width, height]);
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
