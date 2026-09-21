export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

export type Season = (typeof SEASONS)[number];

export interface GameDate {
  year: number;
  season: Season;
}

export const SEASON_SECONDS = 12;
export const MONTH_SECONDS = SEASON_SECONDS / 3;
export const YEAR_SECONDS = SEASON_SECONDS * SEASONS.length;
export const FAST_FORWARD_STEP = 1 / 8;
export const MAX_TIME_RATE = 3;
export const MAX_FAST_FORWARD_STEPS = Math.round(
  (MAX_TIME_RATE - 1) / FAST_FORWARD_STEP,
);

export function gameDateAt(elapsedSeconds: number): GameDate {
  const elapsed = Math.max(0, elapsedSeconds);
  const yearIndex = Math.floor(elapsed / YEAR_SECONDS);
  const secondWithinYear = elapsed - yearIndex * YEAR_SECONDS;
  const seasonIndex = Math.min(
    SEASONS.length - 1,
    Math.floor(secondWithinYear / SEASON_SECONDS),
  );
  return { year: yearIndex + 1, season: SEASONS[seasonIndex] };
}

export function nextSpringAt(elapsedSeconds: number): number {
  return (
    (Math.floor(Math.max(0, elapsedSeconds) / YEAR_SECONDS) + 1) * YEAR_SECONDS
  );
}

export function timeRateAt(step: number): number {
  return (
    1 + Math.max(0, Math.min(MAX_FAST_FORWARD_STEPS, step)) * FAST_FORWARD_STEP
  );
}

export function nextFastForwardStep(step: number): number {
  return step >= MAX_FAST_FORWARD_STEPS ? 0 : step + 1;
}
