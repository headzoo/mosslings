import { mosslingPatternColor, type PreviewMossling } from "./map-preview";

export const COLOR_QUANTIZE_STEPS = 16;
export const VISUAL_MATCH_THRESHOLD = 17;
export const MAX_LINEAGE_HOPS = 4;

const CANONICAL_ID = 0;

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

/** Snap each RGB channel to the nearest palette bucket. */
export function quantizeHex(hex: string, steps = COLOR_QUANTIZE_STEPS): string {
  const step = 255 / (steps - 1);
  const quantize = (value: number) =>
    Math.round(Math.round(value / step) * step)
      .toString(16)
      .padStart(2, "0");
  return `#${quantize(channel(hex, 1))}${quantize(channel(hex, 3))}${quantize(channel(hex, 5))}`;
}

function quantizePalette(colors: string[]): string[] {
  return colors.map((color) => quantizeHex(color));
}

/** Largest per-channel RGB gap across paired palette entries. */
export function paletteDistance(a: string[], b: string[]): number {
  const left = quantizePalette(a);
  const right = quantizePalette(b);
  const length = Math.max(left.length, right.length, 1);
  let max = 0;
  for (let index = 0; index < length; index++) {
    const one = left[index % left.length] ?? "#000000";
    const two = right[index % right.length] ?? "#000000";
    for (const start of [1, 3, 5]) {
      max = Math.max(max, Math.abs(channel(one, start) - channel(two, start)));
    }
  }
  return max;
}

function withCanonicalId(
  mossling: Pick<PreviewMossling, "pattern" | "colors" | "id">,
): PreviewMossling {
  return {
    id: CANONICAL_ID,
    cellIndex: 0,
    pattern: mossling.pattern,
    colors: mossling.colors,
  };
}

function visualFingerprint(
  mossling: Pick<PreviewMossling, "pattern" | "colors" | "id">,
): string {
  const sample = withCanonicalId(mossling);
  const pixels: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      pixels.push(quantizeHex(mosslingPatternColor(sample, x, y)));
    }
  }
  return `${mossling.pattern}:${pixels.join(",")}`;
}

/** True when two mosslings look alike after palette quantization. */
export function visualMatch(
  a: Pick<PreviewMossling, "pattern" | "colors" | "id">,
  b: Pick<PreviewMossling, "pattern" | "colors" | "id">,
): boolean {
  if (a.pattern !== b.pattern) return false;
  if (a.pattern === 4) return visualFingerprint(a) === visualFingerprint(b);
  return paletteDistance(a.colors, b.colors) <= VISUAL_MATCH_THRESHOLD;
}

function buildLineageGraph(living: readonly PreviewMossling[]) {
  const byId = new Map(living.map((mossling) => [mossling.id, mossling]));
  const childrenOf = new Map<number, number[]>();
  for (const mossling of living) {
    if (!mossling.parents) continue;
    for (const parentId of mossling.parents) {
      const children = childrenOf.get(parentId);
      if (children) children.push(mossling.id);
      else childrenOf.set(parentId, [mossling.id]);
    }
  }
  const neighbors = (id: number): number[] => {
    const next = new Set<number>();
    const mossling = byId.get(id);
    if (mossling?.parents) {
      for (const parentId of mossling.parents) {
        next.add(parentId);
        for (const siblingId of childrenOf.get(parentId) ?? []) {
          if (siblingId !== id) next.add(siblingId);
        }
      }
    }
    for (const childId of childrenOf.get(id) ?? []) next.add(childId);
    return [...next];
  };
  return { neighbors };
}

/** Shortest hop count through parent/child/sibling links, or Infinity. */
export function lineageDistance(
  a: PreviewMossling,
  b: PreviewMossling,
  living: readonly PreviewMossling[],
  maxHops = MAX_LINEAGE_HOPS,
): number {
  if (a.id === b.id) return 0;
  const { neighbors } = buildLineageGraph(living);
  const queue: { id: number; depth: number }[] = [{ id: a.id, depth: 0 }];
  const visited = new Set<number>([a.id]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.id === b.id) return current.depth;
    if (current.depth >= maxHops) continue;
    for (const nextId of neighbors(current.id)) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }
  return Infinity;
}

export function lineageClose(
  a: PreviewMossling,
  b: PreviewMossling,
  living: readonly PreviewMossling[],
): boolean {
  return lineageDistance(a, b, living) <= MAX_LINEAGE_HOPS;
}
