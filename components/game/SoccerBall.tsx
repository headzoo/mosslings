"use client";

import { useEffect, useRef } from "react";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import {
  ballsInView,
  SOCCER_BALL_INK,
  SOCCER_BALL_ROWS,
  SOCCER_BALL_WHITE,
} from "@/lib/soccer";
import type { FramePainter } from "./useGodWorld";

const BALL_WIDTH = SOCCER_BALL_ROWS[0].length;
const BALL_HEIGHT = SOCCER_BALL_ROWS.length;

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

function drawBall(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  viewWidth: number,
  viewHeight: number,
) {
  const left = Math.round(cx - size / 2);
  const top = Math.round(cy - size / 2);
  if (!onScreen(left, top, size, viewWidth, viewHeight)) return;
  if (size <= 1) {
    context.fillStyle = SOCCER_BALL_INK;
    context.fillRect(left, top, 1, 1);
    return;
  }
  for (let y = 0; y < size; y++) {
    const row =
      SOCCER_BALL_ROWS[
        Math.min(BALL_HEIGHT - 1, Math.floor((y * BALL_HEIGHT) / size))
      ];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      const column = Math.min(
        BALL_WIDTH - 1,
        Math.floor((x * BALL_WIDTH) / size),
      );
      const mark = row[column];
      if (mark === ".") continue;
      context.fillStyle = mark === "b" ? SOCCER_BALL_INK : SOCCER_BALL_WHITE;
      context.fillRect(left + x, top + y, 1, 1);
    }
  }
}

export function SoccerBall({
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
      const marks = ballsInView(
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
      for (const mark of marks) {
        drawBall(
          context,
          camera.left + mark.x * tileSize,
          camera.top + mark.y * tileSize,
          mark.size,
          width,
          height,
        );
      }
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
