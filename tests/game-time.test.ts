import assert from "node:assert/strict";
import test from "node:test";
import {
  foliageAt,
  foliageStep,
  gameDateAt,
  MAX_FAST_FORWARD_STEPS,
  MONTH_SECONDS,
  nextFastForwardStep,
  nextSpringAt,
  seasonDimAt,
  SEASON_SECONDS,
  timeRateAt,
} from "../lib/game-time";

test("a year has four twelve-second seasons and begins in summer", () => {
  assert.equal(MONTH_SECONDS, 4);
  assert.deepEqual(gameDateAt(0), { year: 1, season: "Summer" });
  assert.deepEqual(gameDateAt(11.999), { year: 1, season: "Summer" });
  assert.deepEqual(gameDateAt(12), { year: 1, season: "Autumn" });
  assert.deepEqual(gameDateAt(24), { year: 1, season: "Winter" });
  assert.deepEqual(gameDateAt(36), { year: 1, season: "Spring" });
  assert.deepEqual(gameDateAt(48), { year: 2, season: "Summer" });
});

test("skip always lands on the next spring", () => {
  assert.equal(nextSpringAt(0), 36);
  assert.equal(nextSpringAt(35.99), 36);
  assert.equal(nextSpringAt(36), 84);
  assert.equal(nextSpringAt(47.99), 84);
  assert.equal(nextSpringAt(48), 84);
});

test("foliage fills in spring, turns in autumn, and snows only once winter has begun", () => {
  const summer = foliageAt(0);
  const spring = foliageAt(SEASON_SECONDS * 3);
  const midSpring = foliageAt(SEASON_SECONDS * 3 + SEASON_SECONDS / 2);
  const midAutumn = foliageAt(SEASON_SECONDS + SEASON_SECONDS / 2);
  const lateAutumn = foliageAt(SEASON_SECONDS * 2 - 0.01);
  const winterStart = foliageAt(SEASON_SECONDS * 2);
  const midWinter = foliageAt(SEASON_SECONDS * 2 + SEASON_SECONDS / 2);

  assert.equal(summer.cover, 1);
  assert.ok(spring.cover < midSpring.cover);
  assert.ok(midSpring.cover < 1);
  assert.equal(summer.autumn, 0);
  assert.equal(summer.snow, 0);
  assert.equal(summer.ice, 0);
  assert.equal(foliageAt(SEASON_SECONDS + 2).ice, 0);
  assert.ok(lateAutumn.ice > 0);
  assert.ok(lateAutumn.ice < midWinter.ice);
  assert.ok(midWinter.ice < 1);
  assert.equal(foliageAt(SEASON_SECONDS * 3).ice, 1);
  assert.ok(midSpring.ice < spring.ice);
  assert.ok(midSpring.ice > 0);
  assert.ok(midAutumn.autumn > summer.autumn);
  assert.equal(midAutumn.snow, 0);
  assert.ok(lateAutumn.cover < midAutumn.cover);
  assert.equal(winterStart.snow, 0);
  assert.ok(midWinter.snow > 0);
  assert.ok(midWinter.cover < summer.cover);
  assert.equal(foliageAt(SEASON_SECONDS + 6).snow, 0);
  assert.ok(spring.snow > 0);
  assert.equal(midSpring.snow, 0);
});

test("crops fill in through spring, stand full in summer, and thin through autumn", () => {
  const summer = foliageAt(0);
  const autumnStart = foliageAt(SEASON_SECONDS);
  const midAutumn = foliageAt(SEASON_SECONDS + SEASON_SECONDS / 2);
  const winter = foliageAt(SEASON_SECONDS * 2);
  const springStart = foliageAt(SEASON_SECONDS * 3);
  const midSpring = foliageAt(SEASON_SECONDS * 3 + SEASON_SECONDS / 2);
  const nextSummer = foliageAt(SEASON_SECONDS * 4);

  assert.equal(summer.crop, 1);
  assert.equal(autumnStart.crop, 1);
  assert.equal(midAutumn.crop, 0.5);
  assert.equal(winter.crop, 0);
  assert.equal(springStart.crop, 0);
  assert.equal(midSpring.crop, 0.5);
  assert.equal(nextSummer.crop, 1);
});

test("foliage repaint steps advance four times a season and wrap with the year", () => {
  assert.equal(foliageStep(0), 0);
  assert.equal(foliageStep(SEASON_SECONDS / 4), 1);
  assert.equal(foliageStep(SEASON_SECONDS), 4);
  assert.equal(foliageStep(SEASON_SECONDS * 4), 0);
});

test("board dim eases in through autumn and winter and clears by mid-spring", () => {
  const midAutumn = seasonDimAt(SEASON_SECONDS + SEASON_SECONDS / 2);
  const midWinter = seasonDimAt(SEASON_SECONDS * 2 + SEASON_SECONDS / 2);
  const midSpring = seasonDimAt(SEASON_SECONDS * 3 + SEASON_SECONDS / 2);

  assert.equal(seasonDimAt(0), 0);
  assert.ok(midAutumn > 0);
  assert.ok(midWinter >= 0.12);
  assert.ok(midWinter > midAutumn);
  assert.equal(midSpring, 0);
});

test("fast forward rises by one eighth to three times then wraps", () => {
  assert.equal(timeRateAt(0), 1);
  assert.equal(timeRateAt(1), 1.125);
  assert.equal(timeRateAt(MAX_FAST_FORWARD_STEPS), 3);
  assert.equal(nextFastForwardStep(MAX_FAST_FORWARD_STEPS), 0);
});
