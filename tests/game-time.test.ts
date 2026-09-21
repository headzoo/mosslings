import assert from "node:assert/strict";
import test from "node:test";
import {
  gameDateAt,
  MAX_FAST_FORWARD_STEPS,
  MONTH_SECONDS,
  nextFastForwardStep,
  nextSpringAt,
  timeRateAt,
} from "../lib/game-time";

test("a year has four twelve-second seasons and begins at year one", () => {
  assert.equal(MONTH_SECONDS, 4);
  assert.deepEqual(gameDateAt(0), { year: 1, season: "Spring" });
  assert.deepEqual(gameDateAt(11.999), { year: 1, season: "Spring" });
  assert.deepEqual(gameDateAt(12), { year: 1, season: "Summer" });
  assert.deepEqual(gameDateAt(24), { year: 1, season: "Autumn" });
  assert.deepEqual(gameDateAt(36), { year: 1, season: "Winter" });
  assert.deepEqual(gameDateAt(48), { year: 2, season: "Spring" });
});

test("skip always lands on the next spring", () => {
  assert.equal(nextSpringAt(0), 48);
  assert.equal(nextSpringAt(47.99), 48);
  assert.equal(nextSpringAt(48), 96);
});

test("fast forward rises by one eighth to three times then wraps", () => {
  assert.equal(timeRateAt(0), 1);
  assert.equal(timeRateAt(1), 1.125);
  assert.equal(timeRateAt(MAX_FAST_FORWARD_STEPS), 3);
  assert.equal(nextFastForwardStep(MAX_FAST_FORWARD_STEPS), 0);
});
