import type { PreviewMossling } from "./map-preview";
import { speciesName } from "./species-name";
import {
  lineageGraph,
  lineageHops,
  MAX_LINEAGE_HOPS,
  visualMatch,
} from "./species-similarity";

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    let current = index;
    while (this.parent[current] !== root) {
      const next = this.parent[current];
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  union(a: number, b: number) {
    const left = this.find(a);
    const right = this.find(b);
    if (left !== right) this.parent[right] = left;
  }
}

export interface SpeciesGroup {
  key: string;
  pattern: number;
  colors: string[];
  count: number;
  name: string;
  members: PreviewMossling[];
}

/** Living Mosslings that share a palette and pattern draw the same 8×8 square. */
export function speciesKey(
  mossling: Pick<PreviewMossling, "pattern" | "colors">,
): string {
  return `${mossling.pattern}:${mossling.colors.join(",")}`;
}

export function groupSpecies(
  mosslings: readonly PreviewMossling[],
): SpeciesGroup[] {
  const groups = new Map<string, SpeciesGroup>();
  for (const mossling of mosslings) {
    if ((mossling.health ?? 100) <= 0) continue;
    const key = speciesKey(mossling);
    const group = groups.get(key);
    if (group) {
      group.members.push(mossling);
      group.count += 1;
    } else {
      groups.set(key, {
        key,
        pattern: mossling.pattern,
        colors: mossling.colors,
        count: 1,
        name: speciesName(key),
        members: [mossling],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

function canonicalMember(members: readonly PreviewMossling[]): PreviewMossling {
  const buckets = new Map<string, PreviewMossling[]>();
  for (const member of members) {
    const key = speciesKey(member);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(member);
    else buckets.set(key, [member]);
  }
  let bestKey = speciesKey(members[0]);
  let bestCount = 0;
  let bestId = Infinity;
  for (const [key, bucket] of buckets) {
    const sample = bucket[0];
    if (!sample) continue;
    const count = bucket.length;
    const id = Math.min(...bucket.map((member) => member.id));
    if (
      count > bestCount ||
      (count === bestCount && id < bestId) ||
      (count === bestCount && id === bestId && key < bestKey)
    ) {
      bestKey = key;
      bestCount = count;
      bestId = id;
    }
  }
  const bucket = buckets.get(bestKey) ?? members;
  return (
    bucket.find((member) => member.id === bestId) ?? bucket[0] ?? members[0]
  );
}

/** Group living mosslings by similar looks or close ancestry. */
export function clusterSpecies(
  mosslings: readonly PreviewMossling[],
): SpeciesGroup[] {
  const living = mosslings.filter((mossling) => (mossling.health ?? 100) > 0);
  if (living.length === 0) return [];

  const forest = new UnionFind(living.length);
  const lineage = lineageGraph(living);
  for (let left = 0; left < living.length; left++) {
    for (let right = left + 1; right < living.length; right++) {
      const a = living[left];
      const b = living[right];
      if (!a || !b) continue;
      if (visualMatch(a, b) || lineageHops(a, b, lineage) <= MAX_LINEAGE_HOPS) {
        forest.union(left, right);
      }
    }
  }

  const clusters = new Map<number, PreviewMossling[]>();
  for (let index = 0; index < living.length; index++) {
    const mossling = living[index];
    if (!mossling) continue;
    const root = forest.find(index);
    const members = clusters.get(root);
    if (members) members.push(mossling);
    else clusters.set(root, [mossling]);
  }

  const groups = [...clusters.values()].map((members) => {
    const canonical = canonicalMember(members);
    const key = speciesKey(canonical);
    return {
      key,
      pattern: canonical.pattern,
      colors: canonical.colors,
      count: members.length,
      name: speciesName(key),
      members,
    };
  });

  return groups.sort(
    (a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/** Cluster key for one mossling, or its exact look when alone. */
export function speciesKeyFor(
  mossling: PreviewMossling,
  mosslings: readonly PreviewMossling[],
): string {
  if ((mossling.health ?? 100) <= 0) return speciesKey(mossling);
  const cluster = clusterSpecies(mosslings).find((group) =>
    group.members.some((member) => member.id === mossling.id),
  );
  return cluster?.key ?? speciesKey(mossling);
}

/** Member whose tile center is closest to a point, in tile coordinates. */
export function nearestMember(
  members: readonly PreviewMossling[],
  width: number,
  focus: { x: number; y: number },
): PreviewMossling | undefined {
  let best: PreviewMossling | undefined;
  let bestDist = Infinity;
  for (const member of members) {
    const x = (member.cellIndex % width) + 0.5;
    const y = Math.floor(member.cellIndex / width) + 0.5;
    const dist = (x - focus.x) ** 2 + (y - focus.y) ** 2;
    if (
      dist < bestDist ||
      (dist === bestDist && best !== undefined && member.id < best.id)
    ) {
      best = member;
      bestDist = dist;
    }
  }
  return best;
}
