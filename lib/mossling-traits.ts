export const traitLabels = [
  "Courage",
  "Cowardice",
  "Curiosity",
  "Sociability",
  "Speed",
  "Heat tolerance",
  "Water tolerance",
  "Toughness",
  "Metabolism",
  "Lifespan",
  "Fertility",
  "Food drive",
] as const;

export interface TraitReading {
  label: string;
  value: number;
}

export function previewTraits(seed: number, id: number): TraitReading[] {
  let state = (seed ^ Math.imul(id + 1, 0x9e3779b9)) >>> 0;
  const values = traitLabels.map(() => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return 10 + Math.floor((state / 4294967296) * 81);
  });
  values[1] = 100 - values[0];
  return traitLabels.map((label, index) => ({ label, value: values[index] }));
}

export function traitValue(
  traits: readonly TraitReading[] | undefined,
  label: string,
): number {
  return traits?.find((trait) => trait.label === label)?.value ?? 50;
}

/** Chebyshev tiles a mossling will cross to reach a mate. High courage reaches 3; low courage or high cowardice stays at 1. */
export function approachRadius(
  traits: readonly TraitReading[] | undefined,
): number {
  const courage = traitValue(traits, "Courage") / 100;
  const cowardice = traitValue(traits, "Cowardice") / 100;
  const boldness = Math.min(1, Math.max(0, courage - cowardice * 0.5));
  return 1 + Math.round(boldness * 2);
}

/** Chance an adjacent pair begins a courtship. Clamped so a poor match can still succeed and a perfect one can still fail. */
export function matingChance(
  a: readonly TraitReading[] | undefined,
  b: readonly TraitReading[] | undefined,
): number {
  const avg = (label: string) =>
    (traitValue(a, label) + traitValue(b, label)) / 200;
  const score =
    0.45 * avg("Fertility") +
    0.2 * avg("Sociability") +
    0.15 * avg("Curiosity") +
    0.2 * avg("Courage") * (1 - avg("Cowardice"));
  return Math.min(0.9, Math.max(0.05, score));
}

/** Rounded parental average, with a -2..+2 jitter so lineages do not collapse to the mean. Cowardice stays the inverse of courage. */
export function blendTraits(
  a: readonly TraitReading[],
  b: readonly TraitReading[],
  random: () => number,
): TraitReading[] {
  const blended = traitLabels.map((label) => {
    const jitter = Math.floor(random() * 5) - 2;
    const value =
      Math.round((traitValue(a, label) + traitValue(b, label)) / 2) + jitter;
    return { label, value: Math.min(100, Math.max(0, value)) };
  });
  const courage = blended[0]?.value ?? 50;
  blended[1] = { label: "Cowardice", value: 100 - courage };
  return blended;
}
