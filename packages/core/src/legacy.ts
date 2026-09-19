import { slugify } from "./slug.js";
import type { CareerGraph, LegacyNodeMap, RoleEdge, RoleNode } from "./types.js";

/**
 * Convert the v1 `nodeMap.json` (UUID keys, duration/skills as strings) into the
 * normalized CareerGraph used everywhere else. Node ids become slugs so they stay
 * stable when the source sheet is re-imported.
 */
export function legacyNodeMapToGraph(nodeMap: LegacyNodeMap): CareerGraph {
  const idToSlug = new Map<string, string>();
  const takenSlugs = new Map<string, number>();
  const nodes: RoleNode[] = [];

  for (const entry of Object.values(nodeMap)) {
    const name = entry.name.trim();
    const base = slugify(name);
    const seen = takenSlugs.get(base) ?? 0;
    takenSlugs.set(base, seen + 1);
    const slug = seen === 0 ? base : `${base}-${seen + 1}`;
    idToSlug.set(entry.id, slug);
    nodes.push({ id: slug, slug, name });
  }

  const edges: RoleEdge[] = [];
  const seenEdges = new Set<string>();

  for (const entry of Object.values(nodeMap)) {
    const from = idToSlug.get(entry.id);
    if (!from) continue;
    for (const path of entry.paths ?? []) {
      const to = idToSlug.get(path.to);
      if (!to || from === to) continue;
      const key = `${from}->${to}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({
        from,
        to,
        durationYears: parseDuration(path.duration),
        skills: parseSkills(path.skills),
      });
    }
  }

  return { nodes, edges };
}

function parseDuration(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseSkills(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);
}

/**
 * Detect cycles. The v1 README warned that a loop in the sheet "will create
 * issues" but nothing ever checked for one; this lets the importer refuse bad data.
 *
 * Returns one representative cycle per back edge found during DFS (each starting
 * and ending on the same node) — enough to report and fix bad data, but not an
 * exhaustive enumeration of every distinct cycle.
 */
export function findCycles(graph: CareerGraph): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) adjacency.get(edge.from)?.push(edge.to);

  const cycles: string[][] = [];
  const state = new Map<string, 0 | 1 | 2>();
  const trail: string[] = [];

  const visit = (id: string): void => {
    state.set(id, 1);
    trail.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        const start = trail.indexOf(next);
        cycles.push([...trail.slice(start === -1 ? 0 : start), next]);
      } else if (nextState === 0) {
        visit(next);
      }
    }
    trail.pop();
    state.set(id, 2);
  };

  for (const node of graph.nodes) if ((state.get(node.id) ?? 0) === 0) visit(node.id);
  return cycles;
}
