import { MONTH_SECONDS } from "./game-time";
import { plagueShade } from "./god/disease";
import type { MapCell, MapData } from "./map";

export const TILE_SIZE = 8;

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
  ritual?: MatingRitual;
}

// Display fixtures only: these are not genomes or simulated organisms.
export function createPreviewMosslings(map: MapData): PreviewMossling[] {
  let state = map.seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const land = map.cells.flatMap((cell, index) =>
    cell.terrain === "grass" || cell.terrain === "dirt" ? [index] : [],
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
  return Array.from({ length: count }, (_, id) => {
    const choice = id + Math.floor(random() * (land.length - id));
    [land[id], land[choice]] = [land[choice], land[id]];
    return {
      id,
      health: 100,
      cellIndex: land[id],
      colors: palettes[Math.floor(random() * palettes.length)],
      pattern: Math.floor(random() * 6),
    };
  });
}

/** Minimap color for a crop, from fresh green to ripe gold. */
export function cropColor(growth: number): string {
  if (growth >= 1) return "#c6d84a";
  if (growth >= 4 / 6) return "#8fba3a";
  if (growth >= 2 / 6) return "#6aa336";
  return "#5cad3a";
}

function cropStage(growth: number): number {
  if (growth >= 1) return 6;
  return Math.max(0, Math.floor(growth * 6));
}

function paintCropRows(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  growth: number,
) {
  const stage = cropStage(growth);
  if (stage <= 0) return;
  const rows = stage < 3 ? 2 : stage < 5 ? 3 : 4;
  context.fillStyle = stage >= 6 ? "#3e6b24" : "#2f5a22";
  for (let row = 0; row < rows; row++)
    context.fillRect(x, y + 1 + row * 2, TILE_SIZE, 1);
  if (stage < 3) return;
  context.fillStyle = stage >= 6 ? "#e4ef7a" : "#8fce4a";
  const step = stage >= 5 ? 1 : 2;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < TILE_SIZE; col += step)
      context.fillRect(x + col, y + row * 2, 1, 1);
}

export function terrainColor(cell: MapCell, index: number): string {
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
  if (cell.tree) return "#19592a";
  if (cell.growth !== undefined) return cropColor(cell.growth);
  let hash = Math.imul(index + 1, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const variation = (((hash ^ (hash >>> 16)) >>> 0) % 9) - 4;
  switch (cell.terrain) {
    case "water":
      return `hsl(202 92% ${30 + Math.round(cell.elevation * 22) + variation}%)`;
    case "rock":
      return `hsl(85 3% ${34 + Math.round(cell.rockiness * 25) + variation}%)`;
    case "dirt":
      return `hsl(${32 + Math.round(cell.moisture * 15)} 36% ${30 + Math.round(cell.fertility * 15) + variation}%)`;
    case "grass":
      return `hsl(${83 + Math.round(cell.moisture * 57)} ${48 + Math.round(cell.fertility * 20)}% ${22 + Math.round((1 - cell.moisture) * 14) + variation}%)`;
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
  elapsed = 0,
) {
  if ((mossling.health ?? 100) <= 0)
    return x === y || x + y === TILE_SIZE - 1 ? "#e54320" : "#000000";
  const months = mossling.plagueMonths;
  const color = mosslingPatternColor(mossling, x, y);
  if (months === undefined) return pulseHex(color, mossling, elapsed);
  return scaleHex(color, plagueShade(months));
}

/** One bright-and-dim cycle per month, shared by everyone in the ritual. */
export function pulseRgb(
  channels: number[],
  mossling: PreviewMossling,
  elapsed: number,
) {
  const ritual = mossling.ritual;
  if (!ritual) return channels;
  const wave = Math.sin(
    (2 * Math.PI * (elapsed - ritual.since)) / MONTH_SECONDS,
  );
  const amount = Math.abs(wave) * 0.18;
  const target = wave > 0 ? 255 : 0;
  return channels.map((channel) =>
    Math.round(channel + (target - channel) * amount),
  );
}

function pulseHex(hex: string, mossling: PreviewMossling, elapsed: number) {
  if (!mossling.ritual) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(value)) return hex;
  const pulsed = pulseRgb(
    [16, 8, 0].map((shift) => (value >> shift) & 255),
    mossling,
    elapsed,
  );
  return `#${pulsed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function paintMap(
  context: CanvasRenderingContext2D,
  map: MapData,
  mosslings: PreviewMossling[],
  tileSize = TILE_SIZE,
  elapsed = 0,
) {
  context.imageSmoothingEnabled = false;
  map.cells.forEach((cell, index) => {
    const x = (index % map.width) * tileSize;
    const y = Math.floor(index / map.width) * tileSize;
    context.fillStyle = terrainColor(cell, index);
    context.fillRect(x, y, tileSize, tileSize);
    if (
      tileSize > 1 &&
      cell.growth !== undefined &&
      !cell.tree &&
      !cell.burning &&
      !cell.damage
    )
      paintCropRows(context, x, y, cell.growth);
    if (tileSize > 1 && cell.tree) {
      context.fillStyle = "#795030";
      context.fillRect(x + 3, y + 5, 2, 3);
      context.fillStyle = "#54a32e";
      context.fillRect(x + 1, y + 1, 6, 4);
      context.fillStyle = "#78be42";
      context.fillRect(x + 2, y, 3, 3);
    }
    if (tileSize > 1 && cell.damage === "cracked") {
      context.fillStyle = "#29271f";
      for (let row = 0; row < tileSize; row++)
        context.fillRect(x + (row < 4 ? 3 : 4), y + row, 1, 1);
    }
  });
  for (const mossling of mosslings) {
    const left = (mossling.cellIndex % map.width) * tileSize;
    const top = Math.floor(mossling.cellIndex / map.width) * tileSize;
    if (tileSize === 1) {
      context.fillStyle = paintedMosslingColor(mossling, 0, 0, elapsed);
      context.fillRect(left, top, 1, 1);
      continue;
    }
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        context.fillStyle = paintedMosslingColor(mossling, x, y, elapsed);
        context.fillRect(left + x, top + y, 1, 1);
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
}
