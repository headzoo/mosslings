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
 *
 * Supplying the same width, height, seed, and options returns the same map.
 */
export const TerrainKind = {
  Water: "water",
  Grass: "grass",
  Dirt: "dirt",
  Rock: "rock",
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
  /** Progress toward natural recovery after a catastrophe (0..1). */
  recovery?: number;
  /** Final terrain classification used by the simulation. */
  terrain: TerrainKind;

  /** 0..1. Lower areas are more likely to become water. */
  elevation: number;

  /** 0..1. Lower values are drier. */
  moisture: number;

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
