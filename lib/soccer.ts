import { CHASE_PLAY_SECONDS } from "./chase";
import { MONTH_SECONDS, type Season } from "./game-time";
import { addToBucket, eachInReach } from "./god/shared";
import type { Camera } from "./map-camera";
import type { PlayKind, PreviewMossling, SoccerGame } from "./map-preview";
import {
  KICK_FRAME_COUNT,
  KICK_SECONDS,
  mosslingInView,
  ROUND_ZOOM,
  SPRITE_ZOOM,
} from "./mossling-detail";
import { traitValue } from "./mossling-traits";

/** Tiles apart where a pair can roll for a game. */
export const SOCCER_INVITE = 4;
/** Tiles apart where they stop walking and kick. */
export const SOCCER_REACH = 2;
export const SOCCER_CHANCE = 0.2;
/** How long a pair keeps kicking once play begins. */
export const SOCCER_PLAY_SECONDS = MONTH_SECONDS * 2;
/** Games a new pair can roll. Later games join this list. */
export const PLAY_KINDS = [
  "soccer",
  "chase",
  "snowball",
] as const satisfies readonly PlayKind[];

/** Snowballs join the roll only in winter. Other seasons keep the rest of the list. */
export function gamesThisSeason(season: Season): readonly PlayKind[] {
  if (season === "Winter") return PLAY_KINDS;
  return PLAY_KINDS.filter((kind) => kind !== "snowball");
}

/**
 * Equal odds across the games this season allows.
 * Zero stays soccer, so a constant zero roll does too.
 */
export function rollPlayKind(
  random: () => number,
  season: Season = "Summer",
): PlayKind {
  const games = gamesThisSeason(season);
  const index = Math.min(games.length - 1, Math.floor(random() * games.length));
  return games[index] ?? "soccer";
}

/** Strike pose in the six-frame kick: plant, lift, kick, follow, recover, rest. */
export const KICK_STRIKE = 2;
/** Tiles from a player's center to the foot the ball leaves. */
export const SOCCER_FOOT = 0.38;

export const SOCCER_BALL_WHITE = "#f7f4ea";
export const SOCCER_BALL_INK = "#1c1914";
export const SOCCER_BALL_ROWS = [
  ".bwb.",
  "bwwwb",
  "wwbww",
  "bwwwb",
  ".bwb.",
] as const;

/** Panel color. A snowball keeps every panel and paints it white. */
export function ballFill(mark: string, snow: boolean): string | null {
  if (mark !== "b" && mark !== "w") return null;
  if (snow || mark === "w") return SOCCER_BALL_WHITE;
  return SOCCER_BALL_INK;
}

export interface SoccerMonthInput {
  mosslings: PreviewMossling[];
  width: number;
  elapsed: number;
  random: () => number;
  isPanicked: (id: number) => boolean;
  busy: ReadonlySet<number>;
  /** Missing means summer, so a snowball is not on offer. */
  season?: Season;
  canMoveTo: (mossling: PreviewMossling, x: number, y: number) => boolean;
  move: (mossling: PreviewMossling, x: number, y: number) => void;
}

export interface BallMark {
  /** Tile-space center of the ball. */
  x: number;
  y: number;
  size: number;
  /** A snowball keeps the soccer shape and drops the dark panels. */
  snow?: boolean;
}

const alive = (
  mossling: PreviewMossling | undefined,
): mossling is PreviewMossling => !!mossling && (mossling.health ?? 100) > 0;

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function cellPos(cellIndex: number, width: number) {
  return {
    x: cellIndex % width,
    y: Math.floor(cellIndex / width),
  };
}

/** Above-average sociability, and cowardice no higher than the midpoint. */
export function wantsSoccer(
  traits: PreviewMossling["traits"] | undefined,
): boolean {
  return (
    traitValue(traits, "Sociability") > 50 &&
    traitValue(traits, "Cowardice") <= 50
  );
}

/** The western Mossling faces right. A shared column gives that face to the lower id. */
export function soccerFaces(
  a: { id: number; x: number; y: number },
  b: { id: number; x: number; y: number },
): { a: SoccerGame["face"]; b: SoccerGame["face"] } {
  const aLeads = a.x < b.x || (a.x === b.x && a.id < b.id);
  return aLeads ? { a: "right", b: "left" } : { a: "left", b: "right" };
}

function clearGame(mossling: PreviewMossling | undefined) {
  if (mossling?.soccer) mossling.soccer = undefined;
}

function stepToward(
  mossling: PreviewMossling,
  target: { x: number; y: number },
  width: number,
  random: () => number,
  canMoveTo: SoccerMonthInput["canMoveTo"],
  move: SoccerMonthInput["move"],
) {
  const from = cellPos(mossling.cellIndex, width);
  const dx = Math.sign(target.x - from.x);
  const dy = Math.sign(target.y - from.y);
  const horizontal: [number, number] = [dx, 0];
  const vertical: [number, number] = [0, dy];
  const options: [number, number][] = [];
  if (dx && dy) {
    if (Math.abs(target.x - from.x) > Math.abs(target.y - from.y))
      options.push(horizontal, vertical);
    else if (Math.abs(target.y - from.y) > Math.abs(target.x - from.x))
      options.push(vertical, horizontal);
    else if (random() < 0.5) options.push(horizontal, vertical);
    else options.push(vertical, horizontal);
  } else if (dx) options.push(horizontal);
  else if (dy) options.push(vertical);
  const origin = mossling.cellIndex;
  for (const [sx, sy] of options) {
    if (!canMoveTo(mossling, from.x + sx, from.y + sy)) continue;
    move(mossling, from.x + sx, from.y + sy);
    if (mossling.cellIndex !== origin) return true;
  }
  return false;
}

function writeGame(
  a: PreviewMossling,
  b: PreviewMossling,
  width: number,
  phase: SoccerGame["phase"],
  since: number,
  random: () => number,
  season: Season,
) {
  const faces = soccerFaces(
    { id: a.id, ...cellPos(a.cellIndex, width) },
    { id: b.id, ...cellPos(b.cellIndex, width) },
  );
  const kind = a.soccer?.kind ?? b.soccer?.kind ?? rollPlayKind(random, season);
  a.soccer = { partnerId: b.id, since, face: faces.a, phase, kind };
  b.soccer = { partnerId: a.id, since, face: faces.b, phase, kind };
}

/**
 * Keep a play month still, or walk an approach in until the pair can kick.
 * False means the game was dropped.
 */
function pursue(
  a: PreviewMossling,
  b: PreviewMossling,
  input: SoccerMonthInput,
): boolean {
  const { width, elapsed, random, canMoveTo, move } = input;
  const season = input.season ?? "Summer";
  if (a.soccer?.kind === "snowball" && season !== "Winter") {
    clearGame(a);
    clearGame(b);
    return false;
  }
  const phase = a.soccer?.phase ?? "play";
  if (phase === "play") {
    const limit =
      a.soccer?.kind === "chase" ? CHASE_PLAY_SECONDS : SOCCER_PLAY_SECONDS;
    if (elapsed >= (a.soccer?.since ?? 0) + limit) {
      clearGame(a);
      clearGame(b);
      return false;
    }
    return true;
  }
  let distance = chebyshev(
    cellPos(a.cellIndex, width),
    cellPos(b.cellIndex, width),
  );
  if (distance > SOCCER_INVITE || distance < 1) {
    clearGame(a);
    clearGame(b);
    return false;
  }
  if (distance > SOCCER_REACH) {
    stepToward(a, cellPos(b.cellIndex, width), width, random, canMoveTo, move);
    stepToward(b, cellPos(a.cellIndex, width), width, random, canMoveTo, move);
    distance = chebyshev(
      cellPos(a.cellIndex, width),
      cellPos(b.cellIndex, width),
    );
  }
  if (distance > SOCCER_INVITE || distance < 1) {
    clearGame(a);
    clearGame(b);
    return false;
  }
  if (distance <= SOCCER_REACH) {
    writeGame(a, b, width, "play", elapsed, random, season);
    return true;
  }
  writeGame(a, b, width, "approach", a.soccer?.since ?? 0, random, season);
  return true;
}

/**
 * Finish finished games, walk pairs who are still on their way, then let every
 * other free pair within four tiles roll. Returned ids skip wander.
 */
export function soccerMonth(input: SoccerMonthInput): Set<number> {
  const { mosslings, width, elapsed, random, isPanicked, busy } = input;
  const season = input.season ?? "Summer";
  const playing = new Set<number>();
  const byId = new Map(mosslings.map((mossling) => [mossling.id, mossling]));

  for (const mossling of mosslings) {
    const game = mossling.soccer;
    if (!game) continue;
    const partner = byId.get(game.partnerId);
    const mutual = partner?.soccer?.partnerId === mossling.id;
    if (mutual && partner && mossling.id > partner.id) continue;
    if (!mutual || !alive(mossling) || !alive(partner)) {
      clearGame(mossling);
      if (partner?.soccer?.partnerId === mossling.id) clearGame(partner);
      continue;
    }
    if (!pursue(mossling, partner, input)) continue;
    playing.add(mossling.id);
    playing.add(partner.id);
  }

  const free = mosslings.filter(
    (mossling) =>
      alive(mossling) &&
      !mossling.ritual &&
      !mossling.soccer &&
      !busy.has(mossling.id) &&
      !isPanicked(mossling.id) &&
      wantsSoccer(mossling.traits),
  );
  const at = new Map(
    free.map((mossling) => [mossling.id, cellPos(mossling.cellIndex, width)]),
  );
  const nearby = new Map<string, PreviewMossling[]>();
  for (const mossling of free) {
    const origin = at.get(mossling.id);
    if (origin) addToBucket(nearby, origin.x, origin.y, mossling);
  }
  const pairs: { a: PreviewMossling; b: PreviewMossling }[] = [];
  for (const a of free) {
    const originA = at.get(a.id);
    if (!originA) continue;
    eachInReach(nearby, originA.x, originA.y, SOCCER_INVITE, (b) => {
      if (b.id <= a.id) return;
      const originB = at.get(b.id);
      if (!originB) return;
      const distance = chebyshev(originA, originB);
      if (distance >= 1 && distance <= SOCCER_INVITE) pairs.push({ a, b });
    });
  }
  pairs.sort((left, right) => left.a.id - right.a.id || left.b.id - right.b.id);
  const joined = new Set<number>();
  for (const pair of pairs) {
    if (joined.has(pair.a.id) || joined.has(pair.b.id)) continue;
    if (random() >= SOCCER_CHANCE) continue;
    const originA = at.get(pair.a.id);
    const originB = at.get(pair.b.id);
    if (!originA || !originB) continue;
    const distance = chebyshev(originA, originB);
    if (distance <= SOCCER_REACH)
      writeGame(pair.a, pair.b, width, "play", elapsed, random, season);
    else writeGame(pair.a, pair.b, width, "approach", 0, random, season);
    if (!pursue(pair.a, pair.b, input)) continue;
    joined.add(pair.a.id);
    joined.add(pair.b.id);
    playing.add(pair.a.id);
    playing.add(pair.b.id);
  }
  return playing;
}

/** Frame 0..5. The partner is half a cycle behind, so they kick when the ball arrives. */
export function kickFrame(
  elapsed: number,
  since: number,
  leading: boolean,
): number {
  const span = KICK_SECONDS / KICK_FRAME_COUNT;
  const offset = leading ? 0 : span * (KICK_FRAME_COUNT / 2);
  const shifted = elapsed - since + offset;
  const wrapped = ((shifted % KICK_SECONDS) + KICK_SECONDS) % KICK_SECONDS;
  return Math.min(KICK_FRAME_COUNT - 1, Math.floor(wrapped / span));
}

/** Point in the gap, just off this Mossling's center toward the other. */
export function footToward(
  self: { x: number; y: number },
  other: { x: number; y: number },
): { x: number; y: number } {
  const dx = other.x - self.x;
  const dy = other.y - self.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: self.x + 0.5 + (dx / len) * SOCCER_FOOT,
    y: self.y + 0.5 + (dy / len) * SOCCER_FOOT,
  };
}

/**
 * Tile-space ball. It sits on the leading foot at that player's kick frame
 * and on the partner's foot half a cycle later.
 */
export function ballAt(
  leader: { x: number; y: number },
  partner: { x: number; y: number },
  elapsed: number,
  since: number,
): { x: number; y: number } {
  const span = KICK_SECONDS / KICK_FRAME_COUNT;
  const travel = span * (KICK_FRAME_COUNT / 2);
  const firstKick = since + KICK_STRIKE * span;
  const along =
    (((elapsed - firstKick) % (travel * 2)) + travel * 2) % (travel * 2);
  const s = along <= travel ? along / travel : 1 - (along - travel) / travel;
  const start = footToward(leader, partner);
  const end = footToward(partner, leader);
  return {
    x: start.x + (end.x - start.x) * s,
    y: start.y + (end.y - start.y) * s,
  };
}

/** True while a linked pair is still close enough for the kick and the ball. */
export function playingSoccer(
  mossling: PreviewMossling,
  partner: PreviewMossling | undefined,
  width: number,
): boolean {
  const game = mossling.soccer;
  if (!game || !alive(mossling) || !alive(partner)) return false;
  const kind = game.kind ?? "soccer";
  if (kind !== "soccer" && kind !== "snowball") return false;
  if ((partner.soccer?.kind ?? "soccer") !== kind) return false;
  if (game.phase !== "play" || partner.soccer?.phase !== "play") return false;
  if (
    partner.soccer?.partnerId !== mossling.id ||
    game.partnerId !== partner.id
  )
    return false;
  const distance = chebyshev(
    cellPos(mossling.cellIndex, width),
    cellPos(partner.cellIndex, width),
  );
  return distance >= 1 && distance <= SOCCER_REACH;
}

export function ballSize(tileSize: number): number {
  if (tileSize < ROUND_ZOOM) return 1;
  if (tileSize < SPRITE_ZOOM) return 5;
  return 7;
}

function inCamera(
  x: number,
  y: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
) {
  return (
    x >= camera.x &&
    x < camera.x + camera.width &&
    y >= camera.y &&
    y < camera.y + camera.height
  );
}

/** One ball per pair the camera can see. Broken and distant games draw nothing. */
export function ballsInView(
  mosslings: readonly PreviewMossling[],
  mapWidth: number,
  camera: Pick<Camera, "x" | "y" | "width" | "height">,
  tileSize: number,
  elapsed: number,
): BallMark[] {
  const byId = new Map(mosslings.map((mossling) => [mossling.id, mossling]));
  const marks: BallMark[] = [];
  for (const mossling of mosslings) {
    const game = mossling.soccer;
    if (!game || mossling.id > game.partnerId) continue;
    const partner = byId.get(game.partnerId);
    if (!playingSoccer(mossling, partner, mapWidth) || !partner) continue;
    const leader = game.face === "right" ? mossling : partner;
    const other = leader.id === mossling.id ? partner : mossling;
    const since = leader.soccer?.since ?? game.since;
    const point = ballAt(
      cellPos(leader.cellIndex, mapWidth),
      cellPos(other.cellIndex, mapWidth),
      elapsed,
      since,
    );
    const visible =
      mosslingInView(mossling.cellIndex, mapWidth, camera) ||
      mosslingInView(partner.cellIndex, mapWidth, camera) ||
      inCamera(point.x, point.y, camera);
    if (!visible) continue;
    marks.push({
      x: point.x,
      y: point.y,
      size: ballSize(tileSize),
      snow: game.kind === "snowball",
    });
  }
  return marks;
}
