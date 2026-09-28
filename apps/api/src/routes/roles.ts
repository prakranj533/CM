import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { allRoles, findJobs, roleBySlug } from "../store.js";

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

    const roles = (await allRoles())
      .filter((role) => !search || role.name.toLowerCase().includes(search.toLowerCase()))
      .sort(search ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.centrality - a.centrality)
      .slice(0, limit);

    return {
      roles: roles.map((role) => ({
        slug: role.slug,
        name: role.name,
        category: role.category,
        centrality: Math.round(role.centrality * 100) / 100,
        nextSteps: role.outDegree,
        openings: role.openingCount,
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
    const role = await roleBySlug(slug);
    if (!role) return reply.code(404).send({ error: "Role not found" });

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [allRoleDocs, roleJobs] = await Promise.all([allRoles(), findJobs({ roleId: role.id })]);
    const rolesById = new Map(allRoleDocs.map((entry) => [entry.id, entry]));
    const marketJobs = roleJobs.filter((job) => job.lastSeenAt >= since);
    const recentJobs = [...roleJobs]
      .sort((a, b) => (b.postedAt?.getTime() ?? b.firstSeenAt.getTime()) - (a.postedAt?.getTime() ?? a.firstSeenAt.getTime()))
      .slice(0, 12)
      .map(({ id, title, company, location, isRemote, url, salaryMin, salaryMax, salaryCurrency, salaryPeriod, seniority, postedAt, firstSeenAt, sourceKey }) => ({
        id,
        title,
        company,
        location,
        isRemote,
        url,
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryPeriod,
        seniority,
        postedAt,
        firstSeenAt,
        sourceKey,
      }));
    const salaryRows = marketJobs.filter((job) => job.salaryCurrency && (job.salaryMin !== null || job.salaryMax !== null));
    const salaryMins = salaryRows.flatMap((row) => {
      const value = annualInr(row.salaryMin, row.salaryCurrency, row.salaryPeriod);
      return value === null ? [] : [value];
    });
    const salaryMaxes = salaryRows.flatMap((row) => {
      const value = annualInr(row.salaryMax, row.salaryCurrency, row.salaryPeriod);
      return value === null ? [] : [value];
    });
    const seniority = new Map<string, number>();
    for (const job of marketJobs) {
      const level = job.seniority ?? "unknown";
      seniority.set(level, (seniority.get(level) ?? 0) + 1);
    }
    const curatedSkills = role.skills.filter((skill) => skill.origin === "graph");
    const marketSkills = role.skills
      .filter((skill) => skill.origin === "jobs")
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
        .flatMap((edge) => {
          const next = rolesById.get(edge.toId);
          return next ? [{ slug: next.slug, name: next.name, durationYears: edge.durationYears, skills: edge.skills }] : [];
        })
        .sort((a, b) => a.durationYears - b.durationYears),
      prerequisites: role.incoming.flatMap((edge) => {
        const previous = rolesById.get(edge.fromId);
        return previous ? [{ slug: previous.slug, name: previous.name, durationYears: edge.durationYears, skills: edge.skills }] : [];
      }),
      curatedSkills: curatedSkills.map((skill) => ({ name: skill.name, category: skill.category })),
      marketSkills: marketSkills.map((skill) => ({
        name: skill.name,
        category: skill.category,
        demand: Math.round(skill.demand * 100) / 100,
        mentions: skill.mentions,
      })),
      market: {
        postings: marketJobs.length,
        remoteShare: marketJobs.length ? Math.round((marketJobs.filter((job) => job.isRemote).length / marketJobs.length) * 100) / 100 : 0,
        avgSalaryMin: average(salaryMins),
        avgSalaryMax: average(salaryMaxes),
        seniority: [...seniority.entries()]
          .map(([level, count]) => ({ level, count }))
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
