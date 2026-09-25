import assert from "node:assert/strict";
import test from "node:test";
import { GOD_SOUND_CUES, godSoundWaitsForImpact } from "../lib/chiptune";
import type { PowerId } from "../lib/god/types";

const POWERS: PowerId[] = [
  "rain",
  "sun",
  "raze",
  "disease",
  "fire",
  "tornado",
  "nuke",
  "lightning",
  "meteor",
];

test("every god tool has one sound cue", () => {
  assert.deepEqual(Object.keys(GOD_SOUND_CUES).sort(), [...POWERS].sort());
  for (const power of POWERS) {
    const cue = GOD_SOUND_CUES[power];
    assert.ok(cue === "sting" || cue === "impact");
  }
});

test("only an incoming nuke or meteor waits for the blast", () => {
  for (const power of POWERS) {
    assert.equal(
      godSoundWaitsForImpact(power),
      power === "nuke" || power === "meteor",
    );
  }
});
