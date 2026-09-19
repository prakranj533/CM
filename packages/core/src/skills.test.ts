import assert from "node:assert/strict";
import { test } from "node:test";
import { detectSeniority, extractSkills } from "./skills.js";

test("extracts skills from a job description", () => {
  const names = extractSkills(
    "We need strong TypeScript and React skills. Experience with Node.js, PostgreSQL and AWS required. Nice to have: Kubernetes, k8s operators, GraphQL.",
  ).map((skill) => skill.name);

  for (const expected of ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Kubernetes", "GraphQL"]) {
    assert.ok(names.includes(expected), `expected to find ${expected} in ${names.join(", ")}`);
  }
});

test("counts repeated mentions and ranks by frequency", () => {
  const skills = extractSkills("Python, python, and more Python. Some Java too.");
  assert.equal(skills[0]?.name, "Python");
  assert.equal(skills[0]?.hits, 3);
});

test("short names do not match inside longer words", () => {
  const names = extractSkills("We are going to Rwanda for a retreat, no coding involved.").map((s) => s.name);
  assert.ok(!names.includes("Go"));
  assert.ok(!names.includes("R"));
});

test("symbol-heavy names are matched", () => {
  const names = extractSkills("Looking for C++ and C# developers with .NET experience").map((s) => s.name);
  assert.ok(names.includes("C++"));
  assert.ok(names.includes("C#"));
});

test("aliases collapse into the canonical skill name", () => {
  const names = extractSkills("golang microservices with apache kafka and infrastructure as code").map((s) => s.name);
  assert.ok(names.includes("Go"));
  assert.ok(names.includes("Kafka"));
  assert.ok(names.includes("Terraform"));
  assert.ok(!names.includes("golang"));
});

test("non-software domains are covered", () => {
  const names = extractSkills("Nursing role requiring patient care, EMR documentation and phlebotomy.").map((s) => s.name);
  assert.ok(names.includes("Patient Care"));
  assert.ok(names.includes("Medical Records"));
  assert.ok(names.includes("Laboratory Techniques"));
});

// Regressions found while auditing real We Work Remotely postings.
test("hourly rates are not read as Human Resources", () => {
  const names = extractSkills("Senior Independent Software Developer ($90-$170/hr). Rates quoted per hr.").map((s) => s.name);
  assert.ok(!names.includes("Human Resources"));
  assert.ok(extractSkills("Recruitment and talent acquisition role").map((s) => s.name).includes("Human Resources"));
});

test("test automation is not industrial automation", () => {
  const names = extractSkills("You will own unit testing and test automation for our SaaS product.").map((s) => s.name);
  assert.ok(names.includes("Testing"));
  assert.ok(!names.includes("PLC & SCADA"));
  assert.ok(extractSkills("Commissioning PLC and SCADA panels").map((s) => s.name).includes("PLC & SCADA"));
});

test("ordinary words are not mistaken for Go or R", () => {
  const prose = "We go the extra mile, and our R&D team will go to market fast.";
  const names = extractSkills(prose).map((s) => s.name);
  assert.ok(!names.includes("Go"));
  assert.ok(!names.includes("R"));

  const explicit = extractSkills("Backend services in Golang; analysis in R programming.").map((s) => s.name);
  assert.ok(explicit.includes("Go"));
  assert.ok(explicit.includes("R"));
});

test("detects seniority from titles", () => {
  assert.equal(detectSeniority("Senior Backend Engineer"), "senior");
  assert.equal(detectSeniority("Software Engineering Intern"), "intern");
  assert.equal(detectSeniority("Head of Data"), "executive");
  assert.equal(detectSeniority("Staff Engineer"), "lead");
  assert.equal(detectSeniority("Graduate Analyst"), "entry");
  assert.equal(detectSeniority("Backend Engineer"), "mid");
});
