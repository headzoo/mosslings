import assert from "node:assert/strict";
import test from "node:test";
import {
  CHATTER_CHANCE,
  CHATTER_LINES,
  chatterLine,
  chatterRoll,
  chattersInView,
  isChattering,
} from "../lib/chatter";
import {
  COUGH_CYCLE_SECONDS,
  COUGH_FRAME_SECONDS,
  COUGH_PLAY_SECONDS,
  COUGH_ZOOM,
  coughMotion,
} from "../lib/cough";
import { SEASON_SECONDS } from "../lib/game-time";
import { kiteRoll } from "../lib/kites";
import type { MapData } from "../lib/map";
import type { Camera } from "../lib/map-camera";
import type { PreviewMossling } from "../lib/map-preview";
import { seasonIndexAt, whistleRoll } from "../lib/whistle";

const camera: Camera = { x: 2, y: 2, width: 4, height: 3, left: 0, top: 0 };

function meadow(width = 20, height = 8): MapData {
  return {
    width,
    height,
    seed: 1,
    cells: Array.from({ length: width * height }, () => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: 0.2,
      fertility: 0.4,
      rockiness: 0.2,
    })),
  };
}

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

function idleSpeaker(seasonIndex = 0, elapsed = 0) {
  for (let id = 0; id < 8000; id++) {
    if (
      chatterRoll(id, seasonIndex) &&
      !whistleRoll(id, seasonIndex) &&
      !kiteRoll(id) &&
      coughMotion(elapsed, id)
    )
      return id;
  }
  throw new Error("expected a chatter in play");
}

function idThatChatters(seasonIndex = 0) {
  for (let id = 0; id < 4000; id++) {
    if (
      chatterRoll(id, seasonIndex) &&
      !whistleRoll(id, seasonIndex) &&
      !kiteRoll(id)
    )
      return id;
  }
  throw new Error("expected a chatter roll");
}

function gapElapsed(id: number) {
  const shifted =
    (((id * COUGH_FRAME_SECONDS) % COUGH_CYCLE_SECONDS) + COUGH_CYCLE_SECONDS) %
    COUGH_CYCLE_SECONDS;
  return (
    (COUGH_PLAY_SECONDS - shifted + COUGH_CYCLE_SECONDS) % COUGH_CYCLE_SECONDS
  );
}

test("about half of idle Mosslings win a season, and the same id agrees", () => {
  const season = 3;
  let wins = 0;
  for (let id = 0; id < 2000; id++) {
    const rolled = chatterRoll(id, season);
    assert.equal(rolled, chatterRoll(id, season));
    if (rolled) wins++;
  }
  assert.equal(CHATTER_CHANCE, 2);
  assert.ok(wins > 900 && wins < 1100);
});

test("a line lasts one season, then the herd re-rolls", () => {
  assert.equal(seasonIndexAt(0), 0);
  assert.equal(seasonIndexAt(SEASON_SECONDS - 0.001), 0);
  assert.equal(seasonIndexAt(SEASON_SECONDS), 1);

  const speaker = idThatChatters(0);
  assert.equal(chatterRoll(speaker, 0), true);
  assert.equal(chatterLine(speaker, 0), chatterLine(speaker, 0));
  assert.ok(CHATTER_LINES.includes(chatterLine(speaker, 0)));

  let flipped = 0;
  let reworded = 0;
  for (let id = 0; id < 600; id++) {
    if (chatterRoll(id, 0) !== chatterRoll(id, 1)) flipped++;
    if (chatterLine(id, 0) !== chatterLine(id, 1)) reworded++;
  }
  assert.ok(flipped > 0);
  assert.ok(reworded > 0);

  const seen = new Set<string>();
  for (let id = 0; id < 300; id++) seen.add(chatterLine(id, 2));
  assert.deepEqual([...seen].sort(), [...CHATTER_LINES].sort());
});

test("only an idle winner at max zoom grows a bubble", () => {
  const map = meadow();
  const width = map.width;
  const onMap = 3 + 2 * width;
  const speaker = idleSpeaker(0, 0);
  let quiet = -1;
  for (let id = 0; id < 4000; id++) {
    if (!chatterRoll(id, 0)) {
      quiet = id;
      break;
    }
  }
  assert.ok(quiet >= 0);
  const hidden = mossling(speaker, 0);
  const dead = mossling(speaker, onMap, { health: 0 });
  const mute = mossling(quiet, onMap);
  const live = mossling(speaker, onMap);

  assert.equal(isChattering(live, 0, map), true);
  assert.equal(isChattering(dead, 0, map), false);
  assert.equal(isChattering(mute, 0, map), false);

  assert.deepEqual(chattersInView([hidden], map, camera, COUGH_ZOOM, 0), []);
  assert.deepEqual(chattersInView([dead], map, camera, COUGH_ZOOM, 0), []);
  assert.deepEqual(chattersInView([mute], map, camera, COUGH_ZOOM, 0), []);
  assert.deepEqual(chattersInView([live], map, camera, 24, 0), []);
  assert.deepEqual(
    chattersInView([live], map, camera, COUGH_ZOOM, gapElapsed(speaker)),
    [],
  );

  const shown = chattersInView([live], map, camera, COUGH_ZOOM, 0);
  assert.equal(shown.length, 1);
  assert.equal(shown[0]?.text, chatterLine(speaker, 0));
  assert.equal(shown[0]?.frame, coughMotion(0, speaker)?.frame);
  assert.ok((shown[0]?.y ?? 0) < Math.floor(onMap / width));
});

test("occupied Mosslings stay quiet", () => {
  const map = meadow();
  const width = map.width;
  const onMap = 3 + 2 * width;
  const speaker = idThatChatters(0);
  const live = mossling(speaker, onMap);
  assert.equal(isChattering(live, 0, map), true);

  const plague = mossling(speaker, onMap, { plagueMonths: 1 });
  const cursed = mossling(speaker, onMap, { cursedAt: 0 });
  const alarmed = mossling(speaker, onMap, { panic: 0.2 });
  const calm = mossling(speaker, onMap, { panic: 0.1 });
  const playing = mossling(speaker, onMap, {
    soccer: { partnerId: 1, since: 0, face: "right", phase: "approach" },
  });
  const courting = mossling(speaker, onMap, {
    ritual: { partnerId: 1, months: 1, since: 0, phase: "courtship" },
  });
  assert.equal(isChattering(plague, 0, map), false);
  assert.equal(isChattering(cursed, 0, map), false);
  assert.equal(isChattering(alarmed, 0, map), false);
  assert.equal(isChattering(calm, 0, map), true);
  assert.equal(isChattering(playing, 0, map), false);
  assert.equal(isChattering(courting, 0, map), false);
  assert.deepEqual(chattersInView([plague], map, camera, COUGH_ZOOM, 0), []);

  let whistler = -1;
  for (let id = 0; id < 8000; id++) {
    if (chatterRoll(id, 0) && whistleRoll(id, 0)) {
      whistler = id;
      break;
    }
  }
  assert.ok(whistler >= 0);
  assert.equal(isChattering(mossling(whistler, onMap), 0, map), false);

  let flyer = -1;
  for (let id = 0; id < 8000; id++) {
    if (chatterRoll(id, 0) && kiteRoll(id) && !whistleRoll(id, 0)) {
      flyer = id;
      break;
    }
  }
  assert.ok(flyer >= 0);
  assert.equal(isChattering(mossling(flyer, onMap), 0, map), false);

  const home = map.cells[onMap];
  assert.ok(home);
  home.growth = 1;
  assert.equal(isChattering(live, 0, map), false);
  home.growth = undefined;

  home.terrain = "water";
  assert.equal(isChattering(live, 0, map), false);
  home.terrain = "grass";

  home.burning = true;
  assert.equal(isChattering(live, 0, map), false);
  home.burning = false;

  assert.equal(isChattering(live, 0, map), true);
});

test("a kite flyer can still talk once summer is over", () => {
  const map = meadow();
  const onMap = 3 + 2 * map.width;
  let flyer = -1;
  for (let id = 0; id < 8000; id++) {
    if (
      chatterRoll(id, 1) &&
      kiteRoll(id) &&
      !whistleRoll(id, 1) &&
      coughMotion(SEASON_SECONDS, id)
    ) {
      flyer = id;
      break;
    }
  }
  assert.ok(flyer >= 0);
  const mosslingOnGrass = mossling(flyer, onMap);
  assert.equal(isChattering(mosslingOnGrass, SEASON_SECONDS, map), true);
  const shown = chattersInView(
    [mosslingOnGrass],
    map,
    camera,
    COUGH_ZOOM,
    SEASON_SECONDS,
  );
  assert.equal(shown.length, 1);
  assert.equal(shown[0]?.text, chatterLine(flyer, 1));
});
