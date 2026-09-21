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
