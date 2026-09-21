export const PLAGUE_BLAST = 12;
export const PLAGUE_SENSE = 8;
export const PLAGUE_DEATH_MONTH = 6;

/** Full color is 1. Infection starts a little dim and fades until death. */
export function plagueShade(months: number): number {
  const lived = Math.max(0, Math.min(PLAGUE_DEATH_MONTH - 1, months));
  const start = 0.82;
  const end = 0.22;
  return start + ((end - start) * lived) / (PLAGUE_DEATH_MONTH - 1);
}

export function chebyshev(ax: number, ay: number, bx: number, by: number) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** How close a healthy Mossling can stand before catching the black death. */
export function catchRange(toughness: number): 1 | 2 | 3 {
  if (toughness >= 70) return 1;
  if (toughness >= 40) return 2;
  return 3;
}

/**
 * true steps toward a carrier, false steps away, null keeps the random wander.
 * Curiosity is a roll, reduced by cowardice, so it only sometimes pulls them in.
 */
export function plagueHeading(
  sociability: number,
  cowardice: number,
  curiosity: number,
  roll: number,
): boolean | null {
  if (sociability > cowardice) return true;
  if (roll < curiosity * (1 - cowardice)) return true;
  if (cowardice > sociability) return false;
  return null;
}
