import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { runIngest } from "../ingest/run.js";
import { SOURCES } from "../scraper/registry.js";
import { invalidatePathCache } from "./paths.js";

const body = z.object({ sources: z.array(z.string()).optional() });

/** Tracks the in-flight manual ingest so concurrent triggers can't pile up. */
let running: Promise<unknown> | null = null;

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /** Public health/status view: what ran, when, and whether it worked. */
  app.get("/api/status", async () => {
    const [sources, runs, jobCount, roleCount, matchedCount] = await Promise.all([
      prisma.source.findMany({ orderBy: { key: "asc" } }),
      prisma.ingestRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
      prisma.jobPosting.count(),
      prisma.role.count(),
      prisma.jobPosting.count({ where: { roleId: { not: null } } }),
    ]);

    return {
      registeredSources: SOURCES.map((source) => ({ key: source.key, name: source.name, kind: source.kind })),
      sources,
      runs,
      totals: {
        roles: roleCount,
        jobs: jobCount,
        jobsMatchedToRoles: matchedCount,
        schedule: env.INGEST_CRON || "disabled",
      },
    };
  });

  app.post("/api/admin/ingest", async (request, reply) => {
    if (!authorized(request, reply)) return;

    const parsed = body.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid body" });

    if (running) {
      return reply.code(409).send({ error: "An ingest is already running" });
    }

    const options = parsed.data.sources?.length ? { sourceKeys: parsed.data.sources } : {};
    const task = runIngest({ ...options, log: (message) => app.log.info(message) })
      .then((summary) => {
        invalidatePathCache();
        return summary;
      })
      .finally(() => {
        running = null;
      });
    running = task;

    // Scraping takes minutes; hand back a 202 rather than holding the socket open.
    reply.code(202).send({ started: true, sources: parsed.data.sources ?? SOURCES.map((s) => s.key) });
    await task.catch((error: unknown) => app.log.error({ err: error }, "manual ingest failed"));
    return reply;
  });
}

function authorized(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!env.ADMIN_TOKEN) {
    reply.code(503).send({ error: "Set ADMIN_TOKEN in the API environment to enable this endpoint" });
    return false;
  }

  const provided = request.headers["x-admin-token"];
  const supplied = Array.isArray(provided) ? provided[0] : provided;
  if (!supplied || !safeEqual(supplied, env.ADMIN_TOKEN)) {
    reply.code(401).send({ error: "Invalid admin token" });
    return false;
  }
  return true;
}

/** Constant-time compare so the token can't be recovered by timing the response. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
