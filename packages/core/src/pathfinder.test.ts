import assert from "node:assert/strict";
import { test } from "node:test";
import { PathFinder } from "./pathfinder.js";
import { betweennessCentrality } from "./centrality.js";
import { findCycles, legacyNodeMapToGraph } from "./legacy.js";
import { normalizeTitle, slugify } from "./slug.js";
import type { CareerGraph } from "./types.js";

const graph: CareerGraph = {
  nodes: [
    { id: "a", slug: "a", name: "A" },
    { id: "b", slug: "b", name: "B" },
    { id: "c", slug: "c", name: "C" },
    { id: "d", slug: "d", name: "D" },
  ],
  edges: [
    { from: "a", to: "b", durationYears: 1, skills: ["s1"] },
    { from: "b", to: "d", durationYears: 2, skills: ["s2"] },
    { from: "a", to: "c", durationYears: 4, skills: ["s3"] },
    { from: "c", to: "d", durationYears: 0.5, skills: ["s2"] },
  ],
};

test("finds every path and totals duration", () => {
  const paths = new PathFinder(graph).findAllPaths("a", "d");
  assert.equal(paths.length, 2);
  assert.deepEqual(
    paths.map((path) => path.steps.map((step) => step.roleId)),
    [
      ["a", "b", "d"],
      ["a", "c", "d"],
    ],
  );
  assert.equal(paths[0]?.totalYears, 3);
  assert.deepEqual(paths[0]?.skills, ["s1", "s2"]);
});

test("terminates on cyclic data instead of recursing forever", () => {
  const cyclic: CareerGraph = {
    nodes: graph.nodes,
    edges: [...graph.edges, { from: "d", to: "a", durationYears: 1, skills: [] }],
  };
  const paths = new PathFinder(cyclic).findAllPaths("a", "d");
  assert.equal(paths.length, 2);

  const cycles = findCycles(cyclic);
  assert.ok(cycles.length >= 1);
  // Each reported cycle starts and ends on the same node.
  for (const cycle of cycles) assert.equal(cycle[0], cycle[cycle.length - 1]);
  assert.deepEqual(findCycles(graph), []);
});

test("fastestPath picks the cheapest route, not the shortest hop count", () => {
  const fastest = new PathFinder(graph).fastestPath("a", "d");
  assert.deepEqual(fastest?.steps.map((step) => step.roleId), ["a", "b", "d"]);
  assert.equal(fastest?.totalYears, 3);
});

test("reachableFrom and subgraphBetween scope the graph", () => {
  const finder = new PathFinder(graph);
  assert.deepEqual(finder.reachableFrom("a").map((node) => node.id).sort(), ["b", "c", "d"]);
  assert.equal(finder.subgraphBetween("a", "d").nodes.length, 4);
  assert.equal(finder.subgraphBetween("b", "d").nodes.length, 2);
});

test("missing endpoints yield no paths", () => {
  const finder = new PathFinder(graph);
  assert.deepEqual(finder.findAllPaths("a", "nope"), []);
  assert.equal(finder.fastestPath("nope", "d"), null);
});

test("centrality ranks the pass-through nodes above the endpoints", () => {
  const scores = betweennessCentrality(graph);
  assert.ok((scores.get("b") ?? 0) > 0);
  assert.equal(scores.get("a"), 0);
});

test("legacy nodeMap converts to slug-keyed graph", () => {
  const converted = legacyNodeMapToGraph({
    "uuid-1": { id: "uuid-1", name: "10th (S.S.C.)", paths: [{ to: "uuid-2", duration: "2", skills: "Maths, Science" }] },
    "uuid-2": { id: "uuid-2", name: "Engineering Diploma", paths: [] },
  });
  assert.deepEqual(converted.nodes.map((node) => node.slug), ["10th-s-s-c", "engineering-diploma"]);
  assert.deepEqual(converted.edges[0]?.skills, ["Maths", "Science"]);
  assert.equal(converted.edges[0]?.durationYears, 2);
});

test("slug and title helpers normalize messy input", () => {
  assert.equal(slugify("  Associate Membership of Institution of Engineers(A.M.I.E.) "), "associate-membership-of-institution-of-engineers-a-m-i-e");
  assert.equal(slugify("C++ & Data"), "c-plus-plus-and-data");
  assert.equal(normalizeTitle("Senior Software Engineer III (Remote)"), "software engineer");
});
