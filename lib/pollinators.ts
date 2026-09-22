import type { Season } from "./game-time";
import type { MapCell, MapData } from "./map";

export const MAX_POLLINATORS = 24;

export type PollinatorKind = "bee" | "butterfly";

export interface Pollinator {
  homeIndex: number;
  kind: PollinatorKind;
  /** Orbit radius in tiles. */
  radius: number;
  /** Radians per game second. */
  speed: number;
  phase: number;
  /** Vertical bob in tiles. */
  bob: number;
  /** 0 is warm wings, 1 is blue wings. */
  palette: number;
}

function unit(seed: number, index: number, salt: number) {
  let h =
    (Math.imul(seed ^ salt, 0x9e3779b1) + Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Grass, moss, or a tree tile that is not burning and not a crop field. */
export function greeneryHome(cell: MapCell | undefined): boolean {
  if (!cell || cell.burning || cell.growth !== undefined) return false;
  return cell.terrain === "grass" || !!cell.tree;
}

export function pollinatorsActive(season: Season): boolean {
  return season === "Spring" || season === "Summer";
}

export function pollinatorVisible(
  map: Pick<MapData, "cells">,
  pollinator: Pollinator,
): boolean {
  return greeneryHome(map.cells[pollinator.homeIndex]);
}

function spec(seed: number, slot: number, homeIndex: number): Pollinator {
  const kind: PollinatorKind = unit(seed, slot, 1) < 0.55 ? "bee" : "butterfly";
  return {
    homeIndex,
    kind,
    radius: 0.25 + unit(seed, slot, 2) * 0.65,
    speed: 1.4 + unit(seed, slot, 3) * 2.2,
    phase: unit(seed, slot, 4) * Math.PI * 2,
    bob: 0.04 + unit(seed, slot, 5) * 0.12,
    palette: unit(seed, slot, 6) < 0.5 ? 0 : 1,
  };
}

/** Up to twenty-four pollinators on greenery, chosen once from the map seed. */
export function pollinatorsForMap(map: MapData): Pollinator[] {
  const homes: number[] = [];
  map.cells.forEach((cell, index) => {
    if (greeneryHome(cell)) homes.push(index);
  });
  if (homes.length === 0) return [];
  const count = Math.min(MAX_POLLINATORS, homes.length);
  const order = homes.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(unit(map.seed, i, 7) * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order
    .slice(0, count)
    .map((rank, slot) => spec(map.seed, slot, homes[rank]));
}

export function pollinatorPosition(
  map: Pick<MapData, "width">,
  pollinator: Pollinator,
  elapsed: number,
): { x: number; y: number } {
  const x = pollinator.homeIndex % map.width;
  const y = Math.floor(pollinator.homeIndex / map.width);
  const angle = pollinator.phase + elapsed * pollinator.speed;
  const bob = Math.sin(elapsed * (pollinator.speed * 1.7) + pollinator.phase);
  return {
    x: x + 0.5 + Math.cos(angle) * pollinator.radius,
    y:
      y +
      0.5 +
      Math.sin(angle) * pollinator.radius * 0.72 +
      bob * pollinator.bob,
  };
}
