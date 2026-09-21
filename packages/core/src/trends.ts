/**
 * Trend maths for demand history.
 *
 * Pure functions, no database, so the rules that decide when a trend may be
 * *claimed* are unit-testable. Those rules matter more than the arithmetic: with a
 * small corpus almost every series is noise, and "+300%" off a base of 2 postings
 * is worse than saying nothing.
 */

export interface SeriesPoint {
  /** UTC midnight of the day. */
  day: Date;
  /** Postings created that day. */
  created: number;
}

export type TrendDirection = "rising" | "falling" | "flat" | "new" | "unknown";

export interface GrowthResult {
  /** Total in the most recent window. */
  recent: number;
  /** Total in the window immediately before it. */
  previous: number;
  /** Percentage change, or null when it cannot be stated honestly. */
  changePct: number | null;
  direction: TrendDirection;
  /** True when the sample is too small to draw any conclusion from. */
  insufficientData: boolean;
}

export interface GrowthOptions {
  /** Length of each comparison window, in days. */
  windowDays?: number;
  /** End of the recent window (exclusive). Defaults to today, UTC. */
  asOf?: Date;
  /**
   * Minimum postings across both windows before a direction is reported.
   * Below this the result is returned with insufficientData set.
   */
  minSample?: number;
  /** Change smaller than this (fraction) counts as flat, not a trend. */
  flatThreshold?: number;
}

const DEFAULTS = {
  windowDays: 28,
  minSample: 30,
  flatThreshold: 0.1,
} as const;

/** UTC midnight for a date — the canonical key for a day bucket. */
export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDays(value: Date, days: number): Date {
  const copy = new Date(value.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Compare the last `windowDays` against the `windowDays` before them.
 *
 * Whole equal-length windows are used rather than, say, "this week vs last week"
 * of unequal length, and the default 28 days is a multiple of 7 so weekday
 * seasonality (few adverts are posted at weekends) cancels out instead of
 * masquerading as a trend.
 */
export function growthFor(points: SeriesPoint[], options: GrowthOptions = {}): GrowthResult {
  const windowDays = options.windowDays ?? DEFAULTS.windowDays;
  const minSample = options.minSample ?? DEFAULTS.minSample;
  const flatThreshold = options.flatThreshold ?? DEFAULTS.flatThreshold;
  const asOf = startOfUtcDay(options.asOf ?? new Date());

  const recentFrom = addDays(asOf, -windowDays);
  const previousFrom = addDays(asOf, -windowDays * 2);

  let recent = 0;
  let previous = 0;
  for (const point of points) {
    const day = startOfUtcDay(point.day).getTime();
    // Recent window is [asOf-window, asOf); the current day is incomplete and
    // would drag every trend downwards, so it is excluded.
    if (day >= recentFrom.getTime() && day < asOf.getTime()) recent += point.created;
    else if (day >= previousFrom.getTime() && day < recentFrom.getTime()) previous += point.created;
  }

  const total = recent + previous;
  if (total < minSample) {
    return { recent, previous, changePct: null, direction: "unknown", insufficientData: true };
  }

  if (previous === 0) {
    // A percentage against zero is undefined; report it as newly appearing.
    return { recent, previous, changePct: null, direction: "new", insufficientData: false };
  }

  const change = (recent - previous) / previous;
  const direction: TrendDirection =
    Math.abs(change) < flatThreshold ? "flat" : change > 0 ? "rising" : "falling";

  return {
    recent,
    previous,
    changePct: Math.round(change * 1000) / 10,
    direction,
    insufficientData: false,
  };
}

/** Fill missing days with zero so a series is continuous for charting. */
export function densify(points: SeriesPoint[], from: Date, to: Date): SeriesPoint[] {
  const byDay = new Map<number, number>();
  for (const point of points) {
    const key = startOfUtcDay(point.day).getTime();
    byDay.set(key, (byDay.get(key) ?? 0) + point.created);
  }

  const result: SeriesPoint[] = [];
  for (let day = startOfUtcDay(from); day < startOfUtcDay(to); day = addDays(day, 1)) {
    result.push({ day: new Date(day.getTime()), created: byDay.get(day.getTime()) ?? 0 });
  }
  return result;
}

/**
 * How much of the requested history actually contains data.
 *
 * Used to tell the user "8 weeks requested, 3 weeks observed" rather than
 * silently drawing a chart that implies more coverage than exists.
 */
export function coverage(points: SeriesPoint[]): { firstDay: Date | null; lastDay: Date | null; daysWithData: number } {
  const days = points.filter((point) => point.created > 0).map((point) => startOfUtcDay(point.day).getTime());
  if (days.length === 0) return { firstDay: null, lastDay: null, daysWithData: 0 };
  return {
    firstDay: new Date(Math.min(...days)),
    lastDay: new Date(Math.max(...days)),
    daysWithData: new Set(days).size,
  };
}
