import type { MapCell, MapData } from "../map";
import type { GodEffect, Point, PowerId } from "./types";

/** About twice a season. */
export const RAIN_MONTH_CHANCE = 2 / 3;
/** Share of showers that pick a crop tile when any exist. The rest seek trees, grass, and moss. */
export const CROP_RAIN_BIAS = 0.35;
export const NATURAL_RAIN_SECONDS = 3;
export const NATURAL_RAIN_INTENSITY = 0.4;
/** About once every six years. */
export const DISASTER_MONTH_CHANCE = 1 / 70;
export const DISASTERS = [
  "fire",
  "tornado",
  "nuke",
  "lightning",
  "meteor",
] as const;
/** About once every twenty years. */
export const STORM_MONTH_CHANCE = 1 / (20 * 12);
export const STORM_RADIUS = 4;
export const STORM_CLOUDS = 3;
/**
 * One saturated god cloud adds about 6. Three overlapping clouds add about 18.
 * A natural shower adds about 1.2 and never crosses this line.
 */
export const FLOOD_THRESHOLD = 13;
export const FLOOD_DECAY = 0.25;
/** Expected lightning strikes per second under each rain cloud. */
export const RAIN_LIGHTNING_RATE = 0.1;

const STORM_OFFSETS = [
  [0, 0],
  [2, 1],
  [-2, -1],
] as const;

export const WILD_RAIN = "Rain clouds gather.";
export const WILD_STORM = "A storm floods the land.";
export const WILD_DISASTER: Record<(typeof DISASTERS)[number], string> = {
  fire: "A wildfire starts.",
  tornado: "A tornado touches down.",
  nuke: "A nuke falls.",
  lightning: "Lightning strikes.",
  meteor: "A meteor falls.",
};

export interface WeatherSpawn {
  kind: PowerId;
  x: number;
  y: number;
  duration?: number;
  intensity?: number;
  message: string;
}

export interface WeatherRoll {
  spawns: WeatherSpawn[];
  floodAt?: Point;
  pendingStorm: Point | null;
}

function pointOf(index: number, width: number): Point {
  return { x: index % width, y: Math.floor(index / width) };
}

function collect(map: MapData) {
  const crops: number[] = [];
  const wild: number[] = [];
  const land: number[] = [];
  map.cells.forEach((cell, index) => {
    if (cell.terrain === "water") return;
    land.push(index);
    if (cell.growth !== undefined) crops.push(index);
    if (cell.tree || (cell.terrain === "grass" && cell.growth === undefined))
      wild.push(index);
  });
  return { crops, wild, land };
}

function choose(
  indices: readonly number[],
  random: () => number,
  width: number,
): Point | null {
  if (!indices.length) return null;
  const index = indices[Math.floor(random() * indices.length)] ?? indices[0];
  return pointOf(index, width);
}

function visitRadius(
  map: MapData,
  x: number,
  y: number,
  radius: number,
  visit: (cell: MapCell, index: number) => void,
) {
  for (
    let cy = Math.max(0, Math.floor(y - radius));
    cy <= Math.min(map.height - 1, Math.ceil(y + radius));
    cy++
  ) {
    for (
      let cx = Math.max(0, Math.floor(x - radius));
      cx <= Math.min(map.width - 1, Math.ceil(x + radius));
      cx++
    ) {
      if (Math.hypot(cx - x, cy - y) <= radius)
        visit(map.cells[cy * map.width + cx], cy * map.width + cx);
    }
  }
}

/** Grass, dirt, rock, and forest become lasting water. */
export function floodCell(cell: MapCell, clear: (cell: MapCell) => void) {
  if (cell.terrain === "water") return false;
  clear(cell);
  cell.terrain = "water";
  cell.tree = undefined;
  cell.growth = undefined;
  cell.burning = false;
  cell.damage = undefined;
  cell.recovery = undefined;
  return true;
}

export function floodRadius(
  map: MapData,
  origin: Point,
  clear: (cell: MapCell) => void,
  radius = STORM_RADIUS,
) {
  let flooded = 0;
  visitRadius(map, origin.x, origin.y, radius, (cell) => {
    if (floodCell(cell, clear)) flooded++;
  });
  return flooded;
}

/**
 * Saturated ground under rain builds pressure. Dry or idle ground lets it fade.
 * Returns how many tiles became water.
 */
export function accumulateFlood(
  map: MapData,
  effects: readonly GodEffect[],
  pressure: Map<number, number>,
  dt: number,
  clear: (cell: MapCell) => void,
) {
  if (dt <= 0) return 0;
  const gain = new Map<number, number>();
  for (const effect of effects) {
    if (effect.kind !== "rain") continue;
    visitRadius(map, effect.x, effect.y, effect.radius, (cell, index) => {
      if (cell.terrain === "water" || cell.moisture < 1) return;
      gain.set(index, (gain.get(index) ?? 0) + effect.intensity);
    });
  }
  let flooded = 0;
  for (const [index, weight] of gain) {
    const next = (pressure.get(index) ?? 0) + dt * weight;
    if (next >= FLOOD_THRESHOLD) {
      pressure.delete(index);
      if (floodCell(map.cells[index], clear)) flooded++;
    } else pressure.set(index, next);
  }
  for (const [index, amount] of [...pressure]) {
    if (gain.has(index)) continue;
    const next = amount - dt * FLOOD_DECAY;
    if (next <= 1e-6) pressure.delete(index);
    else pressure.set(index, next);
  }
  return flooded;
}

/** A bolt under a raining cloud, about one tenth of each second it falls. */
export function lightningUnderRain(
  map: MapData,
  effects: readonly GodEffect[],
  dt: number,
  random: () => number,
  freeSlots: number,
): WeatherSpawn[] {
  const spawns: WeatherSpawn[] = [];
  if (dt <= 0) return spawns;
  let slots = Math.max(0, freeSlots);
  const chance = dt * RAIN_LIGHTNING_RATE;
  for (const effect of effects) {
    if (effect.kind !== "rain" || slots <= 0) continue;
    if (random() >= chance) continue;
    const tiles: number[] = [];
    visitRadius(map, effect.x, effect.y, effect.radius, (_cell, index) => {
      tiles.push(index);
    });
    const at = choose(tiles, random, map.width);
    if (!at) continue;
    spawns.push({
      kind: "lightning",
      ...at,
      message: WILD_DISASTER.lightning,
    });
    slots--;
  }
  return spawns;
}

export function rollMonth(
  map: MapData,
  random: () => number,
  freeSlots: number,
  pendingStorm: Point | null,
  canPlace: (kind: PowerId, point: Point) => boolean,
): WeatherRoll {
  const spawns: WeatherSpawn[] = [];
  let slots = Math.max(0, freeSlots);
  const { crops, wild, land } = collect(map);

  if (slots > 0 && random() < RAIN_MONTH_CHANCE) {
    const preferCrop = crops.length > 0 && random() < CROP_RAIN_BIAS;
    const at = choose(
      preferCrop ? crops : wild.length ? wild : land,
      random,
      map.width,
    );
    if (at) {
      spawns.push({
        kind: "rain",
        ...at,
        duration: NATURAL_RAIN_SECONDS,
        intensity: NATURAL_RAIN_INTENSITY,
        message: WILD_RAIN,
      });
      slots--;
    }
  }

  if (slots > 0 && land.length && random() < DISASTER_MONTH_CHANCE) {
    const kind = DISASTERS[Math.floor(random() * DISASTERS.length)] ?? "fire";
    let at: Point | null = null;
    for (let attempt = 0; attempt < 8 && !at; attempt++) {
      const candidate = choose(land, random, map.width);
      if (candidate && canPlace(kind, candidate)) at = candidate;
    }
    if (at) {
      spawns.push({
        kind,
        ...at,
        message: WILD_DISASTER[kind],
      });
      slots--;
    }
  }

  let pending = pendingStorm;
  if (!pending && land.length && random() < STORM_MONTH_CHANCE)
    pending = choose(land, random, map.width);
  let floodAt: Point | undefined;
  // A full effect list waits, so the clouds appear together with the flood.
  if (pending && slots > 0) {
    const origin = pending;
    const clouds = Math.min(STORM_CLOUDS, slots);
    for (let i = 0; i < clouds; i++) {
      const [dx, dy] = STORM_OFFSETS[i] ?? [0, 0];
      spawns.push({
        kind: "rain",
        x: Math.max(0, Math.min(map.width - 1, origin.x + dx)),
        y: Math.max(0, Math.min(map.height - 1, origin.y + dy)),
        duration: 6,
        intensity: 1,
        message: i === 0 ? WILD_STORM : "",
      });
    }
    floodAt = origin;
    pending = null;
  }

  return { spawns, floodAt, pendingStorm: pending };
}
