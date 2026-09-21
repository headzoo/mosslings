"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import type { MapData } from "@/lib/map";
import type { Camera } from "@/lib/map-camera";
import { type PreviewMossling, paintMap, TILE_SIZE } from "@/lib/map-preview";

export function GameMap({
  map,
  mosslings,
  miniature = false,
  style,
  elapsed,
}: {
  map: MapData;
  mosslings: PreviewMossling[];
  miniature?: boolean;
  style?: CSSProperties;
  elapsed?: () => number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = miniature ? 1 : TILE_SIZE;
  const mapRef = useRef(map);
  const mosslingsRef = useRef(mosslings);
  const elapsedRef = useRef(elapsed);
  mapRef.current = map;
  mosslingsRef.current = mosslings;
  elapsedRef.current = elapsed;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    let frame = 0;
    const draw = () => {
      paintMap(
        context,
        mapRef.current,
        mosslingsRef.current,
        scale,
        elapsedRef.current?.() ?? 0,
      );
    };
    mapRef.current = map;
    mosslingsRef.current = mosslings;
    draw();
    if (!mosslings.some((mossling) => mossling.ritual)) return;
    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [map, mosslings, scale]);
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
}: {
  map: MapData | null;
  mosslings: PreviewMossling[];
  camera: Camera | null;
  tileSize: number;
  elapsed?: () => number;
}) {
  return (
    <section className="minimap panel" aria-label="World overview">
      <div className="minimap-image">
        {map && (
          <div
            className="minimap-world"
            style={{ aspectRatio: `${map.width} / ${map.height}` }}
          >
            <GameMap
              map={map}
              mosslings={mosslings}
              miniature
              elapsed={elapsed}
            />
            {camera && (
              <div
                className="minimap-viewport"
                role="img"
                aria-label="Camera viewport"
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
      <p className="camera-hint">Drag to pan · Scroll to zoom</p>
      <p className="map-seed">
        {map ? `MOSS-${map.seed}` : "Growing a little world…"}
      </p>
    </section>
  );
}
