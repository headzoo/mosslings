import assert from "node:assert/strict";
import test from "node:test";
import { ASCENT_SECONDS, diedAscentFrame } from "../lib/died-sprite";
import { FRAME_COUNT } from "../lib/mossling-detail";

test("diedAscentFrame starts at frame 0", () => {
  assert.equal(diedAscentFrame(0), 0);
});

test("diedAscentFrame advances through all frames over one second", () => {
  const span = ASCENT_SECONDS / FRAME_COUNT;
  assert.equal(diedAscentFrame(span * 0.5), 0);
  assert.equal(diedAscentFrame(span), 1);
  assert.equal(diedAscentFrame(span * 2), 2);
  assert.equal(diedAscentFrame(span * 3), 3);
  assert.equal(diedAscentFrame(ASCENT_SECONDS - 0.001), 3);
});

test("diedAscentFrame returns idle frame 0 after ascent completes", () => {
  assert.equal(diedAscentFrame(ASCENT_SECONDS), 0);
  assert.equal(diedAscentFrame(ASCENT_SECONDS + 5), 0);
});
