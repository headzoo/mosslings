import type { MapCell, MapData } from "./map";
import type { PreviewMossling } from "./map-preview";

export const INTRO_TILE_GAP = 2;
export const INTRO_CAMERA_TILE_SIZE = 24;

const INTRO_DESIGNS = [
  { colors: ["#ffe632", "#769f24", "#fff5b7"], pattern: 0 },
  { colors: ["#49d5df", "#6c58d5", "#f6f4de"], pattern: 2 },
  { colors: ["#e84a54", "#ffd845", "#fff9e0"], pattern: 4 },
  { colors: ["#eaa4df", "#9d4abb", "#d9f877"], pattern: 1 },
] as const;

export function introSpotlightRadiusPx(tileSize = INTRO_CAMERA_TILE_SIZE) {
  return Math.max(tileSize * 6, 150);
}

export function introSpotlightTileRadius(tileSize = INTRO_CAMERA_TILE_SIZE) {
  return introSpotlightRadiusPx(tileSize) / tileSize;
}

export function introMosslingTiles(map: Pick<MapData, "width" | "height">) {
  const step = INTRO_TILE_GAP + 1;
  const baseX = Math.floor(map.width / 2) - step;
  const baseY = Math.floor(map.height / 2) - step;
  return [
    { x: baseX, y: baseY },
    { x: baseX + step, y: baseY },
    { x: baseX, y: baseY + step },
    { x: baseX + step, y: baseY + step },
  ];
}

/** Tiles visible inside the intro spotlight circle. */
export function introClearZoneTiles(map: Pick<MapData, "width" | "height">) {
  const center = introClusterCenter(map);
  const cx = center.x * map.width;
  const cy = center.y * map.height;
  const radius = introSpotlightTileRadius();
  const radiusSq = radius * radius;
  const tiles: { x: number; y: number }[] = [];
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(map.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(map.height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radiusSq) tiles.push({ x, y });
    }
  }
  return tiles;
}

export function introZoneIndices(map: Pick<MapData, "width" | "height">) {
  return new Set(introClearZoneTiles(map).map(({ x, y }) => y * map.width + x));
}

function clearCellToGrass(cell: MapCell) {
  cell.terrain = "grass";
  delete cell.tree;
  delete cell.growth;
  delete cell.damage;
  delete cell.burning;
  delete cell.recovery;
}

/** Grass-only ground inside the intro spotlight, for mosslings and empty padding. */
export function ensureIntroZone(map: MapData) {
  for (const { x, y } of introClearZoneTiles(map)) {
    clearCellToGrass(map.cells[y * map.width + x]);
  }
}

export function createIntroMosslings(map: MapData): PreviewMossling[] {
  const tiles = introMosslingTiles(map);
  return tiles.map((tile, id) => ({
    id,
    health: 100,
    cellIndex: tile.y * map.width + tile.x,
    colors: [...INTRO_DESIGNS[id].colors],
    pattern: INTRO_DESIGNS[id].pattern,
  }));
}

export function introClusterCenter(map: Pick<MapData, "width" | "height">) {
  const tiles = introMosslingTiles(map);
  const x = (tiles[0].x + tiles[3].x + 1) / 2;
  const y = (tiles[0].y + tiles[3].y + 1) / 2;
  return { x: x / map.width, y: y / map.height };
}
