import assert from "node:assert/strict";
import test from "node:test";
import { getCamera, zoomAtPoint } from "../lib/map-camera";

const map = { width: 100, height: 100 };
const viewport = { width: 400, height: 400 };

test("zooming in on an off-center click moves the view toward that point", () => {
  const before = getCamera(map, viewport, 16, { x: 0.5, y: 0.5 });
  const screen = { x: 300, y: 280 };
  const mapX = (screen.x - before.left) / 16;
  const mapY = (screen.y - before.top) / 16;
  const next = zoomAtPoint(map, viewport, 16, before, screen, 1);
  assert.equal(next.tileSize, 24);
  assert.ok(next.center.x > 0.5);
  assert.ok(next.center.y > 0.5);
  const after = getCamera(map, viewport, next.tileSize, next.center);
  assert.ok(Math.abs(after.left + mapX * next.tileSize - screen.x) <= 1);
  assert.ok(Math.abs(after.top + mapY * next.tileSize - screen.y) <= 1);
});

test("zooming out clamps the camera to the map edge", () => {
  const before = getCamera(map, viewport, 16, { x: 0.145, y: 0.5 });
  assert.ok(before.x < 5);
  const next = zoomAtPoint(map, viewport, 16, before, { x: 300, y: 200 }, -1);
  assert.equal(next.tileSize, 8);
  const after = getCamera(map, viewport, next.tileSize, next.center);
  assert.equal(after.x, 0);
  assert.equal(next.center.x, after.width / 2 / map.width);
});
