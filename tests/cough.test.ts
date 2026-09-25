import assert from "node:assert/strict";
import test from "node:test";
import {
  COUGH_CYCLE_SECONDS,
  COUGH_FRAME_SECONDS,
  COUGH_GAP_SECONDS,
  COUGH_PLAY_SECONDS,
  COUGH_ROWS,
  COUGH_SCALE,
  COUGH_ZOOM,
  SICK_LINES,
  SPEECH_POP_ROWS,
  SPEECH_ROWS,
  coughMotion,
  coughsInView,
  sickLine,
} from "../lib/cough";
import type { Camera } from "../lib/map-camera";
import type { PreviewMossling } from "../lib/map-preview";

function sick(
  id: number,
  cellIndex: number,
  extra: Partial<PreviewMossling> = {},
): PreviewMossling {
  return {
    id,
    cellIndex,
    health: 100,
    colors: ["#88cc44"],
    pattern: 0,
    plagueMonths: 2,
    ...extra,
  };
}

test("the speech bubble is a borderless pill around an emoji sentence", () => {
  assert.deepEqual([...SICK_LINES], ["🤧💦😷", "🤒🤢💦", "😷🤧💫"]);
  assert.equal(sickLine(0), sickLine(0));
  assert.ok(SICK_LINES.includes(sickLine(4)));
  assert.ok((SPEECH_POP_ROWS[0]?.length ?? 0) < (SPEECH_ROWS[0]?.length ?? 0));
  assert.ok((SPEECH_ROWS[0]?.length ?? 0) > (COUGH_ROWS[0]?.length ?? 0));
  const mid = SPEECH_ROWS[Math.floor(SPEECH_ROWS.length / 2)] ?? "";
  const cap = SPEECH_ROWS[0] ?? "";
  assert.ok(cap.replaceAll(".", "").length < mid.replaceAll(".", "").length);
  assert.equal(SPEECH_ROWS.join("").includes("o"), false);
  assert.ok(mid.includes("w"));
});

test("the clip fades on the last frame, then stays quiet for 2 seconds", () => {
  const pop = coughMotion(0, 0);
  const full = coughMotion(COUGH_FRAME_SECONDS, 0);
  const hold = coughMotion(COUGH_FRAME_SECONDS * 2, 0);
  const fade = coughMotion(COUGH_FRAME_SECONDS * 3, 0);
  const fading = coughMotion(COUGH_FRAME_SECONDS * 3.6, 0);
  const quiet = coughMotion(COUGH_PLAY_SECONDS, 0);
  const stillQuiet = coughMotion(
    COUGH_PLAY_SECONDS + COUGH_GAP_SECONDS - 0.05,
    0,
  );
  const again = coughMotion(COUGH_CYCLE_SECONDS, 0);
  assert.equal(pop?.frame, 0);
  assert.equal(pop?.alpha, 1);
  assert.equal(full?.frame, 1);
  assert.equal(full?.alpha, 1);
  assert.equal(hold?.frame, 2);
  assert.equal(hold?.alpha, 1);
  assert.equal(fade?.frame, 3);
  assert.equal(fade?.alpha, 1);
  assert.ok(fading && fading.alpha < 0.5 && fading.alpha > 0);
  assert.equal(quiet, null);
  assert.equal(stillQuiet, null);
  assert.equal(again?.frame, 0);
  assert.equal(COUGH_GAP_SECONDS, 2);
});

test("neighboring ids cough a frame apart", () => {
  assert.equal(
    coughMotion(0, 1)?.frame,
    coughMotion(COUGH_FRAME_SECONDS, 0)?.frame,
  );
});

test("only a living infected Mossling at max zoom grows a bubble", () => {
  const camera: Camera = { x: 2, y: 2, width: 4, height: 3, left: 0, top: 0 };
  const width = 20;
  const onMap = 3 + 2 * width;
  const hidden = sick(0, 0);
  const healthy = sick(0, onMap, { plagueMonths: undefined });
  const dead = sick(0, onMap, { health: 0 });
  const ill = sick(0, onMap);
  assert.deepEqual(coughsInView([hidden], width, camera, COUGH_ZOOM, 0), []);
  assert.deepEqual(coughsInView([healthy], width, camera, COUGH_ZOOM, 0), []);
  assert.deepEqual(coughsInView([dead], width, camera, COUGH_ZOOM, 0), []);
  assert.deepEqual(coughsInView([ill], width, camera, 24, 0), []);
  assert.deepEqual(
    coughsInView([ill], width, camera, COUGH_ZOOM, COUGH_PLAY_SECONDS),
    [],
  );
  const shown = coughsInView([ill], width, camera, COUGH_ZOOM, 0);
  assert.equal(shown.length, 1);
  assert.equal(shown[0]?.text, sickLine(0));
  assert.equal(shown[0]?.frame, 0);
  assert.equal(shown[0]?.width, (SPEECH_POP_ROWS[0]?.length ?? 0) * COUGH_SCALE);
  const held = coughsInView(
    [ill],
    width,
    camera,
    COUGH_ZOOM,
    COUGH_FRAME_SECONDS,
  );
  assert.equal(held[0]?.frame, 1);
  assert.equal(held[0]?.width, (SPEECH_ROWS[0]?.length ?? 0) * COUGH_SCALE);
  assert.ok(COUGH_SCALE > 1);
  assert.ok((shown[0]?.y ?? 0) < Math.floor(onMap / width));
});

test("a cursing Mossling does not cough over the swear", () => {
  const camera: Camera = { x: 2, y: 2, width: 4, height: 3, left: 0, top: 0 };
  const width = 20;
  const onMap = 3 + 2 * width;
  const ill = sick(0, onMap, { cursedAt: 0 });
  assert.deepEqual(coughsInView([ill], width, camera, COUGH_ZOOM, 0), []);
  assert.equal(
    coughsInView([ill], width, camera, COUGH_ZOOM, COUGH_CYCLE_SECONDS).length,
    1,
  );
});
