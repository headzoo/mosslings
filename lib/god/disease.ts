export const PLAGUE_BLAST = 12;
export const PLAGUE_SENSE = 8;
export const PLAGUE_DEATH_MONTH = 6;

/** Sick puke neon the infection pulls toward. */
export const PLAGUE_GREEN: readonly [number, number, number] = [194, 255, 0];

/** How far infection pulls color toward puke-neon green. Starts sick, ends almost full. */
export function plagueTint(months: number): number {
  const lived = Math.max(0, Math.min(PLAGUE_DEATH_MONTH - 1, months));
  const start = 0.42;
  const end = 1;
  return start + ((end - start) * lived) / (PLAGUE_DEATH_MONTH - 1);
}

/** 1 is a healthy hop. Infection stretches the bounce into a slow lurch. */
export function plagueBounceScale(months: number | undefined): number {
  if (months === undefined) return 1;
  const lived = Math.max(0, Math.min(PLAGUE_DEATH_MONTH - 1, months));
  const start = 1.8;
  const end = 4.5;
  return start + ((end - start) * lived) / (PLAGUE_DEATH_MONTH - 1);
}

export function plagueRgb(
  r: number,
  g: number,
  b: number,
  months: number,
): [number, number, number] {
  const t = plagueTint(months);
  const mix = (channel: number, target: number) =>
    Math.round(channel * (1 - t) + target * t);
  return [
    mix(r, PLAGUE_GREEN[0]),
    mix(g, PLAGUE_GREEN[1]),
    mix(b, PLAGUE_GREEN[2]),
  ];
}

export function plagueHex(hex: string, months: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = plagueRgb(
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
    months,
  );
  const channel = (n: number) => n.toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
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
