import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/graph/overview", async () => {
    const [roles, jobCounts] = await Promise.all([
      prisma.role.findMany({ select: { id: true, category: true, catalogSource: true } }),
      prisma.jobPosting.groupBy({ by: ["roleId"], _count: { _all: true } }),
    ]);
    const openings = new Map<string, number>();
    for (const row of jobCounts) if (row.roleId) openings.set(row.roleId, row._count._all);
    const families = new Map<string, { careers: number; openings: number }>();
    for (const role of roles) {
      const name = role.catalogSource === "esco" ? role.category ?? "Other occupations" : "Curated pathways";
      const family = families.get(name) ?? { careers: 0, openings: 0 };
      family.careers += 1;
      family.openings += openings.get(role.id) ?? 0;
      families.set(name, family);
    }
    return {
      nodes: [...families.entries()].map(([name, totals]) => ({
        id: `family:${name}`,
        slug: `family:${name}`,
        name,
        category: name,
        centrality: totals.careers,
        inDegree: 0,
        outDegree: totals.careers,
        openings: totals.openings,
        summaryCount: totals.careers,
      })),
      edges: [],
    };
  });

  app.get("/api/graph", async (request) => {
    const family = (request.query as { family?: string }).family?.trim();
    const where = family
      ? family === "Curated pathways"
        ? { catalogSource: null }
        : { catalogSource: "esco", category: family }
      : undefined;
    const roles = await prisma.role.findMany({
      where,
      select: { id: true, slug: true, name: true, category: true, centrality: true, inDegree: true, outDegree: true },
      orderBy: { name: "asc" },
    });
    const roleIds = roles.map((role) => role.id);
    const [edges, jobCounts] = await Promise.all([
      prisma.roleEdge.findMany({
        where: family ? { fromId: { in: roleIds }, toId: { in: roleIds } } : undefined,
        select: { fromId: true, toId: true, durationYears: true, skillsJson: true },
      }),
      prisma.jobPosting.groupBy({ by: ["roleId"], where: family ? { roleId: { in: roleIds } } : undefined, _count: { _all: true } }),
    ]);

    const openings = new Map<string, number>();
    for (const row of jobCounts) if (row.roleId) openings.set(row.roleId, row._count._all);

    return {
      nodes: roles.map((role) => ({
        id: role.id,
        slug: role.slug,
        name: role.name,
        category: role.category,
        centrality: Math.round(role.centrality * 100) / 100,
        inDegree: role.inDegree,
        outDegree: role.outDegree,
        openings: openings.get(role.id) ?? 0,
      })),
      edges: edges.map((edge) => ({
        from: edge.fromId,
        to: edge.toId,
        durationYears: edge.durationYears,
        skills: parseSkills(edge.skillsJson),
      })),
    };
  });

  /** Roles ranked by betweenness centrality — the "hub" qualifications. */
  app.get("/api/graph/hubs", async (request) => {
    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 15) || 15, 100);
    const roles = await prisma.role.findMany({
      select: { slug: true, name: true, centrality: true, inDegree: true, outDegree: true },
      orderBy: { centrality: "desc" },
      take: limit,
    });
    return { hubs: roles.map((role) => ({ ...role, centrality: Math.round(role.centrality * 100) / 100 })) };
  });
}

export function parseSkills(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}
