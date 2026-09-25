import assert from "node:assert/strict";
import test from "node:test";
import {
  CHASE_LAP_SECONDS,
  CHASE_PLAY_SECONDS,
  CHASE_RADIUS,
  CHASE_LINES,
  chaseLine,
  chasePlace,
  lolInView,
} from "../lib/chase";
import {
  COUGH_FRAME_SECONDS,
  COUGH_PLAY_SECONDS,
  COUGH_SCALE,
  COUGH_ZOOM,
  SPEECH_POP_ROWS,
  SPEECH_ROWS,
  coughMotion,
} from "../lib/cough";
import { MONTH_SECONDS, WEEK_SECONDS } from "../lib/game-time";
import { fliesKite, kiteRoll } from "../lib/kites";
import type { MapData } from "../lib/map";
import type { Camera } from "../lib/map-camera";
import type { PreviewMossling } from "../lib/map-preview";
import { traitLabels } from "../lib/mossling-traits";
import { playingSoccer, soccerMonth } from "../lib/soccer";

function readings(overrides: Record<string, number> = {}) {
  return traitLabels.map((label) => ({
    label,
    value: overrides[label] ?? 50,
  }));
}

const social = { Sociability: 80, Cowardice: 20, Courage: 80 };

function creature(
  id: number,
  x: number,
  y: number,
  width: number,
): PreviewMossling {
  return {
    id,
    cellIndex: y * width + x,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    traits: readings(social),
  };
}

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

function play(
  mosslings: PreviewMossling[],
  width: number,
  elapsed = MONTH_SECONDS,
  random: () => number = () => 0,
) {
  const occupied = new Set(mosslings.map((mossling) => mossling.cellIndex));
  return soccerMonth({
    mosslings,
    width,
    elapsed,
    random,
    isPanicked: () => false,
    busy: new Set(),
    canMoveTo: (_mossling, x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= width) return false;
      const index = y * width + x;
      return !occupied.has(index) || index === _mossling.cellIndex;
    },
    move: (mossling, x, y) => {
      occupied.delete(mossling.cellIndex);
      mossling.cellIndex = y * width + x;
      occupied.add(mossling.cellIndex);
    },
  });
}

function meadow(): MapData {
  return {
    width: 8,
    height: 8,
    seed: 1,
    cells: Array.from({ length: 64 }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}

test("a new pair rolls soccer or chase with equal odds", () => {
  const width = 8;
  const soccerPair = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(soccerPair, width, MONTH_SECONDS, sequence([0, 0]));
  assert.equal(soccerPair[0]?.soccer?.kind, "soccer");
  assert.equal(soccerPair[1]?.soccer?.kind, "soccer");
  assert.equal(soccerPair[0]?.soccer?.phase, "play");

  const chasePair = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(chasePair, width, MONTH_SECONDS, sequence([0, 0.5]));
  assert.equal(chasePair[0]?.soccer?.kind, "chase");
  assert.equal(chasePair[1]?.soccer?.kind, "chase");
  assert.equal(chasePair[0]?.soccer?.phase, "play");
  assert.equal(playingSoccer(chasePair[0], chasePair[1], width), false);
});

test("a chase picked on the walk-in is still a chase when they arrive", () => {
  const width = 8;
  const pair = [creature(1, 0, 0, width), creature(2, 4, 0, width)];
  play(pair, width, MONTH_SECONDS, sequence([0, 0.5]));
  assert.equal(pair[0]?.soccer?.kind, "chase");
  assert.equal(pair[1]?.soccer?.kind, "chase");
  assert.equal(pair[0]?.soccer?.phase, "play");
  assert.equal(pair[0]?.cellIndex, 1);
  assert.equal(pair[1]?.cellIndex, 3);
});

test("chasers stay opposite, three tiles apart, for two weeks", () => {
  assert.equal(WEEK_SECONDS, MONTH_SECONDS / 4);
  assert.equal(CHASE_PLAY_SECONDS, WEEK_SECONDS * 2);
  const width = 8;
  const since = MONTH_SECONDS;
  const pair = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(pair, width, since, sequence([0, 0.5]));
  const [lead, follow] = pair;
  assert.ok(lead && follow);

  const startLead = chasePlace(lead, follow, width, since);
  const startFollow = chasePlace(follow, lead, width, since);
  assert.ok(startLead && startFollow);
  const centerX = (1 + 3) / 2;
  const centerY = (1 + 1) / 2;
  assert.ok(Math.abs(startLead.x - (centerX + CHASE_RADIUS)) < 1e-9);
  assert.ok(Math.abs(startLead.y - centerY) < 1e-9);
  assert.ok(Math.abs(startFollow.x - (centerX - CHASE_RADIUS)) < 1e-9);
  assert.ok(
    Math.abs(
      Math.hypot(startLead.x - startFollow.x, startLead.y - startFollow.y) - 3,
    ) < 1e-9,
  );
  assert.equal(startLead.face, "right");

  const later = since + CHASE_LAP_SECONDS / 4;
  const laterLead = chasePlace(lead, follow, width, later);
  const laterFollow = chasePlace(follow, lead, width, later);
  assert.ok(laterLead && laterFollow);
  assert.equal(laterLead.face, "left");
  assert.equal(laterFollow.face, "right");
  assert.ok(Math.abs(laterLead.x - centerX) < 1e-9);
  assert.ok(Math.abs(laterLead.y - (centerY + CHASE_RADIUS)) < 1e-9);
  assert.ok(
    Math.abs(
      Math.hypot(laterLead.x - laterFollow.x, laterLead.y - laterFollow.y) - 3,
    ) < 1e-9,
  );
  assert.equal(chasePlace(lead, follow, width, since - 0.01), null);

  play(pair, width, since + CHASE_PLAY_SECONDS - 0.01, () => 1);
  assert.equal(pair[0]?.soccer?.phase, "play");
  assert.ok(chasePlace(lead, follow, width, since + CHASE_PLAY_SECONDS - 0.01));

  play(pair, width, since + CHASE_PLAY_SECONDS, () => 1);
  assert.equal(pair[0]?.soccer, undefined);
  assert.equal(pair[1]?.soccer, undefined);
  assert.equal(
    chasePlace(lead, follow, width, since + CHASE_PLAY_SECONDS),
    null,
  );
});

test("the chase bubble matches the cough pop and sits above the runner", () => {
  assert.ok(CHASE_LINES.includes(chaseLine(1)));
  assert.equal(chaseLine(1), chaseLine(1));
  const width = 20;
  const camera: Camera = { x: 0, y: 0, width: 12, height: 8, left: 0, top: 0 };
  const pair = [creature(1, 3, 3, width), creature(2, 5, 3, width)];
  pair[0].soccer = {
    partnerId: 2,
    since: 0,
    face: "right",
    phase: "play",
    kind: "chase",
  };
  pair[1].soccer = {
    partnerId: 1,
    since: 0,
    face: "left",
    phase: "play",
    kind: "chase",
  };
  assert.deepEqual(lolInView(pair, width, camera, 24, 0), []);
  const shown = lolInView(pair, width, camera, COUGH_ZOOM, 0);
  assert.equal(shown.length, 2);
  assert.equal(shown[0]?.text, chaseLine(1));
  const speechRows = shown[0]?.frame === 0 ? SPEECH_POP_ROWS : SPEECH_ROWS;
  assert.equal(shown[0]?.width, (speechRows[0]?.length ?? 0) * COUGH_SCALE);
  const lead = chasePlace(pair[0], pair[1], width, 0);
  assert.ok(lead);
  assert.equal(shown[0]?.frame, coughMotion(0, 1)?.frame);
  assert.equal(shown[0]?.x, lead.x + 0.5);
  assert.ok((shown[0]?.y ?? 0) < lead.y);
  const staggered = lolInView(
    pair,
    width,
    camera,
    COUGH_ZOOM,
    COUGH_FRAME_SECONDS,
  );
  assert.equal(staggered[0]?.frame, coughMotion(COUGH_FRAME_SECONDS, 1)?.frame);
  assert.equal(staggered[1]?.frame, coughMotion(COUGH_FRAME_SECONDS, 2)?.frame);
  assert.deepEqual(
    lolInView(pair, width, camera, COUGH_ZOOM, COUGH_PLAY_SECONDS),
    [],
  );
});

test("a chase keeps the kite down", () => {
  const map = meadow();
  let flyer = 0;
  for (let id = 0; id < 200; id++) {
    if (kiteRoll(id)) {
      flyer = id;
      break;
    }
  }
  const width = map.width;
  const mossling = creature(flyer, 2, 2, width);
  const partner = creature(flyer + 1, 4, 2, width);
  assert.equal(fliesKite(mossling, "Summer", map, partner), true);
  mossling.soccer = {
    partnerId: partner.id,
    since: 0,
    face: "right",
    phase: "play",
    kind: "chase",
  };
  partner.soccer = {
    partnerId: mossling.id,
    since: 0,
    face: "left",
    phase: "play",
    kind: "chase",
  };
  assert.equal(fliesKite(mossling, "Summer", map, partner), false);
});
