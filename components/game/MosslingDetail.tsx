"use client";

import { useLayoutEffect, useRef } from "react";
import { foliageAt } from "@/lib/game-time";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import { type PreviewMossling, paintCell, TILE_SIZE } from "@/lib/map-preview";
import {
  circleColor,
  detailMode,
  FRAME_COUNT,
  faceFrame,
  mosslingInView,
  roundBounceOffset,
  SPRITE_SIZE,
  skinnedSpritePixel,
  spriteLookKey,
} from "@/lib/mossling-detail";
import {
  cellNeedsTerrainDetail,
  terrainDetailActive,
} from "@/lib/terrain-detail";
import type { FramePainter } from "./useGodWorld";

const SHEET_LIMIT = 256;

function sheetFor(
  sheets: Map<string, HTMLCanvasElement>,
  mossling: PreviewMossling,
) {
  const key = spriteLookKey(mossling);
  const cached = sheets.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = skinnedSpritePixel(frame, x, y, mossling);
        if (!pixel) continue;
        const offset = ((frame * SPRITE_SIZE + y) * SPRITE_SIZE + x) * 4;
        image.data[offset] = pixel[0];
        image.data[offset + 1] = pixel[1];
        image.data[offset + 2] = pixel[2];
        image.data[offset + 3] = pixel[3];
      }
    }
  }
  sprite.putImageData(image, 0, 0);
  if (sheets.size >= SHEET_LIMIT) {
    const oldest = sheets.keys().next().value;
    if (oldest !== undefined) sheets.delete(oldest);
  }
  sheets.set(key, canvas);
  return canvas;
}

function circleSprite(
  sheets: Map<string, HTMLCanvasElement>,
  mossling: PreviewMossling,
  tileSize: number,
) {
  const bitmap = Math.max(1, Math.round(tileSize));
  const dead = (mossling.health ?? 100) <= 0;
  const key = dead ? `dead|${bitmap}` : `${spriteLookKey(mossling)}|${bitmap}`;
  const cached = sheets.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap;
  canvas.height = bitmap;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(bitmap, bitmap);
  for (let y = 0; y < bitmap; y++) {
    for (let x = 0; x < bitmap; x++) {
      const color = circleColor(mossling, x, y, bitmap);
      if (!color) continue;
      const value = Number.parseInt(color.slice(1), 16);
      const offset = (y * bitmap + x) * 4;
      image.data[offset] = (value >> 16) & 255;
      image.data[offset + 1] = (value >> 8) & 255;
      image.data[offset + 2] = value & 255;
      image.data[offset + 3] = 255;
    }
  }
  sprite.putImageData(image, 0, 0);
  if (sheets.size >= SHEET_LIMIT) {
    const oldest = sheets.keys().next().value;
    if (oldest !== undefined) sheets.delete(oldest);
  }
  sheets.set(key, canvas);
  return canvas;
}

function discSprite(
  discs: Map<string, HTMLCanvasElement>,
  kind: "ring" | "tint",
  tileSize: number,
) {
  const bitmap = Math.max(1, Math.round(tileSize));
  const key = `${kind}|${bitmap}`;
  const cached = discs.get(key);
  if (cached) return cached;
  const pad = kind === "ring" ? 1 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap + pad * 2;
  canvas.height = bitmap + pad * 2;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  const cx = pad + bitmap / 2;
  const cy = pad + bitmap / 2;
  const outer = kind === "ring" ? bitmap / 2 + 0.5 : bitmap / 2;
  const inner = kind === "ring" ? bitmap / 2 - 0.5 : 0;
  const red = kind === "ring" ? 0x1a : 255;
  const green = kind === "ring" ? 0x14 : 225;
  const blue = kind === "ring" ? 0x00 : 40;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist > outer || dist < inner) continue;
      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = 255;
    }
  }
  sprite.putImageData(image, 0, 0);
  discs.set(key, canvas);
  return canvas;
}

export function MosslingDetail({
  map,
  mosslings,
  cameraRef,
  tileSize,
  width,
  height,
  elapsed,
  highlightRef,
  subscribeFrame,
}: {
  map: MapData;
  mosslings: PreviewMossling[];
  cameraRef: { current: Camera | null };
  tileSize: number;
  width: number;
  height: number;
  elapsed: () => number;
  highlightRef: { current: Set<number> };
  subscribeFrame: (painter: FramePainter) => () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef(map);
  const mosslingsRef = useRef(mosslings);
  const elapsedRef = useRef(elapsed);
  const tileSizeRef = useRef(tileSize);
  mapRef.current = map;
  mosslingsRef.current = mosslings;
  elapsedRef.current = elapsed;
  tileSizeRef.current = tileSize;
  const shown = width > 0 && height > 0 && detailMode(tileSize) !== "square";
  useLayoutEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!shown || !canvas || !context) return;
    const terrain = document.createElement("canvas");
    terrain.width = TILE_SIZE;
    terrain.height = TILE_SIZE;
    const terrainContext = terrain.getContext("2d");
    if (!terrainContext) return;
    const sheets = new Map<string, HTMLCanvasElement>();
    const circles = new Map<string, HTMLCanvasElement>();
    const discs = new Map<string, HTMLCanvasElement>();
    const render = () => {
      const camera = cameraRef.current;
      const current = mapRef.current;
      const elapsedNow = elapsedRef.current();
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!camera) return;
      context.imageSmoothingEnabled = false;
      const look = foliageAt(elapsedNow);
      const size = tileSizeRef.current;
      const mode = detailMode(size);
      for (const mossling of mosslingsRef.current) {
        if (!mosslingInView(mossling.cellIndex, current.width, camera))
          continue;
        const cellX = mossling.cellIndex % current.width;
        const cellY = Math.floor(mossling.cellIndex / current.width);
        const px = camera.left + cellX * size;
        const py = camera.top + cellY * size;
        const detailed =
          terrainDetailActive(size) &&
          cellNeedsTerrainDetail(current, mossling.cellIndex, look);
        if (!detailed) {
          terrainContext.setTransform(1, 0, 0, 1, 0, 0);
          terrainContext.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
          terrainContext.setTransform(
            1,
            0,
            0,
            1,
            -cellX * TILE_SIZE,
            -cellY * TILE_SIZE,
          );
          paintCell(
            terrainContext,
            current,
            mossling.cellIndex,
            TILE_SIZE,
            look,
          );
          terrainContext.setTransform(1, 0, 0, 1, 0, 0);
          context.drawImage(
            terrain,
            0,
            0,
            TILE_SIZE,
            TILE_SIZE,
            px,
            py,
            size,
            size,
          );
        }
        const bob =
          mode === "round"
            ? roundBounceOffset(mossling.id, elapsedNow, mossling.health ?? 100)
            : 0;
        const bounce =
          mode === "sprite" ? faceFrame(mossling, elapsedNow) : null;
        const bitmap = bounce === null ? null : sheetFor(sheets, mossling);
        const top = py + bob;
        if (bitmap && bounce !== null) {
          context.drawImage(
            bitmap,
            0,
            bounce * SPRITE_SIZE,
            SPRITE_SIZE,
            SPRITE_SIZE,
            px,
            top,
            size,
            size,
          );
        } else {
          const circle = circleSprite(circles, mossling, size);
          if (circle) context.drawImage(circle, px, top, size, size);
        }
        if (highlightRef.current.has(mossling.id)) {
          const tint = discSprite(discs, "tint", size);
          if (tint) {
            context.globalAlpha = 0.42;
            context.drawImage(tint, px, top, size, size);
            context.globalAlpha = 1;
          }
        }
        if (mode === "round") {
          const ring = discSprite(discs, "ring", size);
          if (ring)
            context.drawImage(ring, px - 1, top - 1, size + 2, size + 2);
        }
      }
    };
    render();
    return subscribeFrame(render);
  }, [cameraRef, highlightRef, shown, subscribeFrame]);
  if (!shown) return null;
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="mossling-detail"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
