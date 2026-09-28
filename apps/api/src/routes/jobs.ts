import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { allJobs, findJobs, jobById, sourceByKey } from "../store.js";

const query = z.object({
  search: z.string().trim().max(160).optional(),
  role: z.string().trim().optional(),
  skill: z.string().trim().optional(),
  seniority: z.enum(["intern", "entry", "mid", "senior", "lead", "executive"]).optional(),
  remote: z.enum(["true", "false"]).optional(),
  source: z.string().trim().optional(),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
});

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/jobs", async (request, reply) => {
    const parsed = query.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    const { search, role, skill, seniority, remote, source, page, perPage } = parsed.data;
    const filter = {
      ...(search ? { search } : {}),
      ...(role ? { roleSlug: role } : {}),
      ...(skill ? { skill } : {}),
      ...(seniority ? { seniority } : {}),
      ...(remote ? { remote: remote === "true" } : {}),
      ...(source ? { sourceKey: source } : {}),
    };
    const matches = await findJobs(filter);
    const total = matches.length;
    matches.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0) || b.firstSeenAt.getTime() - a.firstSeenAt.getTime());
    const jobs = matches.slice((page - 1) * perPage, page * perPage);

    return {
      total,
      page,
      perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        isRemote: job.isRemote,
        url: job.url,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        salaryPeriod: job.salaryPeriod,
        seniority: job.seniority,
        postedAt: job.postedAt,
        firstSeenAt: job.firstSeenAt,
        sourceKey: job.sourceKey,
        role: job.roleId && job.roleSlug ? { slug: job.roleSlug, name: job.roleName } : null,
        skills: [...job.skills].sort((a, b) => b.mentions - a.mentions).slice(0, 8).map(({ name, category }) => ({ name, category })),
      })),
    };
  });

  /** Full text of a single posting, fetched on demand rather than in list payloads. */
  app.get("/api/jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await jobById(id);
    if (!job) return reply.code(404).send({ error: "Job not found" });
    const source = await sourceByKey(job.sourceKey);
    return {
      job: {
        ...job,
        role: job.roleId && job.roleSlug ? { slug: job.roleSlug, name: job.roleName } : null,
        source: source ? { key: source.key, name: source.name, homepage: source.homepage } : null,
        skills: [...job.skills].sort((a, b) => b.mentions - a.mentions),
      },
    };
  });

  /** Skills ranked by how many current postings mention them. */
  app.get("/api/skills/trending", async (request) => {
    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 25) || 25, 100);
    const counts = new Map<string, { name: string; category: string; postings: number }>();
    for (const job of await allJobs()) {
      for (const skill of job.skills) {
        const current = counts.get(skill.name) ?? { name: skill.name, category: skill.category, postings: 0 };
        current.postings += 1;
        counts.set(skill.name, current);
      }
    }
    return { skills: [...counts.values()].sort((a, b) => b.postings - a.postings).slice(0, limit) };
  });
}
