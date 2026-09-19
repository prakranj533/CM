import type { CareerGraph, CareerPath, FindPathsOptions, PathStep, RoleEdge, RoleNode } from "./types.js";

const DEFAULT_MAX_PATHS = 50;
const DEFAULT_MAX_DEPTH = 14;

/**
 * Enumerates every route between two career stages.
 *
 * Ported from the v1 `src/utils/PathFinder.js` with two correctness fixes:
 *  1. v1 called `visitedNodes.includes(e => e.id === currNodeId)`, passing a
 *     predicate to `Array.includes`, which always returns false. The cycle guard
 *     therefore never fired and any loop in the data caused infinite recursion.
 *     We now track visited ids in a Set.
 *  2. Depth and result caps bound the work on dense graphs.
 */
export class PathFinder {
  private readonly nodesById = new Map<string, RoleNode>();
  private readonly outgoing = new Map<string, RoleEdge[]>();

  constructor(graph: CareerGraph) {
    for (const node of graph.nodes) this.nodesById.set(node.id, node);
    for (const edge of graph.edges) {
      if (!this.nodesById.has(edge.from) || !this.nodesById.has(edge.to)) continue;
      const list = this.outgoing.get(edge.from);
      if (list) list.push(edge);
      else this.outgoing.set(edge.from, [edge]);
    }
  }

  get nodeCount(): number {
    return this.nodesById.size;
  }

  neighbours(roleId: string): RoleEdge[] {
    return this.outgoing.get(roleId) ?? [];
  }

  findAllPaths(fromId: string, toId: string, options: FindPathsOptions = {}): CareerPath[] {
    const maxPaths = options.maxPaths ?? DEFAULT_MAX_PATHS;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    if (!this.nodesById.has(fromId) || !this.nodesById.has(toId)) return [];

    const found: CareerPath[] = [];
    const visited = new Set<string>();
    const stack: PathStep[] = [];

    const walk = (currentId: string, arrivalCost: number, arrivalSkills: string[]): void => {
      if (found.length >= maxPaths || visited.has(currentId)) return;
      const node = this.nodesById.get(currentId);
      if (!node) return;

      visited.add(currentId);
      stack.push({
        roleId: node.id,
        slug: node.slug,
        name: node.name,
        durationYears: arrivalCost,
        skills: arrivalSkills,
      });

      if (currentId === toId) {
        found.push(toCareerPath(stack));
      } else if (stack.length <= maxDepth) {
        for (const edge of this.neighbours(currentId)) {
          walk(edge.to, edge.durationYears, edge.skills);
          if (found.length >= maxPaths) break;
        }
      }

      stack.pop();
      visited.delete(currentId);
    };

    walk(fromId, 0, []);
    return found.sort((a, b) => a.totalYears - b.totalYears || a.steps.length - b.steps.length);
  }

  /** Shortest route by cumulative duration (Dijkstra). */
  fastestPath(fromId: string, toId: string): CareerPath | null {
    if (!this.nodesById.has(fromId) || !this.nodesById.has(toId)) return null;

    const best = new Map<string, number>([[fromId, 0]]);
    const cameFrom = new Map<string, RoleEdge>();
    const queue: Array<{ id: string; cost: number }> = [{ id: fromId, cost: 0 }];
    const settled = new Set<string>();

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (!current || settled.has(current.id)) continue;
      settled.add(current.id);
      if (current.id === toId) break;

      for (const edge of this.neighbours(current.id)) {
        const cost = current.cost + edge.durationYears;
        if (cost < (best.get(edge.to) ?? Infinity)) {
          best.set(edge.to, cost);
          cameFrom.set(edge.to, edge);
          queue.push({ id: edge.to, cost });
        }
      }
    }

    if (!best.has(toId)) return null;

    const steps: PathStep[] = [];
    let cursor: string | undefined = toId;
    while (cursor) {
      const node = this.nodesById.get(cursor);
      if (!node) break;
      const inbound: RoleEdge | undefined = cameFrom.get(cursor);
      steps.unshift({
        roleId: node.id,
        slug: node.slug,
        name: node.name,
        durationYears: inbound?.durationYears ?? 0,
        skills: inbound?.skills ?? [],
      });
      cursor = inbound?.from;
    }
    return toCareerPath(steps);
  }

  /** Every role reachable from `fromId`, used to populate destination pickers. */
  reachableFrom(fromId: string): RoleNode[] {
    const seen = new Set<string>([fromId]);
    const queue = [fromId];
    const result: RoleNode[] = [];
    while (queue.length) {
      const id = queue.shift();
      if (!id) continue;
      for (const edge of this.neighbours(id)) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        const node = this.nodesById.get(edge.to);
        if (node) result.push(node);
        queue.push(edge.to);
      }
    }
    return result;
  }

  /** The induced sub-graph containing only nodes that lie on some from→to path. */
  subgraphBetween(fromId: string, toId: string, options: FindPathsOptions = {}): CareerGraph {
    const paths = this.findAllPaths(fromId, toId, options);
    const nodeIds = new Set<string>();
    const edgeKeys = new Set<string>();
    const edges: RoleEdge[] = [];

    for (const path of paths) {
      path.steps.forEach((step, index) => {
        nodeIds.add(step.roleId);
        const previous = index > 0 ? path.steps[index - 1] : undefined;
        if (!previous) return;
        const key = `${previous.roleId}->${step.roleId}`;
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push({
          from: previous.roleId,
          to: step.roleId,
          durationYears: step.durationYears,
          skills: step.skills,
        });
      });
    }

    const nodes: RoleNode[] = [];
    for (const id of nodeIds) {
      const node = this.nodesById.get(id);
      if (node) nodes.push(node);
    }
    return { nodes, edges };
  }
}

function toCareerPath(steps: PathStep[]): CareerPath {
  const cloned = steps.map((step) => ({ ...step, skills: [...step.skills] }));
  const totalYears = cloned.reduce((total, step) => total + step.durationYears, 0);
  const skills = new Set<string>();
  for (const step of cloned) for (const skill of step.skills) skills.add(skill);
  return {
    steps: cloned,
    totalYears: Math.round(totalYears * 100) / 100,
    skills: [...skills],
  };
}
