/** A career stage: a qualification, exam, course or job role. */
export interface RoleNode {
  id: string;
  /** Stable, human-readable identifier derived from the name. Safe to use in URLs. */
  slug: string;
  name: string;
  /** Free-form grouping, e.g. "Engineering", "Medical". */
  category?: string | null;
}

/** A directed transition from one career stage to the next. */
export interface RoleEdge {
  from: string;
  to: string;
  /** Typical time to complete the transition, in years. */
  durationYears: number;
  /** Skills acquired/required during the transition. */
  skills: string[];
}

export interface CareerGraph {
  nodes: RoleNode[];
  edges: RoleEdge[];
}

/** One hop along a path. `durationYears` is the cost of arriving at this node. */
export interface PathStep {
  roleId: string;
  slug: string;
  name: string;
  durationYears: number;
  skills: string[];
}

export interface CareerPath {
  steps: PathStep[];
  totalYears: number;
  /** De-duplicated union of every skill picked up along the path. */
  skills: string[];
}

export interface FindPathsOptions {
  /** Stop after this many complete paths. Guards against combinatorial blow-up. */
  maxPaths?: number;
  /** Maximum number of hops in a path. */
  maxDepth?: number;
}

/** Shape of the original (v1) `nodeMap.json` produced by csv-to-json-data. */
export interface LegacyNodeMap {
  [id: string]: {
    id: string;
    name: string;
    paths: Array<{ to: string; duration?: string | number; skills?: string }>;
  };
}
