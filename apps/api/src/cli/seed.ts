import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { betweennessCentrality, degrees, findCycles, legacyNodeMapToGraph, type LegacyNodeMap } from "@career-maps/core";
import { allRoles, edgeId, saveRoles, sourceByKey, upsertSource } from "../store.js";
import type { RoleEdgeRecord, RoleRecord, RoleSkillRecord } from "../firestore.js";
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

  const existing = await allRoles();
  const oldById = new Map(existing.map((role) => [role.id, role]));
  const centrality = betweennessCentrality(graph);
  const degree = degrees(graph);
  const outgoing = new Map<string, RoleEdgeRecord[]>();
  const incoming = new Map<string, RoleEdgeRecord[]>();
  const attach = (edge: RoleEdgeRecord): void => {
    const from = outgoing.get(edge.fromId) ?? [];
    from.push(edge);
    outgoing.set(edge.fromId, from);
    const to = incoming.get(edge.toId) ?? [];
    to.push(edge);
    incoming.set(edge.toId, to);
  };

  for (const role of existing) {
    for (const edge of role.outgoing ?? []) if (edge.origin === "catalog") attach(edge);
  }
  for (const edge of graph.edges) {
    attach({
      id: edgeId(edge.from, edge.to),
      fromId: edge.from,
      toId: edge.to,
      durationYears: edge.durationYears,
      skills: edge.skills,
      origin: "curated",
    });
  }

  const skillsByRole = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    const skills = skillsByRole.get(edge.to) ?? new Set<string>();
    for (const skill of edge.skills) skills.add(skill);
    skillsByRole.set(edge.to, skills);
  }

  const graphIds = new Set(graph.nodes.map((node) => node.id));
  const preserved = existing
    .filter((role) => !graphIds.has(role.id))
    .map((role) => ({
      ...role,
      outgoing: outgoing.get(role.id) ?? [],
      incoming: incoming.get(role.id) ?? [],
    }));
  const imported = graph.nodes.map((node) => {
    const old = oldById.get(node.id);
    const nodeDegree = degree.get(node.id);
    const graphSkills: RoleSkillRecord[] = [...(skillsByRole.get(node.id) ?? [])].map((name) => ({
      name,
      category: "curriculum",
      origin: "graph",
      demand: 1,
      mentions: 1,
    }));
    return {
      id: node.id,
      slug: node.slug,
      name: node.name,
      nameLower: node.name.toLowerCase(),
      category: node.category ?? null,
      description: old?.description ?? null,
      catalogUri: old?.catalogUri ?? null,
      catalogSource: old?.catalogSource ?? null,
      catalogCode: old?.catalogCode ?? null,
      centrality: centrality.get(node.id) ?? 0,
      inDegree: nodeDegree?.in ?? 0,
      outDegree: nodeDegree?.out ?? 0,
      openingCount: old?.openingCount ?? 0,
      aliases: old?.aliases ?? [],
      skills: [...graphSkills, ...(old?.skills ?? []).filter((skill) => skill.origin === "jobs")],
      outgoing: outgoing.get(node.id) ?? [],
      incoming: incoming.get(node.id) ?? [],
      updatedAt: new Date(),
    } satisfies RoleRecord;
  });

  await saveRoles([...preserved, ...imported], true);
  console.log(`upserted ${graph.nodes.length} roles and ${graph.edges.length} transitions`);
  await syncRoleAliases();
  await registerSources();

  const top = [...centrality.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("most connected stages:", top.map(([id, score]) => `${id} (${score.toFixed(1)})`).join(", "));
}

async function registerSources(): Promise<void> {
  for (const source of SOURCES) {
    const existing = await sourceByKey(source.key);
    await upsertSource({
      key: source.key,
      name: source.name,
      homepage: source.homepage,
      kind: source.kind,
      enabled: existing?.enabled ?? true,
      lastRunAt: existing?.lastRunAt ?? null,
    });
  }
  console.log(`registered ${SOURCES.length} job sources`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
