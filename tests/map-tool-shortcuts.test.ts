import assert from "node:assert/strict";
import test from "node:test";
import {
  mapToolFromKeyboard,
  mapToolShortcutLabel,
  shouldIgnoreMapToolShortcut,
} from "../lib/map-tool-shortcuts";

function key(
  key: string,
  options: { ctrlKey?: boolean; metaKey?: boolean; code?: string } = {},
) {
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    code: options.code ?? `Key${key.toUpperCase()}`,
  };
}

test("mapToolFromKeyboard maps modifier shortcuts to tools", () => {
  assert.equal(mapToolFromKeyboard(key("s", { ctrlKey: true })), "pointer");
  assert.equal(mapToolFromKeyboard(key("G", { metaKey: true })), "move");
  assert.equal(mapToolFromKeyboard(key("e", { ctrlKey: true })), "zoom-in");
  assert.equal(mapToolFromKeyboard(key("E", { metaKey: true })), "zoom-in");
  assert.equal(mapToolFromKeyboard(key("b", { ctrlKey: true })), "zoom-out");
  assert.equal(mapToolFromKeyboard(key("B", { metaKey: true })), "zoom-out");
});

test("mapToolFromKeyboard ignores unmodified keys", () => {
  assert.equal(mapToolFromKeyboard(key("s")), null);
  assert.equal(mapToolFromKeyboard(key("e")), null);
  assert.equal(mapToolFromKeyboard(key("b")), null);
});

test("mapToolShortcutLabel uses Ctrl by default", () => {
  assert.equal(mapToolShortcutLabel("pointer"), "Ctrl+S");
  assert.equal(mapToolShortcutLabel("zoom-in"), "Ctrl+E");
  assert.equal(mapToolShortcutLabel("zoom-out"), "Ctrl+B");
});

test("shouldIgnoreMapToolShortcut skips editable fields", () => {
  const input = { tagName: "INPUT", isContentEditable: false } as HTMLElement;
  assert.equal(shouldIgnoreMapToolShortcut({ target: input }), true);
  const button = { tagName: "BUTTON", isContentEditable: false } as HTMLElement;
  assert.equal(shouldIgnoreMapToolShortcut({ target: button }), false);
});
