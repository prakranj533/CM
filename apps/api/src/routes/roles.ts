import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseSkills } from "./graph.js";

const listQuery = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().min(1).max(5000).default(50),
});

export async function roleRoutes(app: FastifyInstance): Promise<void> {
  /** Typeahead / directory listing. */
  app.get("/api/roles", async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    const { search, limit } = parsed.data;

    const roles = await prisma.role.findMany({
      // SQLite's LIKE is already case-insensitive for ASCII, so no `mode` needed.
      where: search ? { name: { contains: search } } : undefined,
      select: {
        slug: true,
        name: true,
        category: true,
        centrality: true,
        outDegree: true,
        _count: { select: { jobs: true } },
      },
      orderBy: search ? { name: "asc" } : { centrality: "desc" },
      take: limit,
    });

    return {
      roles: roles.map((role) => ({
        slug: role.slug,
        name: role.name,
        category: role.category,
        centrality: Math.round(role.centrality * 100) / 100,
        nextSteps: role.outDegree,
        openings: role._count.jobs,
      })),
    };
  });

  /**
   * Everything the role page needs in one round trip: the curated graph context
   * (how you get here, where you can go), the live market view aggregated from
   * scraped postings, and a sample of current openings.
   */
  app.get("/api/roles/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const role = await prisma.role.findUnique({
      where: { slug },
      include: {
        outgoing: { include: { to: { select: { slug: true, name: true } } } },
        incoming: { include: { from: { select: { slug: true, name: true } } } },
        skills: { include: { skill: { select: { name: true, category: true } } } },
      },
    });
    if (!role) return reply.code(404).send({ error: "Role not found" });

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [recentJobs, stats, seniorityBreakdown, salaryRows] = await Promise.all([
      prisma.jobPosting.findMany({
        where: { roleId: role.id },
        orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
        take: 12,
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          isRemote: true,
          url: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
          seniority: true,
          postedAt: true,
          firstSeenAt: true,
          sourceKey: true,
        },
      }),
      prisma.jobPosting.aggregate({
        where: { roleId: role.id, lastSeenAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.jobPosting.groupBy({
        by: ["seniority"],
        where: { roleId: role.id, lastSeenAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.jobPosting.findMany({
        where: {
          roleId: role.id,
          lastSeenAt: { gte: since },
          salaryCurrency: { not: null },
          OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
        },
        select: { salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true },
      }),
    ]);

    const remoteCount = await prisma.jobPosting.count({
      where: { roleId: role.id, lastSeenAt: { gte: since }, isRemote: true },
    });

    const salaryMins = salaryRows.flatMap((row) => {
      const value = annualInr(row.salaryMin, row.salaryCurrency, row.salaryPeriod);
      return value === null ? [] : [value];
    });
    const salaryMaxes = salaryRows.flatMap((row) => {
      const value = annualInr(row.salaryMax, row.salaryCurrency, row.salaryPeriod);
      return value === null ? [] : [value];
    });

    const curatedSkills = role.skills.filter((link) => link.origin === "graph");
    const marketSkills = role.skills
      .filter((link) => link.origin === "jobs")
      .sort((a, b) => b.demand - a.demand)
      .slice(0, 25);

    return {
      role: {
        slug: role.slug,
        name: role.name,
        category: role.category,
        description: role.description,
        centrality: Math.round(role.centrality * 100) / 100,
      },
      nextSteps: role.outgoing
        .map((edge) => ({
          slug: edge.to.slug,
          name: edge.to.name,
          durationYears: edge.durationYears,
          skills: parseSkills(edge.skillsJson),
        }))
        .sort((a, b) => a.durationYears - b.durationYears),
      prerequisites: role.incoming.map((edge) => ({
        slug: edge.from.slug,
        name: edge.from.name,
        durationYears: edge.durationYears,
        skills: parseSkills(edge.skillsJson),
      })),
      curatedSkills: curatedSkills.map((link) => ({ name: link.skill.name, category: link.skill.category })),
      marketSkills: marketSkills.map((link) => ({
        name: link.skill.name,
        category: link.skill.category,
        /** Share of recent postings mentioning this skill, 0..1. */
        demand: Math.round(link.demand * 100) / 100,
        mentions: link.mentions,
      })),
      market: {
        postings: stats._count._all,
        remoteShare: stats._count._all ? Math.round((remoteCount / stats._count._all) * 100) / 100 : 0,
        avgSalaryMin: average(salaryMins),
        avgSalaryMax: average(salaryMaxes),
        seniority: seniorityBreakdown
          .map((row) => ({ level: row.seniority ?? "unknown", count: row._count._all }))
          .sort((a, b) => b.count - a.count),
      },
      recentJobs,
    };
  });
}

const INR_RATES: Record<string, number> = { INR: 1, USD: 84, EUR: 91, GBP: 108, CAD: 62, AUD: 55 };
const PERIODS_PER_YEAR: Record<string, number> = { year: 1, month: 12, day: 260, hour: 2080 };

function annualInr(amount: number | null, currency: string | null, period: string | null): number | null {
  if (!amount || !currency) return null;
  const rate = INR_RATES[currency.toUpperCase()];
  if (!rate) return null;
  return amount * rate * (period ? PERIODS_PER_YEAR[period] ?? 1 : 1);
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}
