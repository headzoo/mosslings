import assert from "node:assert/strict";
import test from "node:test";
import {
  COUGH_FRAME_SECONDS,
  COUGH_POP_ROWS,
  COUGH_ROWS,
  COUGH_SCALE,
} from "../lib/cough";
import {
  CURSE_CYCLE_SECONDS,
  CURSE_GAP_SECONDS,
  CURSE_PLAY_SECONDS,
  CURSE_TEXT,
  CURSE_ZOOMS,
  curseMotion,
  cursesInView,
  cursing,
  markCurse,
} from "../lib/curse";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { Camera } from "../lib/map-camera";
import type { PreviewMossling } from "../lib/map-preview";

function fixture(width = 30, height = 30): MapData {
  return {
    width,
    height,
    seed: 42,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}

function mossling(
  index: number,
  id = 0,
  extra: Partial<PreviewMossling> = {},
): PreviewMossling {
  return {
    id,
    cellIndex: index,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    ...extra,
  };
}

function at(width: number, x: number, y: number) {
  return y * width + x;
}

test("the bubble wraps cartoon cursing and matches the cough tail", () => {
  assert.equal(CURSE_TEXT, "@$#*!");
  assert.equal(CURSE_TEXT.length, 5);
  assert.ok(CURSE_ZOOMS.has(24));
  assert.ok(CURSE_ZOOMS.has(32));
  assert.equal(CURSE_ZOOMS.has(16), false);
  assert.equal(CURSE_ZOOMS.has(8), false);
});

test("the swear plays once from the hit, then stays quiet until the next stamp", () => {
  const pop = curseMotion(10, 10);
  const full = curseMotion(10 + COUGH_FRAME_SECONDS, 10);
  const quiet = curseMotion(10 + CURSE_PLAY_SECONDS, 10);
  const stillQuiet = curseMotion(10 + CURSE_CYCLE_SECONDS, 10);
  assert.equal(pop?.frame, 0);
  assert.equal(pop?.alpha, 1);
  assert.equal(full?.frame, 1);
  assert.equal(quiet, null);
  assert.equal(stillQuiet, null);
  assert.equal(CURSE_GAP_SECONDS, 2);
});

test("markCurse ignores the dead and waits a full cycle to repeat", () => {
  const living = mossling(0);
  const dead = mossling(1, 1, { health: 0 });
  assert.equal(markCurse(dead, 1), false);
  assert.equal(dead.cursedAt, undefined);
  assert.equal(markCurse(living, 1), true);
  assert.equal(living.cursedAt, 1);
  assert.equal(markCurse(living, 1 + CURSE_PLAY_SECONDS), false);
  assert.equal(living.cursedAt, 1);
  assert.equal(markCurse(living, 1 + CURSE_CYCLE_SECONDS), true);
  assert.equal(living.cursedAt, 1 + CURSE_CYCLE_SECONDS);
});

test("only a living survivor at the last two zooms grows a bubble", () => {
  const camera: Camera = { x: 2, y: 2, width: 4, height: 3, left: 0, top: 0 };
  const width = 20;
  const onMap = 3 + 2 * width;
  const hidden = mossling(0, 0, { cursedAt: 0 });
  const calm = mossling(onMap);
  const dead = mossling(onMap, 1, { health: 0, cursedAt: 0 });
  const hit = mossling(onMap, 2, { cursedAt: 0 });
  assert.deepEqual(cursesInView([hidden], width, camera, 32, 0), []);
  assert.deepEqual(cursesInView([calm], width, camera, 32, 0), []);
  assert.deepEqual(cursesInView([dead], width, camera, 32, 0), []);
  assert.deepEqual(cursesInView([hit], width, camera, 16, 0), []);
  assert.deepEqual(
    cursesInView([hit], width, camera, 32, CURSE_PLAY_SECONDS),
    [],
  );
  const close = cursesInView([hit], width, camera, 24, 0);
  const closest = cursesInView([hit], width, camera, 32, 0);
  assert.equal(close.length, 1);
  assert.equal(closest.length, 1);
  assert.equal(closest[0]?.frame, 0);
  assert.equal(
    closest[0]?.width,
    (COUGH_POP_ROWS[0]?.length ?? 0) * COUGH_SCALE,
  );
  const held = cursesInView([hit], width, camera, 32, COUGH_FRAME_SECONDS);
  assert.equal(held[0]?.frame, 1);
  assert.equal(held[0]?.width, (COUGH_ROWS[0]?.length ?? 0) * COUGH_SCALE);
  assert.equal(cursing(hit, 0), true);
  assert.equal(cursing(hit, CURSE_PLAY_SECONDS), false);
});

test("lightning, tornado, nuke, and fire stamp survivors and skip the dead", () => {
  const map = fixture();
  const width = map.width;
  const strike = at(width, 15, 15);
  const edge = at(width, 15, 17);
  const world = new GodWorld(map, [
    mossling(strike, 0, { health: 1 }),
    mossling(edge, 1),
  ]);
  world.cast("lightning", 15, 15);
  const slain = world.mosslings.find((m) => m.id === 0);
  const lived = world.mosslings.find((m) => m.id === 1);
  assert.ok((slain?.health ?? 100) <= 0);
  assert.equal(slain?.cursedAt, undefined);
  assert.ok((lived?.health ?? 0) > 0);
  assert.equal(lived?.cursedAt, 0);

  const blast = fixture(60, 40);
  const nuke = new GodWorld(blast, [
    mossling(at(blast.width, 15, 15), 0),
    mossling(at(blast.width, 33, 15), 1),
  ]);
  nuke.cast("nuke", 15, 15);
  for (let i = 0; i < 20; i++) nuke.tick(0.05);
  const nuked = nuke.mosslings.find((m) => m.id === 0);
  const rim = nuke.mosslings.find((m) => m.id === 1);
  assert.ok((nuked?.health ?? 100) <= 0);
  assert.equal(nuked?.cursedAt, undefined);
  assert.ok((rim?.health ?? 0) > 0);
  assert.ok(rim?.cursedAt !== undefined);

  const storm = new GodWorld(fixture(), [mossling(strike)]);
  storm.cast("tornado", 15, 15);
  for (let i = 0; i < 20; i++) storm.tick(0.05);
  assert.ok((storm.mosslings[0]?.health ?? 0) > 0);
  assert.ok(storm.mosslings[0]?.cursedAt !== undefined);

  const dry = fixture();
  for (const cell of dry.cells) cell.moisture = 0.5;
  const beside = at(width, 16, 15);
  const blaze = new GodWorld(dry, [mossling(beside)]);
  blaze.cast("fire", 15, 15);
  assert.equal(blaze.mosslings[0]?.cursedAt, 0);
  assert.equal(blaze.mosslings[0]?.health, 100);
});

test("a meteor impact curses a survivor at the rim", () => {
  const map = fixture();
  const x = 15;
  const y = 20;
  const rim = at(map.width, x, y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const cell = map.cells[at(map.width, x + dx, y + dy)];
      if (cell) cell.terrain = "rock";
    }
  }
  const world = new GodWorld(map, [mossling(rim)]);
  world.cast("meteor", 15, 15);
  assert.equal(world.mosslings[0]?.cursedAt, undefined);
  for (let i = 0; i < 20; i++) world.tick(0.05);
  assert.ok((world.mosslings[0]?.health ?? 0) > 0);
  assert.ok(world.mosslings[0]?.cursedAt !== undefined);
});

test("rain and sun do not make a Mossling curse", () => {
  const world = new GodWorld(fixture(), [mossling(at(30, 15, 15))]);
  world.cast("rain", 15, 15);
  world.cast("sun", 15, 15);
  assert.equal(world.mosslings[0]?.cursedAt, undefined);
});
