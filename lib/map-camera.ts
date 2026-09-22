import type { MapData } from "./map";

export const ZOOM_LEVELS = [8, 16, 24, 32] as const;
export type Camera = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
};

export function getCamera(
  map: Pick<MapData, "width" | "height">,
  viewport: { width: number; height: number },
  tileSize: number,
  center: { x: number; y: number },
): Camera {
  const width = Math.min(map.width, viewport.width / tileSize);
  const height = Math.min(map.height, viewport.height / tileSize);
  const x = Math.max(
    0,
    Math.min(map.width - width, center.x * map.width - width / 2),
  );
  const y = Math.max(
    0,
    Math.min(map.height - height, center.y * map.height - height / 2),
  );
  return {
    x,
    y,
    width,
    height,
    left: Math.floor(
      Math.max(0, (viewport.width - map.width * tileSize) / 2) - x * tileSize,
    ),
    top: Math.floor(
      Math.max(0, (viewport.height - map.height * tileSize) / 2) - y * tileSize,
    ),
  };
}

const MIN_TILE_SIZE = 8;
const MAX_TILE_SIZE = 32;
const TILE_STEP = 8;

/** Next zoom step that keeps the clicked map point on the same screen pixel. */
export function zoomAtPoint(
  map: Pick<MapData, "width" | "height">,
  viewport: { width: number; height: number },
  tileSize: number,
  camera: { left: number; top: number },
  screen: { x: number; y: number },
  direction: number,
): { tileSize: number; center: { x: number; y: number } } {
  const nextSize = Math.max(
    MIN_TILE_SIZE,
    Math.min(MAX_TILE_SIZE, tileSize + direction * TILE_STEP),
  );
  const mapX = (screen.x - camera.left) / tileSize;
  const mapY = (screen.y - camera.top) / tileSize;
  const nextWidth = Math.min(map.width, viewport.width / nextSize);
  const nextHeight = Math.min(map.height, viewport.height / nextSize);
  const padX = Math.max(0, (viewport.width - map.width * nextSize) / 2);
  const padY = Math.max(0, (viewport.height - map.height * nextSize) / 2);
  const x = Math.max(
    0,
    Math.min(
      map.width - nextWidth,
      (padX - (screen.x - mapX * nextSize)) / nextSize,
    ),
  );
  const y = Math.max(
    0,
    Math.min(
      map.height - nextHeight,
      (padY - (screen.y - mapY * nextSize)) / nextSize,
    ),
  );
  return {
    tileSize: nextSize,
    center: {
      x: (x + nextWidth / 2) / map.width,
      y: (y + nextHeight / 2) / map.height,
    },
  };
}
