import {
  MONTH_SECONDS,
  SEASONS,
  type Season,
  YEAR_SECONDS,
  yearProgress,
} from "./game-time";
import type { MapSeed } from "./map";

export const TEMP_MIN_F = -20;
export const TEMP_MAX_F = 100;
const JITTER_F = 12;

const SEASON_MEAN_F: Record<Season, number> = {
  Winter: 32,
  Spring: 54,
  Summer: 82,
  Autumn: 58,
};

function nextSeason(season: Season): Season {
  const index = SEASONS.indexOf(season);
  return SEASONS[(index + 1) % SEASONS.length];
}

function normalizeSeed(seed: MapSeed): number {
  if (typeof seed === "number") return seed >>> 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function temperatureNoise(
  seed: number,
  yearIndex: number,
  monthIndex: number,
): number {
  let state =
    (seed ^
      Math.imul(yearIndex + 1, 0x9e3779b9) ^
      Math.imul(monthIndex + 1, 0x85ebca6b)) >>>
    0;
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return (state / 4294967296) * 2 - 1;
}

export function temperatureAtF(elapsedSeconds: number, seed: MapSeed): number {
  const elapsed = Math.max(0, elapsedSeconds);
  const yearIndex = Math.floor(elapsed / YEAR_SECONDS);
  const { season, into, within } = yearProgress(elapsedSeconds);
  const currentMean = SEASON_MEAN_F[season];
  const nextMean = SEASON_MEAN_F[nextSeason(season)];
  const base = currentMean + (nextMean - currentMean) * into;
  const monthIndex = Math.floor(within / MONTH_SECONDS);
  const jitter =
    temperatureNoise(normalizeSeed(seed), yearIndex, monthIndex) * JITTER_F;
  return Math.round(
    Math.max(TEMP_MIN_F, Math.min(TEMP_MAX_F, base + jitter)),
  );
}

export function celsiusFromFahrenheit(fahrenheit: number): number {
  return Math.round(((fahrenheit - 32) * 5) / 9);
}

export type TempUnit = "F" | "C";

const FAHRENHEIT_REGIONS = new Set([
  "US",
  "LR",
  "MM",
  "PW",
  "BS",
  "BZ",
  "KY",
  "FM",
  "MH",
  "PR",
  "VI",
  "GU",
  "AS",
]);

export function defaultTempUnitFromLocale(locale: string): TempUnit {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    if (region && FAHRENHEIT_REGIONS.has(region)) return "F";
  } catch {
    // Fall through to prefix matching.
  }
  if (/^en-(US|BS|BZ|KY|PW)/i.test(locale)) return "F";
  return "C";
}

export function formatTemperatureValue(
  fahrenheit: number,
  unit: TempUnit,
): string {
  if (unit === "F") return `${fahrenheit}°F`;
  return `${celsiusFromFahrenheit(fahrenheit)}°C`;
}
