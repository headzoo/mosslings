import { foliageAt, type SeasonLook } from "./game-time";

export type { SeasonLook } from "./game-time";

import { plagueShade } from "./god/disease";
import type { MapCell, MapData } from "./map";
import { brownBlend, mixHex } from "./vegetation";

export const TILE_SIZE = 8;

/** True for pixels inside the round Mossling body on an 8×8 tile. */
export function inMosslingCircle(
  x: number,
  y: number,
  size = TILE_SIZE,
): boolean {
  const dx = x + 0.5 - size / 2;
  const dy = y + 0.5 - size / 2;
  return Math.hypot(dx, dy) <= size / 2 - 0.35;
}

export function getGridDimensions(width: number, height: number) {
  return {
    width: Math.max(1, Math.floor(width / TILE_SIZE)),
    height: Math.max(1, Math.floor(height / TILE_SIZE)),
  };
}

export interface MatingRitual {
  partnerId: number;
  /** Courtship months already spent together, from 1 to 3. */
  months: number;
  /** Game seconds when the courtship began, shared so colors pulse in step. */
  since: number;
  phase: "courtship" | "family";
  childId?: number;
  role?: "child";
}

export interface PreviewMossling {
  health?: number;
  /** Current alarm level, 0..1; traits remain stable while this state changes. */
  panic?: number;
  id: number;
  cellIndex: number;
  colors: string[];
  pattern: number;
  /** Months since catching the black death. Missing means healthy. */
  plagueMonths?: number;
  /** Months the body has lain still. Set when they die; removed after one. */
  corpseMonths?: number;
  /** Set while the fields cannot feed the population. */
  hungry?: boolean;
  traits?: { label: string; value: number }[];
  parents?: [number, number];
  /** Mossling ids this one will not court again. */
  wontMate?: number[];
  /** Game seconds when this mossling last finished a successful mating cycle. */
  lastMatedAt?: number;
  ritual?: MatingRitual;
}

export type CreatePreviewMosslingsOptions = {
  startId?: number;
  occupied?: ReadonlySet<number>;
};

// Display fixtures only: these are not genomes or simulated organisms.
export function createPreviewMosslings(
  map: MapData,
  {
    startId = 0,
    occupied = new Set<number>(),
  }: CreatePreviewMosslingsOptions = {},
): PreviewMossling[] {
  let state = map.seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const land = map.cells.flatMap((cell, index) =>
    (cell.terrain === "grass" || cell.terrain === "dirt") &&
    !occupied.has(index)
      ? [index]
      : [],
  );
  const count = Math.min(
    land.length,
    Math.round(115 + random() * 75),
    Math.floor(map.cells.length * 0.0325),
  );
  const palettes = [
    ["#ffe632", "#769f24", "#fff5b7"],
    ["#49d5df", "#6c58d5", "#f6f4de"],
    ["#e84a54", "#ffd845", "#fff9e0"],
    ["#eaa4df", "#9d4abb", "#d9f877"],
    ["#b4d94b", "#20765a", "#ffed60"],
    ["#ffad35", "#f1df80", "#e4672f"],
  ];
  // Sample without replacement so the counter matches visible organisms.
  return Array.from({ length: count }, (_, offset) => {
    const choice = offset + Math.floor(random() * (land.length - offset));
    [land[offset], land[choice]] = [land[choice], land[offset]];
    return {
      id: startId + offset,
      health: 100,
      cellIndex: land[offset],
      colors: palettes[Math.floor(random() * palettes.length)],
      pattern: Math.floor(random() * 6),
    };
  });
}

const FALLOW_CROP = "#5c4030";

/** Minimap color for a crop, from fresh green to ripe gold. */
export function cropColor(
  growth: number,
  look: SeasonLook = SUMMER_LOOK,
): string {
  const effective = growth * look.crop;
  let color: string;
  if (effective >= 1) color = "#e0a83a";
  else if (effective >= 4 / 6) color = "#6aa336";
  else if (effective >= 2 / 6) color = "#4ea234";
  else color = "#3c8c32";
  return look.crop < 1 ? mixHex(FALLOW_CROP, color, look.crop) : color;
}

function cropStage(growth: number): number {
  if (growth >= 1) return 6;
  return Math.max(0, Math.floor(growth * 6));
}

/** Packs the fields that change how a tile is drawn. */
export function cellVisualHash(cell: MapCell): number {
  const terrain =
    cell.terrain === "grass"
      ? 1
      : cell.terrain === "dirt"
        ? 2
        : cell.terrain === "rock"
          ? 3
          : 4;
  const damage =
    cell.damage === "burned"
      ? 1
      : cell.damage === "crater"
        ? 2
        : cell.damage === "cracked"
          ? 3
          : 0;
  const growth = cell.growth === undefined ? 7 : cropStage(cell.growth);
  let hash = terrain;
  hash = Math.imul(hash, 16) + damage;
  hash = Math.imul(hash, 2) + (cell.burning ? 1 : 0);
  hash = Math.imul(hash, 2) + (cell.tree ? 1 : 0);
  hash = Math.imul(hash, 8) + growth;
  hash = Math.imul(hash, 256) + Math.round((cell.recovery ?? 0) * 255);
  hash = Math.imul(hash, 256) + Math.round(cell.moisture * 255);
  hash = Math.imul(hash, 256) + Math.round(cell.fertility * 255);
  hash = Math.imul(hash, 256) + Math.round(cell.elevation * 255);
  hash = Math.imul(hash, 256) + Math.round(cell.rockiness * 255);
  return hash;
}

function paintPixels(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  pixels: readonly (readonly [number, number])[],
) {
  context.fillStyle = color;
  for (const [px, py] of pixels) context.fillRect(x + px, y + py, 1, 1);
}

/** One row of ^ shapes. Shift 0 peaks on 0 and 4; shift 1 peaks on 1 and 5. */
function paintCaretRow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  shift: 0 | 1,
  tips: readonly string[],
  foot: string,
) {
  const peaks = shift === 0 ? [0, 4] : [1, 5];
  peaks.forEach((col, index) => {
    context.fillStyle = tips[index] ?? tips[0];
    context.fillRect(x + col, y, 1, 1);
    context.fillStyle = foot;
    if (col > 0) context.fillRect(x + col - 1, y + 1, 1, 1);
    if (col + 1 < TILE_SIZE) context.fillRect(x + col + 1, y + 1, 1, 1);
  });
  if (shift === 0) context.fillRect(x + TILE_SIZE - 1, y + 1, 1, 1);
}

function paintCropRows(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  growth: number,
  look: SeasonLook = SUMMER_LOOK,
) {
  const stage = cropStage(growth * look.crop);
  if (stage <= 0) return;
  const dot = "#e07a18";
  if (stage === 1) {
    paintPixels(context, x, y, dot, [
      [2, 2],
      [5, 4],
      [1, 6],
    ]);
    return;
  }
  if (stage === 2) {
    paintPixels(context, x, y, dot, [
      [1, 1],
      [4, 1],
      [6, 3],
      [2, 5],
      [5, 5],
      [0, 6],
    ]);
    return;
  }
  const orange = "#e87820" as const;
  const gold = "#f2c14a" as const;
  const red = "#c44818" as const;
  if (stage < 6) {
    const rows = stage - 2;
    for (let row = 0; row < rows; row++) {
      const shift = row % 2 === 0 ? 0 : 1;
      paintCaretRow(
        context,
        x,
        y + row * 2 + (stage === 3 ? 2 : 1),
        shift,
        [orange, orange],
        dot,
      );
    }
    return;
  }
  context.fillStyle = "#143016";
  context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  const ripe = [
    { shift: 0 as const, tips: [gold, orange] as const, foot: dot },
    { shift: 1 as const, tips: [orange, red] as const, foot: red },
    { shift: 0 as const, tips: [gold, orange] as const, foot: "#d06018" },
    { shift: 1 as const, tips: [orange, gold] as const, foot: red },
  ];
  for (const [row, caret] of ripe.entries())
    paintCaretRow(context, x, y + row * 2, caret.shift, caret.tips, caret.foot);
}

const TREE_PAINT = {
  fill: ["#19592a", "#5c4030"],
  leaf: ["#54a32e", "#8a5a2c"],
  tip: ["#78be42", "#c4a05a"],
} as const;

const AUTUMN_PAINT = {
  fill: "#6e3418",
  leaf: "#e87820",
  tip: "#f2c14a",
} as const;

const BARE_WOOD = "#6b4630";

/** Full summer green. Callers that omit a season keep today's colors. */
export const SUMMER_LOOK: SeasonLook = {
  cover: 1,
  autumn: 0,
  snow: 0,
  ice: 0,
  crop: 1,
};

/**
 * How frozen one water tile is.
 * Some tiles skin over before others, so late autumn and spring look patchy.
 * A season amount of 1 freezes every tile.
 */
export function iceCover(index: number, seasonIce: number) {
  if (seasonIce <= 0) return 0;
  let hash = Math.imul(index + 3, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const lead = ((hash >>> 0) % 1000) / 999;
  const threshold = 0.12 + lead * 0.4;
  if (seasonIce <= threshold) return 0;
  const formed = (seasonIce - threshold) / (1 - threshold);
  return formed > 1 ? 1 : formed;
}

export function treePaintColor(
  moisture: number,
  part: keyof typeof TREE_PAINT,
  look: SeasonLook = SUMMER_LOOK,
): string {
  const [lush, dry] = TREE_PAINT[part];
  const drought = mixHex(lush, dry, brownBlend(moisture));
  const turned = mixHex(drought, AUTUMN_PAINT[part], look.autumn);
  return mixHex(turned, BARE_WOOD, 1 - look.cover);
}

export function terrainColor(
  cell: MapCell,
  index: number,
  look: SeasonLook = SUMMER_LOOK,
): string {
  if (cell.burning) return "#943b19";
  if (cell.damage && (cell.recovery ?? 0) > 0) {
    // New vegetation softens scars while the original ground recovers.
    const progress = cell.recovery ?? 0;
    const from = cell.damage === "crater" ? [65, 59, 55] : [59, 48, 39];
    const to = [81, 119, 45];
    return `rgb(${from.map((value, i) => Math.round(value + (to[i] - value) * progress)).join(" ")})`;
  }
  if (cell.damage === "burned") return "#3b3027";
  if (cell.damage === "crater") return "#413b37";
  if (cell.tree) return treePaintColor(cell.moisture, "fill", look);
  if (cell.growth !== undefined) return cropColor(cell.growth, look);
  let hash = Math.imul(index + 1, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const variation = (((hash ^ (hash >>> 16)) >>> 0) % 9) - 4;
  switch (cell.terrain) {
    case "water": {
      const ice = iceCover(index, look.ice);
      const openLight = 30 + Math.round(cell.elevation * 22) + variation;
      const iceLight =
        76 + Math.round(cell.elevation * 8) + Math.round(variation * 0.3);
      const hue = Math.round(202 + (198 - 202) * ice);
      const saturation = Math.round(92 + (30 - 92) * ice);
      const lightness = Math.round(openLight + (iceLight - openLight) * ice);
      return `hsl(${hue} ${saturation}% ${lightness}%)`;
    }
    case "rock":
      return `hsl(85 3% ${34 + Math.round(cell.rockiness * 25) + variation}%)`;
    case "dirt":
      return `hsl(${32 + Math.round(cell.moisture * 15)} 36% ${30 + Math.round(cell.fertility * 15) + variation}%)`;
    case "grass": {
      const dry = brownBlend(cell.moisture);
      const bare = 1 - look.cover;
      let hue = 140 + (32 - 140) * dry;
      hue += (38 - hue) * look.autumn * (1 - dry);
      hue += (32 - hue) * bare;
      const satBase = 48 + cell.fertility * 20;
      let saturation = satBase + (34 - satBase) * dry;
      saturation += (42 - saturation) * look.autumn * (1 - dry);
      saturation *= 1 - bare * 0.65;
      const lightness = Math.round(22 + (32 - 22) * dry + bare * 6) + variation;
      return `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${lightness}%)`;
    }
  }
}

export function mosslingPatternColor(
  mossling: PreviewMossling,
  x: number,
  y: number,
): string {
  let value: number;
  switch (mossling.pattern) {
    case 0:
      value = Math.floor(x / 2);
      break;
    case 1:
      value = Math.floor(y / 2);
      break;
    case 2:
      value = Math.floor((x + y) / 2);
      break;
    case 3:
      value = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      break;
    case 4:
      value = (x * y + mossling.id + x) % 7;
      break;
    default:
      value = Math.floor(x / 2) + Math.floor(y / 2);
  }
  return mossling.colors[value % mossling.colors.length];
}

function scaleHex(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 255) * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

export function paintedMosslingColor(
  mossling: PreviewMossling,
  x: number,
  y: number,
) {
  if ((mossling.health ?? 100) <= 0)
    return x === y || x + y === TILE_SIZE - 1 ? "#e54320" : "#000000";
  const months = mossling.plagueMonths;
  const color = mosslingPatternColor(mossling, x, y);
  if (months === undefined) return color;
  return scaleHex(color, plagueShade(months));
}

function paintTree(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  moisture: number,
  look: SeasonLook,
) {
  context.fillStyle = "#795030";
  context.fillRect(x + 3, y + 5, 2, 3);
  if (look.cover < 0.22) {
    context.fillStyle = "#6a4630";
    context.fillRect(x + 2, y + 3, 4, 1);
    context.fillRect(x + 1, y + 2, 2, 1);
    context.fillRect(x + 5, y + 2, 2, 1);
    return;
  }
  const span = Math.max(2, Math.round(6 * look.cover));
  context.fillStyle = treePaintColor(moisture, "leaf", look);
  context.fillRect(
    x + Math.floor((TILE_SIZE - span) / 2),
    y + 1,
    span,
    Math.max(2, Math.round(4 * look.cover)),
  );
  const tip = Math.max(1, Math.round(3 * look.cover));
  context.fillStyle = treePaintColor(moisture, "tip", look);
  context.fillRect(
    x + Math.floor((TILE_SIZE - tip) / 2),
    y,
    tip,
    Math.max(1, Math.round(3 * look.cover)),
  );
}

/** A few green pixels so a thin meadow still reads as grass. */
function paintTufts(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  index: number,
  moisture: number,
  look: SeasonLook,
) {
  const tuft = mixHex(
    mixHex("#3d9a34", "#8a5a2c", brownBlend(moisture)),
    "#c44818",
    look.autumn,
  );
  let hash = Math.imul(index + 9, 0x9e3779b1);
  const count = Math.max(1, Math.round(look.cover * 6));
  context.fillStyle = tuft;
  for (let i = 0; i < count; i++) {
    hash = Math.imul(hash ^ (hash >>> 13), 0x45d9f3b);
    context.fillRect(
      x + ((hash >>> 0) % TILE_SIZE),
      y + ((hash >>> 8) % TILE_SIZE),
      1,
      1,
    );
  }
}

/** Snow thins across this many tiles of open ground beside water. */
export const SNOW_SHORE = 4;

function hash01(x: number, y: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) % 1000) / 999;
}

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash01(x0, y0);
  const b = hash01(x0 + 1, y0);
  const c = hash01(x0, y0 + 1);
  const d = hash01(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** 0 is bare ground between drifts. 1 is the heart of a wind-stretched patch. */
export function snowDrift(x: number, y: number) {
  const broad = valueNoise(x * 0.13, y * 0.32);
  const fine = valueNoise(x * 0.41 + 4.2, y * 0.67 + 1.7);
  const patch = broad * 0.72 + fine * 0.28;
  if (patch < 0.38) return 0;
  return (patch - 0.38) / 0.62;
}

function shoreSnow(map: MapData, x: number, y: number) {
  let nearest = SNOW_SHORE + 1;
  for (let dy = -SNOW_SHORE; dy <= SNOW_SHORE && nearest > 1; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= map.height) continue;
    for (let dx = -SNOW_SHORE; dx <= SNOW_SHORE; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist === 0 || dist >= nearest) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= map.width) continue;
      if (map.cells[ny * map.width + nx]?.terrain === "water") nearest = dist;
    }
  }
  if (nearest > SNOW_SHORE) return 1;
  return (nearest - 1) / SNOW_SHORE;
}

/**
 * How much snow sits on one land tile.
 * Drifts skip some ground, pile up as elevation rises, and fade beside water.
 */
export function snowDepth(map: MapData, index: number, seasonSnow: number) {
  if (seasonSnow <= 0) return 0;
  const cell = map.cells[index];
  if (!cell || cell.terrain === "water" || cell.burning) return 0;
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  const drift = snowDrift(x, y);
  if (drift <= 0) return 0;
  const height = 0.2 + 0.8 * cell.elevation;
  return seasonSnow * height * shoreSnow(map, x, y) * drift;
}

/**
 * A whole tile buried in snow. The field is coarse and stretched, so buried
 * tiles sit together in a few drifts instead of scattering.
 */
export function snowBlanket(map: MapData, index: number, look: SeasonLook) {
  if (look.snow < 0.18 || look.cover > 0.12) return false;
  const cell = map.cells[index];
  if (!cell || cell.burning) return false;
  if (cell.terrain === "water" || cell.terrain === "rock") return false;
  if (cell.growth !== undefined && !cell.tree) return false;
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  if (shoreSnow(map, x, y) < 0.5) return false;
  const field = valueNoise(x * 0.28 + 3, y * 0.34);
  return field > 0.84 - cell.elevation * 0.05;
}

function paintIce(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  index: number,
  cell: MapCell,
  look: SeasonLook,
) {
  const cover = iceCover(index, look.ice);
  if (cover <= 0.08) return;
  let hash = Math.imul(index + 11, 0x9e3779b1);
  if (cover < 0.92) {
    const holes = Math.max(1, Math.round((1 - cover) * 4));
    context.fillStyle = terrainColor(cell, index, { ...look, ice: 0 });
    for (let i = 0; i < holes; i++) {
      hash = Math.imul(hash ^ (hash >>> 13), 0x45d9f3b);
      context.fillRect(
        x + ((hash >>> 0) % TILE_SIZE),
        y + ((hash >>> 8) % TILE_SIZE),
        1,
        1,
      );
    }
  }
  if (cover <= 0.35) return;
  const glints = cover > 0.75 ? 2 : 1;
  context.fillStyle = "#f4f9fc";
  for (let i = 0; i < glints; i++) {
    hash = Math.imul(hash ^ (hash >>> 13), 0x45d9f3b);
    context.fillRect(
      x + ((hash >>> 0) % TILE_SIZE),
      y + ((hash >>> 8) % TILE_SIZE),
      1,
      1,
    );
  }
}

function paintSnow(
  context: CanvasRenderingContext2D,
  map: MapData,
  index: number,
  x: number,
  y: number,
  seasonSnow: number,
) {
  const depth = snowDepth(map, index, seasonSnow);
  if (depth < 0.045) return;
  const tx = index % map.width;
  const ty = Math.floor(index / map.width);
  const ax = Math.min(
    TILE_SIZE - 2,
    Math.floor(valueNoise(tx * 0.13, ty * 0.32) * (TILE_SIZE - 1)),
  );
  const ay = Math.min(
    TILE_SIZE - 2,
    Math.floor(valueNoise(tx * 0.13 + 2.2, ty * 0.32) * (TILE_SIZE - 1)),
  );
  const count = Math.min(6, Math.max(1, Math.round(depth * 14)));
  let hash = Math.imul(tx + 1, 0x9e3779b1) ^ Math.imul(ty + 3, 0x85ebca6b);
  for (let i = 0; i < count; i++) {
    hash = Math.imul(hash ^ (hash >>> 13), 0x45d9f3b);
    const px = Math.min(
      TILE_SIZE - 1,
      Math.max(0, ax + ((hash >>> 0) % 3) - 1),
    );
    const py = Math.min(
      TILE_SIZE - 1,
      Math.max(0, ay + ((hash >>> 8) % 3) - 1),
    );
    context.fillStyle = (hash & 2) === 0 ? "#f4f8fb" : "#d7e6f0";
    const wide = depth > 0.16 && (hash & 4) === 0 && px < TILE_SIZE - 1;
    context.fillRect(x + px, y + py, wide ? 2 : 1, 1);
  }
}

export function paintCell(
  context: CanvasRenderingContext2D,
  map: MapData,
  index: number,
  tileSize = TILE_SIZE,
  look: SeasonLook = SUMMER_LOOK,
) {
  const cell = map.cells[index];
  if (!cell) return;
  const x = (index % map.width) * tileSize;
  const y = Math.floor(index / map.width) * tileSize;
  context.fillStyle = terrainColor(cell, index, look);
  context.fillRect(x, y, tileSize, tileSize);
  if (tileSize > 1 && cell.terrain === "water" && !cell.burning)
    paintIce(context, x, y, index, cell, look);
  if (
    tileSize > 1 &&
    cell.growth !== undefined &&
    !cell.tree &&
    !cell.burning &&
    !cell.damage
  )
    paintCropRows(context, x, y, cell.growth, look);
  if (tileSize > 1 && cell.tree) paintTree(context, x, y, cell.moisture, look);
  if (
    tileSize > 1 &&
    look.cover < 0.45 &&
    cell.terrain === "grass" &&
    !cell.tree &&
    cell.growth === undefined &&
    !cell.burning &&
    !cell.damage
  )
    paintTufts(context, x, y, index, cell.moisture, look);
  if (
    tileSize > 1 &&
    look.snow > 0 &&
    cell.terrain !== "water" &&
    !cell.burning
  )
    paintSnow(context, map, index, x, y, look.snow);
  const buried = snowBlanket(map, index, look);
  if (buried) {
    context.fillStyle = "#ffffff";
    context.fillRect(x, y, tileSize, tileSize);
  }
  if (tileSize > 1 && cell.damage === "cracked" && !buried) {
    context.fillStyle = "#29271f";
    for (let row = 0; row < tileSize; row++)
      context.fillRect(x + (row < 4 ? 3 : 4), y + row, 1, 1);
  }
}

const SPRITE_LIMIT = 256;
const sprites = new Map<string, HTMLCanvasElement>();

function spriteKey(mossling: PreviewMossling): string {
  if ((mossling.health ?? 100) <= 0) return "dead";
  return [
    mossling.pattern,
    mossling.colors.join("."),
    mossling.plagueMonths ?? "",
  ].join("|");
}

function hexPixel(data: Uint8ClampedArray, x: number, y: number, hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const index = (y * TILE_SIZE + x) * 4;
  data[index] = (value >> 16) & 255;
  data[index + 1] = (value >> 8) & 255;
  data[index + 2] = value & 255;
  data[index + 3] = 255;
}

/** One 8×8 blit for a look. Matching colors and patterns share a sprite. */
function mosslingSprite(mossling: PreviewMossling): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = spriteKey(mossling);
  const cached = sprites.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(TILE_SIZE, TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (!inMosslingCircle(x, y)) continue;
      hexPixel(image.data, x, y, paintedMosslingColor(mossling, x, y));
    }
  }
  sprite.putImageData(image, 0, 0);
  if (sprites.size >= SPRITE_LIMIT) {
    const oldest = sprites.keys().next().value;
    if (oldest !== undefined) sprites.delete(oldest);
  }
  sprites.set(key, canvas);
  return canvas;
}

export function paintMossling(
  context: CanvasRenderingContext2D,
  map: Pick<MapData, "width">,
  mossling: PreviewMossling,
  tileSize = TILE_SIZE,
) {
  const left = (mossling.cellIndex % map.width) * tileSize;
  const top = Math.floor(mossling.cellIndex / map.width) * tileSize;
  if (tileSize === 1) {
    context.fillStyle = paintedMosslingColor(mossling, 0, 0);
    context.fillRect(left, top, 1, 1);
    return;
  }
  const sprite = tileSize === TILE_SIZE ? mosslingSprite(mossling) : null;
  if (sprite) context.drawImage(sprite, left, top);
  else {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        if (!inMosslingCircle(x, y)) continue;
        context.fillStyle = paintedMosslingColor(mossling, x, y);
        context.fillRect(left + x, top + y, 1, 1);
      }
    }
  }
  if ((mossling.panic ?? 0) > 0.1) {
    context.fillStyle = "#221611";
    context.fillRect(left + 2, top - 4, 4, 5);
    context.fillStyle = "#ffce55";
    context.fillRect(left + 3, top - 4, 2, 2);
    context.fillRect(left + 3, top - 1, 2, 1);
  }
}

export function paintMap(
  context: CanvasRenderingContext2D,
  map: MapData,
  mosslings: PreviewMossling[],
  tileSize = TILE_SIZE,
  elapsed = 0,
) {
  context.imageSmoothingEnabled = false;
  const look = foliageAt(elapsed);
  for (let index = 0; index < map.cells.length; index++)
    paintCell(context, map, index, tileSize, look);
  for (const mossling of mosslings)
    paintMossling(context, map, mossling, tileSize);
}
