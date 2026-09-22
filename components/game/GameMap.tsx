"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { foliageAt, foliageStep } from "@/lib/game-time";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import {
  cellVisualHash,
  type PreviewMossling,
  paintCell,
  paintMap,
  paintMossling,
  TILE_SIZE,
} from "@/lib/map-preview";

function mapPoint(
  element: HTMLElement,
  map: Pick<MapData, "width" | "height">,
  clientX: number,
  clientY: number,
) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  return { x: nx * map.width, y: ny * map.height, nx, ny };
}

function covers(camera: Camera, x: number, y: number) {
  return (
    x >= camera.x &&
    y >= camera.y &&
    x <= camera.x + camera.width &&
    y <= camera.y + camera.height
  );
}

type SpriteStamp = { cell: number; panic: boolean; key: string };

function spriteStamp(mossling: PreviewMossling): SpriteStamp {
  const panic = (mossling.panic ?? 0) > 0.1;
  return {
    cell: mossling.cellIndex,
    panic,
    key: [
      panic ? 1 : 0,
      Math.round(mossling.health ?? 100),
      mossling.plagueMonths ?? "",
      mossling.corpseMonths ?? "",
      mossling.pattern,
      mossling.colors.join("."),
      mossling.ritual?.phase ?? "",
    ].join(","),
  };
}

export function GameMap({
  map,
  mosslings,
  miniature = false,
  style,
  elapsed,
  revisionRef,
}: {
  map: MapData;
  mosslings: PreviewMossling[];
  miniature?: boolean;
  style?: CSSProperties;
  elapsed?: () => number;
  revisionRef?: { current: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = miniature ? 1 : TILE_SIZE;
  const mapRef = useRef(map);
  const mosslingsRef = useRef(mosslings);
  const elapsedRef = useRef(elapsed);
  const revision = useRef(revisionRef);
  mapRef.current = map;
  mosslingsRef.current = mosslings;
  elapsedRef.current = elapsed;
  revision.current = revisionRef;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const hashes = new Int32Array(map.cells.length);
    const sprites = new Map<number, SpriteStamp>();
    const paintSprites = (indexes: Set<number>, ritual: boolean) => {
      const elapsedNow = elapsedRef.current?.() ?? 0;
      const width = mapRef.current.width;
      for (const mossling of mosslingsRef.current) {
        const above = mossling.cellIndex - width;
        const panic =
          (mossling.panic ?? 0) > 0.1 && above >= 0 && indexes.has(above);
        if (
          indexes.has(mossling.cellIndex) ||
          panic ||
          (ritual && mossling.ritual)
        )
          paintMossling(context, mapRef.current, mossling, scale, elapsedNow);
      }
    };
    paintMap(
      context,
      map,
      mosslingsRef.current,
      scale,
      elapsedRef.current?.() ?? 0,
    );
    for (let index = 0; index < map.cells.length; index++)
      hashes[index] = cellVisualHash(map.cells[index]);
    for (const mossling of mosslingsRef.current)
      sprites.set(mossling.id, spriteStamp(mossling));
    let seenRevision = revision.current?.current ?? 0;
    let seenMosslings = mosslingsRef.current;
    let seenFoliage = foliageStep(elapsedRef.current?.() ?? 0);
    let frame = 0;
    const loop = () => {
      const current = mapRef.current;
      const list = mosslingsRef.current;
      const elapsedNow = elapsedRef.current?.() ?? 0;
      const dirty = new Set<number>();
      const mark = (index: number) => {
        if (index >= 0 && index < current.cells.length) dirty.add(index);
      };
      const nextFoliage = foliageStep(elapsedNow);
      if (nextFoliage !== seenFoliage) {
        seenFoliage = nextFoliage;
        for (let index = 0; index < current.cells.length; index++)
          dirty.add(index);
      }
      const nextRevision = revision.current?.current ?? seenRevision;
      if (nextRevision !== seenRevision) {
        const count = Math.min(current.cells.length, hashes.length);
        for (let index = 0; index < count; index++) {
          const hash = cellVisualHash(current.cells[index]);
          if (hash === hashes[index]) continue;
          hashes[index] = hash;
          dirty.add(index);
        }
        seenRevision = nextRevision;
      }
      let ritual = false;
      for (const mossling of list) if (mossling.ritual) ritual = true;
      if (list !== seenMosslings) {
        const live = new Set<number>();
        for (const mossling of list) {
          live.add(mossling.id);
          const stamp = spriteStamp(mossling);
          const previous = sprites.get(mossling.id);
          if (
            previous &&
            previous.cell === stamp.cell &&
            previous.panic === stamp.panic &&
            previous.key === stamp.key
          )
            continue;
          if (previous) {
            mark(previous.cell);
            if (previous.panic) mark(previous.cell - current.width);
          }
          mark(stamp.cell);
          sprites.set(mossling.id, stamp);
        }
        for (const [id, previous] of sprites) {
          if (live.has(id)) continue;
          mark(previous.cell);
          if (previous.panic) mark(previous.cell - current.width);
          sprites.delete(id);
        }
        seenMosslings = list;
      }
      if (dirty.size) {
        const look = foliageAt(elapsedNow);
        for (const index of dirty)
          paintCell(context, current, index, scale, look);
        paintSprites(dirty, ritual);
      } else if (ritual) paintSprites(dirty, true);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [map, scale]);
  return (
    <canvas
      ref={canvasRef}
      style={style}
      className={miniature ? "minimap-canvas" : "map-canvas"}
      width={map.width * scale}
      height={map.height * scale}
      role="img"
      aria-label={`${miniature ? "Overview of" : "Generated map:"} ${map.width} by ${map.height} tiles, ${mosslings.length} Mosslings, grass, dirt, stone and water.`}
    />
  );
}

export function Minimap({
  map,
  mosslings,
  camera,
  tileSize,
  elapsed,
  revisionRef,
  onCenter,
}: {
  map: MapData | null;
  mosslings: PreviewMossling[];
  camera: Camera | null;
  tileSize: number;
  elapsed?: () => number;
  revisionRef?: { current: number };
  onCenter: (x: number, y: number) => void;
}) {
  const [overBox, setOverBox] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    moved: boolean;
    onBox: boolean;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const lookAt = (element: HTMLElement, clientX: number, clientY: number) => {
    if (!map) return;
    const point = mapPoint(element, map, clientX, clientY);
    if (point) onCenter(point.nx, point.ny);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!map || !camera || event.button !== 0) return;
    const point = mapPoint(
      event.currentTarget,
      map,
      event.clientX,
      event.clientY,
    );
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      moved: false,
      onBox: covers(camera, point.x, point.y),
      x: event.clientX,
      y: event.clientY,
      offsetX: point.x - (camera.x + camera.width / 2),
      offsetY: point.y - (camera.y + camera.height / 2),
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!map) return;
    const point = mapPoint(
      event.currentTarget,
      map,
      event.clientX,
      event.clientY,
    );
    if (!drag.current) {
      setOverBox(!!(point && camera && covers(camera, point.x, point.y)));
      return;
    }
    if (
      !drag.current.moved &&
      Math.hypot(
        event.clientX - drag.current.x,
        event.clientY - drag.current.y,
      ) > 5
    ) {
      drag.current.moved = true;
      if (drag.current.onBox) setDragging(true);
    }
    if (!drag.current.moved || !drag.current.onBox || !point) return;
    onCenter(
      (point.x - drag.current.offsetX) / map.width,
      (point.y - drag.current.offsetY) / map.height,
    );
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  return (
    <section className="minimap panel" aria-label="World overview">
      <div className="minimap-image">
        {map && (
          <div
            className="minimap-world"
            style={{ aspectRatio: `${map.width} / ${map.height}` }}
            data-over-box={overBox}
            data-dragging={dragging}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => {
              const current = drag.current;
              endDrag();
              if (current && !current.moved && !current.onBox)
                lookAt(event.currentTarget, event.clientX, event.clientY);
              const point = mapPoint(
                event.currentTarget,
                map,
                event.clientX,
                event.clientY,
              );
              setOverBox(
                !!(point && camera && covers(camera, point.x, point.y)),
              );
            }}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onPointerLeave={() => {
              if (!drag.current) setOverBox(false);
            }}
          >
            <GameMap
              map={map}
              mosslings={mosslings}
              miniature
              elapsed={elapsed}
              revisionRef={revisionRef}
            />
            {camera && (
              <div
                className="minimap-viewport"
                role="img"
                aria-label="Camera viewport. Drag to move the view."
                style={{
                  left: `${(camera.x / map.width) * 100}%`,
                  top: `${(camera.y / map.height) * 100}%`,
                  width: `${(camera.width / map.width) * 100}%`,
                  height: `${(camera.height / map.height) * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </div>
      <div className="map-details">
        <span>{map ? `${map.width} × ${map.height}` : "— × —"} tiles</span>
        <span>
          {tileSize} × {tileSize} pixels
        </span>
      </div>
      <p className="camera-hint">Drag the box to move · Click to jump</p>
      <p className="map-seed">
        {map ? `MOSS-${map.seed}` : "Growing a little world…"}
      </p>
    </section>
  );
}
