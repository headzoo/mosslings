import assert from "node:assert/strict";
import test from "node:test";
import { GOD_ACTIONS } from "../lib/god/actions";
import { DisasterAvoidance } from "../lib/god/avoidance";
import { GodWorld } from "../lib/god/engine";
import type { DisasterThreat } from "../lib/god/types";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";

function fixture(size = 31): MapData {
  return {
    width: size,
    height: size,
    seed: 42,
    cells: Array.from({ length: size * size }, () => ({
      terrain: "grass",
      elevation: 0.6,
      moisture: 0.2,
      rockiness: 0.2,
      fertility: 0.5,
    })),
  };
}
function creature(x: number, y: number, id = 1, width = 31): PreviewMossling {
  return {
    id,
    cellIndex: y * width + x,
    health: 100,
    colors: ["#ffe632"],
    pattern: 0,
  };
}
function genes(overrides: Record<string, number> = {}) {
  return new Map(
    Object.entries({
      Speed: 50,
      Courage: 10,
      Cowardice: 90,
      Sociability: 0,
      Toughness: 50,
      "Heat tolerance": 50,
      ...overrides,
    }),
  );
}
function run(
  controller: DisasterAvoidance,
  world: GodWorld,
  threats: DisasterThreat[],
  seconds: number,
) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++)
    controller.step(0.05, world.context, threats);
}
const hazard: DisasterThreat = {
  x: 15,
  y: 15,
  radius: 25,
  severity: 1,
  kind: "impact",
};
const distance = (index: number, x = 15, y = 15) =>
  Math.abs((index % 31) - x) + Math.abs(Math.floor(index / 31) - y);

test("genetic speed changes escape pace to several tiles within one month", () => {
  const fast = new GodWorld(fixture(), [creature(15, 15)]);
  const slow = new GodWorld(fixture(), [creature(15, 15)]);
  run(new DisasterAvoidance(() => genes({ Speed: 90 })), fast, [hazard], 1);
  run(new DisasterAvoidance(() => genes({ Speed: 10 })), slow, [hazard], 1);
  assert.ok(distance(fast.mosslings[0].cellIndex) >= 4);
  assert.ok(
    distance(fast.mosslings[0].cellIndex) >
      distance(slow.mosslings[0].cellIndex),
  );
});

test("cowardice triggers earlier flight at a distance than courage", () => {
  const timid = new GodWorld(fixture(), [creature(22, 15)]);
  const brave = new GodWorld(fixture(), [creature(22, 15)]);
  const threats = [{ ...hazard, radius: 4 }];
  run(new DisasterAvoidance(() => genes()), timid, threats, 0.6);
  run(
    new DisasterAvoidance(() => genes({ Courage: 90, Cowardice: 10 })),
    brave,
    threats,
    0.6,
  );
  assert.notEqual(timid.mosslings[0].cellIndex, 15 * 31 + 22);
  assert.equal(brave.mosslings[0].cellIndex, 15 * 31 + 22);
});

test("heat tolerance reduces fire alarm but does not grant movement through flames", () => {
  const sensitive = new GodWorld(fixture(), [creature(18, 15)]);
  const tolerant = new GodWorld(fixture(), [creature(18, 15)]);
  const threats = [{ ...hazard, radius: 2, kind: "heat" as const }];
  const settings = { Courage: 60, Cowardice: 40 };
  run(
    new DisasterAvoidance(() => genes({ ...settings, "Heat tolerance": 0 })),
    sensitive,
    threats,
    0.7,
  );
  run(
    new DisasterAvoidance(() => genes({ ...settings, "Heat tolerance": 100 })),
    tolerant,
    threats,
    0.7,
  );
  assert.notEqual(sensitive.mosslings[0].cellIndex, 15 * 31 + 18);
  assert.equal(tolerant.mosslings[0].cellIndex, 15 * 31 + 18);
});

test("local panic spreads to sociable neighbors but not isolated or solitary Mosslings", () => {
  const make = () =>
    new GodWorld(fixture(), [
      creature(18, 15),
      creature(22, 15, 2),
      creature(29, 29, 3),
    ]);
  const social = make(),
    solitary = make();
  const threats = [{ ...hazard, radius: 2 }];
  const socialController = new DisasterAvoidance((id) =>
    id === 1
      ? genes()
      : genes({ Courage: 90, Cowardice: 10, Sociability: 100 }),
  );
  const solitaryController = new DisasterAvoidance((id) =>
    id === 1 ? genes() : genes({ Courage: 90, Cowardice: 10, Sociability: 0 }),
  );
  run(socialController, social, threats, 0.1);
  run(solitaryController, solitary, threats, 0.1);
  assert.ok((social.mosslings[1].panic ?? 0) > 0);
  assert.equal(solitary.mosslings[1].panic, 0);
  assert.equal(social.mosslings[2].panic, 0);
  run(socialController, social, threats, 0.7);
  assert.ok(
    social.mosslings[1].cellIndex % 31 > 22,
    "the sociable neighbor follows the outward-moving herd",
  );
  run(socialController, social, [], 3);
  assert.equal(socialController.active, false);
  assert.ok(social.mosslings.every((m) => m.panic === 0));
});

test("escape routes detour around a wall one adjacent tile at a time", () => {
  const map = fixture();
  for (let y = 14; y <= 16; y++) map.cells[y * 31 + 16].terrain = "rock";
  const world = new GodWorld(map, [creature(15, 15)]);
  const controller = new DisasterAvoidance(() => genes({ Speed: 90 }));
  const threats = [{ ...hazard, x: 10, radius: 10 }];
  let before = world.mosslings[0].cellIndex;
  for (let i = 0; i < 60; i++) {
    controller.step(0.05, world.context, threats);
    const after = world.mosslings[0].cellIndex;
    assert.ok(distance(after, before % 31, Math.floor(before / 31)) <= 1);
    assert.equal(world.map.cells[after].terrain, "grass");
    before = after;
  }
  assert.ok(world.mosslings[0].cellIndex % 31 > 16);
});

test("crowds flee without overlapping and respect water, trees, rocks and burning cells", () => {
  const map = fixture();
  map.cells[14 * 31 + 15].terrain = "water";
  map.cells[15 * 31 + 16].tree = { health: 100 };
  map.cells[15 * 31 + 14].terrain = "rock";
  map.cells[17 * 31 + 15].burning = true;
  const world = new GodWorld(map, [
    creature(15, 15),
    creature(15, 16, 2),
    creature(14, 16, 3),
  ]);
  const controller = new DisasterAvoidance(() =>
    genes({ Speed: 90, Sociability: 100 }),
  );
  for (let i = 0; i < 80; i++) {
    controller.step(0.05, world.context, [hazard]);
    assert.equal(new Set(world.mosslings.map((m) => m.cellIndex)).size, 3);
    for (const m of world.mosslings) {
      const cell = world.map.cells[m.cellIndex];
      assert.ok(
        cell && !cell.tree && !cell.burning && cell.terrain === "grass",
      );
    }
  }
});

test("integrated fire escape beats monthly wandering, while trapped Mosslings can die", () => {
  const free = new GodWorld(fixture(), [creature(15, 15)]);
  free.cast("fire", 15, 15);
  free.advanceTo(1);
  assert.ok(free.mosslings.length === 1 && free.mosslings[0].cellIndex !== 480);
  const trappedMap = fixture(1);
  const trapped = new GodWorld(trappedMap, [creature(0, 0, 1, 1)]);
  trapped.cast("meteor", 0, 0);
  trapped.advanceTo(12);
  assert.equal(trapped.mosslings.length, 0);
  trapped.advanceTo(120);
  assert.equal(trapped.mosslings.length, 0);
});

test("benign powers do not panic Mosslings; pause and deterministic replay are preserved", () => {
  const safe = new GodWorld(fixture(), [creature(15, 15)]);
  safe.cast("rain", 15, 15);
  safe.advanceTo(1);
  assert.equal(safe.mosslings[0].cellIndex, 480);
  assert.ok(!safe.mosslings[0].panic);
  const a = new GodWorld(fixture(), [creature(15, 15)]),
    b = new GodWorld(fixture(), [creature(15, 15)]);
  for (const world of [a, b]) {
    world.cast("fire", 15, 15);
    world.advanceTo(1);
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
  const paused = a.snapshot();
  a.advanceTo(1);
  assert.deepEqual(a.snapshot(), paused);
});

test("threats track burning cells, moving storms, upcoming impacts and unhit quake victims", () => {
  const world = new GodWorld(fixture(), []);
  for (const kind of [
    "fire",
    "tornado",
    "meteor",
    "quake",
    "lightning",
  ] as const) {
    const action = GOD_ACTIONS[kind];
    const effect = action.create({ x: 15, y: 15 }, 42, 1);
    action.update(effect, world.context, 0);
    assert.ok(action.threats?.(effect, world.context).length);
    if (kind === "meteor") {
      effect.impacted = true;
      assert.equal(action.threats?.(effect, world.context).length, 0);
    }
    if (kind === "fire") {
      for (const index of effect.marks.keys())
        world.map.cells[index].burning = false;
      assert.equal(action.threats?.(effect, world.context).length, 0);
    }
    if (kind === "quake") {
      effect.hit.add(9);
      assert.ok(action.threats?.(effect, world.context)[0].alreadyHit?.has(9));
    }
    if (kind === "tornado") {
      effect.x = 20;
      assert.equal(action.threats?.(effect, world.context)[0].x, 20);
    }
  }
});
