"use client";

import { useEffect, useRef } from "react";
import { gameDateAt } from "@/lib/game-time";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import {
  type Pollinator,
  pollinatorPosition,
  pollinatorsActive,
  pollinatorsForMap,
  pollinatorVisible,
} from "@/lib/pollinators";

function onScreen(
  px: number,
  py: number,
  size: number,
  viewWidth: number,
  viewHeight: number,
) {
  return !(px > viewWidth || py > viewHeight || px + size < 0 || py + size < 0);
}

function paintPixel(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  viewWidth: number,
  viewHeight: number,
) {
  if (!onScreen(px, py, 1, viewWidth, viewHeight)) return;
  context.fillStyle = color;
  context.fillRect(px, py, 1, 1);
}

function drawBee(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  viewWidth: number,
  viewHeight: number,
) {
  paintPixel(context, px, py, "#f2c94c", viewWidth, viewHeight);
  paintPixel(context, px + 1, py, "#2a2010", viewWidth, viewHeight);
}

function drawButterfly(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  warm: boolean,
  viewWidth: number,
  viewHeight: number,
) {
  const wing = warm ? "#f2a03c" : "#8eb6e8";
  const tip = warm ? "#ffe566" : "#d4ecff";
  paintPixel(context, px - 1, py, wing, viewWidth, viewHeight);
  paintPixel(context, px + 1, py, wing, viewWidth, viewHeight);
  paintPixel(context, px, py, "#2a2010", viewWidth, viewHeight);
  paintPixel(context, px - 1, py - 1, tip, viewWidth, viewHeight);
  paintPixel(context, px + 1, py - 1, tip, viewWidth, viewHeight);
}

function drawPollinator(
  context: CanvasRenderingContext2D,
  camera: Camera,
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  pollinator: Pollinator,
  map: MapData,
  elapsed: number,
) {
  if (!pollinatorVisible(map, pollinator)) return;
  const point = pollinatorPosition(map, pollinator, elapsed);
  const px = Math.round(camera.left + point.x * tileSize);
  const py = Math.round(camera.top + point.y * tileSize);
  if (pollinator.kind === "bee") {
    drawBee(context, px, py, viewWidth, viewHeight);
    return;
  }
  drawButterfly(
    context,
    px,
    py,
    pollinator.palette === 0,
    viewWidth,
    viewHeight,
  );
}

export function Pollinators({
  map,
  camera,
  tileSize,
  width,
  height,
  elapsed,
}: {
  map: MapData;
  camera: Camera;
  tileSize: number;
  width: number;
  height: number;
  elapsed: () => number;
  revisionRef?: { current: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  const mapRef = useRef(map);
  const pollinatorsRef = useRef<Pollinator[]>(pollinatorsForMap(map));
  elapsedRef.current = elapsed;
  mapRef.current = map;
  useEffect(() => {
    pollinatorsRef.current = pollinatorsForMap(map);
  }, [map]);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const current = mapRef.current;
      const season = gameDateAt(elapsedRef.current()).season;
      if (!pollinatorsActive(season)) {
        frame = requestAnimationFrame(render);
        return;
      }
      context.globalAlpha = 1;
      for (const pollinator of pollinatorsRef.current) {
        drawPollinator(
          context,
          camera,
          tileSize,
          width,
          height,
          pollinator,
          current,
          elapsedRef.current(),
        );
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [camera, tileSize, width, height]);
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
