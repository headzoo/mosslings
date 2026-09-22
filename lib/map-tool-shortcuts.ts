export type MapTool = "pointer" | "move" | "zoom-in" | "zoom-out";

export function modKeyLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

export function mapToolShortcutLabel(tool: MapTool): string {
  const mod = modKeyLabel();
  switch (tool) {
    case "pointer":
      return `${mod}+S`;
    case "move":
      return `${mod}+G`;
    case "zoom-in":
      return `${mod}+E`;
    case "zoom-out":
      return `${mod}+B`;
  }
}

const MAP_TOOL_NAMES: Record<MapTool, string> = {
  pointer: "Inspect map",
  move: "Move map",
  "zoom-in": "Zoom in",
  "zoom-out": "Zoom out",
};

export function mapToolButtonLabel(tool: MapTool): string {
  return `${MAP_TOOL_NAMES[tool]} (${mapToolShortcutLabel(tool)})`;
}

export function shouldIgnoreMapToolShortcut(
  event: Pick<KeyboardEvent, "target">,
): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function mapToolFromKeyboard(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "code">,
): MapTool | null {
  if (!event.ctrlKey && !event.metaKey) return null;
  const key = event.key;
  if (key === "s" || key === "S") return "pointer";
  if (key === "g" || key === "G") return "move";
  if (key === "e" || key === "E") return "zoom-in";
  if (key === "b" || key === "B") return "zoom-out";
  return null;
}
