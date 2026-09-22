"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import { foliageAt } from "@/lib/game-time";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import { cellVisualHash } from "@/lib/map-preview";
import {
  cellNeedsTerrainDetail,
  terrainDetailActive,
  terrainLookStamp,
  writeTerrainTile,
} from "@/lib/terrain-detail";
import type { FramePainter } from "./useGodWorld";

const RASTER_BUDGET = 120;

function healthBucket(health: number | undefined) {
  return health === undefined ? -1 : Math.round(health / 25);
}

export function TerrainDetail({
  map,
  camera,
  cameraRef,
  tileSize,
  elapsed,
  revisionRef,
  subscribeFrame,
}: {
  map: MapData;
  camera: Camera;
  cameraRef: { current: Camera | null };
  tileSize: number;
  elapsed: () => number;
  revisionRef: { current: number };
  subscribeFrame: (painter: FramePainter) => () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef(map);
  const elapsedRef = useRef(elapsed);
  const tileSizeRef = useRef(tileSize);
  const revision = useRef(revisionRef);
  mapRef.current = map;
  elapsedRef.current = elapsed;
  tileSizeRef.current = tileSize;
  revision.current = revisionRef;
  const shown = terrainDetailActive(tileSize);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!shown || !canvas || !context) return;
    let hashes = new Int32Array(0);
    let healths = new Int8Array(0);
    let looks = new Int32Array(0);
    let seen = new Uint8Array(0);
    let tile: ImageData | null = null;
    let seenRevision = -1;
    const render = () => {
      const view = cameraRef.current;
      const current = mapRef.current;
      if (!view) return;
      const bitmap = Math.max(1, Math.round(tileSizeRef.current));
      const width = current.width * bitmap;
      const height = current.height * bitmap;
      if (
        canvas.width !== width ||
        canvas.height !== height ||
        seen.length !== current.cells.length
      ) {
        canvas.width = width;
        canvas.height = height;
        context.imageSmoothingEnabled = false;
        hashes = new Int32Array(current.cells.length);
        healths = new Int8Array(current.cells.length);
        looks = new Int32Array(current.cells.length);
        seen = new Uint8Array(current.cells.length);
        tile = context.createImageData(bitmap, bitmap);
      }
      if (!tile) return;
      const look = foliageAt(elapsedRef.current());
      const lookStamp = terrainLookStamp(look);
      const nextRevision = revision.current?.current ?? 0;
      const revisionChanged = nextRevision !== seenRevision;
      const x0 = Math.max(0, Math.floor(view.x));
      const y0 = Math.max(0, Math.floor(view.y));
      const x1 = Math.min(current.width, Math.ceil(view.x + view.width));
      const y1 = Math.min(current.height, Math.ceil(view.y + view.height));
      let budget = RASTER_BUDGET;
      let stop = false;
      for (let y = y0; y < y1 && !stop; y++) {
        for (let x = x0; x < x1; x++) {
          const index = y * current.width + x;
          const cell = current.cells[index];
          if (!cell || !cellNeedsTerrainDetail(current, index, look)) {
            if (seen[index]) {
              context.clearRect(x * bitmap, y * bitmap, bitmap, bitmap);
              seen[index] = 0;
            }
            continue;
          }
          if (seen[index] && looks[index] === lookStamp && !revisionChanged)
            continue;
          const hash = cellVisualHash(cell);
          const health = healthBucket(cell.tree?.health);
          if (
            seen[index] &&
            looks[index] === lookStamp &&
            hashes[index] === hash &&
            healths[index] === health
          )
            continue;
          if (budget <= 0) {
            stop = true;
            break;
          }
          budget -= 1;
          if (writeTerrainTile(tile.data, current, index, bitmap, look))
            context.putImageData(tile, x * bitmap, y * bitmap);
          else context.clearRect(x * bitmap, y * bitmap, bitmap, bitmap);
          seen[index] = 1;
          hashes[index] = hash;
          healths[index] = health;
          looks[index] = lookStamp;
        }
      }
      if (!stop) seenRevision = nextRevision;
    };
    render();
    return subscribeFrame(render);
  }, [cameraRef, shown, subscribeFrame]);
  if (!shown) return null;
  const style: CSSProperties = {
    width: map.width * tileSize,
    height: map.height * tileSize,
    left: camera.left,
    top: camera.top,
  };
  return (
    <canvas
      ref={ref}
      style={style}
      className="terrain-detail"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
