/**
 * Low-level procedural map generation for Mosslings.
 *
 * This module intentionally knows nothing about rendering. A "cell" is a logical
 * map cell; whether the UI draws it as 8x8 pixels, 16x16 pixels, etc. is handled
 * elsewhere.
 *
 * The generator uses:
 *   1. Layered deterministic value noise for elevation, moisture, and rockiness.
 *   2. Terrain classification into water / grass / dirt / rock.
 *   3. A small majority-neighbor smoothing pass.
 *   4. Optional meandering rivers carved after smoothing.
 *   5. Sand beaches along the finished shoreline.
 *
 * Supplying the same width, height, seed, and options returns the same map.
 */
export const TerrainKind = {
  Water: "water",
  Grass: "grass",
  Dirt: "dirt",
  Rock: "rock",
  Sand: "sand",
} as const;

export type TerrainKind = (typeof TerrainKind)[keyof typeof TerrainKind];

export type MapSeed = string | number;

export interface MapCell {
  /** Persistent changes made by god powers. */
  tree?: { health: number };
  damage?: "burned" | "cracked" | "crater";
  burning?: boolean;
  /**
   * Crop progress. Missing means ordinary ground.
   * 0 is a new planting; 1 is a ripe field that counts as food.
   */
  growth?: number;
  /**
   * Hidden until the carrot is fully ripe, then it looks dead and
   * spreads to touching carrot tiles.
   */
  blight?: boolean;
  /** Progress toward natural recovery after a catastrophe (0..1). */
  recovery?: number;
  /** Final terrain classification used by the simulation. */
  terrain: TerrainKind;

  /** 0..1. Lower areas are more likely to become water. */
  elevation: number;

  /** 0..1. Lower values are drier. */
  moisture: number;

  /**
   * 0..1. Sunlight on this tile. Missing means dark.
   * Crops ripen only while this and moisture are both high enough.
   */
  light?: number;

  /** 0..1. Higher values are more likely to become exposed rock. */
  rockiness: number;

  /**
   * 0..1. Convenience value for future systems such as food growth.
   * This currently favors moist, non-rocky land.
   */
  fertility: number;
}

export interface MapData {
  width: number;
  height: number;

  /** Normalized 32-bit seed actually used by the generator. */
  seed: number;

  /**
   * Row-major cells.
   *
   * index = y * width + x
   */
  cells: MapCell[];
}

export interface RiverOptions {
  /** Number of rivers to carve. Set to 0 to disable rivers. */
  count?: number;

  /** Minimum river radius in cells. Default: 0 (one-cell-wide center line). */
  minRadius?: number;

  /** Maximum river radius in cells. Default: 1. */
  maxRadius?: number;

  /**
   * How strongly the river prefers locally lower elevation.
   * 0 = mostly random meandering; larger values = stronger downhill bias.
   */
  downhillBias?: number;
}

export interface GenerateMapOptions {
  /**
   * Same seed + dimensions + options => same map.
   * If omitted, a random seed is created.
   */
  seed?: MapSeed;

  /** Elevation below this value becomes water. Default: 0.30. */
  waterLevel?: number;

  /**
   * Moisture below this value becomes dirt, unless it is water or rock.
   * Default: 0.36.
   */
  dirtMoistureThreshold?: number;

  /**
   * Rockiness above this value becomes rock, unless it is water.
   * Default: 0.76.
   */
  rockThreshold?: number;

  /** Majority-neighbor cleanup passes. Default: 2. */
  smoothingPasses?: number;

  /**
   * Base scale of large terrain features, measured per logical cell.
   * Smaller values create larger regions. Default: 0.045.
   */
  elevationScale?: number;

  /** Default: 0.060. */
  moistureScale?: number;

  /** Default: 0.085. */
  rockScale?: number;

  /**
   * River configuration.
   * Pass false to disable river carving.
   */
  rivers?: RiverOptions | false;
}

const DEFAULTS = {
  waterLevel: 0.3,
  dirtMoistureThreshold: 0.36,
  rockThreshold: 0.76,
  smoothingPasses: 2,
  elevationScale: 0.045,
  moistureScale: 0.06,
  rockScale: 0.085,
} as const;

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

/**
 * Generate a complete procedural map.
 */
export function generateMap(
  width: number,
  height: number,
  options: GenerateMapOptions = {},
): MapData {
  assertDimensions(width, height);

  const seed = normalizeSeed(options.seed ?? randomSeed());

  const waterLevel = clamp01(options.waterLevel ?? DEFAULTS.waterLevel);
  const dirtMoistureThreshold = clamp01(
    options.dirtMoistureThreshold ?? DEFAULTS.dirtMoistureThreshold,
  );
  const rockThreshold = clamp01(
    options.rockThreshold ?? DEFAULTS.rockThreshold,
  );
  const smoothingPasses = Math.max(
    0,
    Math.floor(options.smoothingPasses ?? DEFAULTS.smoothingPasses),
  );

  const elevationScale = positiveNumber(
    options.elevationScale ?? DEFAULTS.elevationScale,
    "elevationScale",
  );
  const moistureScale = positiveNumber(
    options.moistureScale ?? DEFAULTS.moistureScale,
    "moistureScale",
  );
  const rockScale = positiveNumber(
    options.rockScale ?? DEFAULTS.rockScale,
    "rockScale",
  );

  // Separate deterministic noise channels derived from the world seed.
  const elevationSeed = mix32(seed ^ 0x9e3779b9);
  const moistureSeed = mix32(seed ^ 0x85ebca6b);
  const rockSeed = mix32(seed ^ 0xc2b2ae35);

  let cells = new Array<MapCell>(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Small coordinate offsets keep noise channels from lining up visually.
      const elevation = fbm(
        x * elevationScale,
        y * elevationScale,
        elevationSeed,
        5,
        2.0,
        0.5,
      );

      const moisture = fbm(
        (x + 1000) * moistureScale,
        (y - 1000) * moistureScale,
        moistureSeed,
        4,
        2.05,
        0.52,
      );

      const rockiness = fbm(
        (x - 2000) * rockScale,
        (y + 2000) * rockScale,
        rockSeed,
        4,
        2.15,
        0.48,
      );

      const terrain = classifyTerrain(
        elevation,
        moisture,
        rockiness,
        waterLevel,
        dirtMoistureThreshold,
        rockThreshold,
      );

      const fertility = calculateFertility(
        terrain,
        moisture,
        rockiness,
        elevation,
        waterLevel,
      );

      cells[indexOf(x, y, width)] = {
        terrain,
        elevation,
        moisture,
        rockiness,
        fertility,
      };
    }
  }

  for (let pass = 0; pass < smoothingPasses; pass++) {
    cells = smoothTerrain(cells, width, height);
  }

  if (options.rivers !== false) {
    const riverOptions = options.rivers ?? {};
    cells = carveRivers(cells, width, height, seed, waterLevel, riverOptions);
  }

  cells = layBeaches(cells, width, height, seed);

  return {
    width,
    height,
    seed,
    cells,
  };
}

/**
 * Return a map cell, or undefined when coordinates are outside the map.
 */
export function getMapCell(
  map: MapData,
  x: number,
  y: number,
): MapCell | undefined {
  if (!isInBounds(map, x, y)) {
    return undefined;
  }

  return map.cells[indexOf(x, y, map.width)];
}

/**
 * Convert x/y coordinates into the row-major cell index used by MapData.cells.
 */
export function getMapIndex(
  map: Pick<MapData, "width" | "height">,
  x: number,
  y: number,
): number {
  if (!isInBounds(map, x, y)) {
    return -1;
  }

  return indexOf(x, y, map.width);
}

/**
 * Return true when x/y refer to a valid map cell.
 */
export function isInBounds(
  map: Pick<MapData, "width" | "height">,
  x: number,
  y: number,
): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height
  );
}

/**
 * Return orthogonal neighbors (N/E/S/W) for simulation systems such as
 * pathfinding, spreading fire, flooding, or Mossling movement.
 */
export function getCardinalNeighbors(
  map: MapData,
  x: number,
  y: number,
): Array<{ x: number; y: number; cell: MapCell }> {
  const offsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;

  const neighbors: Array<{ x: number; y: number; cell: MapCell }> = [];

  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    const cell = getMapCell(map, nx, ny);

    if (cell) {
      neighbors.push({ x: nx, y: ny, cell });
    }
  }

  return neighbors;
}

/**
 * Return all surrounding neighbors, including diagonals.
 */
export function getAllNeighbors(
  map: MapData,
  x: number,
  y: number,
): Array<{ x: number; y: number; cell: MapCell }> {
  const neighbors: Array<{ x: number; y: number; cell: MapCell }> = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;
      const cell = getMapCell(map, nx, ny);

      if (cell) {
        neighbors.push({ x: nx, y: ny, cell });
      }
    }
  }

  return neighbors;
}

/**
 * Generate a random 32-bit seed.
 *
 * For reproducible worlds, callers should store MapData.seed and pass it back
 * to generateMap() later.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * UINT32_MAX_PLUS_ONE) >>> 0;
}

/* -------------------------------------------------------------------------- */
/* Internal generation                                                        */
/* -------------------------------------------------------------------------- */

function classifyTerrain(
  elevation: number,
  moisture: number,
  rockiness: number,
  waterLevel: number,
  dirtMoistureThreshold: number,
  rockThreshold: number,
): TerrainKind {
  if (elevation < waterLevel) {
    return TerrainKind.Water;
  }

  // Keep exposed rock away from the immediate shoreline a little.
  if (rockiness >= rockThreshold && elevation > waterLevel + 0.05) {
    return TerrainKind.Rock;
  }

  if (moisture < dirtMoistureThreshold) {
    return TerrainKind.Dirt;
  }

  return TerrainKind.Grass;
}

function calculateFertility(
  terrain: TerrainKind,
  moisture: number,
  rockiness: number,
  elevation: number,
  waterLevel: number,
): number {
  if (terrain === TerrainKind.Water || terrain === TerrainKind.Rock) {
    return 0;
  }

  // Favor moist ground near, but not under, the water line.
  const nearWaterBonus = 1 - clamp01(Math.abs(elevation - waterLevel) / 0.45);
  const value = moisture * 0.6 + (1 - rockiness) * 0.25 + nearWaterBonus * 0.15;

  // Dirt can still be fertile, but starts slightly behind grass.
  const terrainMultiplier = terrain === TerrainKind.Dirt ? 0.82 : 1;

  return clamp01(value * terrainMultiplier);
}

/**
 * Remove isolated one-cell noise by replacing a cell when at least six of its
 * eight neighbors agree on a different terrain type.
 */
function smoothTerrain(
  cells: MapCell[],
  width: number,
  height: number,
): MapCell[] {
  const next = cells.slice();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const counts = new Map<TerrainKind, number>();

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          const neighbor = cells[indexOf(nx, ny, width)];
          counts.set(neighbor.terrain, (counts.get(neighbor.terrain) ?? 0) + 1);
        }
      }

      let majorityTerrain = cells[indexOf(x, y, width)].terrain;
      let majorityCount = 0;

      for (const [terrain, count] of counts) {
        if (count > majorityCount) {
          majorityTerrain = terrain;
          majorityCount = count;
        }
      }

      if (
        majorityCount >= 6 &&
        majorityTerrain !== cells[indexOf(x, y, width)].terrain
      ) {
        const current = cells[indexOf(x, y, width)];

        next[indexOf(x, y, width)] = {
          ...current,
          terrain: majorityTerrain,
          fertility:
            majorityTerrain === TerrainKind.Water ||
            majorityTerrain === TerrainKind.Rock
              ? 0
              : current.fertility,
        };
      }
    }
  }

  return next;
}

function carveRivers(
  cells: MapCell[],
  width: number,
  height: number,
  seed: number,
  waterLevel: number,
  options: RiverOptions,
): MapCell[] {
  // Tiny maps do not have enough room for a useful river.
  if (width < 8 || height < 8) {
    return cells;
  }

  const count = Math.max(0, Math.floor(options.count ?? 1));
  const minRadius = Math.max(0, Math.floor(options.minRadius ?? 0));
  const maxRadius = Math.max(minRadius, Math.floor(options.maxRadius ?? 1));
  const downhillBias = Math.max(0, options.downhillBias ?? 2.5);

  if (count === 0) {
    return cells;
  }

  const next = cells.slice();
  const rng = mulberry32(mix32(seed ^ 0x27d4eb2d));

  for (let river = 0; river < count; river++) {
    // Start away from the extreme edges when possible.
    let x = randomInt(
      rng,
      Math.floor(width * 0.15),
      Math.ceil(width * 0.85) - 1,
    );

    for (let y = 0; y < height; y++) {
      const radius = randomInt(rng, minRadius, maxRadius);
      paintWater(next, width, height, x, y, radius, waterLevel);

      if (y === height - 1) {
        break;
      }

      // River always progresses one row downward, but may move left/right.
      // Lower-elevation candidates receive a larger selection weight.
      const candidates = [-1, 0, 1]
        .map((dx) => ({
          x: clampInt(x + dx, 0, width - 1),
          dx,
        }))
        .filter(
          (candidate, index, array) =>
            array.findIndex((other) => other.x === candidate.x) === index,
        );

      let bestX = x;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        const cell = next[indexOf(candidate.x, y + 1, width)];

        // Meander noise prevents the river from merely tracing the elevation map.
        const meander = rng() * 0.35;
        const centerBias = candidate.dx === 0 ? -0.03 : 0;
        const score = cell.elevation * downhillBias + meander + centerBias;

        if (score < bestScore) {
          bestScore = score;
          bestX = candidate.x;
        }
      }

      x = bestX;
    }
  }

  return next;
}

function paintWater(
  cells: MapCell[],
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  waterLevel: number,
): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 0.25) {
        continue;
      }

      const x = centerX + dx;
      const y = centerY + dy;

      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }

      const index = indexOf(x, y, width);
      const current = cells[index];

      cells[index] = {
        ...current,
        terrain: TerrainKind.Water,
        elevation: Math.min(current.elevation, Math.max(0, waterLevel - 0.01)),
        moisture: 1,
        fertility: 0,
      };
    }
  }
}

/**
 * Beaches sit on finished shores, after smoothing and rivers.
 * A run is 3–25 shore tiles, one or two cells deep, skewed toward the short end.
 */
const BEACH_MIN = 3;
const BEACH_MAX = 25;
const SAND_FERTILITY = 0.12;
const SHORE_STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

function layBeaches(
  cells: MapCell[],
  width: number,
  height: number,
  seed: number,
): MapCell[] {
  const next = cells.slice();
  const rng = mulberry32(mix32(seed ^ 0x5a4d0e17));
  const shore = shoreCells(next, width, height);
  const sand = new Set<number>();

  for (const walk of shoreWalks(shore, width, height)) {
    const order =
      walk.cyclic && walk.order.length > BEACH_MAX
        ? walk.order.slice(0, -1)
        : walk.order;
    paintShoreRuns(order, rng, sand);
  }

  limitBeachRuns(sand, width, height);

  for (const run of shoreComponents(sand, width, height)) {
    const depth = rng() < 0.5 ? 1 : 2;
    for (const index of run) paintSand(next, index);
    if (depth === 1) continue;
    for (const index of run) {
      const inland = inlandFromShore(next, index, width, height, shore);
      if (inland !== null) paintSand(next, inland);
    }
  }

  return next;
}

function paintSand(cells: MapCell[], index: number) {
  const current = cells[index];
  if (!current || current.terrain === TerrainKind.Water) return;
  cells[index] = {
    ...current,
    terrain: TerrainKind.Sand,
    fertility: SAND_FERTILITY,
  };
}

function shoreCells(
  cells: MapCell[],
  width: number,
  height: number,
): Set<number> {
  const shore = new Set<number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = indexOf(x, y, width);
      if (cells[index]?.terrain === TerrainKind.Water) continue;

      for (const [dx, dy] of SHORE_STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (cells[indexOf(nx, ny, width)]?.terrain !== TerrainKind.Water) {
          continue;
        }
        shore.add(index);
        break;
      }
    }
  }

  return shore;
}

function shoreWalks(
  shore: Set<number>,
  width: number,
  height: number,
): Array<{ order: number[]; cyclic: boolean }> {
  const remaining = new Set(shore);
  const walks: Array<{ order: number[]; cyclic: boolean }> = [];

  while (remaining.size > 0) {
    const start = shoreEndpoint(remaining, width, height);
    const forward = [start];
    remaining.delete(start);
    extendShore(forward, remaining, width, height);
    const backward = [start];
    extendShore(backward, remaining, width, height);
    const order = [...backward.slice(1).reverse(), ...forward];
    const last = order[order.length - 1] ?? start;
    walks.push({
      order,
      cyclic: order.length > 2 && cardinalTouch(order[0] ?? start, last, width),
    });
  }

  return walks;
}

function shoreEndpoint(
  remaining: Set<number>,
  width: number,
  height: number,
): number {
  let best = -1;
  let bestDegree = 5;

  for (const index of remaining) {
    const degree = linkedShore(index, remaining, width, height).length;
    if (degree < bestDegree) {
      best = index;
      bestDegree = degree;
      if (degree <= 1) break;
    }
  }

  return best;
}

function extendShore(
  walk: number[],
  remaining: Set<number>,
  width: number,
  height: number,
) {
  for (let guard = remaining.size; guard > 0; guard--) {
    const current = walk[walk.length - 1];
    if (current === undefined) return;
    const previous = walk.length > 1 ? walk[walk.length - 2] : -1;
    const options = linkedShore(current, remaining, width, height);
    if (options.length === 0) return;

    let next = options[0];
    if (previous !== undefined && previous >= 0 && options.length > 1) {
      const straight = options.find((candidate) =>
        continuesStraight(previous, current, candidate, width),
      );
      if (straight !== undefined) next = straight;
    }
    if (next === undefined) return;
    walk.push(next);
    remaining.delete(next);
  }
}

function continuesStraight(
  previous: number,
  current: number,
  next: number,
  width: number,
): boolean {
  const px = previous % width;
  const py = Math.floor(previous / width);
  const cx = current % width;
  const cy = Math.floor(current / width);
  const nx = next % width;
  const ny = Math.floor(next / width);
  return nx - cx === cx - px && ny - cy === cy - py;
}

function cardinalTouch(a: number, b: number, width: number): boolean {
  const ax = a % width;
  const ay = Math.floor(a / width);
  const bx = b % width;
  const by = Math.floor(b / width);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

function linkedShore(
  index: number,
  cells: Set<number>,
  width: number,
  height: number,
): number[] {
  const x = index % width;
  const y = Math.floor(index / width);
  const linked: number[] = [];

  for (const [dx, dy] of SHORE_STEPS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const neighbor = indexOf(nx, ny, width);
    if (cells.has(neighbor)) linked.push(neighbor);
  }

  return linked;
}

/** Short runs are common; a few stretches reach the mid-twenties. */
function paintShoreRuns(order: number[], rng: () => number, sand: Set<number>) {
  const count = order.length;
  if (count < BEACH_MIN) return;

  let cursor = 0;
  while (cursor < count) {
    const remaining = count - cursor;
    if (remaining < BEACH_MIN) return;

    let run = BEACH_MIN + Math.floor(rng() ** 2 * (BEACH_MAX - BEACH_MIN + 1));
    run = Math.min(run, remaining);
    if (remaining > run) run = Math.min(run, remaining - 1);
    if (run < BEACH_MIN) return;

    for (let offset = 0; offset < run; offset++) {
      const index = order[cursor + offset];
      if (index !== undefined) sand.add(index);
    }

    cursor += run;
    cursor += 1 + Math.floor(rng() * 4);
  }
}

function limitBeachRuns(sand: Set<number>, width: number, height: number) {
  for (let guard = sand.size; guard > 0; guard--) {
    let changed = false;

    for (const component of shoreComponents(sand, width, height)) {
      if (component.length < BEACH_MIN) {
        for (const index of component) sand.delete(index);
        changed = true;
      } else if (component.length > BEACH_MAX) {
        sand.delete(beachCut(component, width, height));
        changed = true;
      }
    }

    if (!changed) return;
  }
}

function shoreComponents(
  cells: Set<number>,
  width: number,
  height: number,
): number[][] {
  const seen = new Set<number>();
  const components: number[][] = [];

  for (const start of cells) {
    if (seen.has(start)) continue;
    const component: number[] = [];
    const queue = [start];
    seen.add(start);

    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) break;
      component.push(current);
      for (const neighbor of linkedShore(current, cells, width, height)) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function beachCut(component: number[], width: number, height: number): number {
  const cells = new Set(component);
  let start = component[0] ?? 0;
  let lowest = 5;

  for (const index of component) {
    const degree = linkedShore(index, cells, width, height).length;
    if (degree < lowest) {
      lowest = degree;
      start = index;
    }
  }

  const distance = new Map<number, number>();
  const parent = new Map<number, number>();
  const queue = [start];
  distance.set(start, 0);
  let far = start;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === undefined) break;
    if ((distance.get(current) ?? 0) > (distance.get(far) ?? 0)) far = current;
    for (const neighbor of linkedShore(current, cells, width, height)) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, (distance.get(current) ?? 0) + 1);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }

  const path: number[] = [];
  for (
    let current: number | undefined = far;
    current !== undefined;
    current = parent.get(current)
  ) {
    path.push(current);
  }

  const length = path.length;
  let bestIndex = Math.min(BEACH_MAX, Math.max(0, length - 1));
  let bestScore = Number.POSITIVE_INFINITY;

  for (let cut = 1; cut < length - 1; cut++) {
    const left = cut;
    const right = length - 1 - cut;
    const oversized = (left > BEACH_MAX ? 1 : 0) + (right > BEACH_MAX ? 1 : 0);
    const tiny = (left < BEACH_MIN ? 1 : 0) + (right < BEACH_MIN ? 1 : 0);
    const score = oversized * 1000 + tiny * 100 + Math.max(left, right);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = cut;
    }
  }

  return path[bestIndex] ?? start;
}

function inlandFromShore(
  cells: MapCell[],
  index: number,
  width: number,
  height: number,
  shore: Set<number>,
): number | null {
  const x = index % width;
  const y = Math.floor(index / width);
  let towardX = 0;
  let towardY = 0;

  for (const [dx, dy] of SHORE_STEPS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (cells[indexOf(nx, ny, width)]?.terrain === TerrainKind.Water) {
      towardX += dx;
      towardY += dy;
    }
  }

  if (towardX === 0 && towardY === 0) return null;

  const stepX =
    Math.abs(towardX) >= Math.abs(towardY) && towardX !== 0
      ? -Math.sign(towardX)
      : 0;
  const stepY = stepX === 0 ? -Math.sign(towardY) : 0;
  const nx = x + stepX;
  const ny = y + stepY;
  if (nx < 0 || ny < 0 || nx >= width || ny >= height) return null;

  const inland = indexOf(nx, ny, width);
  const cell = cells[inland];
  if (!cell || cell.terrain === TerrainKind.Water || shore.has(inland)) {
    return null;
  }
  return inland;
}

/**
 * The opening spotlight turns a circle of the map to grass, which can
 * pull a beach off the water or snap a run shorter than three tiles.
 * Those cells become ordinary grass.
 */
export function pruneBeaches(map: MapData) {
  const distance = cardinalWaterDistance(map);

  for (let index = 0; index < map.cells.length; index++) {
    const cell = map.cells[index];
    if (!cell || cell.terrain !== TerrainKind.Sand) continue;
    const tiles = distance[index] ?? -1;
    if (tiles !== 1 && tiles !== 2) softenSand(cell);
  }

  const shoreSand = new Set<number>();
  map.cells.forEach((cell, index) => {
    if (cell.terrain === TerrainKind.Sand && distance[index] === 1) {
      shoreSand.add(index);
    }
  });

  for (const run of shoreComponents(shoreSand, map.width, map.height)) {
    if (run.length >= BEACH_MIN) continue;
    for (const index of run) {
      const cell = map.cells[index];
      if (cell) softenSand(cell);
      shoreSand.delete(index);
    }
  }

  for (let index = 0; index < map.cells.length; index++) {
    const cell = map.cells[index];
    if (!cell || cell.terrain !== TerrainKind.Sand || distance[index] !== 2) {
      continue;
    }
    if (linkedShore(index, shoreSand, map.width, map.height).length === 0) {
      softenSand(cell);
    }
  }
}

function softenSand(cell: MapCell) {
  cell.terrain = TerrainKind.Grass;
  if (cell.fertility < 0.45) cell.fertility = 0.45;
}

function cardinalWaterDistance(map: MapData): Int16Array {
  const { width, height, cells } = map;
  const distance = new Int16Array(cells.length);
  distance.fill(-1);
  const queue: number[] = [];

  cells.forEach((cell, index) => {
    if (cell.terrain !== TerrainKind.Water) return;
    distance[index] = 0;
    queue.push(index);
  });

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === undefined) break;
    const soFar = distance[current] ?? 0;
    if (soFar >= 2) continue;
    const x = current % width;
    const y = Math.floor(current / width);

    for (const [dx, dy] of SHORE_STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = indexOf(nx, ny, width);
      if (distance[next] !== -1) continue;
      distance[next] = soFar + 1;
      queue.push(next);
    }
  }

  return distance;
}

/* -------------------------------------------------------------------------- */
/* Deterministic noise                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Fractional Brownian motion built from deterministic 2D value noise.
 * Returns approximately 0..1.
 */
function fbm(
  x: number,
  y: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < octaves; octave++) {
    total +=
      valueNoise2D(
        x * frequency,
        y * frequency,
        mix32(seed + octave * 0x9e3779b9),
      ) * amplitude;

    amplitudeTotal += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return clamp01(total / amplitudeTotal);
}

/**
 * Smooth deterministic value noise.
 *
 * This is intentionally dependency-free; callers do not need a Simplex/Perlin
 * package merely to generate a Mosslings map.
 */
function valueNoise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);

  const a = latticeRandom(x0, y0, seed);
  const b = latticeRandom(x1, y0, seed);
  const c = latticeRandom(x0, y1, seed);
  const d = latticeRandom(x1, y1, seed);

  const top = lerp(a, b, tx);
  const bottom = lerp(c, d, tx);

  return lerp(top, bottom, ty);
}

function latticeRandom(x: number, y: number, seed: number): number {
  let h = seed >>> 0;
  h ^= Math.imul(x, 0x1f123bb5);
  h = mix32(h);
  h ^= Math.imul(y, 0x5f356495);
  h = mix32(h);

  return (h >>> 0) / 0xffff_ffff;
}

/* -------------------------------------------------------------------------- */
/* Seeded RNG and helpers                                                     */
/* -------------------------------------------------------------------------- */

function normalizeSeed(seed: MapSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new Error("Map seed must be a finite number or string.");
    }

    return mix32(Math.trunc(seed) >>> 0);
  }

  // FNV-1a style string hash, then mix it once more.
  let hash = 0x811c9dc5;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return mix32(hash >>> 0);
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  };
}

function randomInt(
  rng: () => number,
  minInclusive: number,
  maxInclusive: number,
): number {
  if (maxInclusive <= minInclusive) {
    return minInclusive;
  }

  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

function indexOf(x: number, y: number, width: number): number {
  return y * width + x;
}

function assertDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Map width and height must be positive integers.");
  }
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than zero.`);
  }

  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/*
Example:

const map = generateMap(128, 96, {
  seed: "MOSS-48291",
  rivers: {
    count: 1,
    minRadius: 0,
    maxRadius: 1,
  },
});

const cell = getMapCell(map, 10, 20);

console.log(map.seed);
console.log(cell?.terrain);
*/
