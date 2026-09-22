import type {
  EffectPainter,
  GodContext,
  GodEffect,
  Point,
  PowerId,
} from "./types";

export function effect(
  kind: PowerId,
  point: Point,
  seed: number,
  id: number,
  duration: number,
  radius: number,
): GodEffect {
  return {
    ...point,
    origin: { ...point },
    kind,
    seed,
    id,
    duration,
    radius,
    intensity: 1,
    age: 0,
    step: 0,
    marks: new Map(),
    hit: new Set(),
    impacted: false,
  };
}
export function random(effect: GodEffect) {
  effect.seed = (Math.imul(effect.seed, 1664525) + 1013904223) >>> 0;
  return effect.seed / 4294967296;
}
export function noise(index: number) {
  let h = Math.imul(index + 1, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function ring(
  p: EffectPainter,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1,
) {
  for (let i = 0; i < Math.max(12, radius * 12); i++) {
    const angle = (i / Math.max(12, radius * 12)) * Math.PI * 2;
    p.cell(
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      color,
      0.5,
      alpha,
    );
  }
}
export function scorch(
  context: GodContext,
  x: number,
  y: number,
  radius: number,
) {
  context.area(x, y, radius, (cell) => {
    if (cell.terrain === "water" || cell.terrain === "rock") return;
    context.damageTerrain(cell);
    cell.damage = "burned";
    cell.terrain = "dirt";
    cell.fertility *= 0.35;
    cell.moisture *= 0.5;
  });
}
export function landOnly(context: GodContext, point: Point) {
  const cell = context.cell(point.x, point.y);
  return !cell || cell.terrain === "water" || cell.terrain === "rock"
    ? "Choose grass or dirt for this power."
    : null;
}

export function connectedCellIndices(
  context: GodContext,
  point: Point,
  limit: number,
  canUse: (cell: NonNullable<ReturnType<GodContext["cell"]>>) => boolean,
) {
  const result: number[] = [];
  const queue = [point];
  const seen = new Set<number>();
  while (queue.length && result.length < limit) {
    const current = queue.shift();
    if (!current) break;
    if (
      current.x < 0 ||
      current.y < 0 ||
      current.x >= context.map.width ||
      current.y >= context.map.height
    )
      continue;
    const index = current.y * context.map.width + current.x;
    if (seen.has(index)) continue;
    seen.add(index);
    const cell = context.cell(current.x, current.y);
    if (!cell || !canUse(cell)) continue;
    result.push(index);
    queue.push(
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y - 1 },
    );
  }
  return result;
}

const TILE_BUCKET = 4;

export function addToBucket<T>(
  buckets: Map<string, T[]>,
  x: number,
  y: number,
  item: T,
) {
  const key = `${Math.floor(x / TILE_BUCKET)},${Math.floor(y / TILE_BUCKET)}`;
  const list = buckets.get(key);
  if (list) list.push(item);
  else buckets.set(key, [item]);
}

/** Visit items whose bucket can intersect a square of `reach` tiles around x, y. */
export function eachInReach<T>(
  buckets: Map<string, T[]>,
  x: number,
  y: number,
  reach: number,
  visit: (item: T) => void,
) {
  const span = Math.ceil(reach / TILE_BUCKET);
  const bx = Math.floor(x / TILE_BUCKET);
  const by = Math.floor(y / TILE_BUCKET);
  for (let ix = bx - span; ix <= bx + span; ix++) {
    for (let iy = by - span; iy <= by + span; iy++) {
      const list = buckets.get(`${ix},${iy}`);
      if (!list) continue;
      for (const item of list) visit(item);
    }
  }
}
