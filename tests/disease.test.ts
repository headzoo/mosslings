import assert from "node:assert/strict";
import test from "node:test";
import { provisionCrops } from "../lib/crops";
import { MONTH_SECONDS } from "../lib/game-time";
import {
  catchRange,
  chebyshev,
  plagueHeading,
  plagueShade,
} from "../lib/god/disease";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import { type PreviewMossling, paintedMosslingColor } from "../lib/map-preview";
import { previewTraits } from "../lib/mossling-traits";

const WIDTH = 40;

function fixture(seed = 42): MapData {
  return {
    width: WIDTH,
    height: WIDTH,
    seed,
    cells: Array.from({ length: WIDTH * WIDTH }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}
function at(x: number, y: number) {
  return y * WIDTH + x;
}
function mossling(
  x: number,
  y: number,
  id: number,
  extra: Partial<PreviewMossling> = {},
): PreviewMossling {
  return {
    id,
    cellIndex: at(x, y),
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    ...extra,
  };
}
function traitsOf(seed: number, id: number) {
  return Object.fromEntries(
    previewTraits(seed, id).map((trait) => [trait.label, trait.value]),
  );
}
function findId(
  seed: number,
  match: (traits: Record<string, number>) => boolean,
  except: Set<number> = new Set(),
) {
  for (let id = 0; id < 2500; id++) {
    if (except.has(id)) continue;
    if (match(traitsOf(seed, id))) return id;
  }
  return undefined;
}
function seal(map: MapData, index: number, occupied: Set<number>) {
  const x = index % WIDTH;
  const y = Math.floor(index / WIDTH);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const next = (y + dy) * WIDTH + (x + dx);
    if (!map.cells[next] || occupied.has(next)) continue;
    map.cells[next].terrain = "rock";
  }
}
function scale(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 255) * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

test("plague heading follows sociability, cowardice, and a curiosity roll", () => {
  assert.equal(plagueHeading(0.8, 0.2, 0, 0.99), true);
  assert.equal(plagueHeading(0.2, 0.8, 0.9, 0), true);
  assert.equal(plagueHeading(0.2, 0.8, 0.9, 0.99), false);
  assert.equal(plagueHeading(0.4, 0.4, 0, 0.5), null);
  assert.equal(catchRange(90), 1);
  assert.equal(catchRange(70), 1);
  assert.equal(catchRange(69), 2);
  assert.equal(catchRange(40), 2);
  assert.equal(catchRange(39), 3);
});

test("the blast infects Mosslings within 12 tiles and ignores toughness", () => {
  const world = new GodWorld(fixture(), [
    mossling(22, 10, 1),
    mossling(23, 10, 2),
    mossling(22, 22, 3),
  ]);
  assert.equal(chebyshev(22, 10, 10, 10), 12);
  assert.equal(chebyshev(23, 10, 10, 10), 13);
  assert.equal(world.cast("disease", 10, 10), null);
  const infected = new Map(world.mosslings.map((m) => [m.id, m.plagueMonths]));
  assert.equal(infected.get(1), 0);
  assert.equal(infected.get(2), undefined);
  assert.equal(infected.get(3), 0);
  assert.ok(
    world.events.some(
      (event) => event.message === "2 Mosslings caught the black death.",
    ),
  );
});

test("toughness sets a 1, 2, or 3 tile catch range and does not reset an older infection", () => {
  const seed = 42;
  const used = new Set<number>([900]);
  const take = (match: (traits: Record<string, number>) => boolean) => {
    const id = findId(seed, match, used);
    assert.ok(id !== undefined);
    used.add(id);
    return id;
  };
  const high = take((traits) => traits.Toughness >= 70);
  const highFar = take((traits) => traits.Toughness >= 70);
  const mid = take((traits) => traits.Toughness >= 40 && traits.Toughness < 70);
  const midFar = take(
    (traits) => traits.Toughness >= 40 && traits.Toughness < 70,
  );
  const low = take((traits) => traits.Toughness < 40);
  const lowFar = take((traits) => traits.Toughness < 40);
  const veteran = take(() => true);
  const spots = [
    [21, 20, high],
    [18, 20, highFar],
    [20, 18, mid],
    [20, 23, midFar],
    [23, 20, low],
    [16, 20, lowFar],
    [28, 28, veteran],
  ] as const;
  const map = fixture(seed);
  const occupied = new Set<number>([
    at(20, 20),
    ...spots.map(([x, y]) => at(x, y)),
  ]);
  for (const index of occupied) seal(map, index, occupied);
  const world = new GodWorld(map, [
    mossling(20, 20, 900, { health: 0, plagueMonths: 6 }),
    ...spots.map(([x, y, id]) => mossling(x, y, id)),
  ]);
  const veteranBefore = world.mosslings.find((m) => m.id === veteran);
  assert.ok(veteranBefore);
  veteranBefore.plagueMonths = 2;
  world.advanceTo(MONTH_SECONDS);
  const months = new Map(world.mosslings.map((m) => [m.id, m.plagueMonths]));
  assert.equal(months.get(high), 0);
  assert.equal(months.get(highFar), undefined);
  assert.equal(months.get(mid), 0);
  assert.equal(months.get(midFar), undefined);
  assert.equal(months.get(low), 0);
  assert.equal(months.get(lowFar), undefined);
  assert.equal(months.get(veteran), 3);
  assert.equal(months.get(900), undefined);
});

test("colors dim on infection, keep fading, turn black at 6, and leave at 9", () => {
  const world = new GodWorld(fixture(), [mossling(20, 20, 4)]);
  provisionCrops(world.map, 1, 10);
  world.cast("disease", 20, 20);
  const look = () => world.mosslings.find((m) => m.id === 4);
  const fresh = look();
  assert.ok(fresh);
  assert.equal(fresh.plagueMonths, 0);
  assert.ok(plagueShade(0) < 1);
  assert.equal(
    paintedMosslingColor(fresh, 0, 0),
    scale(fresh.colors[0], plagueShade(0)),
  );
  world.advanceTo(MONTH_SECONDS * 2);
  const early = look();
  assert.ok(early);
  assert.equal(early.plagueMonths, 2);
  assert.ok(plagueShade(2) < plagueShade(0));
  assert.equal(
    paintedMosslingColor(early, 0, 0),
    scale(early.colors[0], plagueShade(2)),
  );
  world.advanceTo(MONTH_SECONDS * 3);
  const dimmed = look();
  assert.ok(dimmed);
  assert.equal(dimmed.plagueMonths, 3);
  assert.ok(plagueShade(3) < plagueShade(2));
  assert.equal(
    paintedMosslingColor(dimmed, 0, 0),
    scale(dimmed.colors[0], plagueShade(3)),
  );
  world.advanceTo(MONTH_SECONDS * 6);
  const dead = look();
  assert.ok(dead);
  assert.equal(dead.health, 0);
  assert.equal(dead.plagueMonths, 6);
  assert.equal(paintedMosslingColor(dead, 0, 0), "#e54320");
  assert.equal(paintedMosslingColor(dead, 1, 0), "#000000");
  assert.equal(paintedMosslingColor(dead, 3, 4), "#e54320");
  assert.equal(world.snapshot().resources.mosslings, 0);
  assert.equal(world.snapshot().resources.killed, 1);
  world.advanceTo(MONTH_SECONDS * 7);
  assert.equal(look(), undefined);
  assert.equal(world.snapshot().resources.killed, 1);
  assert.equal(
    world.events.filter((event) => event.message.includes("succumbed")).length,
    1,
  );
  assert.equal(
    world.events.some((event) =>
      event.message.includes("lost to the elements"),
    ),
    false,
  );
});

test("a black corpse still passes the disease and still blocks its tile", () => {
  const world = new GodWorld(fixture(), [
    mossling(10, 10, 1, { health: 0, plagueMonths: 7 }),
    mossling(11, 10, 2),
  ]);
  const healthy = world.mosslings.find((m) => m.id === 2);
  assert.ok(healthy);
  world.context.move(healthy, 10, 10);
  assert.equal(healthy.cellIndex, at(11, 10));
  world.cast("fire", 0, 0);
  world.tick(0.05);
  assert.equal(healthy.plagueMonths, 0);
  assert.equal(world.mosslings.find((m) => m.id === 1)?.plagueMonths, 7);
});

test("a meteor still removes an infected Mossling before the sixth month", () => {
  const world = new GodWorld(fixture(), [mossling(20, 20, 5)]);
  world.cast("disease", 20, 20);
  world.cast("meteor", 20, 20);
  for (let i = 0; i < 80; i++) world.tick(0.05);
  const body = world.mosslings[0];
  assert.ok(body);
  assert.equal(body.health, 0);
  assert.equal(paintedMosslingColor(body, 0, 0), "#e54320");
  assert.equal(paintedMosslingColor(body, 1, 0), "#000000");
  assert.equal(world.snapshot().resources.killed, 1);
  world.advanceTo(MONTH_SECONDS);
  assert.equal(world.mosslings.length, 0);
  assert.ok(
    world.events.some((event) =>
      event.message.includes("lost to the elements"),
    ),
  );
});

test("cowards step away, social Mosslings step closer, and curiosity only sometimes does", () => {
  const approach = (seed: number, id: number) => {
    const world = new GodWorld(fixture(seed), [
      mossling(20, 20, 9000, { health: 0, plagueMonths: 6 }),
      mossling(20, 25, id),
    ]);
    world.advanceTo(MONTH_SECONDS);
    const moved = world.mosslings.find((m) => m.id === id);
    assert.ok(moved);
    assert.equal(moved.plagueMonths, undefined);
    return Math.floor(moved.cellIndex / WIDTH) - 25;
  };
  const social = findId(
    42,
    (traits) => traits.Sociability >= 70 && traits.Cowardice <= 30,
  );
  assert.ok(social !== undefined);
  assert.equal(approach(42, social), -1);

  let fled = 0;
  let cowards = 0;
  for (let seed = 1; seed <= 80 && cowards < 40; seed++) {
    const id = findId(
      seed,
      (traits) =>
        traits.Cowardice >= 70 &&
        traits.Sociability <= 30 &&
        traits.Curiosity <= 25,
    );
    if (id === undefined) continue;
    const step = approach(seed, id);
    if (step > 0) fled++;
    cowards++;
  }
  assert.ok(cowards >= 30);
  assert.ok(fled >= 28);

  let closer = 0;
  let farther = 0;
  let same = 0;
  let curious = 0;
  for (let seed = 1; seed <= 120 && curious < 40; seed++) {
    const id = findId(
      seed,
      (traits) =>
        traits.Curiosity >= 75 &&
        traits.Sociability <= 35 &&
        traits.Cowardice >= 50 &&
        traits.Cowardice <= 70,
    );
    if (id === undefined) continue;
    const step = approach(seed, id);
    if (step < 0) closer++;
    else if (step > 0) farther++;
    else same++;
    curious++;
  }
  assert.ok(curious >= 30);
  assert.ok(closer >= 3);
  assert.ok(farther >= 3);
  assert.equal(same, 0);
});
