import { coverage, densify, addDays, startOfUtcDay } from "@career-maps/core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getSeries,
  liveHistoryDays,
  publicationAgeProfile,
  topMovers,
  type Dimension,
} from "../ingest/snapshots.js";

const moversQuery = z.object({
  dimension: z.enum(["total", "skill", "role", "source"]).default("skill"),
  windowDays: z.coerce.number().min(7).max(90).default(28),
  limit: z.coerce.number().min(1).max(100).default(20),
  minSample: z.coerce.number().min(1).max(1000).optional(),
});

const seriesQuery = z.object({
  dimension: z.enum(["total", "skill", "role", "source"]).default("total"),
  key: z.string().default("all"),
  days: z.coerce.number().min(7).max(365).default(90),
  includeBackfill: z.enum(["true", "false"]).default("false"),
});

export async function trendRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Fastest-growing and fastest-declining keys.
   *
   * Returns ready:false with an empty list until enough live history exists —
   * never a trend inferred from backfilled data, which is survivorship-biased.
   */
  app.get("/api/trends", async (request, reply) => {
    const parsed = moversQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    const { dimension, windowDays, limit, minSample } = parsed.data;

    const result = await topMovers(dimension as Dimension, {
      windowDays,
      limit,
      ...(minSample === undefined ? {} : { minSample }),
    });

    return {
      dimension,
      windowDays,
      ...result,
      explanation: result.ready
        ? `Comparing the last ${windowDays} days against the ${windowDays} before, using daily measurements.`
        : `Trends need ${result.daysNeeded} days of daily measurement; ${result.liveDays} recorded so far. Backfilled history is deliberately excluded because expired postings are invisible, which would make every series look like growth.`,
    };
  });

  /** Daily series for one key, for charting. */
  app.get("/api/trends/series", async (request, reply) => {
    const parsed = seriesQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    const { dimension, key, days, includeBackfill } = parsed.data;

    const points = await getSeries(dimension as Dimension, key, {
      days,
      liveOnly: includeBackfill === "false",
    });
    const today = startOfUtcDay(new Date());
    const dense = densify(points, addDays(today, -days), today);
    const observed = coverage(points);

    return {
      dimension,
      key,
      includesBackfill: includeBackfill === "true",
      points: dense.map((point) => ({ day: point.day.toISOString().slice(0, 10), created: point.created })),
      coverage: {
        daysWithData: observed.daysWithData,
        firstDay: observed.firstDay?.toISOString().slice(0, 10) ?? null,
        lastDay: observed.lastDay?.toISOString().slice(0, 10) ?? null,
      },
    };
  });

  /**
   * Age profile of postings open right now. Explicitly labelled so it is not
   * mistaken for a demand trend.
   */
  app.get("/api/trends/freshness", async (request) => {
    const weeks = Math.min(Number((request.query as { weeks?: string }).weeks ?? 12) || 12, 52);
    const [profile, liveDays] = await Promise.all([publicationAgeProfile(weeks), liveHistoryDays()]);

    return {
      weeks: profile,
      liveCaptureDays: liveDays,
      caveat:
        "Publication dates of postings that are currently open. Older weeks are understated because expired postings are no longer visible, so this shows how fresh the board is — not how demand changed.",
    };
  });
}
