import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoleIndex, matchRole } from "./match.js";
import { normalizeRoleName, normalizeTitle } from "./slug.js";

// A representative slice of the curated graph: qualification nodes, a couple of
// single-word roles, and job-like nodes with curated aliases.
const index = buildRoleIndex([
  { id: "software-job-it", name: "Software Job (IT)", aliases: ["Software Engineer", "Backend Engineer"] },
  { id: "data-entry-operator", name: "Data Entry Operator" },
  { id: "finance", name: "Finance" },
  { id: "lic-agent", name: "LIC Agent" },
  { id: "marketing", name: "Marketing", aliases: ["Marketing Specialist"] },
  { id: "graphic-designer", name: "Graphic Designer" },
  { id: "engineering-diploma", name: "Engineering Diploma" },
]);

test("curated aliases match, including with seniority noise", () => {
  assert.equal(matchRole("Senior Software Engineer", index)?.roleId, "software-job-it");
  assert.equal(matchRole("Backend Engineer III", index)?.roleId, "software-job-it");
  assert.equal(matchRole("Marketing Specialist", index)?.roleId, "marketing");
});

test("exact role-name match wins", () => {
  const match = matchRole("Graphic Designer", index);
  assert.equal(match?.roleId, "graphic-designer");
  assert.equal(match?.score, 1);
});

test("one shared generic word is not a match", () => {
  // Regressions we actually hit against live RemoteOK data.
  assert.equal(matchRole("AI Engineer Data APIs", index), null);
  assert.equal(matchRole("AI agent engineer", index), null);
  assert.equal(matchRole("Machine Operator & Labourers", index), null);
  assert.equal(matchRole("Technical Product Lead AI Finance App", index), null);
  assert.equal(matchRole("Engineering Manager Thailand", index), null);
});

test("single-word roles never match on overlap alone", () => {
  assert.equal(matchRole("Head of Finance Operations", index), null);
  // …but still match when the title is exactly the role.
  assert.equal(matchRole("Finance", index)?.roleId, "finance");
});

test("genuine multi-word overlap still matches", () => {
  assert.equal(matchRole("Data Entry Operator (Night Shift)", index)?.roleId, "data-entry-operator");
  assert.equal(matchRole("Remote Data Entry Operator", index)?.roleId, "data-entry-operator");
});

test("role names keep words that are seniority markers in job titles", () => {
  // "entry" must survive here or "Data Entry Operator" collapses to "data operator".
  assert.equal(normalizeRoleName("Data Entry Operator"), "data entry operator");
  assert.equal(normalizeTitle("Entry Level Data Analyst"), "data analyst");
});

test("html entities in scraped titles are cleaned", () => {
  assert.equal(normalizeRoleName("Machine Operator &amp; Labourers"), "machine operator labourers");
});

test("unmatched titles return null rather than a weak guess", () => {
  assert.equal(matchRole("Air Hostess", index), null);
  assert.equal(matchRole("", index), null);
});
