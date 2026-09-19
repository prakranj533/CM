import type { CareerGraph } from "./types.js";

/**
 * Betweenness centrality (Brandes' algorithm) for directed, unweighted graphs.
 *
 * v1 pulled in `ngraph.centrality` and could only score the component reachable
 * from a node hard-coded as "8th". This runs over the whole graph instead, so
 * renaming or removing any single role can no longer break the ranking.
 */
export function betweennessCentrality(graph: CareerGraph): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) adjacency.get(edge.from)?.push(edge.to);

  const score = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));

  for (const source of adjacency.keys()) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const shortestPaths = new Map<string, number>();
    const distance = new Map<string, number>();

    for (const id of adjacency.keys()) {
      predecessors.set(id, []);
      shortestPaths.set(id, 0);
      distance.set(id, -1);
    }
    shortestPaths.set(source, 1);
    distance.set(source, 0);

    const queue: string[] = [source];
    while (queue.length) {
      const current = queue.shift();
      if (current === undefined) continue;
      stack.push(current);
      const currentDistance = distance.get(current) ?? 0;
      for (const neighbour of adjacency.get(current) ?? []) {
        if ((distance.get(neighbour) ?? -1) < 0) {
          distance.set(neighbour, currentDistance + 1);
          queue.push(neighbour);
        }
        if (distance.get(neighbour) === currentDistance + 1) {
          shortestPaths.set(neighbour, (shortestPaths.get(neighbour) ?? 0) + (shortestPaths.get(current) ?? 0));
          predecessors.get(neighbour)?.push(current);
        }
      }
    }

    const dependency = new Map<string, number>();
    while (stack.length) {
      const node = stack.pop();
      if (node === undefined) continue;
      for (const predecessor of predecessors.get(node) ?? []) {
        const ratio = (shortestPaths.get(predecessor) ?? 0) / (shortestPaths.get(node) ?? 1);
        dependency.set(predecessor, (dependency.get(predecessor) ?? 0) + ratio * (1 + (dependency.get(node) ?? 0)));
      }
      if (node !== source) score.set(node, (score.get(node) ?? 0) + (dependency.get(node) ?? 0));
    }
  }

  return score;
}

/** In/out degree per node — cheap signal for "how many ways in/out" a role has. */
export function degrees(graph: CareerGraph): Map<string, { in: number; out: number }> {
  const result = new Map<string, { in: number; out: number }>(
    graph.nodes.map((node) => [node.id, { in: 0, out: 0 }]),
  );
  for (const edge of graph.edges) {
    const from = result.get(edge.from);
    const to = result.get(edge.to);
    if (from) from.out += 1;
    if (to) to.in += 1;
  }
  return result;
}
