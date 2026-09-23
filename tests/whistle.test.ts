import assert from "node:assert/strict";
import test from "node:test";
import { CURSE_PLAY_SECONDS } from "../lib/curse";
import { SEASON_SECONDS } from "../lib/game-time";
import type { Camera } from "../lib/map-camera";
import type { PreviewMossling } from "../lib/map-preview";
import { SPRITE_ZOOM } from "../lib/mossling-detail";
import {
  isWhistling,
  NOTE_HEIGHT,
  NOTE_ROWS,
  NOTE_WIDTH,
  seasonIndexAt,
  WHISTLE_CHANCE,
  WHISTLE_CYCLE_SECONDS,
  WHISTLE_FRAME_COUNT,
  WHISTLE_FRAME_SECONDS,
  WHISTLE_GAP_SECONDS,
  WHISTLE_PLAY_SECONDS,
  WHISTLE_SCALES,
  whistleMotion,
  whistleRoll,
  whistleSize,
  whistlesInView,
} from "../lib/whistle";

function mossling(
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
    ...extra,
  };
}

function idThatWhistles(seasonIndex = 0) {
  for (let id = 0; id < 400; id++) {
    if (whistleRoll(id, seasonIndex)) return id;
  }
  throw new Error("expected a whistle roll");
}

function idThatWhistlesInPlay(seasonIndex = 0, elapsed = 0) {
  for (let id = 0; id < 2000; id++) {
    if (whistleRoll(id, seasonIndex) && whistleMotion(elapsed, id)) return id;
  }
  throw new Error("expected a whistle in play");
}

function idThatStaysQuiet(seasonIndex = 0) {
  for (let id = 0; id < 400; id++) {
    if (!whistleRoll(id, seasonIndex)) return id;
  }
  throw new Error("expected a quiet roll");
}

function gapElapsed(id: number) {
  const shifted =
    (((id * WHISTLE_FRAME_SECONDS) % WHISTLE_CYCLE_SECONDS) +
      WHISTLE_CYCLE_SECONDS) %
    WHISTLE_CYCLE_SECONDS;
  return (
    (WHISTLE_PLAY_SECONDS - shifted + WHISTLE_CYCLE_SECONDS) %
    WHISTLE_CYCLE_SECONDS
  );
}

test("about one Mossling in twenty wins a season, and the same id agrees", () => {
  const season = 3;
  let wins = 0;
  for (let id = 0; id < 2000; id++) {
    const rolled = whistleRoll(id, season);
    assert.equal(rolled, whistleRoll(id, season));
    if (rolled) wins++;
  }
  assert.equal(WHISTLE_CHANCE, 20);
  assert.ok(wins > 50 && wins < 150);
});

test("a whistle lasts one season, then the herd re-rolls", () => {
  assert.equal(seasonIndexAt(0), 0);
  assert.equal(seasonIndexAt(SEASON_SECONDS - 0.001), 0);
  assert.equal(seasonIndexAt(SEASON_SECONDS), 1);
  assert.equal(seasonIndexAt(SEASON_SECONDS * 4), 4);

  const singer = idThatWhistles(0);
  assert.equal(whistleRoll(singer, 0), true);
  let flipped = 0;
  for (let id = 0; id < 400; id++) {
    if (whistleRoll(id, 0) !== whistleRoll(id, 1)) flipped++;
  }
  assert.ok(flipped > 0);
});

test("the note is an eighth-note glyph with a stem and flag", () => {
  assert.equal(NOTE_WIDTH, 7);
  assert.equal(NOTE_HEIGHT, 9);
  assert.ok((NOTE_ROWS[0] ?? "").includes("1"));
  assert.ok((NOTE_ROWS[NOTE_HEIGHT - 1] ?? "").includes("1"));
  const filled = NOTE_ROWS.join("").split("1").length - 1;
  assert.ok(filled > 10);
});

test("the clip fades on the last frame, then stays quiet for 2 seconds", () => {
  const pop = whistleMotion(0, 0);
  const grown = whistleMotion(WHISTLE_FRAME_SECONDS, 0);
  const full = whistleMotion(WHISTLE_FRAME_SECONDS * 2, 0);
  const fade = whistleMotion(WHISTLE_FRAME_SECONDS * 3, 0);
  const fading = whistleMotion(WHISTLE_FRAME_SECONDS * 3 + 0.2, 0);
  const quiet = whistleMotion(WHISTLE_PLAY_SECONDS, 0);
  const stillQuiet = whistleMotion(
    WHISTLE_PLAY_SECONDS + WHISTLE_GAP_SECONDS - 0.05,
    0,
  );
  const again = whistleMotion(WHISTLE_CYCLE_SECONDS, 0);
  assert.equal(pop?.frame, 0);
  assert.equal(pop?.alpha, 1);
  assert.equal(pop?.scale, WHISTLE_SCALES[0]);
  assert.equal(grown?.frame, 1);
  assert.equal(full?.frame, 2);
  assert.equal(full?.scale, 1);
  assert.equal(fade?.frame, 3);
  assert.equal(fade?.alpha, 1);
  assert.ok(fading && fading.alpha < 0.5 && fading.alpha > 0);
  assert.equal(quiet, null);
  assert.equal(stillQuiet, null);
  assert.equal(again?.frame, 0);
  assert.equal(WHISTLE_FRAME_COUNT, 4);
  assert.equal(WHISTLE_GAP_SECONDS, 2);
});

test("notes rise through the play, then start over", () => {
  const low = whistleMotion(0, 0);
  const high = whistleMotion(WHISTLE_FRAME_SECONDS * 2, 0);
  const again = whistleMotion(WHISTLE_CYCLE_SECONDS, 0);
  assert.equal(low?.dy, 0);
  assert.ok((high?.dy ?? 0) < (low?.dy ?? 0));
  assert.equal(again?.dy, low?.dy);
});

test("neighboring ids whistle a frame apart", () => {
  assert.equal(
    whistleMotion(0, 1)?.frame,
    whistleMotion(WHISTLE_FRAME_SECONDS, 0)?.frame,
  );
});

test("later frames grow, and closer zoom draws a larger note", () => {
  assert.ok(
    whistleSize(24, WHISTLE_SCALES[0]).height < whistleSize(24, 1).height,
  );
  assert.ok(whistleSize(32, 1).height > whistleSize(24, 1).height);
  assert.ok(whistleSize(24, 1).width < whistleSize(24, 1).height);
});

test("only a living winner at sprite zoom grows a note", () => {
  const camera: Camera = { x: 2, y: 2, width: 4, height: 3, left: 0, top: 0 };
  const width = 20;
  const onMap = 3 + 2 * width;
  const singer = idThatWhistlesInPlay(0);
  const quiet = idThatStaysQuiet(0);
  const hidden = mossling(singer, 0);
  const dead = mossling(singer, onMap, { health: 0 });
  const plague = mossling(singer, onMap, { plagueMonths: 1 });
  const mute = mossling(quiet, onMap);
  const live = mossling(singer, onMap);

  assert.equal(isWhistling(live, 0), true);
  assert.equal(isWhistling(dead, 0), false);
  assert.equal(isWhistling(plague, 0), false);
  assert.equal(isWhistling(mute, 0), false);

  assert.deepEqual(whistlesInView([hidden], width, camera, SPRITE_ZOOM, 0), []);
  assert.deepEqual(whistlesInView([dead], width, camera, SPRITE_ZOOM, 0), []);
  assert.deepEqual(whistlesInView([plague], width, camera, SPRITE_ZOOM, 0), []);
  assert.deepEqual(whistlesInView([mute], width, camera, SPRITE_ZOOM, 0), []);
  assert.deepEqual(whistlesInView([live], width, camera, 16, 0), []);
  assert.deepEqual(
    whistlesInView([live], width, camera, SPRITE_ZOOM, gapElapsed(singer)),
    [],
  );

  const shown = whistlesInView([live], width, camera, SPRITE_ZOOM, 0);
  assert.equal(shown.length, 1);
  assert.equal(shown[0]?.frame, whistleMotion(0, singer)?.frame);
  assert.ok((shown[0]?.y ?? 0) < Math.floor(onMap / width) + 0.5);
  const close = whistlesInView([live], width, camera, 32, 0);
  assert.ok((close[0]?.height ?? 0) > (shown[0]?.height ?? 0));
});

test("a cursing Mossling does not whistle over the swear", () => {
  const camera: Camera = { x: 2, y: 2, width: 4, height: 3, left: 0, top: 0 };
  const width = 20;
  const onMap = 3 + 2 * width;
  const singer = idThatWhistlesInPlay(0);
  const cursed = mossling(singer, onMap, { cursedAt: 0 });
  assert.equal(isWhistling(cursed, 0), false);
  assert.deepEqual(whistlesInView([cursed], width, camera, SPRITE_ZOOM, 0), []);
  assert.ok(WHISTLE_CYCLE_SECONDS > CURSE_PLAY_SECONDS);
  assert.equal(
    whistlesInView([cursed], width, camera, SPRITE_ZOOM, WHISTLE_CYCLE_SECONDS)
      .length,
    1,
  );
});
