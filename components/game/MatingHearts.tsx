"use client";

import { useEffect, useRef } from "react";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import { HEART_COLOR, HEART_ROWS, heartsInView } from "@/lib/mating-hearts";
import type { FramePainter } from "./useGodWorld";

const HEART_WIDTH = HEART_ROWS[0].length;
const HEART_HEIGHT = HEART_ROWS.length;

function onScreen(
  px: number,
  py: number,
  size: number,
  viewWidth: number,
  viewHeight: number,
) {
  return !(
    px >= viewWidth ||
    py >= viewHeight ||
    px + size <= 0 ||
    py + size <= 0
  );
}

function drawMark(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  alpha: number,
  viewWidth: number,
  viewHeight: number,
) {
  if (alpha <= 0.01) return;
  const left = Math.round(cx - size / 2);
  const top = Math.round(cy - size / 2);
  if (!onScreen(left, top, size, viewWidth, viewHeight)) return;
  context.globalAlpha = alpha;
  if (size <= 1) {
    context.fillRect(left, top, 1, 1);
    return;
  }
  for (let y = 0; y < size; y++) {
    const row =
      HEART_ROWS[
        Math.min(HEART_HEIGHT - 1, Math.floor((y * HEART_HEIGHT) / size))
      ];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      const column = Math.min(
        HEART_WIDTH - 1,
        Math.floor((x * HEART_WIDTH) / size),
      );
      if (row[column] !== "1") continue;
      context.fillRect(left + x, top + y, 1, 1);
    }
  }
}

export function MatingHearts({
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
  mapRef.current = map;
  mosslingsRef.current = mosslings;
  elapsedRef.current = elapsed;
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let clear = true;
    const render = () => {
      const camera = cameraRef.current;
      if (!camera) {
        if (!clear) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          clear = true;
        }
        return;
      }
      const marks = heartsInView(
        mosslingsRef.current,
        mapRef.current.width,
        camera,
        tileSize,
        elapsedRef.current(),
      );
      if (!marks.length) {
        if (!clear) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          clear = true;
        }
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      clear = false;
      context.imageSmoothingEnabled = false;
      context.fillStyle = HEART_COLOR;
      for (const mark of marks) {
        drawMark(
          context,
          camera.left + mark.x * tileSize,
          camera.top + mark.y * tileSize,
          mark.size,
          mark.alpha,
          width,
          height,
        );
      }
      context.globalAlpha = 1;
    };
    return subscribeFrame(render);
  }, [cameraRef, subscribeFrame, tileSize, width, height]);
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
