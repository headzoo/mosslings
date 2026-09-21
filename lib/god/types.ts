import type { MapCell, MapData } from "../map";
import type { PreviewMossling } from "../map-preview";

export type PowerId =
  | "rain"
  | "grow"
  | "ground"
  | "raze"
  | "disease"
  | "fire"
  | "tornado"
  | "quake"
  | "lightning"
  | "meteor";
export type DamageKind = "heat" | "impact" | "water";
export interface DisasterThreat extends Point {
  radius: number;
  severity: number;
  kind: DamageKind;
  alreadyHit?: ReadonlySet<number>;
}
export interface Point {
  x: number;
  y: number;
}
export interface GodEffect extends Point {
  id: number;
  kind: PowerId;
  origin: Point;
  age: number;
  duration: number;
  radius: number;
  /** Rain strength. Other powers leave this at 1. */
  intensity: number;
  seed: number;
  step: number;
  marks: Map<number, number>;
  hit: Set<number>;
  impacted: boolean;
}
export interface GodContext {
  map: MapData;
  mosslings: PreviewMossling[];
  cell(x: number, y: number): MapCell | undefined;
  area(
    x: number,
    y: number,
    radius: number,
    visit: (cell: MapCell, index: number, distance: number) => void,
  ): void;
  damage(index: number, amount: number, kind: DamageKind): void;
  damageTree(cell: MapCell, amount: number): void;
  damageTerrain(cell: MapCell): void;
  clearRecovery(cell: MapCell): void;
  canMoveTo(mossling: PreviewMossling, x: number, y: number): boolean;
  move(mossling: PreviewMossling, x: number, y: number): void;
  /** Forced displacement can enter water, which is immediately fatal. */
  forceMove(mossling: PreviewMossling, x: number, y: number): void;
}
export interface EffectPainter {
  width: number;
  height: number;
  cell(
    x: number,
    y: number,
    color: string,
    size?: number,
    alpha?: number,
  ): void;
}
export interface GodAction {
  id: PowerId;
  label: string;
  canPlace?: (context: GodContext, point: Point) => string | null;
  create(point: Point, seed: number, id: number): GodEffect;
  update(effect: GodEffect, context: GodContext, dt: number): void;
  draw(effect: GodEffect, painter: EffectPainter): void;
  finish?: (effect: GodEffect, context: GodContext) => void;
  threats?: (effect: GodEffect, context: GodContext) => DisasterThreat[];
}
export interface WorldEvent {
  id: number;
  message: string;
  year: number;
  season: import("../game-time").Season;
}
