"use client";

import { useEffect, useRef } from "react";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import {
  NOTE_HEIGHT,
  NOTE_ROWS,
  NOTE_WIDTH,
  WHISTLE_INK,
  whistlesInView,
} from "@/lib/whistle";
import type { FramePainter } from "./useGodWorld";

function onScreen(
  px: number,
  py: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
) {
  return !(
    px >= viewWidth ||
    py >= viewHeight ||
    px + width <= 0 ||
    py + height <= 0
  );
}

function drawNote(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  alpha: number,
  viewWidth: number,
  viewHeight: number,
) {
  if (alpha <= 0.01) return;
  const left = Math.round(cx - width / 2);
  const top = Math.round(cy - height / 2);
  if (!onScreen(left, top, width, height, viewWidth, viewHeight)) return;
  context.globalAlpha = alpha;
  if (width <= 1 && height <= 1) {
    context.fillRect(left, top, 1, 1);
    return;
  }
  for (let y = 0; y < height; y++) {
    const row =
      NOTE_ROWS[
        Math.min(NOTE_HEIGHT - 1, Math.floor((y * NOTE_HEIGHT) / height))
      ];
    if (!row) continue;
    for (let x = 0; x < width; x++) {
      const column = Math.min(
        NOTE_WIDTH - 1,
        Math.floor((x * NOTE_WIDTH) / width),
      );
      if (row[column] !== "1") continue;
      context.fillRect(left + x, top + y, 1, 1);
    }
  }
}

export function WhistleNotes({
  map,
  mosslings,
  cameraRef,
  tileSize,
  width,
  height,
  elapsed,
  subscribeFrame,
}: {
  map: MapData;
  mosslings: PreviewMossling[];
  cameraRef: { current: Camera | null };
  tileSize: number;
  width: number;
  height: number;
  elapsed: () => number;
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
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const camera = cameraRef.current;
      if (!camera) return;
      const size = tileSizeRef.current;
      const marks = whistlesInView(
        mosslingsRef.current,
        mapRef.current.width,
        camera,
        size,
        elapsedRef.current(),
      );
      if (!marks.length) return;
      context.imageSmoothingEnabled = false;
      context.fillStyle = WHISTLE_INK;
      for (const mark of marks) {
        drawNote(
          context,
          camera.left + mark.x * size,
          camera.top + mark.y * size,
          mark.width,
          mark.height,
          mark.alpha,
          width,
          height,
        );
      }
      context.globalAlpha = 1;
    };
    return subscribeFrame(render);
  }, [cameraRef, subscribeFrame, width, height]);
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
