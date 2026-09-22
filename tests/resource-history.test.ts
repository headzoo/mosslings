import assert from "node:assert/strict";
import test from "node:test";
import {
  ResourceHistory,
  SAMPLES_PER_YEAR,
  sampleFromResources,
} from "../lib/resource-history";

const sample = (n: number) =>
  sampleFromResources({
    born: n,
    mosslings: n,
    killed: n,
    food: n * 2,
    trees: 0,
    destroyed: 10,
    health: 80 + n,
  });

test("resource history keeps the newest twelve monthly samples", () => {
  const history = ResourceHistory.empty();
  for (let i = 1; i <= SAMPLES_PER_YEAR + 3; i++) history.record(sample(i));
  const values = history.values();
  assert.equal(values.length, SAMPLES_PER_YEAR);
  assert.deepEqual(
    values.map((entry) => entry.mosslings),
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  );
});

test("resource history returns samples oldest to newest", () => {
  const history = ResourceHistory.empty();
  history.record(sample(1));
  history.record(sample(2));
  history.record(sample(3));
  assert.deepEqual(
    history.values().map((entry) => entry.food),
    [2, 4, 6],
  );
});

test("sampleFromResources maps world resource counts", () => {
  assert.deepEqual(
    sampleFromResources({
      born: 3,
      mosslings: 7,
      killed: 2,
      food: 11,
      trees: 3,
      destroyed: 4,
      health: 92,
    }),
    {
      born: 3,
      mosslings: 7,
      food: 11,
      killed: 2,
      destroyed: 4,
      health: 92,
    },
  );
});
