"use client";

import { useLayoutEffect, useRef } from "react";
import {
  ASCENT_SECONDS,
  buildDiedSpriteSheet,
  diedAscentFrame,
} from "@/lib/died-sprite";
import { pullingCarrots } from "@/lib/field-work";
import { buildFireSpriteSheet, touchesFire } from "@/lib/fire-sprite";
import { foliageAt, gameDateAt } from "@/lib/game-time";
import { fliesKite } from "@/lib/kites";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import { type PreviewMossling, paintCell, TILE_SIZE } from "@/lib/map-preview";
import {
  bounceFrame,
  circleColor,
  detailMode,
  FRAME_COUNT,
  faceFrame,
  KICK_FRAME_COUNT,
  mosslingInView,
  roundBounceOffset,
  SHOVEL_FRAME_COUNT,
  SPLASH_FRAME_COUNT,
  SPRITE_SIZE,
  shovelFrame,
  skinnedKickPixel,
  skinnedKitePixel,
  skinnedShovelPixel,
  skinnedSplashPixel,
  skinnedSpritePixel,
  splashFrame,
  spriteLookKey,
} from "@/lib/mossling-detail";
import { kickFrame, playingSoccer } from "@/lib/soccer";
import {
  cellNeedsTerrainDetail,
  terrainDetailActive,
} from "@/lib/terrain-detail";
import type { FramePainter } from "./useGodWorld";

const SHEET_LIMIT = 256;

function sheetFor(
  sheets: Map<string, HTMLCanvasElement>,
  mossling: PreviewMossling,
  pose:
    | "bounce"
    | "shovel"
    | "splash"
    | "kick-left"
    | "kick-right"
    | "kite" = "bounce",
) {
  const key =
    pose === "bounce"
      ? spriteLookKey(mossling)
      : `${spriteLookKey(mossling)}|${pose}`;
  const cached = sheets.get(key);
  if (cached) return cached;
  const frames =
    pose === "shovel"
      ? SHOVEL_FRAME_COUNT
      : pose === "splash"
        ? SPLASH_FRAME_COUNT
        : pose === "kick-left" || pose === "kick-right"
          ? KICK_FRAME_COUNT
          : FRAME_COUNT;
  const pixelAt =
    pose === "shovel"
      ? skinnedShovelPixel
      : pose === "splash"
        ? skinnedSplashPixel
        : pose === "kick-left"
          ? (frame: number, x: number, y: number, subject: PreviewMossling) =>
              skinnedKickPixel(frame, x, y, subject, "left")
          : pose === "kick-right"
            ? (frame: number, x: number, y: number, subject: PreviewMossling) =>
                skinnedKickPixel(frame, x, y, subject, "right")
            : pose === "kite"
              ? skinnedKitePixel
              : skinnedSpritePixel;
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * frames;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  for (let frame = 0; frame < frames; frame++) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = pixelAt(frame, x, y, mossling);
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
  const deathStartsRef = useRef(new Map<number, number>());
  const wasAliveRef = useRef(new Set<number>());
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
    const diedSheet = buildDiedSpriteSheet();
    const fireSheet = buildFireSpriteSheet();
    const deathStarts = deathStartsRef.current;
    const wasAlive = wasAliveRef.current;
    const render = () => {
      const camera = cameraRef.current;
      const current = mapRef.current;
      const elapsedNow = elapsedRef.current();
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!camera) return;
      context.imageSmoothingEnabled = false;
      const look = foliageAt(elapsedNow);
      const season = gameDateAt(elapsedNow).season;
      const size = tileSizeRef.current;
      const mode = detailMode(size);
      const seen = new Set<number>();
      const byId = new Map(
        mosslingsRef.current.map((entry) => [entry.id, entry]),
      );
      for (const mossling of mosslingsRef.current) {
        seen.add(mossling.id);
        const health = mossling.health ?? 100;
        if (health > 0) {
          wasAlive.add(mossling.id);
          deathStarts.delete(mossling.id);
        } else if (mode === "sprite") {
          if (!deathStarts.has(mossling.id)) {
            deathStarts.set(
              mossling.id,
              wasAlive.has(mossling.id)
                ? elapsedNow
                : elapsedNow - ASCENT_SECONDS,
            );
          }
          wasAlive.delete(mossling.id);
        } else {
          deathStarts.delete(mossling.id);
        }
      }
      for (const id of deathStarts.keys()) {
        if (!seen.has(id)) deathStarts.delete(id);
      }
      for (const id of wasAlive) {
        if (!seen.has(id)) wasAlive.delete(id);
      }
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
            ? roundBounceOffset(
                mossling.id,
                elapsedNow,
                mossling.health ?? 100,
                mossling.plagueMonths,
              )
            : 0;
        const cell = current.cells[mossling.cellIndex];
        const health = mossling.health ?? 100;
        const game = mossling.soccer;
        const partner = game ? byId.get(game.partnerId) : undefined;
        const burning =
          mode === "sprite" &&
          health > 0 &&
          touchesFire(current, mossling.cellIndex);
        const kicking =
          mode === "sprite" &&
          health > 0 &&
          !burning &&
          playingSoccer(mossling, partner, current.width);
        const splashing =
          mode === "sprite" &&
          health > 0 &&
          !burning &&
          !kicking &&
          cell?.terrain === "water";
        const digging =
          mode === "sprite" &&
          health > 0 &&
          !burning &&
          !kicking &&
          !splashing &&
          pullingCarrots(season, cell);
        const kiting =
          mode === "sprite" &&
          health > 0 &&
          !burning &&
          !kicking &&
          !splashing &&
          !digging &&
          fliesKite(mossling, season, current, partner);
        const bounce =
          mode === "sprite"
            ? burning
              ? bounceFrame(mossling.id, elapsedNow, mossling.plagueMonths)
              : kicking && game
                ? kickFrame(elapsedNow, game.since, game.face === "right")
                : splashing
                  ? splashFrame(mossling.id, elapsedNow, mossling.plagueMonths)
                  : digging
                    ? shovelFrame(
                        mossling.id,
                        elapsedNow,
                        mossling.plagueMonths,
                      )
                    : faceFrame(mossling, elapsedNow)
            : null;
        const bitmap =
          bounce === null || burning
            ? null
            : sheetFor(
                sheets,
                mossling,
                kicking
                  ? game?.face === "left"
                    ? "kick-left"
                    : "kick-right"
                  : splashing
                    ? "splash"
                    : digging
                      ? "shovel"
                      : kiting
                        ? "kite"
                        : "bounce",
              );
        const top = py + bob;
        const dead = (mossling.health ?? 100) <= 0;
        if (mode === "sprite" && dead && diedSheet) {
          const deathStart =
            deathStarts.get(mossling.id) ?? elapsedNow - ASCENT_SECONDS;
          const frame = diedAscentFrame(elapsedNow - deathStart);
          context.drawImage(
            diedSheet,
            0,
            frame * SPRITE_SIZE,
            SPRITE_SIZE,
            SPRITE_SIZE,
            px,
            top,
            size,
            size,
          );
        } else if (burning && fireSheet && bounce !== null) {
          context.drawImage(
            fireSheet,
            0,
            bounce * SPRITE_SIZE,
            SPRITE_SIZE,
            SPRITE_SIZE,
            px,
            top,
            size,
            size,
          );
        } else if (bitmap && bounce !== null) {
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
