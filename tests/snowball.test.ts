import assert from "node:assert/strict";
import test from "node:test";
import type { Season } from "../lib/game-time";
import { MONTH_SECONDS } from "../lib/game-time";
import type { PreviewMossling } from "../lib/map-preview";
import { traitLabels } from "../lib/mossling-traits";
import {
  ballAt,
  ballFill,
  ballsInView,
  gamesThisSeason,
  playingSoccer,
  SOCCER_BALL_INK,
  SOCCER_BALL_ROWS,
  SOCCER_BALL_WHITE,
  SOCCER_PLAY_SECONDS,
  soccerMonth,
} from "../lib/soccer";

function readings(overrides: Record<string, number> = {}) {
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
): PreviewMossling {
  return {
    id,
    cellIndex: y * width + x,
    health: 100,
    colors: ["#ffe632", "#769f24", "#fff5b7"],
    pattern: 0,
    traits: readings({ Sociability: 80, Cowardice: 20, Courage: 80 }),
  };
}

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

function play(
  mosslings: PreviewMossling[],
  season: Season,
  elapsed = MONTH_SECONDS,
  random: () => number = () => 0,
) {
  const width = 8;
  const occupied = new Set(mosslings.map((mossling) => mossling.cellIndex));
  return soccerMonth({
    mosslings,
    width,
    elapsed,
    season,
    random,
    isPanicked: () => false,
    busy: new Set(),
    canMoveTo: (mossling, x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= width) return false;
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

test("snowballs join the roll only in winter", () => {
  assert.equal(gamesThisSeason("Summer").includes("snowball"), false);
  assert.equal(gamesThisSeason("Winter").includes("snowball"), true);

  const width = 8;
  const summer = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(summer, "Summer", MONTH_SECONDS, sequence([0, 0.9]));
  assert.equal(summer[0]?.soccer?.kind, "chase");

  const winter = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(winter, "Winter", MONTH_SECONDS, sequence([0, 0]));
  assert.equal(winter[0]?.soccer?.kind, "soccer");

  const snow = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(snow, "Winter", MONTH_SECONDS, sequence([0, 0.9]));
  assert.equal(snow[0]?.soccer?.kind, "snowball");
  assert.equal(snow[1]?.soccer?.kind, "snowball");
  assert.equal(snow[0]?.soccer?.phase, "play");
  assert.equal(playingSoccer(snow[0], snow[1], width), true);
});

test("a snowball game ends with the season or after two months", () => {
  const width = 8;
  const since = MONTH_SECONDS;
  const pair = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(pair, "Winter", since, sequence([0, 0.9]));
  assert.equal(pair[0]?.soccer?.kind, "snowball");

  play(pair, "Winter", since + SOCCER_PLAY_SECONDS - 0.01, () => 1);
  assert.equal(pair[0]?.soccer?.phase, "play");

  const thawed = [creature(3, 1, 1, width), creature(4, 3, 1, width)];
  thawed[0].soccer = {
    partnerId: 4,
    since,
    face: "right",
    phase: "play",
    kind: "snowball",
  };
  thawed[1].soccer = {
    partnerId: 3,
    since,
    face: "left",
    phase: "play",
    kind: "snowball",
  };
  play(thawed, "Spring", since + 1, () => 1);
  assert.equal(thawed[0]?.soccer, undefined);
  assert.equal(thawed[1]?.soccer, undefined);

  play(pair, "Winter", since + SOCCER_PLAY_SECONDS, () => 1);
  assert.equal(pair[0]?.soccer, undefined);
  assert.equal(pair[1]?.soccer, undefined);
});

test("the snowball follows the soccer ball and every panel is white", () => {
  const width = 8;
  const pair = [creature(1, 1, 1, width), creature(2, 3, 1, width)];
  play(pair, "Winter", MONTH_SECONDS, sequence([0, 0.9]));
  const camera = { x: 0, y: 0, width: 8, height: 8, left: 0, top: 0 };
  const marks = ballsInView(pair, width, camera, 32, MONTH_SECONDS);
  assert.equal(marks.length, 1);
  assert.equal(marks[0]?.snow, true);
  const leader = pair[0];
  const partner = pair[1];
  assert.ok(leader && partner);
  const point = ballAt(
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    MONTH_SECONDS,
    leader.soccer?.since ?? 0,
  );
  assert.equal(marks[0]?.x, point.x);
  assert.equal(marks[0]?.y, point.y);

  let panels = 0;
  for (const row of SOCCER_BALL_ROWS) {
    for (const mark of row) {
      const snow = ballFill(mark, true);
      const soccer = ballFill(mark, false);
      if (mark === ".") {
        assert.equal(snow, null);
        assert.equal(soccer, null);
        continue;
      }
      panels += 1;
      assert.equal(snow, SOCCER_BALL_WHITE);
      if (mark === "b") assert.equal(soccer, SOCCER_BALL_INK);
      else assert.equal(soccer, SOCCER_BALL_WHITE);
    }
  }
  assert.ok(panels > 0);
});
