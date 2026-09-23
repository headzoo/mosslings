"use client";

import { useEffect, useRef } from "react";
import type { Camera } from "@/lib/map-camera";
import { type SkyBird, skyBirdsAt } from "@/lib/sky-birds";
import type { FramePainter } from "./useGodWorld";

const BODY = "#1e1a16";
const WING = "#6b5344";

/** Normal zoom. A 16px sprite is 16 screen pixels here, and scales with the map. */
const NORMAL_TILE = 8;
const SPRITE = 16;

const birdSprites = new Map<number, HTMLCanvasElement>();

/**
 * 16×16 poses. The body stays put; the wings move.
 * `b` body, `w` wing.
 */
const POSES = [
  [
    "................",
    "................",
    "..ww........ww..",
    "...ww......ww...",
    "....ww....ww....",
    ".....w....w.....",
    "......w..w......",
    "......bbbbbbb...",
    ".....bbbbbb.....",
    "......bbbb......",
    ".......bb.......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "www..........www",
    "www...bbbbbbb.ww",
    "www..bbbbbb..www",
    "ww....bbbb....ww",
    ".......bb.......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......bbbbbbb...",
    ".....bbbbbb.....",
    "......bbbb......",
    ".......bb.......",
    "......w..w......",
    ".....w....w.....",
    "....ww....ww....",
    "...ww......ww...",
    "..ww........ww..",
  ],
];

function birdSprite(pose: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const cached = birdSprites.get(pose);
  if (cached) return cached;
  const rows = POSES[pose] ?? POSES[0];
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE;
  canvas.height = SPRITE;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length && x < SPRITE; x++) {
      const pixel = row[x];
      if (pixel !== "b" && pixel !== "w") continue;
      sprite.fillStyle = pixel === "b" ? BODY : WING;
      sprite.fillRect(x, y, 1, 1);
    }
  });
  birdSprites.set(pose, canvas);
  return canvas;
}

function drawBird(
  context: CanvasRenderingContext2D,
  camera: Camera,
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  bird: SkyBird,
) {
  const sprite = birdSprite(bird.pose);
  if (!sprite) return;
  const scale = tileSize / NORMAL_TILE;
  const size = SPRITE * scale;
  const px = Math.round(camera.left + bird.x * tileSize - size / 2);
  const py = Math.round(camera.top + bird.y * tileSize - size / 2);
  if (px > viewWidth || py > viewHeight || px + size < 0 || py + size < 0)
    return;
  context.drawImage(sprite, px, py, size, size);
}

export function SkyBirds({
  seed,
  mapWidth,
  mapHeight,
  cameraRef,
  tileSize,
  width,
  height,
  elapsed,
  subscribeFrame,
}: {
  seed: number;
  mapWidth: number;
  mapHeight: number;
  cameraRef: { current: Camera | null };
  tileSize: number;
  width: number;
  height: number;
  elapsed: () => number;
  subscribeFrame: (painter: FramePainter) => () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    let clear = true;
    const render = () => {
      const camera = cameraRef.current;
      const birds = skyBirdsAt(elapsedRef.current(), seed, mapWidth, mapHeight);
      if (!camera || birds.length === 0) {
        if (!clear) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          clear = true;
        }
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      clear = false;
      birds.sort((a, b) => a.y - b.y || a.x - b.x);
      for (const bird of birds)
        drawBird(context, camera, tileSize, width, height, bird);
    };
    return subscribeFrame(render);
  }, [
    seed,
    mapWidth,
    mapHeight,
    cameraRef,
    subscribeFrame,
    tileSize,
    width,
    height,
  ]);
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
