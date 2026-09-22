"use client";

import { useEffect, useRef } from "react";
import { gameDateAt } from "@/lib/game-time";
import { buildKiteShadowSheet } from "@/lib/kite-sprite";
import {
  fliesKite,
  KITE_SHADOW_TILES,
  kiteAnchor,
  kiteShadow,
  kiteSpriteTiles,
} from "@/lib/kites";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import { bounceFrame, SPRITE_SIZE } from "@/lib/mossling-detail";
import type { FramePainter } from "./useGodWorld";

function onScreen(
  px: number,
  py: number,
  size: number,
  viewWidth: number,
  viewHeight: number,
) {
  return !(px > viewWidth || py > viewHeight || px + size < 0 || py + size < 0);
}

const KITE_SRC = "/mosslings/icons/kite.png";

function drawShadowFrame(
  context: CanvasRenderingContext2D,
  sheet: HTMLCanvasElement,
  frame: number,
  originX: number,
  originY: number,
  tileSize: number,
  span: number,
  camera: Camera,
  viewWidth: number,
  viewHeight: number,
) {
  const px = Math.round(camera.left + originX * tileSize);
  const py = Math.round(camera.top + originY * tileSize);
  const size = Math.max(1, Math.round(tileSize * span));
  if (!onScreen(px, py, size, viewWidth, viewHeight)) return;
  context.drawImage(
    sheet,
    0,
    frame * SPRITE_SIZE,
    SPRITE_SIZE,
    SPRITE_SIZE,
    px,
    py,
    size,
    size,
  );
}

export function Kites({
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
    const shadowSheet = buildKiteShadowSheet();
    const kite = new Image();
    kite.src = KITE_SRC;
    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const camera = cameraRef.current;
      if (!camera || !shadowSheet) return;
      const current = mapRef.current;
      const elapsedNow = elapsedRef.current();
      const season = gameDateAt(elapsedNow).season;
      const size = tileSizeRef.current;
      const byId = new Map(
        mosslingsRef.current.map((entry) => [entry.id, entry]),
      );
      const span = kiteSpriteTiles();
      const ready = kite.complete && kite.naturalWidth > 0;
      context.imageSmoothingEnabled = false;
      for (const mossling of mosslingsRef.current) {
        const game = mossling.soccer;
        const partner = game ? byId.get(game.partnerId) : undefined;
        if (!fliesKite(mossling, season, current, partner)) continue;
        const cellX = mossling.cellIndex % current.width;
        const cellY = Math.floor(mossling.cellIndex / current.width);
        const frame = bounceFrame(
          mossling.id,
          elapsedNow,
          mossling.plagueMonths,
        );
        const anchor = kiteAnchor(mossling.id, cellX, cellY, frame);
        const shade = kiteShadow(anchor);
        drawShadowFrame(
          context,
          shadowSheet,
          frame,
          shade.x,
          shade.y,
          size,
          KITE_SHADOW_TILES,
          camera,
          width,
          height,
        );
        if (!ready) continue;
        const px = Math.round(camera.left + anchor.x * size);
        const py = Math.round(camera.top + anchor.y * size);
        const drawW = Math.max(1, Math.round(size * span.width));
        const drawH = Math.max(1, Math.round(size * span.height));
        if (!onScreen(px, py, Math.max(drawW, drawH), width, height)) continue;
        context.drawImage(kite, px, py, drawW, drawH);
      }
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
