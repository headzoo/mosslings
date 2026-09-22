import type { PreviewMossling } from "../map-preview";
import { approachRadius, blendTraits, matingChance } from "../mossling-traits";
import { addToBucket, eachInReach } from "./shared";

export interface MateMonthResult {
  born: number;
  busy: Set<number>;
}

interface MateMonthInput {
  mosslings: PreviewMossling[];
  width: number;
  height: number;
  elapsed: number;
  random: () => number;
  isPanicked: (id: number) => boolean;
  canMoveTo: (mossling: PreviewMossling, x: number, y: number) => boolean;
  move: (mossling: PreviewMossling, x: number, y: number) => void;
  spawn: (child: PreviewMossling) => void;
  nextId: () => number;
}

const alive = (
  mossling: PreviewMossling | undefined,
): mossling is PreviewMossling => !!mossling && (mossling.health ?? 100) > 0;

const rejects = (mossling: PreviewMossling, id: number) =>
  mossling.wontMate?.includes(id) ?? false;

function forbid(mossling: PreviewMossling, ...ids: number[]) {
  mossling.wontMate = [...new Set([...(mossling.wontMate ?? []), ...ids])];
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function pos(cell: number, width: number) {
  return { x: cell % width, y: Math.floor(cell / width) };
}

function mixHex(a: string, b: string) {
  const channel = (hex: string, start: number) =>
    Number.parseInt(hex.slice(start, start + 2), 16);
  const mixed = [1, 3, 5].map((start) =>
    Math.round((channel(a, start) + channel(b, start)) / 2),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function mixColors(a: string[], b: string[]) {
  const length = Math.max(a.length, b.length, 1);
  return Array.from({ length }, (_, index) =>
    mixHex(a[index % a.length] ?? "#000000", b[index % b.length] ?? "#000000"),
  );
}

function stepToward(
  mossling: PreviewMossling,
  target: { x: number; y: number },
  width: number,
  random: () => number,
  canMoveTo: MateMonthInput["canMoveTo"],
  move: MateMonthInput["move"],
) {
  const from = pos(mossling.cellIndex, width);
  const dx = Math.sign(target.x - from.x);
  const dy = Math.sign(target.y - from.y);
  const horizontal: [number, number] = [dx, 0];
  const vertical: [number, number] = [0, dy];
  const options: [number, number][] = [];
  if (dx && dy) {
    if (Math.abs(target.x - from.x) > Math.abs(target.y - from.y))
      options.push(horizontal, vertical);
    else if (Math.abs(target.y - from.y) > Math.abs(target.x - from.x))
      options.push(vertical, horizontal);
    else if (random() < 0.5) options.push(horizontal, vertical);
    else options.push(vertical, horizontal);
  } else if (dx) options.push(horizontal);
  else if (dy) options.push(vertical);
  const origin = mossling.cellIndex;
  for (const [sx, sy] of options) {
    if (!canMoveTo(mossling, from.x + sx, from.y + sy)) continue;
    move(mossling, from.x + sx, from.y + sy);
    if (mossling.cellIndex !== origin) return true;
  }
  return false;
}

function clearRitual(mossling: PreviewMossling | undefined) {
  if (mossling?.ritual) mossling.ritual = undefined;
}

/** One monthly pass: finish rituals, then let free Mosslings approach or begin a courtship. */
export function mateMonth(input: MateMonthInput): MateMonthResult {
  const {
    mosslings,
    width,
    height,
    elapsed,
    random,
    isPanicked,
    canMoveTo,
    move,
    spawn,
    nextId,
  } = input;
  const busy = new Set<number>();
  const byId = new Map(mosslings.map((mossling) => [mossling.id, mossling]));
  let born = 0;
  const place = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height;

  for (const mossling of mosslings) {
    const ritual = mossling.ritual;
    if (!ritual || ritual.role === "child" || !alive(mossling)) continue;
    if (mossling.id > ritual.partnerId) continue;
    const partner = byId.get(ritual.partnerId);
    const child = ritual.childId != null ? byId.get(ritual.childId) : undefined;
    const linked =
      alive(partner) &&
      partner.ritual?.partnerId === mossling.id &&
      partner.ritual.role !== "child";
    if (!linked) {
      if (child?.ritual?.role === "child") clearRitual(child);
      clearRitual(mossling);
      if (partner?.ritual?.partnerId === mossling.id) clearRitual(partner);
      continue;
    }
    const apart = chebyshev(
      pos(mossling.cellIndex, width),
      pos(partner.cellIndex, width),
    );
    const reachA = approachRadius(mossling.traits);
    const reachB = approachRadius(partner.traits);
    if (isPanicked(mossling.id) || isPanicked(partner.id)) {
      if (apart > reachA && apart > reachB) {
        clearRitual(child);
        clearRitual(mossling);
        clearRitual(partner);
      }
      continue;
    }
    if (ritual.phase === "family") {
      clearRitual(child);
      clearRitual(mossling);
      clearRitual(partner);
      continue;
    }
    if (apart !== 1) {
      if (apart > reachA && apart > reachB) {
        clearRitual(mossling);
        clearRitual(partner);
        continue;
      }
      if (apart <= reachA)
        stepToward(
          mossling,
          pos(partner.cellIndex, width),
          width,
          random,
          canMoveTo,
          move,
        );
      if (apart <= reachB)
        stepToward(
          partner,
          pos(mossling.cellIndex, width),
          width,
          random,
          canMoveTo,
          move,
        );
      busy.add(mossling.id);
      busy.add(partner.id);
      continue;
    }
    if (ritual.months >= 3) {
      const site = birthSite(mossling, partner);
      if (!site) {
        busy.add(mossling.id);
        busy.add(partner.id);
        continue;
      }
      const id = nextId();
      const traits = blendTraits(
        mossling.traits ?? [],
        partner.traits ?? [],
        random,
      );
      const childMossling: PreviewMossling = {
        id,
        cellIndex: site.y * width + site.x,
        health: 100,
        colors: mixColors(mossling.colors, partner.colors),
        pattern: random() < 0.5 ? mossling.pattern : partner.pattern,
        traits,
        parents: [mossling.id, partner.id],
        wontMate: [mossling.id, partner.id],
        ritual: {
          partnerId: mossling.id,
          months: 1,
          since: ritual.since,
          phase: "family",
          role: "child",
        },
      };
      spawn(childMossling);
      byId.set(id, childMossling);
      forbid(mossling, partner.id, id);
      forbid(partner, mossling.id, id);
      const family = {
        months: 1,
        since: ritual.since,
        phase: "family" as const,
        childId: id,
      };
      mossling.ritual = { ...family, partnerId: partner.id };
      partner.ritual = { ...family, partnerId: mossling.id };
      busy.add(mossling.id);
      busy.add(partner.id);
      busy.add(id);
      born++;
      continue;
    }
    const months = ritual.months + 1;
    const partnerRitual = partner.ritual;
    mossling.ritual = { ...ritual, months };
    if (partnerRitual) partner.ritual = { ...partnerRitual, months };
    busy.add(mossling.id);
    busy.add(partner.id);
  }

  const free = mosslings.filter(
    (mossling) =>
      alive(mossling) && !mossling.ritual && !isPanicked(mossling.id),
  );
  const at = new Map(
    free.map((mossling) => [mossling.id, pos(mossling.cellIndex, width)]),
  );
  const nearby = new Map<string, PreviewMossling[]>();
  const freeIndex = new Map(
    free.map((mossling, index) => [mossling.id, index]),
  );
  for (const mossling of free) {
    const origin = at.get(mossling.id);
    if (origin) addToBucket(nearby, origin.x, origin.y, mossling);
  }
  const adjacent: {
    a: PreviewMossling;
    b: PreviewMossling;
    chance: number;
  }[] = [];
  for (const a of free) {
    const originA = at.get(a.id);
    if (!originA) continue;
    eachInReach(nearby, originA.x, originA.y, 1, (b) => {
      const left = freeIndex.get(a.id) ?? 0;
      const right = freeIndex.get(b.id) ?? 0;
      if (right <= left) return;
      if (rejects(a, b.id) || rejects(b, a.id)) return;
      const originB = at.get(b.id);
      if (!originB) return;
      const distance = chebyshev(originA, originB);
      const reachA = approachRadius(a.traits);
      const reachB = approachRadius(b.traits);
      if (distance <= 1 && distance <= reachA && distance <= reachB)
        adjacent.push({ a, b, chance: matingChance(a.traits, b.traits) });
    });
  }
  adjacent.sort(
    (left, right) =>
      right.chance - left.chance ||
      left.a.id - right.a.id ||
      left.b.id - right.b.id,
  );
  const bonded = new Set<number>();
  for (const pair of adjacent) {
    if (bonded.has(pair.a.id) || bonded.has(pair.b.id)) continue;
    if (random() >= pair.chance) continue;
    const started = {
      months: 1,
      since: elapsed,
      phase: "courtship" as const,
    };
    pair.a.ritual = { ...started, partnerId: pair.b.id };
    pair.b.ritual = { ...started, partnerId: pair.a.id };
    bonded.add(pair.a.id);
    bonded.add(pair.b.id);
    busy.add(pair.a.id);
    busy.add(pair.b.id);
  }

  for (const mossling of free) {
    if (bonded.has(mossling.id)) continue;
    const origin = at.get(mossling.id);
    if (!origin) continue;
    const reach = approachRadius(mossling.traits);
    let best:
      | { target: PreviewMossling; chance: number; distance: number }
      | undefined;
    eachInReach(nearby, origin.x, origin.y, reach, (other) => {
      if (other.id === mossling.id || bonded.has(other.id)) return;
      if (rejects(mossling, other.id) || rejects(other, mossling.id)) return;
      const there = at.get(other.id);
      if (!there) return;
      const distance = chebyshev(origin, there);
      if (distance <= 1 || distance > reach) return;
      const chance = matingChance(mossling.traits, other.traits);
      if (
        !best ||
        chance > best.chance ||
        (chance === best.chance &&
          (distance < best.distance || other.id < best.target.id))
      )
        best = { target: other, chance, distance };
    });
    if (!best) continue;
    const there = at.get(best.target.id);
    if (!there) continue;
    if (stepToward(mossling, there, width, random, canMoveTo, move))
      busy.add(mossling.id);
  }

  return { born, busy };

  function birthSite(a: PreviewMossling, b: PreviewMossling) {
    const around = (x: number, y: number) => {
      const spots: { x: number; y: number }[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (place(nx, ny) && canMoveTo(a, nx, ny))
            spots.push({ x: nx, y: ny });
        }
      }
      return spots;
    };
    const left = pos(a.cellIndex, width);
    const right = pos(b.cellIndex, width);
    const besideB = new Set(
      around(right.x, right.y).map((spot) => `${spot.x},${spot.y}`),
    );
    const shared = around(left.x, left.y).filter((spot) =>
      besideB.has(`${spot.x},${spot.y}`),
    );
    const pool = shared.length
      ? shared
      : uniqueSpots([...around(left.x, left.y), ...around(right.x, right.y)]);
    if (!pool.length) return;
    return pool[Math.floor(random() * pool.length)];
  }
}

function uniqueSpots(spots: { x: number; y: number }[]) {
  const seen = new Set<string>();
  return spots.filter((spot) => {
    const key = `${spot.x},${spot.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
