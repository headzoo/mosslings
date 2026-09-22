import { CROP_GROW_LIGHT, CROP_GROW_MOISTURE } from "./crops";
import type { MapData } from "./map";
import type { PreviewMossling } from "./map-preview";
import type { WorldResources } from "./world-resources";

/** Repeat a warning that is still true only after this much real time. */
export const ADVISORY_REPEAT_MS = 40_000;

/** Average health must fall below this before the health bulletin appears. */
export const HEALTH_ADVISORY_BELOW = 75;

export type AdvisoryKind =
  | "starve"
  | "wither"
  | "dry"
  | "shade"
  | "health"
  | "shortage";

const ADVISORY_KINDS: readonly AdvisoryKind[] = [
  "starve",
  "wither",
  "dry",
  "shade",
  "health",
  "shortage",
];

export type AdvisoryMemory = {
  /** Highest world-event id already considered. */
  seenEventId: number;
  previousHealth: number | null;
  lastShown: Partial<Record<AdvisoryKind, number>>;
  starve: boolean;
  wither: boolean;
  healthFalling: boolean;
};

export const EMPTY_ADVISORY_MEMORY: AdvisoryMemory = {
  seenEventId: -1,
  previousHealth: null,
  lastShown: {},
  starve: false,
  wither: false,
  healthFalling: false,
};

export type AdvisoryWorld = {
  map: MapData;
  mosslings: readonly PreviewMossling[];
  resources: WorldResources;
  events: readonly { id: number; message: string }[];
};

/**
 * Highest-priority trouble that should interrupt the bulletin board.
 * `commit` records the cooldown. Pass false while another card is on screen
 * so the warning is still waiting when that card finishes.
 */
export function stepAdvisory(
  world: AdvisoryWorld,
  memory: AdvisoryMemory,
  now: number,
  commit = true,
): { kind: AdvisoryKind | null; memory: AdvisoryMemory } {
  const fresh = world.events.filter((event) => event.id > memory.seenEventId);
  const starveEvent = fresh.some((event) => event.message.includes("starved"));
  const witherEvent = fresh.some((event) =>
    event.message.includes("crops withered"),
  );
  let starve = memory.starve || starveEvent;
  let wither = memory.wither || witherEvent;
  const crops = world.map.cells.filter(
    (cell) =>
      cell.growth !== undefined && !cell.burning && !cell.damage && !cell.tree,
  );
  const parched = crops.filter((cell) => cell.moisture < CROP_GROW_MOISTURE);
  const dry = crops.length > 0 && parched.length * 2 >= crops.length;
  const unripe = crops.filter((cell) => (cell.growth ?? 0) < 1);
  const shaded = unripe.filter(
    (cell) =>
      cell.moisture >= CROP_GROW_MOISTURE &&
      (cell.light ?? 0) < CROP_GROW_LIGHT,
  );
  const shade = unripe.length > 0 && shaded.length * 2 >= unripe.length;
  const hungry = world.mosslings.some(
    (mossling) => (mossling.health ?? 100) > 0 && mossling.hungry,
  );
  const health = world.resources.health;
  let healthFalling = memory.healthFalling;
  if (
    hungry &&
    memory.previousHealth !== null &&
    health < memory.previousHealth &&
    health < HEALTH_ADVISORY_BELOW
  ) {
    healthFalling = true;
  }
  if (
    !hungry ||
    health >= HEALTH_ADVISORY_BELOW ||
    (memory.previousHealth !== null && health > memory.previousHealth)
  ) {
    healthFalling = false;
  }
  const shortage =
    world.resources.mosslings > 0 &&
    world.resources.food < world.resources.mosslings;

  if (!hungry) starve = false;
  if (crops.length === 0 || parched.length === 0) wither = false;

  const active: AdvisoryKind[] = [];
  if (starve || starveEvent) active.push("starve");
  if (wither || witherEvent) active.push("wither");
  if (dry) active.push("dry");
  if (shade) active.push("shade");
  if (healthFalling) active.push("health");
  if (shortage) active.push("shortage");

  const top = active[0] ?? null;
  const shown = top ? memory.lastShown[top] : undefined;
  const kind =
    top && (shown === undefined || now - shown >= ADVISORY_REPEAT_MS)
      ? top
      : null;

  const lastShown: Partial<Record<AdvisoryKind, number>> = {};
  for (const name of ADVISORY_KINDS) {
    if (!active.includes(name)) continue;
    const at = memory.lastShown[name];
    if (at !== undefined) lastShown[name] = at;
  }
  if (commit && kind) lastShown[kind] = now;

  return {
    kind,
    memory: {
      seenEventId: world.events.reduce(
        (max, event) => Math.max(max, event.id),
        memory.seenEventId,
      ),
      previousHealth: health,
      lastShown,
      starve,
      wither,
      healthFalling,
    },
  };
}
