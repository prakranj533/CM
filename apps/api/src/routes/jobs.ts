import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

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

    const where: Prisma.JobPostingWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (role) where.role = { slug: role };
    if (skill) where.skills = { some: { skill: { name: skill } } };
    if (seniority) where.seniority = seniority;
    if (remote) where.isRemote = remote === "true";
    if (source) where.sourceKey = source;

    const [total, jobs] = await Promise.all([
      prisma.jobPosting.count({ where }),
      prisma.jobPosting.findMany({
        where,
        orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
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
          role: { select: { slug: true, name: true } },
          skills: {
            orderBy: { mentions: "desc" },
            take: 8,
            select: { skill: { select: { name: true, category: true } } },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      jobs: jobs.map((job) => ({
        ...job,
        skills: job.skills.map((link) => link.skill),
      })),
    };
  });

  /** Full text of a single posting, fetched on demand rather than in list payloads. */
  app.get("/api/jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await prisma.jobPosting.findUnique({
      where: { id },
      include: {
        role: { select: { slug: true, name: true } },
        source: { select: { key: true, name: true, homepage: true } },
        skills: { orderBy: { mentions: "desc" }, select: { mentions: true, skill: { select: { name: true, category: true } } } },
      },
    });
    if (!job) return reply.code(404).send({ error: "Job not found" });
    return { job };
  });

  /** Skills ranked by how many current postings mention them. */
  app.get("/api/skills/trending", async (request) => {
    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 25) || 25, 100);
    const grouped = await prisma.jobSkill.groupBy({
      by: ["skillId"],
      _count: { _all: true },
      orderBy: { _count: { skillId: "desc" } },
      take: limit,
    });

    const skills = await prisma.skill.findMany({
      where: { id: { in: grouped.map((row) => row.skillId) } },
      select: { id: true, name: true, category: true },
    });
    const byId = new Map(skills.map((skill) => [skill.id, skill]));

    return {
      skills: grouped
        .map((row) => {
          const skill = byId.get(row.skillId);
          return skill ? { name: skill.name, category: skill.category, postings: row._count._all } : null;
        })
        .filter((entry): entry is { name: string; category: string; postings: number } => entry !== null),
    };
  });
}
