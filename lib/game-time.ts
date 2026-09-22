export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

export type Season = (typeof SEASONS)[number];

/** The season when a new world begins. */
export const STARTING_SEASON: Season = "Summer";
const STARTING_SEASON_INDEX = SEASONS.indexOf(STARTING_SEASON);

export interface GameDate {
  year: number;
  season: Season;
}

export const SEASON_SECONDS = 12;
const SPRING_RAW_INDEX =
  (SEASONS.indexOf("Spring") - STARTING_SEASON_INDEX + SEASONS.length) %
  SEASONS.length;
const SPRING_START_IN_YEAR = SPRING_RAW_INDEX * SEASON_SECONDS;
export const MONTH_SECONDS = SEASON_SECONDS / 3;
export const YEAR_SECONDS = SEASON_SECONDS * SEASONS.length;
export const FAST_FORWARD_STEP = 1 / 8;
export const MAX_TIME_RATE = 3;
export const MAX_FAST_FORWARD_STEPS = Math.round(
  (MAX_TIME_RATE - 1) / FAST_FORWARD_STEP,
);

function rawSeasonIndex(secondWithinYear: number): number {
  return Math.min(
    SEASONS.length - 1,
    Math.floor(secondWithinYear / SEASON_SECONDS),
  );
}

function seasonFromRaw(rawIndex: number): Season {
  return SEASONS[(rawIndex + STARTING_SEASON_INDEX) % SEASONS.length];
}

export function gameDateAt(elapsedSeconds: number): GameDate {
  const elapsed = Math.max(0, elapsedSeconds);
  const yearIndex = Math.floor(elapsed / YEAR_SECONDS);
  const secondWithinYear = elapsed - yearIndex * YEAR_SECONDS;
  return {
    year: yearIndex + 1,
    season: seasonFromRaw(rawSeasonIndex(secondWithinYear)),
  };
}

export function nextSpringAt(elapsedSeconds: number): number {
  const elapsed = Math.max(0, elapsedSeconds);
  const yearStart = Math.floor(elapsed / YEAR_SECONDS) * YEAR_SECONDS;
  const springThisYear = yearStart + SPRING_START_IN_YEAR;
  if (elapsed < springThisYear) return springThisYear;
  return yearStart + YEAR_SECONDS + SPRING_START_IN_YEAR;
}

export function timeRateAt(step: number): number {
  return (
    1 + Math.max(0, Math.min(MAX_FAST_FORWARD_STEPS, step)) * FAST_FORWARD_STEP
  );
}

export function nextFastForwardStep(step: number): number {
  return step >= MAX_FAST_FORWARD_STEPS ? 0 : step + 1;
}

/** How full the canopy and meadow are, how far the leaves have turned, and how much snow is down. */
export interface SeasonLook {
  /** 0 is bare ground and branches. 1 is a full green cover. */
  cover: number;
  /** 0 is summer green. 1 is amber and rust. */
  autumn: number;
  /** 0 is bare ground. Higher is a light snowfall. */
  snow: number;
  /** 0 is open water. 1 is a white-blue sheet of ice. */
  ice: number;
}

/** Repaint steps inside one season. Four keeps the map from redrawing every frame. */
export const FOLIAGE_STEPS = 4;

function yearProgress(elapsedSeconds: number) {
  const elapsed = Math.max(0, elapsedSeconds);
  const within = elapsed - Math.floor(elapsed / YEAR_SECONDS) * YEAR_SECONDS;
  const rawIndex = rawSeasonIndex(within);
  return {
    season: seasonFromRaw(rawIndex),
    into: (within - rawIndex * SEASON_SECONDS) / SEASON_SECONDS,
    within,
  };
}

/**
 * Foliage eases inside each season and meets at the boundaries.
 * Spring opens bare, with the last of the snow, and fills in.
 * Summer is full green. Autumn turns, then thins. Winter is bare with snow.
 */
export function foliageAt(elapsedSeconds: number): SeasonLook {
  const { season, into } = yearProgress(elapsedSeconds);
  switch (season) {
    case "Spring":
      return {
        cover: 0.08 + into * 0.92,
        autumn: 0,
        snow: into < 0.35 ? (1 - into / 0.35) * 0.5 : 0,
        ice: 1 - into,
      };
    case "Summer":
      return { cover: 1, autumn: 0, snow: 0, ice: 0 };
    case "Autumn":
      return {
        cover: into < 0.5 ? 1 : 1 - ((into - 0.5) / 0.5) * 0.92,
        autumn: into < 0.5 ? into / 0.5 : 1 - (into - 0.5) / 0.5,
        snow: 0,
        ice: into < 0.58 ? 0 : ((into - 0.58) / 0.42) * 0.42,
      };
    case "Winter":
      return {
        cover: 0.08,
        autumn: 0,
        snow:
          into < 0.15
            ? (into / 0.15) * 0.2
            : 0.2 + ((into - 0.15) / 0.85) * 0.3,
        ice: 0.42 + into * 0.58,
      };
  }
}

export function foliageStep(elapsedSeconds: number): number {
  const { within } = yearProgress(elapsedSeconds);
  const span = SEASON_SECONDS / FOLIAGE_STEPS;
  return Math.min(
    SEASONS.length * FOLIAGE_STEPS - 1,
    Math.floor(within / span),
  );
}
