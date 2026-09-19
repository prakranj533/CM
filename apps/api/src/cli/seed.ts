import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { betweennessCentrality, degrees, findCycles, legacyNodeMapToGraph, type LegacyNodeMap } from "@career-maps/core";
import { prisma } from "../db.js";
import { syncRoleAliases } from "../ingest/roleIndex.js";
import { SOURCES } from "../scraper/registry.js";

/**
 * Import the career graph into the database.
 *
 * Source of truth is still the curated sheet exported as nodeMap.json — this just
 * replaces the v1 "commit a JSON file into the frontend bundle" step. Pass a path
 * to load a different export:
 *
 *   npm run db:seed -w @career-maps/api -- ./my-nodeMap.json
 */
async function main(): Promise<void> {
  const custom = process.argv[2];
  const require = createRequire(import.meta.url);
  const path = custom ?? require.resolve("@career-maps/core/data/nodeMap.json");

  console.log(`reading ${path}`);
  const nodeMap = JSON.parse(readFileSync(path, "utf8")) as LegacyNodeMap;
  const graph = legacyNodeMapToGraph(nodeMap);
  console.log(`parsed ${graph.nodes.length} roles and ${graph.edges.length} transitions`);

  // The v1 README asked humans to avoid loops by hand. Now we check, because a
  // cycle silently breaks duration maths and used to hang the path finder.
  const cycles = findCycles(graph);
  if (cycles.length > 0) {
    console.error(`refusing to import: found ${cycles.length} cycle(s), e.g. ${cycles[0]?.join(" -> ")}`);
    process.exit(1);
  }

  const centrality = betweennessCentrality(graph);
  const degree = degrees(graph);

  for (const node of graph.nodes) {
    const nodeDegree = degree.get(node.id);
    await prisma.role.upsert({
      where: { id: node.id },
      create: {
        id: node.id,
        slug: node.slug,
        name: node.name,
        category: node.category ?? null,
        centrality: centrality.get(node.id) ?? 0,
        inDegree: nodeDegree?.in ?? 0,
        outDegree: nodeDegree?.out ?? 0,
      },
      update: {
        slug: node.slug,
        name: node.name,
        centrality: centrality.get(node.id) ?? 0,
        inDegree: nodeDegree?.in ?? 0,
        outDegree: nodeDegree?.out ?? 0,
      },
    });
  }
  console.log(`upserted ${graph.nodes.length} roles`);

  // Replace transitions wholesale: an edge removed from the sheet must disappear
  // here too, and upserting alone would leave orphans behind.
  await prisma.roleEdge.deleteMany({});
  for (const edge of graph.edges) {
    await prisma.roleEdge.create({
      data: {
        fromId: edge.from,
        toId: edge.to,
        durationYears: edge.durationYears,
        skillsJson: JSON.stringify(edge.skills),
      },
    });
  }
  console.log(`wrote ${graph.edges.length} transitions`);

  await seedCuratedSkills(graph.edges);
  await syncRoleAliases();
  await registerSources();

  const top = [...centrality.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("most connected stages:", top.map(([id, score]) => `${id} (${score.toFixed(1)})`).join(", "));
}

/**
 * Sheet skills describe what a transition teaches you, so they attach to the role
 * you arrive at. Stored with origin="graph" to keep them distinct from the
 * scraped market signal.
 */
async function seedCuratedSkills(edges: Array<{ to: string; skills: string[] }>): Promise<void> {
  const byRole = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.skills.length === 0) continue;
    const set = byRole.get(edge.to) ?? new Set<string>();
    for (const skill of edge.skills) set.add(skill);
    byRole.set(edge.to, set);
  }

  await prisma.roleSkill.deleteMany({ where: { origin: "graph" } });

  let written = 0;
  for (const [roleId, skills] of byRole) {
    for (const name of skills) {
      const skill = await prisma.skill.upsert({
        where: { name },
        create: { name, category: "curriculum" },
        update: {},
      });
      await prisma.roleSkill.create({
        data: { roleId, skillId: skill.id, origin: "graph", demand: 1, mentions: 1 },
      });
      written += 1;
    }
  }
  console.log(`attached ${written} curated skills`);
}

async function registerSources(): Promise<void> {
  for (const source of SOURCES) {
    await prisma.source.upsert({
      where: { key: source.key },
      create: { key: source.key, name: source.name, homepage: source.homepage, kind: source.kind },
      update: { name: source.name, homepage: source.homepage, kind: source.kind },
    });
  }
  console.log(`registered ${SOURCES.length} job sources`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("seed complete");
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
