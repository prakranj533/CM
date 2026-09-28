import { createHash } from "node:crypto";
import { slugify } from "@career-maps/core";
import { load } from "cheerio";
import { allRoleEdges, allRoles, deleteRoles, edgeId, saveRoles } from "../store.js";
import type { RoleRecord } from "../firestore.js";
import { fetchText } from "../scraper/http.js";

const NCO_URL = "https://dge.gov.in/nat";
const ROOT_ROLE_NAMES = ["10th (S.S.C.)", "12th (H.S.C.)", "12th Science", "12th Commerce", "12th Arts"];

const PREPARATION = {
  degree: { id: "catalog-prep-degree", name: "Bachelor's degree or equivalent professional qualification", years: 3 },
  technical: { id: "catalog-prep-technical", name: "Diploma or technical degree", years: 2 },
  vocational: { id: "catalog-prep-vocational", name: "ITI, vocational training, apprenticeship or certification", years: 1 },
  foundation: { id: "catalog-prep-foundation", name: "Job-ready foundational skills training", years: 0.5 },
  defence: { id: "catalog-prep-defence", name: "Defence entrance test, medical and fitness assessment", years: 0.5 },
} as const;

interface NcoOccupation {
  code: string;
  title: string;
  division: string;
  subdivision: string;
  group: string;
  family: string;
}

function preparationFor(division: string): keyof typeof PREPARATION {
  if (division === "Managers" || division === "Professionals") return "degree";
  if (division.includes("Technicians")) return "technical";
  if (division.includes("Elementary")) return "foundation";
  if (division.includes("Armed")) return "defence";
  return "vocational";
}

function roleId(occupation: NcoOccupation): string {
  return `nco:${createHash("sha1").update(`${occupation.code}:${occupation.title}`).digest("hex").slice(0, 24)}`;
}

async function fetchOccupations(): Promise<NcoOccupation[]> {
  const occupations: NcoOccupation[] = [];
  for (let page = 0; page < 50; page += 1) {
    const html = await fetchText(`${NCO_URL}?page=${page}`);
    const $ = load(html);
    let pageRows = 0;
    $("main table tbody tr").each((_index, row) => {
      const cells = $(row)
        .find("td")
        .map((_cellIndex, cell) => $(cell).text().replace(/\s+/g, " ").trim())
        .get();
      if (cells.length < 8 || !cells[1] || !cells[2]) return;
      occupations.push({
        title: cells[1],
        code: cells[2],
        division: cells[4] || "Other occupations",
        subdivision: cells[5] || "Other occupations",
        group: cells[6] || "Other occupations",
        family: cells[7] || "Other occupations",
      });
      pageRows += 1;
    });
    console.log(`NCO occupations: ${occupations.length}`);
    const hasNext = $("a").toArray().some((link) => $(link).text().trim() === "Next");
    if (pageRows === 0 || !hasNext) break;
  }
  return [...new Map(occupations.map((occupation) => [`${occupation.code}:${occupation.title}`, occupation])).values()];
}

function newRole(id: string, slug: string, name: string, category: string, description: string, catalogUri: string, catalogCode: string): RoleRecord {
  return {
    id,
    slug,
    name,
    nameLower: name.toLowerCase(),
    category,
    description,
    catalogUri,
    catalogSource: "nco",
    catalogCode,
    centrality: 0,
    inDegree: 0,
    outDegree: 0,
    openingCount: 0,
    aliases: [],
    skills: [],
    incoming: [],
    outgoing: [],
    updatedAt: new Date(),
  };
}

async function main(): Promise<void> {
  const occupations = await fetchOccupations();
  const existing = await allRoles();
  const removed = existing.filter((role) => role.catalogSource === "esco" || role.catalogSource === "nco");
  const removedIds = new Set(removed.map((role) => role.id));
  await deleteRoles([...removedIds]);

  const rolesById = new Map(
    existing
      .filter((role) => !removedIds.has(role.id))
      .map((role) => [role.id, {
        ...role,
        outgoing: (role.outgoing ?? []).filter((edge) => !removedIds.has(edge.toId)),
        incoming: (role.incoming ?? []).filter((edge) => !removedIds.has(edge.fromId)),
      }]),
  );
  const imported = [
    ...occupations.map((occupation) => newRole(
      roleId(occupation),
      `nco-${slugify(occupation.title)}-${occupation.code.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 100),
      occupation.title,
      occupation.division,
      `${occupation.family}. Indian National Classification of Occupations 2015 code ${occupation.code}.`,
      NCO_URL,
      occupation.code,
    )),
    ...Object.entries(PREPARATION).map(([key, preparation]) => newRole(
      preparation.id,
      `career-preparation-${key}`,
      preparation.name,
      "Career preparation",
      "General Indian preparation milestone. Exact requirements vary by occupation, regulator and institution.",
      `career-maps:preparation:${key}`,
      `prep-${key}`,
    )),
  ];
  for (const role of imported) rolesById.set(role.id, role);

  const rootRoles = [...rolesById.values()].filter((role) => ROOT_ROLE_NAMES.includes(role.name));
  const edges: Array<{ fromId: string; toId: string; durationYears: number; skills: string[]; origin: "catalog" }> = occupations.map((occupation) => ({
    fromId: PREPARATION[preparationFor(occupation.division)].id,
    toId: roleId(occupation),
    durationYears: 0.5,
    skills: [],
    origin: "catalog" as const,
  }));
  for (const role of rootRoles) {
    for (const [key, preparation] of Object.entries(PREPARATION)) {
      if (role.name === "10th (S.S.C.)" && key === "degree") continue;
      edges.push({ fromId: role.id, toId: preparation.id, durationYears: preparation.years, skills: [], origin: "catalog" });
    }
  }

  for (const edge of edges) {
    const record = { ...edge, id: edgeId(edge.fromId, edge.toId) };
    const from = rolesById.get(edge.fromId);
    const to = rolesById.get(edge.toId);
    if (!from || !to) continue;
    from.outgoing = [...from.outgoing.filter((existingEdge) => existingEdge.id !== record.id), record];
    to.incoming = [...to.incoming.filter((existingEdge) => existingEdge.id !== record.id), record];
  }

  const all = [...rolesById.values()];
  const allEdges = allRoleEdges(all);
  const degrees = new Map<string, { incoming: number; outgoing: number }>();
  for (const edge of allEdges) {
    const from = degrees.get(edge.fromId) ?? { incoming: 0, outgoing: 0 };
    from.outgoing += 1;
    degrees.set(edge.fromId, from);
    const to = degrees.get(edge.toId) ?? { incoming: 0, outgoing: 0 };
    to.incoming += 1;
    degrees.set(edge.toId, to);
  }
  for (const role of all) {
    const degree = degrees.get(role.id) ?? { incoming: 0, outgoing: 0 };
    if (role.catalogSource === "nco") {
      role.inDegree = degree.incoming;
      role.outDegree = degree.outgoing;
      role.centrality = degree.incoming + degree.outgoing;
    }
    role.updatedAt = new Date();
  }
  await saveRoles(all, true);
  console.log(`imported ${occupations.length} Indian NCO-2015 occupations and ${edges.length} planning transitions`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
