import assert from "node:assert/strict";
import test from "node:test";
import {
  canShareImageFile,
  intentPostUrl,
  isPng,
  isShotId,
  MAP_SHARE_TEXT,
  newShotId,
  portraitShareText,
  shareChoice,
  shotCard,
  shotKind,
  shotPath,
  shotTitle,
  shotTweet,
  withinShotLimit,
} from "../lib/screenshot";

const MAP_ID = "map_11111111-1111-4111-8111-111111111111";
const PORTRAIT_ID = "portrait_22222222-2222-4222-a222-222222222222";

test("shareChoice prefers a real file when the browser can hand one over", () => {
  assert.equal(shareChoice(true), "file");
  assert.equal(shareChoice(false), "card");
});

test("canShareImageFile treats a refusal as the card path", () => {
  const file = new File([Uint8Array.from([1])], "shot.png", {
    type: "image/png",
  });
  assert.equal(
    canShareImageFile(file, () => true),
    true,
  );
  assert.equal(
    canShareImageFile(file, () => {
      throw new Error("files are unsupported");
    }),
    false,
  );
  assert.equal(canShareImageFile(file, undefined), false);
});

test("the X post names the game and then the image url", () => {
  const imageUrl =
    "https://example.public.blob.vercel-storage.com/shots/map_11111111-1111-4111-8111-111111111111.png";
  const text = shotTweet("https://mosslings.example", imageUrl);
  assert.equal(
    text,
    `Playing with Mosslings at https://mosslings.example\n\n${imageUrl}`,
  );
  const href = new URL(intentPostUrl(text));
  assert.equal(href.origin + href.pathname, "https://x.com/intent/post");
  assert.equal(href.searchParams.get("text"), text);
  assert.equal(href.searchParams.get("url"), null);
});

test("shot ids stay inside the shots folder", () => {
  assert.equal(isShotId(MAP_ID), true);
  assert.equal(isShotId(PORTRAIT_ID), true);
  assert.equal(shotKind(MAP_ID), "map");
  assert.equal(shotKind(PORTRAIT_ID), "portrait");
  assert.equal(shotPath(MAP_ID), `shots/${MAP_ID}.png`);
  assert.equal(isShotId("../etc/passwd"), false);
  assert.equal(isShotId(`${MAP_ID}.png`), false);
  assert.equal(isShotId("map_11111111-1111-3111-8111-111111111111"), false);
  assert.equal(shotKind("nope"), null);
  assert.throws(() => shotPath("shots/../../secret"), /Invalid screenshot id/);
});

test("new shot ids are shareable pathnames", () => {
  const id = newShotId("portrait");
  assert.equal(isShotId(id), true);
  assert.equal(shotKind(id), "portrait");
  assert.equal(shotCard(id), "summary");
  assert.equal(shotCard(MAP_ID), "summary_large_image");
  assert.equal(shotTitle(id), "Meet a Mossling");
  assert.equal(shotTitle(MAP_ID), MAP_SHARE_TEXT);
});

test("portrait posts name the species when it is known", () => {
  assert.equal(portraitShareText("Mossbun"), "Meet a Mossbun");
  assert.equal(portraitShareText("  "), "Meet a Mossling");
  assert.equal(portraitShareText(), "Meet a Mossling");
});

test("png uploads have to be real images under the card limit", () => {
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
  ]);
  assert.equal(isPng(png), true);
  assert.equal(isPng(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])), false);
  assert.equal(isPng(Uint8Array.from([0x89, 0x50])), false);
  assert.equal(withinShotLimit(png.length), true);
  assert.equal(withinShotLimit(5_000_000), true);
  assert.equal(withinShotLimit(5_000_001), false);
  assert.equal(withinShotLimit(8), false);
});
