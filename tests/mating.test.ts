import assert from "node:assert/strict";
import test from "node:test";
import { provisionCrops } from "../lib/crops";
import { MONTH_SECONDS, YEAR_SECONDS } from "../lib/game-time";
import { GodWorld } from "../lib/god/engine";
import { mateMonth } from "../lib/god/mating";
import type { MapData } from "../lib/map";
import { type PreviewMossling, paintedMosslingColor } from "../lib/map-preview";
import {
  approachRadius,
  blendTraits,
  matingChance,
  traitLabels,
  traitValue,
} from "../lib/mossling-traits";

function readings(overrides: Record<string, number>) {
  return traitLabels.map((label) => ({
    label,
    value: overrides[label] ?? 50,
  }));
}

function creature(
  id: number,
  x: number,
  y: number,
  width: number,
  overrides: Record<string, number>,
  colors = ["#ff0000", "#00ff00", "#0000ff"],
  pattern = 0,
): PreviewMossling {
  return {
    id,
    cellIndex: y * width + x,
    health: 100,
    colors: [...colors],
    pattern,
    traits: readings(overrides),
  };
}

function step(
  mosslings: PreviewMossling[],
  width: number,
  height: number,
  random: () => number = () => 0,
  elapsed: number = MONTH_SECONDS,
) {
  const occupied = new Set(mosslings.map((mossling) => mossling.cellIndex));
  let next = Math.max(-1, ...mosslings.map((mossling) => mossling.id)) + 1;
  return mateMonth({
    mosslings,
    width,
    height,
    elapsed,
    random,
    isPanicked: () => false,
    canMoveTo: (_mossling, x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return !occupied.has(y * width + x);
    },
    move: (mossling, x, y) => {
      const index = y * width + x;
      occupied.delete(mossling.cellIndex);
      mossling.cellIndex = index;
      occupied.add(index);
    },
    spawn: (child) => {
      mosslings.push(child);
      occupied.add(child.cellIndex);
    },
    nextId: () => next++,
  });
}

function grass(width: number, height: number): MapData {
  return {
    width,
    height,
    seed: 7,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.5,
      rockiness: 0.2,
    })),
  };
}

const brave = {
  Courage: 100,
  Cowardice: 0,
  Fertility: 80,
  Sociability: 80,
  Curiosity: 80,
};
const timid = {
  Courage: 0,
  Cowardice: 100,
  Fertility: 80,
  Sociability: 80,
  Curiosity: 80,
};

test("courage sets a 1 to 3 tile mating range", () => {
  assert.equal(approachRadius(readings({ Courage: 100, Cowardice: 0 })), 3);
  assert.equal(approachRadius(readings({ Courage: 0, Cowardice: 100 })), 1);
  const perfect = readings({
    Fertility: 100,
    Sociability: 100,
    Curiosity: 100,
    Courage: 100,
    Cowardice: 0,
  });
  const poor = readings({
    Fertility: 0,
    Sociability: 0,
    Curiosity: 0,
    Courage: 0,
    Cowardice: 100,
  });
  assert.equal(matingChance(perfect, perfect), 0.9);
  assert.equal(matingChance(poor, poor), 0.05);
  const child = blendTraits(
    readings({ Courage: 40 }),
    readings({ Courage: 60 }),
    () => 0,
  );
  assert.equal(traitValue(child, "Courage"), 48);
  assert.equal(traitValue(child, "Cowardice"), 52);
});

test("a brave Mossling closes from 3 tiles, and a timid one waits until they touch", () => {
  const boldA = creature(1, 0, 0, 8, brave);
  const boldB = creature(2, 3, 0, 8, brave);
  step([boldA, boldB], 8, 3);
  assert.equal(boldA.cellIndex, 1);
  assert.equal(boldB.cellIndex, 2);
  assert.equal(boldA.ritual, undefined);

  const shyA = creature(1, 0, 0, 8, timid);
  const shyB = creature(2, 3, 0, 8, timid);
  step([shyA, shyB], 8, 3);
  assert.equal(shyA.cellIndex, 0);
  assert.equal(shyB.cellIndex, 3);

  const touchingA = creature(1, 0, 0, 8, timid);
  const touchingB = creature(2, 1, 0, 8, timid);
  step([touchingA, touchingB], 8, 3, () => 0);
  assert.equal(touchingA.ritual?.phase, "courtship");
  assert.equal(touchingA.cellIndex, 0);
  assert.equal(touchingB.cellIndex, 1);
});

test("courtship holds for 3 months, bears a blended child on the 4th, then the trio will not mate", () => {
  const parentA = creature(
    1,
    2,
    2,
    7,
    {
      Courage: 80,
      Cowardice: 20,
      Fertility: 80,
      Sociability: 40,
      Curiosity: 60,
    },
    ["#ff0000", "#00ff00", "#0000ff"],
    1,
  );
  const parentB = creature(
    2,
    3,
    2,
    7,
    {
      Courage: 40,
      Cowardice: 60,
      Fertility: 40,
      Sociability: 80,
      Curiosity: 20,
    },
    ["#0000ff", "#ffff00", "#00ff00"],
    4,
  );
  const family = [parentA, parentB];
  step(family, 7, 7, () => 0);
  assert.equal(family.length, 2);
  assert.equal(parentA.ritual?.months, 1);
  assert.equal(parentA.cellIndex, 2 * 7 + 2);
  assert.equal(parentB.cellIndex, 2 * 7 + 3);
  step(family, 7, 7, () => 0);
  assert.equal(parentA.ritual?.months, 2);
  assert.equal(parentA.cellIndex, 2 * 7 + 2);
  step(family, 7, 7, () => 0);
  assert.equal(parentA.ritual?.months, 3);
  assert.equal(family.length, 2);
  step(family, 7, 7, () => 0);
  assert.equal(family.length, 3);
  const child = family[2];
  assert.ok(child);
  assert.deepEqual(child.parents, [1, 2]);
  assert.equal(parentA.cellIndex, 2 * 7 + 2);
  assert.equal(parentB.cellIndex, 2 * 7 + 3);
  assert.equal(child.colors[0], "#800080");
  assert.equal(child.pattern, 1);
  assert.equal(traitValue(child.traits, "Courage"), 58);
  assert.equal(traitValue(child.traits, "Cowardice"), 42);
  assert.equal(traitValue(child.traits, "Fertility"), 58);
  assert.equal(parentA.ritual?.phase, "family");
  assert.equal(child.ritual?.since, parentA.ritual?.since);

  step(family, 7, 7, () => 0);
  assert.equal(parentA.ritual, undefined);
  assert.equal(parentB.ritual, undefined);
  assert.equal(child.ritual, undefined);
  assert.ok(
    parentA.wontMate?.includes(2) && parentA.wontMate?.includes(child.id),
  );
  assert.ok(
    parentB.wontMate?.includes(1) && parentB.wontMate?.includes(child.id),
  );
  assert.ok(child.wontMate?.includes(1) && child.wontMate?.includes(2));

  parentA.cellIndex = 2 * 7 + 2;
  parentB.cellIndex = 2 * 7 + 3;
  child.cellIndex = 0;
  step(family, 7, 7, () => 0);
  assert.equal(family.length, 3);
  assert.equal(parentA.ritual, undefined);
  assert.equal(parentB.ritual, undefined);
  assert.equal(child.ritual, undefined);
});

test("parents wait a year after family dispersal before courting again", () => {
  const parentA = creature(1, 2, 2, 7, brave);
  const parentB = creature(2, 3, 2, 7, brave);
  const family = [parentA, parentB];
  for (let month = 1; month <= 5; month++) {
    step(family, 7, 7, () => 0, month * MONTH_SECONDS);
  }
  assert.equal(parentA.lastMatedAt, MONTH_SECONDS * 5);
  assert.equal(parentB.lastMatedAt, MONTH_SECONDS * 5);

  const child = family.find((mossling) => mossling.parents);
  if (child) child.cellIndex = 0;

  const suitor = creature(4, 1, 2, 7, brave);
  family.push(suitor);
  step(family, 7, 7, () => 0, parentA.lastMatedAt! + MONTH_SECONDS);
  assert.equal(parentA.ritual, undefined);

  step(family, 7, 7, () => 0, parentA.lastMatedAt! + YEAR_SECONDS);
  assert.equal(parentA.ritual?.phase, "courtship");
  assert.equal(parentA.ritual?.partnerId, 4);
});

test("a cancelled courtship does not start the year-long mating cooldown", () => {
  const survivor = creature(1, 0, 0, 8, brave);
  const lost = creature(2, 1, 0, 8, brave);
  const pair = [survivor, lost];
  step(pair, 8, 3, () => 0, MONTH_SECONDS);
  assert.equal(survivor.ritual?.phase, "courtship");
  lost.health = 0;
  step(pair, 8, 3, () => 0, MONTH_SECONDS * 2);
  assert.equal(survivor.ritual, undefined);
  assert.equal(survivor.lastMatedAt, undefined);

  const suitor = creature(3, 1, 0, 8, brave);
  pair.push(suitor);
  step(pair, 8, 3, () => 0, MONTH_SECONDS * 3);
  assert.equal(survivor.ritual?.phase, "courtship");
  assert.equal(survivor.ritual?.partnerId, 3);
});

test("a partner's death cancels the courtship before a child is born", () => {
  const parentA = creature(1, 2, 2, 7, brave);
  const parentB = creature(2, 3, 2, 7, brave);
  const pair = [parentA, parentB];
  step(pair, 7, 7, () => 0);
  assert.equal(parentA.ritual?.phase, "courtship");
  parentB.health = 0;
  step(pair, 7, 7, () => 0);
  assert.equal(parentA.ritual, undefined);
  assert.equal(pair.length, 2);
});

test("the played world keeps a courting pair still, then separates the family for good", () => {
  const world = new GodWorld(grass(8, 3), [
    creature(1, 0, 0, 8, brave),
    creature(2, 3, 0, 8, brave),
  ]);
  provisionCrops(world.map, 2, 4);
  world.advanceTo(MONTH_SECONDS);
  assert.deepEqual(
    world.mosslings.map((mossling) => mossling.cellIndex),
    [1, 2],
  );

  const parents = new GodWorld(grass(9, 9), [
    creature(1, 2, 2, 9, brave, ["#ff0000", "#00ff00", "#0000ff"], 1),
    creature(
      2,
      3,
      2,
      9,
      { ...brave, Courage: 40, Cowardice: 60 },
      ["#0000ff", "#ffff00", "#00ff00"],
      4,
    ),
  ]);
  provisionCrops(parents.map, 4, 6);
  const [parentA, parentB] = parents.mosslings;
  assert.ok(parentA && parentB);
  parentA.ritual = {
    partnerId: parentB.id,
    months: 3,
    since: 0,
    phase: "courtship",
  };
  parentB.ritual = {
    partnerId: parentA.id,
    months: 3,
    since: 0,
    phase: "courtship",
  };
  parents.advanceTo(MONTH_SECONDS);
  assert.equal(parents.mosslings.length, 3);
  assert.equal(parentA.cellIndex, 2 * 9 + 2);
  assert.equal(parentB.cellIndex, 2 * 9 + 3);
  const child = parents.mosslings.find((mossling) => mossling.parents);
  assert.ok(child);
  assert.deepEqual(child.parents, [parentA.id, parentB.id]);
  assert.equal(child.colors[0], "#800080");
  assert.ok(child.pattern === 1 || child.pattern === 4);
  const courage = traitValue(child.traits, "Courage");
  assert.ok(Math.abs(courage - 70) <= 2);
  assert.equal(traitValue(child.traits, "Cowardice"), 100 - courage);
  assert.ok(
    parents.events.some((event) => event.message === "1 Mossling was born."),
  );
  assert.equal(parents.snapshot().resources.born, 1);
  assert.equal(parentA.ritual?.phase, "family");

  parents.advanceTo(MONTH_SECONDS * 2);
  assert.equal(parentA.ritual, undefined);
  assert.equal(parentB.ritual, undefined);
  assert.equal(child.ritual, undefined);
  const bx = parentB.cellIndex % 9;
  const by = Math.floor(parentB.cellIndex / 9);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    parents.context.move(parentA, bx + dx, by + dy);
    if (
      Math.max(
        Math.abs((parentA.cellIndex % 9) - bx),
        Math.abs(Math.floor(parentA.cellIndex / 9) - by),
      ) === 1
    )
      break;
  }
  assert.equal(
    Math.max(
      Math.abs((parentA.cellIndex % 9) - bx),
      Math.abs(Math.floor(parentA.cellIndex / 9) - by),
    ),
    1,
  );
  parents.advanceTo(MONTH_SECONDS * 3);
  assert.equal(parents.mosslings.length, 3);
  assert.equal(
    parents.mosslings.some((mossling) => mossling.ritual),
    false,
  );

  const doomed = new GodWorld(grass(5, 5), [
    creature(1, 1, 1, 5, brave),
    creature(2, 2, 1, 5, brave),
  ]);
  provisionCrops(doomed.map, 2, 6);
  const [survivor, lost] = doomed.mosslings;
  assert.ok(survivor && lost);
  survivor.ritual = {
    partnerId: lost.id,
    months: 1,
    since: 0,
    phase: "courtship",
  };
  lost.ritual = {
    partnerId: survivor.id,
    months: 1,
    since: 0,
    phase: "courtship",
  };
  doomed.context.damage(lost.cellIndex, 10000, "impact");
  doomed.tick(0.05);
  assert.equal(doomed.mosslings.length, 2);
  assert.equal(
    doomed.mosslings.find((m) => m.id === survivor.id)?.ritual,
    undefined,
  );
  assert.equal(doomed.mosslings.find((m) => m.id === lost.id)?.health, 0);
  doomed.advanceTo(MONTH_SECONDS * 4);
  assert.equal(doomed.mosslings.length, 1);
});

test("courting colors stay the same as a Mossling at rest", () => {
  const shared = {
    partnerId: 2,
    months: 1,
    since: 0,
    phase: "courtship" as const,
  };
  const mossling: PreviewMossling = {
    id: 1,
    cellIndex: 0,
    colors: ["#336699", "#88aa44", "#eedd88"],
    pattern: 0,
    ritual: shared,
  };
  const partner: PreviewMossling = {
    ...mossling,
    id: 2,
    ritual: { ...shared, partnerId: 1 },
  };
  const resting: PreviewMossling = { ...mossling, ritual: undefined };
  assert.equal(
    paintedMosslingColor(mossling, 3, 3),
    paintedMosslingColor(partner, 3, 3),
  );
  assert.equal(
    paintedMosslingColor(mossling, 3, 3),
    paintedMosslingColor(resting, 3, 3),
  );
});
