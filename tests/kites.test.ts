import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CLOUD_SHADOW, CLOUD_SHADOW_ALPHA } from "../lib/cloud-visual";
import { kiteShadowPixel } from "../lib/kite-sprite";
import {
  fliesKite,
  KITE_ASIDE,
  KITE_SRC_HEIGHT,
  KITE_SRC_WIDTH,
  KITE_TILES,
  KITE_UP,
  kiteAnchor,
  kiteRoll,
  kiteShadow,
  kiteSpriteTiles,
} from "../lib/kites";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import { SPRITE_SIZE } from "../lib/mossling-detail";

function meadow(size = 5): MapData {
  return {
    width: size,
    height: size,
    seed: 1,
    cells: Array.from({ length: size * size }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}

function at(map: MapData, x: number, y: number) {
  return y * map.width + x;
}

function reading(label: string, value: number) {
  return { label, value };
}

function flyer(
  id: number,
  sociability: number,
  cowardice: number,
  map: MapData,
): PreviewMossling {
  return {
    id,
    cellIndex: at(map, 2, 2),
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    traits: [
      reading("Sociability", sociability),
      reading("Cowardice", cowardice),
    ],
  };
}

function idThatFlies() {
  for (let id = 0; id < 200; id++) if (kiteRoll(id)) return id;
  throw new Error("expected a kite roll");
}

function idThatStays() {
  for (let id = 0; id < 200; id++) if (!kiteRoll(id)) return id;
  throw new Error("expected a quiet roll");
}

test("any Mossling in spring or summer can win the kite roll", () => {
  const map = meadow();
  const flying = idThatFlies();
  const quiet = idThatStays();
  const shy = flyer(flying, 20, 30, map);
  const brave = flyer(flying, 80, 20, map);
  const sociable = flyer(quiet, 90, 10, map);

  assert.equal(fliesKite(shy, "Summer", map), true);
  assert.equal(fliesKite(shy, "Spring", map), true);
  assert.equal(fliesKite(shy, "Autumn", map), false);
  assert.equal(fliesKite(shy, "Winter", map), false);
  assert.equal(fliesKite(brave, "Summer", map), true);
  assert.equal(fliesKite(sociable, "Summer", map), false);
  assert.equal(
    fliesKite(brave, "Summer", map),
    fliesKite(brave, "Summer", map),
  );
  assert.equal(fliesKite({ ...shy, health: 0 }, "Summer", map), false);
});

test("fire, water, carrots, and a kick keep the kite down", () => {
  const map = meadow();
  const mossling = flyer(idThatFlies(), 10, 20, map);
  assert.equal(fliesKite(mossling, "Summer", map), true);

  const home = map.cells[mossling.cellIndex];
  assert.ok(home);
  home.terrain = "water";
  assert.equal(fliesKite(mossling, "Summer", map), false);
  home.terrain = "grass";

  home.growth = 1;
  assert.equal(fliesKite(mossling, "Summer", map), false);
  home.growth = undefined;

  home.burning = true;
  assert.equal(fliesKite(mossling, "Summer", map), false);
  home.burning = false;

  const partner: PreviewMossling = {
    ...flyer(9, 80, 20, map),
    cellIndex: at(map, 3, 2),
    soccer: { partnerId: mossling.id, since: 0, face: "left", phase: "play" },
  };
  const kicking = {
    ...mossling,
    soccer: {
      partnerId: partner.id,
      since: 0,
      face: "right" as const,
      phase: "play" as const,
    },
  };
  assert.equal(fliesKite(kicking, "Summer", map, partner), false);
  assert.equal(fliesKite(mossling, "Summer", map), true);
});

test("the kite is a quarter smaller than the three-tile sail, with one extra tile of shadow", () => {
  const anchor = kiteAnchor(3, 10, 12, 0);
  const span = kiteSpriteTiles();
  assert.equal(KITE_TILES, 2.25);
  assert.equal(span.width, 2.25);
  assert.equal(span.height, 2.25 * (KITE_SRC_HEIGHT / KITE_SRC_WIDTH));
  assert.equal(Math.abs(anchor.x - 10), KITE_ASIDE);
  assert.equal(anchor.y, 12 - KITE_UP);
  const distance = Math.hypot(anchor.x - 10, anchor.y - 12);
  assert.ok(distance >= 3 && distance <= 4);
  const shadow = kiteShadow(anchor);
  assert.equal(shadow.x - anchor.x, (span.width - 1) / 2);
  assert.equal(shadow.y, anchor.y + span.height);
  const hopped = kiteAnchor(3, 10, 12, 2);
  assert.notEqual(hopped.y, anchor.y);
  const hoppedShadow = kiteShadow(hopped);
  assert.equal(hoppedShadow.x - hopped.x, (span.width - 1) / 2);
  assert.equal(hoppedShadow.y, hopped.y + span.height);
  const sides = new Set<number>();
  for (let id = 0; id < 8; id++)
    sides.add(Math.sign(kiteAnchor(id, 5, 5, 0).x - 5));
  assert.equal(sides.size, 2);
});

test("the kite png is an 80 by 52 pixel sail", () => {
  const bytes = readFileSync("public/mosslings/icons/kite.png");
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  assert.equal(bytes.readUInt32BE(16), KITE_SRC_WIDTH);
  assert.equal(bytes.readUInt32BE(20), KITE_SRC_HEIGHT);
});

test("the shadow uses the cloud color and stays softer than the kite", () => {
  const value = Number.parseInt(CLOUD_SHADOW.slice(1), 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  const cap = Math.round(CLOUD_SHADOW_ALPHA * 255);
  let found = false;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const pixel = kiteShadowPixel(0, x, y);
      if (!pixel) continue;
      found = true;
      assert.deepEqual([pixel[0], pixel[1], pixel[2]], [...rgb]);
      assert.ok(pixel[3] > 0 && pixel[3] <= cap);
    }
  }
  assert.equal(found, true);
  assert.equal(kiteShadowPixel(0, 0, 0), null);
});
