import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  /**
   * The whole career graph in one payload. At a couple of hundred nodes this is a
   * few dozen KB, which is far cheaper than having the client stitch it together
   * from per-node requests, and it lets the force layout settle once.
   */
  app.get("/api/graph", async () => {
    const [roles, edges, jobCounts] = await Promise.all([
      prisma.role.findMany({
        select: { id: true, slug: true, name: true, category: true, centrality: true, inDegree: true, outDegree: true },
        orderBy: { name: "asc" },
      }),
      prisma.roleEdge.findMany({ select: { fromId: true, toId: true, durationYears: true, skillsJson: true } }),
      prisma.jobPosting.groupBy({ by: ["roleId"], _count: { _all: true } }),
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
