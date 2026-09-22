import assert from "node:assert/strict";
import test from "node:test";
import { blendNouns, speciesName } from "../lib/species-name";

test("a vowel cut keeps the first head and the second tail", () => {
  assert.equal(blendNouns("muffin", "pebble"), "Mubble");
});

test("a species key always maps to the same short name", () => {
  const key = "1:#ffe632,#769f24";
  assert.equal(speciesName(key), speciesName(key));
  assert.match(speciesName(key), /^[A-Z][a-z]+$/);
  assert.ok(speciesName(key).length <= 10);
});

test("different looks can receive different names", () => {
  assert.notEqual(speciesName("0:#111111"), speciesName("4:#49d5df,#6c58d5"));
});

test("every keyed name is one capitalized word within the length cap", () => {
  for (let index = 0; index < 48; index++) {
    const name = speciesName(
      `${index % 6}:#${index.toString(16).padStart(6, "0")}`,
    );
    assert.match(name, /^[A-Z][a-z]{1,9}$/);
  }
});
