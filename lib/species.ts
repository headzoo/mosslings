import type { PreviewMossling } from "./map-preview";
import { speciesName } from "./species-name";

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
