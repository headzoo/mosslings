import { farmingSeason, pullingCarrots } from "./field-work";
import { touchesFire } from "./fire-sprite";
import type { Season } from "./game-time";
import type { MapData } from "./map";
import type { PreviewMossling } from "./map-preview";
import { playingSoccer } from "./soccer";

/** Stable share of Mosslings who actually fly. */
export const KITE_CHANCE = 25;
/** Tiles to the side of the flyer. The sign comes from the id. */
export const KITE_ASIDE = 2;
/** Tiles above the flyer. */
export const KITE_UP = 3;
/** Width of the kite, another 25% smaller than the three-tile sail. */
export const KITE_TILES = 2.25;
/** Pixel size of public/mosslings/icons/kite.png. */
export const KITE_SRC_WIDTH = 80;
export const KITE_SRC_HEIGHT = 52;
/** Ground shadow is one tile, on the next row under the kite. */
export const KITE_SHADOW_TILES = 1;

const BOB = [0, 0.18, -0.22, 0.08] as const;

export interface KitePoint {
  x: number;
  y: number;
}

/** True for about one id in twenty-five. The same id always agrees. */
export function kiteRoll(id: number): boolean {
  return (Math.imul(id + 1, 0x9e3779b9) >>> 0) % KITE_CHANCE === 0;
}

function kiteSide(id: number): -1 | 1 {
  return (Math.imul(id + 1, 0x85ebca6b) >>> 0) & 1 ? 1 : -1;
}

/**
 * Spring and summer, living, and the stable roll.
 * Temperament does not matter.
 * Fire, water, carrot rows, and a kick already occupy the sprite.
 */
export function fliesKite(
  mossling: PreviewMossling,
  season: Season,
  map: MapData,
  partner?: PreviewMossling,
): boolean {
  if ((mossling.health ?? 100) <= 0) return false;
  if (!farmingSeason(season)) return false;
  if (!kiteRoll(mossling.id)) return false;
  if (playingSoccer(mossling, partner, map.width)) return false;
  const cell = map.cells[mossling.cellIndex];
  if (cell?.terrain === "water") return false;
  if (pullingCarrots(season, cell)) return false;
  if (touchesFire(map, mossling.cellIndex)) return false;
  return true;
}

/** A few tiles off the cell, with a small bob so the kite is flying. */
export function kiteAnchor(
  id: number,
  cellX: number,
  cellY: number,
  frame: number,
): KitePoint {
  return {
    x: cellX + kiteSide(id) * KITE_ASIDE,
    y: cellY - KITE_UP + (BOB[frame] ?? 0),
  };
}

/** How many tiles the kite png covers, keeping its pixel aspect. */
export function kiteSpriteTiles() {
  return {
    width: KITE_TILES,
    height: KITE_TILES * (KITE_SRC_HEIGHT / KITE_SRC_WIDTH),
  };
}

/** One extra tile, centered on the row under the kite. */
export function kiteShadow(anchor: KitePoint): KitePoint {
  const sprite = kiteSpriteTiles();
  return {
    x: anchor.x + (sprite.width - KITE_SHADOW_TILES) / 2,
    y: anchor.y + sprite.height,
  };
}
