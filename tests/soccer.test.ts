import assert from "node:assert/strict";
import test from "node:test";
import { MONTH_SECONDS } from "../lib/game-time";
import { GodWorld } from "../lib/god/engine";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import {
  KICK_FRAME_COUNT,
  KICK_SECONDS,
  SPRITE_SIZE,
  skinnedKickPixel,
} from "../lib/mossling-detail";
import { traitLabels } from "../lib/mossling-traits";
import {
  ballAt,
  ballSize,
  ballsInView,
  footToward,
  KICK_STRIKE,
  kickFrame,
  playingSoccer,
  soccerFaces,
  soccerMonth,
  SOCCER_PLAY_SECONDS,
  wantsSoccer,
} from "../lib/soccer";

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
  overrides: Record<string, number> = social,
): PreviewMossling {
  return {
    id,
    cellIndex: y * width + x,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    traits: readings(overrides),
  };
}

function play(
  mosslings: PreviewMossling[],
  width: number,
  elapsed = MONTH_SECONDS,
  random: () => number = () => 0,
  busy: ReadonlySet<number> = new Set(),
  isPanicked: (id: number) => boolean = () => false,
  canMoveTo: (
    mossling: PreviewMossling,
    x: number,
    y: number,
  ) => boolean = () => true,
) {
  const occupied = new Set(mosslings.map((mossling) => mossling.cellIndex));
  return soccerMonth({
    mosslings,
    width,
    elapsed,
    random,
    isPanicked,
    busy,
    canMoveTo: (mossling, x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= width) return false;
      if (!canMoveTo(mossling, x, y)) return false;
      const index = y * width + x;
      return !occupied.has(index) || index === mossling.cellIndex;
    },
    move: (mossling, x, y) => {
      occupied.delete(mossling.cellIndex);
      mossling.cellIndex = y * width + x;
      occupied.add(mossling.cellIndex);
    },
  });
}

function grass(): MapData {
  return {
    width: 4,
    height: 4,
    seed: 3,
    cells: Array.from({ length: 16 }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.5,
      rockiness: 0.2,
    })),
  };
}

test("soccer wants sociability above the midpoint and cowardice at or below it", () => {
  assert.equal(wantsSoccer(readings(social)), true);
  assert.equal(wantsSoccer(readings({ Sociability: 51, Cowardice: 50 })), true);
  assert.equal(
    wantsSoccer(readings({ Sociability: 50, Cowardice: 20 })),
    false,
  );
  assert.equal(
    wantsSoccer(readings({ Sociability: 80, Cowardice: 51 })),
    false,
  );
  assert.equal(wantsSoccer(readings({ Sociability: 80, Cowardice: 20 })), true);
});

test("a pair within two tiles has a 1 in 5 chance, and each Mossling plays once", () => {
  const width = 8;
  const missed = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  assert.equal(play(missed, width, MONTH_SECONDS, () => 0.2).size, 0);
  assert.equal(missed[0]?.soccer, undefined);

  const near = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  const kicked = play(near, width, MONTH_SECONDS, () => 0);
  assert.deepEqual(
    [...kicked].sort((a, b) => a - b),
    [1, 2],
  );
  const west = near[0];
  const east = near[1];
  assert.ok(west?.soccer && east?.soccer);
  assert.equal(west.soccer.partnerId, 2);
  assert.equal(east.soccer.partnerId, 1);
  assert.equal(west.soccer.face, "right");
  assert.equal(east.soccer.face, "left");
  assert.equal(west.soccer.phase, "play");
  assert.equal(west.soccer.since, MONTH_SECONDS);

  const same = [creature(1, 2, 2, width), creature(2, 2, 2, width)];
  assert.equal(play(same, width).size, 0);

  const line = [
    creature(1, 0, 0, width),
    creature(2, 1, 0, width),
    creature(3, 2, 0, width),
  ];
  const oneGame = play(line, width);
  assert.equal(oneGame.size, 2);
  assert.equal(line[2]?.soccer, undefined);
  assert.ok(line[0]?.soccer && line[1]?.soccer);
});

test("two separated pairs both play in the same month", () => {
  const width = 12;
  const pairs = [
    creature(1, 0, 0, width),
    creature(2, 1, 0, width),
    creature(3, 8, 0, width),
    creature(4, 9, 0, width),
  ];
  const held = play(pairs, width);
  assert.equal(held.size, 4);
  assert.equal(pairs[0]?.soccer?.partnerId, 2);
  assert.equal(pairs[1]?.soccer?.partnerId, 1);
  assert.equal(pairs[2]?.soccer?.partnerId, 4);
  assert.equal(pairs[3]?.soccer?.partnerId, 3);
  assert.equal(pairs[0]?.soccer?.phase, "play");
  assert.equal(pairs[2]?.soccer?.phase, "play");
});

test("a pair four tiles apart walks in and then plays for two months", () => {
  const width = 8;
  const pair = [creature(1, 0, 0, width), creature(2, 4, 0, width)];
  const held = play(pair, width, MONTH_SECONDS, () => 0);
  assert.deepEqual(
    [...held].sort((a, b) => a - b),
    [1, 2],
  );
  assert.equal(pair[0]?.cellIndex, 1);
  assert.equal(pair[1]?.cellIndex, 3);
  assert.equal(pair[0]?.soccer?.phase, "play");
  assert.equal(pair[1]?.soccer?.phase, "play");
  assert.equal(pair[0]?.soccer?.since, MONTH_SECONDS);
  assert.equal(pair[0]?.soccer?.face, "right");
  assert.equal(pair[1]?.soccer?.face, "left");

  play(pair, width, MONTH_SECONDS + 1, () => 0);
  assert.equal(pair[0]?.cellIndex, 1);
  assert.equal(pair[1]?.cellIndex, 3);
  assert.equal(pair[0]?.soccer?.phase, "play");

  play(pair, width, MONTH_SECONDS + SOCCER_PLAY_SECONDS - 1, () => 0);
  assert.equal(pair[0]?.soccer?.phase, "play");

  play(pair, width, MONTH_SECONDS + SOCCER_PLAY_SECONDS, () => 1);
  assert.equal(pair[0]?.soccer, undefined);
  assert.equal(pair[1]?.soccer, undefined);
  assert.equal(pair[0]?.cellIndex, 1);
  assert.equal(pair[1]?.cellIndex, 3);
});

test("a blocked step keeps the approach, and five tiles is too far", () => {
  const width = 12;
  const blocked = [creature(1, 0, 0, width), creature(2, 4, 0, width)];
  const held = play(
    blocked,
    width,
    MONTH_SECONDS,
    () => 0,
    new Set(),
    () => false,
    () => false,
  );
  assert.equal(held.size, 2);
  assert.equal(blocked[0]?.cellIndex, 0);
  assert.equal(blocked[1]?.cellIndex, 4);
  assert.equal(blocked[0]?.soccer?.phase, "approach");
  assert.equal(blocked[1]?.soccer?.phase, "approach");

  play(
    blocked,
    width,
    MONTH_SECONDS * 3,
    () => 1,
    new Set(),
    () => false,
    () => false,
  );
  assert.equal(blocked[0]?.soccer?.phase, "approach");
  assert.equal(blocked[0]?.cellIndex, 0);

  const apart = blocked[1];
  assert.ok(apart);
  apart.cellIndex = 6;
  play(
    [blocked[0], apart].filter(
      (mossling): mossling is PreviewMossling => !!mossling,
    ),
    width,
    MONTH_SECONDS * 4,
    () => 0,
  );
  assert.equal(blocked[0]?.soccer, undefined);
  assert.equal(apart.soccer, undefined);

  const far = [creature(3, 0, 2, width), creature(4, 5, 2, width)];
  assert.equal(play(far, width).size, 0);
  assert.equal(far[0]?.soccer, undefined);
});

test("a failed roll leaves the next free pair to try", () => {
  const width = 8;
  const line = [
    creature(1, 0, 0, width),
    creature(2, 1, 0, width),
    creature(3, 2, 0, width),
  ];
  const rolls = [0.2, 0];
  play(line, width, MONTH_SECONDS, () => rolls.shift() ?? 1);
  assert.equal(line[0]?.soccer?.partnerId, 3);
  assert.equal(line[1]?.soccer, undefined);
  assert.equal(line[2]?.soccer?.partnerId, 1);
});

test("dead, panicked, courting, busy, and shy Mosslings stay out", () => {
  const width = 6;
  const fallen = creature(2, 1, 0, width);
  fallen.health = 0;
  const dead = [creature(1, 0, 0, width), fallen];
  assert.equal(play(dead, width).size, 0);

  const scared = [creature(1, 0, 0, width), creature(2, 1, 0, width)];
  assert.equal(
    play(
      scared,
      width,
      MONTH_SECONDS,
      () => 0,
      new Set(),
      (id) => id === 2,
    ).size,
    0,
  );

  const suitor = creature(1, 0, 0, width);
  suitor.ritual = {
    partnerId: 2,
    months: 1,
    since: 0,
    phase: "courtship",
  };
  const courting = [suitor, creature(2, 1, 0, width)];
  assert.equal(play(courting, width).size, 0);

  const held = [creature(1, 0, 0, width), creature(2, 1, 0, width)];
  assert.equal(play(held, width, MONTH_SECONDS, () => 0, new Set([1])).size, 0);

  const shy = [
    creature(1, 0, 0, width, { Sociability: 40, Cowardice: 10 }),
    creature(2, 1, 0, width),
  ];
  assert.equal(play(shy, width).size, 0);
});

test("a game lasts two months, then the pair can roll again", () => {
  const width = 6;
  const pair = [creature(1, 1, 1, width), creature(2, 2, 1, width)];
  play(pair, width, MONTH_SECONDS, () => 0);
  const since = pair[0]?.soccer?.since;
  play(pair, width, MONTH_SECONDS + 1, () => 0);
  assert.equal(pair[0]?.soccer?.since, since);

  play(pair, width, MONTH_SECONDS + SOCCER_PLAY_SECONDS - 1, () => 0);
  assert.equal(pair[0]?.soccer?.phase, "play");

  play(pair, width, MONTH_SECONDS + SOCCER_PLAY_SECONDS, () => 1);
  assert.equal(pair[0]?.soccer, undefined);
  assert.equal(pair[1]?.soccer, undefined);

  const again = [creature(1, 1, 1, width), creature(2, 2, 1, width)];
  const restartAt = MONTH_SECONDS + SOCCER_PLAY_SECONDS;
  play(again, width, restartAt, () => 0);
  const restarted = again[0];
  assert.ok(restarted?.soccer);
  assert.equal(restarted.soccer.since, restartAt);
});

test("a death or a missing partner ends the game", () => {
  const width = 6;
  const pair = [creature(1, 1, 1, width), creature(2, 2, 1, width)];
  play(pair, width);
  const partner = pair[1];
  assert.ok(partner);
  partner.health = 0;
  play(pair, width);
  assert.equal(pair[0]?.soccer, undefined);
  assert.equal(pair[1]?.soccer, undefined);

  const lone = creature(4, 0, 0, width);
  lone.soccer = { partnerId: 9, since: 0, face: "right", phase: "play" };
  play([lone], width, 0, () => 1);
  assert.equal(lone.soccer, undefined);
});

test("the western Mossling faces right, and a shared column follows the lower id", () => {
  assert.deepEqual(soccerFaces({ id: 1, x: 0, y: 2 }, { id: 4, x: 2, y: 0 }), {
    a: "right",
    b: "left",
  });
  assert.deepEqual(soccerFaces({ id: 5, x: 3, y: 1 }, { id: 2, x: 3, y: 4 }), {
    a: "left",
    b: "right",
  });
});

test("the ball leaves one foot on the kick frame and arrives for the other kick", () => {
  const span = KICK_SECONDS / KICK_FRAME_COUNT;
  const since = 10;
  const kickAt = since + KICK_STRIKE * span;
  const leader = { x: 1, y: 4 };
  const partner = { x: 3, y: 4 };
  assert.equal(kickFrame(kickAt, since, true), KICK_STRIKE);
  assert.equal(kickFrame(kickAt, since, false), KICK_FRAME_COUNT - 1);
  assert.deepEqual(
    ballAt(leader, partner, kickAt, since),
    footToward(leader, partner),
  );

  const reply = kickAt + KICK_SECONDS / 2;
  assert.equal(kickFrame(reply, since, false), KICK_STRIKE);
  assert.equal(kickFrame(reply, since, true), KICK_FRAME_COUNT - 1);
  assert.deepEqual(
    ballAt(leader, partner, reply, since),
    footToward(partner, leader),
  );
});

test("the ball hides when the pair splits or leaves the camera", () => {
  const width = 10;
  const a = creature(1, 1, 1, width);
  const b = creature(2, 2, 1, width);
  a.soccer = { partnerId: 2, since: 0, face: "right", phase: "play" };
  b.soccer = { partnerId: 1, since: 0, face: "left", phase: "play" };
  const camera = { x: 0, y: 0, width: 6, height: 6, left: 0, top: 0 };
  assert.equal(playingSoccer(a, b, width), true);
  assert.equal(ballsInView([a, b], width, camera, 24, 0).length, 1);
  assert.equal(ballSize(8), 1);
  assert.equal(ballSize(16), 5);
  assert.equal(ballSize(32), 7);

  b.cellIndex = 8 * width + 1;
  assert.equal(playingSoccer(a, b, width), false);
  assert.equal(ballsInView([a, b], width, camera, 24, 0).length, 0);

  b.cellIndex = 2;
  const away = { x: 20, y: 20, width: 4, height: 4, left: 0, top: 0 };
  assert.equal(ballsInView([a, b], width, away, 24, 0).length, 0);
});

test("the kick frame grows a nub the rest pose lacks, and left mirrors right", () => {
  const mossling = creature(1, 0, 0, 4);
  const kicked = skinnedKickPixel(KICK_STRIKE, 27, 23, mossling, "right");
  const rested = skinnedKickPixel(
    KICK_FRAME_COUNT - 1,
    27,
    23,
    mossling,
    "right",
  );
  assert.ok(kicked);
  assert.equal(rested, null);
  assert.deepEqual(
    skinnedKickPixel(KICK_STRIKE, SPRITE_SIZE - 1 - 27, 23, mossling, "left"),
    kicked,
  );
  for (let frame = 0; frame < KICK_FRAME_COUNT; frame++) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        assert.deepEqual(
          skinnedKickPixel(frame, x, y, mossling, "left"),
          skinnedKickPixel(frame, SPRITE_SIZE - 1 - x, y, mossling, "right"),
        );
      }
    }
  }
});

test("the played world drops a game when a player dies and keeps it on the snapshot", () => {
  const world = new GodWorld(grass(), [
    creature(1, 0, 0, 4),
    creature(2, 1, 0, 4),
  ]);
  const [a, b] = world.mosslings;
  assert.ok(a && b);
  a.soccer = {
    partnerId: b.id,
    since: MONTH_SECONDS,
    face: "right",
    phase: "play",
  };
  b.soccer = {
    partnerId: a.id,
    since: MONTH_SECONDS,
    face: "left",
    phase: "play",
  };
  const saved = world
    .snapshot()
    .mosslings.find((mossling) => mossling.id === a.id);
  assert.deepEqual(saved?.soccer, a.soccer);
  if (saved?.soccer) saved.soccer.face = "left";
  assert.equal(a.soccer.face, "right");

  b.health = 0;
  world.advanceTo(MONTH_SECONDS);
  assert.equal(a.soccer, undefined);
  assert.equal(b.soccer, undefined);
});
