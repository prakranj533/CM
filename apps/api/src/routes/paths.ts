import { PathFinder, type CareerGraph } from "@career-maps/core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseSkills } from "./graph.js";

const query = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  maxPaths: z.coerce.number().min(1).max(200).default(25),
  maxDepth: z.coerce.number().min(2).max(30).default(14),
});

/**
 * The graph is small and changes only on import, so we hold one PathFinder in
 * memory and rebuild it when the newest Role.updatedAt moves. This keeps path
 * queries off the database entirely.
 */
let cached: { finder: PathFinder; graph: CareerGraph; stamp: string } | null = null;

async function getFinder(): Promise<{ finder: PathFinder; graph: CareerGraph }> {
  const [latest, count] = await Promise.all([
    prisma.role.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.role.count(),
  ]);
  const stamp = `${latest?.updatedAt.toISOString() ?? "empty"}:${count}`;
  if (cached?.stamp === stamp) return cached;

  const [roles, edges] = await Promise.all([
    prisma.role.findMany({ select: { id: true, slug: true, name: true, category: true } }),
    prisma.roleEdge.findMany({ select: { fromId: true, toId: true, durationYears: true, skillsJson: true } }),
  ]);

  const graph: CareerGraph = {
    nodes: roles.map((role) => ({ id: role.id, slug: role.slug, name: role.name, category: role.category })),
    edges: edges.map((edge) => ({
      from: edge.fromId,
      to: edge.toId,
      durationYears: edge.durationYears,
      skills: parseSkills(edge.skillsJson),
    })),
  };

  cached = { finder: new PathFinder(graph), graph, stamp };
  return cached;
}

export function invalidatePathCache(): void {
  cached = null;
}

export async function pathRoutes(app: FastifyInstance): Promise<void> {
  /** Every route between two roles, plus the fastest one and the induced subgraph. */
  app.get("/api/paths", async (request, reply) => {
    const parsed = query.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    const { from, to, maxPaths, maxDepth } = parsed.data;

    const { finder, graph } = await getFinder();
    const source = graph.nodes.find((node) => node.slug === from || node.id === from);
    const target = graph.nodes.find((node) => node.slug === to || node.id === to);
    if (!source) return reply.code(404).send({ error: `Unknown starting role "${from}"` });
    if (!target) return reply.code(404).send({ error: `Unknown destination role "${to}"` });

    const paths = finder.findAllPaths(source.id, target.id, { maxPaths, maxDepth });
    const subgraph = finder.subgraphBetween(source.id, target.id, { maxPaths, maxDepth });

    return {
      from: { slug: source.slug, name: source.name },
      to: { slug: target.slug, name: target.name },
      count: paths.length,
      fastest: finder.fastestPath(source.id, target.id),
      paths,
      subgraph: {
        nodes: subgraph.nodes.map((node) => ({ id: node.id, slug: node.slug, name: node.name })),
        edges: subgraph.edges,
      },
    };
  });

  /** Destinations reachable from a role — used to constrain the destination picker. */
  app.get("/api/paths/reachable/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { finder, graph } = await getFinder();
    const source = graph.nodes.find((node) => node.slug === slug || node.id === slug);
    if (!source) return reply.code(404).send({ error: "Role not found" });

    return {
      roles: finder
        .reachableFrom(source.id)
        .map((node) => ({ slug: node.slug, name: node.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}
