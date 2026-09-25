"use client";

import { useEffect, useRef } from "react";
import { chattersInView } from "@/lib/chatter";
import {
  COUGH_FILL,
  COUGH_INK,
  SPEECH_FONT,
  SPEECH_POP_ROWS,
  SPEECH_ROWS,
} from "@/lib/cough";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
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

function drawBubble(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frame: number,
  alpha: number,
  width: number,
  height: number,
  text: string,
  viewWidth: number,
  viewHeight: number,
) {
  if (alpha <= 0.01) return;
  const left = Math.round(cx - width / 2);
  const top = Math.round(cy - height / 2);
  if (!onScreen(left, top, width, height, viewWidth, viewHeight)) return;
  const rows = frame === 0 ? SPEECH_POP_ROWS : SPEECH_ROWS;
  const scale = rows.length > 0 ? height / rows.length : 1;
  context.globalAlpha = alpha;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const mark = row[x];
      if (mark !== "o" && mark !== "w") continue;
      context.fillStyle = mark === "w" ? COUGH_FILL : COUGH_INK;
      context.fillRect(left + x * scale, top + y * scale, scale, scale);
    }
  }
  context.imageSmoothingEnabled = true;
  context.font = SPEECH_FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = COUGH_INK;
  context.fillText(text, left + width / 2, top + height / 2);
  context.imageSmoothingEnabled = false;
}

export function ChatterBubbles({
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
      const marks = chattersInView(
        mosslingsRef.current,
        mapRef.current,
        camera,
        size,
        elapsedRef.current(),
      );
      if (!marks.length) return;
      context.imageSmoothingEnabled = false;
      for (const mark of marks) {
        drawBubble(
          context,
          camera.left + mark.x * size,
          camera.top + mark.y * size,
          mark.frame,
          mark.alpha,
          mark.width,
          mark.height,
          mark.text,
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
