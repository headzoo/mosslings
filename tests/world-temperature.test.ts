import assert from "node:assert/strict";
import test from "node:test";
import { MONTH_SECONDS, SEASON_SECONDS } from "../lib/game-time";
import {
  celsiusFromFahrenheit,
  defaultTempUnitFromLocale,
  formatTemperatureValue,
  TEMP_MAX_F,
  TEMP_MIN_F,
  temperatureAtF,
} from "../lib/world-temperature";

test("summer midpoint stays well below the maximum", () => {
  const summerMid = SEASON_SECONDS / 2;
  assert.ok(temperatureAtF(summerMid, 91) < TEMP_MAX_F - 5);
});

test("winter midpoint stays well above the minimum", () => {
  const winterMid = SEASON_SECONDS * 2 + SEASON_SECONDS / 2;
  assert.ok(temperatureAtF(winterMid, 91) > TEMP_MIN_F + 5);
});

test("temperature is stable for the same elapsed time and seed", () => {
  assert.equal(temperatureAtF(17.5, 42), temperatureAtF(17.5, 42));
});

test("temperature varies across months", () => {
  const first = temperatureAtF(0, 91);
  const second = temperatureAtF(MONTH_SECONDS, 91);
  assert.notEqual(first, second);
});

test("temperature stays within the hard bounds", () => {
  for (let elapsed = 0; elapsed <= SEASON_SECONDS * 4; elapsed += 0.5) {
    const value = temperatureAtF(elapsed, 91);
    assert.ok(value >= TEMP_MIN_F);
    assert.ok(value <= TEMP_MAX_F);
  }
});

test("defaultTempUnitFromLocale prefers Fahrenheit in US locales", () => {
  assert.equal(defaultTempUnitFromLocale("en-US"), "F");
  assert.equal(defaultTempUnitFromLocale("en-GB"), "C");
  assert.equal(defaultTempUnitFromLocale("de-DE"), "C");
});

test("formatTemperatureValue shows one unit at a time", () => {
  assert.equal(formatTemperatureValue(68, "F"), "68°F");
  assert.equal(formatTemperatureValue(68, "C"), "20°C");
  assert.equal(celsiusFromFahrenheit(32), 0);
});

test("formatTemperatureValue formats edge temperatures without digit padding", () => {
  assert.equal(formatTemperatureValue(4, "F"), "4°F");
  assert.equal(formatTemperatureValue(4, "C"), "-16°C");
  assert.equal(formatTemperatureValue(-20, "F"), "-20°F");
  assert.equal(formatTemperatureValue(-20, "C"), "-29°C");
  assert.equal(formatTemperatureValue(100, "F"), "100°F");
  assert.equal(formatTemperatureValue(100, "C"), "38°C");
});
