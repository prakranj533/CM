import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, coverage, densify, growthFor, startOfUtcDay, type SeriesPoint } from "./trends.js";

const asOf = new Date(Date.UTC(2026, 0, 29)); // a Thursday

/** `spec` maps "days before asOf" to a count. */
function series(spec: Record<number, number>): SeriesPoint[] {
  return Object.entries(spec).map(([daysAgo, created]) => ({
    day: addDays(asOf, -Number(daysAgo)),
    created,
  }));
}

test("compares equal windows and reports a rise", () => {
  // 40 postings in the last 14 days, 20 in the 14 before that.
  const points = [...Array(14)].flatMap((_, i) => series({ [i + 1]: 3, [i + 15]: 1 }));
  const result = growthFor(points, { windowDays: 14, asOf, minSample: 10 });
  assert.equal(result.recent, 42);
  assert.equal(result.previous, 14);
  assert.equal(result.direction, "rising");
  assert.ok(result.changePct && result.changePct > 100);
});

test("small samples never produce a trend claim", () => {
  // The exact failure mode to avoid: 1 -> 4 postings is not "+300% growth".
  const result = growthFor(series({ 3: 4, 20: 1 }), { windowDays: 14, asOf });
  assert.equal(result.insufficientData, true);
  assert.equal(result.direction, "unknown");
  assert.equal(result.changePct, null);
  assert.equal(result.recent, 4);
});

test("growth from a zero base is reported as new, not infinite", () => {
  const result = growthFor(series({ 2: 40 }), { windowDays: 14, asOf, minSample: 10 });
  assert.equal(result.direction, "new");
  assert.equal(result.changePct, null);
  assert.equal(result.previous, 0);
});

test("noise within the threshold counts as flat", () => {
  const result = growthFor(series({ 2: 51, 20: 50 }), { windowDays: 14, asOf, minSample: 10 });
  assert.equal(result.direction, "flat");
});

test("declines are detected", () => {
  const result = growthFor(series({ 2: 20, 20: 60 }), { windowDays: 14, asOf, minSample: 10 });
  assert.equal(result.direction, "falling");
  assert.ok(result.changePct && result.changePct < 0);
});

test("the incomplete current day is excluded from the recent window", () => {
  // Today would otherwise drag every trend down, since the day is still running.
  const today = growthFor(series({ 0: 999, 2: 30, 20: 30 }), { windowDays: 14, asOf, minSample: 10 });
  assert.equal(today.recent, 30);
  assert.equal(today.direction, "flat");
});

test("days outside both windows are ignored", () => {
  const result = growthFor(series({ 2: 30, 20: 30, 400: 5000 }), { windowDays: 14, asOf, minSample: 10 });
  assert.equal(result.recent, 30);
  assert.equal(result.previous, 30);
});

test("densify fills gaps so a chart has no holes", () => {
  const filled = densify(series({ 1: 5, 3: 2 }), addDays(asOf, -5), asOf);
  assert.equal(filled.length, 5);
  assert.equal(
    filled.reduce((total, point) => total + point.created, 0),
    7,
  );
  assert.ok(filled.some((point) => point.created === 0));
});

test("coverage reports how much history actually exists", () => {
  const empty = coverage([{ day: asOf, created: 0 }]);
  assert.equal(empty.daysWithData, 0);
  assert.equal(empty.firstDay, null);

  const real = coverage(series({ 1: 3, 2: 0, 10: 4 }));
  assert.equal(real.daysWithData, 2);
  assert.deepEqual(real.firstDay, startOfUtcDay(addDays(asOf, -10)));
});
