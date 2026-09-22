const nouns = [
  "moss",
  "fern",
  "puddle",
  "crumb",
  "bun",
  "muffin",
  "pebble",
  "dumpling",
  "clover",
  "thimble",
  "button",
  "cobble",
  "sprout",
  "lichen",
  "reed",
  "loaf",
  "pod",
  "jam",
  "nub",
  "pip",
  "fig",
  "cap",
  "dew",
] as const;

const MAX_LENGTH = 10;

/** Leading consonants plus the first vowel, and whatever follows that vowel. */
function vowelSplit(word: string): { head: string; tail: string } | null {
  const match = /^([^aeiou]*)([aeiou]+)(.*)$/i.exec(word);
  if (!match?.[2]) return null;
  return { head: `${match[1] ?? ""}${match[2]}`, tail: match[3] ?? "" };
}

function capitalize(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

/** Head of the first noun plus the tail of the second, when that reads as one short word. */
export function blendNouns(first: string, second: string): string | null {
  const left = vowelSplit(first);
  const right = vowelSplit(second);
  if (!left || !right?.tail) return null;
  const raw = `${left.head}${right.tail}`.toLowerCase();
  if (raw.length < 2 || raw.length > MAX_LENGTH) return null;
  if (raw === first.toLowerCase() || raw === second.toLowerCase()) return null;
  return capitalize(raw);
}

function mix(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

function hashKey(key: string): number {
  let state = 2166136261;
  for (let index = 0; index < key.length; index++) {
    state = Math.imul(state ^ key.charCodeAt(index), 16777619);
  }
  return state >>> 0;
}

/** A stable species name. The same key always yields the same word. */
export function speciesName(key: string): string {
  let state = hashKey(key);
  let fallback = capitalize(nouns[0]);
  for (let attempt = 0; attempt < nouns.length; attempt++) {
    state = mix(state);
    const first = state % nouns.length;
    state = mix(state);
    const second = state % (nouns.length - 1);
    const other = second >= first ? second + 1 : second;
    const left = nouns[first] ?? nouns[0];
    const right = nouns[other] ?? nouns[1];
    const blended = blendNouns(left, right);
    if (blended) return blended;
    const split = vowelSplit(left);
    fallback = capitalize(
      `${split?.head ?? left}${vowelSplit(right)?.tail ?? ""}`.slice(
        0,
        MAX_LENGTH,
      ),
    );
  }
  return fallback;
}
