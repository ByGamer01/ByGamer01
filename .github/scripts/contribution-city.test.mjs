import assert from "node:assert/strict";
import { test } from "node:test";
import { renderContributionCity } from "./contribution-city.mjs";

const rows = [["2026-10-31", 0], ["2026-11-01", 9], ["2026-11-02", 2]];

test("uses calendar weeks and draws exactly one building per active day", () => {
  const svg = renderContributionCity(rows, "dark");
  assert.match(svg, /11 contributions across 2 active days/);
  assert.match(svg, /Oct 31, 2026/);
  assert.match(svg, /Nov 2, 2026/);
  assert.doesNotMatch(svg, /data-day="2026-10-31"/);
  assert.equal((svg.match(/data-day=/g) ?? []).length, 2);
  assert.match(svg, /data-day="2026-11-01" data-count="9" data-week="1" data-weekday="0"/);
  assert.match(svg, /data-day="2026-11-02" data-count="2" data-week="1" data-weekday="1"/);
});

test("handles an inactive range and renders deterministic light and dark variants", () => {
  assert.match(renderContributionCity([rows[0]], "light"), /0 contributions across 0 active days/);
  assert.equal(renderContributionCity(rows, "dark"), renderContributionCity(rows, "dark"));
  assert.notEqual(renderContributionCity(rows, "light"), renderContributionCity(rows, "dark"));
});

test("keeps a full year, including its tallest towers, inside the plot", () => {
  const days = Array.from({ length: 365 }, (_, i) => [
    new Date(Date.UTC(2026, 0, i + 3)).toISOString().slice(0, 10), i % 37,
  ]);
  const svg = renderContributionCity(days, "dark");
  const tiles = Array.from(svg.matchAll(/points="([^"]+)"/g), (match) => match[1]);
  assert.ok(tiles.length >= days.length);
  for (const tile of tiles) {
    for (const pair of tile.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      assert.ok(x >= 205 && x <= 752 && y >= 40 && y < 285.5, "point outside city plot: " + pair);
    }
  }
});
