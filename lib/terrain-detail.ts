import type { SeasonLook } from "./game-time";
import type { MapCell, MapData } from "./map";
import {
  cellVisualHash,
  iceCover,
  SUMMER_LOOK,
  snowBlanket,
  snowDepth,
  terrainColor,
  treePaintColor,
} from "./map-preview";

/** Faced zoom and the one before it. Lower zooms keep the stretched 8px tiles. */
export const TERRAIN_DETAIL_ZOOM = 24;

const SOILS = [0x6b4a2a, 0x7a5530, 0x5c4030, 0x8a6240] as const;
const LEAVES = [0x3d9a34, 0x54a32e, 0x2f7a28] as const;
const CARROT = 0xe87820;
const CARROT_TIP = 0xc44818;
const STUBBLE = 0x8a5a2c;
const SNOW = 0xf7fbff;
const SNOW_BRIGHT = 0xffffff;
const SNOW_SHADE = 0xd5e4ee;
const PLANT_COLORS = new Set<number>([...LEAVES, CARROT, CARROT_TIP, STUBBLE]);

function lookSteps(look: SeasonLook) {
  const step = (value: number) => Math.round(value * 20);
  return [
    step(look.cover),
    step(look.autumn),
    step(look.snow),
    step(look.ice),
    step(look.crop),
  ];
}

/** Stepped season look, packed so a tile can skip work until the picture changes. */
export function terrainLookStamp(look: SeasonLook): number {
  const [cover, autumn, snow, ice, crop] = lookSteps(look);
  return (
    (cover ?? 0) |
    ((autumn ?? 0) << 5) |
    ((snow ?? 0) << 10) |
    ((ice ?? 0) << 15) |
    ((crop ?? 0) << 20)
  );
}

export function terrainDetailActive(tileSize: number): boolean {
  return tileSize >= TERRAIN_DETAIL_ZOOM;
}

/** Crops, grass, trees, open water, rock, and any land with snow. Fire and scars stay on the base map. */
export function cellNeedsTerrainDetail(
  map: MapData,
  index: number,
  look: SeasonLook = SUMMER_LOOK,
): boolean {
  const cell = map.cells[index];
  if (!cell || cell.burning || cell.damage) return false;
  if (cell.tree || cell.growth !== undefined) return true;
  if (
    cell.terrain === "grass" ||
    cell.terrain === "water" ||
    cell.terrain === "rock"
  )
    return true;
  return cell.terrain === "dirt" && landHasSnow(map, index, look);
}

/** One tile's picture. The cell index is part of the key because the speckle depends on it. */
export function terrainTileKey(
  map: MapData,
  index: number,
  look: SeasonLook,
  tileSize: number,
): string {
  const health = map.cells[index]?.tree?.health;
  return [
    index,
    Math.round(tileSize),
    cellVisualHash(map.cells[index]),
    health === undefined ? "" : Math.round(health / 25),
    ...lookSteps(look),
  ].join("|");
}

function hashAt(index: number, x: number, y: number) {
  let hash = Math.imul(index + 1, 0x9e3779b1);
  hash ^= Math.imul(x + 3, 0x85ebca6b);
  hash ^= Math.imul(y + 7, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  return hash >>> 0;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSlot = (((hue % 360) + 360) % 360) / 60;
  const match = lightness - chroma / 2;
  const x = chroma * (1 - Math.abs((hueSlot % 2) - 1));
  const [r, g, b] =
    hueSlot < 1
      ? [chroma, x, 0]
      : hueSlot < 2
        ? [x, chroma, 0]
        : hueSlot < 3
          ? [0, chroma, x]
          : hueSlot < 4
            ? [0, x, chroma]
            : hueSlot < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return [r + match, g + match, b + match].map((channel) =>
    Math.round(channel * 255),
  );
}

function parseColor(color: string): number[] {
  if (color.startsWith("#")) {
    const value = Number.parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const rgb = color.match(/rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hsl = color.match(/hsl\(\s*([-\d.]+)[ ,]+([-\d.]+)%[ ,]+([-\d.]+)%/);
  if (hsl)
    return hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
  return [0, 0, 0];
}

function hexOf(rgb: number) {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
}

function parsePacked(color: string) {
  const [red, green, blue] = parseColor(color);
  return (
    ((Math.round(red ?? 0) & 255) << 16) |
    ((Math.round(green ?? 0) & 255) << 8) |
    (Math.round(blue ?? 0) & 255)
  );
}

function scalePacked(rgb: number, factor: number) {
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((rgb >> shift) & 255) * factor)));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function soilColor(index: number, x: number, y: number) {
  return SOILS[hashAt(index, x, y) % SOILS.length] ?? SOILS[0];
}

/** True on the highlight line of a ripple. Three lines fit in a 24px tile. */
export function waterRipple(y: number, size: number) {
  const span = Math.max(4, Math.floor(size / 3));
  return y % span === 1;
}

function cropPixel(
  cell: MapCell,
  index: number,
  x: number,
  y: number,
  size: number,
  look: SeasonLook,
) {
  const growth = Math.max(0, Math.min(1, (cell.growth ?? 0) * look.crop));
  const band = size / 3;
  const row = Math.min(2, Math.floor(y / band));
  const local = y - row * band;
  const center = band * 0.55;
  const spacing = Math.max(4, Math.round(size / 5));
  const column = Math.floor(x / spacing);
  const plantX = column * spacing + Math.floor(spacing / 2);
  const dx = Math.abs(x - plantX);
  if (dx > 2) return soilColor(index, x, y);
  const leafHeight =
    growth < 0.15 ? 1 : growth < 0.45 ? 3 : growth < 0.85 ? 5 : 6;
  const carrotHeight = growth >= 0.85 ? 3 : 0;
  const leafTop = center - leafHeight;
  if (
    carrotHeight > 0 &&
    local >= center &&
    local < center + carrotHeight &&
    dx <= 1
  )
    return local >= center + carrotHeight - 1 ? CARROT_TIP : CARROT;
  if (
    local >= leafTop &&
    local < center &&
    dx <= (local < center - 1 ? 2 : 1)
  ) {
    if (growth < 0.15) return STUBBLE;
    return LEAVES[hashAt(index, x, y) % LEAVES.length] ?? LEAVES[0];
  }
  return soilColor(index, x, y);
}

type TilePaint = {
  grassBase: number;
  waterBase: number;
  ice: number;
  rockBase: number;
  groundBase: number;
  treeFill: number;
  treeTip: number;
  treeLeaf: number;
  snow: number;
  bare: MapCell;
};

function paintFor(
  map: MapData,
  cell: MapCell,
  index: number,
  look: SeasonLook,
): TilePaint {
  const bare = cell.tree ? { ...cell, tree: undefined } : cell;
  return {
    grassBase:
      bare.terrain === "grass"
        ? parsePacked(terrainColor(bare, index, look))
        : 0,
    waterBase:
      cell.terrain === "water"
        ? parsePacked(terrainColor(cell, index, look))
        : 0,
    ice: cell.terrain === "water" ? iceCover(index, look.ice) : 0,
    rockBase:
      cell.terrain === "rock"
        ? parsePacked(terrainColor(cell, index, look))
        : 0,
    groundBase: parsePacked(terrainColor(bare, index, look)),
    treeFill: parsePacked(treePaintColor(cell.moisture, "fill", look)),
    treeTip: parsePacked(treePaintColor(cell.moisture, "tip", look)),
    treeLeaf: parsePacked(treePaintColor(cell.moisture, "leaf", look)),
    snow: snowDepth(map, index, look.snow),
    bare,
  };
}

function grassPixel(
  index: number,
  cell: MapCell,
  x: number,
  y: number,
  look: SeasonLook,
  base: number,
) {
  const hash = hashAt(index, x, y);
  const roll = (hash % 1000) / 999;
  const clump = look.cover * (0.55 + cell.moisture * 0.45);
  let color = base;
  if (roll < 0.16 * clump) color = scalePacked(base, 1.28);
  else if (roll < 0.16 * clump + 0.14) color = scalePacked(base, 0.72);
  const blade =
    x % 6 === hash % 5 && y % 4 < Math.max(1, Math.round(look.cover * 2));
  if (blade) color = scalePacked(base, look.autumn > 0.5 ? 0.85 : 1.18);
  return color;
}

function landHasSnow(map: MapData, index: number, look: SeasonLook) {
  return (
    snowBlanket(map, index, look) || snowDepth(map, index, look.snow) >= 0.045
  );
}

/** Smooth 0..1 field so a drift covers neighboring pixels together. */
function driftField(index: number, x: number, y: number) {
  const scale = 6;
  const x0 = Math.floor(x / scale);
  const y0 = Math.floor(y / scale);
  const tx = (x - x0 * scale) / scale;
  const ty = (y - y0 * scale) / scale;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const sample = (ix: number, iy: number) =>
    (hashAt(index, ix + 11, iy + 5) % 1000) / 999;
  const a = sample(x0, y0);
  const b = sample(x0 + 1, y0);
  const c = sample(x0, y0 + 1);
  const d = sample(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function snowCovers(index: number, x: number, y: number, depth: number) {
  if (depth < 0.045) return false;
  const cover = Math.min(0.9, depth * 2.15);
  return driftField(index, x, y) >= 1 - cover;
}

function snowTone(index: number, x: number, y: number, depth: number) {
  const above = y > 0 && snowCovers(index, x, y - 1, depth);
  if (!above) return SNOW_BRIGHT;
  if (hashAt(index, x, y) % 9 === 0) return SNOW_SHADE;
  return SNOW;
}

/** A connected drift on the ground. Light snow stays patchy; deeper snow fills in. */
function laySnow(
  index: number,
  x: number,
  y: number,
  depth: number,
  color: number,
) {
  if (!snowCovers(index, x, y, depth)) return color;
  return snowTone(index, x, y, depth);
}

/** Buried tiles are a shaded sheet, with a bright lip and a blue crease. */
function blanketPixel(index: number, x: number, y: number) {
  const field = driftField(index, x, y);
  const above = y > 0 ? driftField(index, x, y - 1) : field;
  if (field < above - 0.08) return SNOW_SHADE;
  if (field > 0.66) return SNOW_BRIGHT;
  return SNOW;
}

function waterPixel(
  index: number,
  x: number,
  y: number,
  size: number,
  paint: TilePaint,
) {
  const hash = hashAt(index, x, y);
  if (paint.ice > 0.72) {
    const crack = (x * 3 + y + index) % 17 === 0 || (x - y + 32) % 19 === 0;
    return crack ? 0x8eb4c4 : (hash & 2) === 0 ? 0xf4f9fc : 0xd7e6f0;
  }
  if (paint.ice > 0.2 && hash % 5 === 0) return SNOW_SHADE;
  if (waterRipple(y, size) && x % 3 !== 1)
    return scalePacked(paint.waterBase, 1.35);
  return paint.waterBase;
}

function groundUnderTree(
  index: number,
  x: number,
  y: number,
  look: SeasonLook,
  paint: TilePaint,
) {
  if (paint.bare.terrain === "grass")
    return grassPixel(index, paint.bare, x, y, look, paint.grassBase);
  if (paint.bare.terrain === "dirt") return soilColor(index, x, y);
  return paint.groundBase;
}

/** A rounded crown over a trunk. Winter drops the leaves and keeps the branches. */
function treePixel(
  index: number,
  cell: MapCell,
  x: number,
  y: number,
  size: number,
  look: SeasonLook,
  paint: TilePaint,
) {
  const hurt = (cell.tree?.health ?? 100) < 40;
  const bare = look.cover < 0.22;
  const cx = size / 2;
  const cy = size * 0.36;
  const spread = bare ? 0.35 : 0.55 + look.cover * 0.45;
  const rx = size * 0.42 * spread * (hurt ? 0.7 : 1);
  const ry = size * 0.34 * spread * (hurt ? 0.7 : 1);
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  const hash = hashAt(index, x, y);
  const trunkWidth = Math.max(2, Math.round(size * 0.12));
  const trunkLeft = Math.floor((size - trunkWidth) / 2);
  const trunkTop = cy + ry * 0.45;
  const inTrunk =
    x >= trunkLeft &&
    x < trunkLeft + trunkWidth &&
    y >= trunkTop &&
    y < size - 1;
  const wood = hurt ? 0x5c4030 : x === trunkLeft ? 0x8d6840 : 0x795030;
  if (inTrunk) return wood;
  const inCrown = nx * nx + ny * ny <= 1;
  if (!bare && inCrown && !(hurt && hash % 5 === 0)) {
    const depth = paint.snow;
    const lump = (driftField(index, x, 0) - 0.5) * 0.4;
    const line = -0.08 - depth * 0.85;
    if (depth > 0.05 && ny < line + lump)
      return ny > line + lump - 0.16 ? SNOW_SHADE : SNOW_BRIGHT;
    if (nx * nx + ny * ny > 0.72) return paint.treeFill;
    if (hash % 11 === 0) return paint.treeTip;
    return paint.treeLeaf;
  }
  const branch =
    bare &&
    Math.abs(y + 0.5 - cy) < 1.5 &&
    Math.abs(x + 0.5 - cx) < rx &&
    (Math.abs(x - cx) < 1 ||
      Math.abs(Math.abs(x - cx) - Math.abs(y - cy) * 3) < 1.2);
  if (branch) return 0x6a4630;
  return laySnow(
    index,
    x,
    y,
    paint.snow,
    groundUnderTree(index, x, y, look, paint),
  );
}

function rockPixel(
  cell: MapCell,
  index: number,
  x: number,
  y: number,
  base: number,
) {
  const cracks = 3 + Math.round(cell.rockiness * 5);
  const stride = Math.max(3, 9 - cracks);
  if ((x + y * 2 + index) % stride === 0 && y % 2 === 0)
    return scalePacked(base, 0.55);
  if (hashAt(index, x, y) % 7 === 0) return scalePacked(base, 1.32);
  return base;
}

function terrainRgb(
  map: MapData,
  index: number,
  x: number,
  y: number,
  size: number,
  look: SeasonLook,
  paint: TilePaint,
): number | null {
  const cell = map.cells[index];
  if (!cell || !cellNeedsTerrainDetail(map, index, look)) return null;
  if (snowBlanket(map, index, look)) return blanketPixel(index, x, y);
  if (cell.tree) return treePixel(index, cell, x, y, size, look, paint);
  if (cell.growth !== undefined) {
    const crop = cropPixel(cell, index, x, y, size, look);
    return PLANT_COLORS.has(crop)
      ? crop
      : laySnow(index, x, y, paint.snow, crop);
  }
  if (cell.terrain === "water") return waterPixel(index, x, y, size, paint);
  if (cell.terrain === "rock")
    return laySnow(
      index,
      x,
      y,
      paint.snow,
      rockPixel(cell, index, x, y, paint.rockBase),
    );
  if (cell.terrain === "dirt")
    return laySnow(index, x, y, paint.snow, soilColor(index, x, y));
  return laySnow(
    index,
    x,
    y,
    paint.snow,
    grassPixel(index, cell, x, y, look, paint.grassBase),
  );
}

/** One screen pixel of a detailed tile, or null when this cell stays on the base map. */
export function terrainPixel(
  map: MapData,
  index: number,
  x: number,
  y: number,
  size: number,
  look: SeasonLook = SUMMER_LOOK,
): string | null {
  const cell = map.cells[index];
  if (!cell || !cellNeedsTerrainDetail(map, index, look)) return null;
  const rgb = terrainRgb(
    map,
    index,
    x,
    y,
    size,
    look,
    paintFor(map, cell, index, look),
  );
  return rgb === null ? null : hexOf(rgb);
}

/** Fill a size×size ImageData with one detailed tile. False when the base map should show. */
export function writeTerrainTile(
  data: Uint8ClampedArray,
  map: MapData,
  index: number,
  size: number,
  look: SeasonLook = SUMMER_LOOK,
): boolean {
  const cell = map.cells[index];
  if (!cell || !cellNeedsTerrainDetail(map, index, look)) return false;
  const paint = paintFor(map, cell, index, look);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgb = terrainRgb(map, index, x, y, size, look, paint);
      const offset = (y * size + x) * 4;
      if (rgb === null) {
        data[offset + 3] = 0;
        continue;
      }
      data[offset] = (rgb >> 16) & 255;
      data[offset + 1] = (rgb >> 8) & 255;
      data[offset + 2] = rgb & 255;
      data[offset + 3] = 255;
    }
  }
  return true;
}
